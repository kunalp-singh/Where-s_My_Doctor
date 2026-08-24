from __future__ import annotations

from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import httpx
from beanie import PydanticObjectId
from fastapi import HTTPException, status

from ..config import get_settings
from ..models.appointment import Appointment
from ..models.calendar import GoogleCalendarCredential
from .security import decrypt_secret, encrypt_secret

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_CALENDAR_EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars/primary/events"


def build_state_token(user_id: str) -> str:
    settings = get_settings()
    from jose import jwt

    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": user_id,
            "type": "google_calendar_state",
            "exp": int((now + timedelta(minutes=10)).timestamp()),
            "iat": int(now.timestamp()),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def verify_state_token(state_token: str) -> str:
    settings = get_settings()
    from jose import JWTError, jwt

    try:
        payload = jwt.decode(state_token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google OAuth state") from exc
    if payload.get("type") != "google_calendar_state":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google OAuth state")
    return payload["sub"]


def build_authorization_url(user_id: str) -> tuple[str, str]:
    settings = get_settings()
    state_token = build_state_token(user_id)
    query = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": "https://www.googleapis.com/auth/calendar",
            "access_type": "offline",
            "prompt": "consent",
            "state": state_token,
            "include_granted_scopes": "true",
        }
    )
    return f"{GOOGLE_AUTH_ENDPOINT}?{query}", state_token


async def exchange_code_for_tokens(code: str) -> dict[str, str]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            GOOGLE_TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Google token exchange failed")
    return response.json()


async def store_google_calendar_tokens(user_id: str, token_payload: dict[str, str]) -> GoogleCalendarCredential:
    token_expiry = token_payload.get("expires_in")
    expires_at = None
    if token_expiry is not None:
        expires_at = datetime.now(UTC) + timedelta(seconds=int(token_expiry))

    credential = await GoogleCalendarCredential.find_one(GoogleCalendarCredential.user_id == PydanticObjectId(user_id))
    encrypted_access_token = encrypt_secret(token_payload["access_token"])
    refresh_token = token_payload.get("refresh_token")
    if credential is None:
        if refresh_token is None:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Google did not return a refresh token")
        credential = GoogleCalendarCredential(
            user_id=user_id,
            access_token_encrypted=encrypted_access_token,
            refresh_token_encrypted=encrypt_secret(refresh_token),
            token_expiry_at=expires_at,
            scopes=token_payload.get("scope", "").split(),
        )
    else:
        credential.access_token_encrypted = encrypted_access_token
        if refresh_token is not None:
            credential.refresh_token_encrypted = encrypt_secret(refresh_token)
        credential.token_expiry_at = expires_at
        credential.scopes = token_payload.get("scope", "").split()
        credential.updated_at = datetime.now(UTC)
    await credential.save()
    return credential


async def get_decrypted_calendar_refresh_token(user_id: str) -> str:
    credential = await GoogleCalendarCredential.find_one(GoogleCalendarCredential.user_id == PydanticObjectId(user_id))
    if credential is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Google Calendar not linked")
    return decrypt_secret(credential.refresh_token_encrypted)


async def _get_valid_access_token(user_id: str) -> str:
    credential = await GoogleCalendarCredential.find_one(GoogleCalendarCredential.user_id == PydanticObjectId(user_id))
    if credential is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Google Calendar not linked")

    if credential.token_expiry_at is not None and credential.token_expiry_at > datetime.now(UTC) + timedelta(minutes=2):
        return decrypt_secret(credential.access_token_encrypted)

    settings = get_settings()
    refresh_token = decrypt_secret(credential.refresh_token_encrypted)
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            GOOGLE_TOKEN_ENDPOINT,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Google token refresh failed")

    token_payload = response.json()
    credential.access_token_encrypted = encrypt_secret(token_payload["access_token"])
    if token_payload.get("expires_in") is not None:
        credential.token_expiry_at = datetime.now(UTC) + timedelta(seconds=int(token_payload["expires_in"]))
    credential.updated_at = datetime.now(UTC)
    await credential.save()
    return token_payload["access_token"]


async def create_google_calendar_event(
    user_id: str,
    title: str,
    start: datetime,
    end: datetime,
    *,
    description: str | None = None,
    attendee_email: str | None = None,
    time_zone: str | None = None,
) -> str:
    access_token = await _get_valid_access_token(user_id)
    start_payload: dict[str, str] = {"dateTime": start.isoformat()}
    end_payload: dict[str, str] = {"dateTime": end.isoformat()}
    if time_zone:
        start_payload["timeZone"] = time_zone
        end_payload["timeZone"] = time_zone

    payload: dict[str, object] = {
        "summary": title,
        "description": description or "Appointment Care booking",
        "start": start_payload,
        "end": end_payload,
    }
    if attendee_email:
        payload["attendees"] = [{"email": attendee_email}]

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            GOOGLE_CALENDAR_EVENTS_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
            json=payload,
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Google Calendar event creation failed")
    data = response.json()
    return data["id"]


async def update_google_calendar_event(
    user_id: str,
    event_id: str,
    title: str,
    start: datetime,
    end: datetime,
    *,
    description: str | None = None,
    attendee_email: str | None = None,
    time_zone: str | None = None,
) -> str:
    access_token = await _get_valid_access_token(user_id)
    start_payload: dict[str, str] = {"dateTime": start.isoformat()}
    end_payload: dict[str, str] = {"dateTime": end.isoformat()}
    if time_zone:
        start_payload["timeZone"] = time_zone
        end_payload["timeZone"] = time_zone

    payload: dict[str, object] = {
        "summary": title,
        "description": description or "Appointment Care booking",
        "start": start_payload,
        "end": end_payload,
    }
    if attendee_email:
        payload["attendees"] = [{"email": attendee_email}]

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.put(
            f"{GOOGLE_CALENDAR_EVENTS_ENDPOINT}/{event_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            json=payload,
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Google Calendar event update failed")
    data = response.json()
    return data["id"]


async def delete_google_calendar_event(user_id: str, event_id: str) -> None:
    access_token = await _get_valid_access_token(user_id)
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.delete(
            f"{GOOGLE_CALENDAR_EVENTS_ENDPOINT}/{event_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if response.status_code not in {200, 204}:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Google Calendar event deletion failed")


async def attach_google_calendar_event(
    user_id: str,
    appointment: Appointment,
    *,
    owner: str,
    title: str,
    description: str | None = None,
    attendee_email: str | None = None,
    time_zone: str | None = None,
) -> str:
    event_id = await create_google_calendar_event(
        user_id,
        title,
        appointment.slot_start,
        appointment.slot_end,
        description=description,
        attendee_email=attendee_email,
        time_zone=time_zone or getattr(appointment, "time_zone", None),
    )
    if owner == "patient":
        appointment.google_calendar_event_id_patient = event_id
    elif owner == "doctor":
        appointment.google_calendar_event_id_doctor = event_id
    await appointment.save()
    return event_id


async def sync_google_calendar_event(
    user_id: str,
    appointment: Appointment,
    *,
    owner: str,
    title: str,
    description: str | None = None,
    attendee_email: str | None = None,
    time_zone: str | None = None,
) -> str:
    event_id = (
        appointment.google_calendar_event_id_patient
        if owner == "patient"
        else appointment.google_calendar_event_id_doctor
    )
    if event_id:
        return await update_google_calendar_event(
            user_id,
            event_id,
            title,
            appointment.slot_start,
            appointment.slot_end,
            description=description,
            attendee_email=attendee_email,
            time_zone=time_zone or getattr(appointment, "time_zone", None),
        )
    return await attach_google_calendar_event(
        user_id,
        appointment,
        owner=owner,
        title=title,
        description=description,
        attendee_email=attendee_email,
        time_zone=time_zone or getattr(appointment, "time_zone", None),
    )


async def remove_google_calendar_event(user_id: str, appointment: Appointment, *, owner: str) -> None:
    event_id = (
        appointment.google_calendar_event_id_patient
        if owner == "patient"
        else appointment.google_calendar_event_id_doctor
    )
    if not event_id:
        return
    await delete_google_calendar_event(user_id, event_id)
    if owner == "patient":
        appointment.google_calendar_event_id_patient = None
    elif owner == "doctor":
        appointment.google_calendar_event_id_doctor = None
    await appointment.save()
