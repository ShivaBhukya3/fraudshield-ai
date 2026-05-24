"""Quick start script — trains model and launches the API server."""
import subprocess
import sys
import os

def main():
    print("=" * 60)
    print("  FraudShield AI — Starting Up")
    print("=" * 60)

    model_path = os.path.join("ml", "fraud_model.pkl")
    if not os.path.exists(model_path):
        print("\n[1/2] Training fraud detection model (first run)...")
        subprocess.run([sys.executable, "-m", "ml.train"], check=True)
    else:
        print("\n[1/2] Model already trained. Skipping...")

    print("\n[2/2] Launching FastAPI server at http://localhost:8000")
    print("       Dashboard → http://localhost:8000")
    print("       API Docs  → http://localhost:8000/docs")
    print("=" * 60 + "\n")

    subprocess.run([
        sys.executable, "-m", "uvicorn", "main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--reload",
    ])

if __name__ == "__main__":
    main()
