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
from sklearn.ensemble import (
    RandomForestClassifier,
    RandomForestRegressor,
    StackingClassifier,
    StackingRegressor,
    VotingClassifier,
    VotingRegressor,
)
from sklearn.linear_model import Lasso, LinearRegression, LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import (
    KFold,
    LeaveOneOut,
    StratifiedKFold,
    cross_val_score,
    train_test_split,
)
from sklearn.preprocessing import LabelEncoder, label_binarize

try:
    from sklearn.calibration import calibration_curve
    HAS_CALIBRATION = True
except ImportError:
    HAS_CALIBRATION = False

try:
    from scipy import stats as _scipy_stats
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

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
    "LASSO": lambda: Lasso(alpha=1.0, max_iter=10000, random_state=42),
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


def _build_voting_regressor() -> VotingRegressor:
    estimators = [
        ("lr", LinearRegression()),
        ("ridge", Ridge(alpha=1.0)),
        ("rf", RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)),
    ]
    return VotingRegressor(estimators=estimators)


def _build_stacking_regressor() -> StackingRegressor:
    estimators = [
        ("ridge", Ridge(alpha=1.0)),
        ("rf", RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)),
    ]
    return StackingRegressor(estimators=estimators, final_estimator=LinearRegression())


def _build_voting_classifier() -> VotingClassifier:
    estimators = [
        ("lr", LogisticRegression(max_iter=1000, random_state=42)),
        ("rf", RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)),
    ]
    return VotingClassifier(estimators=estimators, voting="soft")


def _build_stacking_classifier() -> StackingClassifier:
    estimators = [
        ("lr", LogisticRegression(max_iter=1000, random_state=42)),
        ("rf", RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)),
    ]
    return StackingClassifier(estimators=estimators, final_estimator=LogisticRegression(max_iter=1000, random_state=42))


REGRESSION_MODELS["Voting Ensemble"] = _build_voting_regressor
REGRESSION_MODELS["Stacking"] = _build_stacking_regressor
CLASSIFICATION_MODELS["Voting Ensemble"] = _build_voting_classifier
CLASSIFICATION_MODELS["Stacking"] = _build_stacking_classifier


def get_available_models(problem_type: str) -> list[str]:
    """Return the list of model names available for the given problem type."""
    registry = REGRESSION_MODELS if problem_type == "regression" else CLASSIFICATION_MODELS
    return list(registry.keys())


# ---------------------------------------------------------------------------
# Preprocessing (mirrors feature_selector.py approach)
# ---------------------------------------------------------------------------

def _encode_col(series: pd.Series) -> tuple[pd.Series, LabelEncoder]:
    le = LabelEncoder()
    filled = series.fillna("__MISSING__").astype(str)
    encoded = pd.Series(le.fit_transform(filled), index=series.index, name=series.name)
    return encoded, le


def _prepare(
    df: pd.DataFrame,
    target_col: str,
    feature_columns: list[str],
) -> tuple[pd.DataFrame, pd.Series, dict]:
    """
    Prepare features and target for training.
    Returns (X, y, meta) where meta contains fitted encoders/medians for inference.
    """
    X = df[feature_columns].copy()
    y = df[target_col].copy()

    meta: dict = {
        "feature_columns": list(feature_columns),
        "encoders": {},       # col -> fitted LabelEncoder (categorical features)
        "medians": {},        # col -> float (numeric feature NaN fill)
        "target_encoder": None,
        "ranges": {},         # col -> (min, max) for extrapolation detection
        "train_distributions": {},  # col -> list[float|str] sampled from training set
    }

    if not pd.api.types.is_numeric_dtype(y):
        y, le = _encode_col(y)
        meta["target_encoder"] = le
    else:
        y = y.fillna(y.median())

    for col in X.columns:
        if not pd.api.types.is_numeric_dtype(X[col]):
            # Store raw categorical values before encoding (sample up to 1000)
            raw = df[col].dropna().astype(str).tolist()
            meta["train_distributions"][col] = raw[:1000]
            X[col], le = _encode_col(X[col])
            meta["encoders"][col] = le
        else:
            median = float(X[col].median())
            X[col] = X[col].fillna(median)
            meta["medians"][col] = median
            meta["ranges"][col] = (float(X[col].min()), float(X[col].max()))
            # Store numeric sample for KS test (up to 1000 rows)
            raw_num = df[col].dropna().tolist()
            meta["train_distributions"][col] = raw_num[:1000]

    return X, y, meta


def apply_meta(X: pd.DataFrame, meta: dict) -> tuple[pd.DataFrame, list[str]]:
    """
    Apply stored preprocessing meta to new feature data (for inference).
    Returns (X_processed, warnings).
    """
    feature_cols = meta["feature_columns"]
    X = X.reindex(columns=feature_cols).copy()
    warnings_list: list[str] = []

    for col in feature_cols:
        if col in meta["encoders"]:
            le: LabelEncoder = meta["encoders"][col]
            filled = X[col].fillna("__MISSING__").astype(str)
            known = set(le.classes_)
            unseen = {v for v in filled.unique() if v not in known}
            if unseen:
                warnings_list.append(
                    f"'{col}' has unseen categories {unseen} — mapped to default"
                )
                fallback = le.classes_[0]
                filled = filled.map(lambda v, k=known, fb=fallback: v if v in k else fb)
            try:
                X[col] = le.transform(filled)
            except Exception:
                X[col] = 0
        elif col in meta["medians"]:
            X[col] = pd.to_numeric(X[col], errors="coerce").fillna(meta["medians"][col])
        else:
            X[col] = pd.to_numeric(X[col], errors="coerce").fillna(0)

    return X, warnings_list


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

    # Bootstrap confidence intervals (500 resamples)
    try:
        y_test_arr = np.array(y_test.tolist())
        y_pred_arr = np.array([float(v) for v in y_pred])
        n_boot = 500
        rng = np.random.default_rng(42)
        boot_metrics: dict[str, list[float]] = {}
        metric_keys = list(metrics.keys())
        for _ in range(n_boot):
            idx = rng.integers(0, len(y_test_arr), size=len(y_test_arr))
            yt_b = y_test_arr[idx]
            yp_b = y_pred_arr[idx]
            if problem_type == "regression":
                boot_metrics.setdefault("r2", []).append(float(r2_score(yt_b, yp_b)))
                boot_metrics.setdefault("mae", []).append(float(mean_absolute_error(yt_b, yp_b)))
                boot_metrics.setdefault("rmse", []).append(float(np.sqrt(mean_squared_error(yt_b, yp_b))))
            else:
                boot_metrics.setdefault("accuracy", []).append(float(accuracy_score(yt_b, yp_b)))
                boot_metrics.setdefault("f1", []).append(float(f1_score(yt_b, yp_b, average="weighted", zero_division=0)))
        ci: dict[str, dict] = {}
        for k, vals in boot_metrics.items():
            arr_v = np.array(vals)
            ci[k] = {
                "lower": round(float(np.percentile(arr_v, 2.5)), 6),
                "upper": round(float(np.percentile(arr_v, 97.5)), 6),
            }
        metrics["ci"] = ci  # type: ignore
    except Exception:
        metrics["ci"] = None  # type: ignore

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

    # ------------------------------------------------------------------
    # Classification-only: Confusion Matrix + ROC Curve data
    # ------------------------------------------------------------------
    cm_data: list[list[int]] | None = None
    cm_labels: list[str] | None = None
    roc_curve_data: list[dict[str, Any]] | None = None

    if problem_type == "classification":
        try:
            labels_sorted = sorted(
                np.unique(np.concatenate([np.array(y_test), np.array(y_pred)])).tolist()
            )
            cm = confusion_matrix(y_test, y_pred, labels=labels_sorted)
            cm_data = cm.tolist()
            cm_labels = [str(lbl) for lbl in labels_sorted]
        except Exception:
            cm_data = None
            cm_labels = None

        # ROC curve: binary vs multi-class
        try:
            n_classes = len(np.unique(y_test))
            if n_classes == 2 and hasattr(model, "predict_proba"):
                y_prob = model.predict_proba(X_test)[:, 1]
                fpr, tpr, _ = roc_curve(y_test, y_prob)
                auc_val = float(roc_auc_score(y_test, y_prob))
                # Downsample to max 200 points for payload size
                if len(fpr) > 200:
                    idx = np.linspace(0, len(fpr) - 1, 200).astype(int)
                    fpr = fpr[idx]
                    tpr = tpr[idx]
                roc_curve_data = [
                    {
                        "fpr": [round(float(f), 4) for f in fpr],
                        "tpr": [round(float(t), 4) for t in tpr],
                        "auc": round(auc_val, 4),
                        "label": "Positive class",
                    }
                ]
            elif n_classes > 2 and hasattr(model, "predict_proba"):
                # One-vs-Rest ROC for multi-class
                y_test_arr = np.array(y_test)
                classes = sorted(np.unique(y_test_arr).tolist())
                y_test_bin = label_binarize(y_test_arr, classes=classes)
                y_prob_all = model.predict_proba(X_test)
                roc_curve_data = []
                for i, cls in enumerate(classes):
                    if y_test_bin.shape[1] <= i:
                        break
                    fpr_i, tpr_i, _ = roc_curve(y_test_bin[:, i], y_prob_all[:, i])
                    try:
                        auc_i = float(roc_auc_score(y_test_bin[:, i], y_prob_all[:, i]))
                    except ValueError:
                        auc_i = 0.0
                    if len(fpr_i) > 200:
                        idx = np.linspace(0, len(fpr_i) - 1, 200).astype(int)
                        fpr_i = fpr_i[idx]
                        tpr_i = tpr_i[idx]
                    roc_curve_data.append({
                        "fpr": [round(float(f), 4) for f in fpr_i],
                        "tpr": [round(float(t), 4) for t in tpr_i],
                        "auc": round(auc_i, 4),
                        "label": str(cls),
                    })
            elif not hasattr(model, "predict_proba"):
                # Model lacks predict_proba (e.g. LinearSVC)
                roc_curve_data = None
        except Exception:
            roc_curve_data = None

    return {
        "model_name": name,
        "model_object": model,
        "metrics": metrics,
        "feature_importances": importances,
        "predictions": [{"actual": a, "predicted": p} for a, p in zip(actual, predicted)],
        "confusion_matrix": cm_data,
        "class_labels": cm_labels,
        "roc_curve_data": roc_curve_data,
    }


def evaluate_model(
    model: Any,
    df: pd.DataFrame,
    target_col: str,
    feature_columns: list[str],
    problem_type: str,
    meta: dict | None = None,
) -> dict[str, Any]:
    """
    Evaluate a trained model on a new dataset.
    If meta is provided, use stored encoders/medians for consistent preprocessing.
    """
    if meta is not None:
        X, _ = apply_meta(df[feature_columns], meta)
        y = df[target_col].copy()
        if meta["target_encoder"] is not None:
            le = meta["target_encoder"]
            filled = y.fillna("__MISSING__").astype(str)
            known = set(le.classes_)
            filled = filled.map(lambda v, k=known, c=le.classes_: v if v in k else c[0])
            y = pd.Series(le.transform(filled), index=y.index)
        else:
            y = pd.to_numeric(y, errors="coerce").fillna(y.median())
    else:
        X, y, _ = _prepare(df, target_col, feature_columns)
    y_pred = model.predict(X)

    metrics: dict[str, Any] = {
        "problem_type": problem_type,
        "n_samples": len(df),
    }

    if problem_type == "regression":
        metrics["r2"] = round(float(r2_score(y, y_pred)), 6)
        metrics["mae"] = round(float(mean_absolute_error(y, y_pred)), 6)
        metrics["rmse"] = round(float(np.sqrt(mean_squared_error(y, y_pred))), 6)

        # Add predictions for scatter plot (sample up to 1000)
        actual = y.tolist()
        predicted = [round(float(v), 6) for v in y_pred]
        if len(actual) > 1000:
            indices = list(range(len(actual)))
            random.seed(42)
            sampled = random.sample(indices, 1000)
            actual = [actual[i] for i in sampled]
            predicted = [predicted[i] for i in sampled]
        metrics["predictions"] = [{"actual": a, "predicted": p} for a, p in zip(actual, predicted)]

        # Residuals (fitted vs residual), sample up to 500
        try:
            fitted_vals = [round(float(v), 6) for v in y_pred]
            residual_vals = [round(float(a - p), 6) for a, p in zip(y.tolist(), [float(v) for v in y_pred])]
            if len(fitted_vals) > 500:
                rng2 = np.random.default_rng(42)
                idx2 = rng2.integers(0, len(fitted_vals), size=500).tolist()
                fitted_vals = [fitted_vals[i] for i in idx2]
                residual_vals = [residual_vals[i] for i in idx2]
            metrics["residuals"] = [
                {"fitted": f, "residual": r}
                for f, r in zip(fitted_vals, residual_vals)
            ]
        except Exception:
            metrics["residuals"] = None
    else:
        metrics["accuracy"] = round(float(accuracy_score(y, y_pred)), 6)
        metrics["f1"] = round(float(f1_score(y, y_pred, average="weighted", zero_division=0)), 6)

        # Confusion matrix
        try:
            labels = sorted(np.unique(np.concatenate([np.array(y), np.array(y_pred)])).tolist())
            cm = confusion_matrix(y, y_pred, labels=labels)
            metrics["confusion_matrix"] = cm.tolist()
            metrics["class_labels"] = [str(l) for l in labels]
        except Exception:
            metrics["confusion_matrix"] = None
            metrics["class_labels"] = None

        if hasattr(model, "predict_proba"):
            try:
                n_classes = len(np.unique(y))
                if n_classes == 2:
                    y_prob = model.predict_proba(X)[:, 1]
                    metrics["roc_auc"] = round(float(roc_auc_score(y, y_prob)), 6)

                    # Compute ROC curve points
                    fpr, tpr, _ = roc_curve(y, y_prob)
                    # Sample down to 100 points for the chart
                    if len(fpr) > 100:
                        indices = np.linspace(0, len(fpr) - 1, 100).astype(int)
                        fpr = fpr[indices]
                        tpr = tpr[indices]
                    metrics["roc_curve"] = [
                        {"fpr": round(float(f), 4), "tpr": round(float(t), 4)}
                        for f, t in zip(fpr, tpr)
                    ]

                    # Calibration curve (binary only)
                    if HAS_CALIBRATION:
                        try:
                            frac_pos, mean_pred = calibration_curve(y, y_prob, n_bins=10)
                            metrics["calibration"] = {
                                "fraction_of_positives": [round(float(v), 6) for v in frac_pos],
                                "mean_predicted": [round(float(v), 6) for v in mean_pred],
                            }
                        except Exception:
                            metrics["calibration"] = None
                    else:
                        metrics["calibration"] = None
                else:
                    metrics["roc_auc"] = None
                    metrics["roc_curve"] = None
                    metrics["calibration"] = None
            except Exception:
                metrics["roc_auc"] = None
                metrics["roc_curve"] = None
                metrics["calibration"] = None
        else:
            metrics["roc_auc"] = None
            metrics["roc_curve"] = None
            metrics["calibration"] = None

    # ---------------------------------------------------------------------------
    # Data Drift Detection (KS test for numeric, chi-square for categorical)
    # ---------------------------------------------------------------------------
    if meta is not None and HAS_SCIPY and "train_distributions" in meta:
        drift_results = []
        for col in feature_columns:
            if col not in df.columns:
                continue
            train_dist = meta["train_distributions"].get(col)
            if not train_dist:
                continue
            eval_col = df[col].dropna()
            if len(eval_col) == 0:
                continue
            try:
                if col in meta.get("encoders", {}):
                    # Categorical: chi-square on value frequencies
                    train_counts: dict = {}
                    for v in train_dist:
                        train_counts[v] = train_counts.get(v, 0) + 1
                    eval_vals = eval_col.astype(str).tolist()
                    eval_counts: dict = {}
                    for v in eval_vals:
                        eval_counts[v] = eval_counts.get(v, 0) + 1
                    all_cats = sorted(set(train_counts) | set(eval_counts))
                    if len(all_cats) < 2:
                        continue
                    obs = [eval_counts.get(c, 0) for c in all_cats]
                    exp_raw = [train_counts.get(c, 0) for c in all_cats]
                    exp_sum = sum(exp_raw)
                    obs_sum = sum(obs)
                    if exp_sum == 0 or obs_sum == 0:
                        continue
                    exp_norm = [e / exp_sum * obs_sum for e in exp_raw]
                    # Avoid zero expected frequencies
                    exp_norm = [max(e, 1e-9) for e in exp_norm]
                    stat, p_val = _scipy_stats.chisquare(obs, f_exp=exp_norm)
                    drift_results.append({
                        "feature": col,
                        "test": "chi2",
                        "p_value": round(float(p_val), 6),
                        "drifted": bool(p_val < 0.05),
                    })
                else:
                    # Numeric: Kolmogorov-Smirnov test
                    train_arr = [float(v) for v in train_dist]
                    eval_arr = eval_col.astype(float).tolist()
                    stat, p_val = _scipy_stats.ks_2samp(train_arr, eval_arr)
                    drift_results.append({
                        "feature": col,
                        "test": "ks",
                        "p_value": round(float(p_val), 6),
                        "drifted": bool(p_val < 0.05),
                    })
            except Exception:
                pass
        if drift_results:
            metrics["drift"] = drift_results

    return metrics


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
) -> tuple[dict[str, Any], tuple[Any, dict]]:
    """
    Train multiple ML models and return metrics, importances, predictions, and
    a base64-encoded pickle of the best model.
    Returns (result_dict, (best_model_object, preprocessing_meta)).
    """
    X, y, meta = _prepare(df, target_col, feature_columns)

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
    }, (best["model_object"], meta)
