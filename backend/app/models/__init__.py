"""ORM models package."""

from app.models.doctor import Doctor
from app.models.slot import AppointmentSlot
from app.models.appointment import Appointment

__all__ = ["Doctor", "AppointmentSlot", "Appointment"]
