"""
Dataset Analyzer
================
Handles file parsing and dataset profiling:
  - CSV / XLS / XLSX reading
  - Missing value analysis
  - Column type classification
  - Basic statistics per column
  - Dataset shape and overview
"""

import io
import numpy as np
import pandas as pd
from typing import Any


# ---------------------------------------------------------------------------
# File Parsing
# ---------------------------------------------------------------------------

def parse_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """
    Parse an uploaded CSV or Excel file into a DataFrame.

    Supported extensions: .csv, .xls, .xlsx
    """
    name = filename.lower()
    buffer = io.BytesIO(file_bytes)

    if name.endswith(".csv"):
        # Try common encodings
        for enc in ("utf-8", "latin-1", "cp1252"):
            try:
                buffer.seek(0)
                return pd.read_csv(buffer, encoding=enc)
            except UnicodeDecodeError:
                continue
        raise ValueError("Could not decode CSV file. Try saving as UTF-8.")

    elif name.endswith(".xls"):
        return pd.read_excel(buffer, engine="xlrd")

    elif name.endswith(".xlsx"):
        return pd.read_excel(buffer, engine="openpyxl")

    else:
        raise ValueError(f"Unsupported file type: '{filename}'. Use .csv, .xls, or .xlsx.")


# ---------------------------------------------------------------------------
# Column Profiling
# ---------------------------------------------------------------------------

def _classify_column(series: pd.Series) -> str:
    """Return a human-readable column type label."""
    dtype = series.dtype

    if dtype == "bool":
        return "boolean"
    if dtype.name == "category":
        return "categorical"
    if pd.api.types.is_integer_dtype(dtype):
        n_unique = series.nunique(dropna=True)
        return "integer (categorical)" if n_unique <= 20 else "integer"
    if pd.api.types.is_float_dtype(dtype):
        return "float"
    if pd.api.types.is_datetime64_any_dtype(dtype):
        return "datetime"
    if dtype == "object":
        # Check if it looks like a date string
        sample = series.dropna().head(5)
        try:
            pd.to_datetime(sample)
            return "datetime (string)"
        except Exception:
            pass
        return "text / categorical"
    return str(dtype)


def profile_columns(df: pd.DataFrame) -> list[dict]:
    """
    Return a per-column profile including:
      - dtype, column_type, n_unique
      - missing count and percentage
      - basic stats (min, max, mean, std for numeric; top value for categorical)
    """
    profiles = []
    n_rows = len(df)

    for col in df.columns:
        series = df[col]
        missing_count = int(series.isna().sum())
        missing_pct = round((missing_count / n_rows) * 100, 2) if n_rows > 0 else 0.0

        profile: dict[str, Any] = {
            "column": col,
            "dtype": str(series.dtype),
            "column_type": _classify_column(series),
            "n_unique": int(series.nunique(dropna=True)),
            "missing_count": missing_count,
            "missing_pct": missing_pct,
            "has_missing": missing_count > 0,
        }

        if pd.api.types.is_numeric_dtype(series):
            desc = series.describe()
            skewness = _safe_float(float(series.skew()))
            kurtosis = _safe_float(float(series.kurt()))
            # Suggest transform based on skewness magnitude and value range
            sk = skewness if skewness is not None else 0.0
            s_min = float(series.min()) if series.notna().any() else 0.0
            if abs(sk) > 1.0 and s_min > 0:
                suggested_transform = "log"
            elif abs(sk) > 1.0 and s_min >= 0:
                suggested_transform = "sqrt"
            else:
                suggested_transform = "none"
            profile.update({
                "count": int(series.notna().sum()),
                "sum": _safe_float(float(series.sum())),
                "min": _safe_float(desc.get("min")),
                "max": _safe_float(desc.get("max")),
                "mean": _safe_float(desc.get("mean")),
                "std": _safe_float(desc.get("std")),
                "median": _safe_float(series.median()),
                "q25": _safe_float(desc.get("25%")),
                "q75": _safe_float(desc.get("75%")),
                "skewness": skewness,
                "kurtosis": kurtosis,
                "suggested_transform": suggested_transform,
            })
        else:
            top_val = series.value_counts(dropna=True)
            profile.update({
                "top_value": str(top_val.index[0]) if len(top_val) > 0 else None,
                "top_value_count": int(top_val.iloc[0]) if len(top_val) > 0 else 0,
            })

        profiles.append(profile)

    return profiles


def _safe_float(val: Any) -> float | None:
    try:
        f = float(val)
        return None if np.isnan(f) or np.isinf(f) else round(f, 6)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Missing Value Summary
# ---------------------------------------------------------------------------

def missing_value_summary(df: pd.DataFrame) -> dict[str, Any]:
    """
    Return a structured summary of missing values for heatmap/bar chart
    rendering on the frontend.
    """
    n_rows, n_cols = df.shape
    missing_per_col = df.isna().sum()
    missing_per_row = df.isna().sum(axis=1)

    # Per-column data for bar chart
    columns_data = [
        {
            "column": col,
            "missing_count": int(missing_per_col[col]),
            "missing_pct": round((missing_per_col[col] / n_rows) * 100, 2),
        }
        for col in df.columns
        if missing_per_col[col] > 0
    ]
    columns_data.sort(key=lambda x: x["missing_count"], reverse=True)

    # Heatmap data: sample up to 200 rows, show missing as 1 / present as 0
    sample_df = df if n_rows <= 200 else df.sample(n=200, random_state=42)
    heatmap_data = []
    for row_idx, (_, row) in enumerate(sample_df.iterrows()):
        for col in df.columns:
            heatmap_data.append({
                "row": row_idx,
                "column": col,
                "missing": int(pd.isna(row[col])),
            })

    return {
        "total_rows": n_rows,
        "total_columns": n_cols,
        "total_missing_cells": int(df.isna().sum().sum()),
        "total_cells": n_rows * n_cols,
        "overall_missing_pct": round((df.isna().sum().sum() / max(n_rows * n_cols, 1)) * 100, 2),
        "columns_with_missing": len(columns_data),
        "columns_data": columns_data,
        "heatmap_data": heatmap_data,
        "rows_with_any_missing": int((missing_per_row > 0).sum()),
        "complete_rows": int((missing_per_row == 0).sum()),
    }


# ---------------------------------------------------------------------------
# Full Dataset Profile
# ---------------------------------------------------------------------------

def profile_dataset(df: pd.DataFrame) -> dict[str, Any]:
    """
    Return a full dataset profile combining:
      - Shape, dtypes summary
      - Column profiles
      - Missing value summary
      - First 10 rows as preview
    """
    n_rows, n_cols = df.shape
    column_profiles = profile_columns(df)

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()

    # Safe preview: replace NaN with None for JSON serialization
    preview_df = df.head(10).where(df.head(10).notna(), other=None)
    preview = preview_df.to_dict(orient="records")

    return {
        "shape": {"rows": n_rows, "columns": n_cols},
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "column_profiles": column_profiles,
        "missing_values": missing_value_summary(df),
        "preview": preview,
        "columns": list(df.columns),
        "dtypes": {col: str(df[col].dtype) for col in df.columns},
    }
