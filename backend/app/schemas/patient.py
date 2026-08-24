from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ..models.enums import AppointmentStatus


class DoctorSearchResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    id: str
    name: str
    email: str
    specialisation: str | None = None
    working_hours: list[dict[str, str | int]] = Field(default_factory=list, alias="workingHours")
    slot_duration_minutes: int = Field(default=30, alias="slotDurationMinutes")


class DoctorSlot(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    slot_start: datetime = Field(alias="slotStart")
    slot_end: datetime = Field(alias="slotEnd")
    available: bool = True
    status: str = "available"


class BookAppointmentRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    doctor_id: str = Field(alias="doctorId")
    slot_start: datetime = Field(alias="slotStart")


class BookAppointmentResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    appointment_id: str = Field(alias="appointmentId")
    status: AppointmentStatus
    hold_expires_at: datetime | None = Field(default=None, alias="holdExpiresAt")


class SymptomSubmission(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    symptoms_text: str = Field(alias="symptomsText")


class SymptomSummaryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    appointment_id: str = Field(alias="appointmentId")
    urgency: str
    chief_complaint: str = Field(alias="chiefComplaint")
    follow_up_questions: list[str] = Field(default_factory=list, alias="followUpQuestions")
    recommended_specialisation: str = Field(default="General Medicine", alias="recommendedSpecialisation")


class PatientAppointmentResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    appointment_id: str = Field(alias="appointmentId")
    doctor_id: str = Field(alias="doctorId")
    doctor_name: str = Field(alias="doctorName")
    slot_start: datetime = Field(alias="slotStart")
    slot_end: datetime = Field(alias="slotEnd")
    status: AppointmentStatus


class CreateBookingSessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    symptoms_text: str = Field(alias="symptomsText")


class UpdateBookingSessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    recommended_specialisation: str | None = Field(default=None, alias="recommendedSpecialisation")
    doctor_id: str | None = Field(default=None, alias="doctorId")


class BookingSessionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    session_id: str = Field(alias="sessionId")
    symptoms_text: str = Field(alias="symptomsText")
    ai_summary: dict[str, Any] = Field(default_factory=dict, alias="aiSummary")
    recommended_specialisation: str = Field(default="General Medicine", alias="recommendedSpecialisation")
    doctor_id: str | None = Field(default=None, alias="doctorId")
    appointment_id: str | None = Field(default=None, alias="appointmentId")
