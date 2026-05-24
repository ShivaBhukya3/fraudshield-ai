web: python -c "from ml.train import train_model; import os; os.path.exists('ml/fraud_model.pkl') or train_model()" && uvicorn main:app --host 0.0.0.0 --port $PORT
