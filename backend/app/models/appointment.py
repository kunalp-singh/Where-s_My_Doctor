from __future__ import annotations

from datetime import datetime
from typing import Annotated

from beanie import Document
from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel
from pydantic import ConfigDict, Field

from .common import utc_now
from .enums import AppointmentStatus


class Appointment(Document):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    patient_id: Annotated[PydanticObjectId, Field(alias="patientId")]
    doctor_id: Annotated[PydanticObjectId, Field(alias="doctorId")]
    slot_start: datetime = Field(alias="slotStart")
    slot_end: datetime = Field(alias="slotEnd")
    time_zone: str = Field(default="UTC", alias="timeZone")
    status: AppointmentStatus
    hold_expires_at: datetime | None = Field(default=None, alias="holdExpiresAt")
    google_calendar_event_id_patient: str | None = Field(default=None, alias="googleCalendarEventIdPatient")
    google_calendar_event_id_doctor: str | None = Field(default=None, alias="googleCalendarEventIdDoctor")
    created_at: datetime = Field(default_factory=utc_now, alias="createdAt")

    class Settings:
        name = "appointments"
        indexes = [
            IndexModel([("doctorId", ASCENDING), ("slotStart", ASCENDING)], unique=True),
            IndexModel([("patientId", ASCENDING)]),
            IndexModel([("doctorId", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
        ]
