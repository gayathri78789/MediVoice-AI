"""Comprehensive QA tests for MediVoice AI backend, database, tools, and voice pipeline."""

from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import pytest

from app.services.phone_utils import mask_phone, normalize_phone
from app.tools.appointment_tools import (
    handle_book_appointment,
    handle_cancel_appointment,
    handle_check_doctor_availability,
)


def test_seed_and_doctor_listing(client):
    res = client.get("/api/doctors")
    assert res.status_code == 200
    doctors = res.json()
    assert len(doctors) >= 6
    specialities = {d["speciality"] for d in doctors}
    assert {"Cardiology", "Dermatology", "Neurology", "Orthopedics", "Pediatrics", "General Medicine"} <= specialities
    assert all(d["available_slots_count"] > 0 for d in doctors)


def test_doctor_detail_and_availability(client):
    doctors = client.get("/api/doctors").json()
    cardio = next(d for d in doctors if d["speciality"] == "Cardiology")

    detail_res = client.get(f"/api/doctors/{cardio['id']}")
    assert detail_res.status_code == 200
    assert len(detail_res.json()["slots"]) > 0

    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    avail_res = client.get(f"/api/doctors/{cardio['id']}/availability?date={tomorrow}")
    assert avail_res.status_code == 200
    avail_data = avail_res.json()
    assert avail_data["doctor_id"] == cardio["id"]
    assert len(avail_data["available_slots"]) >= 1
    assert all(s["status"] == "available" for s in avail_data["available_slots"])


def test_phone_normalization_and_masking():
    assert normalize_phone("(555) 234-5678") == "5552345678"
    assert normalize_phone("five five five zero one zero two zero zero two") == "5550102002"
    assert mask_phone("5552345678") == "(***) ***-5678"

    with pytest.raises(ValueError):
        normalize_phone("12345")
    with pytest.raises(ValueError):
        normalize_phone("0000000000")


def test_booking_duplicate_prevention_and_cancellation_release(client):
    doctors = client.get("/api/doctors").json()
    doc_id = doctors[0]["id"]
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    avail = client.get(f"/api/doctors/{doc_id}/availability?date={tomorrow}").json()
    slot_time = avail["available_slots"][0]["start_time"]

    # Book appointment
    book_payload = {
        "patient_name": "Jordan Mercer",
        "patient_phone": "(555) 777-8899",
        "doctor_id": doc_id,
        "appointment_date": tomorrow,
        "appointment_time": slot_time,
        "patient_confirmed": True,
    }
    book_res = client.post("/api/appointments/book", json=book_payload)
    assert book_res.status_code == 201
    appt = book_res.json()
    assert appt["status"] == "confirmed"
    assert appt["masked_phone"] == "(***) ***-8899"

    # Attempt duplicate booking on same slot -> 409 Conflict
    dup_res = client.post("/api/appointments/book", json=book_payload)
    assert dup_res.status_code == 409

    # Attempt cancellation with wrong phone number -> 404 (never disclose)
    wrong_cancel = client.post(
        "/api/appointments/cancel",
        json={"patient_phone": "5559990000", "appointment_id": appt["id"], "patient_confirmed": True},
    )
    assert wrong_cancel.status_code == 404

    # Cancel with matching normalized phone -> 200 and releases slot
    cancel_res = client.post(
        "/api/appointments/cancel",
        json={"patient_phone": "5557778899", "appointment_id": appt["id"], "patient_confirmed": True},
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"

    # Slot must now be available again
    avail_after = client.get(f"/api/doctors/{doc_id}/availability?date={tomorrow}").json()
    assert any(s["start_time"] == slot_time for s in avail_after["available_slots"])

    # And can be booked again cleanly
    rebook_res = client.post("/api/appointments/book", json=book_payload)
    assert rebook_res.status_code == 201


def test_past_date_and_invalid_phone_rejected(client):
    doctors = client.get("/api/doctors").json()
    doc_id = doctors[0]["id"]
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    past_res = client.post(
        "/api/appointments/book",
        json={
            "patient_name": "Alex Rivera",
            "patient_phone": "5551112222",
            "doctor_id": doc_id,
            "appointment_date": yesterday,
            "appointment_time": "09:00",
            "patient_confirmed": True,
        },
    )
    assert past_res.status_code == 400
    assert "past" in past_res.json()["detail"].lower()

    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    bad_phone_res = client.post(
        "/api/appointments/book",
        json={
            "patient_name": "Alex Rivera",
            "patient_phone": "12345",
            "doctor_id": doc_id,
            "appointment_date": tomorrow,
            "appointment_time": "09:00",
            "patient_confirmed": True,
        },
    )
    assert bad_phone_res.status_code in (400, 422)


def test_multiple_appointments_same_phone(client):
    res = client.get("/api/appointments/phone/5550101001")
    assert res.status_code == 200
    appts = res.json()
    assert len(appts) >= 2


def test_concurrent_booking_race_condition_prevented(test_db_engine):
    _eng, TestSessionLocal = test_db_engine
    from app.services.appointment_service import AppointmentServiceError, book_appointment
    from app.services.doctor_service import get_doctor_slots, list_doctors

    with TestSessionLocal() as db:
        doc = list_doctors(db)[0]
        target_date = date.today() + timedelta(days=3)
        slot = get_doctor_slots(db, doc.id, target_date=target_date)[0]

    def attempt_book(idx: int) -> str:
        with TestSessionLocal() as s:
            try:
                book_appointment(
                    db=s,
                    patient_name=f"Concurrent Patient {idx}",
                    patient_phone=f"555888000{idx}",
                    doctor_id=doc.id,
                    appointment_date=target_date,
                    appointment_time=slot.start_time,
                    patient_confirmed=True,
                )
                return "success"
            except AppointmentServiceError as exc:
                return f"rejected:{exc.status_code}"

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(attempt_book, [1, 2]))

    assert results.count("success") == 1
    assert sum(1 for r in results if r.startswith("rejected:")) == 1


@pytest.mark.asyncio
async def test_voice_function_calling_tools_end_to_end(client):
    tomorrow = (date.today() + timedelta(days=2)).isoformat()

    # 1. check_doctor_availability
    avail = await handle_check_doctor_availability(
        speciality="Cardiology", appointment_date=tomorrow
    )
    assert avail["success"] is True
    assert avail["has_availability"] is True
    doc = avail["doctors"][0]
    chosen_slot = doc["available_slots"][0]

    # 2. book_appointment refuses without confirmation
    unconfirmed = await handle_book_appointment(
        patient_name="Samira Vance",
        patient_phone="5553334444",
        doctor_id=doc["doctor_id"],
        appointment_date=chosen_slot["date"],
        appointment_time=chosen_slot["start_time"],
        patient_confirmed=False,
    )
    assert unconfirmed["success"] is False
    assert unconfirmed.get("requires_confirmation") is True

    # 3. book_appointment succeeds once confirmed
    booked = await handle_book_appointment(
        patient_name="Samira Vance",
        patient_phone="5553334444",
        doctor_id=doc["doctor_id"],
        appointment_date=chosen_slot["date"],
        appointment_time=chosen_slot["start_time"],
        patient_confirmed=True,
    )
    assert booked["success"] is True
    appt_id = booked["appointment"]["id"]

    # 4. cancel_appointment lookup-only mode works before confirmation
    lookup = await handle_cancel_appointment(patient_phone="555-333-4444")
    assert lookup["success"] is True
    assert lookup["action"] == "lookup_only"
    assert any(a["id"] == appt_id for a in lookup["appointments"])

    # 5. cancel_appointment cancels and releases slot once confirmed
    cancelled = await handle_cancel_appointment(
        patient_phone="5553334444",
        appointment_id=appt_id,
        patient_confirmed=True,
    )
    assert cancelled["success"] is True
    assert cancelled["action"] == "cancelled"


def test_dashboard_stats_health_and_pipecat_imports(client):
    stats = client.get("/api/dashboard/stats")
    assert stats.status_code == 200
    body = stats.json()
    assert body["total_doctors"] >= 6
    assert body["available_slots"] > 0
    assert len(body["trends"]) == 7

    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["database"] == "ok"

    voice_status = client.get("/api/voice/status")
    assert voice_status.status_code == 200

    # Verify Pipecat pipeline & tool schemas load cleanly without deprecation issues
    from pipecat.audio.vad.silero import SileroVADAnalyzer
    from app.voice.pipeline import build_appointment_tools

    tools = build_appointment_tools()
    tool_names = [t.name for t in tools.standard_tools]
    assert tool_names == [
        "check_doctor_availability",
        "book_appointment",
        "cancel_appointment",
    ]
    assert SileroVADAnalyzer is not None
