"""Doctor ORM model."""

from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.appointment import Appointment
    from app.models.slot import AppointmentSlot


class Doctor(Base):
    """Represents a medical doctor available for appointments."""

    __tablename__ = "doctors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    speciality: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    qualification: Mapped[str] = mapped_column(String(160), nullable=False)
    experience: Mapped[int] = mapped_column(Integer, nullable=False)
    consultation_fee: Mapped[float] = mapped_column(Float, nullable=False)
    available_days: Mapped[str] = mapped_column(String(120), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    slots: Mapped[List["AppointmentSlot"]] = relationship(
        "AppointmentSlot",
        back_populates="doctor",
        cascade="all, delete-orphan",
    )
    appointments: Mapped[List["Appointment"]] = relationship(
        "Appointment",
        back_populates="doctor",
    )
