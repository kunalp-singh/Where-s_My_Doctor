from __future__ import annotations

from fastapi import APIRouter, Depends

from ...deps import require_roles
from ...models.enums import UserRole
from ...schemas.admin import DoctorCreate, DoctorResponse, DoctorUpdate, LeaveDayRequest, LeaveDaySummary
from ...schemas.auth import AdminCreateRequest, PublicUser
from ...services.admin import approve_doctor, create_doctor, delete_doctor, get_doctor, list_doctors, mark_leave_date, reject_doctor, update_doctor, create_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/doctors", response_model=list[DoctorResponse])
async def list_admin_doctors(_payload: dict[str, str] = Depends(require_roles(UserRole.ADMIN))) -> list[DoctorResponse]:
    return await list_doctors()


@router.post("/doctors", response_model=DoctorResponse)
async def create_admin_doctor(payload: DoctorCreate, _payload: dict[str, str] = Depends(require_roles(UserRole.ADMIN))) -> DoctorResponse:
    return await create_doctor(payload)


@router.post("/doctors/{doctor_id}/approve", response_model=DoctorResponse)
async def approve_admin_doctor(doctor_id: str, _payload: dict[str, str] = Depends(require_roles(UserRole.ADMIN))) -> DoctorResponse:
    return await approve_doctor(doctor_id)


@router.post("/doctors/{doctor_id}/reject", response_model=DoctorResponse)
async def reject_admin_doctor(doctor_id: str, _payload: dict[str, str] = Depends(require_roles(UserRole.ADMIN))) -> DoctorResponse:
    return await reject_doctor(doctor_id)


@router.get("/doctors/{doctor_id}", response_model=DoctorResponse)
async def get_admin_doctor(doctor_id: str, _payload: dict[str, str] = Depends(require_roles(UserRole.ADMIN))) -> DoctorResponse:
    return await get_doctor(doctor_id)


@router.put("/doctors/{doctor_id}", response_model=DoctorResponse)
async def update_admin_doctor(doctor_id: str, payload: DoctorUpdate, _payload: dict[str, str] = Depends(require_roles(UserRole.ADMIN))) -> DoctorResponse:
    return await update_doctor(doctor_id, payload)


@router.delete("/doctors/{doctor_id}")
async def delete_admin_doctor(doctor_id: str, _payload: dict[str, str] = Depends(require_roles(UserRole.ADMIN))) -> dict[str, str]:
    await delete_doctor(doctor_id)
    return {"status": "deleted"}


@router.post("/doctors/{doctor_id}/leave-days", response_model=LeaveDaySummary)
async def add_doctor_leave_day(doctor_id: str, payload: LeaveDayRequest, _payload: dict[str, str] = Depends(require_roles(UserRole.ADMIN))) -> LeaveDaySummary:
    return await mark_leave_date(doctor_id, payload)
