from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, case
from database import get_db, Transaction, Alert, ModelMetrics
from schemas import AnalyticsResponse, ModelMetricsResponse, AlertResponse
from ml.predict import get_model
from datetime import datetime, timedelta
from typing import List
import joblib, os

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
METRICS_PATH = os.path.join(os.path.dirname(__file__), "..", "ml", "model_metrics.pkl")


@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    total_q = await db.execute(select(func.count(Transaction.id)))
    total = total_q.scalar() or 0

    fraud_q = await db.execute(select(func.count(Transaction.id)).where(Transaction.is_fraud == True))
    total_fraud = fraud_q.scalar() or 0

    amount_q = await db.execute(select(func.sum(Transaction.amount)))
    total_amount = amount_q.scalar() or 0

    fraud_amount_q = await db.execute(
        select(func.sum(Transaction.amount)).where(Transaction.is_fraud == True)
    )
    fraud_amount = fraud_amount_q.scalar() or 0

    avg_score_q = await db.execute(select(func.avg(Transaction.fraud_score)))
    avg_score = avg_score_q.scalar() or 0

    alerts_q = await db.execute(
        select(func.count(Alert.id)).where(Alert.is_resolved == False)
    )
    active_alerts = alerts_q.scalar() or 0

    return {
        "total_transactions": total,
        "total_fraud": total_fraud,
        "fraud_rate": (total_fraud / total * 100) if total > 0 else 0,
        "total_amount": float(total_amount),
        "fraud_amount": float(fraud_amount),
        "avg_fraud_score": float(avg_score),
        "active_alerts": active_alerts,
        "fraud_prevented": float(fraud_amount),
    }


@router.get("/by-category")
async def fraud_by_category(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            Transaction.category,
            func.count(Transaction.id).label("total"),
            func.sum(case((Transaction.is_fraud == True, 1), else_=0)).label("fraud_count"),
            func.avg(Transaction.fraud_score).label("avg_score"),
        ).group_by(Transaction.category)
    )
    rows = result.all()
    return [
        {
            "category": r.category,
            "total": r.total,
            "fraud_count": r.fraud_count or 0,
            "fraud_rate": (r.fraud_count / r.total * 100) if r.total > 0 else 0,
            "avg_score": float(r.avg_score or 0),
        }
        for r in rows
    ]


@router.get("/by-hour")
async def fraud_by_hour(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            Transaction.hour_of_day,
            func.count(Transaction.id).label("total"),
            func.sum(case((Transaction.is_fraud == True, 1), else_=0)).label("fraud_count"),
        ).group_by(Transaction.hour_of_day).order_by(Transaction.hour_of_day)
    )
    rows = result.all()
    return [
        {
            "hour": r.hour_of_day,
            "total": r.total,
            "fraud_count": r.fraud_count or 0,
        }
        for r in rows
    ]


@router.get("/recent-trend")
async def recent_trend(days: int = 7, db: AsyncSession = Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(
            func.date(Transaction.created_at).label("date"),
            func.count(Transaction.id).label("total"),
            func.sum(case((Transaction.is_fraud == True, 1), else_=0)).label("fraud_count"),
        )
        .where(Transaction.created_at >= since)
        .group_by(func.date(Transaction.created_at))
        .order_by(func.date(Transaction.created_at))
    )
    return [
        {"date": str(r.date), "total": r.total, "fraud_count": r.fraud_count or 0}
        for r in result.all()
    ]


@router.get("/score-distribution")
async def score_distribution(db: AsyncSession = Depends(get_db)):
    buckets = [0.1 * i for i in range(11)]
    result = await db.execute(select(Transaction.fraud_score))
    scores = [row[0] for row in result.all()]

    distribution = []
    for i in range(len(buckets) - 1):
        low, high = buckets[i], buckets[i + 1]
        count = sum(1 for s in scores if low <= s < high)
        distribution.append({
            "range": f"{low:.1f}-{high:.1f}",
            "count": count,
            "low": low,
            "high": high,
        })
    return distribution


@router.get("/model-metrics")
async def get_model_metrics():
    if os.path.exists(METRICS_PATH):
        metrics = joblib.load(METRICS_PATH)
        return {
            "model_version": metrics.get("model_version", "1.0.0"),
            "precision": metrics.get("precision", 0),
            "recall": metrics.get("recall", 0),
            "f1_score": metrics.get("f1_score", 0),
            "roc_auc": metrics.get("roc_auc", 0),
            "threshold": metrics.get("threshold", 0.5),
            "trained_at": "2026-05-24T00:00:00",
        }
    return {"error": "Model not trained yet"}


@router.get("/alerts", response_model=List[AlertResponse])
async def get_alerts(
    limit: int = 20,
    include_resolved: bool = False,
    db: AsyncSession = Depends(get_db)
):
    query = select(Alert).order_by(desc(Alert.created_at)).limit(limit)
    if not include_resolved:
        query = query.where(Alert.is_resolved == False)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_resolved = True
    alert.resolved_at = datetime.utcnow()
    await db.commit()
    return {"success": True}
