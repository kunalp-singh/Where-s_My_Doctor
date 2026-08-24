from __future__ import annotations

import asyncio

from celery import Celery
from celery.schedules import crontab

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from .config import get_settings
from .models import (
    Appointment,
    DoctorProfile,
    GoogleCalendarCredential,
    MedicationReminder,
    NotificationLog,
    PatientProfile,
    SymptomForm,
    User,
    VisitNotes,
    BookingSession,
)
from .services.jobs import (
    process_medication_reminders,
    retry_failed_notifications,
    run_pre_visit_summary_background,
    run_booking_session_summary_background,
    run_post_visit_summary_background,
)

settings = get_settings()

celery_app = Celery(
    "appointment_care",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "medication-reminder-check": {
            "task": "app.celery_app.process_medication_reminders_task",
            "schedule": crontab(minute="*/15"),
        },
        "notification-retry-check": {
            "task": "app.celery_app.retry_failed_notifications_task",
            "schedule": crontab(minute="*/5"),
        },
    },
)


async def _init_db():
    client = AsyncIOMotorClient(settings.mongodb_uri)
    database = client[settings.mongodb_database_name]
    await init_beanie(
        database,
        document_models=[
            User,
            DoctorProfile,
            PatientProfile,
            Appointment,
            SymptomForm,
            VisitNotes,
            GoogleCalendarCredential,
            MedicationReminder,
            NotificationLog,
            BookingSession,
        ],
    )


async def _run_process_medication_reminders():
    await _init_db()
    return await process_medication_reminders()


async def _run_retry_failed_notifications():
    await _init_db()
    return await retry_failed_notifications()


@celery_app.task(name="app.celery_app.process_medication_reminders_task")
def process_medication_reminders_task() -> int:
    return asyncio.run(_run_process_medication_reminders())


@celery_app.task(name="app.celery_app.retry_failed_notifications_task")
def retry_failed_notifications_task() -> int:
    return asyncio.run(_run_retry_failed_notifications())


@celery_app.task(name="app.celery_app.generate_pre_visit_summary_task")
def generate_pre_visit_summary_task(form_id_str: str, symptoms_text: str):
    async def run():
        await _init_db()
        await run_pre_visit_summary_background(form_id_str, symptoms_text)
    asyncio.run(run())


@celery_app.task(name="app.celery_app.generate_booking_session_summary_task")
def generate_booking_session_summary_task(session_id_str: str, symptoms_text: str):
    async def run():
        await _init_db()
        await run_booking_session_summary_background(session_id_str, symptoms_text)
    asyncio.run(run())


@celery_app.task(name="app.celery_app.generate_post_visit_summary_task")
def generate_post_visit_summary_task(
    visit_notes_id_str: str,
    diagnosis: str | None,
    notes: str | None,
    prescriptions_data: list,
):
    async def run():
        await _init_db()
        await run_post_visit_summary_background(
            visit_notes_id_str,
            diagnosis,
            notes,
            prescriptions_data,
        )
    asyncio.run(run())
