from __future__ import annotations

from contextlib import asynccontextmanager
import logging

from beanie import init_beanie
from fastapi import APIRouter, FastAPI, Request
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

logger = logging.getLogger("appointment_care")
_db_initialized = False
_db_error = None


async def init_db():
    global _db_initialized, _db_error
    if _db_initialized:
        return
    try:
        settings = get_settings()
        client = AsyncIOMotorClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=3000,
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
        _db_initialized = True
        _db_error = None
        logger.info("Database initialized successfully.")
    except Exception as e:
        _db_error = str(e)
        logger.error(f"Database initialization error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db()
    except Exception:
        pass
    yield


app = FastAPI(title="Appointment Care API", lifespan=lifespan)


@app.middleware("http")
async def ensure_db_middleware(request: Request, call_next):
    if not _db_initialized:
        try:
            await init_db()
        except Exception:
            pass
    response = await call_next(request)
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Support both root paths (/auth/login) and /api prefixed paths (/api/auth/login)
api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(google_calendar_router)
api_router.include_router(admin_router)
api_router.include_router(patient_router)
api_router.include_router(doctor_router)

app.include_router(api_router)
app.include_router(auth_router)
app.include_router(google_calendar_router)
app.include_router(admin_router)
app.include_router(patient_router)
app.include_router(doctor_router)


@app.get("/")
@app.get("/api")
async def root():
    return {
        "message": "Appointment Care API Server is running.",
        "db_initialized": _db_initialized,
        "db_error": _db_error,
    }


@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "db_initialized": _db_initialized, "db_error": _db_error}
