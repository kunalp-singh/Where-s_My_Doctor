from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class GoogleCalendarConnectResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    authorization_url: str = Field(alias="authorizationUrl")
    state_token: str = Field(alias="stateToken")


class GoogleCalendarCallbackRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    code: str
    state_token: str = Field(alias="stateToken")
