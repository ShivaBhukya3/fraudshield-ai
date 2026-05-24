"""
Fraud detection model training pipeline.
Uses SMOTE for imbalanced learning and threshold optimization.
"""
import numpy as np
import pandas as pd
import joblib
import os
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    classification_report, roc_auc_score, precision_recall_curve,
    confusion_matrix, f1_score, precision_score, recall_score
)
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
import warnings
warnings.filterwarnings('ignore')

MODEL_PATH = os.path.join(os.path.dirname(__file__), "fraud_model.pkl")
METRICS_PATH = os.path.join(os.path.dirname(__file__), "model_metrics.pkl")


def generate_synthetic_data(n_samples: int = 50000) -> pd.DataFrame:
    np.random.seed(42)

    # Legitimate transactions (95%)
    n_legit = int(n_samples * 0.95)
    n_fraud = n_samples - n_legit

    legit = pd.DataFrame({
        "amount": np.random.lognormal(3.5, 1.2, n_legit),
        "hour_of_day": np.random.choice(range(24), n_legit, p=_hour_distribution()),
        "day_of_week": np.random.randint(0, 7, n_legit),
        "is_online": np.random.choice([0, 1], n_legit, p=[0.65, 0.35]),
        "distance_from_home": np.random.exponential(15, n_legit),
        "category": np.random.choice(
            ["groceries", "dining", "gas", "entertainment", "shopping", "travel", "healthcare"],
            n_legit, p=[0.25, 0.20, 0.15, 0.10, 0.15, 0.10, 0.05]
        ),
        "card_type": np.random.choice(["credit", "debit", "prepaid"], n_legit, p=[0.55, 0.40, 0.05]),
        "is_fraud": 0
    })

    # Fraudulent transactions (5%)
    fraud = pd.DataFrame({
        "amount": np.random.lognormal(5.0, 1.5, n_fraud),  # Higher amounts
        "hour_of_day": np.random.choice(range(24), n_fraud, p=_fraud_hour_distribution()),
        "day_of_week": np.random.randint(0, 7, n_fraud),
        "is_online": np.random.choice([0, 1], n_fraud, p=[0.20, 0.80]),  # Mostly online
        "distance_from_home": np.random.exponential(80, n_fraud),  # Far from home
        "category": np.random.choice(
            ["groceries", "dining", "gas", "entertainment", "shopping", "travel", "healthcare"],
            n_fraud, p=[0.05, 0.05, 0.05, 0.15, 0.30, 0.35, 0.05]
        ),
        "card_type": np.random.choice(["credit", "debit", "prepaid"], n_fraud, p=[0.60, 0.25, 0.15]),
        "is_fraud": 1
    })

    df = pd.concat([legit, fraud], ignore_index=True).sample(frac=1, random_state=42)
    df["amount"] = df["amount"].clip(1, 50000)
    df["distance_from_home"] = df["distance_from_home"].clip(0, 5000)
    return df


def _hour_distribution():
    weights = np.zeros(24)
    weights[6:22] = 1.0
    weights[22:24] = 0.3
    weights[0:6] = 0.1
    return weights / weights.sum()


def _fraud_hour_distribution():
    weights = np.zeros(24)
    weights[0:5] = 1.5   # Late night
    weights[5:9] = 0.5
    weights[9:17] = 0.8
    weights[17:21] = 0.6
    weights[21:24] = 1.2
    return weights / weights.sum()


def build_preprocessor():
    numeric_features = ["amount", "hour_of_day", "day_of_week", "distance_from_home"]
    categorical_features = ["category", "card_type"]

    numeric_transformer = StandardScaler()
    categorical_transformer = OneHotEncoder(handle_unknown="ignore", sparse_output=False)

    return ColumnTransformer(transformers=[
        ("num", numeric_transformer, numeric_features),
        ("cat", categorical_transformer, categorical_features),
    ])


def find_optimal_threshold(y_true, y_proba, beta=1.0):
    """Find threshold that maximizes F-beta score."""
    precisions, recalls, thresholds = precision_recall_curve(y_true, y_proba)
    beta_sq = beta ** 2
    f_scores = (1 + beta_sq) * (precisions * recalls) / (beta_sq * precisions + recalls + 1e-8)
    optimal_idx = np.argmax(f_scores)
    return float(thresholds[optimal_idx]) if optimal_idx < len(thresholds) else 0.5


def train_model():
    print("Generating synthetic fraud data...")
    df = generate_synthetic_data(50000)

    features = ["amount", "hour_of_day", "day_of_week", "is_online", "distance_from_home", "category", "card_type"]
    X = df[features]
    y = df["is_fraud"]

    print(f"Dataset: {len(df)} samples, fraud rate: {y.mean():.2%}")

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    preprocessor = build_preprocessor()

    smote = SMOTE(random_state=42, k_neighbors=5)
    classifier = GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=5,
        min_samples_split=20,
        subsample=0.8,
        random_state=42
    )

    pipeline = ImbPipeline([
        ("preprocessor", preprocessor),
        ("smote", smote),
        ("classifier", classifier)
    ])

    print("Training model with SMOTE oversampling...")
    pipeline.fit(X_train, y_train)

    y_proba = pipeline.predict_proba(X_test)[:, 1]
    optimal_threshold = find_optimal_threshold(y_test, y_proba, beta=0.5)
    y_pred = (y_proba >= optimal_threshold).astype(int)

    metrics = {
        "precision": float(precision_score(y_test, y_pred)),
        "recall": float(recall_score(y_test, y_pred)),
        "f1_score": float(f1_score(y_test, y_pred)),
        "roc_auc": float(roc_auc_score(y_test, y_proba)),
        "threshold": float(optimal_threshold),
        "model_version": "1.0.0",
        "feature_names": features,
    }

    print(f"\nModel Performance:")
    print(f"  Precision:   {metrics['precision']:.4f}")
    print(f"  Recall:      {metrics['recall']:.4f}")
    print(f"  F1-Score:    {metrics['f1_score']:.4f}")
    print(f"  ROC-AUC:     {metrics['roc_auc']:.4f}")
    print(f"  Threshold:   {metrics['threshold']:.4f}")

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)
    joblib.dump(metrics, METRICS_PATH)
    print(f"\nModel saved to {MODEL_PATH}")
    return pipeline, metrics


if __name__ == "__main__":
    train_model()
