"""
Model Trainer
=============
Trains multiple ML models on selected features and returns:
  - Metrics per model (R², MAE, RMSE or Accuracy, F1, ROC-AUC)
  - Cross-validation scores (mean ± std) when requested
  - Feature importances (RF/tree models) or coefficients (linear models)
  - Actual vs predicted values for test set
  - Base64-encoded pickle of the best model for download
"""

import base64
import pickle
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge, Lasso
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    roc_auc_score,
)
from sklearn.model_selection import (
    KFold,
    LeaveOneOut,
    StratifiedKFold,
    cross_val_score,
    train_test_split,
)
from sklearn.preprocessing import LabelEncoder

# ---------------------------------------------------------------------------
# Optional gradient-boosting libraries (Python 3.13 wheels available)
# ---------------------------------------------------------------------------

try:
    from xgboost import XGBClassifier, XGBRegressor
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

try:
    from lightgbm import LGBMClassifier, LGBMRegressor
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False

try:
    from catboost import CatBoostClassifier, CatBoostRegressor
    HAS_CATBOOST = True
except ImportError:
    HAS_CATBOOST = False

# ---------------------------------------------------------------------------
# Model Registries
# ---------------------------------------------------------------------------

REGRESSION_MODELS: dict[str, Any] = {
    "Linear Regression": lambda: LinearRegression(),
    "Ridge Regression": lambda: Ridge(alpha=1.0),
    "Random Forest": lambda: RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1),
}

CLASSIFICATION_MODELS: dict[str, Any] = {
    "Logistic Regression": lambda: LogisticRegression(max_iter=1000, random_state=42),
    "Random Forest": lambda: RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1),
}

if HAS_XGBOOST:
    REGRESSION_MODELS["XGBoost"] = lambda: XGBRegressor(
        n_estimators=300, learning_rate=0.05, max_depth=6,
        random_state=42, verbosity=0, n_jobs=-1,
    )
    CLASSIFICATION_MODELS["XGBoost"] = lambda: XGBClassifier(
        n_estimators=300, learning_rate=0.05, max_depth=6,
        random_state=42, verbosity=0, n_jobs=-1, eval_metric="logloss",
    )

if HAS_LIGHTGBM:
    REGRESSION_MODELS["LightGBM"] = lambda: LGBMRegressor(
        n_estimators=300, learning_rate=0.05, num_leaves=31,
        random_state=42, verbose=-1, n_jobs=-1,
    )
    CLASSIFICATION_MODELS["LightGBM"] = lambda: LGBMClassifier(
        n_estimators=300, learning_rate=0.05, num_leaves=31,
        random_state=42, verbose=-1, n_jobs=-1,
    )

if HAS_CATBOOST:
    REGRESSION_MODELS["CatBoost"] = lambda: CatBoostRegressor(
        iterations=300, learning_rate=0.05, depth=6,
        random_seed=42, verbose=False,
    )
    CLASSIFICATION_MODELS["CatBoost"] = lambda: CatBoostClassifier(
        iterations=300, learning_rate=0.05, depth=6,
        random_seed=42, verbose=False,
    )


def get_available_models(problem_type: str) -> list[str]:
    """Return the list of model names available for the given problem type."""
    registry = REGRESSION_MODELS if problem_type == "regression" else CLASSIFICATION_MODELS
    return list(registry.keys())


# ---------------------------------------------------------------------------
# Preprocessing (mirrors feature_selector.py approach)
# ---------------------------------------------------------------------------

def _encode_col(series: pd.Series) -> pd.Series:
    le = LabelEncoder()
    filled = series.fillna("__MISSING__").astype(str)
    return pd.Series(le.fit_transform(filled), index=series.index, name=series.name)


def _prepare(
    df: pd.DataFrame,
    target_col: str,
    feature_columns: list[str],
) -> tuple[pd.DataFrame, pd.Series]:
    X = df[feature_columns].copy()
    y = df[target_col].copy()

    if not pd.api.types.is_numeric_dtype(y):
        y = _encode_col(y)
    else:
        y = y.fillna(y.median())

    for col in X.columns:
        if not pd.api.types.is_numeric_dtype(X[col]):
            X[col] = _encode_col(X[col])
        else:
            X[col] = X[col].fillna(X[col].median())

    return X, y


# ---------------------------------------------------------------------------
# Feature Importance Helper
# ---------------------------------------------------------------------------

def _get_importances(
    model: Any,
    feature_names: list[str],
) -> list[dict] | None:
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
    elif hasattr(model, "coef_"):
        coef = model.coef_
        if coef.ndim > 1:
            importances = np.abs(coef).mean(axis=0)
        else:
            importances = np.abs(coef)
    else:
        return None

    items = [
        {"feature": name, "importance": round(float(val), 6)}
        for name, val in zip(feature_names, importances)
    ]
    items.sort(key=lambda x: x["importance"], reverse=True)
    return items


# ---------------------------------------------------------------------------
# Cross-Validation Helper
# ---------------------------------------------------------------------------

def _run_cv(
    model_factory: Any,
    X: pd.DataFrame,
    y: pd.Series,
    problem_type: str,
    cv_strategy: str,
    cv_folds: int,
) -> tuple[float | None, float | None]:
    """Run cross-validation and return (mean_score, std_score)."""
    scoring = "r2" if problem_type == "regression" else "f1_weighted"

    if cv_strategy == "k_fold":
        cv = KFold(n_splits=cv_folds, shuffle=True, random_state=42)
    elif cv_strategy == "stratified_k_fold" and problem_type == "classification":
        cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)
    elif cv_strategy == "loo":
        # LOO can be very slow on large datasets; cap at 200 samples
        if len(X) > 200:
            cv = KFold(n_splits=min(cv_folds, len(X)), shuffle=True, random_state=42)
        else:
            cv = LeaveOneOut()
    else:
        cv = KFold(n_splits=cv_folds, shuffle=True, random_state=42)

    try:
        scores = cross_val_score(
            model_factory(), X, y, cv=cv, scoring=scoring, n_jobs=-1,
        )
        return round(float(scores.mean()), 6), round(float(scores.std()), 6)
    except Exception:
        return None, None


# ---------------------------------------------------------------------------
# Single Model Training
# ---------------------------------------------------------------------------

def _train_one(
    name: str,
    model_factory: Any,
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    y_train: pd.Series,
    y_test: pd.Series,
    X_full: pd.DataFrame,
    y_full: pd.Series,
    problem_type: str,
    feature_names: list[str],
    cv_strategy: str,
    cv_folds: int,
) -> dict[str, Any]:
    model = model_factory()
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    # Metrics
    metrics: dict[str, float | None] = {}
    if problem_type == "regression":
        metrics["r2"] = round(float(r2_score(y_test, y_pred)), 6)
        metrics["mae"] = round(float(mean_absolute_error(y_test, y_pred)), 6)
        metrics["rmse"] = round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 6)
    else:
        metrics["accuracy"] = round(float(accuracy_score(y_test, y_pred)), 6)
        metrics["f1"] = round(float(f1_score(y_test, y_pred, average="weighted", zero_division=0)), 6)

        n_classes = len(np.unique(y_test))
        if n_classes == 2 and hasattr(model, "predict_proba"):
            try:
                y_prob = model.predict_proba(X_test)[:, 1]
                metrics["roc_auc"] = round(float(roc_auc_score(y_test, y_prob)), 6)
            except Exception:
                metrics["roc_auc"] = None
        else:
            metrics["roc_auc"] = None

    # Cross-validation scores (run in parallel with training via ThreadPool)
    if cv_strategy != "train_test_split":
        cv_mean, cv_std = _run_cv(model_factory, X_full, y_full, problem_type, cv_strategy, cv_folds)
        metrics["cv_mean"] = cv_mean
        metrics["cv_std"] = cv_std
    else:
        metrics["cv_mean"] = None
        metrics["cv_std"] = None

    # Feature importances
    importances = _get_importances(model, feature_names)

    # Predictions (sample up to 500 for payload size)
    actual = y_test.tolist()
    predicted = [round(float(v), 6) for v in y_pred]
    if len(actual) > 500:
        indices = list(range(len(actual)))
        random.seed(42)
        sampled = random.sample(indices, 500)
        actual = [actual[i] for i in sampled]
        predicted = [predicted[i] for i in sampled]

    return {
        "model_name": name,
        "model_object": model,
        "metrics": metrics,
        "feature_importances": importances,
        "predictions": [{"actual": a, "predicted": p} for a, p in zip(actual, predicted)],
    }


# ---------------------------------------------------------------------------
# Main Training Function
# ---------------------------------------------------------------------------

def train_models(
    df: pd.DataFrame,
    target_col: str,
    problem_type: str,
    feature_columns: list[str],
    test_size: float = 0.2,
    models_to_train: list[str] | None = None,
    cv_strategy: str = "train_test_split",
    cv_folds: int = 5,
) -> dict[str, Any]:
    """
    Train multiple ML models and return metrics, importances, predictions, and
    a base64-encoded pickle of the best model.
    """
    X, y = _prepare(df, target_col, feature_columns)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42
    )

    model_registry = (
        REGRESSION_MODELS if problem_type == "regression" else CLASSIFICATION_MODELS
    )

    if models_to_train:
        registry = {k: v for k, v in model_registry.items() if k in models_to_train}
    else:
        registry = model_registry

    if not registry:
        raise ValueError(f"No valid models found in: {models_to_train}")

    # Train in parallel
    results = []
    with ThreadPoolExecutor(max_workers=min(len(registry), 4)) as executor:
        futures = {
            executor.submit(
                _train_one,
                name, factory,
                X_train, X_test, y_train, y_test,
                X, y,
                problem_type, list(X.columns),
                cv_strategy, cv_folds,
            ): name
            for name, factory in registry.items()
        }
        for future in as_completed(futures):
            results.append(future.result())

    # Determine best model
    primary_metric = "r2" if problem_type == "regression" else "f1"
    best = max(
        results,
        key=lambda r: r["metrics"].get(primary_metric) or -1,
    )
    best_model_name = best["model_name"]

    # Pickle best model → base64
    model_bytes = base64.b64encode(pickle.dumps(best["model_object"])).decode("utf-8")

    # Strip model_object from output
    clean_results = [
        {k: v for k, v in r.items() if k != "model_object"}
        for r in results
    ]

    clean_results.sort(
        key=lambda r: r["metrics"].get(primary_metric) or -1,
        reverse=True,
    )

    return {
        "problem_type": problem_type,
        "target_column": target_col,
        "feature_columns": feature_columns,
        "test_size": test_size,
        "cv_strategy": cv_strategy,
        "cv_folds": cv_folds if cv_strategy not in ("train_test_split", "loo") else None,
        "n_train": len(X_train),
        "n_test": len(X_test),
        "models": clean_results,
        "best_model": best_model_name,
        "model_bytes": model_bytes,
        "available_models": get_available_models(problem_type),
    }
