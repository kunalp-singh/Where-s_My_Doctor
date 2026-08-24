from __future__ import annotations

from datetime import date, datetime, time
from typing import Annotated

from beanie import Document
from beanie import PydanticObjectId
import beanie.odm.utils.encoder as beanie_encoder
from pymongo import ASCENDING, IndexModel
from pydantic import ConfigDict, EmailStr, Field

from .common import utc_now
from .embedded import LeaveDay, WorkingHour
from .enums import UserRole, UserStatus

beanie_encoder.DEFAULT_CUSTOM_ENCODERS[time] = lambda v: v.isoformat()


class User(Document):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    role: UserRole
    name: str
    email: EmailStr
    password_hash: str = Field(alias="passwordHash")
    status: UserStatus = Field(default=UserStatus.ACTIVE)
    created_at: datetime = Field(default_factory=utc_now, alias="createdAt")

    class Settings:
        name = "users"
        indexes = [IndexModel([("email", ASCENDING)], unique=True)]


class DoctorProfile(Document):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    user_id: Annotated[PydanticObjectId, Field(alias="userId")]
    specialisation: str
    working_hours: list[WorkingHour] = Field(default_factory=list, alias="workingHours")
    slot_duration_minutes: int = Field(ge=5, alias="slotDurationMinutes")
    leave_days: list[LeaveDay] = Field(default_factory=list, alias="leaveDays")

    class Settings:
        name = "doctor_profiles"
        indexes = [IndexModel([("userId", ASCENDING)], unique=True)]


class PatientProfile(Document):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    user_id: Annotated[PydanticObjectId, Field(alias="userId")]
    dob: date
    phone: str

    class Settings:
        name = "patient_profiles"
        indexes = [IndexModel([("userId", ASCENDING)], unique=True)]
