# LASSO Regression Feature Design
**Date:** 2026-02-19
**Feature:** Add LASSO (L1-regularized) regression model to predictpy

## Overview
Add LASSO regression as a standard regression model option in the model training pipeline, allowing users to leverage L1 regularization for automatic feature selection.

## Requirements
- LASSO available for regression problems only
- Fixed alpha (regularization strength) of 1.0
- Integrated seamlessly into existing model training pipeline
- Feature importance (coefficients) extracted and displayed
- Cross-validation support via existing infrastructure

## Design

### Backend Architecture

**File Modified:** `backend/model_trainer.py`

#### Changes
1. **Import** (line ~21):
   ```python
   from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge, Lasso
   ```

2. **Model Registry** (line ~65-69, in `REGRESSION_MODELS` dict):
   ```python
   REGRESSION_MODELS: dict[str, Any] = {
       "Linear Regression": lambda: LinearRegression(),
       "Ridge Regression": lambda: Ridge(alpha=1.0),
       "LASSO": lambda: Lasso(alpha=1.0, max_iter=10000, random_state=42),
       "Random Forest": lambda: RandomForestRegressor(...),
   }
   ```

**Rationale:**
- `alpha=1.0`: Matches Ridge's default for consistency
- `max_iter=10000`: Ensures convergence on moderately-sized datasets
- `random_state=42`: Reproducibility

#### Why No Other Changes Needed
The existing `_train_one()` and `train_models()` functions already:
- Extract coefficients via `_get_importances()` (line 155-160) — LASSO has `.coef_` attribute
- Calculate regression metrics (R², MAE, RMSE)
- Run cross-validation with all strategies
- Serialize model to pickle for download

### Frontend Impact
**No changes required** — the model list is dynamically populated by `GET /models` endpoint:
```
Backend: get_available_models("regression") → ["Linear Regression", "Ridge Regression", "LASSO", ...]
Frontend: Model dropdown automatically includes "LASSO"
```

## Data Flow
```
User Training Request
  ↓
POST /train with models_to_train: ["Linear Regression", "LASSO", ...]
  ↓
Backend train_models() → instantiates Lasso(alpha=1.0)
  ↓
Trains on train set, evaluates on test set
  ↓
Extracts coefficients as feature_importances
  ↓
Returns metrics, predictions, importance scores
  ↓
Frontend displays in ModelResults component
```

## Testing Strategy
- Manual: Train a regression model selecting LASSO
- Verify: LASSO appears in model dropdown
- Verify: Metrics (R², MAE, RMSE) display correctly
- Verify: Feature coefficients appear in importance chart
- Verify: Model can be downloaded as .pkl
- Edge case: Very small dataset (< 10 samples) → ensure convergence

## Success Criteria
✓ LASSO model trains alongside other regression models
✓ Feature coefficients displayed as importances
✓ Metrics calculated and shown correctly
✓ Cross-validation works with LASSO
✓ No errors on model pickle/download

## Notes
- CatBoost already excluded on Python 3.13 (no wheel); LASSO imports fine
- Scikit-learn is core dependency — no new package required
- L1 sparsity (coefficients → 0) may occur depending on dataset; this is expected behavior and useful for feature selection
