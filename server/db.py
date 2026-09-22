import os

from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./slayer_dev.db")
SLAYER_ENV = os.getenv("SLAYER_ENV", "development").lower()

if SLAYER_ENV == "production" and DATABASE_URL.startswith("sqlite:///"):
    raise RuntimeError("production_requires_postgresql")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def health_db() -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))


def init_schema() -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS users "
                "(id TEXT PRIMARY KEY, email TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS matches "
                "(id TEXT PRIMARY KEY, home_score INTEGER NOT NULL, "
                "away_score INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
            )
        )
