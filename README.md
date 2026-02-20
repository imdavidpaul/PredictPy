# predictpy

**Intelligent ML feature selection and model training — in your browser.**

Upload a dataset, and predictpy automatically detects the problem type, profiles your data, ranks features using multiple statistical methods, trains and compares ML models, and gives you a downloadable `.pkl` file — all without writing a single line of code.

---

## Features

### Data Analysis
- **Auto problem detection** — classifies regression vs. classification from your data
- **Dataset profiling** — column types, missing values, skewness, kurtosis, transform suggestions
- **Outlier detection** — IQR and Z-score methods per column
- **Class imbalance warning** — flags severe imbalance with ratio and class breakdown

### Feature Selection
- **Multi-method ranking** — Pearson, Spearman, Mutual Information, ANOVA-F, Chi², Random Forest importance
- **VIF scores** — multicollinearity detection (color-coded green/amber/red)
- **RFECV auto-select** — recursive feature elimination with cross-validation
- **Feature engineering** — create derived features (A+B, A×B, A÷B, A−B) and re-analyze
- **CSV + PDF export** of ranked feature table

### Model Training
- **8 model types** — Linear/Ridge/LASSO Regression, Logistic Regression, Random Forest, XGBoost, LightGBM, CatBoost, Voting Ensemble, Stacking
- **Cross-validation strategies** — train/test split, K-Fold, Stratified K-Fold, Leave-One-Out
- **Bootstrap confidence intervals** on all metrics
- **Auto-tune** — RandomizedSearchCV hyperparameter optimization per model
- **Feature importance** + actual vs. predicted chart per model
- **SHAP values** — mean absolute SHAP bar chart (falls back to model importance)
- **Learning curves** — train vs. validation score across dataset sizes

### Visualization
- **Scatter grid** — top feature vs. target scatter plots with regression lines
- **Histograms** — distribution, KDE overlay, box plot, CDF per feature
- **Correlation heatmap** — Pearson / Spearman / Kendall
- **Partial Dependence Plots** — marginal effect of any feature on predictions
- **PCA / t-SNE** — 2D projection of the feature space colored by target

### Prediction & Evaluation
- **Real-time prediction** — single-row what-if panel with instant output
- **Batch prediction** — upload a CSV and download predictions
- **Holdout evaluation** — upload a test dataset and get:
  - Regression: scatter plot, residual plot, R², MAE, RMSE
  - Classification: ROC-AUC curve, confusion matrix, calibration curve, accuracy, F1
  - **Data drift detection** — KS test (numeric) + chi-square (categorical) vs. training distribution

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, Recharts, Zustand |
| Backend | FastAPI, Python 3.13, scikit-learn, scipy, statsmodels |
| Optional ML | XGBoost, LightGBM, CatBoost, SHAP |
| Infrastructure | Docker, docker-compose |

---

## Getting Started

### Prerequisites
- Python 3.13+
- Node.js 18+

### 1. Clone

```bash
git clone https://github.com/your-username/predictpy.git
cd predictpy
```

### 2. Install dependencies

```bash
make install
```

Or manually:

```bash
# Backend
cd backend
pip install --prefer-binary -r requirements.txt

# Frontend
cd frontend
npm install
```

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
```

The default `.env` works out of the box for local development.

### 4. Run

In two separate terminals:

```bash
# Terminal 1 — backend (http://localhost:8000)
make backend

# Terminal 2 — frontend (http://localhost:3000)
make frontend
```

Or with Docker:

```bash
make docker-up
```

---

## App Flow

```
Upload → Preview → Target → Features → Charts → Model → Predict → Evaluation
```

| Step | What happens |
|---|---|
| **Upload** | Drop a CSV / XLS / XLSX (up to 50 MB) |
| **Preview** | Column profiles, missing values, outlier summary, skew badges |
| **Target** | AI-suggested target column with confidence score, or choose manually |
| **Features** | Multi-method ranked feature table with VIF, RFECV, feature engineering |
| **Charts** | Scatter grid, histograms, correlation heatmap, PDP, PCA / t-SNE |
| **Model** | Train all models, compare metrics with CI, view SHAP + learning curves |
| **Predict** | Single-row prediction or batch CSV upload |
| **Evaluation** | Holdout dataset evaluation with drift detection |

---

## API Reference

The backend exposes a REST API at `http://localhost:8000`. Interactive docs are available at [`/docs`](http://localhost:8000/docs).

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload` | Upload dataset, returns profile |
| `POST` | `/suggest-target` | AI target column suggestions |
| `POST` | `/analyze` | Run multi-method feature ranking |
| `POST` | `/scatter` | Scatter plot data |
| `POST` | `/distribution` | Histogram / KDE / box / CDF data |
| `POST` | `/correlation-matrix` | Correlation heatmap data |
| `POST` | `/outliers` | IQR + Z-score outlier counts per column |
| `POST` | `/vif` | Variance Inflation Factor per feature |
| `POST` | `/train` | Train and compare ML models |
| `GET` | `/models` | List available models (reflects installed packages) |
| `POST` | `/tune` | Hyperparameter tuning via RandomizedSearchCV |
| `POST` | `/shap` | SHAP feature importance |
| `POST` | `/learning-curve` | Learning curve data |
| `POST` | `/pdp` | Partial Dependence Plot data |
| `POST` | `/rfecv` | Recursive Feature Elimination with CV |
| `POST` | `/reduce` | PCA / t-SNE dimensionality reduction |
| `POST` | `/predict` | Single-row prediction |
| `POST` | `/predict-batch` | Batch prediction from CSV |
| `POST` | `/evaluate` | Holdout dataset evaluation + drift detection |
| `POST` | `/engineer-feature` | Create derived feature column |
| `DELETE` | `/session/{id}` | Clear session data |

---

## Development

```bash
make lint       # ruff (backend) + eslint (frontend)
make format     # ruff format + prettier
make check      # TypeScript type check
make build      # Production build (frontend)
```

---

## Feature Selection Algorithm

Features are ranked using a weighted combination of methods, normalized to [0, 1]:

**Regression**

| Method | Weight |
|---|---|
| Pearson correlation | 30% |
| Spearman correlation | 25% |
| Mutual Information | 25% |
| Random Forest importance | 20% |

**Classification**

| Method | Weight |
|---|---|
| Mutual Information | 30% |
| ANOVA-F | 25% |
| Random Forest importance | 25% |
| Chi² | 20% |

---

## License

MIT
