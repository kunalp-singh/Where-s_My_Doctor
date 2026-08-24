from __future__ import annotations

from enum import Enum


class UserRole(str, Enum):
    PATIENT = "patient"
    DOCTOR = "doctor"
    ADMIN = "admin"


class UserStatus(str, Enum):
    ACTIVE = "active"
    PENDING_APPROVAL = "pending_approval"
    REJECTED = "rejected"


class AppointmentStatus(str, Enum):
    HELD = "held"
    BOOKED = "booked"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class NotificationType(str, Enum):
    BOOKING_CONFIRMATION = "booking_confirmation"
    REMINDER = "reminder"
    CANCELLATION = "cancellation"
    LEAVE_CONFLICT = "leave_conflict"


class NotificationChannel(str, Enum):
    EMAIL = "email"


class NotificationStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    RETRYING = "retrying"
    FAILED = "failed"


class ReminderStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    CANCELLED = "cancelled"
