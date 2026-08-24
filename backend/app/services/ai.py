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


async def transcribe_audio_symptoms(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    settings = get_settings()
    if not settings.gemini_api_key:
        logger.warning("GEMINI_API_KEY is not set for audio transcription")
        return ""

    clean_mime = (mime_type or "audio/webm").split(";")[0].strip().lower()
    if clean_mime not in ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/mp3", "audio/m4a", "audio/aac"]:
        clean_mime = "audio/webm"

    client = genai.Client(api_key=settings.gemini_api_key)
    prompt = (
        "You are an expert medical intake speech-to-text transcriber. "
        "Listen to this patient audio recording and transcribe the patient's spoken symptoms verbatim into clear text. "
        "Return ONLY the transcribed text without any conversational intro, quotation marks, or meta explanations."
    )

    models_to_try = ["gemini-3.7-flash", "gemini-2.5-flash"]
    for model_name in models_to_try:
        try:
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(
                        data=audio_bytes,
                        mime_type=clean_mime,
                    ),
                    prompt,
                ],
            )

            text = (response.text or "").strip()
            if text.startswith('"') and text.endswith('"'):
                text = text[1:-1].strip()
            if text:
                return text
        except Exception as exc:
            logger.warning("Model %s transcription failed: %s", model_name, exc)

    return ""


async def build_pre_visit_summary(symptoms_text: str) -> dict[str, Any]:
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
            models_to_try = ["gemini-3.7-flash", "gemini-2.5-flash"]
            data = None
            for model_name in models_to_try:
                try:
                    response = await client.aio.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json"
                        ),
                    )
                    import json
                    data = json.loads(response.text)
                    break
                except Exception as m_err:
                    logger.warning("Pre-visit summary with %s failed: %s", model_name, m_err)

            if data:
                rec_spec = data.get("recommended_specialisation", "General Medicine")
                if rec_spec not in SPECIALISATIONS_LIST:
                    rec_spec = "General Medicine"

                urgency_val = str(data.get("urgency", "medium")).lower()
                chief_val = str(data.get("chief_complaint", cleaned[:160]))
                follow_ups_val = data.get(
                    "follow_up_questions",
                    [
                        "Can you describe the severity and duration of your symptoms?",
                        "Have you experienced similar issues previously?",
                        "Are there any aggravating or relieving factors?",
                    ],
                )[:3]
                return {
                    # snake_case (used internally by Python)
                    "urgency": urgency_val,
                    "chief_complaint": chief_val,
                    "follow_up_questions": follow_ups_val,
                    "recommended_specialisation": rec_spec,
                    # camelCase aliases (expected by frontend JSON)
                    "chiefComplaint": chief_val,
                    "followUpQuestions": follow_ups_val,
                    "recommendedSpecialisation": rec_spec,
                }
        except Exception as exc:
            logger.warning("Gemini API call failed; using fallback logic: %s", exc)

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
        # snake_case (internal Python usage)
        "urgency": urgency,
        "chief_complaint": cleaned[:160],
        "follow_up_questions": [
            "Can you describe the severity and duration of the main symptom?",
            "Have you had this problem before, and if so, how often?",
            "Are there other symptoms or triggers you think are related?",
        ],
        "recommended_specialisation": spec,
        # camelCase aliases (frontend JSON)
        "chiefComplaint": cleaned[:160],
        "followUpQuestions": [
            "Can you describe the severity and duration of the main symptom?",
            "Have you had this problem before, and if so, how often?",
            "Are there other symptoms or triggers you think are related?",
        ],
        "recommendedSpecialisation": spec,
    }


async def build_post_visit_summary(diagnosis: str, notes: str, prescriptions: list[Any]) -> dict[str, Any]:
    settings = get_settings()

    prescription_text_items = []
    for p in prescriptions or []:
        if isinstance(p, dict):
            m_name = p.get("medicationName") or p.get("medication_name", "")
            dos = p.get("dosage", "")
            freq = p.get("frequency", "")
            dur = p.get("durationDays") or p.get("duration_days") or 7
            prescription_text_items.append(f"- {m_name} ({dos}, {freq} for {dur} days)")
        else:
            m_name = getattr(p, "medication_name", None) or getattr(p, "medicationName", "")
            dos = getattr(p, "dosage", "")
            freq = getattr(p, "frequency", "")
            dur = getattr(p, "duration_days", None) or getattr(p, "durationDays", 7)
            prescription_text_items.append(f"- {m_name} ({dos}, {freq} for {dur} days)")

    rx_summary = "\n".join(prescription_text_items) if prescription_text_items else "No prescription recorded."

    clinical_input = (
        f"Diagnosis: {diagnosis or 'Routine consultation'}\n"
        f"Clinical Notes: {notes or 'No extra notes provided'}\n"
        f"Prescriptions:\n{rx_summary}"
    )

    if settings.gemini_api_key:
        try:
            client = genai.Client(api_key=settings.gemini_api_key)
            prompt = (
                "You are an empathetic medical assistant. Convert these clinical notes into a clear, patient-friendly summary "
                "with medication schedule and follow-up steps:\n\n"
                f"{clinical_input}\n\n"
                "Return ONLY a JSON object with these exact keys:\n"
                '- "summary": A clear, reassuring 2-3 sentence patient-friendly summary of the diagnosis and treatment plan.\n'
                '- "follow_up_steps": Array of 2-3 actionable advice steps for the patient.\n'
                '- "red_flags": Array of 2-3 warning symptoms where the patient should seek immediate medical care.'
            )

            models_to_try = ["gemini-3.7-flash", "gemini-2.5-flash"]
            data = None
            for model_name in models_to_try:
                try:
                    response = await client.aio.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(response_mime_type="application/json"),
                    )
                    import json
                    data = json.loads(response.text)
                    break
                except Exception as m_err:
                    logger.warning("Post-visit summary with %s failed: %s", model_name, m_err)

            if data:
                logger.info("Gemini post-visit AI summary generated successfully.")
                return {
                    "summary": str(data.get("summary", f"Visit completed. Diagnosis: {diagnosis or 'Routine Consultation'}.")),
                    "follow_up_steps": data.get("follow_up_steps", [
                        "Take prescribed medications exactly as directed.",
                        "Rest and maintain proper hydration.",
                        "Contact the clinic if symptoms worsen.",
                    ]),
                    "red_flags": data.get("red_flags", [
                        "High fever that does not respond to medication",
                        "Difficulty breathing or chest discomfort",
                        "Sudden severe pain or confusion",
                    ]),
                }
        except Exception as exc:
            logger.error("Gemini post-visit AI summary generation failed: %s", exc)

    # Deterministic fallback when Gemini API key is missing or fails
    return {
        "summary": f"Your consultation is complete. Diagnosis: {diagnosis or 'Routine Consultation'}. Please follow the prescribed care instructions below.",
        "follow_up_steps": [
            "Take prescribed medications as instructed.",
            "Maintain hydration and get adequate rest.",
            "Schedule a follow-up appointment if symptoms persist after completing medication.",
        ],
        "red_flags": [
            "Shortness of breath or chest pain",
            "Persistent high fever",
            "Sudden severe pain or allergic reaction",
        ],
    }

