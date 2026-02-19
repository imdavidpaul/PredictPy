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
              formatter={(v: number | undefined, name: string | undefined) => [
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
