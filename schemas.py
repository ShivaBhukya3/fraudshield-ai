from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class TransactionInput(BaseModel):
    amount: float = Field(..., gt=0, description="Transaction amount in USD")
    merchant: str = Field(..., min_length=1, max_length=256)
    category: str = Field(..., description="Merchant category")
    location: str = Field(default="Unknown")
    card_type: str = Field(default="credit")
    hour_of_day: int = Field(..., ge=0, le=23)
    day_of_week: int = Field(..., ge=0, le=6)
    is_online: bool = Field(default=False)
    distance_from_home: float = Field(default=0.0, ge=0)
    transaction_id: Optional[str] = None


class FraudPrediction(BaseModel):
    transaction_id: str
    fraud_score: float
    is_fraud: bool
    confidence: float
    risk_level: str
    risk_factors: List[str]
    recommendation: str
    processing_time_ms: float


class TransactionResponse(BaseModel):
    id: int
    transaction_id: str
    amount: float
    merchant: str
    category: str
    location: str
    card_type: str
    hour_of_day: int
    day_of_week: int
    is_online: bool
    distance_from_home: float
    fraud_score: float
    is_fraud: bool
    is_flagged: bool
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class AlertResponse(BaseModel):
    id: int
    transaction_id: str
    alert_type: str
    severity: str
    message: str
    is_resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AnalyticsResponse(BaseModel):
    total_transactions: int
    total_fraud: int
    fraud_rate: float
    total_amount: float
    fraud_amount: float
    avg_fraud_score: float
    transactions_by_category: Dict[str, Any]
    fraud_by_hour: List[Dict[str, Any]]
    recent_trend: List[Dict[str, Any]]


class ModelMetricsResponse(BaseModel):
    model_version: str
    precision: float
    recall: float
    f1_score: float
    roc_auc: float
    threshold: float
    trained_at: datetime


class BatchTransactionInput(BaseModel):
    transactions: List[TransactionInput]
