"""Pipecat real-time voice pipeline using SmallWebRTC, Silero VAD, ElevenLabs STT/TTS, and Gemini."""

import logging
from typing import Dict

from pipecat.adapters.llm.schemas.function_schema import FunctionSchema
from pipecat.adapters.llm.schemas.tools_schema import ToolsSchema
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import (
    LLMFullResponseEndFrame,
    LLMRunFrame,
    TextFrame,
    TranscriptionFrame,
)
from pipecat.observers.base_observer import BaseObserver, FramePushed
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.elevenlabs.stt import ElevenLabsRealtimeSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.google.llm import GoogleLLMService
from pipecat.services.llm_service import FunctionCallParams
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport

from app.config import get_settings
from app.services.event_bus import event_bus
from app.tools.appointment_tools import (
    handle_book_appointment,
    handle_cancel_appointment,
    handle_check_doctor_availability,
)
from app.voice.prompts import build_medivoice_system_prompt

logger = logging.getLogger("medivoice.voice")


class TranscriptEventObserver(BaseObserver):
    """Forwards finalized user transcriptions and assistant responses to the dashboard WebSocket."""

    def __init__(self) -> None:
        super().__init__()
        self._seen_frames: set[int] = set()
        self._assistant_buffer: Dict[str, str] = {"text": ""}

    async def on_push_frame(self, data: FramePushed) -> None:
        frame = data.frame
        if frame.id in self._seen_frames:
            return

        if isinstance(frame, TranscriptionFrame) and frame.text.strip():
            self._seen_frames.add(frame.id)
            await event_bus.publish(
                "transcript",
                {"role": "user", "text": frame.text.strip(), "final": True},
                record_activity=False,
            )
        elif isinstance(frame, TextFrame) and isinstance(data.source, GoogleLLMService):
            self._seen_frames.add(frame.id)
            self._assistant_buffer["text"] += frame.text
        elif isinstance(frame, LLMFullResponseEndFrame):
            self._seen_frames.add(frame.id)
            full_text = self._assistant_buffer["text"].strip()
            self._assistant_buffer["text"] = ""
            if full_text:
                await event_bus.publish(
                    "transcript",
                    {"role": "assistant", "text": full_text, "final": True},
                    record_activity=False,
                )


def build_appointment_tools() -> ToolsSchema:
    """Create Pipecat FunctionSchema definitions for the three required appointment tools."""

    async def check_doctor_availability_handler(
        params: FunctionCallParams,
        doctor_name: str | None = None,
        speciality: str | None = None,
        appointment_date: str | None = None,
    ) -> None:
        result = await handle_check_doctor_availability(
            doctor_name=doctor_name,
            speciality=speciality,
            appointment_date=appointment_date,
        )
        await params.result_callback(result)

    async def book_appointment_handler(
        params: FunctionCallParams,
        patient_name: str,
        patient_phone: str,
        doctor_id: int,
        appointment_date: str,
        appointment_time: str,
        patient_confirmed: bool = False,
    ) -> None:
        result = await handle_book_appointment(
            patient_name=patient_name,
            patient_phone=patient_phone,
            doctor_id=doctor_id,
            appointment_date=appointment_date,
            appointment_time=appointment_time,
            patient_confirmed=patient_confirmed,
        )
        await params.result_callback(result)

    async def cancel_appointment_handler(
        params: FunctionCallParams,
        patient_phone: str,
        appointment_id: int | None = None,
        patient_confirmed: bool = False,
    ) -> None:
        result = await handle_cancel_appointment(
            patient_phone=patient_phone,
            appointment_id=appointment_id,
            patient_confirmed=patient_confirmed,
        )
        await params.result_callback(result)

    check_tool = FunctionSchema(
        name="check_doctor_availability",
        description=(
            "Check actual available doctor appointment slots in the hospital database. "
            "Filter by doctor_name or speciality and optional appointment_date (YYYY-MM-DD)."
        ),
        properties={
            "doctor_name": {
                "type": "string",
                "description": "Optional doctor full or partial name, e.g., 'Elena Vance'.",
            },
            "speciality": {
                "type": "string",
                "description": "Optional medical speciality, e.g., 'Cardiology', 'Dermatology'.",
            },
            "appointment_date": {
                "type": "string",
                "description": "Preferred appointment date in YYYY-MM-DD format.",
            },
        },
        required=[],
        handler=check_doctor_availability_handler,
    )

    book_tool = FunctionSchema(
        name="book_appointment",
        description=(
            "Book an available doctor appointment slot in SQLite. ONLY call with patient_confirmed=True "
            "after repeating the complete spoken phone number digit-by-digit and confirming all details."
        ),
        properties={
            "patient_name": {"type": "string", "description": "Patient full name."},
            "patient_phone": {
                "type": "string",
                "description": "Complete spoken phone number confirmed by the caller.",
            },
            "doctor_id": {"type": "integer", "description": "Numeric doctor ID from availability."},
            "appointment_date": {
                "type": "string",
                "description": "Appointment date in YYYY-MM-DD format.",
            },
            "appointment_time": {
                "type": "string",
                "description": "Appointment start time in HH:MM 24-hour format, e.g., '10:00'.",
            },
            "patient_confirmed": {
                "type": "boolean",
                "description": "True only after explicit caller confirmation of phone and slot.",
            },
        },
        required=[
            "patient_name",
            "patient_phone",
            "doctor_id",
            "appointment_date",
            "appointment_time",
            "patient_confirmed",
        ],
        handler=book_appointment_handler,
    )

    cancel_tool = FunctionSchema(
        name="cancel_appointment",
        description=(
            "Look up confirmed appointments for a verified phone number, or cancel a specific "
            "appointment and release its slot once the caller explicitly confirms."
        ),
        properties={
            "patient_phone": {
                "type": "string",
                "description": "Spoken phone number confirmed digit-by-digit by the caller.",
            },
            "appointment_id": {
                "type": "integer",
                "description": "Specific appointment ID to cancel. Omit during initial lookup.",
            },
            "patient_confirmed": {
                "type": "boolean",
                "description": "True only after caller explicitly confirms cancelling that appointment.",
            },
        },
        required=["patient_phone"],
        handler=cancel_appointment_handler,
    )

    return ToolsSchema(standard_tools=[check_tool, book_tool, cancel_tool])


async def run_voice_bot(webrtc_connection: SmallWebRTCConnection) -> None:
    """Run the Pipecat voice pipeline for a single WebRTC browser call."""
    settings = get_settings()

    if not settings.has_elevenlabs_key or not settings.has_gemini_key:
        await event_bus.publish(
            "call_error",
            {"message": "Voice pipeline cannot start: missing ELEVENLABS_API_KEY or GEMINI_API_KEY."},
        )
        return

    try:
        transport = SmallWebRTCTransport(
            webrtc_connection=webrtc_connection,
            params=TransportParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
            ),
        )

        stt = ElevenLabsRealtimeSTTService(
            api_key=settings.ELEVENLABS_API_KEY,
        )

        tts = ElevenLabsTTSService(
            api_key=settings.ELEVENLABS_API_KEY,
            voice_id=settings.ELEVENLABS_VOICE_ID or "21m00Tcm4TlvDq8ikWAM",
        )

        system_prompt = build_medivoice_system_prompt()
        llm = GoogleLLMService(
            api_key=settings.GEMINI_API_KEY,
            settings=GoogleLLMService.Settings(
                model=settings.GEMINI_MODEL or "gemini-2.5-flash",
                system_instruction=system_prompt,
            ),
        )

        tools = build_appointment_tools()
        # Register function handlers explicitly as well as bundled in FunctionSchema
        for schema in tools.standard_tools:
            if schema.handler:
                llm.register_function(schema.name, schema.handler)

        context = LLMContext(
            messages=[
                {
                    "role": "user",
                    "content": (
                        "A patient has just connected to the hospital reception line. "
                        "Greet them warmly as MediVoice Assistant and ask how you can help "
                        "with doctor availability, booking an appointment, or cancelling an appointment."
                    ),
                }
            ],
            tools=tools,
        )

        user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
            context,
            user_params=LLMUserAggregatorParams(
                vad_analyzer=SileroVADAnalyzer(),
            ),
        )

        pipeline = Pipeline(
            [
                transport.input(),
                stt,
                user_aggregator,
                llm,
                tts,
                transport.output(),
                assistant_aggregator,
            ]
        )

        task = PipelineTask(
            pipeline,
            params=PipelineParams(
                allow_interruptions=True,
                enable_metrics=True,
            ),
            observers=[TranscriptEventObserver()],
        )

        @transport.event_handler("on_client_connected")
        async def on_client_connected(_transport, _client):
            await event_bus.publish(
                "call_connected",
                {"message": "WebRTC voice session established with MediVoice Assistant."},
            )
            await task.queue_frames([LLMRunFrame()])

        @transport.event_handler("on_client_disconnected")
        async def on_client_disconnected(_transport, _client):
            await event_bus.publish(
                "call_ended",
                {"message": "Patient disconnected from the voice call."},
            )
            await task.cancel()

        runner = PipelineRunner(handle_sigint=False)
        await runner.run(task)

    except Exception as exc:
        logger.exception("Voice pipeline failed")
        await event_bus.publish(
            "call_error",
            {"message": f"Voice pipeline error: {exc}"},
        )
