from __future__ import annotations

from datetime import datetime
from typing import Annotated

from beanie import Document, PydanticObjectId
from pymongo import ASCENDING, IndexModel
from pydantic import ConfigDict, Field

from .common import utc_now


class GoogleCalendarCredential(Document):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    user_id: Annotated[PydanticObjectId, Field(alias="userId")]
    access_token_encrypted: str = Field(alias="accessTokenEncrypted")
    refresh_token_encrypted: str = Field(alias="refreshTokenEncrypted")
    token_expiry_at: datetime | None = Field(default=None, alias="tokenExpiryAt")
    scopes: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now, alias="createdAt")
    updated_at: datetime = Field(default_factory=utc_now, alias="updatedAt")

    class Settings:
        name = "google_calendar_credentials"
        indexes = [IndexModel([("userId", ASCENDING)], unique=True)]
