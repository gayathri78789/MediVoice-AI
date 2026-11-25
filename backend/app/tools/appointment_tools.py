"""Backend-validated function-calling tool handlers for the Pipecat Gemini voice agent."""

from datetime import date
from typing import Any, Dict, Optional

from app.database import db_session_scope
from app.services.appointment_service import (
    AppointmentServiceError,
    book_appointment as svc_book_appointment,
    cancel_appointment as svc_cancel_appointment,
    get_appointments_by_phone,
)
from app.services.doctor_service import (
    find_doctors_by_name_or_speciality,
    get_doctor_slots,
)
from app.services.event_bus import event_bus
from app.services.phone_utils import format_phone_for_speech, normalize_phone


async def handle_check_doctor_availability(
    doctor_name: Optional[str] = None,
    speciality: Optional[str] = None,
    appointment_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Query SQLite for matching doctors and their actual available slots."""
    parsed_date: Optional[date] = None
    if appointment_date:
        try:
            parsed_date = date.fromisoformat(appointment_date.strip())
        except ValueError:
            return {
                "success": False,
                "error": f"Invalid date format '{appointment_date}'. Please use YYYY-MM-DD.",
            }
        if parsed_date < date.today():
            return {
                "success": False,
                "error": "Cannot check or book appointments for past dates. Please choose today or a future date.",
            }

    with db_session_scope() as db:
        doctors = find_doctors_by_name_or_speciality(
            db, doctor_name=doctor_name, speciality=speciality
        )
        if not doctors:
            all_docs = find_doctors_by_name_or_speciality(db)
            return {
                "success": False,
                "error": "No matching doctor or speciality was found.",
                "available_specialities": sorted({d.speciality for d in all_docs}),
                "doctors": [{"id": d.id, "name": d.name, "speciality": d.speciality} for d in all_docs],
            }

        results = []
        for doc in doctors:
            slots = get_doctor_slots(db, doc.id, target_date=parsed_date, only_available=True)
            results.append(
                {
                    "doctor_id": doc.id,
                    "doctor_name": doc.name,
                    "speciality": doc.speciality,
                    "consultation_fee": doc.consultation_fee,
                    "available_slots": [
                        {
                            "slot_id": s.id,
                            "date": s.appointment_date.isoformat(),
                            "start_time": s.start_time,
                            "end_time": s.end_time,
                        }
                        for s in slots[:12]
                    ],
                    "total_open_slots": len(slots),
                }
            )

    total_open = sum(r["total_open_slots"] for r in results)
    await event_bus.publish(
        "tool_called",
        {
            "tool_name": "check_doctor_availability",
            "summary": f"Checked availability ({doctor_name or speciality or 'all'}, {appointment_date or 'upcoming'}): {total_open} open slots found.",
        },
    )

    return {
        "success": True,
        "requested_date": parsed_date.isoformat() if parsed_date else None,
        "doctors": results,
        "has_availability": total_open > 0,
        "message": (
            f"Found {total_open} available slots."
            if total_open > 0
            else "No available slots were found for the requested doctor and date."
        ),
    }


async def handle_book_appointment(
    patient_name: str,
    patient_phone: str,
    doctor_id: int,
    appointment_date: str,
    appointment_time: str,
    patient_confirmed: bool = False,
) -> Dict[str, Any]:
    """Validate confirmations and book an appointment slot transactionally in SQLite."""
    if not patient_confirmed:
        return {
            "success": False,
            "requires_confirmation": True,
            "error": (
                "Booking requires explicit confirmation. Repeat the complete phone number digit-by-digit "
                "and the full appointment details, ask the patient to confirm, and only then call "
                "book_appointment with patient_confirmed=True."
            ),
        }

    try:
        parsed_date = date.fromisoformat(appointment_date.strip())
    except ValueError:
        return {
            "success": False,
            "error": f"Invalid appointment_date '{appointment_date}'. Expected YYYY-MM-DD.",
        }

    clean_time = appointment_time.strip()
    if len(clean_time) == 4 and ":" in clean_time:
        # Normalize '9:00' -> '09:00'
        clean_time = f"0{clean_time}"

    try:
        with db_session_scope() as db:
            appt = svc_book_appointment(
                db=db,
                patient_name=patient_name,
                patient_phone=patient_phone,
                doctor_id=int(doctor_id),
                appointment_date=parsed_date,
                appointment_time=clean_time,
                patient_confirmed=True,
            )
    except AppointmentServiceError as exc:
        await event_bus.publish(
            "tool_called",
            {
                "tool_name": "book_appointment",
                "summary": f"Booking rejected: {exc.message}",
            },
        )
        return {"success": False, "error": exc.message}

    appt_dict = appt.model_dump(mode="json")
    await event_bus.publish(
        "tool_called",
        {
            "tool_name": "book_appointment",
            "summary": f"Booked appointment #{appt.id} for {appt.patient_name} with {appt.doctor_name} on {appt.appointment_date} at {appt.appointment_time}.",
        },
    )
    await event_bus.publish(
        "appointment_booked",
        {
            "appointment": appt_dict,
            "message": f"Voice booking confirmed: #{appt.id} with {appt.doctor_name} on {appt.appointment_date} at {appt.appointment_time}.",
        },
    )

    return {
        "success": True,
        "appointment": appt_dict,
        "message": (
            f"Appointment #{appt.id} is confirmed for {appt.patient_name} with {appt.doctor_name} "
            f"({appt.doctor_speciality}) on {appt.appointment_date} at {appt.appointment_time}."
        ),
    }


async def handle_cancel_appointment(
    patient_phone: str,
    appointment_id: Optional[int] = None,
    patient_confirmed: bool = False,
) -> Dict[str, Any]:
    """Lookup appointments by spoken phone number or cancel a confirmed appointment ID."""
    try:
        normalized = normalize_phone(patient_phone)
    except ValueError as exc:
        return {"success": False, "error": str(exc)}

    with db_session_scope() as db:
        # Lookup mode when appointment_id is missing or final cancellation isn't confirmed yet
        if appointment_id is None or not patient_confirmed:
            try:
                matches = get_appointments_by_phone(db, normalized, status="confirmed")
            except AppointmentServiceError as exc:
                return {"success": False, "error": exc.message}

            await event_bus.publish(
                "tool_called",
                {
                    "tool_name": "cancel_appointment",
                    "summary": f"Looked up confirmed appointments for verified phone ending in {normalized[-4:]}: {len(matches)} found.",
                },
            )

            if not matches:
                return {
                    "success": False,
                    "appointments": [],
                    "message": "No active confirmed appointments were found for that phone number.",
                }

            return {
                "success": True,
                "action": "lookup_only",
                "spoken_digits": format_phone_for_speech(normalized),
                "appointments": [m.model_dump(mode="json") for m in matches],
                "message": (
                    f"Found {len(matches)} confirmed appointment(s). Ask the caller to confirm which "
                    "appointment they want cancelled, then call cancel_appointment again with "
                    "appointment_id and patient_confirmed=True."
                ),
            }

        try:
            cancelled = svc_cancel_appointment(
                db=db,
                patient_phone=normalized,
                appointment_id=int(appointment_id),
                patient_confirmed=True,
            )
        except AppointmentServiceError as exc:
            await event_bus.publish(
                "tool_called",
                {
                    "tool_name": "cancel_appointment",
                    "summary": f"Cancellation rejected: {exc.message}",
                },
            )
            return {"success": False, "error": exc.message}

    cancelled_dict = cancelled.model_dump(mode="json")
    await event_bus.publish(
        "tool_called",
        {
            "tool_name": "cancel_appointment",
            "summary": f"Cancelled appointment #{cancelled.id} with {cancelled.doctor_name} and released slot.",
        },
    )
    await event_bus.publish(
        "appointment_cancelled",
        {
            "appointment": cancelled_dict,
            "message": f"Voice cancellation completed: #{cancelled.id} with {cancelled.doctor_name} on {cancelled.appointment_date} at {cancelled.appointment_time}.",
        },
    )

    return {
        "success": True,
        "action": "cancelled",
        "appointment": cancelled_dict,
        "message": (
            f"Appointment #{cancelled.id} with {cancelled.doctor_name} on "
            f"{cancelled.appointment_date} at {cancelled.appointment_time} has been cancelled and the slot released."
        ),
    }
