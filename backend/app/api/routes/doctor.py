from __future__ import annotations

from fastapi import APIRouter, Depends

from ...deps import get_current_user_id, require_roles
from ...models.enums import UserRole
from ...schemas.doctor import (
    DoctorAppointmentItem,
    DoctorCompleteProfileRequest,
    DoctorNotesResponse,
    DoctorScheduleResponse,
    DoctorScheduleUpdate,
    DoctorVisitSummary,
)
from ...services.doctor import (
    get_doctor_schedule,
    get_visit_detail,
    list_doctor_appointments,
    submit_visit_notes,
    update_doctor_schedule,
    complete_doctor_profile,
)

router = APIRouter(prefix="/doctors", tags=["doctor"])


@router.get("/schedule", response_model=DoctorScheduleResponse)
async def doctor_schedule(
    doctor_id: str = Depends(get_current_user_id),
    _payload: dict[str, str] = Depends(require_roles(UserRole.DOCTOR)),
) -> DoctorScheduleResponse:
    return await get_doctor_schedule(str(doctor_id))


@router.put("/schedule", response_model=DoctorScheduleResponse)
async def update_schedule(
    payload: DoctorScheduleUpdate,
    doctor_id: str = Depends(get_current_user_id),
    _payload: dict[str, str] = Depends(require_roles(UserRole.DOCTOR)),
) -> DoctorScheduleResponse:
    return await update_doctor_schedule(str(doctor_id), payload)


@router.get("/appointments", response_model=list[DoctorAppointmentItem])
async def doctor_appointments(
    doctor_id: str = Depends(get_current_user_id),
    _payload: dict[str, str] = Depends(require_roles(UserRole.DOCTOR)),
) -> list[DoctorAppointmentItem]:
    return await list_doctor_appointments(str(doctor_id))


@router.get("/appointments/{appointment_id}", response_model=DoctorNotesResponse)
async def appointment_detail(
    appointment_id: str,
    doctor_id: str = Depends(get_current_user_id),
    _payload: dict[str, str] = Depends(require_roles(UserRole.DOCTOR)),
) -> DoctorNotesResponse:
    return await get_visit_detail(str(doctor_id), appointment_id)


@router.post("/appointments/{appointment_id}/notes", response_model=DoctorNotesResponse)
async def visit_notes(
    appointment_id: str,
    payload: DoctorVisitSummary,
    doctor_id: str = Depends(get_current_user_id),
    _payload: dict[str, str] = Depends(require_roles(UserRole.DOCTOR)),
) -> DoctorNotesResponse:
    return await submit_visit_notes(str(doctor_id), appointment_id, payload)


@router.post("/complete-profile", response_model=DoctorScheduleResponse)
async def complete_profile(
    payload: DoctorCompleteProfileRequest,
    doctor_id: str = Depends(get_current_user_id),
    _payload: dict[str, str] = Depends(require_roles(UserRole.DOCTOR)),
) -> DoctorScheduleResponse:
    return await complete_doctor_profile(str(doctor_id), payload)
