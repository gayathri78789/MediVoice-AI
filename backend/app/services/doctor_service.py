"""Service layer for doctors and slot availability queries."""

from datetime import date
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.slot import AppointmentSlot
from app.schemas.doctor import DoctorOut, SlotOut


class DoctorNotFoundError(Exception):
    """Raised when a requested doctor cannot be found."""


def list_doctors(
    db: Session,
    speciality: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True,
) -> List[DoctorOut]:
    """List doctors with counts of upcoming available slots."""
    today = date.today()
    stmt = select(Doctor)
    if active_only:
        stmt = stmt.where(Doctor.is_active.is_(True))
    if speciality:
        stmt = stmt.where(func.lower(Doctor.speciality).contains(speciality.strip().lower()))
    if search:
        q = search.strip().lower()
        stmt = stmt.where(
            func.lower(Doctor.name).contains(q) | func.lower(Doctor.speciality).contains(q)
        )
    stmt = stmt.order_by(Doctor.id.asc())

    doctors = list(db.scalars(stmt).all())
    if not doctors:
        return []

    counts_stmt = (
        select(AppointmentSlot.doctor_id, func.count(AppointmentSlot.id))
        .where(
            AppointmentSlot.status == "available",
            AppointmentSlot.appointment_date >= today,
        )
        .group_by(AppointmentSlot.doctor_id)
    )
    counts = dict(db.execute(counts_stmt).all())

    return [
        DoctorOut(
            id=doc.id,
            name=doc.name,
            speciality=doc.speciality,
            qualification=doc.qualification,
            experience=doc.experience,
            consultation_fee=doc.consultation_fee,
            available_days=doc.available_days,
            is_active=doc.is_active,
            available_slots_count=counts.get(doc.id, 0),
        )
        for doc in doctors
    ]


def get_doctor_by_id(db: Session, doctor_id: int) -> Doctor:
    doctor = db.get(Doctor, doctor_id)
    if not doctor:
        raise DoctorNotFoundError(f"Doctor with id {doctor_id} was not found.")
    return doctor


def get_doctor_slots(
    db: Session,
    doctor_id: int,
    target_date: Optional[date] = None,
    only_available: bool = True,
) -> List[SlotOut]:
    """Retrieve appointment slots for a specific doctor, optionally filtered by date."""
    get_doctor_by_id(db, doctor_id)
    today = date.today()

    stmt = select(AppointmentSlot).where(
        AppointmentSlot.doctor_id == doctor_id,
        AppointmentSlot.appointment_date >= today,
    )
    if target_date is not None:
        stmt = stmt.where(AppointmentSlot.appointment_date == target_date)
    if only_available:
        stmt = stmt.where(AppointmentSlot.status == "available")

    stmt = stmt.order_by(AppointmentSlot.appointment_date.asc(), AppointmentSlot.start_time.asc())
    slots = list(db.scalars(stmt).all())
    return [SlotOut.model_validate(s) for s in slots]


def find_doctors_by_name_or_speciality(
    db: Session,
    doctor_name: Optional[str] = None,
    speciality: Optional[str] = None,
) -> List[Doctor]:
    """Fuzzy search active doctors by name and/or speciality for voice tool queries."""
    stmt = select(Doctor).where(Doctor.is_active.is_(True))
    doctors = list(db.scalars(stmt).all())

    if doctor_name:
        needle = doctor_name.strip().lower().replace("dr.", "").replace("dr ", "").strip()
        matched = [d for d in doctors if needle in d.name.lower()]
        if matched:
            doctors = matched
        elif not speciality:
            # Allow matching if user accidentally passed speciality in doctor_name
            spec_matched = [d for d in doctors if needle in d.speciality.lower()]
            doctors = spec_matched

    if speciality:
        spec_needle = speciality.strip().lower()
        doctors = [d for d in doctors if spec_needle in d.speciality.lower()]

    return doctors
