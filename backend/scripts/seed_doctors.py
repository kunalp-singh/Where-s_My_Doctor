"""Seed script for Appointment Care database.

Run this script to populate MongoDB Atlas with dummy doctors, an admin user, and a test patient.

Usage:
    cd backend
    /Users/kp/Studies/Projects/Appointment Care/.venv/bin/python scripts/seed_doctors.py
"""

import asyncio
from datetime import time
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import get_settings
from app.models import (
    Appointment,
    DoctorProfile,
    GoogleCalendarCredential,
    MedicationReminder,
    NotificationLog,
    PatientProfile,
    SymptomForm,
    User,
    VisitNotes,
)
from app.models.embedded import WorkingHour
from app.models.enums import UserRole, UserStatus
from app.services.security import hash_password

DEFAULT_PASSWORD = "Password123!"

# Standard 9:00 to 17:00 Monday to Sunday (0 = Mon, 6 = Sun)
STANDARD_WORKING_HOURS = [
    WorkingHour(day_of_week=day, start_time=time(9, 0), end_time=time(17, 0))
    for day in range(7)
]

DUMMY_DOCTORS = [
    {
        "name": "Dr. Evelyn Vance",
        "email": "evelyn.vance@example.com",
        "specialisation": "General Medicine",
        "status": UserStatus.ACTIVE,
        "slot_duration": 30,
    },
    {
        "name": "Dr. Marcus Sterling",
        "email": "marcus.sterling@example.com",
        "specialisation": "Cardiology",
        "status": UserStatus.ACTIVE,
        "slot_duration": 30,
    },
    {
        "name": "Dr. Sophia Chen",
        "email": "sophia.chen@example.com",
        "specialisation": "Dermatology",
        "status": UserStatus.ACTIVE,
        "slot_duration": 30,
    },
    {
        "name": "Dr. James Wilson",
        "email": "james.wilson@example.com",
        "specialisation": "Pediatrics",
        "status": UserStatus.ACTIVE,
        "slot_duration": 20,
    },
    {
        "name": "Dr. Aisha Patel",
        "email": "aisha.patel@example.com",
        "specialisation": "Neurology",
        "status": UserStatus.ACTIVE,
        "slot_duration": 45,
    },
    {
        "name": "Dr. Liam O'Connor",
        "email": "liam.oconnor@example.com",
        "specialisation": "Orthopedics",
        "status": UserStatus.ACTIVE,
        "slot_duration": 30,
    },
    {
        "name": "Dr. Elena Rostova",
        "email": "elena.rostova@example.com",
        "specialisation": "Psychiatry",
        "status": UserStatus.ACTIVE,
        "slot_duration": 50,
    },
    {
        "name": "Dr. Maya Lin",
        "email": "maya.lin@example.com",
        "specialisation": "General Medicine",
        "status": UserStatus.PENDING_APPROVAL,
        "slot_duration": 30,
    },
]

DUMMY_USERS = [
    {
        "name": "System Administrator",
        "email": "admin@example.com",
        "role": UserRole.ADMIN,
        "status": UserStatus.ACTIVE,
    },
    {
        "name": "Jane Doe",
        "email": "jane.doe@example.com",
        "role": UserRole.PATIENT,
        "status": UserStatus.ACTIVE,
    },
]


async def seed_database():
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
            SymptomForm,
            VisitNotes,
            GoogleCalendarCredential,
            MedicationReminder,
            NotificationLog,
        ],
    )

    print("🌱 Starting database seeding...")
    hashed_pwd = hash_password(DEFAULT_PASSWORD)

    # 1. Seed Admin & Patient Users
    for user_info in DUMMY_USERS:
        existing = await User.find_one(User.email == user_info["email"])
        if existing is None:
            user = User(
                name=user_info["name"],
                email=user_info["email"],
                role=user_info["role"],
                password_hash=hashed_pwd,
                status=user_info["status"],
            )
            await user.insert()
            print(f"  ✓ Created user: {user.name} ({user.role.value}) <{user.email}>")
        else:
            print(f"  - Skipped existing user: {existing.email}")

    # 2. Seed Doctors
    for doc in DUMMY_DOCTORS:
        existing = await User.find_one(User.email == doc["email"])
        if existing is None:
            user = User(
                name=doc["name"],
                email=doc["email"],
                role=UserRole.DOCTOR,
                password_hash=hashed_pwd,
                status=doc["status"],
            )
            await user.insert()

            profile = DoctorProfile(
                user_id=user.id,
                specialisation=doc["specialisation"],
                working_hours=STANDARD_WORKING_HOURS,
                slot_duration_minutes=doc["slot_duration"],
                leave_days=[],
            )
            await profile.insert()
            print(f"  ✓ Created Doctor: {user.name} [{doc['specialisation']}] ({user.status.value}) <{user.email}>")
        else:
            profile = await DoctorProfile.find_one(DoctorProfile.user_id == existing.id)
            if profile is None:
                profile = DoctorProfile(
                    user_id=existing.id,
                    specialisation=doc["specialisation"],
                    working_hours=STANDARD_WORKING_HOURS,
                    slot_duration_minutes=doc["slot_duration"],
                    leave_days=[],
                )
                await profile.insert()
                print(f"  ✓ Created Doctor Profile for existing user: {existing.email}")
            else:
                profile.working_hours = STANDARD_WORKING_HOURS
                await profile.save()
                print(f"  ✓ Updated working hours for doctor: {existing.email}")

    print("\n✅ Seeding complete!")
    print("\n---------------------------------------------------------")
    print(f"Default Password for all seeded accounts: {DEFAULT_PASSWORD}")
    print("---------------------------------------------------------")
    print("Seeded Accounts:")
    print("  [Admin]    admin@example.com")
    print("  [Patient]  jane.doe@example.com")
    print("  [Doctor]   evelyn.vance@example.com (Active - General Medicine)")
    print("  [Doctor]   marcus.sterling@example.com (Active - Cardiology)")
    print("  [Doctor]   sophia.chen@example.com (Active - Dermatology)")
    print("  [Doctor]   james.wilson@example.com (Active - Pediatrics)")
    print("  [Doctor]   aisha.patel@example.com (Active - Neurology)")
    print("  [Doctor]   liam.oconnor@example.com (Active - Orthopedics)")
    print("  [Doctor]   elena.rostova@example.com (Active - Psychiatry)")
    print("  [Doctor]   maya.lin@example.com (Pending Approval - General Medicine)")
    print("---------------------------------------------------------")


if __name__ == "__main__":
    asyncio.run(seed_database())

