from __future__ import annotations

from datetime import UTC, datetime

from beanie import PydanticObjectId
from fastapi import HTTPException, status

from ..models.appointment import Appointment
from ..models.clinical import SymptomForm, VisitNotes
from ..models.embedded import PostVisitSummary, PrescriptionItem
from ..models.enums import AppointmentStatus, UserRole
from ..models.user import DoctorProfile, User
from ..schemas.doctor import (
    DoctorAppointmentItem,
    DoctorNotesResponse,
    DoctorScheduleResponse,
    DoctorScheduleUpdate,
    DoctorVisitSummary,
)


async def list_doctor_appointments(doctor_id: str) -> list[DoctorAppointmentItem]:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    appointments = await Appointment.find(Appointment.doctor_id == doctor.id).to_list()
    items: list[DoctorAppointmentItem] = []
    for appointment in appointments:
        patient = await User.get(appointment.patient_id)
        symptom_form = await SymptomForm.find_one(SymptomForm.appointment_id == appointment.id)
        summary = symptom_form.ai_pre_visit_summary if symptom_form is not None else None

        urgency_val = None
        complaint_val = None

        if summary is not None:
            if isinstance(summary, dict):
                urgency_val = summary.get("urgency")
                complaint_val = summary.get("chief_complaint") or summary.get("chiefComplaint")
            else:
                urgency_val = getattr(summary, "urgency", None)
                complaint_val = getattr(summary, "chief_complaint", None) or getattr(summary, "chiefComplaint", None)

        items.append(
            DoctorAppointmentItem(
                appointment_id=str(appointment.id),
                patient_id=str(appointment.patient_id),
                patient_name=patient.name if patient is not None else "Unknown patient",
                slot_start=appointment.slot_start,
                slot_end=appointment.slot_end,
                status=appointment.status.value,
                urgency=urgency_val,
                chief_complaint=complaint_val,
            )
        )
    return sorted(items, key=lambda item: item.slot_start)


async def get_visit_detail(doctor_id: str, appointment_id: str) -> DoctorNotesResponse:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    appointment = await Appointment.get(PydanticObjectId(appointment_id))
    if appointment is None or appointment.doctor_id != doctor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor appointment not found")

    patient = await User.get(appointment.patient_id)
    symptom_form = await SymptomForm.find_one(SymptomForm.appointment_id == appointment.id)
    summary = symptom_form.ai_pre_visit_summary if symptom_form is not None else None

    complaint_val = None
    if summary is not None:
        if isinstance(summary, dict):
            complaint_val = summary.get("chief_complaint") or summary.get("chiefComplaint")
        else:
            complaint_val = getattr(summary, "chief_complaint", None) or getattr(summary, "chiefComplaint", None)

    existing = await VisitNotes.find_one(VisitNotes.appointment_id == appointment.id)
    if existing is None:
        return DoctorNotesResponse(
            appointment_id=str(appointment.id),
            patient_name=patient.name if patient is not None else "Patient",
            chief_complaint=complaint_val or (symptom_form.symptoms_text if symptom_form else "Routine Consultation"),
            diagnosis="",
            notes="",
            prescriptions=[],
        )

    return DoctorNotesResponse(
        appointment_id=str(appointment.id),
        patient_name=patient.name if patient is not None else "Patient",
        chief_complaint=complaint_val or (symptom_form.symptoms_text if symptom_form else "Routine Consultation"),
        diagnosis=getattr(existing, "diagnosis", "") or "",
        notes=getattr(existing, "notes", "") or getattr(existing, "doctor_notes", "") or "",
        prescriptions=[
            {
                "medicationName": p.medication_name if hasattr(p, "medication_name") else getattr(p, "medicationName", ""),
                "dosage": p.dosage,
                "frequency": p.frequency,
            }
            for p in getattr(existing, "prescription", [])
        ],
    )


async def submit_visit_notes(doctor_id: str, appointment_id: str, payload: DoctorVisitSummary) -> DoctorNotesResponse:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    appointment = await Appointment.get(PydanticObjectId(appointment_id))
    if appointment is None or appointment.doctor_id != doctor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor appointment not found")

    patient = await User.get(appointment.patient_id)
    summary = PostVisitSummary(
        summary=f"Visit completed for {appointment.slot_start.date()}.",
        follow_up_steps=["Continue medication as directed", "Schedule a follow-up if symptoms persist"],
        red_flags=["Shortness of breath", "Chest pain", "Sudden confusion"],
    )

    prescriptions = [
        PrescriptionItem(
            medication_name=p.get("medicationName") or p.get("medication_name", ""),
            dosage=p.get("dosage", ""),
            frequency=p.get("frequency", ""),
            duration_days=7,
        )
        for p in payload.prescriptions
    ]

    existing = await VisitNotes.find_one(VisitNotes.appointment_id == appointment.id)
    if existing is None:
        existing = VisitNotes(
            appointment_id=appointment.id,
            doctor_notes=payload.notes or payload.chief_complaint,
            prescription=prescriptions,
            ai_post_visit_summary=summary,
        )
        await existing.insert()
    else:
        existing.doctor_notes = payload.notes or payload.chief_complaint
        existing.prescription = prescriptions
        existing.ai_post_visit_summary = summary
        await existing.save()

    appointment.status = AppointmentStatus.COMPLETED
    await appointment.save()

    return DoctorNotesResponse(
        appointment_id=str(appointment.id),
        patient_name=patient.name if patient is not None else "Patient",
        chief_complaint=payload.chief_complaint,
        diagnosis=payload.diagnosis,
        notes=payload.notes,
        prescriptions=payload.prescriptions,
    )


async def get_doctor_schedule(doctor_id: str) -> DoctorScheduleResponse:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    profile = await DoctorProfile.find_one(DoctorProfile.user_id == doctor.id)
    if profile is None:
        profile = DoctorProfile(
            user_id=doctor.id,
            specialisation="General Medicine",
            working_hours=[],
            slot_duration_minutes=30,
            leave_days=[],
        )
        await profile.insert()

    return DoctorScheduleResponse(
        doctor_id=str(doctor.id),
        specialisation=profile.specialisation,
        working_hours=[
            {
                "dayOfWeek": hour.day_of_week,
                "startTime": hour.start_time.isoformat(),
                "endTime": hour.end_time.isoformat(),
            }
            for hour in profile.working_hours
        ],
        slot_duration_minutes=profile.slot_duration_minutes,
        leave_days=[{"day": leave.day.isoformat()} for leave in profile.leave_days],
    )


async def update_doctor_schedule(doctor_id: str, payload: DoctorScheduleUpdate) -> DoctorScheduleResponse:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    profile = await DoctorProfile.find_one(DoctorProfile.user_id == doctor.id)
    if profile is None:
        profile = DoctorProfile(
            user_id=doctor.id,
            specialisation="General Medicine",
            working_hours=[],
            slot_duration_minutes=30,
            leave_days=[],
        )
        await profile.insert()

    if payload.slot_duration_minutes is not None:
        profile.slot_duration_minutes = payload.slot_duration_minutes

    if payload.working_hours is not None:
        from datetime import time
        hours = []
        for h in payload.working_hours:
            s_parts = h.start_time.split(":")
            e_parts = h.end_time.split(":")
            hours.append(
                WorkingHour(
                    day_of_week=h.day_of_week,
                    start_time=time(int(s_parts[0]), int(s_parts[1])),
                    end_time=time(int(e_parts[0]), int(e_parts[1])),
                )
            )
        profile.working_hours = hours

    await profile.save()
    return await get_doctor_schedule(doctor_id)
