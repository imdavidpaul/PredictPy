# predictpy — Project Overview

Full-stack ML feature selection app. Users upload a dataset, the system auto-detects regression vs. classification, ranks features by correlation strength, and trains ML models. **Authentication-free version.**

## Stack
- **Backend:** FastAPI + Python 3.13, scikit-learn / XGBoost / LightGBM
- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS, Recharts, Zustand

## Directory Structure
```
Project -1/
├── CLAUDE.md
├── .claude/rules/          ← component-specific rules (auto-loaded)
│   ├── backend.md          ← backend rules (scoped to backend/**)
│   └── frontend.md         ← frontend rules (scoped to frontend/**)
├── backend/
│   ├── main.py             ← FastAPI app + all endpoints
│   ├── feature_selector.py ← core feature ranking algorithm
│   ├── analyzer.py         ← dataset profiling + column stats
│   ├── model_trainer.py    ← ML training pipeline (CV, metrics, pickle)
│   └── requirements.txt
└── frontend/
    ├── app/                ← Next.js App Router pages
    ├── components/         ← React UI components
    ├── lib/                ← api.ts, types.ts, utils.ts
    └── store/useStore.ts   ← Zustand global state
```

## How to Run

```bash
# Backend
cd "Project -1/backend"
python -m uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd "Project -1/frontend"
npm run dev

# Docker (runs both)
make docker-up
```

- Backend API docs: http://localhost:8000/docs
- Frontend: http://localhost:3000

## App Flow
```
Upload → Preview → Target → Features → Charts → Model
```
1. **Upload** — drag & drop CSV / XLS / XLSX
2. **Preview** — column profiles, missing values, stats chips
3. **Target** — Auto-suggested + manual target column selection
4. **Features** — multi-method ranked features, feature engineering, CSV/PDF export
5. **Charts** — scatter grid + correlation heatmap + histograms
6. **Model** — train models, cross-validation, compare metrics, download .pkl

## Component-Specific Rules
See @.claude/rules/backend.md and @.claude/rules/frontend.md for detailed rules.
