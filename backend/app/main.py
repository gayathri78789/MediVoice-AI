"""MediVoice AI FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import db_session_scope
from app.routes.appointments import router as appointments_router
from app.routes.dashboard import router as dashboard_router
from app.routes.doctors import router as doctors_router
from app.routes.voice import router as voice_router
from app.routes.voice import small_webrtc_handler
from app.services.seed_service import init_and_seed_database


@asynccontextmanager
async def lifespan(_app: FastAPI):
    with db_session_scope() as db:
        init_and_seed_database(db)
    yield
    await small_webrtc_handler.close()


settings = get_settings()

app = FastAPI(
    title="MediVoice AI — Voice Doctor Appointment System",
    description=(
        "FastAPI + SQLite + Pipecat real-time voice appointment booking backend "
        "powered by ElevenLabs STT/TTS and Google Gemini function calling."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "MediVoice AI Backend is running!",
        "status": "success"
    }

app.include_router(doctors_router)
app.include_router(appointments_router)
app.include_router(dashboard_router)
app.include_router(voice_router)


from app.database import engine

@app.get("/db-check")
def db_check():
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql("SELECT 1")

        return {
            "status": "success",
            "database": "medivoice.db",
            "message": "Database connected successfully"
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
        
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"

load_dotenv(ENV_FILE, override=True)

print("ENV FILE EXISTS:", ENV_FILE.exists())
print(
    "ELEVENLABS KEY:",
    "Loaded" if os.getenv("ELEVENLABS_API_KEY") else "Missing"
)