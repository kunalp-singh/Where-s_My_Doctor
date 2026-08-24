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

    def recipients(self) -> list[str]:
        if isinstance(self.to, str):
            return [self.to]
        return list(self.to)


async def send_email(message: EmailMessage, *, retries: int = 3, backoff_seconds: float = 1.0) -> bool:
    settings = get_settings()
    if not settings.resend_api_key:
        return False

    targets = message.recipients()
    if not targets:
        return False

    # Resend API Payload
    from_address = message.from_email or settings.resend_from_email or "onboarding@resend.dev"
    if message.from_name:
        from_address = f"{message.from_name} <{from_address}>"

    payload: dict[str, object] = {
        "from": from_address,
        "to": targets,
        "subject": message.subject,
        "text": message.body,
    }
    if message.html_body:
        payload["html"] = message.html_body
    if message.reply_to:
        payload["reply_to"] = message.reply_to
    if message.metadata:
        payload["tags"] = [{"name": k, "value": v} for k, v in message.metadata.items()]

    headers = {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "Content-Type": "application/json",
    }

    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers=headers,
                    json=payload,
                )
            if response.status_code in {200, 201, 202}:
                return True
            if response.status_code in {429, 500, 502, 503, 504} and attempt < retries - 1:
                await asyncio.sleep(backoff_seconds * (2**attempt))
                continue
            return False
        except httpx.HTTPError as exc:
            import logging
            logging.getLogger("appointment_care").warning(
                "Resend email delivery attempt %d failed: %s", attempt + 1, exc
            )
            if attempt < retries - 1:
                await asyncio.sleep(backoff_seconds * (2**attempt))
                continue
            return False
    return False
