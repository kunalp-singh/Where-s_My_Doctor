from __future__ import annotations

from datetime import datetime
from typing import Annotated

from beanie import Document
from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel
from pydantic import ConfigDict, Field

from .common import utc_now
from .embedded import PostVisitSummary, PreVisitSummary, PrescriptionItem


class SymptomForm(Document):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    appointment_id: Annotated[PydanticObjectId, Field(alias="appointmentId")]
    symptoms_text: str = Field(alias="symptomsText")
    ai_pre_visit_summary: PreVisitSummary | None = Field(default=None, alias="aiPreVisitSummary")
    created_at: datetime = Field(default_factory=utc_now, alias="createdAt")

    class Settings:
        name = "symptom_forms"
        indexes = [IndexModel([("appointmentId", ASCENDING)], unique=True)]


class VisitNotes(Document):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    appointment_id: Annotated[PydanticObjectId, Field(alias="appointmentId")]
    diagnosis: str | None = None
    doctor_notes: str = Field(alias="doctorNotes")
    prescription: list[PrescriptionItem] = Field(default_factory=list)
    ai_post_visit_summary: PostVisitSummary | None = Field(default=None, alias="aiPostVisitSummary")

    class Settings:
        name = "visit_notes"
        indexes = [IndexModel([("appointmentId", ASCENDING)], unique=True)]
