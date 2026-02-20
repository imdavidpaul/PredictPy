"use client"

import { useEffect, useState } from "react"
import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Loader2, Maximize2, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { getScatterData } from "@/lib/api"
import { useStore } from "@/store/useStore"
import { cn } from "@/lib/utils"
import type { ScatterResponse } from "@/lib/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeatureScatterState {
  feature: string
  data: ScatterResponse | null
  loading: boolean
  error: string | null
}

// ---------------------------------------------------------------------------
// Mini Scatter Card
// ---------------------------------------------------------------------------

function MiniScatterCard({
  state,
  target,
  isSelected,
  onClick,
}: {
  state: FeatureScatterState
  target: string
  isSelected: boolean
  onClick: () => void
}) {
  const { feature, data, loading, error } = state

  const reg = data?.regression_line

  const directionIcon = reg
    ? reg.slope > 0
      ? <TrendingUp className="w-3.5 h-3.5 text-green-400" />
      : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
    : <Minus className="w-3.5 h-3.5 text-zinc-500" />

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border cursor-pointer transition-all hover:border-violet-500/60 group",
        isSelected
          ? "border-violet-500 bg-violet-500/5"
          : "border-zinc-800 bg-zinc-900 hover:bg-zinc-900"
      )}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          {directionIcon}
          <p className="font-mono text-xs font-semibold text-zinc-200 truncate">{feature}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {reg && (
            <>
              <span
                className={cn(
                  "text-[10px] font-bold",
                  reg.r_squared >= 0.5
                    ? "text-green-400"
                    : reg.r_squared >= 0.2
                    ? "text-yellow-400"
                    : "text-zinc-500"
                )}
              >
                R²={reg.r_squared.toFixed(3)}
              </span>
              {reg.p_value < 0.05 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                  sig
                </span>
              )}
            </>
          )}
          <Maximize2 className="w-3 h-3 text-zinc-600 group-hover:text-violet-400 transition-colors" />
        </div>
      </div>

      {/* Chart area */}
      <div className="px-1 pb-2">
        {loading && (
          <div className="h-44 flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
          </div>
        )}

        {error && (
          <div className="h-44 flex items-center justify-center px-4">
            <p className="text-xs text-red-400 text-center">{error}</p>
          </div>
        )}

        {data && !loading && (
          <ResponsiveContainer width="100%" height={176}>
            <ComposedChart
              margin={{ top: 4, right: 8, left: -20, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="2 2" stroke="#27272a" />
              <XAxis
                type="number"
                dataKey="x"
                tick={{ fill: "#ffffff", fontSize: 9 }}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="y"
                tick={{ fill: "#ffffff", fontSize: 9 }}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: 6,
                  fontSize: 11,
                  padding: "4px 8px",
                }}
                itemStyle={{ color: "#ffffff" }}
                labelStyle={{ color: "#ffffff", marginBottom: 2 }}
                cursor={{ strokeDasharray: "3 3", stroke: "#52525b" }}
                labelFormatter={() => ""}
                formatter={(value: any, name: any) => {
                  const fmt = (v: number | undefined) =>
                    v != null ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : "—"
                  if (name === "x") return [fmt(value), feature]
                  if (name === "y") return [fmt(value), target]
                  return [fmt(value), name]
                }}
              />
              <Scatter
                data={data.points.map((p) => ({ x: p.x, y: p.y }))}
                fill="#8b5cf6"
                opacity={0.55}
                r={2}
              />
              <Line
                data={data.regression_line.x.map((x, i) => ({
                  x,
                  regY: data.regression_line.y[i],
                }))}
                dataKey="regY"
                dot={false}
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                type="linear"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer */}
      {data && (
        <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-zinc-600">
          <span>{data.n_points} points</span>
          <span>
            y = {data.regression_line.slope.toFixed(3)}x{" "}
            {data.regression_line.intercept >= 0 ? "+" : ""}
            {data.regression_line.intercept.toFixed(3)}
          </span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Full Detail Panel (shown below grid when feature is selected)
// ---------------------------------------------------------------------------

function FullDetail({ data }: { data: ScatterResponse }) {
  const reg = data.regression_line
  const chartData = data.points.map((p) => ({ x: p.x, y: p.y }))
  const regLineData = reg.x.map((x, i) => ({ x, regY: reg.y[i] }))

  return (
    <div className="rounded-xl bg-zinc-900 border border-violet-500/40 p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-zinc-200">
            <span className="text-violet-300 font-mono">{data.feature}</span>
            <span className="text-zinc-600 mx-2">vs</span>
            <span className="text-orange-300 font-mono">{data.target}</span>
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">{data.n_points} data points</p>
        </div>
        <div className="flex gap-3">
          {[
            { label: "R²", value: reg.r_squared.toFixed(4), cls: "text-violet-300" },
            { label: "Slope", value: reg.slope.toFixed(4), cls: "text-zinc-300" },
            {
              label: "p-value",
              value: reg.p_value < 0.0001 ? "<0.0001" : reg.p_value.toFixed(4),
              cls: reg.p_value < 0.05 ? "text-green-400" : "text-yellow-400",
            },
          ].map(({ label, value, cls }) => (
            <div
              key={label}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-center"
            >
              <p className="text-xs text-zinc-500">{label}</p>
              <p className={`text-sm font-bold ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            type="number"
            dataKey="x"
            tick={{ fill: "#ffffff", fontSize: 11 }}
            label={{
              value: data.feature,
              position: "insideBottom",
              offset: -10,
              fill: "#ffffff",
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            tick={{ fill: "#ffffff", fontSize: 11 }}
            label={{
              value: data.target,
              angle: -90,
              position: "insideLeft",
              fill: "#ffffff",
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 8,
              fontSize: 12,
            }}
            itemStyle={{ color: "#ffffff" }}
            labelStyle={{ color: "#ffffff", marginBottom: 4 }}
            cursor={{ strokeDasharray: "3 3", stroke: "#52525b" }}
            labelFormatter={() => ""}
            formatter={(value: any, name: any) => {
              const fmt = (v: number | undefined) =>
                v != null ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : "—"
              if (name === "x") return [fmt(value), data.feature]
              if (name === "y") return [fmt(value), data.target]
              return [fmt(value), name]
            }}
          />
          <Scatter data={chartData} fill="#8b5cf6" opacity={0.6} r={3} />
          <Line
            data={regLineData}
            dataKey="regY"
            dot={false}
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="6 3"
            type="linear"
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="font-mono text-sm text-zinc-300 bg-zinc-800 rounded-lg px-4 py-2.5">
        <span className="text-zinc-500">ŷ = </span>
        <span className="text-orange-300">{reg.slope.toFixed(4)}</span>
        <span className="text-zinc-500"> × x + </span>
        <span className="text-violet-300">{reg.intercept.toFixed(4)}</span>
        <span className="text-zinc-600 ml-4 text-xs">R² = {reg.r_squared.toFixed(4)}</span>
        {reg.p_value < 0.05 && (
          <span className="ml-3 text-green-400 text-xs">Statistically significant</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main ScatterGrid Component
// ---------------------------------------------------------------------------

const TOP_N_OPTIONS = [4, 8, 12, 20]

export default function ScatterGrid() {
  const { sessionId, analysisResult, selectedFeature, setSelectedFeature } = useStore()

  const [topN, setTopN] = useState(8)
  const [states, setStates] = useState<FeatureScatterState[]>([])
  const [expandedData, setExpandedData] = useState<ScatterResponse | null>(null)

  const target = analysisResult?.target_column ?? ""
  const features = analysisResult?.features ?? []

  // Fetch scatter data for top N features in parallel
  useEffect(() => {
    if (!sessionId || !target || features.length === 0) return

    const topFeatures = features.slice(0, topN).map((f) => f.column)

    // Initialize loading states
    setStates(
      topFeatures.map((f) => ({ feature: f, data: null, loading: true, error: null }))
    )

    // Fetch all in parallel
    topFeatures.forEach((feature) => {
      getScatterData({
        session_id: sessionId,
        feature_column: feature,
        target_column: target,
        max_points: 300,
      })
        .then((data) => {
          setStates((prev) =>
            prev.map((s) =>
              s.feature === feature ? { ...s, data, loading: false } : s
            )
          )
        })
        .catch((e) => {
          setStates((prev) =>
            prev.map((s) =>
              s.feature === feature
                ? { ...s, loading: false, error: e.message }
                : s
            )
          )
        })
    })
  }, [sessionId, target, features, topN])

  // When a card is clicked, update expanded detail
  const handleCardClick = (feature: string) => {
    const state = states.find((s) => s.feature === feature)
    if (selectedFeature === feature) {
      setSelectedFeature(null)
      setExpandedData(null)
    } else {
      setSelectedFeature(feature)
      setExpandedData(state?.data ?? null)
    }
  }

  // Keep expanded data in sync when data loads
  useEffect(() => {
    if (selectedFeature) {
      const state = states.find((s) => s.feature === selectedFeature)
      if (state?.data) setExpandedData(state.data)
    }
  }, [states, selectedFeature])

  if (!analysisResult) return null

  if (features.length === 0) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-12 flex flex-col items-center justify-center gap-3 text-center">
        <p className="text-zinc-300 font-medium">No scatter plots available</p>
        <p className="text-sm text-zinc-500">
          There are no numeric features to plot against the target column.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Scatter Plots — Each Feature vs{" "}
            <span className="text-orange-300 font-mono normal-case">{target}</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Click any plot to expand details · Ranked by feature importance
          </p>
        </div>

        {/* Top N selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Show top:</span>
          <div className="flex gap-1">
            {TOP_N_OPTIONS.filter((n) => n <= features.length + 3).map((n) => (
              <button
                key={n}
                onClick={() => {
                  setTopN(n)
                  setSelectedFeature(null)
                  setExpandedData(null)
                }}
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

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {states.map((state) => (
          <MiniScatterCard
            key={state.feature}
            state={state}
            target={target}
            isSelected={selectedFeature === state.feature}
            onClick={() => handleCardClick(state.feature)}
          />
        ))}
      </div>

      {/* Expanded full-detail view */}
      {selectedFeature && expandedData && (
        <div>
          <p className="text-xs text-zinc-500 mb-3">
            Expanded view —{" "}
            <button
              onClick={() => {
                setSelectedFeature(null)
                setExpandedData(null)
              }}
              className="text-violet-400 underline underline-offset-2 hover:text-violet-300"
            >
              close
            </button>
          </p>
          <FullDetail data={expandedData} />
        </div>
      )}
    </div>
  )
}
