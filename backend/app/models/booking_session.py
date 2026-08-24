from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any

from beanie import Document
from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel
from pydantic import ConfigDict, Field

from .common import utc_now


class BookingSession(Document):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    patient_id: Annotated[PydanticObjectId, Field(alias="patientId")]
    symptoms_text: str = Field(alias="symptomsText")
    ai_summary: dict[str, Any] = Field(default_factory=dict, alias="aiSummary")
    recommended_specialisation: str = Field(default="General Medicine", alias="recommendedSpecialisation")
    doctor_id: Annotated[PydanticObjectId | None, Field(default=None, alias="doctorId")] = None
    appointment_id: Annotated[PydanticObjectId | None, Field(default=None, alias="appointmentId")] = None
    created_at: datetime = Field(default_factory=utc_now, alias="createdAt")

    class Settings:
        name = "booking_sessions"
        indexes = [IndexModel([("patientId", ASCENDING)])]

