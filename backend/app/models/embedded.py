from __future__ import annotations

from datetime import date, time

from pydantic import BaseModel, ConfigDict, Field, field_serializer


class WorkingHour(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    day_of_week: int = Field(ge=0, le=6, alias="dayOfWeek")
    start_time: time = Field(alias="startTime")
    end_time: time = Field(alias="endTime")

    @field_serializer("start_time", "end_time", mode="plain")
    def _serialize_time(self, v: time) -> str:
        return v.isoformat()


class PreVisitSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    urgency: str
    chief_complaint: str = Field(alias="chiefComplaint")
    follow_up_questions: list[str] = Field(default_factory=list, alias="followUpQuestions")
    recommended_specialisation: str | None = Field(default=None, alias="recommendedSpecialisation")


class PrescriptionItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    medication_name: str = Field(alias="medicationName")
    dosage: str
    frequency: str
    duration_days: int = Field(ge=1, alias="durationDays")
    instructions: str | None = None


class PostVisitSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    summary: str
    follow_up_steps: list[str] = Field(default_factory=list, alias="followUpSteps")
    red_flags: list[str] = Field(default_factory=list, alias="redFlags")


class LeaveDay(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    day: date
