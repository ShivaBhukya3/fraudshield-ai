from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from database import get_db, Transaction, Alert
from schemas import TransactionInput, FraudPrediction, TransactionResponse, BatchTransactionInput
from ml.predict import predict
import uuid
from datetime import datetime
from typing import List, Optional

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.post("/score", response_model=FraudPrediction)
async def score_transaction(
    transaction: TransactionInput,
    db: AsyncSession = Depends(get_db)
):
    transaction_id = transaction.transaction_id or str(uuid.uuid4())
    result = predict(transaction.model_dump())

    db_transaction = Transaction(
        transaction_id=transaction_id,
        amount=transaction.amount,
        merchant=transaction.merchant,
        category=transaction.category,
        location=transaction.location,
        card_type=transaction.card_type,
        hour_of_day=transaction.hour_of_day,
        day_of_week=transaction.day_of_week,
        is_online=transaction.is_online,
        distance_from_home=transaction.distance_from_home,
        fraud_score=result["fraud_score"],
        is_fraud=result["is_fraud"],
        is_flagged=result["risk_level"] in ("HIGH", "CRITICAL"),
        status="blocked" if result["risk_level"] == "CRITICAL" else
               "flagged" if result["is_fraud"] else "approved",
        features=transaction.model_dump(),
    )
    db.add(db_transaction)

    if result["is_fraud"]:
        alert = Alert(
            transaction_id=transaction_id,
            alert_type="FRAUD_DETECTED",
            severity=result["risk_level"],
            message=f"Fraud detected: {', '.join(result['risk_factors'][:2])}",
        )
        db.add(alert)

    await db.commit()

    return FraudPrediction(
        transaction_id=transaction_id,
        **result
    )


@router.post("/batch-score")
async def batch_score(
    batch: BatchTransactionInput,
    db: AsyncSession = Depends(get_db)
):
    results = []
    for txn in batch.transactions:
        transaction_id = txn.transaction_id or str(uuid.uuid4())
        result = predict(txn.model_dump())

        db_transaction = Transaction(
            transaction_id=transaction_id,
            amount=txn.amount,
            merchant=txn.merchant,
            category=txn.category,
            location=txn.location,
            card_type=txn.card_type,
            hour_of_day=txn.hour_of_day,
            day_of_week=txn.day_of_week,
            is_online=txn.is_online,
            distance_from_home=txn.distance_from_home,
            fraud_score=result["fraud_score"],
            is_fraud=result["is_fraud"],
            is_flagged=result["risk_level"] in ("HIGH", "CRITICAL"),
            status="blocked" if result["risk_level"] == "CRITICAL" else
                   "flagged" if result["is_fraud"] else "approved",
            features=txn.model_dump(),
        )
        db.add(db_transaction)
        results.append({"transaction_id": transaction_id, **result})

    await db.commit()
    return {"results": results, "processed": len(results)}


@router.get("/", response_model=List[TransactionResponse])
async def list_transactions(
    skip: int = 0,
    limit: int = Query(default=50, le=200),
    is_fraud: Optional[bool] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Transaction).order_by(desc(Transaction.created_at)).offset(skip).limit(limit)
    if is_fraud is not None:
        query = query.where(Transaction.is_fraud == is_fraud)
    if status:
        query = query.where(Transaction.status == status)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(transaction_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Transaction).where(Transaction.transaction_id == transaction_id)
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


@router.get("/demo/generate")
async def generate_demo_transactions(
    count: int = Query(default=10, le=50),
    db: AsyncSession = Depends(get_db)
):
    """Generate random demo transactions for testing."""
    import random

    merchants = [
        ("Amazon", "shopping"), ("Walmart", "groceries"), ("Shell", "gas"),
        ("Marriott Hotels", "travel"), ("Netflix", "entertainment"), ("CVS Pharmacy", "healthcare"),
        ("Chipotle", "dining"), ("Best Buy", "shopping"), ("Delta Airlines", "travel"),
        ("Unknown Merchant #7", "shopping"), ("Crypto Exchange", "shopping"),
        ("International Transfer", "travel"),
    ]

    results = []
    for _ in range(count):
        merchant, category = random.choice(merchants)
        is_suspicious = random.random() < 0.15

        txn_data = TransactionInput(
            amount=round(random.uniform(5000 if is_suspicious else 10, 50000 if is_suspicious else 500), 2),
            merchant=merchant,
            category=category,
            location=random.choice(["New York", "Los Angeles", "Foreign Country", "Unknown"]),
            card_type=random.choice(["credit", "debit", "prepaid"]),
            hour_of_day=random.choice([1, 2, 3] if is_suspicious else list(range(8, 22))),
            day_of_week=random.randint(0, 6),
            is_online=True if is_suspicious else random.choice([True, False]),
            distance_from_home=random.uniform(500, 5000) if is_suspicious else random.uniform(0, 30),
        )

        transaction_id = str(uuid.uuid4())
        result = predict(txn_data.model_dump())

        db_transaction = Transaction(
            transaction_id=transaction_id,
            amount=txn_data.amount,
            merchant=txn_data.merchant,
            category=txn_data.category,
            location=txn_data.location,
            card_type=txn_data.card_type,
            hour_of_day=txn_data.hour_of_day,
            day_of_week=txn_data.day_of_week,
            is_online=txn_data.is_online,
            distance_from_home=txn_data.distance_from_home,
            fraud_score=result["fraud_score"],
            is_fraud=result["is_fraud"],
            is_flagged=result["risk_level"] in ("HIGH", "CRITICAL"),
            status="blocked" if result["risk_level"] == "CRITICAL" else
                   "flagged" if result["is_fraud"] else "approved",
            features=txn_data.model_dump(),
        )
        db.add(db_transaction)

        if result["is_fraud"]:
            db.add(Alert(
                transaction_id=transaction_id,
                alert_type="FRAUD_DETECTED",
                severity=result["risk_level"],
                message=f"Fraud: ${txn_data.amount:,.2f} at {merchant}",
            ))

        results.append({"transaction_id": transaction_id, "merchant": merchant, **result})

    await db.commit()
    return {"generated": len(results), "results": results}
