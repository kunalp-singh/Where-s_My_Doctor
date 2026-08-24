from __future__ import annotations

from datetime import datetime
from typing import Annotated

from beanie import Document
from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel
from pydantic import ConfigDict, Field

from .common import utc_now
from .enums import NotificationChannel, NotificationStatus, NotificationType, ReminderStatus


class MedicationReminder(Document):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    appointment_id: Annotated[PydanticObjectId, Field(alias="appointmentId")]
    medication_name: str = Field(alias="medicationName")
    frequency: str
    next_send_at: datetime = Field(alias="nextSendAt")
    status: ReminderStatus

    class Settings:
        name = "medication_reminders"
        indexes = [
            IndexModel([("appointmentId", ASCENDING)]),
            IndexModel([("nextSendAt", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
        ]


class NotificationLog(Document):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    appointment_id: Annotated[PydanticObjectId, Field(alias="appointmentId")]
    type: NotificationType
    channel: NotificationChannel
    status: NotificationStatus
    attempts: int = Field(default=0, ge=0)
    last_error: str | None = Field(default=None, alias="lastError")
    created_at: datetime = Field(default_factory=utc_now, alias="createdAt")

    class Settings:
        name = "notification_logs"
        indexes = [
            IndexModel([("appointmentId", ASCENDING)]),
            IndexModel([("type", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
        ]
