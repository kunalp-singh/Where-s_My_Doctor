from __future__ import annotations

import logging
from beanie import PydanticObjectId
from beanie.operators import In
from fastapi import HTTPException, status

from ..models.appointment import Appointment
from ..models.clinical import SymptomForm, VisitNotes
from ..models.embedded import LeaveDay, PostVisitSummary, PrescriptionItem, WorkingHour
from ..models.enums import AppointmentStatus, UserRole
from ..models.user import User
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

    hours = [
        WorkingHour(day_of_week=w.day_of_week, start_time=w.start_time, end_time=w.end_time)
        for w in getattr(doctor, "working_hours", [])
    ]
    leaves = [LeaveDay(day=l.day) for l in getattr(doctor, "leave_days", [])]

    return DoctorScheduleResponse(
        doctor_id=str(doctor.id),
        specialisation=getattr(doctor, "specialisation", None) or "General Medicine",
        working_hours=hours,
        slot_duration_minutes=getattr(doctor, "slot_duration_minutes", 30),
        leave_days=leaves,
    )


async def update_doctor_schedule(doctor_id: str, payload: DoctorScheduleUpdate) -> DoctorScheduleResponse:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    if payload.working_hours is not None:
        doctor.working_hours = payload.working_hours
    if payload.slot_duration_minutes is not None:
        doctor.slot_duration_minutes = payload.slot_duration_minutes

    await doctor.save()
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
    return sorted(results, key=lambda item: item.slot_start)


async def submit_visit_notes(
    doctor_id: str, appointment_id: str, payload: DoctorVisitSummary
) -> DoctorNotesResponse:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    appointment = await Appointment.get(PydanticObjectId(appointment_id))
    if appointment is None or appointment.doctor_id != doctor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor appointment not found")

    summary = PostVisitSummary(
        summary=f"Visit completed for {appointment.slot_start.date()}.",
        follow_up_steps=["Continue medication as directed", "Schedule a follow-up if symptoms persist"],
        red_flags=["Shortness of breath", "Chest pain", "Sudden confusion"],
    )

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

    existing = await VisitNotes.find_one(VisitNotes.appointment_id == appointment.id)
    if existing is None:
        existing = VisitNotes(
            appointment_id=appointment.id,
            doctor_notes=payload.notes,
            prescription=prescriptions,
            ai_post_visit_summary=summary,
        )
        await existing.insert()
    else:
        existing.doctor_notes = payload.notes
        existing.prescription = prescriptions
        existing.ai_post_visit_summary = summary
        await existing.save()

    appointment.status = AppointmentStatus.COMPLETED
    await appointment.save()

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
            ai_summary = form.ai_pre_visit_summary
        elif form.ai_pre_visit_summary:
            ai_summary = {
                "urgency": getattr(form.ai_pre_visit_summary, "urgency", "low"),
                "chief_complaint": getattr(form.ai_pre_visit_summary, "chief_complaint", ""),
                "follow_up_questions": getattr(form.ai_pre_visit_summary, "follow_up_questions", []),
                "recommended_specialisation": getattr(form.ai_pre_visit_summary, "recommended_specialisation", "General Medicine"),
            }

    return DoctorNotesResponse(
        appointment_id=str(appointment.id),
        patient_name=patient.name if patient else "Unknown Patient",
        symptoms_text=symptoms_text,
        ai_pre_visit_summary=ai_summary,
        doctor_notes=notes.doctor_notes if notes else "",
        prescription=notes.prescription if notes else [],
        ai_post_visit_summary=notes.ai_post_visit_summary if notes else None,
    )
