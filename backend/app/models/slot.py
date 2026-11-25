"""AppointmentSlot ORM model."""

from datetime import date
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.appointment import Appointment
    from app.models.doctor import Doctor


class AppointmentSlot(Base):
    """Represents a bookable time slot for a doctor on a given date."""

    __tablename__ = "appointment_slots"
    __table_args__ = (
        UniqueConstraint("doctor_id", "appointment_date", "start_time", name="uq_doctor_date_start"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    doctor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    appointment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[str] = mapped_column(String(10), nullable=False)
    end_time: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="available", nullable=False, index=True)

    doctor: Mapped["Doctor"] = relationship("Doctor", back_populates="slots")
    appointment: Mapped[Optional["Appointment"]] = relationship(
        "Appointment", back_populates="slot", uselist=False
    )
