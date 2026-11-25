"""Doctor and availability REST endpoints."""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.doctor import DoctorAvailabilityOut, DoctorDetailOut, DoctorOut
from app.services.doctor_service import (
    DoctorNotFoundError,
    get_doctor_by_id,
    get_doctor_slots,
    list_doctors,
)

router = APIRouter(prefix="/api/doctors", tags=["Doctors"])


@router.get("", response_model=List[DoctorOut])
def api_list_doctors(
    speciality: Optional[str] = Query(default=None, description="Filter by medical speciality"),
    search: Optional[str] = Query(default=None, description="Search by doctor name or speciality"),
    db: Session = Depends(get_db),
) -> List[DoctorOut]:
    """List all active doctors along with their upcoming available slot count."""
    return list_doctors(db, speciality=speciality, search=search)


@router.get("/{doctor_id}", response_model=DoctorDetailOut)
def api_get_doctor(doctor_id: int, db: Session = Depends(get_db)) -> DoctorDetailOut:
    """Get full profile and upcoming slots for a single doctor."""
    try:
        doctor = get_doctor_by_id(db, doctor_id)
    except DoctorNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    slots = get_doctor_slots(db, doctor_id, only_available=False)
    available_count = sum(1 for s in slots if s.status == "available")

    return DoctorDetailOut(
        id=doctor.id,
        name=doctor.name,
        speciality=doctor.speciality,
        qualification=doctor.qualification,
        experience=doctor.experience,
        consultation_fee=doctor.consultation_fee,
        available_days=doctor.available_days,
        is_active=doctor.is_active,
        available_slots_count=available_count,
        slots=slots,
    )


@router.get("/{doctor_id}/availability", response_model=DoctorAvailabilityOut)
def api_get_doctor_availability(
    doctor_id: int,
    appointment_date: Optional[date] = Query(default=None, alias="date", description="Filter by YYYY-MM-DD"),
    db: Session = Depends(get_db),
) -> DoctorAvailabilityOut:
    """Get available appointment slots for a doctor, optionally filtered by date."""
    try:
        doctor = get_doctor_by_id(db, doctor_id)
    except DoctorNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    available_slots = get_doctor_slots(db, doctor_id, target_date=appointment_date, only_available=True)
    return DoctorAvailabilityOut(
        doctor_id=doctor.id,
        doctor_name=doctor.name,
        speciality=doctor.speciality,
        appointment_date=appointment_date,
        available_slots=available_slots,
    )
