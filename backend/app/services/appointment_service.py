"""Transactional appointment booking, cancellation, and query services."""

from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.slot import AppointmentSlot
from app.schemas.appointment import AppointmentOut, TrendPoint
from app.services.phone_utils import mask_phone, normalize_phone


class AppointmentServiceError(Exception):
    """Base domain error for appointment operations."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def to_appointment_out(appt: Appointment) -> AppointmentOut:
    """Convert an Appointment ORM row to a privacy-safe response schema."""
    return AppointmentOut(
        id=appt.id,
        patient_name=appt.patient_name,
        masked_phone=mask_phone(appt.patient_phone),
        doctor_id=appt.doctor_id,
        doctor_name=appt.doctor.name if appt.doctor else f"Doctor #{appt.doctor_id}",
        doctor_speciality=appt.doctor.speciality if appt.doctor else "General",
        slot_id=appt.slot_id,
        appointment_date=appt.appointment_date,
        appointment_time=appt.appointment_time,
        status=appt.status,
        created_at=appt.created_at,
        updated_at=appt.updated_at,
    )


def list_appointments(
    db: Session,
    status: Optional[str] = None,
    doctor_id: Optional[int] = None,
    target_date: Optional[date] = None,
    search: Optional[str] = None,
) -> List[AppointmentOut]:
    """List appointments with optional status, doctor, date, and search filters."""
    stmt = select(Appointment).options(joinedload(Appointment.doctor))

    if status and status.lower() != "all":
        stmt = stmt.where(Appointment.status == status.lower())
    if doctor_id is not None:
        stmt = stmt.where(Appointment.doctor_id == doctor_id)
    if target_date is not None:
        stmt = stmt.where(Appointment.appointment_date == target_date)
    if search:
        q = search.strip().lower()
        stmt = stmt.join(Appointment.doctor).where(
            func.lower(Appointment.patient_name).contains(q)
            | func.lower(Doctor.name).contains(q)
            | func.lower(Doctor.speciality).contains(q)
        )

    stmt = stmt.order_by(Appointment.appointment_date.asc(), Appointment.appointment_time.asc(), Appointment.id.desc())
    rows = list(db.scalars(stmt).unique().all())
    return [to_appointment_out(row) for row in rows]


def get_appointments_by_phone(
    db: Session,
    raw_phone: str,
    status: Optional[str] = None,
) -> List[AppointmentOut]:
    """Retrieve appointments belonging solely to the normalized phone number."""
    try:
        normalized = normalize_phone(raw_phone)
    except ValueError as exc:
        raise AppointmentServiceError(str(exc), status_code=400) from exc

    stmt = (
        select(Appointment)
        .options(joinedload(Appointment.doctor))
        .where(Appointment.patient_phone == normalized)
    )
    if status:
        stmt = stmt.where(Appointment.status == status.lower())
    stmt = stmt.order_by(Appointment.appointment_date.asc(), Appointment.appointment_time.asc())

    rows = list(db.scalars(stmt).unique().all())
    return [to_appointment_out(row) for row in rows]


def book_appointment(
    db: Session,
    patient_name: str,
    patient_phone: str,
    doctor_id: int,
    appointment_date: date,
    appointment_time: str,
    patient_confirmed: bool = True,
) -> AppointmentOut:
    """Book an available appointment slot inside a database transaction.

    Prevents past-date booking, double booking, and race conditions via an atomic
    conditional UPDATE on appointment_slots plus a partial unique index on appointments.
    """
    if not patient_confirmed:
        raise AppointmentServiceError(
            "Explicit patient confirmation is required before booking an appointment.",
            status_code=400,
        )

    clean_name = (patient_name or "").strip()
    if len(clean_name) < 2:
        raise AppointmentServiceError("Patient name must be at least 2 characters.", status_code=400)

    try:
        normalized_phone = normalize_phone(patient_phone)
    except ValueError as exc:
        raise AppointmentServiceError(str(exc), status_code=400) from exc

    if appointment_date < date.today():
        raise AppointmentServiceError(
            "Cannot book an appointment for a past date.",
            status_code=400,
        )

    clean_time = appointment_time.strip()

    try:
        doctor = db.get(Doctor, doctor_id)
        if not doctor or not doctor.is_active:
            raise AppointmentServiceError(f"Doctor with id {doctor_id} not found or inactive.", status_code=404)

        slot = db.scalar(
            select(AppointmentSlot).where(
                AppointmentSlot.doctor_id == doctor_id,
                AppointmentSlot.appointment_date == appointment_date,
                AppointmentSlot.start_time == clean_time,
            )
        )
        if not slot:
            raise AppointmentServiceError(
                f"No slot exists for {doctor.name} on {appointment_date.isoformat()} at {clean_time}.",
                status_code=404,
            )

        # Prevent duplicate booking by the same patient on the same doctor/date/time or overlapping slot
        existing_patient_dup = db.scalar(
            select(Appointment).where(
                Appointment.patient_phone == normalized_phone,
                Appointment.appointment_date == appointment_date,
                Appointment.appointment_time == clean_time,
                Appointment.status == "confirmed",
            )
        )
        if existing_patient_dup:
            raise AppointmentServiceError(
                "You already have a confirmed appointment at this date and time.",
                status_code=409,
            )

        # Atomic compare-and-swap slot claim prevents concurrent double-booking
        claim_result = db.execute(
            update(AppointmentSlot)
            .where(
                AppointmentSlot.id == slot.id,
                AppointmentSlot.status == "available",
            )
            .values(status="booked")
        )
        if claim_result.rowcount != 1:
            db.rollback()
            raise AppointmentServiceError(
                f"The {clean_time} slot on {appointment_date.isoformat()} with {doctor.name} is already booked.",
                status_code=409,
            )

        now = datetime.now(timezone.utc)
        appointment = Appointment(
            patient_name=clean_name,
            patient_phone=normalized_phone,
            doctor_id=doctor_id,
            slot_id=slot.id,
            appointment_date=appointment_date,
            appointment_time=clean_time,
            status="confirmed",
            created_at=now,
            updated_at=now,
        )
        db.add(appointment)
        db.commit()
        db.refresh(appointment)
        # Ensure doctor relationship is loaded
        _ = appointment.doctor
        return to_appointment_out(appointment)

    except IntegrityError as exc:
        db.rollback()
        raise AppointmentServiceError(
            "This slot was just booked by another caller. Please choose another available time.",
            status_code=409,
        ) from exc
    except AppointmentServiceError:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise AppointmentServiceError(f"Failed to book appointment: {exc}", status_code=500) from exc


def cancel_appointment(
    db: Session,
    patient_phone: str,
    appointment_id: int,
    patient_confirmed: bool = True,
) -> AppointmentOut:
    """Cancel an existing confirmed appointment and release its slot transactionally."""
    if not patient_confirmed:
        raise AppointmentServiceError(
            "Explicit patient confirmation is required before cancelling an appointment.",
            status_code=400,
        )

    try:
        normalized_phone = normalize_phone(patient_phone)
    except ValueError as exc:
        raise AppointmentServiceError(str(exc), status_code=400) from exc

    try:
        appointment = db.scalar(
            select(Appointment)
            .options(joinedload(Appointment.doctor))
            .where(Appointment.id == appointment_id)
        )
        if not appointment or appointment.patient_phone != normalized_phone:
            # Never disclose whether an appointment ID exists under a different phone number
            raise AppointmentServiceError(
                "No matching confirmed appointment was found for that phone number and appointment ID.",
                status_code=404,
            )

        if appointment.status == "cancelled":
            raise AppointmentServiceError(
                f"Appointment #{appointment_id} is already cancelled.",
                status_code=409,
            )

        appointment.status = "cancelled"
        appointment.updated_at = datetime.now(timezone.utc)

        # Release the associated slot
        if appointment.slot_id is not None:
            db.execute(
                update(AppointmentSlot)
                .where(AppointmentSlot.id == appointment.slot_id)
                .values(status="available")
            )
        else:
            db.execute(
                update(AppointmentSlot)
                .where(
                    AppointmentSlot.doctor_id == appointment.doctor_id,
                    AppointmentSlot.appointment_date == appointment.appointment_date,
                    AppointmentSlot.start_time == appointment.appointment_time,
                )
                .values(status="available")
            )

        db.commit()
        db.refresh(appointment)
        _ = appointment.doctor
        return to_appointment_out(appointment)

    except AppointmentServiceError:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise AppointmentServiceError(f"Failed to cancel appointment: {exc}", status_code=500) from exc


def get_dashboard_stats(db: Session, recent_activity: List[dict]) -> dict:
    """Compute live SQLite statistics, upcoming appointments, and 7-day trends."""
    today = date.today()

    total_doctors = db.scalar(select(func.count(Doctor.id)).where(Doctor.is_active.is_(True))) or 0
    today_appointments = (
        db.scalar(
            select(func.count(Appointment.id)).where(
                Appointment.appointment_date == today,
                Appointment.status == "confirmed",
            )
        )
        or 0
    )
    available_slots = (
        db.scalar(
            select(func.count(AppointmentSlot.id)).where(
                AppointmentSlot.status == "available",
                AppointmentSlot.appointment_date >= today,
            )
        )
        or 0
    )
    confirmed_appointments = (
        db.scalar(select(func.count(Appointment.id)).where(Appointment.status == "confirmed")) or 0
    )
    cancelled_appointments = (
        db.scalar(select(func.count(Appointment.id)).where(Appointment.status == "cancelled")) or 0
    )

    upcoming_rows = list(
        db.scalars(
            select(Appointment)
            .options(joinedload(Appointment.doctor))
            .where(
                Appointment.appointment_date >= today,
                Appointment.status == "confirmed",
            )
            .order_by(Appointment.appointment_date.asc(), Appointment.appointment_time.asc())
            .limit(8)
        )
        .unique()
        .all()
    )
    upcoming_appointments = [to_appointment_out(row) for row in upcoming_rows]

    trends: List[TrendPoint] = []
    for offset in range(7):
        d = today + timedelta(days=offset)
        conf_count = (
            db.scalar(
                select(func.count(Appointment.id)).where(
                    Appointment.appointment_date == d,
                    Appointment.status == "confirmed",
                )
            )
            or 0
        )
        canc_count = (
            db.scalar(
                select(func.count(Appointment.id)).where(
                    Appointment.appointment_date == d,
                    Appointment.status == "cancelled",
                )
            )
            or 0
        )
        avail_count = (
            db.scalar(
                select(func.count(AppointmentSlot.id)).where(
                    AppointmentSlot.appointment_date == d,
                    AppointmentSlot.status == "available",
                )
            )
            or 0
        )
        trends.append(
            TrendPoint(
                date=d.isoformat(),
                confirmed=conf_count,
                cancelled=canc_count,
                available=avail_count,
            )
        )

    return {
        "total_doctors": total_doctors,
        "today_appointments": today_appointments,
        "available_slots": available_slots,
        "confirmed_appointments": confirmed_appointments,
        "cancelled_appointments": cancelled_appointments,
        "upcoming_appointments": upcoming_appointments,
        "trends": trends,
        "recent_activity": recent_activity,
    }
