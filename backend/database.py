"""
Bank Kontrol Sistemi - Database Bağlantısı
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from models import Base
import os

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:postgres@localhost:5432/bank_kontrol"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Dependency for FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize tables"""
    Base.metadata.create_all(bind=engine)

def drop_tables():
    """Drop all tables (careful!)"""
    Base.metadata.drop_all(bind=engine)

if __name__ == "__main__":
    print("Database initialized...")
    init_db()
    print("Tables created successfully!")
