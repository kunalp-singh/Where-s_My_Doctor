"""Google OAuth2 Sign-In service.

Flow:
  1. GET /auth/google?role=patient|doctor|admin
     → Builds Google authorization URL with state JWT (encodes role)
     → Redirects browser to Google

  2. Google redirects back to GET /auth/google/callback?code=...&state=...
     → Verifies state JWT, extracts role
     → Exchanges code for Google tokens
     → Finds or creates the User in MongoDB
     → Issues our own access + refresh JWT pair
     → Redirects browser to frontend /auth/callback?access_token=...&refresh_token=...&role=...
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status

from ..config import get_settings
from ..models.enums import UserRole, UserStatus
from ..models.user import DoctorProfile, User
from .security import create_token_pair, hash_password

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo"


def build_google_signin_state(role: str) -> str:
    """Encode role into a short-lived JWT state token."""
    settings = get_settings()
    from jose import jwt

    now = datetime.now(UTC)
    return jwt.encode(
        {
            "role": role,
            "type": "google_signin_state",
            "exp": int((now + timedelta(minutes=10)).timestamp()),
            "iat": int(now.timestamp()),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def verify_google_signin_state(state_token: str) -> str:
    """Returns the role from the state JWT, raises 401 on tamper."""
    settings = get_settings()
    from jose import JWTError, jwt

    try:
        payload = jwt.decode(state_token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google state token") from exc
    if payload.get("type") != "google_signin_state":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google state token type")
    return payload["role"]


def build_google_signin_url(role: str) -> str:
    settings = get_settings()
    state = build_google_signin_state(role)
    params = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_auth_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "select_account",
            "state": state,
        }
    )
    return f"{GOOGLE_AUTH_ENDPOINT}?{params}"


async def exchange_google_code(code: str) -> dict:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            GOOGLE_TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_auth_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if resp.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google token exchange failed: {resp.text}",
        )
    return resp.json()


async def get_google_userinfo(access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            GOOGLE_USERINFO_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to fetch Google user info")
    return resp.json()


async def find_or_create_google_user(
    google_email: str,
    google_name: str,
    role_str: str,
) -> User:
    """Find existing user by email, or create a new one via Google Sign-In."""
    user = await User.find_one(User.email == google_email)

    if user is not None:
        return user

    try:
        role = UserRole(role_str)
    except ValueError:
        role = UserRole.PATIENT

    initial_status = UserStatus.PENDING_APPROVAL if role == UserRole.DOCTOR else UserStatus.ACTIVE

    import secrets
    random_password = secrets.token_urlsafe(32)

    user = User(
        role=role,
        name=google_name or google_email.split("@")[0],
        email=google_email,
        password_hash=hash_password(random_password),
        status=initial_status,
    )
    await user.insert()

    if role == UserRole.DOCTOR:
        await DoctorProfile(
            user_id=user.id,
            specialisation="General Medicine",
            slot_duration_minutes=30,
            working_hours=[],
            leave_days=[],
        ).insert()

    return user


async def handle_google_signin_callback(code: str, state: str) -> tuple[str, str, datetime, User]:
    role_str = verify_google_signin_state(state)
    token_data = await exchange_google_code(code)
    userinfo = await get_google_userinfo(token_data["access_token"])

    google_email = userinfo.get("email")
    google_name = userinfo.get("name", "")

    if not google_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google did not return an email address")

    user = await find_or_create_google_user(google_email, google_name, role_str)
    access_token, refresh_token, expires_at = create_token_pair(str(user.id), user.role)
    return access_token, refresh_token, expires_at, user

