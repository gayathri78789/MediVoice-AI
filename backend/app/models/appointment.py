"""Appointment ORM model."""

from datetime import date, datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.doctor import Doctor
    from app.models.slot import AppointmentSlot


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Appointment(Base):
    """Represents a booked or cancelled patient appointment."""

    __tablename__ = "appointments"
    __table_args__ = (
        Index(
            "uq_active_doctor_date_time",
            "doctor_id",
            "appointment_date",
            "appointment_time",
            unique=True,
            sqlite_where=text("status = 'confirmed'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    patient_name: Mapped[str] = mapped_column(String(120), nullable=False)
    patient_phone: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    doctor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("doctors.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    slot_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("appointment_slots.id", ondelete="SET NULL"), nullable=True
    )
    appointment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    appointment_time: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="confirmed", nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    doctor: Mapped["Doctor"] = relationship("Doctor", back_populates="appointments")
    slot: Mapped[Optional["AppointmentSlot"]] = relationship(
        "AppointmentSlot", back_populates="appointment"
    )
