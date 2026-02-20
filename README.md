# PredictPy 🚀

**Intelligent ML feature selection and model training — in your browser.**

[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/downloads/)
[![Next.js 16](https://img.shields.io/badge/next.js-16-black.svg)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

PredictPy is a code-free machine learning platform that automates the entire ML pipeline. Upload a dataset, and PredictPy will handle the profiling, feature ranking, model training, and evaluation—providing you with a production-ready `.pkl` model file in minutes.

---

## ✨ Key Features

### 📊 Exploratory Data Analysis (EDA)
- **Auto Problem Detection**: Instantly classifies your task as **Regression** or **Classification**.
- **Dataset Profiling**: Deep-dive into column types, missing values, skewness, kurtosis, and data quality.
- **Outlier Detection**: Automated IQR and Z-score analysis to identify anomalies.
- **Class Imbalance Alerts**: Multi-level warnings for classification datasets with severe skew.

### 🔍 Advanced Feature Selection
- **Multi-Method Ranking**: Features are ranked using a weighted ensemble of Pearson, Spearman, Mutual Information, ANOVA-F, Chi-Square, and Random Forest Importance.
- **Multicollinearity (VIF)**: Detect redundant features with color-coded Variance Inflation Factor (VIF) scores.
- **Auto-Selection (RFECV)**: Recursive Feature Elimination with Cross-Validation to find the optimal subset.
- **Feature Engineering**: Create derived features ($A \times B$, $A \div B$, etc.) directly in the UI.

### 🤖 Automated Model Training
- **Broad Model Support**: Train Linear/Ridge/LASSO, Logistic Regression, Random Forest, XGBoost, LightGBM, CatBoost, and complex Voting/Stacking ensembles.
- **Hyperparameter Tuning**: Integrated `RandomizedSearchCV` to optimize model parameters automatically.
- **Confidence Intervals**: 500-sample bootstrap intervals on all performance metrics.
- **Explainability (SHAP)**: High-performance SHAP value visualizations for model transparency.
- **Learning Curves**: Diagnose bias vs. variance with train/validation score plots across dataset sizes.

### 📈 Evaluation & Drift Detection
- **Comprehensive Visuals**:
  - **Regression**: Parity plots (actual vs. predicted) and Residual plots.
  - **Classification**: ROC-AUC curves, Confusion Matrices, and Calibration curves.
- **Data Drift Detection**: Integrated KS tests (numeric) and Chi-Square tests (categorical) to detect shifts between training and test distributions.

---

## 🛠 Tech Stack

| Component | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS, Recharts, Zustand |
| **Backend** | FastAPI, Python 3.13, scikit-learn, SciPy, Statsmodels |
| **ML Engines** | XGBoost, LightGBM, CatBoost, SHAP |
| **DevOps** | Docker, Docker Compose, Makefile |

---

## 🚀 Getting Started

### Prerequisites
- [Python 3.13+](https://www.python.org/downloads/)
- [Node.js 18+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (Optional)

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/PredictPy/predictpy.git
cd predictpy

# Install all dependencies (Backend + Frontend)
make install
```

### 2. Environment Setup

```bash
# Backend configuration
cp backend/.env.example backend/.env
```

### 3. Running the App

Using Docker (Recommended):
```bash
make docker-up
```

Or manually:
```bash
# Terminal 1: Backend
make backend

# Terminal 2: Frontend
make frontend
```

The app will be available at:
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🎯 App Workflow

1. **Upload** 📂: Drop your CSV or Excel file.
2. **Preview** 👀: Inspect distribution stats and data health.
3. **Target** 🎯: Select your target column (or let AI suggest one).
4. **Features** 🧬: Rank features, check VIF, and select the best performers.
5. **Charts** 📊: Visualize relationships with heatmaps and scatter grids.
6. **Model** 🧠: Train, tune, and compare models with full metrics.
7. **Evaluate** ✅: Upload a holdout set to check performance and data drift.

---

## 📋 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/upload` | `POST` | Upload dataset and generate profile |
| `/analyze` | `POST` | Execute multi-method feature ranking |
| `/train` | `POST` | Train and compare multiple ML models |
| `/evaluate` | `POST` | Evaluate model on holdout set |
| `/predict` | `POST` | Single-row or batch CSV prediction |
| `/shap` | `POST` | Calculate SHAP explainability values |

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.
