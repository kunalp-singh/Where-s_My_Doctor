from __future__ import annotations

from beanie import PydanticObjectId
from fastapi import HTTPException, status

from ..models.appointment import Appointment
from ..models.embedded import LeaveDay
from ..models.enums import AppointmentStatus, NotificationType, UserRole, UserStatus
from ..models.user import DoctorProfile, User
from ..schemas.admin import DoctorCreate, DoctorResponse, DoctorUpdate, LeaveDayRequest, LeaveDaySummary
from ..schemas.auth import AdminCreateRequest, PublicUser
from ..services.security import hash_password
from .notifications import dispatch_appointment_notification
async def create_admin(payload: AdminCreateRequest) -> PublicUser:
    # Ensure email is unique
    existing = await User.find_one(User.email == payload.email)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User with this email already exists")
    # Create admin user
    user = User(
        name=payload.name,
        email=payload.email,
        role=UserRole.ADMIN,
        password_hash=hash_password(payload.password),
        status=UserStatus.ACTIVE,
    )
    await user.insert()
    return PublicUser(
        id=str(user.id),
        name=user.name,
        email=user.email,
        role=user.role,
        status=user.status,
    )



async def list_doctors() -> list[DoctorResponse]:
    users = await User.find(User.role == UserRole.DOCTOR).to_list()
    responses: list[DoctorResponse] = []
    for user in users:
        profile = await DoctorProfile.find_one(DoctorProfile.user_id == user.id)
        responses.append(_serialize_doctor(user, profile))
    return responses


async def get_doctor(doctor_id: str) -> DoctorResponse:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
    profile = await DoctorProfile.find_one(DoctorProfile.user_id == doctor.id)
    return _serialize_doctor(doctor, profile)


async def create_doctor(payload: DoctorCreate) -> DoctorResponse:
    existing_user = await User.find_one(User.email == payload.email)
    if existing_user is not None:
        if existing_user.role != UserRole.DOCTOR:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User account already exists for this email")
        existing_profile = await DoctorProfile.find_one(DoctorProfile.user_id == existing_user.id)
        if existing_profile is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Doctor profile already exists")
        user = existing_user
    else:
        user = User(name=payload.name, email=payload.email, role=UserRole.DOCTOR, password_hash=hash_password(payload.password))
        await user.insert()

    profile = DoctorProfile(
        user_id=user.id,
        specialisation=payload.specialisation,
        working_hours=payload.working_hours,
        slot_duration_minutes=payload.slot_duration_minutes,
        leave_days=payload.leave_days,
    )
    await profile.insert()
    return _serialize_doctor(user, profile)


async def update_doctor(doctor_id: str, payload: DoctorUpdate) -> DoctorResponse:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    if payload.name is not None:
        doctor.name = payload.name
    if payload.email is not None:
        doctor.email = payload.email
    if payload.password is not None:
        doctor.password_hash = hash_password(payload.password)
    await doctor.save()

    profile = await DoctorProfile.find_one(DoctorProfile.user_id == doctor.id)
    if profile is None:
        profile = DoctorProfile(user_id=doctor.id, specialisation="", working_hours=[], slot_duration_minutes=30, leave_days=[])
    if payload.specialisation is not None:
        profile.specialisation = payload.specialisation
    if payload.working_hours is not None:
        profile.working_hours = payload.working_hours
    if payload.slot_duration_minutes is not None:
        profile.slot_duration_minutes = payload.slot_duration_minutes
    if payload.leave_days is not None:
        profile.leave_days = payload.leave_days
    await profile.save()
    return _serialize_doctor(doctor, profile)


async def delete_doctor(doctor_id: str) -> None:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    profile = await DoctorProfile.find_one(DoctorProfile.user_id == doctor.id)
    if profile is not None:
        await profile.delete()
    await doctor.delete()


async def mark_leave_date(doctor_id: str, request: LeaveDayRequest) -> LeaveDaySummary:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    profile = await DoctorProfile.find_one(DoctorProfile.user_id == doctor.id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    if any(existing.day == request.day for existing in profile.leave_days):
        return LeaveDaySummary(doctor_id=str(doctor.id), date=request.day, affected_booking_count=0)

    profile.leave_days.append(LeaveDay(day=request.day))
    await profile.save()

    bookings = await Appointment.find(
        Appointment.doctor_id == doctor.id,
        Appointment.status == AppointmentStatus.BOOKED,
    ).to_list()
    affected = []
    for booking in bookings:
        if booking.slot_start.date() == request.day:
            booking.status = AppointmentStatus.CANCELLED
            await booking.save()
            affected.append(booking)

            # Remove Google Calendar events
            try:
                from .google_calendar import remove_google_calendar_event
                from ..models.calendar import GoogleCalendarCredential

                # For patient:
                cred_p = await GoogleCalendarCredential.find_one(GoogleCalendarCredential.user_id == booking.patient_id)
                if cred_p:
                    await remove_google_calendar_event(str(booking.patient_id), booking, owner="patient")

                # For doctor:
                cred_d = await GoogleCalendarCredential.find_one(GoogleCalendarCredential.user_id == booking.doctor_id)
                if cred_d:
                    await remove_google_calendar_event(str(booking.doctor_id), booking, owner="doctor")
            except Exception as g_err:
                logger.error("Google Calendar event deletion failed for leave day: %s", g_err)

            # Send cancellation emails to both patient and doctor
            try:
                patient = await User.get(booking.patient_id)
                if patient:
                    start_text = booking.slot_start.isoformat()
                    end_text = booking.slot_end.isoformat()

                    # Patient cancellation email
                    patient_cancel_text = (
                        f"Hello {patient.name},\n\n"
                        f"Your appointment with Dr. {doctor.name} scheduled for "
                        f"{start_text} to {end_text} has been cancelled because the doctor is on leave.\n\n"
                        "Please rebook through the portal."
                    )
                    patient_cancel_html = (
                        f"<p>Hello {patient.name},</p>"
                        f"<p>Your appointment with <strong>Dr. {doctor.name}</strong> scheduled for "
                        f"{start_text} to {end_text} has been <strong>cancelled</strong> because the doctor is on leave.</p>"
                        "<p>Please rebook through the portal.</p>"
                    )
                    
                    from .email import EmailMessage, send_email
                    await send_email(EmailMessage(
                        to=str(patient.email),
                        subject="Appointment Cancelled",
                        body=patient_cancel_text,
                        html_body=patient_cancel_html,
                    ))

                    # Doctor cancellation email
                    doctor_cancel_text = (
                        f"Hello Dr. {doctor.name},\n\n"
                        f"Your appointment with {patient.name} scheduled for "
                        f"{start_text} to {end_text} has been cancelled due to your leave configuration.\n"
                    )
                    doctor_cancel_html = (
                        f"<p>Hello Dr. {doctor.name},</p>"
                        f"<p>Your appointment with <strong>{patient.name}</strong> scheduled for "
                        f"{start_text} to {end_text} has been <strong>cancelled</strong> due to your leave configuration.</p>"
                    )
                    await send_email(EmailMessage(
                        to=str(doctor.email),
                        subject="Appointment Cancelled (Leave Day)",
                        body=doctor_cancel_text,
                        html_body=doctor_cancel_html,
                    ))
            except Exception as email_err:
                logger.error("Cancellation email notification failed for leave day: %s", email_err)

            await dispatch_appointment_notification(
                str(booking.id),
                NotificationType.CANCELLATION,
                subject="Appointment cancelled",
                body=(
                    f"Hello,\n\nYour appointment on {booking.slot_start.isoformat()} has been cancelled because Dr. "
                    f"{doctor.name} is unavailable on the selected day.\nPlease contact the clinic to reschedule."
                ),
            )
            await dispatch_appointment_notification(
                str(booking.id),
                NotificationType.LEAVE_CONFLICT,
                subject="Schedule update notice",
                body=(
                    f"Hello,\n\nYour appointment on {booking.slot_start.isoformat()} was affected by a leave-day update. "
                    "We have cancelled the booking and recommend rescheduling."
                ),
            )

    return LeaveDaySummary(doctor_id=str(doctor.id), date=request.day, affected_booking_count=len(affected))


async def approve_doctor(doctor_id: str) -> DoctorResponse:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
    doctor.status = UserStatus.ACTIVE
    await doctor.save()
    profile = await DoctorProfile.find_one(DoctorProfile.user_id == doctor.id)
    return _serialize_doctor(doctor, profile)


async def reject_doctor(doctor_id: str) -> DoctorResponse:
    doctor = await User.get(PydanticObjectId(doctor_id))
    if doctor is None or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
    doctor.status = UserStatus.REJECTED
    await doctor.save()
    profile = await DoctorProfile.find_one(DoctorProfile.user_id == doctor.id)
    return _serialize_doctor(doctor, profile)


def _serialize_doctor(user: User, profile: DoctorProfile | None) -> DoctorResponse:
    if profile is None:
        profile = DoctorProfile(user_id=user.id, specialisation="", working_hours=[], slot_duration_minutes=30, leave_days=[])
    return DoctorResponse(
        id=str(user.id),
        name=user.name,
        email=str(user.email),
        status=user.status,
        specialisation=profile.specialisation,
        working_hours=profile.working_hours,
        slot_duration_minutes=profile.slot_duration_minutes,
        leave_days=profile.leave_days,
    )
