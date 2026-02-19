# Advanced Visualizations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add KDE overlay, Box Plot, and CDF tabs to each feature card in the Histogram component.

**Architecture:** Enrich the existing `POST /distribution` backend endpoint to return `kde_points`, `box_stats`, and `cdf` alongside the existing `bins`. The frontend `Histogram.tsx` gains a 3-tab UI per card (Histogram+KDE | Box Plot | CDF) — no new API endpoints, no new Python packages (scipy already installed).

**Tech Stack:** Python/FastAPI/scipy/numpy (backend), React/TypeScript/Recharts/Tailwind (frontend)

---

### Task 1: Update TypeScript types

**Files:**
- Modify: `frontend/lib/types.ts:300-317`

**Step 1: Replace the existing `DistributionBin` and `DistributionResponse` interfaces**

Find this block (lines 300–317):
```ts
export interface DistributionBin {
  label: string
  start?: number
  end?: number
  count: number
  midpoint: number
  mean_y: number | null
}

export interface DistributionResponse {
  column: string
  col_type: "numeric" | "categorical"
  chart_type: "histogram" | "per_value"
  total: number
  unique: number
  n_nan: number
  bins: DistributionBin[]
}
```

Replace with:
```ts
export interface DistributionBin {
  label: string
  start?: number
  end?: number
  count: number
  midpoint: number
  mean_y: number | null
}

export interface KdePoint {
  x: number
  density: number
}

export interface BoxStats {
  min: number
  q1: number
  median: number
  q3: number
  max: number
  outliers: number[]
}

export interface CdfPoint {
  label: string
  cumulative_pct: number
}

export interface DistributionResponse {
  column: string
  col_type: "numeric" | "categorical"
  chart_type: "histogram" | "per_value"
  total: number
  unique: number
  n_nan: number
  bins: DistributionBin[]
  kde_points: KdePoint[] | null
  box_stats: BoxStats | null
  cdf: CdfPoint[] | null
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd "C:\Users\danny\AntiGravity\Project -1\frontend" && npx tsc --noEmit 2>&1
```
Expected: same pre-existing errors in `ScatterGrid.tsx` only — no new errors.

**Step 3: Commit**

```bash
cd "C:\Users\danny\AntiGravity\Project -1"
git add frontend/lib/types.ts
git commit -m "feat: add KDE, BoxStats, CdfPoint types to DistributionResponse"
```

---

### Task 2: Enrich the `/distribution` backend endpoint

**Files:**
- Modify: `backend/main.py:496-580`

**Step 1: Add scipy import at the top of main.py**

Find the existing numpy/pandas imports (around line 22–23):
```python
import numpy as np
import pandas as pd
```

Add scipy after them:
```python
import numpy as np
import pandas as pd
from scipy import stats as scipy_stats
```

**Step 2: Replace the return statement of `get_distribution` (lines 572–580)**

Find:
```python
    return {
        "column": column,
        "col_type": "numeric" if is_numeric else "categorical",
        "chart_type": chart_type,
        "total": int(len(series)),
        "unique": n_unique,
        "n_nan": n_nan,
        "bins": bins,
    }
```

Replace with:
```python
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
            box_stats = {
                "min": round(float(non_outliers.min()) if len(non_outliers) else q1, 6),
                "q1": round(q1, 6),
                "median": round(median, 6),
                "q3": round(q3, 6),
                "max": round(float(non_outliers.max()) if len(non_outliers) else q3, 6),
                "outliers": [round(float(v), 6) for v in sorted(outlier_vals)[:100]],
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
```

**Step 3: Restart the backend and verify the endpoint**

```bash
cd "C:\Users\danny\AntiGravity\Project -1\backend"
python -m uvicorn main:app --reload --port 8000
```

In a second terminal, test with curl (replace `<token>` and `<session_id>` with real values after uploading a file via the UI):
```bash
curl -s -X POST http://localhost:8000/distribution \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"session_id":"<session_id>","column":"<col>","n_bins":20}' | python -m json.tool
```
Expected: response includes `kde_points`, `box_stats`, `cdf` fields alongside `bins`.

**Step 4: Commit**

```bash
cd "C:\Users\danny\AntiGravity\Project -1"
git add backend/main.py
git commit -m "feat: add KDE, box stats, and CDF to /distribution endpoint"
```

---

### Task 3: Update Histogram.tsx with tabs and new charts

**Files:**
- Modify: `frontend/components/Histogram.tsx` (full rewrite)

**Step 1: Replace the entire file with this content**

```tsx
"use client"

import { useState, useEffect } from "react"
import {
  ComposedChart,
  AreaChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import { Loader2 } from "lucide-react"
import { useStore } from "@/store/useStore"
import { getDistribution } from "@/lib/api"
import type { DistributionResponse, BoxStats } from "@/lib/types"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeatureHistState {
  column: string
  data: DistributionResponse | null
  loading: boolean
  error: string | null
}

type Tab = "histogram" | "box" | "cdf"

// ---------------------------------------------------------------------------
// Box Plot (custom SVG — Recharts has no native box plot)
// ---------------------------------------------------------------------------

function BoxPlotChart({ stats }: { stats: BoxStats }) {
  const { min, q1, median, q3, max, outliers } = stats
  const W = 300
  const H = 100
  const padX = 32
  const range = max - min || 1
  const toX = (v: number) => padX + ((v - min) / range) * (W - padX * 2)
  const midY = H / 2

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Whisker line */}
      <line x1={toX(min)} y1={midY} x2={toX(max)} y2={midY} stroke="#52525b" strokeWidth={1.5} />
      {/* Min cap */}
      <line x1={toX(min)} y1={midY - 8} x2={toX(min)} y2={midY + 8} stroke="#71717a" strokeWidth={1.5} />
      {/* Max cap */}
      <line x1={toX(max)} y1={midY - 8} x2={toX(max)} y2={midY + 8} stroke="#71717a" strokeWidth={1.5} />
      {/* IQR box */}
      <rect
        x={toX(q1)}
        y={midY - 14}
        width={Math.max(toX(q3) - toX(q1), 2)}
        height={28}
        fill="#7c3aed"
        fillOpacity={0.25}
        stroke="#7c3aed"
        strokeWidth={1.5}
        rx={2}
      />
      {/* Median line */}
      <line x1={toX(median)} y1={midY - 14} x2={toX(median)} y2={midY + 14} stroke="#a78bfa" strokeWidth={2.5} />
      {/* Outliers */}
      {outliers.map((v, i) => (
        <circle key={i} cx={toX(v)} cy={midY} r={3} fill="#f59e0b" fillOpacity={0.8} />
      ))}
      {/* Axis labels */}
      <text x={toX(min)} y={H - 4} textAnchor="middle" fontSize={8} fill="#52525b">
        {min.toFixed(1)}
      </text>
      <text x={toX(median)} y={H - 4} textAnchor="middle" fontSize={8} fill="#a78bfa">
        {median.toFixed(1)}
      </text>
      <text x={toX(max)} y={H - 4} textAnchor="middle" fontSize={8} fill="#52525b">
        {max.toFixed(1)}
      </text>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Single Chart Card
// ---------------------------------------------------------------------------

const TOOLTIP_STYLE = {
  background: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: 6,
  color: "#e4e4e7",
  fontSize: 11,
  padding: "4px 8px",
}

function HistCard({ state }: { state: FeatureHistState }) {
  const { column, data, loading, error } = state
  const [activeTab, setActiveTab] = useState<Tab>("histogram")

  const subtitle = data
    ? `(${data.col_type} · ${data.unique} unique · ${data.n_nan} nan)`
    : null

  const tabs: { key: Tab; label: string; disabled?: boolean }[] = [
    { key: "histogram", label: "Histogram" },
    { key: "box", label: "Box Plot", disabled: !data?.box_stats },
    { key: "cdf", label: "CDF", disabled: !data?.cdf },
  ]

  // Map KDE points onto bins by nearest x for the ComposedChart overlay
  const binsWithKde = data?.bins.map((bin) => {
    if (!data.kde_points) return { ...bin, density: undefined }
    const nearest = data.kde_points.reduce((best, pt) =>
      Math.abs(pt.x - bin.midpoint) < Math.abs(best.x - bin.midpoint) ? pt : best
    )
    return { ...bin, density: nearest.density }
  })

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
      {/* Header */}
      <div className="mb-3">
        <p className="text-xs font-bold text-zinc-200 leading-snug">
          <span className="text-violet-300 font-mono">{column}</span>
        </p>
        {subtitle && (
          <p className="text-[10px] text-zinc-500 mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Tabs */}
      {data && !loading && (
        <div className="flex gap-1 mb-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => !tab.disabled && setActiveTab(tab.key)}
              disabled={tab.disabled}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium transition-all",
                activeTab === tab.key
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700",
                tab.disabled && "opacity-30 cursor-not-allowed hover:bg-zinc-800"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="h-52 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="h-52 flex items-center justify-center px-2">
          <p className="text-[11px] bg-red-500/10 border border-red-500/20 text-red-300 text-center rounded px-2 py-1">
            {error}
          </p>
        </div>
      )}

      {/* Histogram + KDE tab */}
      {data && !loading && activeTab === "histogram" && (
        <ResponsiveContainer width="100%" height={210}>
          <ComposedChart
            data={binsWithKde}
            margin={{
              top: 4,
              right: data.kde_points ? 40 : 8,
              left: 0,
              bottom: data.bins.length > 8 ? 44 : 16,
            }}
          >
            <CartesianGrid strokeDasharray="2 2" stroke="#27272a" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#52525b", fontSize: 9 }}
              angle={data.bins.length > 8 ? -35 : 0}
              textAnchor={data.bins.length > 8 ? "end" : "middle"}
              interval={data.bins.length > 12 ? Math.floor(data.bins.length / 8) : 0}
              tickLine={false}
            />
            <YAxis
              yAxisId="count"
              tick={{ fill: "#71717a", fontSize: 9 }}
              tickLine={false}
              width={36}
              label={{ value: "Count", angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 9, dy: 18 }}
            />
            {data.kde_points && (
              <YAxis
                yAxisId="density"
                orientation="right"
                tick={{ fill: "#c084fc", fontSize: 9 }}
                tickLine={false}
                width={36}
                tickFormatter={(v: number) => v.toFixed(3)}
                label={{ value: "Density", angle: 90, position: "insideRight", fill: "#c084fc", fontSize: 9, dy: -18 }}
              />
            )}
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number | undefined, name: string) => [
                v != null ? (name === "density" ? v.toFixed(5) : v.toLocaleString()) : "—",
                name === "density" ? "KDE Density" : "Count",
              ]}
            />
            <Bar yAxisId="count" dataKey="count" fill="#7c3aed" opacity={0.85} radius={[2, 2, 0, 0]} />
            {data.kde_points && (
              <Line
                yAxisId="density"
                dataKey="density"
                stroke="#c084fc"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls
                type="monotone"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Box Plot tab */}
      {data && !loading && activeTab === "box" && data.box_stats && (
        <div className="h-[210px] flex flex-col justify-center px-2 space-y-3">
          <BoxPlotChart stats={data.box_stats} />
          <div className="grid grid-cols-3 gap-1 text-center">
            {[
              { label: "Q1", value: data.box_stats.q1 },
              { label: "Median", value: data.box_stats.median },
              { label: "Q3", value: data.box_stats.q3 },
            ].map(({ label, value }) => (
              <div key={label} className="bg-zinc-800 rounded px-2 py-1">
                <p className="text-[9px] text-zinc-500 uppercase">{label}</p>
                <p className="text-[11px] text-violet-300 font-mono">{value.toFixed(3)}</p>
              </div>
            ))}
          </div>
          {data.box_stats.outliers.length > 0 && (
            <p className="text-[10px] text-zinc-500 text-center">
              {data.box_stats.outliers.length} outlier{data.box_stats.outliers.length !== 1 ? "s" : ""}{" "}
              <span className="text-amber-400">(shown in amber)</span>
            </p>
          )}
        </div>
      )}

      {/* CDF tab */}
      {data && !loading && activeTab === "cdf" && data.cdf && (
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart
            data={data.cdf}
            margin={{ top: 4, right: 8, left: 0, bottom: data.cdf.length > 8 ? 44 : 16 }}
          >
            <defs>
              <linearGradient id={`cdf-grad-${column}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 2" stroke="#27272a" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#52525b", fontSize: 9 }}
              angle={data.cdf.length > 8 ? -35 : 0}
              textAnchor={data.cdf.length > 8 ? "end" : "middle"}
              interval={data.cdf.length > 12 ? Math.floor(data.cdf.length / 8) : 0}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 9 }}
              tickLine={false}
              width={36}
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              label={{ value: "Cumul. %", angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 9, dy: 28 }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number | undefined) => [
                v != null ? `${v.toFixed(1)}%` : "—",
                "Cumulative",
              ]}
            />
            <Area
              type="monotone"
              dataKey="cumulative_pct"
              stroke="#7c3aed"
              strokeWidth={2}
              fill={`url(#cdf-grad-${column})`}
              dot={false}
              activeDot={{ r: 3, fill: "#a78bfa" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Grid Component
// ---------------------------------------------------------------------------

const TOP_N_OPTIONS = [4, 9, 15]

export default function Histogram() {
  const { sessionId, analysisResult } = useStore()
  const [topN, setTopN] = useState(9)
  const [states, setStates] = useState<FeatureHistState[]>([])

  const target = analysisResult?.target_column ?? ""
  const features = analysisResult?.features ?? []

  useEffect(() => {
    if (!sessionId || !target || features.length === 0) return

    const topFeatures = features.slice(0, topN).map((f) => f.column)

    setStates(
      topFeatures.map((col) => ({
        column: col,
        data: null,
        loading: true,
        error: null,
      }))
    )

    topFeatures.forEach((column) => {
      getDistribution({
        session_id: sessionId,
        column,
        target_column: target,
        n_bins: 20,
      })
        .then((data) => {
          setStates((prev) =>
            prev.map((s) =>
              s.column === column ? { ...s, data, loading: false } : s
            )
          )
        })
        .catch((e: unknown) => {
          const message = e instanceof Error ? e.message : "Unknown error"
          setStates((prev) =>
            prev.map((s) =>
              s.column === column
                ? { ...s, loading: false, error: message }
                : s
            )
          )
        })
    })
  }, [sessionId, target, analysisResult, topN])

  if (!analysisResult) return null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Feature Distributions
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Histogram · KDE · Box Plot · CDF per feature
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Show top:</span>
          <div className="flex gap-1">
            {TOP_N_OPTIONS.filter((n) => n <= features.length).map((n) => (
              <button
                key={n}
                onClick={() => setTopN(n)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                  topN === n
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {states.map((state) => (
          <HistCard key={state.column} state={state} />
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript**

```bash
cd "C:\Users\danny\AntiGravity\Project -1\frontend" && npx tsc --noEmit 2>&1
```
Expected: no errors in `Histogram.tsx` or `types.ts`. Same pre-existing errors in `ScatterGrid.tsx` only.

**Step 3: Commit**

```bash
cd "C:\Users\danny\AntiGravity\Project -1"
git add frontend/components/Histogram.tsx
git commit -m "feat: add KDE, Box Plot, and CDF tabs to Histogram component"
```

---

## Verification Checklist (manual, in browser)

After all tasks, upload a CSV with numeric columns and:
- [ ] Histogram tab shows violet bars with purple KDE line overlay (numeric columns)
- [ ] Box Plot tab shows the IQR box, whiskers, median line, and amber outlier dots
- [ ] CDF tab shows a smooth violet area curve climbing from 0% to 100%
- [ ] Box Plot tab is disabled (greyed out) for categorical columns
- [ ] Switching tabs within a card works instantly (no re-fetch)
- [ ] Top-N selector still works
