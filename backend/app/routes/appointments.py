"""Appointment REST endpoints."""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.appointment import (
    AppointmentBookRequest,
    AppointmentCancelRequest,
    AppointmentOut,
)
from app.services.appointment_service import (
    AppointmentServiceError,
    book_appointment,
    cancel_appointment,
    get_appointments_by_phone,
    list_appointments,
)
from app.services.event_bus import event_bus

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])


@router.get("", response_model=List[AppointmentOut])
def api_list_appointments(
    status: Optional[str] = Query(default=None, description="Filter by status: confirmed, cancelled, all"),
    doctor_id: Optional[int] = Query(default=None, description="Filter by doctor ID"),
    appointment_date: Optional[date] = Query(default=None, alias="date", description="Filter by date"),
    search: Optional[str] = Query(default=None, description="Search by patient or doctor name"),
    db: Session = Depends(get_db),
) -> List[AppointmentOut]:
    """List appointments stored in SQLite with privacy-masked phone numbers."""
    return list_appointments(
        db,
        status=status,
        doctor_id=doctor_id,
        target_date=appointment_date,
        search=search,
    )


@router.get("/phone/{phone_number}", response_model=List[AppointmentOut])
def api_get_appointments_by_phone(
    phone_number: str,
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> List[AppointmentOut]:
    """Retrieve appointments belonging to a normalized phone number."""
    try:
        return get_appointments_by_phone(db, phone_number, status=status)
    except AppointmentServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/book", response_model=AppointmentOut, status_code=201)
async def api_book_appointment(
    payload: AppointmentBookRequest,
    db: Session = Depends(get_db),
) -> AppointmentOut:
    """Book an available slot transactionally."""
    try:
        appt = book_appointment(
            db=db,
            patient_name=payload.patient_name,
            patient_phone=payload.patient_phone,
            doctor_id=payload.doctor_id,
            appointment_date=payload.appointment_date,
            appointment_time=payload.appointment_time,
            patient_confirmed=payload.patient_confirmed,
        )
    except AppointmentServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    await event_bus.publish(
        "appointment_booked",
        {
            "appointment": appt.model_dump(mode="json"),
            "message": f"Appointment #{appt.id} booked with {appt.doctor_name} on {appt.appointment_date} at {appt.appointment_time}.",
        },
    )
    return appt


@router.post("/cancel", response_model=AppointmentOut)
async def api_cancel_appointment(
    payload: AppointmentCancelRequest,
    db: Session = Depends(get_db),
) -> AppointmentOut:
    """Cancel an appointment matching the patient's phone number and release its slot."""
    try:
        appt = cancel_appointment(
            db=db,
            patient_phone=payload.patient_phone,
            appointment_id=payload.appointment_id,
            patient_confirmed=payload.patient_confirmed,
        )
    except AppointmentServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    await event_bus.publish(
        "appointment_cancelled",
        {
            "appointment": appt.model_dump(mode="json"),
            "message": f"Appointment #{appt.id} with {appt.doctor_name} on {appt.appointment_date} at {appt.appointment_time} was cancelled.",
        },
    )
    return appt
