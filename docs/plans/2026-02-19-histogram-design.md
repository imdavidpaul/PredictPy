# Histogram Design

**Date:** 2026-02-19
**Status:** Approved

## Summary

Replace `DistributionCharts` (combined bar + mean-y line chart) with `Histogram` — a pure frequency histogram showing only count bars per feature bin.

## What Changes

### Frontend

| File | Action |
|---|---|
| `frontend/components/DistributionCharts.tsx` | Delete |
| `frontend/components/Histogram.tsx` | Create (pure BarChart) |
| `frontend/app/dashboard/page.tsx` | Update import from `DistributionCharts` → `Histogram` |

### Backend

No changes. The `/distribution` endpoint already returns `count` per bin; the `mean_y` field is simply ignored by the new component.

## New Component Design (`Histogram.tsx`)

- **Chart type:** Recharts `BarChart` — count bars only, no `Line`, no second Y axis
- **Grid:** same 1/2/3 column responsive grid as before
- **Top-N selector:** 4 / 9 / 15 features (same options)
- **Card title:** `<column>: Histogram`
- **Subtitle:** `(<col_type> · <unique> unique · <n_nan> nan)`
- **Bar color:** violet (`#7c3aed`) — matches brand primary
- **X axis:** bin labels, angled when > 8 bins
- **Y axis:** Count (single left axis)
- **Tooltip:** shows bin label + count

## Data Flow

```
useStore (sessionId, analysisResult)
  → getDistribution({ session_id, column, target_column, n_bins: 20 })
  → DistributionResponse.bins[].count (mean_y ignored)
  → BarChart bars
```
