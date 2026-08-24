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


async def run_pre_visit_summary_background(form_id_str: str, symptoms_text: str) -> None:
    from ..models.clinical import SymptomForm
    from .ai import build_pre_visit_summary
    import logging
    import time
    
    logger = logging.getLogger("appointment_care")
    form_id = PydanticObjectId(form_id_str)
    form = await SymptomForm.get(form_id)
    if not form:
        logger.error("SymptomForm %s not found in background task", form_id_str)
        return

    logger.info("Starting background Gemini pre-visit summary call for SymptomForm %s", form_id_str)
    start_time = time.time()
    try:
        summary = await build_pre_visit_summary(symptoms_text)
        duration = time.time() - start_time
        logger.info("Successfully generated pre-visit summary for SymptomForm %s in %.2fs", form_id_str, duration)
        form.ai_pre_visit_summary = summary
        form.status = "summary_ready"
    except Exception as exc:
        duration = time.time() - start_time
        logger.error("Failed to generate pre-visit summary for SymptomForm %s in %.2fs: %s", form_id_str, duration, exc)
        form.ai_pre_visit_summary = {
            "urgency": "medium",
            "chief_complaint": symptoms_text[:160],
            "follow_up_questions": [
                "Can you describe the severity and duration of your symptoms?",
                "Have you experienced similar issues previously?",
                "Are there any aggravating or relieving factors?",
            ],
            "recommended_specialisation": "General Medicine",
        }
        form.status = "summary_failed"
    await form.save()


async def run_booking_session_summary_background(session_id_str: str, symptoms_text: str) -> None:
    from ..models.booking_session import BookingSession
    from .ai import build_pre_visit_summary
    import logging
    import time
    
    logger = logging.getLogger("appointment_care")
    session_id = PydanticObjectId(session_id_str)
    session = await BookingSession.get(session_id)
    if not session:
        logger.error("BookingSession %s not found in background task", session_id_str)
        return

    logger.info("Starting background Gemini pre-visit summary call for BookingSession %s", session_id_str)
    start_time = time.time()
    try:
        summary = await build_pre_visit_summary(symptoms_text)
        duration = time.time() - start_time
        logger.info("Successfully generated pre-visit summary for BookingSession %s in %.2fs", session_id_str, duration)
        session.ai_summary = summary
        session.recommended_specialisation = summary.get("recommended_specialisation", "General Medicine")
        session.status = "summary_ready"
    except Exception as exc:
        duration = time.time() - start_time
        logger.error("Failed to generate pre-visit summary for BookingSession %s in %.2fs: %s", session_id_str, duration, exc)
        session.ai_summary = {
            "urgency": "medium",
            "chief_complaint": symptoms_text[:160],
            "follow_up_questions": [
                "Can you describe the severity and duration of your symptoms?",
                "Have you experienced similar issues previously?",
                "Are there any aggravating or relieving factors?",
            ],
            "recommended_specialisation": "General Medicine",
        }
        session.recommended_specialisation = "General Medicine"
        session.status = "summary_failed"
    await session.save()


async def run_post_visit_summary_background(
    visit_notes_id_str: str,
    diagnosis: str | None,
    notes: str | None,
    prescriptions_data: list,
) -> None:
    from ..models.clinical import VisitNotes
    from .ai import build_post_visit_summary
    from ..models.embedded import PostVisitSummary
    import logging
    import time

    logger = logging.getLogger("appointment_care")
    notes_id = PydanticObjectId(visit_notes_id_str)
    existing = await VisitNotes.get(notes_id)
    if not existing:
        logger.error("VisitNotes %s not found in background task", visit_notes_id_str)
        return

    logger.info("Starting background Gemini post-visit summary call for VisitNotes %s", visit_notes_id_str)
    start_time = time.time()
    try:
        ai_dict = await build_post_visit_summary(diagnosis, notes, prescriptions_data)
        duration = time.time() - start_time
        logger.info("Successfully generated post-visit summary for VisitNotes %s in %.2fs", visit_notes_id_str, duration)
        summary = PostVisitSummary(
            summary=ai_dict["summary"],
            follow_up_steps=ai_dict["follow_up_steps"],
            red_flags=ai_dict["red_flags"],
        )
        existing.ai_post_visit_summary = summary
        existing.status = "summary_ready"
    except Exception as exc:
        duration = time.time() - start_time
        logger.error("Failed to generate post-visit summary for VisitNotes %s in %.2fs: %s", visit_notes_id_str, duration, exc)
        summary = PostVisitSummary(
            summary=f"Visit completed. Diagnosis: {diagnosis or 'Routine Consultation'}.",
            follow_up_steps=[
                "Take prescribed medications exactly as directed.",
                "Rest and maintain proper hydration.",
                "Contact the clinic if symptoms worsen.",
            ],
            red_flags=[
                "High fever that does not respond to medication",
                "Difficulty breathing or chest discomfort",
                "Sudden severe pain or confusion",
            ],
        )
        existing.ai_post_visit_summary = summary
        existing.status = "summary_failed"
    await existing.save()

    # Dispatch email notification to patient alerting that Post-Visit Care Summary is ready
    try:
        from .notifications import dispatch_appointment_notification
        from ..models.enums import NotificationType
        from ..models.appointment import Appointment
        from ..models.user import User

        appointment = await Appointment.get(existing.appointment_id)
        if appointment:
            doctor = await User.get(appointment.doctor_id)
            doctor_name = doctor.name if doctor else "your specialist"
            await dispatch_appointment_notification(
                str(appointment.id),
                NotificationType.REMINDER,
                subject="Your CareConnect Post-Visit Summary & Prescription Details",
                body=(
                    f"Hello,\n\nYour consultation with Dr. {doctor_name} is complete.\n\n"
                    f"Summary: {summary.summary}\n\n"
                    "Please sign in to your CareConnect Portal to view your complete post-visit care plan and warning signs."
                ),
            )
    except Exception as email_err:
        logger.error("Failed to send post-visit notification email: %s", email_err)


def trigger_pre_visit_summary(form_id_str: str, symptoms_text: str):
    import logging
    logger = logging.getLogger("appointment_care")
    try:
        from ..celery_app import generate_pre_visit_summary_task
        generate_pre_visit_summary_task.delay(form_id_str, symptoms_text)
        logger.info("Enqueued pre-visit summary Celery task for Form %s", form_id_str)
    except Exception as exc:
        import asyncio
        asyncio.create_task(run_pre_visit_summary_background(form_id_str, symptoms_text))
        logger.info("Flipped to asyncio.create_task pre-visit summary fallback: %s", exc)


def trigger_booking_session_summary(session_id_str: str, symptoms_text: str):
    import logging
    logger = logging.getLogger("appointment_care")
    try:
        from ..celery_app import generate_booking_session_summary_task
        generate_booking_session_summary_task.delay(session_id_str, symptoms_text)
        logger.info("Enqueued booking session Celery task for Session %s", session_id_str)
    except Exception as exc:
        import asyncio
        asyncio.create_task(run_booking_session_summary_background(session_id_str, symptoms_text))
        logger.info("Flipped to asyncio.create_task booking session summary fallback: %s", exc)


def trigger_post_visit_summary(
    visit_notes_id_str: str,
    diagnosis: str | None,
    notes: str | None,
    prescriptions_data: list,
):
    import logging
    logger = logging.getLogger("appointment_care")
    try:
        from ..celery_app import generate_post_visit_summary_task
        generate_post_visit_summary_task.delay(visit_notes_id_str, diagnosis, notes, prescriptions_data)
        logger.info("Enqueued post-visit summary Celery task for Notes %s", visit_notes_id_str)
    except Exception as exc:
        import asyncio
        logger.info("Flipped to asyncio.create_task post-visit summary fallback: %s", exc)


async def send_appointment_reminders() -> int:
    import logging
    logger = logging.getLogger("appointment_care")
    now = datetime.now(UTC)
    reminder_window_start = now
    reminder_window_end = now + timedelta(hours=24)

    # Find booked appointments starting in the next 24 hours
    appointments = await Appointment.find(
        Appointment.status == AppointmentStatus.BOOKED,
        Appointment.slot_start >= reminder_window_start,
        Appointment.slot_start <= reminder_window_end,
    ).to_list()

    processed = 0
    for appt in appointments:
        # Check if we already sent a reminder for this appointment
        existing_reminder = await NotificationLog.find_one(
            NotificationLog.appointment_id == appt.id,
            NotificationLog.type == NotificationType.REMINDER,
        )
        if existing_reminder is not None:
            continue

        patient = await User.get(appt.patient_id)
        doctor = await User.get(appt.doctor_id)
        if not patient or not doctor:
            continue

        # Create the NotificationLog first to prevent duplicate sends
        log = NotificationLog(
            appointment_id=appt.id,
            type=NotificationType.REMINDER,
            channel=NotificationChannel.EMAIL,
            status=NotificationStatus.PENDING,
        )
        await log.save()

        start_text = appt.slot_start.isoformat()
        end_text = appt.slot_end.isoformat()

        # Send email to patient
        patient_subject = "Reminder: Upcoming Appointment"
        patient_body = (
            f"Hello {patient.name},\n\n"
            f"This is a reminder for your upcoming appointment with Dr. {doctor.name}.\n\n"
            f"Date and time: {start_text} to {end_text}\n"
            f"Time zone: {appt.time_zone}\n"
        )
        patient_html = (
            f"<p>Hello {patient.name},</p>"
            f"<p>This is a reminder for your upcoming appointment with <strong>Dr. {doctor.name}</strong>.</p>"
            "<ul>"
            f"<li><strong>Date and time:</strong> {start_text} to {end_text}</li>"
            f"<li><strong>Time zone:</strong> {appt.time_zone}</li>"
            "</ul>"
        )

        # Send email to doctor
        doctor_subject = "Reminder: Upcoming Consultation"
        doctor_body = (
            f"Hello Dr. {doctor.name},\n\n"
            f"This is a reminder for your upcoming consultation with {patient.name}.\n\n"
            f"Date and time: {start_text} to {end_text}\n"
            f"Time zone: {appt.time_zone}\n"
        )
        doctor_html = (
            f"<p>Hello Dr. {doctor.name},</p>"
            f"<p>This is a reminder for your upcoming consultation with <strong>{patient.name}</strong>.</p>"
            "<ul>"
            f"<li><strong>Date and time:</strong> {start_text} to {end_text}</li>"
            f"<li><strong>Time zone:</strong> {appt.time_zone}</li>"
            "</ul>"
        )

        sent_patient = False
        sent_doctor = False
        try:
            sent_patient = await send_email(EmailMessage(
                to=str(patient.email),
                subject=patient_subject,
                body=patient_body,
                html_body=patient_html,
            ))
            sent_doctor = await send_email(EmailMessage(
                to=str(doctor.email),
                subject=doctor_subject,
                body=doctor_body,
                html_body=doctor_html,
            ))
        except Exception as err:
            logger.error("Failed to send appointment reminder email: %s", err)

        log.attempts += 1
        if sent_patient and sent_doctor:
            log.status = NotificationStatus.SENT
        else:
            log.status = NotificationStatus.FAILED
            log.last_error = "Failed to send email to patient or doctor"
        await log.save()
        processed += 1

    return processed
