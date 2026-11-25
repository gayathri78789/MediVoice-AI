"""Pytest fixtures for isolated SQLite testing."""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# Ensure backend/ is importable
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app import database as db_module
from app.database import Base, get_db
from app.main import app
from app.services.seed_service import init_and_seed_database


@pytest.fixture()
def test_db_engine(tmp_path):
    db_file = tmp_path / "test_medivoice.db"
    url = f"sqlite:///{db_file.as_posix()}"
    eng = create_engine(url, connect_args={"check_same_thread": False, "timeout": 30})

    @event.listens_for(eng, "connect")
    def set_sqlite_pragma(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.execute("PRAGMA busy_timeout=5000;")
        cursor.close()

    Base.metadata.create_all(bind=eng)
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=eng)

    # Patch global engine & SessionLocal so voice tools using db_session_scope() also hit test DB
    orig_engine = db_module.engine
    orig_session_local = db_module.SessionLocal
    db_module.engine = eng
    db_module.SessionLocal = TestSessionLocal

    with TestSessionLocal() as session:
        # Ensure tables exist on test engine and seed mock data
        Base.metadata.create_all(bind=eng)
        from app.services import seed_service

        orig_seed_engine = seed_service.engine
        seed_service.engine = eng
        init_and_seed_database(session)
        seed_service.engine = orig_seed_engine

    yield eng, TestSessionLocal

    db_module.engine = orig_engine
    db_module.SessionLocal = orig_session_local
    eng.dispose()


@pytest.fixture()
def client(test_db_engine):
    _eng, TestSessionLocal = test_db_engine

    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
