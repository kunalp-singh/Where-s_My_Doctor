from __future__ import annotations

import logging
import os

import resend

logger = logging.getLogger(__name__)


async def send_appointment_confirmation(email: str, subject: str, html_body: str) -> None:
    """Send an appointment confirmation email via Resend.

    Failures are logged but intentionally NOT re-raised so the booking
    flow is never blocked by an email delivery issue.
    """
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        logger.warning("RESEND_API_KEY not configured – skipping confirmation email")
        return

    resend.api_key = api_key

    params: resend.Emails.SendParams = {
        "from": "Appointment Care <no-reply@appointmentcare.com>",
        "to": [email],
        "subject": subject,
        "html": html_body,
    }

    try:
        await resend.Emails.send_async(params)
        logger.info("Confirmation email sent to %s", email)
    except Exception as exc:
        logger.error("Failed to send confirmation email to %s: %s", email, exc)
