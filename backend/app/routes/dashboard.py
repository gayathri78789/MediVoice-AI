"""Dashboard statistics, health check, and WebSocket event endpoints."""

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.schemas.appointment import DashboardStatsOut, HealthOut
from app.services.appointment_service import get_dashboard_stats
from app.services.event_bus import event_bus

router = APIRouter(tags=["Dashboard & Health"])


@router.get("/api/dashboard/stats", response_model=DashboardStatsOut)
def api_dashboard_stats(db: Session = Depends(get_db)) -> DashboardStatsOut:
    """Aggregate live metrics, upcoming appointments, 7-day trends, and recent activity."""
    recent = event_bus.get_recent_events(limit=25)
    stats = get_dashboard_stats(db, recent_activity=recent)
    return DashboardStatsOut(**stats)


@router.get("/api/health", response_model=HealthOut)
def api_health(db: Session = Depends(get_db)) -> HealthOut:
    """Verify database connectivity and voice pipeline credential availability."""
    settings = get_settings()
    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"error: {exc}"

    missing = []
    if not settings.has_elevenlabs_key:
        missing.append("ELEVENLABS_API_KEY")
    if not settings.has_gemini_key:
        missing.append("GEMINI_API_KEY")

    return HealthOut(
        status="ok" if db_status == "ok" else "degraded",
        database=db_status,
        voice_pipeline_ready=len(missing) == 0,
        missing_credentials=missing,
        gemini_model=settings.GEMINI_MODEL,
    )


@router.websocket("/ws/events")
async def websocket_events(websocket: WebSocket) -> None:
    """Real-time event stream for live call state, transcripts, and booking updates."""
    await event_bus.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle optional client pings
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        event_bus.disconnect(websocket)
    except Exception:
        event_bus.disconnect(websocket)


