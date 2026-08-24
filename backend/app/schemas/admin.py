from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from ..models.embedded import LeaveDay, WorkingHour


class DoctorCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    name: str
    email: EmailStr
    password: str = Field(min_length=8)
    specialisation: str
    working_hours: list[WorkingHour] = Field(default_factory=list, alias="workingHours")
    slot_duration_minutes: int = Field(default=30, ge=5, alias="slotDurationMinutes")
    leave_days: list[LeaveDay] = Field(default_factory=list, alias="leaveDays")


class DoctorUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    name: str | None = None
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8)
    specialisation: str | None = None
    working_hours: list[WorkingHour] | None = Field(default=None, alias="workingHours")
    slot_duration_minutes: int | None = Field(default=None, ge=5, alias="slotDurationMinutes")
    leave_days: list[LeaveDay] | None = Field(default=None, alias="leaveDays")


class LeaveDayRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    day: date


from ..models.enums import UserStatus


class DoctorResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    id: str
    name: str
    email: EmailStr
    status: UserStatus = Field(default=UserStatus.ACTIVE)
    specialisation: str | None = None
    working_hours: list[WorkingHour] = Field(default_factory=list, alias="workingHours")
    slot_duration_minutes: int = Field(default=30, alias="slotDurationMinutes")
    leave_days: list[LeaveDay] = Field(default_factory=list, alias="leaveDays")


class LeaveDaySummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    doctor_id: str = Field(alias="doctorId")
    date: date
    affected_booking_count: int = Field(alias="affectedBookingCount")
