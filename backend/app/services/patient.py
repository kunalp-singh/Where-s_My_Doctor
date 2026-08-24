from __future__ import annotations

from datetime import date, datetime, timedelta
import logging
from typing import Any

from beanie import PydanticObjectId
from beanie.operators import In
from fastapi import HTTPException, status

from ..config import get_settings
from ..models.appointment import Appointment
from ..models.booking_session import BookingSession
from ..models.clinical import SymptomForm, VisitNotes
from ..models.enums import AppointmentStatus, NotificationType, UserRole, UserStatus
from ..models.user import DoctorProfile, User
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


def _build_prescription_list(prescription_items: list[Any]) -> list[dict[str, Any]]:
    """Normalize a list of PrescriptionItem models or dicts into a consistent camelCase list."""
    result = []
    for p in prescription_items or []:
        if isinstance(p, dict):
            m_name = p.get("medicationName") or p.get("medication_name") or ""
            dos = p.get("dosage") or ""
            freq = p.get("frequency") or ""
            dur = p.get("durationDays") or p.get("duration_days") or 7
            instr = p.get("instructions") or ""
        else:
            m_name = getattr(p, "medication_name", None) or getattr(p, "medicationName", "") or ""
            dos = getattr(p, "dosage", "") or ""
            freq = getattr(p, "frequency", "") or ""
            dur = getattr(p, "duration_days", None) or getattr(p, "durationDays", 7) or 7
            instr = getattr(p, "instructions", "") or ""
        if m_name:
            result.append({
                "medicationName": m_name,
                "dosage": dos,
                "frequency": freq,
                "durationDays": int(dur),
                "instructions": instr,
            })
    return result


def _build_appointment_summaries(
    form: SymptomForm | None,
    notes: VisitNotes | None,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None, dict[str, Any] | None]:
    """Return (symptom_summary_dict, visit_notes_dict, ai_post_visit_dict) for a patient response."""
    symptom_summary_dict: dict[str, Any] | None = None
    if form and form.ai_pre_visit_summary:
        if isinstance(form.ai_pre_visit_summary, dict):
            src = form.ai_pre_visit_summary
        else:
            src = {
                "urgency": getattr(form.ai_pre_visit_summary, "urgency", "low"),
                "chief_complaint": getattr(form.ai_pre_visit_summary, "chief_complaint", ""),
                "chiefComplaint": getattr(form.ai_pre_visit_summary, "chief_complaint", ""),
                "follow_up_questions": getattr(form.ai_pre_visit_summary, "follow_up_questions", []),
                "followUpQuestions": getattr(form.ai_pre_visit_summary, "follow_up_questions", []),
            }
        # Always expose both forms for cross-compatibility
        cc = src.get("chiefComplaint") or src.get("chief_complaint") or ""
        fq = src.get("followUpQuestions") or src.get("follow_up_questions") or []
        symptom_summary_dict = {
            "urgency": src.get("urgency", "low"),
            "chief_complaint": cc,
            "chiefComplaint": cc,
            "follow_up_questions": fq,
            "followUpQuestions": fq,
            "recommended_specialisation": src.get("recommendedSpecialisation") or src.get("recommended_specialisation") or "General Medicine",
            "recommendedSpecialisation": src.get("recommendedSpecialisation") or src.get("recommended_specialisation") or "General Medicine",
        }

    visit_notes_dict: dict[str, Any] | None = None
    ai_post_visit_dict: dict[str, Any] | None = None
    if notes:
        prescriptions_list = _build_prescription_list(notes.prescription or [])
        visit_notes_dict = {
            "diagnosis": getattr(notes, "diagnosis", "") or "",
            "notes": notes.doctor_notes or "",
            "prescriptions": prescriptions_list,
        }
        if notes.ai_post_visit_summary:
            pv = notes.ai_post_visit_summary
            if isinstance(pv, dict):
                follow_ups = pv.get("followUpSteps") or pv.get("follow_up_steps") or []
                red_flags = pv.get("redFlags") or pv.get("red_flags") or []
                ai_post_visit_dict = {
                    "summary": pv.get("summary", ""),
                    "followUpSteps": follow_ups,
                    "follow_up_steps": follow_ups,
                    "redFlags": red_flags,
                    "red_flags": red_flags,
                }
            else:
                follow_ups = getattr(pv, "follow_up_steps", [])
                red_flags = getattr(pv, "red_flags", [])
                ai_post_visit_dict = {
                    "summary": getattr(pv, "summary", ""),
                    "followUpSteps": follow_ups,
                    "follow_up_steps": follow_ups,
                    "redFlags": red_flags,
                    "red_flags": red_flags,
                }

    return symptom_summary_dict, visit_notes_dict, ai_post_visit_dict



async def search_doctors(query: str | None = None) -> list[DoctorSearchResult]:
    doctors = await User.find(User.role == UserRole.DOCTOR, User.status == UserStatus.ACTIVE).to_list()
    
    doc_profiles = await DoctorProfile.find().to_list()
    profile_map = {str(p.user_id): p for p in doc_profiles}

    if not query:
        results: list[DoctorSearchResult] = []
        for doctor in doctors:
            prof = profile_map.get(str(doctor.id))
            doc_spec = prof.specialisation if (prof and prof.specialisation) else (getattr(doctor, "specialisation", None) or "General Medicine")
            w_hours = prof.working_hours if (prof and prof.working_hours) else getattr(doctor, "working_hours", [])
            slot_dur = prof.slot_duration_minutes if (prof and prof.slot_duration_minutes) else getattr(doctor, "slot_duration_minutes", 30)

            results.append(
                DoctorSearchResult(
                    id=str(doctor.id),
                    name=doctor.name,
                    email=doctor.email,
                    specialisation=doc_spec,
                    working_hours=w_hours,
                    slot_duration_minutes=slot_dur,
                )
            )
        return results

    lowered = query.lower()
    matched_specs: set[str] = set()
    for spec, keywords in SPECIALISATION_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords) or spec.lower() in lowered:
            matched_specs.add(spec)

    results: list[DoctorSearchResult] = []
    for doctor in doctors:
        prof = profile_map.get(str(doctor.id))
        doc_spec = prof.specialisation if (prof and prof.specialisation) else (getattr(doctor, "specialisation", None) or "General Medicine")
        doc_name = doctor.name.lower()
        w_hours = prof.working_hours if (prof and prof.working_hours) else getattr(doctor, "working_hours", [])
        slot_dur = prof.slot_duration_minutes if (prof and prof.slot_duration_minutes) else getattr(doctor, "slot_duration_minutes", 30)

        if doc_spec in matched_specs or query.lower() in doc_name or query.lower() in doc_spec.lower():
            results.append(
                DoctorSearchResult(
                    id=str(doctor.id),
                    name=doctor.name,
                    email=doctor.email,
                    specialisation=doc_spec,
                    working_hours=w_hours,
                    slot_duration_minutes=slot_dur,
                )
            )
    return results


async def get_doctor_slots(doctor_id: str, target_date: date | None = None) -> list[DoctorSlot]:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    # Load DoctorProfile for accurate schedule data
    profile = await DoctorProfile.find_one(DoctorProfile.user_id == doctor.id)

    day = target_date or date.today()
    slot_duration = (profile.slot_duration_minutes if profile else None) or 30

    # Determine working start/end for this day-of-week from DoctorProfile
    dow = day.weekday()  # 0=Mon … 6=Sun
    start_dt = datetime(day.year, day.month, day.day, 9, 0, 0)
    end_dt = datetime(day.year, day.month, day.day, 18, 0, 0)
    if profile and profile.working_hours:
        for wh in profile.working_hours:
            wh_dow = getattr(wh, "day_of_week", None)
            if wh_dow == dow:
                st = getattr(wh, "start_time", None)
                et = getattr(wh, "end_time", None)
                if st:
                    start_dt = datetime(day.year, day.month, day.day, st.hour, st.minute, 0)
                if et:
                    end_dt = datetime(day.year, day.month, day.day, et.hour, et.minute, 0)
                break

    existing_appointments = await Appointment.find(
        Appointment.doctor_id == doctor.id,
        In("status", [AppointmentStatus.HELD, AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED]),
    ).to_list()

    busy_ranges: list[tuple[datetime, datetime]] = []
    now = datetime.now()

    for appt in existing_appointments:
        if appt.status == AppointmentStatus.HELD:
            h_exp = appt.hold_expires_at.replace(tzinfo=None) if appt.hold_expires_at else None
            if h_exp and h_exp < now:
                appt.status = AppointmentStatus.CANCELLED
                await appt.save()
                continue

        b_start = appt.slot_start.replace(tzinfo=None) if appt.slot_start else appt.slot_start
        b_end = appt.slot_end.replace(tzinfo=None) if appt.slot_end else appt.slot_end
        busy_ranges.append((b_start, b_end))

    slots: list[DoctorSlot] = []
    curr = start_dt

    while curr + timedelta(minutes=slot_duration) <= end_dt:
        nxt = curr + timedelta(minutes=slot_duration)
        is_past = (day == date.today() and nxt <= now)
        is_available = not is_past and not any(b_start < nxt and b_end > curr for b_start, b_end in busy_ranges)
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
    from pymongo.errors import DuplicateKeyError

    doctor = await User.get(PydanticObjectId(payload.doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    # Load slot duration from DoctorProfile, not User
    doc_profile = await DoctorProfile.find_one(DoctorProfile.user_id == doctor.id)
    slot_duration = (doc_profile.slot_duration_minutes if doc_profile else None) or 30

    req_slot_start = payload.slot_start.replace(tzinfo=None) if payload.slot_start else payload.slot_start
    slot_end = req_slot_start + timedelta(minutes=slot_duration)
    now = datetime.now()

    conflicting = await Appointment.find_one(
        Appointment.doctor_id == doctor.id,
        In("status", [AppointmentStatus.HELD, AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED]),
        Appointment.slot_start < slot_end,
        Appointment.slot_end > req_slot_start,
    )
    if conflicting is not None:
        if conflicting.status == AppointmentStatus.HELD and conflicting.hold_expires_at:
            h_exp = conflicting.hold_expires_at.replace(tzinfo=None)
            if h_exp < now:
                conflicting.status = AppointmentStatus.CANCELLED
                await conflicting.save()
            elif str(conflicting.patient_id) == patient_id:
                return BookAppointmentResponse(
                    appointment_id=str(conflicting.id),
                    status=conflicting.status,
                    hold_expires_at=conflicting.hold_expires_at,
                )
            else:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slot is currently held by another patient.")
        else:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slot is already booked or completed.")

    hold_expires = now + timedelta(minutes=10)
    time_zone = payload.time_zone or get_settings().default_time_zone
    appointment = Appointment(
        patient_id=PydanticObjectId(patient_id),
        doctor_id=doctor.id,
        slot_start=req_slot_start,
        slot_end=slot_end,
        time_zone=time_zone,
        status=AppointmentStatus.HELD,
        hold_expires_at=hold_expires,
    )

    try:
        await appointment.insert()
    except Exception as exc:
        if "duplicate key error" in str(exc).lower() or isinstance(exc, DuplicateKeyError):
            existing = await Appointment.find_one(
                Appointment.doctor_id == doctor.id,
                Appointment.slot_start == req_slot_start,
            )
            if existing:
                if str(existing.patient_id) == patient_id:
                    existing.status = AppointmentStatus.HELD
                    existing.hold_expires_at = hold_expires
                    await existing.save()
                    return BookAppointmentResponse(
                        appointment_id=str(existing.id),
                        status=existing.status,
                        hold_expires_at=existing.hold_expires_at,
                    )
                elif existing.status in [AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED]:
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This slot has already been booked by another patient.")
                elif existing.status == AppointmentStatus.HELD and existing.hold_expires_at and existing.hold_expires_at.replace(tzinfo=None) > now:
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This slot is currently held by another patient.")
                else:
                    existing.patient_id = PydanticObjectId(patient_id)
                    existing.time_zone = time_zone
                    existing.status = AppointmentStatus.HELD
                    existing.hold_expires_at = hold_expires
                    await existing.save()
                    return BookAppointmentResponse(
                        appointment_id=str(existing.id),
                        status=existing.status,
                        hold_expires_at=existing.hold_expires_at,
                    )
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slot conflict. Please select another slot.")

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
        # Use .replace(tzinfo=None) to compare tz-aware MongoDB datetime with naive datetime.now()
        expires = appointment.hold_expires_at.replace(tzinfo=None) if appointment.hold_expires_at else None
        if expires and expires < datetime.now():
            appointment.status = AppointmentStatus.CANCELLED
            await appointment.save()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Appointment hold expired")


    appointment.status = AppointmentStatus.BOOKED
    appointment.hold_expires_at = None
    await appointment.save()

    doctor = await User.get(appointment.doctor_id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
    patient = await User.get(appointment.patient_id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    # Sync only the patient's Google Calendar. Booking remains confirmed if this fails.
    try:
        from .google_calendar import sync_google_calendar_event
        from ..models.calendar import GoogleCalendarCredential

        cred_p = await GoogleCalendarCredential.find_one(GoogleCalendarCredential.user_id == patient.id)
        if cred_p:
            await sync_google_calendar_event(
                str(patient.id),
                appointment,
                owner="patient",
                title=f"Appointment with Dr. {doctor.name}",
                description=(
                    "CareConnect appointment\n\n"
                    f"Patient: {patient.name}\n"
                    f"Doctor: Dr. {doctor.name}\n"
                    f"Doctor email: {doctor.email}\n"
                    f"Time zone: {appointment.time_zone}"
                ),
                attendee_email=str(doctor.email),
                time_zone=appointment.time_zone,
            )
    except Exception as g_err:
        import logging
        logging.getLogger("appointment_care").error("Google Calendar sync failed: %s", g_err)

    start_text = appointment.slot_start.isoformat()
    end_text = appointment.slot_end.isoformat()
    text_body = (
        f"Hello {patient.name},\n\n"
        f"Your appointment with Dr. {doctor.name} is confirmed.\n\n"
        f"Date and time: {start_text} to {end_text}\n"
        f"Time zone: {appointment.time_zone}\n"
        f"Doctor email: {doctor.email}\n\n"
        "Please arrive 10 minutes early and complete any requested symptom intake before your visit."
    )
    html_body = (
        f"<p>Hello {patient.name},</p>"
        f"<p>Your appointment with <strong>Dr. {doctor.name}</strong> is confirmed.</p>"
        "<ul>"
        f"<li><strong>Date and time:</strong> {start_text} to {end_text}</li>"
        f"<li><strong>Time zone:</strong> {appointment.time_zone}</li>"
        f"<li><strong>Doctor email:</strong> {doctor.email}</li>"
        "</ul>"
        "<p>Please arrive 10 minutes early and complete any requested symptom intake before your visit.</p>"
    )
    await dispatch_appointment_notification(
        str(appointment.id),
        NotificationType.BOOKING_CONFIRMATION,
        subject="Appointment confirmed",
        body=text_body,
        html_body=html_body,
    )

    # Send confirmation email via Resend
    try:
        from .email_service import send_appointment_confirmation
        await send_appointment_confirmation(
            email=patient.email,
            subject="Your Appointment is Confirmed",
            html_body=html_body,
        )
    except Exception as email_err:
        logger.error("Resend email confirmation failed: %s", email_err)

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

    # Cancel any pending medication reminders
    from ..models.notification import MedicationReminder
    from ..models.enums import ReminderStatus
    await MedicationReminder.find(
        MedicationReminder.appointment_id == appointment.id,
        MedicationReminder.status == ReminderStatus.PENDING,
    ).update({"$set": {"status": ReminderStatus.CANCELLED}})

    # Remove Google Calendar events
    try:
        from .google_calendar import remove_google_calendar_event
        from ..models.calendar import GoogleCalendarCredential

        # For patient:
        cred_p = await GoogleCalendarCredential.find_one(GoogleCalendarCredential.user_id == appointment.patient_id)
        if cred_p:
            await remove_google_calendar_event(patient_id, appointment, owner="patient")

        # For doctor:
        cred_d = await GoogleCalendarCredential.find_one(GoogleCalendarCredential.user_id == appointment.doctor_id)
        if cred_d:
            await remove_google_calendar_event(str(appointment.doctor_id), appointment, owner="doctor")
    except Exception as g_err:
        import logging
        logging.getLogger("appointment_care").error("Google Calendar event removal failed: %s", g_err)

    return {"message": "Appointment cancelled successfully", "appointmentId": appointment_id}


async def submit_symptom_form(patient_id: str, appointment_id: str, payload: SymptomSubmission) -> SymptomSummaryResponse:
    appointment = await Appointment.get(PydanticObjectId(appointment_id))
    if appointment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if str(appointment.patient_id) != patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Appointment does not belong to this patient")

    form = await SymptomForm.find_one(SymptomForm.appointment_id == appointment.id)
    if form is None:
        form = SymptomForm(
            appointment_id=appointment.id,
            symptoms_text=payload.symptoms_text,
            status="processing_summary",
        )
    else:
        form.symptoms_text = payload.symptoms_text
        form.status = "processing_summary"
        form.ai_pre_visit_summary = None
    await form.save()

    from .jobs import trigger_pre_visit_summary
    trigger_pre_visit_summary(str(form.id), payload.symptoms_text)

    return SymptomSummaryResponse(
        appointment_id=str(appointment.id),
        status=form.status,
        urgency=None,
        chief_complaint=None,
        follow_up_questions=[],
        recommended_specialisation=None,
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

        form = await SymptomForm.find_one(SymptomForm.appointment_id == appointment.id)
        notes = await VisitNotes.find_one(VisitNotes.appointment_id == appointment.id)
        symptom_summary_dict, visit_notes_dict, ai_post_visit_dict = _build_appointment_summaries(form, notes)

        responses.append(
            PatientAppointmentResponse(
                appointment_id=str(appointment.id),
                doctor_id=str(doctor.id),
                doctor_name=doctor.name,
                slot_start=appointment.slot_start,
                slot_end=appointment.slot_end,
                status=appointment.status,
                symptom_summary=symptom_summary_dict,
                visit_notes=visit_notes_dict,
                ai_post_visit_summary=ai_post_visit_dict,
                symptom_summary_status=form.status if form else None,
                ai_post_visit_summary_status=notes.status if notes else None,
            )
        )
    return sorted(responses, key=lambda item: item.slot_start, reverse=True)


async def create_booking_session(patient_id: str, symptoms_text: str) -> BookingSessionResponse:
    session = BookingSession(
        patient_id=PydanticObjectId(patient_id),
        symptoms_text=symptoms_text,
        ai_summary={},
        recommended_specialisation="General Medicine",
        status="processing_summary",
    )
    await session.insert()

    from .jobs import trigger_booking_session_summary
    trigger_booking_session_summary(str(session.id), symptoms_text)

    return BookingSessionResponse(
        session_id=str(session.id),
        status=session.status,
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
            status=getattr(session, "status", "summary_ready"),
        )
        await form.insert()
    else:
        existing_form.symptoms_text = session.symptoms_text
        existing_form.ai_pre_visit_summary = session.ai_summary
        existing_form.status = getattr(session, "status", "summary_ready")
        await existing_form.save()

    return result


async def get_patient_appointment_detail(patient_id: str, appointment_id: str) -> PatientAppointmentResponse:
    appointment = await Appointment.get(PydanticObjectId(appointment_id))
    if appointment is None or str(appointment.patient_id) != patient_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    doctor = await User.get(appointment.doctor_id)
    form = await SymptomForm.find_one(SymptomForm.appointment_id == appointment.id)
    notes = await VisitNotes.find_one(VisitNotes.appointment_id == appointment.id)
    symptom_summary_dict, visit_notes_dict, ai_post_visit_dict = _build_appointment_summaries(form, notes)

    return PatientAppointmentResponse(
        appointment_id=str(appointment.id),
        doctor_id=str(doctor.id) if doctor else "",
        doctor_name=doctor.name if doctor else "Specialist",
        slot_start=appointment.slot_start,
        slot_end=appointment.slot_end,
        status=appointment.status,
        symptom_summary=symptom_summary_dict,
        visit_notes=visit_notes_dict,
        ai_post_visit_summary=ai_post_visit_dict,
        symptom_summary_status=form.status if form else None,
        ai_post_visit_summary_status=notes.status if notes else None,
    )
