from __future__ import annotations

import asyncio
from datetime import time
import logging
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings
from app.models.embedded import WorkingHour
from app.models.enums import UserRole, UserStatus
from app.models.user import DoctorProfile, User
from app.services.security import hash_password

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_doctors")

DOCTORS_DATA = [
    {
        "name": "Dr. Rajesh Sharma",
        "email": "dr.rajesh.sharma@careconnect.in",
        "specialisation": "Cardiology",
        "password": "DoctorPassword123!",
        "start_time": time(9, 0),
        "end_time": time(17, 0),
    },
    {
        "name": "Dr. Ananya Deshmukh",
        "email": "dr.ananya.deshmukh@careconnect.in",
        "specialisation": "Neurology",
        "password": "DoctorPassword123!",
        "start_time": time(9, 30),
        "end_time": time(17, 30),
    },
    {
        "name": "Dr. Vikramaditya Rao",
        "email": "dr.vikram.rao@careconnect.in",
        "specialisation": "Orthopedics",
        "password": "DoctorPassword123!",
        "start_time": time(10, 0),
        "end_time": time(18, 0),
    },
    {
        "name": "Dr. Priya Sundaram",
        "email": "dr.priya.sundaram@careconnect.in",
        "specialisation": "Pediatrics",
        "password": "DoctorPassword123!",
        "start_time": time(9, 0),
        "end_time": time(16, 30),
    },
    {
        "name": "Dr. Amitav Banerjee",
        "email": "dr.amitav.banerjee@careconnect.in",
        "specialisation": "Dermatology",
        "password": "DoctorPassword123!",
        "start_time": time(10, 30),
        "end_time": time(18, 30),
    },
    {
        "name": "Dr. Sunita Kapoor",
        "email": "dr.sunita.kapoor@careconnect.in",
        "specialisation": "General Medicine",
        "password": "DoctorPassword123!",
        "start_time": time(8, 30),
        "end_time": time(16, 30),
    },
]


async def seed():
    settings = get_settings()
    client = AsyncIOMotorClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=3000,
        tlsAllowInvalidCertificates=True,
    )
    database = client[settings.mongodb_database_name]
    await init_beanie(database, document_models=[User, DoctorProfile])

    logger.info("Database connection established for doctor seeding...")

    for item in DOCTORS_DATA:
        existing_user = await User.find_one(User.email == item["email"])
        if existing_user is None:
            user = User(
                role=UserRole.DOCTOR,
                name=item["name"],
                email=item["email"],
                password_hash=hash_password(item["password"]),
                status=UserStatus.ACTIVE,
            )
            await user.insert()
            logger.info(f"Created Doctor User: {item['name']} ({item['email']})")
        else:
            user = existing_user
            user.name = item["name"]
            user.status = UserStatus.ACTIVE
            await user.save()
            logger.info(f"Updated existing Doctor User: {item['name']}")

        # Standard Monday to Saturday working hours (days 0 to 5)
        hours = [
            WorkingHour(day_of_week=day, start_time=item["start_time"], end_time=item["end_time"])
            for day in range(6)
        ]

        profile = await DoctorProfile.find_one(DoctorProfile.user_id == user.id)
        if profile is None:
            profile = DoctorProfile(
                user_id=user.id,
                specialisation=item["specialisation"],
                working_hours=hours,
                slot_duration_minutes=30,
                leave_days=[],
            )
            await profile.insert()
            logger.info(f"Created DoctorProfile for {item['name']} -> {item['specialisation']}")
        else:
            profile.specialisation = item["specialisation"]
            profile.working_hours = hours
            await profile.save()
            logger.info(f"Updated DoctorProfile for {item['name']} -> {item['specialisation']}")

    logger.info("Successfully seeded 6 Indian Doctor Profiles into database!")


if __name__ == "__main__":
    asyncio.run(seed())

