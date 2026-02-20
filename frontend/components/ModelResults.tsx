"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Scatter,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  Legend,
  ReferenceLine,
} from "recharts"
import { useState, useEffect, useMemo } from "react"
import { Download, Trophy, Star, AlertTriangle, Loader2, Sparkles } from "lucide-react"
import { useStore } from "@/store/useStore"
import { getSHAP } from "@/lib/api"
import type { ModelResult, SHAPResponse, RocCurveEntry } from "@/lib/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RECHARTS_TOOLTIP_STYLE = {
  background: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: 8,
  color: "#e4e4e7",
  fontSize: 12,
}

const AXIS_TICK_STYLE = { fill: "#ffffff", fontSize: 11 }

function downloadModel(base64: string, modelName: string): string | null {
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${modelName.replace(/ /g, "_")}.pkl`
    a.click()
    URL.revokeObjectURL(url)
    return null
  } catch {
    return "Failed to decode model file. Please try training again."
  }
}

function MetricValue({
  value,
  ci,
  highlight,
}: {
  value: number | null | undefined
  ci?: { lower: number; upper: number } | null
  highlight?: boolean
}) {
  if (value === null || value === undefined) return <span className="text-zinc-600">—</span>
  return (
    <span className={highlight ? "text-violet-300 font-bold" : undefined}>
      {value.toFixed(4)}
      {ci && (
        <span className="block text-[10px] text-zinc-500 font-normal">
          [{ci.lower.toFixed(3)}, {ci.upper.toFixed(3)}]
        </span>
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Metrics Table
// ---------------------------------------------------------------------------

function MetricsTable({
  models,
  problemType,
  bestModel,
}: {
  models: ModelResult[]
  problemType: string
  bestModel: string
}) {
  const isRegression = problemType === "regression"

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
          Model Comparison
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
              <th className="text-left px-5 py-3">Model</th>
              {isRegression ? (
                <>
                  <th className="text-right px-4 py-3">R²</th>
                  <th className="text-right px-4 py-3">MAE</th>
                  <th className="text-right px-4 py-3">RMSE</th>
                </>
              ) : (
                <>
                  <th className="text-right px-4 py-3">Accuracy</th>
                  <th className="text-right px-4 py-3">F1</th>
                  <th className="text-right px-4 py-3">ROC-AUC</th>
                </>
              )}
              <th className="text-right px-5 py-3">CV Score</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => {
              const isBest = m.model_name === bestModel
              const hasCv = m.metrics.cv_mean != null
              return (
                <tr
                  key={m.model_name}
                  className={`border-b border-zinc-800/50 transition-colors ${
                    isBest ? "bg-violet-500/5 hover:bg-violet-500/8" : "hover:bg-zinc-800/30"
                  }`}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {isBest && (
                        <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" aria-hidden="true" />
                      )}
                      <span className={`font-medium ${isBest ? "text-violet-300" : "text-zinc-300"}`}>
                        {m.model_name}
                      </span>
                      {isBest && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                          Best
                        </span>
                      )}
                    </div>
                  </td>
                  {isRegression ? (
                    <>
                      <td className="px-4 py-3 text-right text-zinc-300 font-mono">
                        <MetricValue value={m.metrics.r2} ci={m.metrics.ci?.r2} highlight={isBest} />
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300 font-mono">
                        <MetricValue value={m.metrics.mae} ci={m.metrics.ci?.mae} />
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300 font-mono">
                        <MetricValue value={m.metrics.rmse} ci={m.metrics.ci?.rmse} />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-right text-zinc-300 font-mono">
                        <MetricValue value={m.metrics.accuracy} ci={m.metrics.ci?.accuracy} highlight={isBest} />
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300 font-mono">
                        <MetricValue value={m.metrics.f1} ci={m.metrics.ci?.f1} />
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300 font-mono">
                        <MetricValue value={m.metrics.roc_auc} />
                      </td>
                    </>
                  )}
                  <td className="px-5 py-3 text-right font-mono">
                    {hasCv ? (
                      <span className="text-cyan-400">
                        {m.metrics.cv_mean!.toFixed(4)}
                        <span className="text-zinc-600 text-[10px] ml-1">
                          ±{m.metrics.cv_std!.toFixed(4)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-zinc-700">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feature Importance Chart
// ---------------------------------------------------------------------------

function ImportanceChart({ model }: { model: ModelResult }) {
  if (!model.feature_importances || model.feature_importances.length === 0) return null

  const top10 = model.feature_importances.slice(0, 10)
  const chartHeight = Math.max(top10.length * 36 + 20, 120)

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4">
        Feature Importance — {model.model_name}
      </h3>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={top10}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        >
          <XAxis
            type="number"
            tick={AXIS_TICK_STYLE}
            tickFormatter={(v: number) => v.toFixed(3)}
          />
          <YAxis
            type="category"
            dataKey="feature"
            tick={{ ...AXIS_TICK_STYLE, fontFamily: "monospace" }}
            width={120}
          />
          <Tooltip
            contentStyle={RECHARTS_TOOLTIP_STYLE}
            itemStyle={{ color: "#e4e4e7" }}
            labelStyle={{ color: "#a1a1aa", marginBottom: 4 }}
            formatter={(v: number | undefined) => [(v ?? 0).toFixed(6), "Importance"]}
          />
          <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
            {top10.map((_, i) => (
              <Cell
                key={i}
                fill={i === 0 ? "#8b5cf6" : i < 3 ? "#7c3aed" : "#6d28d9"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Actual vs Predicted Chart
// ---------------------------------------------------------------------------

function PredictionsChart({ model }: { model: ModelResult }) {
  if (!model.predictions || model.predictions.length === 0) return null

  const data = model.predictions
  const allVals = data.flatMap((p) => [p.actual, p.predicted])
  const minVal = Math.min(...allVals)
  const maxVal = Math.max(...allVals)

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4">
        Actual vs Predicted — {model.model_name}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            type="number"
            dataKey="actual"
            name="Actual"
            domain={[minVal, maxVal]}
            tick={AXIS_TICK_STYLE}
            label={{ value: "Actual", position: "insideBottom", offset: -4, fill: "#71717a", fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="predicted"
            name="Predicted"
            domain={[minVal, maxVal]}
            tick={AXIS_TICK_STYLE}
            label={{ value: "Predicted", angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={RECHARTS_TOOLTIP_STYLE}
            itemStyle={{ color: "#e4e4e7" }}
            labelStyle={{ color: "#a1a1aa", marginBottom: 4 }}
            cursor={{ strokeDasharray: "3 3", stroke: "#52525b" }}
          />
          <Scatter data={data} fill="#8b5cf6" opacity={0.6} r={3} />
          {/* Perfect prediction diagonal */}
          <Line
            data={[
              { actual: minVal, predicted: minVal },
              { actual: maxVal, predicted: maxVal },
            ]}
            dataKey="predicted"
            dot={false}
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            type="linear"
            name="Perfect prediction"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-xs text-zinc-600 mt-2 text-center">
        Points close to the dashed line indicate more accurate predictions
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SHAP Feature Importance Chart
// ---------------------------------------------------------------------------

function SHAPImportanceChart({ sessionId }: { sessionId: string }) {
  const [shapData, setShapData] = useState<SHAPResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasFetched, setHasFetched] = useState(false)

  const fetchShap = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getSHAP({ session_id: sessionId, max_samples: 500 })
      setShapData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compute SHAP values.")
    } finally {
      setLoading(false)
      setHasFetched(true)
    }
  }

  // Auto-fetch on mount
  useEffect(() => {
    if (!hasFetched) {
      fetchShap()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  if (loading) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          SHAP Feature Importance
        </h3>
        <div className="flex items-center justify-center py-12 text-zinc-500 text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Computing SHAP values...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          SHAP Feature Importance
        </h3>
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </p>
      </div>
    )
  }

  if (!shapData || shapData.mean_abs_shap.length === 0) return null

  const top15 = shapData.mean_abs_shap.slice(0, 15)
  const chartHeight = Math.max(top15.length * 36 + 20, 120)

  // Violet gradient: top features get brighter violet
  const getBarColor = (index: number): string => {
    if (index === 0) return "#a78bfa"  // violet-400
    if (index < 3) return "#8b5cf6"    // violet-500
    if (index < 6) return "#7c3aed"    // violet-600
    return "#6d28d9"                    // violet-700
  }

  const methodLabel = shapData.method === "shap"
    ? "SHAP"
    : shapData.method === "model_importance"
      ? "Model Importance"
      : shapData.method === "coefficients"
        ? "Coefficient Magnitude"
        : "Importance"

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            {methodLabel} Feature Importance
          </h3>
          <p className="text-[10px] text-zinc-600 mt-1">
            Higher = feature has larger impact on model output
          </p>
        </div>
        <div className="flex items-center gap-2">
          {shapData.method === "shap" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
              True SHAP
            </span>
          )}
          <span className="text-[10px] text-zinc-600">
            {shapData.n_samples} samples
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={top15}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        >
          <XAxis
            type="number"
            tick={AXIS_TICK_STYLE}
            tickFormatter={(v: number) => v.toFixed(4)}
            label={{
              value: `mean |${methodLabel}|`,
              position: "insideBottom",
              offset: -2,
              fill: "#71717a",
              fontSize: 10,
            }}
          />
          <YAxis
            type="category"
            dataKey="feature"
            tick={{ ...AXIS_TICK_STYLE, fontFamily: "monospace" }}
            width={140}
          />
          <Tooltip
            contentStyle={RECHARTS_TOOLTIP_STYLE}
            itemStyle={{ color: "#e4e4e7" }}
            labelStyle={{ color: "#a1a1aa", marginBottom: 4 }}
            formatter={(v: number | undefined) => [
              (v ?? 0).toFixed(6),
              `mean |${methodLabel}|`,
            ]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {top15.map((_, i) => (
              <Cell key={i} fill={getBarColor(i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confusion Matrix Heatmap (classification only)
// ---------------------------------------------------------------------------

/** Violet shades for diagonal (correct), zinc shades for off-diagonal (errors) */
function cellColor(value: number, maxVal: number, isDiagonal: boolean): string {
  if (maxVal === 0) return isDiagonal ? "rgba(139, 92, 246, 0.1)" : "rgba(113, 113, 122, 0.1)"
  const ratio = Math.min(value / maxVal, 1)
  if (isDiagonal) {
    // violet-500 at full intensity
    const alpha = 0.1 + ratio * 0.7
    return `rgba(139, 92, 246, ${alpha.toFixed(2)})`
  }
  // zinc-500 at full intensity for errors
  const alpha = 0.05 + ratio * 0.5
  return `rgba(113, 113, 122, ${alpha.toFixed(2)})`
}

function ConfusionMatrixChart({
  matrix,
  labels,
}: {
  matrix: number[][]
  labels: string[]
}) {
  const maxVal = Math.max(...matrix.flat(), 1)

  // Row sums for percentage calculation (% of true class)
  const rowSums = matrix.map((row) => row.reduce((a, b) => a + b, 0))

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4">
        Confusion Matrix
      </h3>

      <div className="overflow-x-auto">
        {/* Column header: Predicted */}
        <div className="flex items-center justify-center mb-2">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
            Predicted
          </span>
        </div>

        <div className="flex">
          {/* Row header: Actual (rotated) */}
          <div className="flex items-center justify-center mr-2">
            <span
              className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Actual
            </span>
          </div>

          <div className="flex-1">
            {/* Column labels */}
            <div
              className="grid gap-1 mb-1"
              style={{
                gridTemplateColumns: `80px repeat(${labels.length}, minmax(60px, 1fr))`,
              }}
            >
              <div /> {/* spacer */}
              {labels.map((label) => (
                <div
                  key={`col-${label}`}
                  className="text-center text-[10px] text-zinc-400 font-mono truncate px-1"
                  title={label}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Matrix rows */}
            {matrix.map((row, rowIdx) => (
              <div
                key={`row-${rowIdx}`}
                className="grid gap-1 mb-1"
                style={{
                  gridTemplateColumns: `80px repeat(${labels.length}, minmax(60px, 1fr))`,
                }}
              >
                {/* Row label */}
                <div
                  className="flex items-center justify-end pr-2 text-[10px] text-zinc-400 font-mono truncate"
                  title={labels[rowIdx]}
                >
                  {labels[rowIdx]}
                </div>

                {/* Cells */}
                {row.map((count, colIdx) => {
                  const isDiag = rowIdx === colIdx
                  const pct =
                    rowSums[rowIdx] > 0
                      ? ((count / rowSums[rowIdx]) * 100).toFixed(1)
                      : "0.0"
                  return (
                    <div
                      key={`cell-${rowIdx}-${colIdx}`}
                      className="flex flex-col items-center justify-center rounded-lg py-2.5 px-1 min-h-[52px] transition-colors"
                      style={{
                        backgroundColor: cellColor(count, maxVal, isDiag),
                        border: isDiag
                          ? "1px solid rgba(139, 92, 246, 0.3)"
                          : "1px solid rgba(63, 63, 70, 0.3)",
                      }}
                    >
                      <span
                        className={`text-sm font-bold leading-tight ${
                          isDiag ? "text-violet-200" : "text-zinc-300"
                        }`}
                      >
                        {count}
                      </span>
                      <span className="text-[9px] text-zinc-500 leading-tight mt-0.5">
                        {pct}%
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-zinc-600 mt-3 text-center">
        Rows = actual class, columns = predicted class. Percentages are of each true class.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ROC Curve Chart (classification only)
// ---------------------------------------------------------------------------

const ROC_COLORS = [
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#f43f5e", // rose-500
  "#6366f1", // indigo-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
]

function ROCCurveChart({ curves }: { curves: RocCurveEntry[] }) {
  // Merge all curves into a single dataset for Recharts.
  // Each data point: { fpr, tpr_Class0, tpr_Class1, ... , diagonal }
  const chartData = useMemo(() => {
    // Build a union of all FPR values across curves + add 0 and 1
    const fprSet = new Set<number>([0, 1])
    for (const curve of curves) {
      for (const f of curve.fpr) fprSet.add(f)
    }
    const fprAll = Array.from(fprSet).sort((a, b) => a - b)

    return fprAll.map((fpr) => {
      const point: Record<string, number> = { fpr, diagonal: fpr }
      for (const curve of curves) {
        // Find the closest FPR index in this curve via binary search
        const key = `tpr_${curve.label}`
        let bestIdx = 0
        let bestDist = Infinity
        for (let i = 0; i < curve.fpr.length; i++) {
          const dist = Math.abs(curve.fpr[i] - fpr)
          if (dist < bestDist) {
            bestDist = dist
            bestIdx = i
          }
        }
        // Only include if reasonably close (within 0.02)
        if (bestDist < 0.02) {
          point[key] = curve.tpr[bestIdx]
        }
      }
      return point
    })
  }, [curves])

  const isBinary = curves.length === 1

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            ROC Curve
          </h3>
          {isBinary && (
            <p className="text-xs text-violet-400 mt-1 font-mono">
              AUC = {curves[0].auc.toFixed(4)}
            </p>
          )}
        </div>
        {!isBinary && (
          <div className="flex flex-wrap gap-2">
            {curves.map((c, i) => (
              <span
                key={c.label}
                className="text-[10px] px-1.5 py-0.5 rounded-full border font-mono"
                style={{
                  color: ROC_COLORS[i % ROC_COLORS.length],
                  borderColor: `${ROC_COLORS[i % ROC_COLORS.length]}44`,
                  backgroundColor: `${ROC_COLORS[i % ROC_COLORS.length]}11`,
                }}
              >
                {c.label}: {c.auc.toFixed(3)}
              </span>
            ))}
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="fpr"
            type="number"
            domain={[0, 1]}
            tick={AXIS_TICK_STYLE}
            tickFormatter={(v: number) => v.toFixed(1)}
            label={{
              value: "False Positive Rate (FPR)",
              position: "insideBottom",
              offset: -16,
              fill: "#71717a",
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            domain={[0, 1]}
            tick={AXIS_TICK_STYLE}
            tickFormatter={(v: number) => v.toFixed(1)}
            label={{
              value: "True Positive Rate (TPR)",
              angle: -90,
              position: "insideLeft",
              fill: "#71717a",
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={RECHARTS_TOOLTIP_STYLE}
            itemStyle={{ color: "#e4e4e7" }}
            labelStyle={{ color: "#a1a1aa", marginBottom: 4 }}
            labelFormatter={(v: number) => `FPR: ${v.toFixed(4)}`}
            formatter={(v: number | undefined, name: string) => {
              if (name === "diagonal") return [null, null]
              return [(v ?? 0).toFixed(4), name.replace("tpr_", "TPR ")]
            }}
          />

          {/* Diagonal reference line (random classifier) */}
          <Line
            dataKey="diagonal"
            stroke="#52525b"
            strokeDasharray="6 4"
            strokeWidth={1}
            dot={false}
            name="diagonal"
            legendType="none"
          />

          {/* ROC curves */}
          {curves.map((curve, i) => (
            <Line
              key={curve.label}
              dataKey={`tpr_${curve.label}`}
              stroke={ROC_COLORS[i % ROC_COLORS.length]}
              strokeWidth={2}
              dot={false}
              name={`tpr_${curve.label}`}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <p className="text-xs text-zinc-600 mt-2 text-center">
        Curves above the diagonal indicate better-than-random classification
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Best Model Summary Card
// ---------------------------------------------------------------------------

function BestModelBanner({
  bestModel,
  nTrain,
  nTest,
  featureCount,
  onDownload,
}: {
  bestModel: string
  nTrain: number
  nTest: number
  featureCount: number
  onDownload: () => void
}) {
  return (
    <div className="rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-transparent p-5">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center shrink-0">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400/40" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Best Performing Model</p>
            <p className="text-xl font-bold text-violet-200 mt-0.5 leading-tight">{bestModel}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-4 text-xs text-zinc-400">
            <div className="text-center">
              <p className="text-lg font-bold text-zinc-200 leading-tight">{nTrain.toLocaleString()}</p>
              <p className="text-zinc-500">train rows</p>
            </div>
            <div className="w-px bg-zinc-800" aria-hidden="true" />
            <div className="text-center">
              <p className="text-lg font-bold text-zinc-200 leading-tight">{nTest.toLocaleString()}</p>
              <p className="text-zinc-500">test rows</p>
            </div>
            <div className="w-px bg-zinc-800" aria-hidden="true" />
            <div className="text-center">
              <p className="text-lg font-bold text-zinc-200 leading-tight">{featureCount}</p>
              <p className="text-zinc-500">features</p>
            </div>
          </div>

          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors shrink-0"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Download .pkl
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ModelResults() {
  const { modelResult, sessionId } = useStore()
  const [downloadError, setDownloadError] = useState<string | null>(null)

  if (!modelResult) return null

  const { models, best_model, problem_type, model_bytes, n_train, n_test, feature_columns } =
    modelResult

  const bestModelData = models.find((m) => m.model_name === best_model) ?? models[0]

  const handleDownload = () => {
    setDownloadError(null)
    const err = downloadModel(model_bytes, best_model)
    if (err) setDownloadError(err)
  }

  return (
    <div className="space-y-6 mt-8">
      {/* Best model banner */}
      <BestModelBanner
        bestModel={best_model}
        nTrain={n_train}
        nTest={n_test}
        featureCount={feature_columns.length}
        onDownload={handleDownload}
      />

      {downloadError && (
        <div
          role="alert"
          className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3"
        >
          {downloadError}
        </div>
      )}

      <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-zinc-500">
          Only load .pkl files from trusted sources when deploying in other projects.
        </p>
      </div>

      {/* Metrics table */}
      <MetricsTable
        models={models}
        problemType={problem_type}
        bestModel={best_model}
      />

      {/* Charts side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ImportanceChart model={bestModelData} />
        <PredictionsChart model={bestModelData} />
      </div>

      {/* Classification-only: Confusion Matrix + ROC Curve */}
      {problem_type === "classification" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {bestModelData.confusion_matrix &&
            bestModelData.class_labels &&
            bestModelData.confusion_matrix.length > 0 && (
              <ConfusionMatrixChart
                matrix={bestModelData.confusion_matrix}
                labels={bestModelData.class_labels}
              />
            )}
          {bestModelData.roc_curve_data &&
            bestModelData.roc_curve_data.length > 0 ? (
              <ROCCurveChart curves={bestModelData.roc_curve_data} />
            ) : (
              problem_type === "classification" &&
              bestModelData.confusion_matrix &&
              !bestModelData.roc_curve_data && (
                <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 flex items-center justify-center">
                  <p className="text-sm text-zinc-500">
                    ROC curve not available -- the best model does not support probability estimates.
                  </p>
                </div>
              )
            )}
        </div>
      )}

      {/* SHAP Feature Importance */}
      {sessionId && <SHAPImportanceChart sessionId={sessionId} />}
    </div>
  )
}
