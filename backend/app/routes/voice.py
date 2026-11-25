"""WebRTC signaling and voice pipeline status routes."""

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pipecat.transports.smallwebrtc.request_handler import (
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)

from app.config import get_settings
from app.services.event_bus import event_bus
from app.voice.pipeline import run_voice_bot

router = APIRouter(tags=["Voice WebRTC"])

small_webrtc_handler = SmallWebRTCRequestHandler()


@router.get("/api/voice/status")
def voice_pipeline_status() -> dict:
    """Report voice pipeline credential readiness without exposing secrets."""
    settings = get_settings()
    missing = []
    if not settings.has_elevenlabs_key:
        missing.append("ELEVENLABS_API_KEY")
    if not settings.has_gemini_key:
        missing.append("GEMINI_API_KEY")

    return {
        "ready": len(missing) == 0,
        "missing_credentials": missing,
        "gemini_model": settings.GEMINI_MODEL,
        "elevenlabs_voice_configured": bool(settings.ELEVENLABS_VOICE_ID),
        "transport": "Pipecat SmallWebRTCTransport",
        "vad": "SileroVADAnalyzer",
    }


@router.post("/api/offer")
async def webrtc_offer(
    request: SmallWebRTCRequest,
    background_tasks: BackgroundTasks,
):
    """Handle WebRTC SDP offer and launch the Pipecat voice pipeline."""
    settings = get_settings()
    if not settings.has_elevenlabs_key or not settings.has_gemini_key:
        missing = []
        if not settings.has_elevenlabs_key:
            missing.append("ELEVENLABS_API_KEY")
        if not settings.has_gemini_key:
            missing.append("GEMINI_API_KEY")
        msg = f"Voice pipeline unavailable: missing {', '.join(missing)} in backend environment."
        await event_bus.publish("call_error", {"message": msg})
        raise HTTPException(status_code=503, detail=msg)

    await event_bus.publish(
        "call_started",
        {"message": "Incoming WebRTC voice call initiated."},
    )

    async def webrtc_connection_callback(connection):
        background_tasks.add_task(run_voice_bot, connection)

    answer = await small_webrtc_handler.handle_web_request(
        request=request,
        webrtc_connection_callback=webrtc_connection_callback,
    )
    return answer


@router.patch("/api/offer")
async def webrtc_ice_patch(request: SmallWebRTCPatchRequest):
    """Handle trickle ICE candidate updates from the browser WebRTC peer."""
    await small_webrtc_handler.handle_patch_request(request)
    return {"status": "ok"}
