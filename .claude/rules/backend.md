---
paths:
  - "backend/**"
---

# Backend Rules

## Key Files
| File | Purpose |
|---|---|
| `main.py` | FastAPI app factory, lifespan, all route handlers |
| `feature_selector.py` | Multi-method feature ranking algorithm — do not change weights casually |
| `analyzer.py` | CSV/XLS parsing, column profiling, missing value stats |
| `model_trainer.py` | Training pipeline: CV strategies, metrics, feature importance, pickle export |
| `requirements.txt` | Python 3.13 — always use `pip install --prefer-binary` |

## API Endpoints (All Public)
- `GET  /health` — Basic health check
- `POST /upload` — Upload CSV/XLSX and get profile
- `POST /suggest-target` — Suggest target columns
- `POST /analyze` — Run feature selection
- `POST /scatter` — Get chart data
- `POST /correlation-matrix` — Get heatmap data
- `POST /train` — Train models
- `GET  /models` — List available models
- `DELETE /session/{id}` — Clear a session

## Session Architecture
```python
_sessions: dict[str, pd.DataFrame]        # session_id → DataFrame (in-memory)
```
- Sessions reset on server restart — this is by design.
- Use `_get_df(session_id)` to retrieve session data. It raises 404 if not found.

## Feature Selection Algorithm (`feature_selector.py`)
**Do not change weights without strong justification — tuned for tabular datasets.**

| Problem | Method | Weight |
|---|---|---|
| Regression | Pearson | 30% |
| Regression | Spearman | 25% |
| Regression | Mutual Info | 25% |
| Regression | RF Importance | 20% |
| Classification | ANOVA-F | 25% |
| Classification | Chi² | 20% |
| Classification | Mutual Info | 30% |
| Classification | RF Importance | 25% |

All method scores are normalized to [0, 1] before weighting.

## Model Training (`model_trainer.py`)
- **XGBoost / LightGBM** loaded via `try/except ImportError` — gracefully skipped if not installed.
- `get_available_models(problem_type)` returns only installed models.
- **LOO cross-validation** is capped at 200 samples; falls back to KFold for larger datasets.
- Model bytes returned as `base64.b64encode(pickle.dumps(best_model))` string.

## Python 3.13 Rules
- Always `pip install --prefer-binary` to avoid source compilation failures.
- All packages in `requirements.txt` have pre-built wheels for Python 3.13 on Windows.
- Use `python -m uvicorn` — the `uvicorn` binary may not be on PATH.

## CORS
Currently locked to `http://localhost:3000` via `.env`.
