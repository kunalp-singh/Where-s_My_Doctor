from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta

from beanie import PydanticObjectId

from ..models.appointment import Appointment
from ..models.enums import NotificationChannel, NotificationStatus, NotificationType, ReminderStatus
from ..models.notification import MedicationReminder, NotificationLog
from ..models.user import User
from .email import EmailMessage, send_email


def _parse_frequency_to_delta(frequency: str) -> timedelta:
    text = frequency.lower().strip()
    if not text:
        return timedelta(days=1)

    if "twice" in text:
        return timedelta(hours=12)
    if "three times" in text:
        return timedelta(hours=8)
    if "four times" in text:
        return timedelta(hours=6)

    match = re.search(r"(\d+)\s*(hour|hours|day|days|week|weeks|minute|minutes)", text)
    if match:
        value = int(match.group(1))
        unit = match.group(2)
        mapping = {
            "minute": "minutes",
            "minutes": "minutes",
            "hour": "hours",
            "hours": "hours",
            "day": "days",
            "days": "days",
            "week": "weeks",
            "weeks": "weeks",
        }
        unit_name = mapping[unit]
        return timedelta(**{unit_name: value})

    if "daily" in text or "day" in text:
        return timedelta(days=1)
    if "weekly" in text or "week" in text:
        return timedelta(weeks=1)
    if "hourly" in text or "hour" in text:
        return timedelta(hours=1)
    return timedelta(days=1)


async def schedule_medication_reminders(
    appointment_id: PydanticObjectId,
    prescriptions: list[object],
) -> None:
    """Pre-creates MedicationReminder records for each prescription based on frequency and duration."""
    from ..models.embedded import PrescriptionItem
    
    now = datetime.now(UTC)
    for p in prescriptions or []:
        freq = getattr(p, "frequency", "") or ""
        med_name = getattr(p, "medication_name", "") or ""
        duration = getattr(p, "duration_days", 7) or 7

        delta = _parse_frequency_to_delta(freq)
        delta_seconds = delta.total_seconds()
        if delta_seconds <= 0:
            delta_seconds = 24 * 3600

        total_seconds = duration * 24 * 3600
        current_offset = delta_seconds
        
        max_reminders = 100
        count = 0

        while current_offset <= total_seconds and count < max_reminders:
            reminder_time = now + timedelta(seconds=current_offset)
            reminder = MedicationReminder(
                appointment_id=appointment_id,
                medication_name=med_name,
                frequency=freq,
                next_send_at=reminder_time,
                status=ReminderStatus.PENDING,
            )
            await reminder.insert()
            current_offset += delta_seconds
            count += 1


async def process_medication_reminders() -> int:
    now = datetime.now(UTC)
    reminders = await MedicationReminder.find(
        MedicationReminder.status == ReminderStatus.PENDING,
        MedicationReminder.next_send_at <= now,
    ).to_list()

    processed = 0
    for reminder in reminders:
        appointment = await Appointment.get(reminder.appointment_id)
        if appointment is None:
            reminder.status = ReminderStatus.CANCELLED
            await reminder.save()
            continue

        patient = await User.get(appointment.patient_id)
        if patient is None or patient.email is None:
            reminder.status = ReminderStatus.FAILED
            await reminder.save()
            continue

        message = EmailMessage(
            to=str(patient.email),
            subject=f"Medication reminder: {reminder.medication_name}",
            body=(
                f"Hello {patient.name},\n\n"
                f"This is a reminder to take {reminder.medication_name}.\n"
                f"Frequency: {reminder.frequency}\n"
                f"Appointment: {appointment.slot_start.isoformat()} to {appointment.slot_end.isoformat()}\n"
            ),
        )
        sent = await send_email(message)
        if sent:
            reminder.status = ReminderStatus.SENT
            reminder.next_send_at = now + _parse_frequency_to_delta(reminder.frequency)
            await reminder.save()
            processed += 1
        else:
            reminder.status = ReminderStatus.FAILED
            await reminder.save()
    return processed


async def retry_failed_notifications() -> int:
    now = datetime.now(UTC)
    logs = await NotificationLog.find(
        NotificationLog.status == NotificationStatus.PENDING,
    ).to_list()
    logs.extend(await NotificationLog.find(NotificationLog.status == NotificationStatus.RETRYING).to_list())

    processed = 0
    for log in logs:
        if log.attempts >= 5:
            log.status = NotificationStatus.FAILED
            await log.save()
            continue

        appointment = await Appointment.get(log.appointment_id)
        if appointment is None:
            log.status = NotificationStatus.FAILED
            log.last_error = "Appointment no longer exists"
            await log.save()
            continue

        patient = await User.get(appointment.patient_id)
        if patient is None or patient.email is None:
            log.status = NotificationStatus.FAILED
            log.last_error = "Patient email unavailable"
            await log.save()
            continue

        subject = {
            NotificationType.BOOKING_CONFIRMATION: "Appointment confirmed",
            NotificationType.REMINDER: "Appointment reminder",
            NotificationType.CANCELLATION: "Appointment cancelled",
            NotificationType.LEAVE_CONFLICT: "Schedule update notice",
        }.get(log.type, "Appointment Care update")

        body = (
            f"Hello {patient.name},\n\n"
            f"This is a {log.type.value.replace('_', ' ')} notification for your appointment on "
            f"{appointment.slot_start.isoformat()} to {appointment.slot_end.isoformat()}.\n"
        )

        sent = await send_email(EmailMessage(to=str(patient.email), subject=subject, body=body))
        log.attempts += 1
        if sent:
            log.status = NotificationStatus.SENT
            log.last_error = None
            processed += 1
        else:
            log.status = NotificationStatus.RETRYING if log.attempts < 5 else NotificationStatus.FAILED
            log.last_error = "Delivery failed"
        await log.save()

    return processed
