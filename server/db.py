import os
from sqlalchemy import create_engine, text
DATABASE_URL=os.getenv("DATABASE_URL","sqlite:///./slayer_dev.db")
engine=create_engine(DATABASE_URL,pool_pre_ping=True)
def health_db():
    with engine.connect() as c: c.execute(text("SELECT 1"))
def init_schema():
    with engine.begin() as c:
        c.execute(text("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"))
        c.execute(text("CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, home_score INTEGER NOT NULL, away_score INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"))
