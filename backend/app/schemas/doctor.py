"""Pydantic schemas for doctors and availability slots."""

from datetime import date
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class SlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    doctor_id: int
    appointment_date: date
    start_time: str
    end_time: str
    status: str


class DoctorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    speciality: str
    qualification: str
    experience: int
    consultation_fee: float
    available_days: str
    is_active: bool
    available_slots_count: int = 0


class DoctorDetailOut(DoctorOut):
    slots: List[SlotOut] = []


class DoctorAvailabilityOut(BaseModel):
    doctor_id: int
    doctor_name: str
    speciality: str
    appointment_date: Optional[date] = None
    available_slots: List[SlotOut]
