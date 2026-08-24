from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from ..models.enums import UserRole, UserStatus


class RegisterRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    name: str
    email: EmailStr
    password: str = Field(min_length=8)
    role: UserRole = Field(default=UserRole.PATIENT)
    specialisation: str | None = None


class LoginRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    email: EmailStr
    password: str


class TokenPair(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    access_token: str = Field(alias="accessToken")
    refresh_token: str = Field(alias="refreshToken")
    token_type: str = Field(default="bearer", alias="tokenType")
    expires_at: datetime = Field(alias="expiresAt")


class RefreshRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    refresh_token: str = Field(alias="refreshToken")


class PublicUser(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: UserRole
    status: UserStatus = Field(default=UserStatus.ACTIVE)
class AdminCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")
    name: str
    email: EmailStr
    password: str = Field(min_length=8)

