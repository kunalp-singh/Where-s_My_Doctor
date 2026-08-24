from __future__ import annotations

from datetime import date, datetime, timedelta
import logging
from typing import Any

from beanie import PydanticObjectId
from beanie.operators import In
from fastapi import HTTPException, status

from ..models.appointment import Appointment
from ..models.booking_session import BookingSession
from ..models.clinical import SymptomForm
from ..models.enums import AppointmentStatus, NotificationType, UserRole
from ..models.user import User
from ..schemas.patient import (
    BookAppointmentRequest,
    BookAppointmentResponse,
    BookingSessionResponse,
    DoctorSearchResult,
    DoctorSlot,
    PatientAppointmentResponse,
    SymptomSubmission,
    SymptomSummaryResponse,
    UpdateBookingSessionRequest,
)
from ..services.ai import build_pre_visit_summary
from ..services.notifications import dispatch_appointment_notification

logger = logging.getLogger(__name__)

SPECIALISATION_KEYWORDS = {
    "Cardiology": ["chest pain", "heart", "palpitations", "shortness of breath", "blood pressure"],
    "Dermatology": ["rash", "skin", "itch", "acne", "mole", "eczema"],
    "Neurology": ["headache", "dizziness", "seizure", "numbness", "tingling", "migraine"],
    "Orthopedics": ["bone", "joint", "fracture", "knee", "back pain", "sprain", "shoulder"],
    "Pediatrics": ["child", "baby", "pediatric", "infant"],
    "Psychiatry": ["anxiety", "depression", "panic", "mood", "stress", "sleep"],
    "General Medicine": ["fever", "cough", "flu", "cold", "fatigue", "nausea"],
}


async def search_doctors(query: str | None = None) -> list[DoctorSearchResult]:
    doctors = await User.find(User.role == UserRole.DOCTOR).to_list()
    if not query:
        return [
            DoctorSearchResult(
                id=str(doctor.id),
                name=doctor.name,
                email=doctor.email,
                specialisation=getattr(doctor, "specialisation", None) or "General Medicine",
                working_hours=getattr(doctor, "working_hours", []),
                slot_duration_minutes=getattr(doctor, "slot_duration_minutes", 30),
            )
            for doctor in doctors
        ]

    lowered = query.lower()
    matched_specs: set[str] = set()
    for spec, keywords in SPECIALISATION_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords) or spec.lower() in lowered:
            matched_specs.add(spec)

    results: list[DoctorSearchResult] = []
    for doctor in doctors:
        doc_spec = getattr(doctor, "specialisation", None) or "General Medicine"
        doc_name = doctor.name.lower()

        if doc_spec in matched_specs or query.lower() in doc_name or query.lower() in doc_spec.lower():
            results.append(
                DoctorSearchResult(
                    id=str(doctor.id),
                    name=doctor.name,
                    email=doctor.email,
                    specialisation=doc_spec,
                    working_hours=getattr(doctor, "working_hours", []),
                    slot_duration_minutes=getattr(doctor, "slot_duration_minutes", 30),
                )
            )
    return results


async def get_doctor_slots(doctor_id: str, target_date: date | None = None) -> list[DoctorSlot]:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    day = target_date or date.today()
    slot_duration = getattr(doctor, "slot_duration_minutes", 30)

    start_dt = datetime(day.year, day.month, day.day, 9, 0, 0)
    end_dt = datetime(day.year, day.month, day.day, 18, 0, 0)

    existing_appointments = await Appointment.find(
        Appointment.doctor_id == doctor.id,
        In("status", [AppointmentStatus.HELD, AppointmentStatus.BOOKED]),
    ).to_list()

    busy_ranges: list[tuple[datetime, datetime]] = []
    now = datetime.now().replace(tzinfo=None)

    for appt in existing_appointments:
        if appt.status == AppointmentStatus.HELD:
            hold_exp = appt.hold_expires_at.replace(tzinfo=None) if appt.hold_expires_at else None
            if hold_exp and hold_exp < now:
                appt.status = AppointmentStatus.CANCELLED
                await appt.save()
                continue
        b_start = appt.slot_start.replace(tzinfo=None) if appt.slot_start else None
        b_end = appt.slot_end.replace(tzinfo=None) if appt.slot_end else None
        if b_start and b_end:
            busy_ranges.append((b_start, b_end))

    slots: list[DoctorSlot] = []
    curr = start_dt

    while curr + timedelta(minutes=slot_duration) <= end_dt:
        nxt = curr + timedelta(minutes=slot_duration)
        is_available = not any(b_start < nxt and b_end > curr for b_start, b_end in busy_ranges)
        slots.append(
            DoctorSlot(
                slot_start=curr,
                slot_end=nxt,
                available=is_available,
                status="available" if is_available else "booked",
            )
        )
        curr = nxt

    return slots


async def create_appointment_hold(patient_id: str, payload: BookAppointmentRequest) -> BookAppointmentResponse:
    doctor = await User.get(PydanticObjectId(payload.doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    slot_duration = getattr(doctor, "slot_duration_minutes", 30)
    req_start = payload.slot_start.replace(tzinfo=None) if payload.slot_start.tzinfo else payload.slot_start
    slot_end = req_start + timedelta(minutes=slot_duration)

    conflicting = await Appointment.find_one(
        Appointment.doctor_id == doctor.id,
        In("status", [AppointmentStatus.HELD, AppointmentStatus.BOOKED]),
        Appointment.slot_start < slot_end,
        Appointment.slot_end > req_start,
    )
    if conflicting is not None:
        if conflicting.status == AppointmentStatus.HELD and conflicting.hold_expires_at:
            hold_exp = conflicting.hold_expires_at.replace(tzinfo=None) if conflicting.hold_expires_at else None
            if hold_exp and hold_exp < datetime.now().replace(tzinfo=None):
                conflicting.status = AppointmentStatus.CANCELLED
                await conflicting.save()
            else:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slot is currently held or booked")
        else:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slot is currently held or booked")

    hold_expires = datetime.now() + timedelta(minutes=10)
    appointment = Appointment(
        patient_id=PydanticObjectId(patient_id),
        doctor_id=doctor.id,
        slot_start=req_start,
        slot_end=slot_end,
        status=AppointmentStatus.HELD,
        hold_expires_at=hold_expires,
    )
    await appointment.insert()

    return BookAppointmentResponse(
        appointment_id=str(appointment.id),
        status=appointment.status,
        hold_expires_at=appointment.hold_expires_at,
    )


async def confirm_appointment_hold(patient_id: str, appointment_id: str) -> PatientAppointmentResponse:
    appointment = await Appointment.get(PydanticObjectId(appointment_id))
    if appointment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if str(appointment.patient_id) != patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Appointment does not belong to this patient")

    if appointment.status == AppointmentStatus.HELD:
        if appointment.hold_expires_at and appointment.hold_expires_at < datetime.now():
            appointment.status = AppointmentStatus.CANCELLED
            await appointment.save()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Appointment hold expired")

    appointment.status = AppointmentStatus.BOOKED
    appointment.hold_expires_at = None
    await appointment.save()

    doctor = await User.get(appointment.doctor_id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    await dispatch_appointment_notification(
        str(appointment.id),
        NotificationType.BOOKING_CONFIRMATION,
        subject="Appointment confirmed",
        body=(
            f"Hello,\n\nYour appointment with Dr. {doctor.name} is confirmed for "
            f"{appointment.slot_start.isoformat()} to {appointment.slot_end.isoformat()}.\n"
            "Please arrive 10 minutes early and complete the symptom form before your visit."
        ),
    )

    return PatientAppointmentResponse(
        appointment_id=str(appointment.id),
        doctor_id=str(doctor.id),
        doctor_name=doctor.name,
        slot_start=appointment.slot_start,
        slot_end=appointment.slot_end,
        status=appointment.status,
    )


async def cancel_patient_appointment(patient_id: str, appointment_id: str) -> dict[str, str]:
    appointment = await Appointment.get(PydanticObjectId(appointment_id))
    if appointment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if str(appointment.patient_id) != patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Appointment does not belong to this patient")

    appointment.status = AppointmentStatus.CANCELLED
    await appointment.save()

    return {"message": "Appointment cancelled successfully", "appointmentId": appointment_id}


async def submit_symptom_form(patient_id: str, appointment_id: str, payload: SymptomSubmission) -> SymptomSummaryResponse:
    appointment = await Appointment.get(PydanticObjectId(appointment_id))
    if appointment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if str(appointment.patient_id) != patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Appointment does not belong to this patient")

    summary = build_pre_visit_summary(payload.symptoms_text)
    form = await SymptomForm.find_one(SymptomForm.appointment_id == appointment.id)
    if form is None:
        form = SymptomForm(appointment_id=appointment.id, symptoms_text=payload.symptoms_text)
    else:
        form.symptoms_text = payload.symptoms_text
    form.ai_pre_visit_summary = summary
    await form.save()

    return SymptomSummaryResponse(
        appointment_id=str(appointment.id),
        urgency=summary["urgency"],
        chief_complaint=summary["chief_complaint"],
        follow_up_questions=summary["follow_up_questions"],
        recommended_specialisation=summary.get("recommended_specialisation", "General Medicine"),
    )


async def list_patient_appointments(patient_id: str) -> list[PatientAppointmentResponse]:
    appointments = await Appointment.find(Appointment.patient_id == PydanticObjectId(patient_id)).to_list()
    doctors = await User.find(User.role == UserRole.DOCTOR).to_list()
    doctor_map = {str(doctor.id): doctor for doctor in doctors}

    responses: list[PatientAppointmentResponse] = []
    for appointment in appointments:
        doctor = doctor_map.get(str(appointment.doctor_id))
        if doctor is None:
            continue
        responses.append(
            PatientAppointmentResponse(
                appointment_id=str(appointment.id),
                doctor_id=str(doctor.id),
                doctor_name=doctor.name,
                slot_start=appointment.slot_start,
                slot_end=appointment.slot_end,
                status=appointment.status,
            )
        )
    return sorted(responses, key=lambda item: item.slot_start)


async def create_booking_session(patient_id: str, symptoms_text: str) -> BookingSessionResponse:
    ai_res = build_pre_visit_summary(symptoms_text)
    session = BookingSession(
        patient_id=PydanticObjectId(patient_id),
        symptoms_text=symptoms_text,
        ai_summary=ai_res,
        recommended_specialisation=ai_res.get("recommended_specialisation", "General Medicine"),
    )
    await session.insert()
    return BookingSessionResponse(
        session_id=str(session.id),
        symptoms_text=session.symptoms_text,
        ai_summary=session.ai_summary,
        recommended_specialisation=session.recommended_specialisation,
        doctor_id=str(session.doctor_id) if session.doctor_id else None,
        appointment_id=str(session.appointment_id) if session.appointment_id else None,
    )


async def get_booking_session(patient_id: str, session_id: str) -> BookingSessionResponse:
    session = await BookingSession.get(PydanticObjectId(session_id))
    if session is None or str(session.patient_id) != patient_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking session not found")
    return BookingSessionResponse(
        session_id=str(session.id),
        symptoms_text=session.symptoms_text,
        ai_summary=session.ai_summary,
        recommended_specialisation=session.recommended_specialisation,
        doctor_id=str(session.doctor_id) if session.doctor_id else None,
        appointment_id=str(session.appointment_id) if session.appointment_id else None,
    )


async def update_booking_session(
    patient_id: str, session_id: str, payload: UpdateBookingSessionRequest
) -> BookingSessionResponse:
    session = await BookingSession.get(PydanticObjectId(session_id))
    if session is None or str(session.patient_id) != patient_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking session not found")

    if payload.recommended_specialisation is not None:
        session.recommended_specialisation = payload.recommended_specialisation
    if payload.doctor_id is not None:
        session.doctor_id = PydanticObjectId(payload.doctor_id)

    await session.save()
    return BookingSessionResponse(
        session_id=str(session.id),
        symptoms_text=session.symptoms_text,
        ai_summary=session.ai_summary,
        recommended_specialisation=session.recommended_specialisation,
        doctor_id=str(session.doctor_id) if session.doctor_id else None,
        appointment_id=str(session.appointment_id) if session.appointment_id else None,
    )


async def session_hold_appointment(
    patient_id: str, session_id: str, payload: BookAppointmentRequest
) -> BookAppointmentResponse:
    session = await BookingSession.get(PydanticObjectId(session_id))
    if session is None or str(session.patient_id) != patient_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking session not found")

    hold_resp = await create_appointment_hold(patient_id, payload)
    session.doctor_id = PydanticObjectId(payload.doctor_id)
    session.appointment_id = PydanticObjectId(hold_resp.appointment_id)
    await session.save()

    return hold_resp


async def session_confirm_appointment(patient_id: str, session_id: str) -> PatientAppointmentResponse:
    session = await BookingSession.get(PydanticObjectId(session_id))
    if session is None or str(session.patient_id) != patient_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking session not found")
    if not session.appointment_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No appointment selected for this session")

    result = await confirm_appointment_hold(patient_id, str(session.appointment_id))

    existing_form = await SymptomForm.find_one(SymptomForm.appointment_id == session.appointment_id)
    if existing_form is None:
        form = SymptomForm(
            appointment_id=session.appointment_id,
            symptoms_text=session.symptoms_text,
            ai_pre_visit_summary=session.ai_summary,
        )
        await form.insert()
    else:
        existing_form.symptoms_text = session.symptoms_text
        existing_form.ai_pre_visit_summary = session.ai_summary
        await existing_form.save()

    return result
