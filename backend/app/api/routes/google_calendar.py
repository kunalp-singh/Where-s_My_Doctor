from __future__ import annotations

from fastapi import APIRouter, Depends

from ...deps import get_current_user_id
from ...schemas.google_calendar import GoogleCalendarCallbackRequest, GoogleCalendarConnectResponse
from ...services.google_calendar import (
    build_authorization_url,
    exchange_code_for_tokens,
    store_google_calendar_tokens,
    verify_state_token,
)

router = APIRouter(prefix="/calendar/google", tags=["google-calendar"])


@router.post("/connect", response_model=GoogleCalendarConnectResponse)
async def connect(user_id: str = Depends(get_current_user_id)) -> GoogleCalendarConnectResponse:
    authorization_url, state_token = build_authorization_url(str(user_id))
    return GoogleCalendarConnectResponse(authorization_url=authorization_url, state_token=state_token)


@router.post("/callback")
async def callback(payload: GoogleCalendarCallbackRequest) -> dict[str, str]:
    user_id = verify_state_token(payload.state_token)
    token_payload = await exchange_code_for_tokens(payload.code)
    await store_google_calendar_tokens(user_id, token_payload)
    return {"status": "connected"}
