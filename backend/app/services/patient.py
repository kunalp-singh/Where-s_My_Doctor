from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from beanie import PydanticObjectId
from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from ..models.appointment import Appointment
from ..models.booking_session import BookingSession
from ..models.clinical import SymptomForm
from ..models.embedded import LeaveDay
from ..models.enums import AppointmentStatus, NotificationType, UserRole
from ..models.user import DoctorProfile, User
from ..schemas.patient import (
    BookAppointmentRequest,
    BookAppointmentResponse,
    BookingSessionResponse,
    CreateBookingSessionRequest,
    DoctorSearchResult,
    DoctorSlot,
    PatientAppointmentResponse,
    SymptomSubmission,
    SymptomSummaryResponse,
    UpdateBookingSessionRequest,
)
from .ai import build_pre_visit_summary
from .notifications import dispatch_appointment_notification


async def search_doctors(query: str | None = None) -> list[DoctorSearchResult]:
    users = await User.find(User.role == UserRole.DOCTOR).to_list()
    doctors: list[DoctorSearchResult] = []
    for user in users:
        profile = await DoctorProfile.find_one(DoctorProfile.user_id == user.id)
        if profile is None:
            continue
        if query is not None and query.strip():
            needle = query.lower()
            if needle not in user.name.lower() and needle not in profile.specialisation.lower():
                continue
        doctors.append(
            DoctorSearchResult(
                id=str(user.id),
                name=user.name,
                email=str(user.email),
                specialisation=profile.specialisation,
                working_hours=[{"dayOfWeek": hour.day_of_week, "startTime": hour.start_time.isoformat(), "endTime": hour.end_time.isoformat()} for hour in profile.working_hours],
                slot_duration_minutes=profile.slot_duration_minutes,
            )
        )
    return doctors


async def get_doctor_slots(doctor_id: str, target_date: date | None = None) -> list[DoctorSlot]:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    profile = await DoctorProfile.find_one(DoctorProfile.user_id == doctor.id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    leave_dates = {leave.day for leave in profile.leave_days}
    slots: list[DoctorSlot] = []
    now_naive = datetime.now()
    today = now_naive.date()

    if target_date is not None:
        dates_to_check = [target_date]
    else:
        dates_to_check = [today + timedelta(days=i) for i in range(14)]

    for day in dates_to_check:
        if day in leave_dates:
            continue
        for day_slot in profile.working_hours:
            if day_slot.day_of_week != day.weekday():
                continue
            start_dt = datetime.combine(day, day_slot.start_time)
            end_dt = datetime.combine(day, day_slot.end_time)
            current = start_dt
            while current + timedelta(minutes=profile.slot_duration_minutes) <= end_dt:
                slot_end = current + timedelta(minutes=profile.slot_duration_minutes)
                if day > today or current >= now_naive - timedelta(minutes=profile.slot_duration_minutes):
                    booked = await Appointment.find_one(
                        Appointment.doctor_id == doctor.id,
                        Appointment.slot_start == current,
                        Appointment.status != AppointmentStatus.CANCELLED,
                    )
                    if booked is None:
                        slots.append(DoctorSlot(slot_start=current, slot_end=slot_end, available=True, status="available"))
                current = slot_end

    return slots


async def create_appointment_hold(patient_id: str, payload: BookAppointmentRequest) -> BookAppointmentResponse:
    doctor = await User.get(PydanticObjectId(payload.doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    profile = await DoctorProfile.find_one(DoctorProfile.user_id == doctor.id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    requested_slot = payload.slot_start
    existing = await Appointment.find_one(
        Appointment.doctor_id == doctor.id,
        Appointment.slot_start == requested_slot,
        Appointment.status != AppointmentStatus.CANCELLED,
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Selected slot is not available")

    appointment = Appointment(
        patient_id=PydanticObjectId(patient_id),
        doctor_id=doctor.id,
        slot_start=requested_slot,
        slot_end=requested_slot + timedelta(minutes=profile.slot_duration_minutes),
        status=AppointmentStatus.HELD,
        hold_expires_at=datetime.now(UTC) + timedelta(minutes=15),
    )
    try:
        await appointment.insert()
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Selected slot was just taken") from exc

    return BookAppointmentResponse(appointment_id=str(appointment.id), status=appointment.status, hold_expires_at=appointment.hold_expires_at)


async def confirm_appointment_hold(patient_id: str, appointment_id: str) -> PatientAppointmentResponse:
    appointment = await Appointment.get(PydanticObjectId(appointment_id))
    if appointment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if str(appointment.patient_id) != patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Appointment does not belong to this patient")
    if appointment.status != AppointmentStatus.HELD:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Appointment is not on hold")
    if appointment.hold_expires_at is not None:
        expires_at = appointment.hold_expires_at.replace(tzinfo=UTC) if appointment.hold_expires_at.tzinfo is None else appointment.hold_expires_at
        if expires_at <= datetime.now(UTC):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Appointment hold has expired")

    appointment.status = AppointmentStatus.BOOKED
    await appointment.save()

    doctor = await User.get(appointment.doctor_id)
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
