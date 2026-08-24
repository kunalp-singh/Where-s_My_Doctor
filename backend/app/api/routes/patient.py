from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends

from ...deps import get_current_user_id, require_roles
from ...models.enums import UserRole
from ...schemas.patient import (
    BookAppointmentRequest,
    BookAppointmentResponse,
    BookingSessionResponse,
    CreateBookingSessionRequest,
    DoctorSearchResult,
    DoctorSlot,
    PatientAppointmentResponse,
    SymptomSubmission,
    SymptomSummaryResponse,
    UpdateBookingSessionRequest,
)
from ...services.patient import (
    confirm_appointment_hold,
    create_appointment_hold,
    create_booking_session,
    get_booking_session,
    get_doctor_slots,
    list_patient_appointments,
    search_doctors,
    session_confirm_appointment,
    session_hold_appointment,
    submit_symptom_form,
    update_booking_session,
)

router = APIRouter(prefix="/patients", tags=["patient"])


@router.post("/booking-sessions", response_model=BookingSessionResponse)
async def start_booking_session(
    payload: CreateBookingSessionRequest,
    patient_id: str = Depends(get_current_user_id),
    _guard: dict[str, str] = Depends(require_roles(UserRole.PATIENT)),
) -> BookingSessionResponse:
    return await create_booking_session(str(patient_id), payload.symptoms_text)


@router.get("/booking-sessions/{session_id}", response_model=BookingSessionResponse)
async def fetch_booking_session(
    session_id: str,
    patient_id: str = Depends(get_current_user_id),
    _guard: dict[str, str] = Depends(require_roles(UserRole.PATIENT)),
) -> BookingSessionResponse:
    return await get_booking_session(str(patient_id), session_id)


@router.put("/booking-sessions/{session_id}", response_model=BookingSessionResponse)
async def modify_booking_session(
    session_id: str,
    payload: UpdateBookingSessionRequest,
    patient_id: str = Depends(get_current_user_id),
    _guard: dict[str, str] = Depends(require_roles(UserRole.PATIENT)),
) -> BookingSessionResponse:
    return await update_booking_session(str(patient_id), session_id, payload)


@router.post("/booking-sessions/{session_id}/hold", response_model=BookAppointmentResponse)
async def session_hold(
    session_id: str,
    payload: BookAppointmentRequest,
    patient_id: str = Depends(get_current_user_id),
    _guard: dict[str, str] = Depends(require_roles(UserRole.PATIENT)),
) -> BookAppointmentResponse:
    return await session_hold_appointment(str(patient_id), session_id, payload)


@router.post("/booking-sessions/{session_id}/confirm", response_model=PatientAppointmentResponse)
async def session_confirm(
    session_id: str,
    patient_id: str = Depends(get_current_user_id),
    _guard: dict[str, str] = Depends(require_roles(UserRole.PATIENT)),
) -> PatientAppointmentResponse:
    return await session_confirm_appointment(str(patient_id), session_id)


@router.get("/doctors", response_model=list[DoctorSearchResult])
async def list_patient_doctors(
    query: str | None = None,
    _payload: dict[str, str] = Depends(require_roles(UserRole.PATIENT)),
) -> list[DoctorSearchResult]:
    return await search_doctors(query)


@router.get("/doctors/{doctor_id}/slots", response_model=list[DoctorSlot])
async def doctor_slots(
    doctor_id: str,
    target_date: date | None = None,
    _payload: dict[str, str] = Depends(require_roles(UserRole.PATIENT)),
) -> list[DoctorSlot]:
    return await get_doctor_slots(doctor_id, target_date)


@router.post("/appointments/hold", response_model=BookAppointmentResponse)
async def hold_appointment(
    payload: BookAppointmentRequest,
    patient_id: str = Depends(get_current_user_id),
    _guard: dict[str, str] = Depends(require_roles(UserRole.PATIENT)),
) -> BookAppointmentResponse:
    return await create_appointment_hold(str(patient_id), payload)


@router.post("/appointments/{appointment_id}/confirm", response_model=PatientAppointmentResponse)
async def confirm_appointment(
    appointment_id: str,
    patient_id: str = Depends(get_current_user_id),
    _guard: dict[str, str] = Depends(require_roles(UserRole.PATIENT)),
) -> PatientAppointmentResponse:
    return await confirm_appointment_hold(str(patient_id), appointment_id)


@router.post("/appointments/{appointment_id}/symptoms", response_model=SymptomSummaryResponse)
async def symptom_summary(
    appointment_id: str,
    payload: SymptomSubmission,
    patient_id: str = Depends(get_current_user_id),
    _guard: dict[str, str] = Depends(require_roles(UserRole.PATIENT)),
) -> SymptomSummaryResponse:
    return await submit_symptom_form(str(patient_id), appointment_id, payload)


@router.get("/appointments", response_model=list[PatientAppointmentResponse])
async def appointments(
    patient_id: str = Depends(get_current_user_id),
    _guard: dict[str, str] = Depends(require_roles(UserRole.PATIENT)),
) -> list[PatientAppointmentResponse]:
    return await list_patient_appointments(str(patient_id))
