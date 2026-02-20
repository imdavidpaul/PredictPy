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
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
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
from model_trainer import apply_meta, evaluate_model, get_available_models, train_models

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
# session_id -> {"model": fitted_model, "meta": preprocessing_meta}
_best_models: dict[str, dict[str, Any]] = {}


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


class TransformFeatureRequest(BaseModel):
    session_id: str
    transform: str  # see VALID_TRANSFORMS below
    column: str | None = None            # single-column transforms
    columns: list[str] | None = None     # multi-column transforms (polynomial)
    new_name: str | None = None          # custom output column name
    # Transform-specific params
    n_bins: int = 5                      # for "binning"
    clip_lower: float | None = None      # for "clip_outliers" (percentile 0-100)
    clip_upper: float | None = None      # for "clip_outliers" (percentile 0-100)


VALID_TRANSFORMS = (
    "log1p", "sqrt", "square", "reciprocal",
    "power_transform", "binning", "clip_outliers",
    "polynomial",
)


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

    MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
    if len(contents) > MAX_UPLOAD_BYTES:
        raise _error("Oops! Not Today, we only accept <50MB file")

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


# ---------------------------------------------------------------------------
# Endpoints -- Advanced Feature Engineering (Transforms)
# ---------------------------------------------------------------------------

@app.post("/transform-feature")
def transform_feature(
    body: TransformFeatureRequest,
) -> dict[str, Any]:
    """
    Apply a mathematical or statistical transform to create new feature(s).

    Supported transforms:
      Single-column (requires 'column'):
        log1p        - log(1 + x), works for non-negative data
        sqrt         - sqrt(x), works for non-negative data
        square       - x^2
        reciprocal   - 1/x (zeros become NaN)
        power_transform - Yeo-Johnson power transform (handles negatives)
        binning      - Quantile-based binning into n_bins categories
        clip_outliers - Winsorize: clip values outside [lower, upper] percentiles

      Multi-column (requires 'columns', list of 2+ numeric columns):
        polynomial   - Degree-2 polynomial features: A^2, B^2, A*B for each pair
    """
    df = _get_df(body.session_id)

    if body.transform not in VALID_TRANSFORMS:
        raise _error(
            f"Unknown transform '{body.transform}'. "
            f"Valid: {', '.join(VALID_TRANSFORMS)}"
        )

    created_columns: list[str] = []

    # --- Single-column transforms ---
    if body.transform in ("log1p", "sqrt", "square", "reciprocal", "power_transform", "binning", "clip_outliers"):
        if not body.column:
            raise _error(f"Transform '{body.transform}' requires a 'column' parameter.")
        if body.column not in df.columns:
            raise _error(f"Column '{body.column}' not found in dataset.")
        if not pd.api.types.is_numeric_dtype(df[body.column]):
            raise _error(f"Column '{body.column}' must be numeric for transform '{body.transform}'.")

        series = df[body.column].copy()

        if body.transform == "log1p":
            if (series.dropna() < 0).any():
                raise _error(
                    f"Column '{body.column}' contains negative values. "
                    "log1p requires non-negative data. Consider clip_outliers or power_transform instead."
                )
            new_col_name = body.new_name or f"{body.column}_log1p"
            result_series = np.log1p(series)

        elif body.transform == "sqrt":
            if (series.dropna() < 0).any():
                raise _error(
                    f"Column '{body.column}' contains negative values. "
                    "sqrt requires non-negative data. Consider power_transform instead."
                )
            new_col_name = body.new_name or f"{body.column}_sqrt"
            result_series = np.sqrt(series)

        elif body.transform == "square":
            new_col_name = body.new_name or f"{body.column}_sq"
            result_series = series ** 2

        elif body.transform == "reciprocal":
            new_col_name = body.new_name or f"{body.column}_inv"
            safe = series.replace(0, float("nan"))
            result_series = 1.0 / safe

        elif body.transform == "power_transform":
            from sklearn.preprocessing import PowerTransformer
            new_col_name = body.new_name or f"{body.column}_yj"
            pt = PowerTransformer(method="yeo-johnson", standardize=False)
            filled = series.fillna(series.median()).values.reshape(-1, 1)
            transformed = pt.fit_transform(filled).flatten()
            result_series = pd.Series(transformed, index=series.index, name=new_col_name)
            # Restore NaN positions
            result_series[series.isna()] = float("nan")

        elif body.transform == "binning":
            if body.n_bins < 2 or body.n_bins > 20:
                raise _error("n_bins must be between 2 and 20.")
            new_col_name = body.new_name or f"{body.column}_bin{body.n_bins}"
            try:
                result_series = pd.qcut(series, q=body.n_bins, labels=False, duplicates="drop")
            except ValueError:
                # Fallback to equal-width if quantile fails (too few unique values)
                result_series = pd.cut(series, bins=body.n_bins, labels=False)

        elif body.transform == "clip_outliers":
            lower_pct = body.clip_lower if body.clip_lower is not None else 1.0
            upper_pct = body.clip_upper if body.clip_upper is not None else 99.0
            if not (0 <= lower_pct < upper_pct <= 100):
                raise _error("clip_lower must be < clip_upper, both in [0, 100].")
            new_col_name = body.new_name or f"{body.column}_clipped"
            lo_val = float(np.nanpercentile(series, lower_pct))
            hi_val = float(np.nanpercentile(series, upper_pct))
            result_series = series.clip(lower=lo_val, upper=hi_val)

        else:
            raise _error(f"Unhandled transform: {body.transform}")

        if new_col_name in df.columns:
            raise _error(f"Column '{new_col_name}' already exists. Provide a different new_name.")

        df[new_col_name] = result_series
        created_columns.append(new_col_name)

    # --- Multi-column transforms ---
    elif body.transform == "polynomial":
        cols = body.columns or []
        if len(cols) < 2:
            raise _error("Polynomial transform requires at least 2 columns.")
        for c in cols:
            if c not in df.columns:
                raise _error(f"Column '{c}' not found in dataset.")
            if not pd.api.types.is_numeric_dtype(df[c]):
                raise _error(f"Column '{c}' must be numeric for polynomial features.")

        # Generate squared terms and cross terms
        for c in cols:
            sq_name = f"{c}_sq"
            if sq_name not in df.columns:
                df[sq_name] = df[c] ** 2
                created_columns.append(sq_name)

        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                cross_name = f"{cols[i]}_x_{cols[j]}"
                if cross_name not in df.columns:
                    df[cross_name] = df[cols[i]] * df[cols[j]]
                    created_columns.append(cross_name)

    _sessions[body.session_id] = df

    return {
        "success": True,
        "transform": body.transform,
        "created_columns": created_columns,
        "columns": list(df.columns),
        "n_columns": len(df.columns),
    }


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
        result, (best_model_obj, meta) = train_models(
            df=df,
            target_col=body.target_column,
            problem_type=body.problem_type,
            feature_columns=body.feature_columns,
            test_size=body.test_size,
            models_to_train=body.models_to_train,
            cv_strategy=body.cv_strategy,
            cv_folds=body.cv_folds,
        )
        _best_models[body.session_id] = {"model": best_model_obj, "meta": meta}
    except Exception as e:
        raise _error(f"Model training failed: {e}")

    return result


@app.post("/evaluate")
async def evaluate(
    session_id: str = Form(...),
    target_column: str = Form(...),
    problem_type: str = Form(...),
    feature_columns: str = Form(...),  # JSON string of list
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """
    Evaluate the best trained model from the session on a NEW uploaded dataset.
    """
    import json
    feature_cols = json.loads(feature_columns)

    model_data = _best_models.get(session_id)
    if model_data is None:
        raise HTTPException(
            status_code=400,
            detail="No trained model found for this session. Please train a model first.",
        )
    model = model_data["model"]
    meta = model_data["meta"]

    # Read the evaluation file
    contents = await file.read()
    try:
        df_eval = parse_file(contents, file.filename)
    except Exception as e:
        raise _error(f"Could not parse evaluation file: {e}")

    # Check for required columns
    missing = [c for c in [target_column] + feature_cols if c not in df_eval.columns]
    if missing:
        raise _error(f"Evaluation dataset is missing required columns: {missing}")

    try:
        result = evaluate_model(
            model=model,
            df=df_eval,
            target_col=target_column,
            feature_columns=feature_cols,
            problem_type=problem_type,
            meta=meta,
        )
    except Exception as e:
        raise _error(f"Evaluation failed: {e}")

    return result


class PredictRequest(BaseModel):
    session_id: str
    feature_values: dict[str, float | str | int]


@app.post("/predict")
def predict_single(body: PredictRequest) -> dict[str, Any]:
    """
    Single-row real-time prediction using stored model + preprocessing meta.
    Returns prediction, optional probabilities, prediction interval (RF regression), and warnings.
    """
    model_data = _best_models.get(body.session_id)
    if model_data is None:
        raise HTTPException(
            status_code=400,
            detail="No trained model found for this session. Please train a model first.",
        )
    model = model_data["model"]
    meta = model_data["meta"]
    feature_cols = meta["feature_columns"]

    # Build one-row DataFrame from provided feature values
    row = {col: [body.feature_values.get(col)] for col in feature_cols}
    X_df = pd.DataFrame(row)

    # Check extrapolation before encoding (on raw numeric values)
    extra_warnings: list[str] = []
    for col in feature_cols:
        if col in meta["ranges"] and col in body.feature_values:
            val = body.feature_values[col]
            if isinstance(val, (int, float)):
                lo, hi = meta["ranges"][col]
                if val < lo or val > hi:
                    extra_warnings.append(
                        f"'{col}' value {val} is outside training range [{lo:.4g}, {hi:.4g}]"
                    )

    # Apply stored preprocessing
    X_processed, meta_warnings = apply_meta(X_df, meta)
    warnings = meta_warnings + extra_warnings

    try:
        raw_pred = model.predict(X_processed)[0]
    except Exception as e:
        raise _error(f"Prediction failed: {e}")

    prediction: float | str
    if isinstance(raw_pred, (int, float, np.integer, np.floating)):
        prediction = round(float(raw_pred), 6)
    else:
        prediction = str(raw_pred)

    # Decode classification prediction via target encoder
    if meta["target_encoder"] is not None and isinstance(raw_pred, (int, float, np.integer, np.floating)):
        try:
            prediction = str(meta["target_encoder"].inverse_transform([int(round(float(raw_pred)))])[0])
        except Exception:
            pass

    result: dict[str, Any] = {"prediction": prediction, "warnings": warnings}

    # Probabilities (classification)
    if hasattr(model, "predict_proba"):
        try:
            proba = model.predict_proba(X_processed)[0]
            te = meta["target_encoder"]
            classes = te.classes_ if te is not None else [str(i) for i in range(len(proba))]
            result["probabilities"] = {
                str(cls): round(float(p), 6) for cls, p in zip(classes, proba)
            }
        except Exception:
            pass

    # Prediction interval via RF tree ensemble (regression)
    if hasattr(model, "estimators_"):
        try:
            tree_preds = np.array([t.predict(X_processed)[0] for t in model.estimators_])
            result["prediction_interval"] = {
                "lower_95": round(float(np.percentile(tree_preds, 2.5)), 6),
                "upper_95": round(float(np.percentile(tree_preds, 97.5)), 6),
            }
        except Exception:
            pass

    return result


@app.post("/predict-batch")
async def predict_batch(
    session_id: str = Form(...),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """
    Batch prediction: upload a CSV/XLSX without the target column, get predictions back.
    """
    model_data = _best_models.get(session_id)
    if model_data is None:
        raise HTTPException(
            status_code=400,
            detail="No trained model found for this session. Please train a model first.",
        )
    model = model_data["model"]
    meta = model_data["meta"]

    contents = await file.read()
    try:
        df_batch = parse_file(contents, file.filename)
    except Exception as e:
        raise _error(f"Could not parse batch file: {e}")

    if df_batch.shape[0] == 0:
        raise _error("Batch file has no rows.")

    # Only use columns that exist in both the file and training features
    available_features = [c for c in meta["feature_columns"] if c in df_batch.columns]
    missing_features = [c for c in meta["feature_columns"] if c not in df_batch.columns]

    X_df = df_batch.reindex(columns=meta["feature_columns"])  # fill missing cols with NaN
    X_processed, warnings = apply_meta(X_df, meta)

    try:
        raw_preds = model.predict(X_processed)
    except Exception as e:
        raise _error(f"Batch prediction failed: {e}")

    # Decode predictions for classification
    te = meta["target_encoder"]
    if te is not None:
        try:
            decoded = [str(te.inverse_transform([int(round(float(p)))])[0]) for p in raw_preds]
        except Exception:
            decoded = [str(p) for p in raw_preds]
        predictions_out: list = decoded
    else:
        predictions_out = [round(float(p), 6) for p in raw_preds]

    result: dict[str, Any] = {
        "predictions": predictions_out,
        "n_rows": len(predictions_out),
        "warnings": warnings,
        "missing_features": missing_features,
    }

    # Probabilities (classification)
    if hasattr(model, "predict_proba"):
        try:
            proba_matrix = model.predict_proba(X_processed)
            classes = te.classes_ if te is not None else [str(i) for i in range(proba_matrix.shape[1])]
            result["probabilities"] = [
                {str(cls): round(float(p), 6) for cls, p in zip(classes, row)}
                for row in proba_matrix
            ]
        except Exception:
            pass

    return result


@app.delete("/session/{session_id}")
def delete_session(
    session_id: str,
) -> dict:
    """Remove a session and free its memory."""
    _sessions.pop(session_id, None)
    return {"deleted": session_id}


# ---------------------------------------------------------------------------
# Phase 1: Outlier Detection
# ---------------------------------------------------------------------------

class OutlierRequest(BaseModel):
    session_id: str
    columns: list[str] | None = None


@app.post("/outliers")
def get_outliers(body: OutlierRequest) -> dict[str, Any]:
    """
    Detect outliers per column using Z-score (|z|>3) and IQR methods.
    Returns per-column counts and percentages.
    """
    df = _get_df(body.session_id)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    if body.columns:
        cols = [c for c in body.columns if c in numeric_cols]
    else:
        cols = numeric_cols

    results = []
    n = len(df)
    for col in cols:
        series = df[col].dropna()
        if len(series) < 4:
            continue
        # Z-score outliers
        z_scores = np.abs(scipy_stats.zscore(series.astype(float)))
        z_count = int((z_scores > 3).sum())

        # IQR outliers
        q1, q3 = float(series.quantile(0.25)), float(series.quantile(0.75))
        iqr = q3 - q1
        iqr_count = int(((series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)).sum())

        results.append({
            "column": col,
            "z_score_count": z_count,
            "iqr_count": iqr_count,
            "z_score_pct": round(z_count / n * 100, 2) if n > 0 else 0.0,
            "iqr_pct": round(iqr_count / n * 100, 2) if n > 0 else 0.0,
            "n_valid": int(len(series)),
        })

    return {"outliers": results, "n_rows": n}


# ---------------------------------------------------------------------------
# Phase 1: VIF (Multicollinearity) Scores
# ---------------------------------------------------------------------------

class VIFRequest(BaseModel):
    session_id: str
    feature_columns: list[str]


@app.post("/vif")
def get_vif(body: VIFRequest) -> dict[str, Any]:
    """
    Compute Variance Inflation Factor (VIF) for selected feature columns.
    Returns [{feature, vif}] sorted descending by VIF.
    """
    try:
        from statsmodels.stats.outliers_influence import variance_inflation_factor
    except ImportError:
        raise _error("statsmodels is not installed.", 500)

    df = _get_df(body.session_id)
    numeric_cols = [c for c in body.feature_columns if c in df.columns and pd.api.types.is_numeric_dtype(df[c])]

    if len(numeric_cols) < 2:
        raise _error("At least 2 numeric feature columns are required to compute VIF.")

    subset = df[numeric_cols].copy()
    for col in subset.columns:
        subset[col] = subset[col].fillna(subset[col].median())

    # Drop columns with zero variance
    subset = subset.loc[:, subset.std() > 0]
    cols = list(subset.columns)

    if len(cols) < 2:
        raise _error("Not enough variance in selected columns to compute VIF.")

    X = subset.values.astype(float)
    vif_data = []
    for i, col in enumerate(cols):
        try:
            vif_val = float(variance_inflation_factor(X, i))
            vif_val = None if np.isinf(vif_val) or np.isnan(vif_val) else round(vif_val, 4)
        except Exception:
            vif_val = None
        vif_data.append({"feature": col, "vif": vif_val})

    vif_data.sort(key=lambda x: (x["vif"] is None, x["vif"] or 0), reverse=True)
    return {"vif": vif_data}


# ---------------------------------------------------------------------------
# Phase 3: Learning Curves
# ---------------------------------------------------------------------------

class LearningCurveRequest(BaseModel):
    session_id: str
    target_column: str
    feature_columns: list[str]
    problem_type: str
    model_name: str = "Random Forest"


@app.post("/learning-curve")
def get_learning_curve(body: LearningCurveRequest) -> dict[str, Any]:
    """
    Compute learning curve: train at 5 dataset size fractions (10%→100%).
    Returns [{train_size, train_score, val_score}].
    """
    from model_trainer import _prepare, REGRESSION_MODELS, CLASSIFICATION_MODELS

    df = _get_df(body.session_id)

    if body.target_column not in df.columns:
        raise _error(f"Column '{body.target_column}' not found.")
    missing = [c for c in body.feature_columns if c not in df.columns]
    if missing:
        raise _error(f"Feature columns not found: {missing}")
    if body.problem_type not in ("regression", "classification"):
        raise _error("problem_type must be 'regression' or 'classification'.")

    registry = REGRESSION_MODELS if body.problem_type == "regression" else CLASSIFICATION_MODELS
    if body.model_name not in registry:
        raise _error(f"Model '{body.model_name}' not available.")

    try:
        X, y, _ = _prepare(df, body.target_column, body.feature_columns)
    except Exception as e:
        raise _error(f"Preprocessing failed: {e}")

    scoring = "r2" if body.problem_type == "regression" else "f1_weighted"
    fractions = [0.1, 0.25, 0.5, 0.75, 1.0]
    results = []
    n = len(X)

    for frac in fractions:
        size = max(10, int(n * frac))
        if size >= n:
            X_sub, y_sub = X, y
        else:
            idx = np.random.default_rng(42).integers(0, n, size=size)
            X_sub = X.iloc[idx]
            y_sub = y.iloc[idx]

        if len(X_sub) < 4:
            continue

        from sklearn.model_selection import cross_val_score
        try:
            model_factory = registry[body.model_name]
            cv = min(5, len(X_sub))
            scores = cross_val_score(model_factory(), X_sub, y_sub, cv=cv, scoring=scoring, n_jobs=-1)
            # Train score: fit on subset, score on subset
            m = model_factory()
            m.fit(X_sub, y_sub)
            from sklearn.metrics import r2_score as _r2, f1_score as _f1, accuracy_score as _acc
            if body.problem_type == "regression":
                train_score = float(_r2(y_sub, m.predict(X_sub)))
            else:
                train_score = float(_f1(y_sub, m.predict(X_sub), average="weighted", zero_division=0))
            results.append({
                "train_size": size,
                "train_score": round(train_score, 6),
                "val_score": round(float(scores.mean()), 6),
                "val_std": round(float(scores.std()), 6),
            })
        except Exception:
            continue

    return {"learning_curve": results, "scoring": scoring}


# ---------------------------------------------------------------------------
# Phase 3: Partial Dependence Plots
# ---------------------------------------------------------------------------

class PDPRequest(BaseModel):
    session_id: str
    feature_column: str


@app.post("/pdp")
def get_pdp(body: PDPRequest) -> dict[str, Any]:
    """
    Compute partial dependence for a feature using the stored best model.
    Returns {values, average} arrays.
    """
    from sklearn.inspection import partial_dependence

    model_data = _best_models.get(body.session_id)
    if model_data is None:
        raise HTTPException(
            status_code=400,
            detail="No trained model found for this session. Train a model first.",
        )
    model = model_data["model"]
    meta = model_data["meta"]
    feature_cols = meta["feature_columns"]

    if body.feature_column not in feature_cols:
        raise _error(f"Feature '{body.feature_column}' was not used in training.")

    df = _get_df(body.session_id)
    from model_trainer import apply_meta
    X, _ = apply_meta(df[feature_cols], meta)

    feat_idx = feature_cols.index(body.feature_column)

    try:
        pdp_result = partial_dependence(model, X, features=[feat_idx], grid_resolution=50, kind="average")
        values = pdp_result["grid_values"][0].tolist()
        average = pdp_result["average"][0].tolist()
        return {
            "feature": body.feature_column,
            "values": [round(float(v), 6) for v in values],
            "average": [round(float(a), 6) for a in average],
        }
    except Exception as e:
        raise _error(f"PDP computation failed: {e}")


# ---------------------------------------------------------------------------
# Phase 4: SHAP Values
# ---------------------------------------------------------------------------

# Model types used for explainer selection
_TREE_MODEL_TYPES: tuple[str, ...] = (
    "RandomForestRegressor", "RandomForestClassifier",
    "GradientBoostingRegressor", "GradientBoostingClassifier",
    "ExtraTreesRegressor", "ExtraTreesClassifier",
    "XGBRegressor", "XGBClassifier",
    "LGBMRegressor", "LGBMClassifier",
    "CatBoostRegressor", "CatBoostClassifier",
)

_LINEAR_MODEL_TYPES: tuple[str, ...] = (
    "LinearRegression", "Ridge", "Lasso",
    "LogisticRegression",
)


def _get_model_class_name(model: Any) -> str:
    """Return the class name of the underlying model, unwrapping pipelines."""
    return type(model).__name__


def _is_tree_model(model: Any) -> bool:
    return _get_model_class_name(model) in _TREE_MODEL_TYPES


def _is_linear_model(model: Any) -> bool:
    return _get_model_class_name(model) in _LINEAR_MODEL_TYPES


class SHAPRequest(BaseModel):
    session_id: str
    max_samples: int = 500


@app.post("/shap")
def get_shap(body: SHAPRequest) -> dict[str, Any]:
    """
    Compute SHAP values for the stored best model.

    Explainer selection:
      - TreeExplainer   for tree-based models (RF, XGBoost, LightGBM, CatBoost, etc.)
      - LinearExplainer for linear models (Ridge, Lasso, LinearRegression, LogisticRegression)
      - KernelExplainer as fallback (sampled to max 100 background rows for speed)

    Returns:
      - mean_abs_shap: global importance per feature (mean |SHAP value|)
      - sample_shap:   per-sample SHAP values (top 50 rows) for beeswarm/waterfall
      - feature_columns, n_samples, method
    """
    model_data = _best_models.get(body.session_id)
    if model_data is None:
        raise HTTPException(
            status_code=400,
            detail="No trained model found for this session. Train a model first.",
        )
    model = model_data["model"]
    meta = model_data["meta"]
    feature_cols = meta["feature_columns"]

    df = _get_df(body.session_id)
    from model_trainer import apply_meta
    X, _ = apply_meta(df[feature_cols], meta)

    # --- Try SHAP library ---
    try:
        import shap as _shap

        if _is_tree_model(model):
            # TreeExplainer is fast -- use all available data (up to max_samples)
            n = min(body.max_samples, len(X))
            X_sample = X.iloc[:n]
            explainer = _shap.TreeExplainer(model)
            shap_values = explainer.shap_values(X_sample)
        elif _is_linear_model(model):
            n = min(body.max_samples, len(X))
            X_sample = X.iloc[:n]
            explainer = _shap.LinearExplainer(model, X_sample)
            shap_values = explainer.shap_values(X_sample)
        else:
            # KernelExplainer fallback -- slow, so limit both background and explain sets
            n = min(100, len(X))
            X_sample = X.iloc[:n]
            background = _shap.sample(X, min(50, len(X)))
            explainer = _shap.KernelExplainer(model.predict, background)
            shap_values = explainer.shap_values(X_sample, nsamples=200)

        # Normalize shape: shap_values can be:
        #   - ndarray (n_samples, n_features) for regression / binary
        #   - list of ndarrays for multi-class classification
        #   - Explanation object (shap >= 0.40)
        if hasattr(shap_values, "values"):
            # shap.Explanation object
            shap_arr = np.array(shap_values.values)
        elif isinstance(shap_values, list):
            # Multi-class: list of arrays, each (n_samples, n_features)
            # Average absolute values across classes to get a single (n_samples, n_features)
            stacked = np.array(shap_values)  # (n_classes, n_samples, n_features)
            shap_arr = np.abs(stacked).mean(axis=0)  # (n_samples, n_features)
        else:
            shap_arr = np.array(shap_values)

        # Handle 3D arrays from some explainers (n_classes, n_samples, n_features)
        if shap_arr.ndim == 3:
            shap_arr = np.abs(shap_arr).mean(axis=0)

        # Global importance: mean |SHAP| per feature
        mean_abs = np.abs(shap_arr).mean(axis=0)

        # Per-sample values: return top 50 rows for beeswarm/waterfall charts
        n_sample_rows = min(50, shap_arr.shape[0])
        sample_shap = shap_arr[:n_sample_rows].tolist()

        # Feature values for the same sample rows (needed for beeswarm coloring)
        sample_feature_values = X_sample.iloc[:n_sample_rows].values.tolist()

        method = "shap"

    except ImportError:
        # SHAP not installed -- fall back to model-native importance
        logger.warning("shap library not installed; falling back to model-native importance.")
        n = len(X)
        sample_shap = []
        sample_feature_values = []

        if hasattr(model, "feature_importances_"):
            mean_abs = model.feature_importances_
            method = "model_importance"
        elif hasattr(model, "coef_"):
            coef = model.coef_
            mean_abs = np.abs(coef).mean(axis=0) if coef.ndim > 1 else np.abs(coef)
            method = "coefficients"
        else:
            mean_abs = np.ones(len(feature_cols)) / len(feature_cols)
            method = "uniform"

    except Exception as e:
        logger.error("SHAP computation failed: %s", e, exc_info=True)
        raise _error(f"SHAP computation failed: {e}")

    # Build sorted global importance list
    feature_shap = [
        {"feature": col, "value": round(float(v), 6)}
        for col, v in zip(feature_cols, mean_abs)
    ]
    feature_shap.sort(key=lambda x: x["value"], reverse=True)

    return {
        "mean_abs_shap": feature_shap,
        "sample_shap": sample_shap,
        "sample_feature_values": sample_feature_values,
        "n_samples": n,
        "feature_columns": feature_cols,
        "method": method,
    }


# ---------------------------------------------------------------------------
# Phase 4: RFECV
# ---------------------------------------------------------------------------

class RFECVRequest(BaseModel):
    session_id: str
    target_column: str
    feature_columns: list[str]
    problem_type: str


@app.post("/rfecv")
def run_rfecv(body: RFECVRequest) -> dict[str, Any]:
    """
    Run RFECV with RF estimator to find optimal feature subset.
    Returns {optimal_features, ranking, cv_scores}.
    """
    from sklearn.feature_selection import RFECV

    df = _get_df(body.session_id)
    if body.target_column not in df.columns:
        raise _error(f"Column '{body.target_column}' not found.")
    missing = [c for c in body.feature_columns if c not in df.columns]
    if missing:
        raise _error(f"Columns not found: {missing}")
    if body.problem_type not in ("regression", "classification"):
        raise _error("problem_type must be 'regression' or 'classification'.")

    from model_trainer import _prepare, REGRESSION_MODELS, CLASSIFICATION_MODELS
    try:
        X, y, _ = _prepare(df, body.target_column, body.feature_columns)
    except Exception as e:
        raise _error(f"Preprocessing failed: {e}")

    if body.problem_type == "regression":
        from sklearn.ensemble import RandomForestRegressor
        estimator = RandomForestRegressor(n_estimators=50, random_state=42, n_jobs=-1)
        scoring = "r2"
        from sklearn.model_selection import KFold
        cv = KFold(n_splits=min(5, len(X)), shuffle=True, random_state=42)
    else:
        from sklearn.ensemble import RandomForestClassifier
        estimator = RandomForestClassifier(n_estimators=50, random_state=42, n_jobs=-1)
        scoring = "f1_weighted"
        from sklearn.model_selection import StratifiedKFold
        cv = StratifiedKFold(n_splits=min(5, len(X)), shuffle=True, random_state=42)

    try:
        selector = RFECV(estimator=estimator, step=1, cv=cv, scoring=scoring, min_features_to_select=1, n_jobs=-1)
        selector.fit(X, y)
        feature_arr = list(X.columns)
        optimal = [feature_arr[i] for i, s in enumerate(selector.support_) if s]
        ranking = [{"feature": f, "rank": int(r)} for f, r in zip(feature_arr, selector.ranking_)]
        ranking.sort(key=lambda x: x["rank"])
        cv_scores_arr = selector.cv_results_["mean_test_score"] if hasattr(selector, "cv_results_") else []
        return {
            "optimal_features": optimal,
            "n_optimal": len(optimal),
            "ranking": ranking,
            "cv_scores": [round(float(s), 6) for s in cv_scores_arr],
        }
    except Exception as e:
        raise _error(f"RFECV failed: {e}")


# ---------------------------------------------------------------------------
# Phase 4: Hyperparameter Tuning
# ---------------------------------------------------------------------------

class TuneRequest(BaseModel):
    session_id: str
    target_column: str
    feature_columns: list[str]
    problem_type: str
    model_name: str


# Param grids per model
_PARAM_GRIDS: dict[str, dict[str, list]] = {
    "Random Forest": {
        "n_estimators": [50, 100, 200],
        "max_depth": [None, 5, 10, 20],
        "min_samples_split": [2, 5, 10],
        "min_samples_leaf": [1, 2, 4],
    },
    "Ridge Regression": {"alpha": [0.01, 0.1, 1.0, 10.0, 100.0]},
    "LASSO": {"alpha": [0.001, 0.01, 0.1, 1.0, 10.0]},
    "Logistic Regression": {
        "C": [0.01, 0.1, 1.0, 10.0, 100.0],
        "penalty": ["l2"],
        "max_iter": [1000],
    },
    "XGBoost": {
        "n_estimators": [100, 300],
        "learning_rate": [0.01, 0.05, 0.1],
        "max_depth": [3, 6, 9],
        "subsample": [0.7, 0.9, 1.0],
    },
    "LightGBM": {
        "n_estimators": [100, 300],
        "learning_rate": [0.01, 0.05, 0.1],
        "num_leaves": [15, 31, 63],
        "subsample": [0.7, 0.9, 1.0],
    },
}


@app.post("/tune")
def tune_hyperparams(body: TuneRequest) -> dict[str, Any]:
    """
    Run RandomizedSearchCV (n_iter=20, cv=3) for the specified model.
    Returns {best_params, best_score, results}.
    """
    from sklearn.model_selection import RandomizedSearchCV
    from model_trainer import _prepare, REGRESSION_MODELS, CLASSIFICATION_MODELS

    df = _get_df(body.session_id)
    if body.target_column not in df.columns:
        raise _error(f"Column '{body.target_column}' not found.")
    missing = [c for c in body.feature_columns if c not in df.columns]
    if missing:
        raise _error(f"Columns not found: {missing}")
    if body.problem_type not in ("regression", "classification"):
        raise _error("problem_type must be 'regression' or 'classification'.")

    registry = REGRESSION_MODELS if body.problem_type == "regression" else CLASSIFICATION_MODELS
    if body.model_name not in registry:
        raise _error(f"Model '{body.model_name}' not available.")

    param_grid = _PARAM_GRIDS.get(body.model_name)
    if not param_grid:
        raise _error(f"No param grid defined for model '{body.model_name}'. Cannot auto-tune.")

    try:
        X, y, _ = _prepare(df, body.target_column, body.feature_columns)
    except Exception as e:
        raise _error(f"Preprocessing failed: {e}")

    scoring = "r2" if body.problem_type == "regression" else "f1_weighted"

    try:
        search = RandomizedSearchCV(
            estimator=registry[body.model_name](),
            param_distributions=param_grid,
            n_iter=20,
            cv=3,
            scoring=scoring,
            random_state=42,
            n_jobs=-1,
            return_train_score=False,
        )
        search.fit(X, y)
        results = []
        for mean, std, params in zip(
            search.cv_results_["mean_test_score"],
            search.cv_results_["std_test_score"],
            search.cv_results_["params"],
        ):
            results.append({
                "params": params,
                "score": round(float(mean), 6),
                "std": round(float(std), 6),
            })
        results.sort(key=lambda x: x["score"], reverse=True)
        return {
            "best_params": search.best_params_,
            "best_score": round(float(search.best_score_), 6),
            "results": results[:10],  # top 10
            "scoring": scoring,
        }
    except Exception as e:
        raise _error(f"Hyperparameter tuning failed: {e}")


# ---------------------------------------------------------------------------
# Phase 4: PCA / t-SNE Dimensionality Reduction
# ---------------------------------------------------------------------------

class ReduceRequest(BaseModel):
    session_id: str
    feature_columns: list[str]
    target_column: str
    method: str = "pca"   # "pca" | "tsne"
    n_components: int = 2


@app.post("/reduce")
def reduce_dimensions(body: ReduceRequest) -> dict[str, Any]:
    """
    Reduce features to 2D using PCA or t-SNE.
    Returns {points: [{x, y, target}], explained_variance (PCA only)}.
    """
    from model_trainer import _prepare

    df = _get_df(body.session_id)
    if body.target_column not in df.columns:
        raise _error(f"Column '{body.target_column}' not found.")
    missing = [c for c in body.feature_columns if c not in df.columns]
    if missing:
        raise _error(f"Columns not found: {missing}")
    if body.method not in ("pca", "tsne"):
        raise _error("method must be 'pca' or 'tsne'.")
    if body.n_components != 2:
        raise _error("Only n_components=2 is supported.")

    try:
        X, y, _ = _prepare(df, body.target_column, body.feature_columns)
    except Exception as e:
        raise _error(f"Preprocessing failed: {e}")

    # Sample up to 2000 points for t-SNE performance
    if body.method == "tsne" and len(X) > 2000:
        idx = np.random.default_rng(42).integers(0, len(X), size=2000)
        X = X.iloc[idx]
        y = y.iloc[idx]

    from sklearn.preprocessing import StandardScaler
    X_scaled = StandardScaler().fit_transform(X)

    explained_variance = None
    try:
        if body.method == "pca":
            from sklearn.decomposition import PCA
            reducer = PCA(n_components=2, random_state=42)
            coords = reducer.fit_transform(X_scaled)
            explained_variance = [round(float(v), 6) for v in reducer.explained_variance_ratio_]
        else:
            from sklearn.manifold import TSNE
            reducer = TSNE(n_components=2, random_state=42, perplexity=min(30, len(X) - 1))
            coords = reducer.fit_transform(X_scaled)
    except Exception as e:
        raise _error(f"Dimensionality reduction failed: {e}")

    target_vals = y.tolist()
    points = [
        {"x": round(float(coords[i, 0]), 4), "y": round(float(coords[i, 1]), 4), "target": float(target_vals[i])}
        for i in range(len(coords))
    ]

    return {
        "method": body.method,
        "points": points,
        "explained_variance": explained_variance,
        "n_points": len(points),
        "feature_columns": body.feature_columns,
    }
