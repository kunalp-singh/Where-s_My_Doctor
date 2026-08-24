from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from ..models.embedded import LeaveDay, PostVisitSummary, PrescriptionItem, WorkingHour


class DoctorAppointmentItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    appointment_id: str = Field(alias="appointmentId")
    patient_id: str = Field(alias="patientId")
    patient_name: str = Field(alias="patientName")
    slot_start: datetime = Field(alias="slotStart")
    slot_end: datetime = Field(alias="slotEnd")
    status: str
    urgency: str | None = None
    chief_complaint: str | None = Field(default=None, alias="chiefComplaint")


class DoctorVisitSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    appointment_id: str | None = Field(default=None, alias="appointmentId")
    chief_complaint: str = Field(alias="chiefComplaint")
    diagnosis: str
    notes: str
    prescriptions: list[PrescriptionItem] = Field(default_factory=list)


class DoctorNotesResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    appointment_id: str = Field(alias="appointmentId")
    patient_name: str = Field(alias="patientName")
    status: str = "booked"
    symptoms_text: str | None = Field(default=None, alias="symptomsText")
    ai_pre_visit_summary: dict | None = Field(default=None, alias="aiPreVisitSummary")
    doctor_notes: str = Field(default="", alias="doctorNotes")
    diagnosis: str | None = None
    prescriptions: list[PrescriptionItem] = Field(default_factory=list)
    ai_post_visit_summary: PostVisitSummary | None = Field(default=None, alias="aiPostVisitSummary")
    ai_post_visit_summary_status: str | None = Field(default=None, alias="aiPostVisitSummaryStatus")


class DoctorScheduleResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    doctor_id: str = Field(alias="doctorId")
    specialisation: str
    working_hours: list[WorkingHour] = Field(default_factory=list, alias="workingHours")
    slot_duration_minutes: int = Field(default=30, alias="slotDurationMinutes")
    leave_days: list[LeaveDay] = Field(default_factory=list, alias="leaveDays")


class DoctorScheduleUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    working_hours: list[WorkingHour] | None = Field(default=None, alias="workingHours")
    slot_duration_minutes: int | None = Field(default=None, alias="slotDurationMinutes")
