from __future__ import annotations

from beanie import PydanticObjectId

from ..config import get_settings
from ..models.appointment import Appointment
from ..models.enums import NotificationChannel, NotificationStatus, NotificationType
from ..models.notification import NotificationLog
from ..models.user import User
from .email import EmailMessage, send_email


async def dispatch_appointment_notification(
    appointment_id: str,
    notification_type: NotificationType,
    *,
    subject: str,
    body: str,
) -> NotificationLog | None:
    appointment = await Appointment.get(PydanticObjectId(appointment_id))
    if appointment is None:
        return None

    patient = await User.get(appointment.patient_id)
    if patient is None or patient.email is None:
        return None

    log = NotificationLog(
        appointment_id=appointment.id,
        type=notification_type,
        channel=NotificationChannel.EMAIL,
        status=NotificationStatus.PENDING,
    )
    await log.save()

    settings = get_settings()
    if not settings.sendgrid_api_key:
        return log

    sent = await send_email(EmailMessage(to=str(patient.email), subject=subject, body=body))
    log.attempts += 1
    if sent:
        log.status = NotificationStatus.SENT
        log.last_error = None
    else:
        log.status = NotificationStatus.RETRYING
        log.last_error = "Delivery failed"
    await log.save()
    return log
