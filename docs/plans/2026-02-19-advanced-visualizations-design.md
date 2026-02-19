# Advanced Visualizations Design

**Date:** 2026-02-19
**Status:** Approved

## Summary

Enhance the `Histogram` component with three additional chart types per feature card:
KDE overlay, Box Plot, and CDF — presented as tabs on each feature card.

## Approach

Enrich the existing `POST /distribution` endpoint to return all data needed for all
four tabs in a single API call. No new endpoints. No new Python packages (scipy already
installed).

## Backend Changes (`backend/main.py` — `/distribution` endpoint)

Add three new fields to the response for **numeric columns only** (categorical returns `null`):

### `kde_points: list[{x: float, density: float}] | null`
- Computed via `scipy.stats.gaussian_kde` on the non-null series
- 100 evenly spaced x-values between `series.min()` and `series.max()`
- Returns `null` for categorical columns or columns with < 2 unique values

### `box_stats: {min, q1, median, q3, max, outliers: float[]} | null`
- `q1`, `q3` via `np.percentile(series, [25, 75])`
- `iqr = q3 - q1`
- Whiskers: `lower = q1 - 1.5*iqr`, `upper = q3 + 1.5*iqr`
- `min` / `max` = most extreme non-outlier values (not the series min/max)
- `outliers` = values outside whisker range (capped at 100 points)
- Returns `null` for categorical columns

### `cdf: list[{label: str, cumulative_pct: float}] | null`
- Running cumulative sum of `bins[].count`, normalized to 0–100%
- Uses the same bins already computed for the histogram
- Works for both numeric and categorical columns (not null for categorical)

## Frontend Changes

### `frontend/lib/types.ts`
Add to `DistributionResponse`:
```ts
kde_points: { x: number; density: number }[] | null
box_stats: {
  min: number; q1: number; median: number
  q3: number; max: number; outliers: number[]
} | null
cdf: { label: string; cumulative_pct: number }[] | null
```

### `frontend/components/Histogram.tsx`

**Tab state:** Add `activeTab` to `HistCard` local state:
```ts
type Tab = "histogram" | "box" | "cdf"
const [activeTab, setActiveTab] = useState<Tab>("histogram")
```

**Tab bar:** 3 buttons at top of each card:
- `Histogram` (default)
- `Box Plot` (hidden if `box_stats` is null)
- `CDF`

**Histogram tab:** `ComposedChart` with:
- `Bar` for count (existing violet bars)
- `Line` for KDE overlay (fuchsia, uses right Y axis for density)
- KDE only shown when `kde_points` is not null

**Box Plot tab:** Custom Recharts `ComposedChart`:
- Horizontal layout showing min whisker → Q1 box → median → Q3 box → max whisker
- Outlier dots rendered as scatter points
- Uses `ReferenceLine` and `Bar` with custom shape

**CDF tab:** `AreaChart` with:
- X axis: bin labels
- Y axis: 0–100% (cumulative percentage)
- Gradient fill from violet to transparent

## Data Flow

```
useStore (sessionId, analysisResult)
  → getDistribution({ session_id, column, target_column, n_bins: 20 })
  → DistributionResponse { bins, kde_points, box_stats, cdf }
  → HistCard renders active tab using the appropriate data slice
```

## Error Handling

- KDE/box tabs hidden (tab button disabled) if backend returns `null` for those fields
- CDF tab always available (falls back to histogram bins)
- Existing error/loading states unchanged
