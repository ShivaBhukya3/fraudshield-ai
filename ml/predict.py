"""
Real-time fraud scoring engine.
"""
import joblib
import numpy as np
import pandas as pd
import os
from typing import Dict, Any, List, Tuple

MODEL_PATH = os.path.join(os.path.dirname(__file__), "fraud_model.pkl")
METRICS_PATH = os.path.join(os.path.dirname(__file__), "model_metrics.pkl")

_model = None
_metrics = None


def load_model():
    global _model, _metrics
    if not os.path.exists(MODEL_PATH):
        from ml.train import train_model
        _model, _metrics = train_model()
    else:
        _model = joblib.load(MODEL_PATH)
        _metrics = joblib.load(METRICS_PATH) if os.path.exists(METRICS_PATH) else {}
    return _model, _metrics


def get_model():
    global _model, _metrics
    if _model is None:
        load_model()
    return _model, _metrics


def compute_risk_factors(features: Dict[str, Any], fraud_score: float) -> List[str]:
    factors = []
    if features.get("amount", 0) > 1000:
        factors.append(f"High transaction amount (${features['amount']:,.2f})")
    if features.get("is_online", False):
        factors.append("Online transaction (higher risk channel)")
    if features.get("distance_from_home", 0) > 100:
        factors.append(f"Far from home ({features['distance_from_home']:.0f} miles)")
    hour = features.get("hour_of_day", 12)
    if hour < 5 or hour >= 23:
        factors.append(f"Unusual transaction hour ({hour}:00)")
    if features.get("category") in ["travel", "shopping", "entertainment"] and features.get("amount", 0) > 500:
        factors.append(f"High-value {features.get('category')} purchase")
    if not factors:
        factors.append("Pattern deviates from account baseline")
    return factors[:4]


def get_risk_level(score: float) -> Tuple[str, str]:
    if score < 0.3:
        return "LOW", "Approve transaction — low fraud risk detected."
    elif score < 0.5:
        return "MEDIUM", "Monitor transaction — moderate risk indicators present."
    elif score < 0.75:
        return "HIGH", "Flag for review — significant fraud signals detected."
    else:
        return "CRITICAL", "Block transaction — strong fraud indicators detected."


def predict(features: Dict[str, Any]) -> Dict[str, Any]:
    import time
    model, metrics = get_model()
    threshold = metrics.get("threshold", 0.5)

    start = time.perf_counter()

    df = pd.DataFrame([{
        "amount": features.get("amount", 0),
        "hour_of_day": features.get("hour_of_day", 12),
        "day_of_week": features.get("day_of_week", 0),
        "is_online": int(features.get("is_online", False)),
        "distance_from_home": features.get("distance_from_home", 0),
        "category": features.get("category", "shopping"),
        "card_type": features.get("card_type", "credit"),
    }])

    proba = model.predict_proba(df)[0][1]
    is_fraud = bool(proba >= threshold)
    elapsed_ms = (time.perf_counter() - start) * 1000

    risk_level, recommendation = get_risk_level(proba)
    risk_factors = compute_risk_factors(features, proba)

    return {
        "fraud_score": float(proba),
        "is_fraud": is_fraud,
        "confidence": float(max(proba, 1 - proba)),
        "risk_level": risk_level,
        "risk_factors": risk_factors,
        "recommendation": recommendation,
        "processing_time_ms": elapsed_ms,
        "threshold_used": threshold,
    }
