from __future__ import annotations

import logging
from typing import Any
from google import genai
from google.genai import types

from ..config import get_settings

logger = logging.getLogger(__name__)

SPECIALISATIONS_LIST = [
    "General Medicine",
    "Cardiology",
    "Dermatology",
    "Pediatrics",
    "Neurology",
    "Orthopedics",
    "Psychiatry",
]


def build_pre_visit_summary(symptoms_text: str) -> dict[str, Any]:
    cleaned = (symptoms_text or "").strip()
    if not cleaned:
        return {
            "urgency": "low",
            "chief_complaint": "No symptoms provided.",
            "follow_up_questions": [
                "Can you describe when symptoms started?",
                "Have these symptoms changed in intensity?",
                "Are you currently taking any medications?",
            ],
            "recommended_specialisation": "General Medicine",
        }

    settings = get_settings()

    if settings.gemini_api_key:
        try:
            client = genai.Client(api_key=settings.gemini_api_key)
            prompt = f"""Analyse these patient symptoms and return a JSON object.

Symptoms:
"{cleaned}"

Medical specialisation list:
{SPECIALISATIONS_LIST}

Required JSON Keys:
- "urgency": "low", "medium", or "high"
- "chief_complaint": short summary of the main issue (max 160 characters)
- "follow_up_questions": array of exactly 3 relevant medical questions
- "recommended_specialisation": exactly one item chosen from the medical specialisation list that best fits the symptoms.
"""
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                ),
            )

            import json

            data = json.loads(response.text)
            rec_spec = data.get("recommended_specialisation", "General Medicine")
            if rec_spec not in SPECIALISATIONS_LIST:
                rec_spec = "General Medicine"

            return {
                "urgency": str(data.get("urgency", "medium")).lower(),
                "chief_complaint": str(data.get("chief_complaint", cleaned[:160])),
                "follow_up_questions": data.get(
                    "follow_up_questions",
                    [
                        "Can you describe the severity and duration of your symptoms?",
                        "Have you experienced similar issues previously?",
                        "Are there any aggravating or relieving factors?",
                    ],
                )[:3],
                "recommended_specialisation": rec_spec,
            }
        except Exception as exc:
            logger.warning("Gemini API call failed or timed out; using fallback logic: %s", exc)

    # Deterministic fallback (used ONLY on API failure/timeout or missing key)
    lowered = cleaned.lower()
    urgency = "low"
    spec = "General Medicine"

    if any(word in lowered for word in ["chest pain", "heart", "palpitations", "shortness of breath"]):
        urgency = "high"
        spec = "Cardiology"
    elif any(word in lowered for word in ["headache", "dizziness", "seizure", "numbness", "tingling"]):
        urgency = "medium"
        spec = "Neurology"
    elif any(word in lowered for word in ["rash", "skin", "itch", "acne", "mole", "eczema"]):
        urgency = "low"
        spec = "Dermatology"
    elif any(word in lowered for word in ["bone", "joint", "fracture", "knee", "back pain", "sprain"]):
        urgency = "medium"
        spec = "Orthopedics"
    elif any(word in lowered for word in ["child", "baby", "pediatric", "infant"]):
        urgency = "medium"
        spec = "Pediatrics"
    elif any(word in lowered for word in ["anxiety", "depression", "panic", "mood", "stress", "sleep"]):
        urgency = "medium"
        spec = "Psychiatry"
    elif any(word in lowered for word in ["severe bleeding", "fainting", "unconscious", "stroke"]):
        urgency = "high"

    return {
        "urgency": urgency,
        "chief_complaint": cleaned[:160],
        "follow_up_questions": [
            "Can you describe the severity and duration of the main symptom?",
            "Have you had this problem before, and if so, how often?",
            "Are there other symptoms or triggers you think are related?",
        ],
        "recommended_specialisation": spec,
    }
