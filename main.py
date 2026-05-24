"""
FraudShield AI — Real-time fraud detection API
FastAPI + PostgreSQL + SMOTE + Gradient Boosting
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import asyncio
import json
import random
import os
from database import create_tables
from routers import transactions, analytics


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    # Pre-load model on startup
    from ml.predict import load_model
    load_model()
    yield


app = FastAPI(
    title="FraudShield AI",
    description="Real-time fraud detection using imbalanced learning and SMOTE",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions.router)
app.include_router(analytics.router)

# Serve frontend static files
frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")


@app.get("/")
async def root():
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "FraudShield AI API", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "FraudShield AI", "version": "1.0.0"}


# WebSocket for real-time transaction feed
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)


manager = ConnectionManager()


@app.websocket("/ws/feed")
async def transaction_feed(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Simulate live transactions every 2-4 seconds
            await asyncio.sleep(random.uniform(2, 4))
            merchants = [
                ("Amazon", "shopping"), ("Walmart", "groceries"), ("Shell", "gas"),
                ("Delta Airlines", "travel"), ("Netflix", "entertainment"),
                ("Unknown#" + str(random.randint(100, 999)), "shopping"),
            ]
            merchant, category = random.choice(merchants)
            is_fraud = random.random() < 0.08
            score = random.uniform(0.6, 0.98) if is_fraud else random.uniform(0.02, 0.35)

            await manager.broadcast({
                "type": "transaction",
                "data": {
                    "id": f"TXN-{random.randint(100000, 999999)}",
                    "merchant": merchant,
                    "category": category,
                    "amount": round(random.uniform(2000 if is_fraud else 10, 30000 if is_fraud else 800), 2),
                    "fraud_score": round(score, 4),
                    "is_fraud": is_fraud,
                    "risk_level": "HIGH" if score > 0.75 else "MEDIUM" if score > 0.5 else "LOW",
                    "timestamp": str(asyncio.get_event_loop().time()),
                }
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
