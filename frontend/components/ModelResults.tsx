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
} from "recharts"
import { useState } from "react"
import { Download, Trophy, Star, AlertTriangle } from "lucide-react"
import { useStore } from "@/store/useStore"
import type { ModelResult } from "@/lib/types"

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

const AXIS_TICK_STYLE = { fill: "#71717a", fontSize: 11 }

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
  const { modelResult } = useStore()
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
    </div>
  )
}
