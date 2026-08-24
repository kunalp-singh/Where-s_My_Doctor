from __future__ import annotations

from datetime import datetime, UTC

from beanie import PydanticObjectId
from fastapi import HTTPException, status

from ..models.enums import UserRole, UserStatus
from ..models.user import DoctorProfile, User
from ..schemas.auth import LoginRequest, RegisterRequest
from .security import create_token_pair, hash_password, verify_password


async def register_user(payload: RegisterRequest) -> tuple[str, str, datetime, User]:
    if payload.role == UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin accounts cannot be self-registered")
    existing = await User.find_one(User.email == payload.email)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    initial_status = UserStatus.PENDING_APPROVAL if payload.role == UserRole.DOCTOR else UserStatus.ACTIVE
    user = User(
        role=payload.role,
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        status=initial_status,
    )
    await user.insert()

    if payload.role == UserRole.DOCTOR:
        doctor_profile = DoctorProfile(
            user_id=user.id,
            specialisation=payload.specialisation or "General Medicine",
            slot_duration_minutes=30,
            working_hours=[],
            leave_days=[],
        )
        await doctor_profile.insert()

    access_token, refresh_token, expires_at = create_token_pair(str(user.id), user.role)
    return access_token, refresh_token, expires_at, user


async def authenticate_user(payload: LoginRequest) -> tuple[str, str, datetime, User]:
    user = await User.find_one(User.email == payload.email)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    access_token, refresh_token, expires_at = create_token_pair(str(user.id), user.role)
    return access_token, refresh_token, expires_at, user


async def refresh_user_tokens(refresh_token: str) -> tuple[str, str, datetime, User]:
    from .security import decode_token

    payload = decode_token(refresh_token, expected_type="refresh")
    user = await User.get(PydanticObjectId(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    access_token, new_refresh_token, expires_at = create_token_pair(str(user.id), user.role)
    return access_token, new_refresh_token, expires_at, user


def public_user(user: User) -> dict[str, str]:
    return {"id": str(user.id), "name": user.name, "email": str(user.email), "role": user.role.value}
