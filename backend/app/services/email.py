from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Sequence

import httpx

from ..config import get_settings


@dataclass(slots=True)
class EmailMessage:
    to: str | Sequence[str]
    subject: str
    body: str
    from_email: str | None = None
    from_name: str | None = None
    reply_to: str | None = None
    html_body: str | None = None
    metadata: dict[str, str] = field(default_factory=dict)

    def recipients(self) -> list[dict[str, str]]:
        targets = [self.to] if isinstance(self.to, str) else list(self.to)
        return [{"email": recipient} for recipient in targets]


async def send_email(message: EmailMessage, *, retries: int = 3, backoff_seconds: float = 1.0) -> bool:
    settings = get_settings()
    if not settings.sendgrid_api_key:
        return False

    payload: dict[str, object] = {
        "personalizations": [{"to": message.recipients(), "subject": message.subject}],
        "from": {"email": message.from_email or settings.sendgrid_from_email, "name": message.from_name or settings.sendgrid_from_name},
        "content": [{"type": "text/plain", "value": message.body}],
    }
    if message.html_body is not None:
        payload["content"] = [
            {"type": "text/plain", "value": message.body},
            {"type": "text/html", "value": message.html_body},
        ]
    if message.reply_to is not None:
        payload["reply_to"] = {"email": message.reply_to}
    if message.metadata:
        payload["custom_args"] = message.metadata

    headers = {"Authorization": f"Bearer {settings.sendgrid_api_key}", "Content-Type": "application/json"}
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post("https://api.sendgrid.com/v3/mail/send", headers=headers, json=payload)
            if response.status_code in {200, 201, 202}:
                return True
            if response.status_code in {429, 500, 502, 503, 504} and attempt < retries - 1:
                await asyncio.sleep(backoff_seconds * (2**attempt))
                continue
            return False
        except httpx.HTTPError:
            if attempt < retries - 1:
                await asyncio.sleep(backoff_seconds * (2**attempt))
                continue
            return False
    return False
