import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.main as main_module
from app.database import Base, get_db
from app.main import app
from app.seed import seed_inbox

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=test_engine)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def client(db_session):
    # main.lifespan() reads the `engine`/`SessionLocal` module globals directly
    # (not via get_db), so dependency_overrides alone wouldn't stop it from
    # touching the real listly.db file — patch the module globals too.
    main_module.engine = test_engine
    main_module.SessionLocal = TestSessionLocal
    app.dependency_overrides[get_db] = override_get_db
    seed_inbox(db_session)

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
