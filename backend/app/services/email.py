from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Sequence

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

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


def _send_smtp_email_sync(
    smtp_host: str,
    smtp_port: int,
    username: str,
    password: str,
    from_addr: str,
    to_addrs: list[str],
    subject: str,
    body: str,
    html_body: str | None = None,
) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = ", ".join(to_addrs)

    msg.attach(MIMEText(body, "plain", "utf-8"))
    if html_body:
        msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
        server.starttls()
        server.login(username, password)
        server.sendmail(from_addr, to_addrs, msg.as_string())


async def send_email(message: EmailMessage, *, retries: int = 3, backoff_seconds: float = 1.0) -> bool:
    settings = get_settings()
    if not settings.gmail_address or not settings.gmail_app_password:
        return False

    targets = message.recipients()
    if not targets:
        return False

    for attempt in range(retries):
        try:
            await asyncio.to_thread(
                _send_smtp_email_sync,
                smtp_host="smtp.gmail.com",
                smtp_port=587,
                username=settings.gmail_address,
                password=settings.gmail_app_password,
                from_addr=settings.gmail_address,
                to_addrs=targets,
                subject=message.subject,
                body=message.body,
                html_body=message.html_body,
            )
            return True
        except Exception as exc:
            import logging
            logging.getLogger("appointment_care").warning(
                "SMTP email delivery attempt %d failed: %s", attempt + 1, exc
            )
            if attempt < retries - 1:
                await asyncio.sleep(backoff_seconds * (2**attempt))
                continue
            return False
    return False
