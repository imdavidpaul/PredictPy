"use client"

import { useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Loader2, BarChart2 } from "lucide-react"
import { getPDP } from "@/lib/api"
import { useStore } from "@/store/useStore"
import type { PDPResponse } from "@/lib/types"

const TOOLTIP_STYLE = {
  background: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: 8,
  fontSize: 12,
}

export default function PartialDependence() {
  const { sessionId, selectedFeatureColumns, modelResult } = useStore()
  const [selected, setSelected] = useState<string>("")
  const [data, setData] = useState<PDPResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const features = selectedFeatureColumns.length > 0 ? selectedFeatureColumns : (modelResult?.feature_columns ?? [])

  const handleFetch = async (feature: string) => {
    if (!sessionId || !feature) return
    setSelected(feature)
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await getPDP({ session_id: sessionId, feature_column: feature })
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDP computation failed")
    } finally {
      setLoading(false)
    }
  }

  if (!sessionId || features.length === 0) return null

  const chartData = data
    ? data.values.map((v, i) => ({ value: v, average: data.average[i] }))
    : []

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-5 h-5 text-violet-400" />
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
          Partial Dependence Plot
        </h3>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <label className="text-xs text-zinc-500 uppercase tracking-wide shrink-0">Feature</label>
        <select
          value={selected}
          onChange={(e) => handleFetch(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
        >
          <option value="">Select a feature…</option>
          {features.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-violet-400" />}
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2 mb-4">{error}</p>
      )}

      {chartData.length > 0 && data && (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="value"
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickFormatter={(v: number) => v.toFixed(2)}
                label={{ value: data.feature, position: "insideBottom", offset: -4, fill: "#71717a", fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                label={{ value: "Avg. Prediction", angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={{ color: "#fff" }}
                formatter={(v: number | undefined) => [(v ?? 0).toFixed(4), "Avg. Prediction"]}
                labelFormatter={(v) => `${data.feature}: ${Number(v).toFixed(4)}`}
              />
              <Line
                type="monotone"
                dataKey="average"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-zinc-600 mt-2 text-center">
            Marginal effect of <span className="font-mono text-violet-400">{data.feature}</span> on the prediction
          </p>
        </>
      )}

      {!selected && (
        <p className="text-sm text-zinc-600 text-center py-8">
          Select a feature above to compute its partial dependence
        </p>
      )}
    </div>
  )
}
