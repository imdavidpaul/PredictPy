"""
Feature Selection Algorithm
============================
Multi-method scoring pipeline that ranks features by their
correlation/importance relative to a target variable.

Supports both REGRESSION and CLASSIFICATION problems.

Pipeline:
  1. Detect problem type (regression vs classification)
  2. Score each feature using multiple statistical methods
  3. Normalize all scores to [0, 1]
  4. Combine with weighted average -> Final Feature Score
  5. Return ranked features with scores and metadata
"""

import numpy as np
import pandas as pd
from typing import Any
from scipy import stats
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.feature_selection import (
    mutual_info_classif,
    mutual_info_regression,
    chi2,
    f_classif,
    f_regression,
)
from sklearn.preprocessing import LabelEncoder, MinMaxScaler


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CLASSIFICATION = "classification"
REGRESSION = "regression"

# Weights for combining individual method scores into a final score.
# Adjust these to prioritize different methods.
WEIGHTS = {
    REGRESSION: {
        "pearson": 0.30,
        "spearman": 0.25,
        "mutual_info": 0.25,
        "rf_importance": 0.20,
    },
    CLASSIFICATION: {
        "anova_f": 0.25,
        "chi2": 0.20,
        "mutual_info": 0.30,
        "rf_importance": 0.25,
    },
}

# If a target column has <= this many unique values AND is object/category
# dtype, treat it as classification regardless of unique count.
CLASSIFICATION_UNIQUE_THRESHOLD = 20


# ---------------------------------------------------------------------------
# Problem Type Detection
# ---------------------------------------------------------------------------

def detect_problem_type(series: pd.Series) -> str:
    """
    Infer whether a target column represents a classification or regression
    problem.

    Rules (in priority order):
      1. Object / category / bool dtype  -> classification
      2. Integer dtype with few unique values (<= threshold) -> classification
      3. Float dtype OR many unique integers -> regression
    """
    dtype = series.dtype

    if dtype == "bool" or dtype.name == "category":
        return CLASSIFICATION

    if dtype == "object":
        return CLASSIFICATION

    n_unique = series.nunique(dropna=True)
    n_total = len(series.dropna())

    if pd.api.types.is_integer_dtype(dtype):
        if n_unique <= CLASSIFICATION_UNIQUE_THRESHOLD:
            return CLASSIFICATION
        else:
            return REGRESSION

    if pd.api.types.is_float_dtype(dtype):
        # Float with very few uniques is likely encoded categories
        if n_unique <= 5:
            return CLASSIFICATION
        return REGRESSION

    # fallback
    unique_ratio = n_unique / max(n_total, 1)
    return REGRESSION if unique_ratio > 0.05 else CLASSIFICATION


# ---------------------------------------------------------------------------
# Target Variable Suggestion
# ---------------------------------------------------------------------------

def suggest_target_columns(df: pd.DataFrame) -> list[dict]:
    """
    Return up to 3 column suggestions for the target variable with a
    confidence score and detected problem type.

    Heuristics (higher score = more likely to be the target):
      - Column name contains common target keywords
      - Column is positioned at the end of the dataset
      - Column has low cardinality (for classification) or is numeric
    """
    TARGET_KEYWORDS = {
        "target", "label", "labels", "outcome", "output", "result",
        "y", "class", "category", "response", "dependent", "predict",
        "prediction", "diagnosis", "status", "flag", "churn", "default",
        "price", "sales", "revenue", "score", "grade",
    }

    suggestions = []
    n_cols = len(df.columns)

    for idx, col in enumerate(df.columns):
        score = 0.0
        col_lower = col.lower().strip()

        # Keyword match
        if col_lower in TARGET_KEYWORDS:
            score += 0.50
        elif any(kw in col_lower for kw in TARGET_KEYWORDS):
            score += 0.30

        # Position bias: last columns are more likely targets
        position_score = (idx + 1) / n_cols  # 0..1, higher = closer to end
        score += position_score * 0.30

        # Numeric bonus (regression/classification both valid)
        if pd.api.types.is_numeric_dtype(df[col]):
            score += 0.10

        # Low cardinality bonus (nice target for classification)
        n_unique = df[col].nunique(dropna=True)
        if 2 <= n_unique <= 20:
            score += 0.10

        problem_type = detect_problem_type(df[col])

        suggestions.append({
            "column": col,
            "confidence": round(min(score, 1.0), 4),
            "problem_type": problem_type,
            "n_unique": int(n_unique),
            "dtype": str(df[col].dtype),
        })

    # Sort by confidence descending, return top 3
    suggestions.sort(key=lambda x: x["confidence"], reverse=True)
    return suggestions[:3]


# ---------------------------------------------------------------------------
# Preprocessing Helpers
# ---------------------------------------------------------------------------

def _encode_column(series: pd.Series) -> pd.Series:
    """Label-encode a non-numeric column for statistical tests."""
    le = LabelEncoder()
    filled = series.fillna("__MISSING__").astype(str)
    return pd.Series(le.fit_transform(filled), index=series.index, name=series.name)


def _prepare_features(df: pd.DataFrame, target_col: str) -> tuple[pd.DataFrame, pd.Series]:
    """
    Return (X, y) after:
      - Dropping the target column from X
      - Encoding non-numeric feature columns
      - Filling remaining NaN with column median (numeric) or mode (categorical)
    """
    X = df.drop(columns=[target_col]).copy()
    y = df[target_col].copy()

    # Encode target if categorical
    if not pd.api.types.is_numeric_dtype(y):
        y = _encode_column(y)
    else:
        y = y.fillna(y.median())

    # Encode / fill features
    for col in X.columns:
        if not pd.api.types.is_numeric_dtype(X[col]):
            X[col] = _encode_column(X[col])
        else:
            X[col] = X[col].fillna(X[col].median())

    return X, y


def _normalize(scores: dict[str, float]) -> dict[str, float]:
    """Min-max normalize a dict of scores to [0, 1]."""
    if not scores:
        return scores
    vals = np.array(list(scores.values()), dtype=float)
    vals = np.nan_to_num(vals, nan=0.0, posinf=0.0, neginf=0.0)
    mn, mx = vals.min(), vals.max()
    if mx == mn:
        return {k: 1.0 for k in scores}
    normalized = (vals - mn) / (mx - mn)
    return dict(zip(scores.keys(), normalized.tolist()))


# ---------------------------------------------------------------------------
# Individual Scoring Methods
# ---------------------------------------------------------------------------

def _pearson_scores(X: pd.DataFrame, y: pd.Series) -> dict[str, float]:
    """Pearson correlation |r| for each feature vs target (regression)."""
    scores = {}
    for col in X.columns:
        r, _ = stats.pearsonr(X[col], y)
        scores[col] = abs(float(r)) if not np.isnan(r) else 0.0
    return scores


def _spearman_scores(X: pd.DataFrame, y: pd.Series) -> dict[str, float]:
    """Spearman rank correlation |rho| for each feature vs target."""
    scores = {}
    for col in X.columns:
        rho, _ = stats.spearmanr(X[col], y)
        scores[col] = abs(float(rho)) if not np.isnan(rho) else 0.0
    return scores


def _mutual_info_scores_regression(X: pd.DataFrame, y: pd.Series) -> dict[str, float]:
    """Mutual information scores for regression."""
    mi = mutual_info_regression(X, y, random_state=42)
    return dict(zip(X.columns, mi.tolist()))


def _mutual_info_scores_classification(X: pd.DataFrame, y: pd.Series) -> dict[str, float]:
    """Mutual information scores for classification."""
    mi = mutual_info_classif(X, y, random_state=42)
    return dict(zip(X.columns, mi.tolist()))


def _rf_importance_regression(X: pd.DataFrame, y: pd.Series) -> dict[str, float]:
    """Random Forest feature importances for regression."""
    rf = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    rf.fit(X, y)
    return dict(zip(X.columns, rf.feature_importances_.tolist()))


def _rf_importance_classification(X: pd.DataFrame, y: pd.Series) -> dict[str, float]:
    """Random Forest feature importances for classification."""
    rf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    rf.fit(X, y)
    return dict(zip(X.columns, rf.feature_importances_.tolist()))


def _anova_f_scores(X: pd.DataFrame, y: pd.Series) -> dict[str, float]:
    """ANOVA F-scores for numeric features vs categorical target."""
    f_scores, _ = f_classif(X, y)
    f_scores = np.nan_to_num(f_scores, nan=0.0)
    return dict(zip(X.columns, f_scores.tolist()))


def _chi2_scores(X: pd.DataFrame, y: pd.Series) -> dict[str, float]:
    """
    Chi-square scores. Requires non-negative features — shift if needed.
    """
    X_shifted = X.copy()
    for col in X_shifted.columns:
        if X_shifted[col].min() < 0:
            X_shifted[col] = X_shifted[col] - X_shifted[col].min()

    try:
        chi_scores, _ = chi2(X_shifted, y)
        chi_scores = np.nan_to_num(chi_scores, nan=0.0)
        return dict(zip(X.columns, chi_scores.tolist()))
    except Exception:
        # chi2 can fail on non-integer-like data; return zeros as fallback
        return {col: 0.0 for col in X.columns}


# ---------------------------------------------------------------------------
# Main Algorithm
# ---------------------------------------------------------------------------

def select_features(
    df: pd.DataFrame,
    target_col: str,
    problem_type: str | None = None,
    top_n: int | None = None,
) -> dict[str, Any]:
    """
    Core feature selection algorithm.

    Parameters
    ----------
    df          : Input DataFrame (full dataset including target column)
    target_col  : Name of the target/outcome column
    problem_type: "regression" | "classification" | None (auto-detect)
    top_n       : Return only the top N features. None = return all.

    Returns
    -------
    dict with keys:
      - problem_type   : detected or provided problem type
      - target_column  : name of the target column
      - features       : list of dicts, sorted by final_score descending
          Each dict contains:
            column        : feature name
            final_score   : weighted combined score (0-1)
            scores        : individual method scores (normalized, 0-1)
            raw_scores    : raw (un-normalized) method scores
            dtype         : column dtype
            n_unique      : number of unique values
            correlation_direction: "positive" | "negative" | "n/a"
      - top_n          : how many features were returned
      - weights_used   : the weighting scheme applied
    """
    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' not found in dataset.")

    # Auto-detect problem type
    if problem_type is None:
        problem_type = detect_problem_type(df[target_col])

    # Prepare X and y
    X, y = _prepare_features(df, target_col)

    if X.shape[1] == 0:
        raise ValueError("No feature columns remaining after removing target.")

    feature_cols = list(X.columns)
    raw_scores: dict[str, dict[str, float]] = {col: {} for col in feature_cols}
    normalized_scores: dict[str, dict[str, float]] = {col: {} for col in feature_cols}

    # --- Compute raw scores per method ---
    if problem_type == REGRESSION:
        methods = {
            "pearson":      _pearson_scores(X, y),
            "spearman":     _spearman_scores(X, y),
            "mutual_info":  _mutual_info_scores_regression(X, y),
            "rf_importance": _rf_importance_regression(X, y),
        }
    else:  # classification
        methods = {
            "anova_f":      _anova_f_scores(X, y),
            "chi2":         _chi2_scores(X, y),
            "mutual_info":  _mutual_info_scores_classification(X, y),
            "rf_importance": _rf_importance_classification(X, y),
        }

    # Store raw scores
    for method_name, method_result in methods.items():
        for col in feature_cols:
            raw_scores[col][method_name] = method_result.get(col, 0.0)

    # Normalize each method's scores across all features
    for method_name in methods:
        method_raw = {col: raw_scores[col][method_name] for col in feature_cols}
        method_normalized = _normalize(method_raw)
        for col in feature_cols:
            normalized_scores[col][method_name] = method_normalized[col]

    # Compute weighted final score
    weights = WEIGHTS[problem_type]
    final_scores: dict[str, float] = {}
    for col in feature_cols:
        weighted_sum = sum(
            normalized_scores[col].get(method, 0.0) * weight
            for method, weight in weights.items()
        )
        final_scores[col] = round(weighted_sum, 6)

    # Determine correlation direction (regression: use Pearson sign)
    def _correlation_direction(col: str) -> str:
        if problem_type == REGRESSION:
            r, _ = stats.pearsonr(X[col], y)
            if np.isnan(r):
                return "n/a"
            return "positive" if r >= 0 else "negative"
        return "n/a"

    # Build output feature list
    features_output = []
    for col in feature_cols:
        features_output.append({
            "column": col,
            "final_score": final_scores[col],
            "scores": {k: round(v, 6) for k, v in normalized_scores[col].items()},
            "raw_scores": {k: round(v, 6) for k, v in raw_scores[col].items()},
            "dtype": str(df[col].dtype),
            "n_unique": int(df[col].nunique(dropna=True)),
            "correlation_direction": _correlation_direction(col),
        })

    # Sort by final score descending
    features_output.sort(key=lambda x: x["final_score"], reverse=True)

    # Apply top_n filter
    if top_n is not None:
        features_output = features_output[:top_n]

    result: dict[str, Any] = {
        "problem_type": problem_type,
        "target_column": target_col,
        "features": features_output,
        "total_features_analyzed": len(feature_cols),
        "top_n": top_n or len(feature_cols),
        "weights_used": weights,
    }

    # Class balance info for classification problems
    if problem_type == CLASSIFICATION:
        try:
            target_series = df[target_col].dropna()
            class_counts = target_series.astype(str).value_counts()
            min_count = int(class_counts.min())
            max_count = int(class_counts.max())
            imbalance_ratio = round(max_count / min_count, 4) if min_count > 0 else None
            result["class_balance"] = {
                "counts": {str(k): int(v) for k, v in class_counts.items()},
                "imbalance_ratio": imbalance_ratio,
                "is_severe": (imbalance_ratio is not None and imbalance_ratio > 3),
                "n_classes": int(class_counts.shape[0]),
            }
        except Exception:
            pass

    return result


# ---------------------------------------------------------------------------
# Correlation Matrix Helper (for charts)
# ---------------------------------------------------------------------------

def compute_correlation_matrix(
    df: pd.DataFrame,
    columns: list[str] | None = None,
    method: str = "pearson",
) -> dict[str, Any]:
    """
    Compute a correlation matrix for the given columns.
    Returns data formatted for frontend heatmap rendering.

    Parameters
    ----------
    df      : DataFrame
    columns : List of column names. None = all numeric columns.
    method  : "pearson" | "spearman" | "kendall"
    """
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()

    subset = df[columns].copy()
    for col in subset.columns:
        if not pd.api.types.is_numeric_dtype(subset[col]):
            subset[col] = _encode_column(subset[col])
        subset[col] = subset[col].fillna(subset[col].median())

    corr_matrix = subset.corr(method=method)

    # Convert to list-of-dicts for easy JSON serialization
    matrix_data = []
    for row in corr_matrix.index:
        for col in corr_matrix.columns:
            matrix_data.append({
                "x": col,
                "y": row,
                "value": round(float(corr_matrix.loc[row, col]), 4),
            })

    return {
        "columns": list(corr_matrix.columns),
        "matrix": matrix_data,
        "method": method,
    }


# ---------------------------------------------------------------------------
# Scatter Plot Data Helper (for charts)
# ---------------------------------------------------------------------------

def get_scatter_data(
    df: pd.DataFrame,
    feature_col: str,
    target_col: str,
    max_points: int = 500,
) -> dict[str, Any]:
    """
    Return scatter plot data (x, y points) for a feature vs target.
    Also returns a simple linear regression line for overlay.

    Downsamples to max_points if the dataset is large.
    """
    subset = df[[feature_col, target_col]].dropna().copy()

    if not pd.api.types.is_numeric_dtype(subset[feature_col]):
        subset[feature_col] = _encode_column(subset[feature_col])
    if not pd.api.types.is_numeric_dtype(subset[target_col]):
        subset[target_col] = _encode_column(subset[target_col])

    # Downsample
    if len(subset) > max_points:
        subset = subset.sample(n=max_points, random_state=42)

    x = subset[feature_col].tolist()
    y = subset[target_col].tolist()

    # Linear regression line
    slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
    x_line = [min(x), max(x)]
    y_line = [slope * xi + intercept for xi in x_line]

    return {
        "feature": feature_col,
        "target": target_col,
        "points": [{"x": xi, "y": yi} for xi, yi in zip(x, y)],
        "regression_line": {
            "x": x_line,
            "y": y_line,
            "slope": round(slope, 6),
            "intercept": round(intercept, 6),
            "r_squared": round(r_value ** 2, 6),
            "p_value": round(p_value, 6),
        },
        "n_points": len(x),
    }
