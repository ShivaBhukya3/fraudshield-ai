from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

_db_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./fraudshield.db")
# Railway provides postgresql:// — convert to asyncpg driver
if _db_url.startswith("postgresql://"):
    _db_url = _db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql+asyncpg://", 1)
DATABASE_URL = _db_url

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String(64), unique=True, index=True)
    amount = Column(Float, nullable=False)
    merchant = Column(String(256))
    category = Column(String(64))
    location = Column(String(128))
    card_type = Column(String(32))
    hour_of_day = Column(Integer)
    day_of_week = Column(Integer)
    is_online = Column(Boolean, default=False)
    distance_from_home = Column(Float, default=0.0)
    fraud_score = Column(Float, default=0.0)
    is_fraud = Column(Boolean, default=False)
    is_flagged = Column(Boolean, default=False)
    status = Column(String(32), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    features = Column(JSON, nullable=True)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String(64), index=True)
    alert_type = Column(String(64))
    severity = Column(String(32))
    message = Column(Text)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)


class ModelMetrics(Base):
    __tablename__ = "model_metrics"

    id = Column(Integer, primary_key=True, index=True)
    model_version = Column(String(32))
    precision = Column(Float)
    recall = Column(Float)
    f1_score = Column(Float)
    roc_auc = Column(Float)
    threshold = Column(Float)
    trained_at = Column(DateTime, default=datetime.utcnow)
    metrics_json = Column(JSON, nullable=True)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
