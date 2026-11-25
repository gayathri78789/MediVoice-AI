"""Database initialization and fictional mock data seeding."""

from datetime import date, datetime, timedelta, timezone
from typing import List, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import Base, engine
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.slot import AppointmentSlot


MOCK_DOCTORS = [
    {
        "name": "Dr. Elena Vance",
        "speciality": "Cardiology",
        "qualification": "MD, FACC (Johns Hopkins)",
        "experience": 14,
        "consultation_fee": 180.0,
        "available_days": "Mon, Tue, Wed, Thu, Fri, Sat, Sun",
        "is_active": True,
    },
    {
        "name": "Dr. Marcus Sterling",
        "speciality": "Dermatology",
        "qualification": "MD, FAAD (Stanford Medicine)",
        "experience": 10,
        "consultation_fee": 140.0,
        "available_days": "Mon, Tue, Wed, Thu, Fri, Sat, Sun",
        "is_active": True,
    },
    {
        "name": "Dr. Priya Nair",
        "speciality": "Neurology",
        "qualification": "MD, PhD (Mayo Clinic)",
        "experience": 16,
        "consultation_fee": 210.0,
        "available_days": "Mon, Tue, Wed, Thu, Fri, Sat, Sun",
        "is_active": True,
    },
    {
        "name": "Dr. Liam O'Connor",
        "speciality": "Orthopedics",
        "qualification": "MD, FAAOS (Hospital for Special Surgery)",
        "experience": 12,
        "consultation_fee": 165.0,
        "available_days": "Mon, Tue, Wed, Thu, Fri, Sat, Sun",
        "is_active": True,
    },
    {
        "name": "Dr. Sofia Alvarez",
        "speciality": "Pediatrics",
        "qualification": "MD, FAAP (Boston Children's)",
        "experience": 9,
        "consultation_fee": 125.0,
        "available_days": "Mon, Tue, Wed, Thu, Fri, Sat, Sun",
        "is_active": True,
    },
    {
        "name": "Dr. Daniel Kim",
        "speciality": "General Medicine",
        "qualification": "MD, FACP (UCSF Medical Center)",
        "experience": 11,
        "consultation_fee": 110.0,
        "available_days": "Mon, Tue, Wed, Thu, Fri, Sat, Sun",
        "is_active": True,
    },
]

DAILY_TIME_SLOTS: List[Tuple[str, str]] = [
    ("09:00", "09:30"),
    ("10:00", "10:30"),
    ("11:30", "12:00"),
    ("14:00", "14:30"),
    ("15:30", "16:00"),
    ("17:00", "17:30"),
]


def init_and_seed_database(db: Session) -> None:
    """Create tables if needed and populate realistic fictional mock data if empty."""
    Base.metadata.create_all(bind=engine)

    existing_count = db.scalar(select(func.count(Doctor.id))) or 0
    if existing_count > 0:
        return

    doctors: List[Doctor] = []
    for doc_data in MOCK_DOCTORS:
        doc = Doctor(**doc_data)
        db.add(doc)
        doctors.append(doc)
    db.flush()

    today = date.today()
    created_slots: List[AppointmentSlot] = []
    for day_offset in range(7):
        slot_date = today + timedelta(days=day_offset)
        for doc in doctors:
            for start_t, end_t in DAILY_TIME_SLOTS:
                slot = AppointmentSlot(
                    doctor_id=doc.id,
                    appointment_date=slot_date,
                    start_time=start_t,
                    end_time=end_t,
                    status="available",
                )
                db.add(slot)
                created_slots.append(slot)
    db.flush()

    # Seed a few realistic pre-booked appointments (marked fictional test numbers)
    seed_bookings = [
        (doctors[0].id, today, "10:00", "Ava Thompson", "5550101001"),
        (doctors[1].id, today, "14:00", "Noah Patel", "5550102002"),
        (doctors[2].id, today + timedelta(days=1), "09:00", "Maya Lin", "5550103003"),
        (doctors[3].id, today + timedelta(days=1), "15:30", "Ethan Brooks", "5550104004"),
        (doctors[4].id, today + timedelta(days=2), "11:30", "Chloe Rivera", "5550101001"),
    ]

    now = datetime.now(timezone.utc)
    for doc_id, appt_date, start_t, patient_name, phone in seed_bookings:
        matching_slot = next(
            (
                s
                for s in created_slots
                if s.doctor_id == doc_id
                and s.appointment_date == appt_date
                and s.start_time == start_t
            ),
            None,
        )
        if matching_slot:
            matching_slot.status = "booked"
            appt = Appointment(
                patient_name=patient_name,
                patient_phone=phone,
                doctor_id=doc_id,
                slot_id=matching_slot.id,
                appointment_date=appt_date,
                appointment_time=start_t,
                status="confirmed",
                created_at=now,
                updated_at=now,
            )
            db.add(appt)

    db.commit()
