import os

from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./slayer_dev.db")
SLAYER_ENV = os.getenv("SLAYER_ENV", "development").lower()

if SLAYER_ENV == "production" and DATABASE_URL.startswith("sqlite:///"):
    raise RuntimeError("production_requires_postgresql")

engine_kwargs = {
    "pool_pre_ping": True,
    "pool_recycle": 1800,
}
if DATABASE_URL.startswith("postgresql"):
    engine_kwargs.update({"pool_size": 2, "max_overflow": 0})

engine = create_engine(DATABASE_URL, **engine_kwargs)


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
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS wallets "
                "(user_id TEXT PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0, "
                "updated_at TEXT DEFAULT CURRENT_TIMESTAMP)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS store_purchases "
                "(purchase_token TEXT PRIMARY KEY, user_id TEXT NOT NULL, "
                "product_id TEXT NOT NULL, granted_units INTEGER NOT NULL DEFAULT 0, "
                "status TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, "
                "consumed_at TEXT)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS store_spends "
                "(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, item_id TEXT NOT NULL, "
                "token_cost INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
            )
        )
