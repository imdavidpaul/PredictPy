# Histogram Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the combined bar+line DistributionCharts component with a pure frequency histogram (count bars only).

**Architecture:** Delete `DistributionCharts.tsx`, create `Histogram.tsx` using Recharts `BarChart` with a single Y axis for count. Update the import in `dashboard/page.tsx`. No backend changes — the `/distribution` endpoint already returns `count` per bin; `mean_y` is simply ignored.

**Tech Stack:** React, Recharts (`BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `CartesianGrid`, `ResponsiveContainer`), Tailwind CSS, Zustand, `getDistribution` from `lib/api.ts`

---

### Task 1: Create `Histogram.tsx`

**Files:**
- Create: `frontend/components/Histogram.tsx`
- Reference: `frontend/components/DistributionCharts.tsx` (for data-fetching pattern)
- Reference: `frontend/lib/types.ts` (for `DistributionResponse`)

**Step 1: Create the file with this exact content**

```tsx
"use client"

import { useState, useEffect } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import { Loader2 } from "lucide-react"
import { useStore } from "@/store/useStore"
import { getDistribution } from "@/lib/api"
import type { DistributionResponse } from "@/lib/types"
import { cn } from "@/lib/utils"

interface FeatureHistState {
  column: string
  data: DistributionResponse | null
  loading: boolean
  error: string | null
}

function HistCard({ state }: { state: FeatureHistState }) {
  const { column, data, loading, error } = state

  const subtitle = data
    ? `(${data.col_type} · ${data.unique} unique · ${data.n_nan} nan)`
    : null

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
      <div className="mb-3">
        <p className="text-xs font-bold text-zinc-200 leading-snug">
          <span className="text-violet-300 font-mono">{column}</span>
          <span className="text-zinc-400 font-normal">: Histogram</span>
        </p>
        {subtitle && (
          <p className="text-[10px] text-zinc-500 mt-0.5">{subtitle}</p>
        )}
      </div>

      {loading && (
        <div className="h-52 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
        </div>
      )}

      {error && !loading && (
        <div className="h-52 flex items-center justify-center px-2">
          <p className="text-[11px] text-red-400 text-center">{error}</p>
        </div>
      )}

      {data && !loading && (
        <ResponsiveContainer width="100%" height={210}>
          <BarChart
            data={data.bins}
            margin={{
              top: 4,
              right: 8,
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
              interval={
                data.bins.length > 12 ? Math.floor(data.bins.length / 8) : 0
              }
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 9 }}
              tickLine={false}
              width={36}
              label={{
                value: "Count",
                angle: -90,
                position: "insideLeft",
                fill: "#71717a",
                fontSize: 9,
                dy: 18,
              }}
            />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: 6,
                color: "#e4e4e7",
                fontSize: 11,
                padding: "4px 8px",
              }}
              formatter={(v: number | undefined) => [
                v != null ? v.toLocaleString() : "—",
                "Count",
              ]}
            />
            <Bar
              dataKey="count"
              fill="#7c3aed"
              opacity={0.85}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

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
        .catch((e: Error) => {
          setStates((prev) =>
            prev.map((s) =>
              s.column === column
                ? { ...s, loading: false, error: e.message }
                : s
            )
          )
        })
    })
  }, [sessionId, target, features, topN])

  if (!analysisResult) return null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Feature Histograms
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Frequency distribution of top features
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Show top:</span>
          <div className="flex gap-1">
            {TOP_N_OPTIONS.filter((n) => n <= features.length + 2).map((n) => (
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

**Step 2: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors related to `Histogram.tsx`

**Step 3: Commit**

```bash
git add frontend/components/Histogram.tsx
git commit -m "feat: add Histogram component (pure frequency bars)"
```

---

### Task 2: Swap the import in `dashboard/page.tsx`

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`

**Step 1: Replace the import line**

Find:
```tsx
import DistributionCharts from "@/components/DistributionCharts"
```
Replace with:
```tsx
import Histogram from "@/components/Histogram"
```

**Step 2: Replace the JSX usage**

Find (around line 234):
```tsx
<DistributionCharts />
```
Replace with:
```tsx
<Histogram />
```

**Step 3: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/app/dashboard/page.tsx
git commit -m "feat: swap DistributionCharts for Histogram in charts step"
```

---

### Task 3: Delete `DistributionCharts.tsx`

**Files:**
- Delete: `frontend/components/DistributionCharts.tsx`

**Step 1: Delete the file**

```bash
rm frontend/components/DistributionCharts.tsx
```

**Step 2: Verify no remaining references**

```bash
grep -r "DistributionCharts" frontend/
```
Expected: No output (zero references remaining)

**Step 3: Final TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove DistributionCharts component"
```
