"""Pydantic schemas for appointments, dashboard stats, and health check."""

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AppointmentBookRequest(BaseModel):
    patient_name: str = Field(..., min_length=2, max_length=120)
    patient_phone: str = Field(..., min_length=7, max_length=30)
    doctor_id: int = Field(..., gt=0)
    appointment_date: date
    appointment_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    patient_confirmed: bool = Field(default=True)


class AppointmentCancelRequest(BaseModel):
    patient_phone: str = Field(..., min_length=7, max_length=30)
    appointment_id: int = Field(..., gt=0)
    patient_confirmed: bool = Field(default=True)


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_name: str
    masked_phone: str
    doctor_id: int
    doctor_name: str
    doctor_speciality: str
    slot_id: Optional[int] = None
    appointment_date: date
    appointment_time: str
    status: str
    created_at: datetime
    updated_at: datetime


class TrendPoint(BaseModel):
    date: str
    confirmed: int
    cancelled: int
    available: int


class DashboardStatsOut(BaseModel):
    total_doctors: int
    today_appointments: int
    available_slots: int
    confirmed_appointments: int
    cancelled_appointments: int
    upcoming_appointments: List[AppointmentOut]
    trends: List[TrendPoint]
    recent_activity: List[Dict[str, Any]]


class HealthOut(BaseModel):
    status: str
    database: str
    voice_pipeline_ready: bool
    missing_credentials: List[str]
    gemini_model: str
