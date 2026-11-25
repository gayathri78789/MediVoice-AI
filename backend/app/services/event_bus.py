"""Real-time event hub for synchronizing voice pipeline events and dashboard updates."""

from collections import deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List, Set

from fastapi import WebSocket


class EventBus:
    """Manages active WebSocket subscribers and recent activity history."""

    def __init__(self, max_history: int = 50) -> None:
        self._connections: Set[WebSocket] = set()
        self._recent_events: Deque[Dict[str, Any]] = deque(maxlen=max_history)

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)
        # Send recent activity snapshot on initial connection
        await websocket.send_json(
            {
                "type": "history",
                "events": list(self._recent_events),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def publish(self, event_type: str, payload: Dict[str, Any], record_activity: bool = True) -> None:
        """Broadcast an event to all connected frontend clients."""
        event = {
            "type": event_type,
            "payload": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if record_activity:
            self._recent_events.appendleft(event)

        stale: List[WebSocket] = []
        for ws in list(self._connections):
            try:
                await ws.send_json(event)
            except Exception:
                stale.append(ws)

        for ws in stale:
            self._connections.discard(ws)

    def get_recent_events(self, limit: int = 20) -> List[Dict[str, Any]]:
        return list(self._recent_events)[:limit]


event_bus = EventBus()
