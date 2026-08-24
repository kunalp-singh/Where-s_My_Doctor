from __future__ import annotations

import os
from resend import Resend
from fastapi import HTTPException, status


def get_resend_client() -> Resend:
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Resend API key not configured",
        )
    return Resend(api_key)


async def send_appointment_confirmation(email: str, subject: str, html_body: str) -> None:
    client = get_resend_client()
    try:
        await client.emails.send({
            "from": "Appointment Care <no-reply@appointmentcare.com>",
            "to": email,
            "subject": subject,
            "html": html_body,
        })
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send confirmation email",
        ) from exc

