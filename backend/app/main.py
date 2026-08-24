from __future__ import annotations

from contextlib import asynccontextmanager

from beanie import init_beanie
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from .api.routes.admin import router as admin_router
from .api.routes.auth import router as auth_router
from .api.routes.doctor import router as doctor_router
from .api.routes.google_calendar import router as google_calendar_router
from .api.routes.patient import router as patient_router
from .config import get_settings
from .models import (
    Appointment,
    BookingSession,
    DoctorProfile,
    GoogleCalendarCredential,
    MedicationReminder,
    NotificationLog,
    PatientProfile,
    SymptomForm,
    User,
    VisitNotes,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    client = AsyncIOMotorClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=10000,
        tlsAllowInvalidCertificates=True,
    )
    database = client[settings.mongodb_database_name]
    await init_beanie(
        database,
        document_models=[
            User,
            DoctorProfile,
            PatientProfile,
            Appointment,
            BookingSession,
            SymptomForm,
            VisitNotes,
            GoogleCalendarCredential,
            MedicationReminder,
            NotificationLog,
        ],
    )
    yield


app = FastAPI(title="Appointment Care API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(google_calendar_router)
app.include_router(admin_router)
app.include_router(patient_router)
app.include_router(doctor_router)
