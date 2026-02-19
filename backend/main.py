"""
FastAPI Backend -- ML Feature Selection API
==========================================
Endpoints:
  POST /upload             -> Parse file, return dataset profile
  POST /suggest-target     -> Auto-suggest target columns
  POST /analyze            -> Run feature selection algorithm
  POST /scatter            -> Get scatter + regression line data
  POST /distribution       -> Get histogram / distribution data
  POST /correlation-matrix -> Get correlation matrix for heatmap
  POST /train              -> Train ML models on selected features
  GET  /models             -> List available model names
  GET  /health             -> Health check (no auth)
"""

import logging
import os
import uuid
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load .env file (no-op if file doesn't exist — env vars already set)
load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("predictpy")

from analyzer import parse_file, profile_dataset
from feature_selector import (
    compute_correlation_matrix,
    detect_problem_type,
    get_scatter_data,
    select_features,
    suggest_target_columns,
)
from model_trainer import get_available_models, train_models

# ---------------------------------------------------------------------------
# App Setup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("predictpy backend starting up.")
    yield
    logger.info("predictpy backend shutting down.")

app = FastAPI(
    title="ML Feature Selection API",
    description="Upload a dataset, detect its type, and find the best features.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — set ALLOWED_ORIGINS in .env (comma-separated) to restrict in production.
# Example: ALLOWED_ORIGINS=https://predictpy.com,https://www.predictpy.com
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
    allow_credentials=False,
)

# In-memory session stores (keyed by session_id UUID).
# In production, replace with Redis or a database.
_sessions: dict[str, pd.DataFrame] = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_df(session_id: str) -> pd.DataFrame:
    df = _sessions.get(session_id)
    if df is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session {session_id!r} not found. Please upload a file first.",
        )
    return df


def _error(msg: str, status: int = 400) -> HTTPException:
    return HTTPException(status_code=status, detail=msg)


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class SuggestTargetRequest(BaseModel):
    session_id: str


class AnalyzeRequest(BaseModel):
    session_id: str
    target_column: str
    problem_type: str | None = None   # "regression" | "classification" | None
    top_n: int | None = None


class ScatterRequest(BaseModel):
    session_id: str
    feature_column: str
    target_column: str
    max_points: int = 500


class CorrelationRequest(BaseModel):
    session_id: str
    columns: list[str] | None = None
    method: str = "pearson"           # "pearson" | "spearman" | "kendall"


class TrainRequest(BaseModel):
    session_id: str
    target_column: str
    problem_type: str                 # "regression" | "classification"
    feature_columns: list[str]
    test_size: float = 0.2
    models_to_train: list[str] | None = None
    cv_strategy: str = "train_test_split"  # "train_test_split" | "k_fold" | "stratified_k_fold" | "loo"
    cv_folds: int = 5


class EngineerFeatureRequest(BaseModel):
    session_id: str
    col_a: str
    col_b: str
    operation: str                    # "add" | "subtract" | "multiply" | "divide"
    new_name: str | None = None


class DropFeatureRequest(BaseModel):
    session_id: str
    column: str



# ---------------------------------------------------------------------------
# Endpoints -- Health
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check() -> dict:
    return {"status": "ok", "version": "2.0.0"}


# ---------------------------------------------------------------------------
# Endpoints -- Dataset
# ---------------------------------------------------------------------------

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """
    Upload a CSV or Excel file.

    Returns:
      - session_id   : Use this in all subsequent requests
      - profile      : Full dataset profile (shape, columns, missing values, preview)
      - problem_hint : Auto-detected problem type hint based on last column
    """
    allowed = (".csv", ".xls", ".xlsx")
    if not file.filename or not file.filename.lower().endswith(allowed):
        raise _error(f"Unsupported file type. Allowed: {', '.join(allowed)}")

    contents = await file.read()
    if len(contents) == 0:
        raise _error("Uploaded file is empty.")

    MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB
    if len(contents) > MAX_UPLOAD_BYTES:
        raise _error("File too large. Maximum upload size is 100 MB.")

    try:
        df = parse_file(contents, file.filename)
    except Exception as e:
        raise _error(f"Could not parse file: {e}")

    if df.shape[0] == 0:
        raise _error("Dataset has no rows.")
    if df.shape[1] < 2:
        raise _error("Dataset must have at least 2 columns (features + target).")

    session_id = str(uuid.uuid4())
    _sessions[session_id] = df
    logger.info(
        "File uploaded: %s (%d rows, %d cols, %.1f KB)",
        file.filename, df.shape[0], df.shape[1], len(contents) / 1024,
    )

    try:
        profile = profile_dataset(df)
    except Exception as e:
        raise _error(f"Could not profile dataset: {e}")

    last_col = df.columns[-1]
    problem_hint = detect_problem_type(df[last_col])

    return {
        "session_id": session_id,
        "filename": file.filename,
        "profile": profile,
        "problem_hint": problem_hint,
        "hint_based_on_column": last_col,
    }


@app.post("/suggest-target")
def suggest_target(
    body: SuggestTargetRequest,
) -> dict[str, Any]:
    df = _get_df(body.session_id)
    try:
        suggestions = suggest_target_columns(df)
    except Exception as e:
        raise _error(f"Target suggestion failed: {e}")
    return {"suggestions": suggestions}


@app.post("/analyze")
def analyze(
    body: AnalyzeRequest,
) -> dict[str, Any]:
    df = _get_df(body.session_id)

    if body.target_column not in df.columns:
        raise _error(f"Column '{body.target_column}' not found in dataset.")
    if body.problem_type and body.problem_type not in ("regression", "classification"):
        raise _error("problem_type must be 'regression' or 'classification'.")
    if df.shape[1] < 2:
        raise _error("Dataset needs at least 2 columns for analysis.")

    try:
        result = select_features(
            df=df,
            target_col=body.target_column,
            problem_type=body.problem_type,
            top_n=body.top_n,
        )
    except Exception as e:
        raise _error(f"Feature selection failed: {e}")

    return result


@app.post("/scatter")
def scatter(
    body: ScatterRequest,
) -> dict[str, Any]:
    df = _get_df(body.session_id)

    for col in (body.feature_column, body.target_column):
        if col not in df.columns:
            raise _error(f"Column '{col}' not found in dataset.")
    if body.max_points < 10 or body.max_points > 5000:
        raise _error("max_points must be between 10 and 5000.")

    try:
        data = get_scatter_data(
            df=df,
            feature_col=body.feature_column,
            target_col=body.target_column,
            max_points=body.max_points,
        )
    except Exception as e:
        raise _error(f"Scatter data generation failed: {e}")

    return data


@app.post("/distribution")
def get_distribution(
    body: dict,
) -> dict[str, Any]:
    session_id = body.get("session_id", "")
    column = body.get("column", "")
    target_column = body.get("target_column", "")
    n_bins = int(body.get("n_bins", 20))

    df = _get_df(session_id)

    if column not in df.columns:
        raise HTTPException(400, f"Column '{column}' not found")
    if target_column and target_column not in df.columns:
        raise HTTPException(400, f"Target column '{target_column}' not found")

    raw_series = df[column]
    n_nan = int(raw_series.isna().sum())
    series = raw_series.dropna()

    if len(series) == 0:
        raise HTTPException(400, "Column has no non-null values")

    n_unique = int(series.nunique())
    is_numeric = pd.api.types.is_numeric_dtype(series)

    # Use per-value mode for low-cardinality columns (even if numeric)
    per_value_mode = not is_numeric or n_unique <= 15

    if not per_value_mode:
        # Histogram mode for high-cardinality numeric columns
        counts, bin_edges = np.histogram(series, bins=min(n_bins, n_unique))
        bins = []
        for i in range(len(counts)):
            if i < len(counts) - 1:
                mask = (series >= bin_edges[i]) & (series < bin_edges[i + 1])
            else:
                mask = (series >= bin_edges[i]) & (series <= bin_edges[i + 1])

            mean_y = None
            if target_column:
                y_vals = df.loc[series[mask].index, target_column].dropna()
                if len(y_vals) > 0:
                    mean_y = float(y_vals.mean())

            bins.append({
                "label": f"{bin_edges[i]:.1f}–{bin_edges[i + 1]:.1f}",
                "start": float(bin_edges[i]),
                "end": float(bin_edges[i + 1]),
                "count": int(counts[i]),
                "midpoint": float((bin_edges[i] + bin_edges[i + 1]) / 2),
                "mean_y": mean_y,
            })
        chart_type = "histogram"
    else:
        # Per-value mode for categorical or low-cardinality numeric
        vc = series.value_counts().head(20).sort_index()
        bins = []
        for val, count in vc.items():
            mask = series == val

            mean_y = None
            if target_column:
                y_vals = df.loc[series[mask].index, target_column].dropna()
                if len(y_vals) > 0:
                    mean_y = float(y_vals.mean())

            bins.append({
                "label": str(val),
                "count": int(count),
                "midpoint": float(val) if is_numeric else 0,
                "mean_y": mean_y,
            })
        chart_type = "per_value"

    # --- KDE (numeric only, need >= 2 unique values) ---
    kde_points = None
    if is_numeric and n_unique >= 2:
        try:
            kde = scipy_stats.gaussian_kde(series.astype(float))
            x_min, x_max = float(series.min()), float(series.max())
            xs = np.linspace(x_min, x_max, 100)
            densities = kde(xs)
            kde_points = [
                {"x": round(float(x), 6), "density": round(float(d), 8)}
                for x, d in zip(xs, densities)
            ]
        except Exception:
            kde_points = None

    # --- Box stats (numeric only) ---
    box_stats = None
    if is_numeric:
        try:
            arr = series.astype(float).values
            q1, median, q3 = float(np.percentile(arr, 25)), float(np.percentile(arr, 50)), float(np.percentile(arr, 75))
            iqr = q3 - q1
            lower_fence = q1 - 1.5 * iqr
            upper_fence = q3 + 1.5 * iqr
            non_outliers = arr[(arr >= lower_fence) & (arr <= upper_fence)]
            outlier_vals = arr[(arr < lower_fence) | (arr > upper_fence)]
            sorted_out = sorted(outlier_vals.tolist())
            if len(sorted_out) > 100:
                half = 50
                sorted_out = sorted_out[:half] + sorted_out[-half:]
            box_stats = {
                "min": round(float(non_outliers.min()) if len(non_outliers) else q1, 6),
                "q1": round(q1, 6),
                "median": round(median, 6),
                "q3": round(q3, 6),
                "max": round(float(non_outliers.max()) if len(non_outliers) else q3, 6),
                "outliers": [round(float(v), 6) for v in sorted_out],
            }
        except Exception:
            box_stats = None

    # --- CDF (works for both numeric and categorical) ---
    cdf = None
    if bins:
        total_count = sum(b["count"] for b in bins)
        if total_count > 0:
            running = 0
            cdf = []
            for b in bins:
                running += b["count"]
                cdf.append({
                    "label": b["label"],
                    "cumulative_pct": round(running / total_count * 100, 2),
                })

    return {
        "column": column,
        "col_type": "numeric" if is_numeric else "categorical",
        "chart_type": chart_type,
        "total": int(len(series)),
        "unique": n_unique,
        "n_nan": n_nan,
        "bins": bins,
        "kde_points": kde_points,
        "box_stats": box_stats,
        "cdf": cdf,
    }


@app.post("/correlation-matrix")
def correlation_matrix(
    body: CorrelationRequest,
) -> dict[str, Any]:
    df = _get_df(body.session_id)

    if body.method not in ("pearson", "spearman", "kendall"):
        raise _error("method must be 'pearson', 'spearman', or 'kendall'.")
    if body.columns:
        missing = [c for c in (body.columns or []) if c not in df.columns]
        if missing:
            raise _error(f"Columns not found: {missing}")

    try:
        result = compute_correlation_matrix(df=df, columns=body.columns, method=body.method)
    except Exception as e:
        raise _error(f"Correlation matrix failed: {e}")

    return result


@app.get("/models")
def list_models(
    problem_type: str = "regression",
) -> dict[str, Any]:
    """Return the list of available model names for the given problem type."""
    if problem_type not in ("regression", "classification"):
        raise _error("problem_type must be 'regression' or 'classification'.")
    return {"problem_type": problem_type, "models": get_available_models(problem_type)}


@app.post("/engineer-feature")
def engineer_feature(
    body: EngineerFeatureRequest,
) -> dict[str, Any]:
    """Create a new derived feature column in the session."""
    df = _get_df(body.session_id)

    for col in (body.col_a, body.col_b):
        if col not in df.columns:
            raise _error(f"Column '{col}' not found in dataset.")

    if not pd.api.types.is_numeric_dtype(df[body.col_a]):
        raise _error(f"Column '{body.col_a}' must be numeric for feature engineering.")
    if not pd.api.types.is_numeric_dtype(df[body.col_b]):
        raise _error(f"Column '{body.col_b}' must be numeric for feature engineering.")

    if body.operation not in ("add", "subtract", "multiply", "divide"):
        raise _error("operation must be 'add', 'subtract', 'multiply', or 'divide'.")

    op_symbol = {"add": "+", "subtract": "−", "multiply": "×", "divide": "÷"}[body.operation]
    default_name = f"{body.col_a}_{op_symbol}_{body.col_b}"
    new_name = (body.new_name or default_name).strip()

    if not new_name:
        raise _error("new_name cannot be empty.")
    if new_name in df.columns:
        raise _error(f"Column '{new_name}' already exists. Choose a different name.")

    if body.operation == "add":
        df[new_name] = df[body.col_a] + df[body.col_b]
    elif body.operation == "subtract":
        df[new_name] = df[body.col_a] - df[body.col_b]
    elif body.operation == "multiply":
        df[new_name] = df[body.col_a] * df[body.col_b]
    else:  # divide
        safe_b = df[body.col_b].replace(0, float("nan"))
        df[new_name] = df[body.col_a] / safe_b

    _sessions[body.session_id] = df

    return {
        "success": True,
        "new_column": new_name,
        "columns": list(df.columns),
        "n_columns": len(df.columns),
    }


@app.post("/drop-feature")
def drop_feature(
    body: DropFeatureRequest,
) -> dict[str, Any]:
    """Remove a column from the session dataset."""
    df = _get_df(body.session_id)

    if body.column not in df.columns:
        raise _error(f"Column '{body.column}' not found.")
    if len(df.columns) <= 2:
        raise _error("Cannot drop column — dataset must have at least 2 columns.")

    df = df.drop(columns=[body.column])
    _sessions[body.session_id] = df

    return {"success": True, "dropped": body.column, "columns": list(df.columns)}


@app.post("/train")
def train(
    body: TrainRequest,
) -> dict[str, Any]:
    df = _get_df(body.session_id)

    if body.target_column not in df.columns:
        raise _error(f"Column '{body.target_column}' not found.")
    missing_features = [f for f in body.feature_columns if f not in df.columns]
    if missing_features:
        raise _error(f"Feature columns not found: {missing_features}")
    if body.problem_type not in ("regression", "classification"):
        raise _error("problem_type must be 'regression' or 'classification'.")
    if not 0.05 <= body.test_size <= 0.5:
        raise _error("test_size must be between 0.05 and 0.5.")
    if len(body.feature_columns) < 1:
        raise _error("At least one feature column required.")

    valid_cv = ("train_test_split", "k_fold", "stratified_k_fold", "loo")
    if body.cv_strategy not in valid_cv:
        raise _error(f"cv_strategy must be one of: {', '.join(valid_cv)}")
    if body.cv_folds < 2 or body.cv_folds > 20:
        raise _error("cv_folds must be between 2 and 20.")

    try:
        result = train_models(
            df=df,
            target_col=body.target_column,
            problem_type=body.problem_type,
            feature_columns=body.feature_columns,
            test_size=body.test_size,
            models_to_train=body.models_to_train,
            cv_strategy=body.cv_strategy,
            cv_folds=body.cv_folds,
        )
    except Exception as e:
        raise _error(f"Model training failed: {e}")

    return result


@app.delete("/session/{session_id}")
def delete_session(
    session_id: str,
) -> dict:
    """Remove a session and free its memory."""
    _sessions.pop(session_id, None)
    return {"deleted": session_id}
