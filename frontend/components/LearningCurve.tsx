"use client"

import { useState, useEffect } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Loader2, TrendingUp } from "lucide-react"
import { getLearningCurve } from "@/lib/api"
import { useStore } from "@/store/useStore"
import type { LearningCurvePoint } from "@/lib/types"

const TOOLTIP_STYLE = {
  background: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: 8,
  fontSize: 12,
}

export default function LearningCurve() {
  const { sessionId, selectedTarget, selectedFeatureColumns, selectedProblemType, modelResult } = useStore()
  const [data, setData] = useState<LearningCurvePoint[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bestModel = modelResult?.best_model ?? "Random Forest"

  useEffect(() => {
    if (!sessionId || !selectedTarget || !selectedFeatureColumns.length || !selectedProblemType) return
    setLoading(true)
    setError(null)
    getLearningCurve({
      session_id: sessionId,
      target_column: selectedTarget,
      feature_columns: selectedFeatureColumns,
      problem_type: selectedProblemType,
      model_name: bestModel,
    })
      .then((res) => setData(res.learning_curve))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to compute learning curve"))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, selectedTarget, selectedProblemType])

  if (!sessionId || !selectedTarget) return null

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-violet-400" />
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
          Learning Curve — {bestModel}
        </h3>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Computing learning curve…</span>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>
      )}

      {data && data.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="train_size"
                tick={{ fill: "#71717a", fontSize: 11 }}
                label={{ value: "Training set size", position: "insideBottom", offset: -4, fill: "#71717a", fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                domain={["auto", "auto"]}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#fff" }} />
              <Legend formatter={(v) => <span style={{ color: "#a1a1aa", fontSize: 11 }}>{v}</span>} />
              <Line
                type="monotone"
                dataKey="train_score"
                name="Training Score"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: "#8b5cf6", r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="val_score"
                name="Validation Score"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={{ fill: "#06b6d4", r: 4 }}
                strokeDasharray="5 3"
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-zinc-600 mt-2 text-center">
            Converging gap between train/val = good generalization
          </p>
        </>
      )}
    </div>
  )
}
