from __future__ import annotations

from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse

from ...config import get_settings
from ...deps import get_current_token
from ...schemas.auth import LoginRequest, PublicUser, RefreshRequest, RegisterRequest, TokenPair
from ...services.auth import authenticate_user, refresh_user_tokens, register_user
from ...services.google_signin import build_google_signin_url, handle_google_signin_callback

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenPair)
async def register(payload: RegisterRequest) -> TokenPair:
    access_token, refresh_token, expires_at, _ = await register_user(payload)
    return TokenPair(access_token=access_token, refresh_token=refresh_token, expires_at=expires_at)


@router.post("/login", response_model=TokenPair)
async def login(payload: LoginRequest) -> TokenPair:
    access_token, refresh_token, expires_at, _ = await authenticate_user(payload)
    return TokenPair(access_token=access_token, refresh_token=refresh_token, expires_at=expires_at)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest) -> TokenPair:
    access_token, refresh_token, expires_at, _ = await refresh_user_tokens(payload.refresh_token)
    return TokenPair(access_token=access_token, refresh_token=refresh_token, expires_at=expires_at)


@router.get("/me", response_model=PublicUser)
async def me(token: dict[str, str] = Depends(get_current_token)) -> PublicUser:
    from beanie import PydanticObjectId
    from fastapi import HTTPException, status
    from ...models.user import User

    user = await User.get(PydanticObjectId(token["sub"]))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return PublicUser(id=str(user.id), name=user.name, email=user.email, role=user.role, status=user.status)


@router.get("/google")
async def google_signin(role: str = Query(default="patient")) -> RedirectResponse:
    """Step 1: Redirect the browser to Google's consent screen."""
    if role not in ("patient", "doctor", "admin"):
        role = "patient"
    url = build_google_signin_url(role)
    return RedirectResponse(url=url)


@router.get("/google/callback")
async def google_signin_callback(
    code: str = Query(...),
    state: str = Query(...),
) -> RedirectResponse:
    """Step 2: Google redirects here. Issue our JWT and redirect to the frontend."""
    settings = get_settings()
    access_token, refresh_token, expires_at, user = await handle_google_signin_callback(code, state)

    params = urlencode(
        {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "role": user.role.value,
            "status": user.status.value,
        }
    )
    return RedirectResponse(url=f"{settings.frontend_url}/auth/callback?{params}")
