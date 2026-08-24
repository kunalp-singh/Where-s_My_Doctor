from __future__ import annotations

import logging
from beanie import PydanticObjectId
from beanie.operators import In
from fastapi import HTTPException, status

from ..models.appointment import Appointment
from ..models.clinical import SymptomForm, VisitNotes
from ..models.embedded import LeaveDay, PostVisitSummary, PrescriptionItem, WorkingHour
from ..models.enums import AppointmentStatus, UserRole
from ..models.user import DoctorProfile, User
from ..schemas.doctor import (
    DoctorAppointmentItem,
    DoctorNotesResponse,
    DoctorScheduleResponse,
    DoctorScheduleUpdate,
    DoctorVisitSummary,
)

logger = logging.getLogger(__name__)


async def get_doctor_schedule(doctor_id: str) -> DoctorScheduleResponse:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    profile = await DoctorProfile.find_one(DoctorProfile.user_id == doctor.id)

    hours = [
        WorkingHour(day_of_week=w.day_of_week, start_time=w.start_time, end_time=w.end_time)
        for w in (profile.working_hours if profile else []) or []
    ]
    leaves = [LeaveDay(day=l.day) for l in (profile.leave_days if profile else []) or []]

    return DoctorScheduleResponse(
        doctor_id=str(doctor.id),
        specialisation=(profile.specialisation if profile else None) or "General Medicine",
        working_hours=hours,
        slot_duration_minutes=(profile.slot_duration_minutes if profile else None) or 30,
        leave_days=leaves,
    )


async def update_doctor_schedule(doctor_id: str, payload: DoctorScheduleUpdate) -> DoctorScheduleResponse:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    profile = await DoctorProfile.find_one(DoctorProfile.user_id == doctor.id)
    is_new = profile is None
    if is_new:
        profile = DoctorProfile(
            user_id=doctor.id,
            specialisation="General Medicine",
            slot_duration_minutes=30,
        )

    if payload.working_hours is not None:
        profile.working_hours = payload.working_hours
    if payload.slot_duration_minutes is not None:
        profile.slot_duration_minutes = payload.slot_duration_minutes

    if is_new:
        await profile.insert()
    else:
        await profile.save()
    return await get_doctor_schedule(doctor_id)



async def list_doctor_appointments(doctor_id: str) -> list[DoctorAppointmentItem]:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    appointments = await Appointment.find(Appointment.doctor_id == doctor.id).to_list()
    patient_ids = list({appt.patient_id for appt in appointments if appt.patient_id})
    patients = await User.find(In("_id", patient_ids)).to_list() if patient_ids else []
    patient_map = {str(p.id): p for p in patients}

    results: list[DoctorAppointmentItem] = []
    for appt in appointments:
        patient = patient_map.get(str(appt.patient_id))
        form = await SymptomForm.find_one(SymptomForm.appointment_id == appt.id)

        urgency = None
        chief = None
        if form and form.ai_pre_visit_summary:
            summary = form.ai_pre_visit_summary
            if isinstance(summary, dict):
                urgency = summary.get("urgency")
                chief = summary.get("chief_complaint") or summary.get("chiefComplaint")
            else:
                urgency = getattr(summary, "urgency", None)
                chief = getattr(summary, "chief_complaint", None) or getattr(summary, "chiefComplaint", None)

        results.append(
            DoctorAppointmentItem(
                appointment_id=str(appt.id),
                patient_id=str(appt.patient_id),
                patient_name=patient.name if patient else "Unknown Patient",
                slot_start=appt.slot_start,
                slot_end=appt.slot_end,
                status=appt.status,
                urgency=urgency,
                chief_complaint=chief,
            )
        )
    return sorted(results, key=lambda item: item.slot_start, reverse=True)


async def submit_visit_notes(
    doctor_id: str, appointment_id: str, payload: DoctorVisitSummary
) -> DoctorNotesResponse:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    appointment = await Appointment.get(PydanticObjectId(appointment_id))
    if appointment is None or appointment.doctor_id != doctor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor appointment not found")

    prescriptions: list[PrescriptionItem] = []
    for p in payload.prescriptions:
        if isinstance(p, PrescriptionItem):
            prescriptions.append(p)
        elif isinstance(p, dict):
            prescriptions.append(
                PrescriptionItem(
                    medication_name=p.get("medicationName") or p.get("medication_name", ""),
                    dosage=p.get("dosage", ""),
                    frequency=p.get("frequency", ""),
                    duration_days=p.get("durationDays") or p.get("duration_days") or 7,
                    instructions=p.get("instructions"),
                )
            )

    # Invoke Gemini AI for patient-friendly post-visit summary (sync function)
    from .ai import build_post_visit_summary
    from .notifications import dispatch_appointment_notification
    from ..models.enums import NotificationType

    ai_dict = await build_post_visit_summary(payload.diagnosis, payload.notes, prescriptions)
    summary = PostVisitSummary(
        summary=ai_dict["summary"],
        follow_up_steps=ai_dict["follow_up_steps"],
        red_flags=ai_dict["red_flags"],
    )

    existing = await VisitNotes.find_one(VisitNotes.appointment_id == appointment.id)
    if existing is None:
        existing = VisitNotes(
            appointment_id=appointment.id,
            diagnosis=payload.diagnosis,
            doctor_notes=payload.notes,
            prescription=prescriptions,
            ai_post_visit_summary=summary,
        )
        await existing.insert()
    else:
        existing.diagnosis = payload.diagnosis
        existing.doctor_notes = payload.notes
        existing.prescription = prescriptions
        existing.ai_post_visit_summary = summary
        await existing.save()

    appointment.status = AppointmentStatus.COMPLETED
    await appointment.save()

    # Dispatch email notification to patient alerting that Post-Visit Care Summary is ready
    try:
        await dispatch_appointment_notification(
            str(appointment.id),
            NotificationType.REMINDER,
            subject="Your CareConnect Post-Visit Summary & Prescription Details",
            body=(
                f"Hello,\n\nYour consultation with Dr. {doctor.name} is complete.\n\n"
                f"Summary: {summary.summary}\n\n"
                "Log into your CareConnect Patient Portal to view your complete medical record and medication checklist."
            ),
        )
    except Exception as n_err:
        logger.warning("Failed to dispatch post-visit notification email: %s", n_err)

    return await get_visit_detail(doctor_id, appointment_id)


async def get_visit_detail(doctor_id: str, appointment_id: str) -> DoctorNotesResponse:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    appointment = await Appointment.get(PydanticObjectId(appointment_id))
    if appointment is None or appointment.doctor_id != doctor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor appointment not found")

    patient = await User.get(appointment.patient_id)
    form = await SymptomForm.find_one(SymptomForm.appointment_id == appointment.id)
    notes = await VisitNotes.find_one(VisitNotes.appointment_id == appointment.id)

    ai_summary = None
    symptoms_text = None
    if form:
        symptoms_text = form.symptoms_text
        if isinstance(form.ai_pre_visit_summary, dict):
            src = form.ai_pre_visit_summary
        elif form.ai_pre_visit_summary:
            src = {
                "urgency": getattr(form.ai_pre_visit_summary, "urgency", "low"),
                "chief_complaint": getattr(form.ai_pre_visit_summary, "chief_complaint", ""),
                "follow_up_questions": getattr(form.ai_pre_visit_summary, "follow_up_questions", []),
                "recommended_specialisation": getattr(form.ai_pre_visit_summary, "recommended_specialisation", "General Medicine"),
            }
        else:
            src = None

        if src is not None:
            cc = src.get("chiefComplaint") or src.get("chief_complaint") or ""
            fq = src.get("followUpQuestions") or src.get("follow_up_questions") or []
            rs = src.get("recommendedSpecialisation") or src.get("recommended_specialisation") or "General Medicine"
            ai_summary = {
                "urgency": src.get("urgency", "low"),
                "chief_complaint": cc,
                "chiefComplaint": cc,
                "follow_up_questions": fq,
                "followUpQuestions": fq,
                "recommended_specialisation": rs,
                "recommendedSpecialisation": rs,
            }

    return DoctorNotesResponse(
        appointment_id=str(appointment.id),
        patient_name=patient.name if patient else "Unknown Patient",
        status=appointment.status,
        symptoms_text=symptoms_text,
        ai_pre_visit_summary=ai_summary,
        diagnosis=notes.diagnosis if notes else None,
        doctor_notes=notes.doctor_notes if notes else "",
        prescriptions=notes.prescription if notes else [],
        ai_post_visit_summary=notes.ai_post_visit_summary if notes else None,
    )

