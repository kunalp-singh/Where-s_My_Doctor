from __future__ import annotations

from collections.abc import Callable

from beanie import PydanticObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from .models.enums import UserRole
from .services.security import decode_token

bearer_scheme = HTTPBearer(auto_error=True)


def get_current_token(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict[str, str]:
    try:
        return decode_token(credentials.credentials, expected_type="access")
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc


def require_roles(*allowed_roles: UserRole) -> Callable:
    def dependency(payload: dict[str, str] = Depends(get_current_token)) -> dict[str, str]:
        if payload.get("role") not in {role.value for role in allowed_roles}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return payload

    return dependency


def get_current_user_id(payload: dict[str, str] = Depends(get_current_token)) -> PydanticObjectId:
    return PydanticObjectId(payload["sub"])
