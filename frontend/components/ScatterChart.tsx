"use client"

import { useEffect, useState } from "react"
import {
  ScatterChart as ReScatter,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  ReferenceLine,
} from "recharts"
import { Loader2 } from "lucide-react"
import { getScatterData } from "@/lib/api"
import { useStore } from "@/store/useStore"
import type { ScatterResponse } from "@/lib/types"

export default function ScatterPlot() {
  const { sessionId, selectedFeature, selectedTarget, analysisResult } = useStore()
  const [data, setData] = useState<ScatterResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const target = selectedTarget ?? analysisResult?.target_column ?? ""

  useEffect(() => {
    if (!sessionId || !selectedFeature || !target) return

    setLoading(true)
    setError(null)

    getScatterData({
      session_id: sessionId,
      feature_column: selectedFeature,
      target_column: target,
    })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId, selectedFeature, target])

  if (!selectedFeature) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-12 text-center">
        <p className="text-zinc-500">
          Select a feature from the ranking list to view its scatter plot
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-12 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
        <span className="text-zinc-400">Loading scatter data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-6 text-center">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  if (!data) return null

  const { regression_line: reg } = data

  // Build regression line points for Recharts
  const regLineData = reg.x.map((x, i) => ({ x, regY: reg.y[i] }))

  // Merge scatter + regression for ComposedChart
  const chartData = data.points.map((p) => ({ x: p.x, y: p.y }))

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-zinc-200">
              <span className="text-violet-300 font-mono">{data.feature}</span>
              <span className="text-zinc-600 mx-2">vs</span>
              <span className="text-orange-300 font-mono">{data.target}</span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">{data.n_points} data points</p>
          </div>
          {/* R² badge */}
          <div className="flex gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-center">
              <p className="text-xs text-zinc-500">R²</p>
              <p className="text-sm font-bold text-violet-300">
                {reg.r_squared.toFixed(4)}
              </p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-center">
              <p className="text-xs text-zinc-500">Slope</p>
              <p className="text-sm font-bold text-zinc-300">
                {reg.slope.toFixed(4)}
              </p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-center">
              <p className="text-xs text-zinc-500">p-value</p>
              <p
                className={`text-sm font-bold ${
                  reg.p_value < 0.05 ? "text-green-400" : "text-yellow-400"
                }`}
              >
                {reg.p_value < 0.0001 ? "<0.0001" : reg.p_value.toFixed(4)}
              </p>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              type="number"
              dataKey="x"
              name={data.feature}
              tick={{ fill: "#ffffff", fontSize: 11 }}
              label={{
                value: data.feature,
                position: "insideBottom",
                offset: -4,
                fill: "#ffffff",
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={data.target}
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
            />
            {/* Scatter points */}
            <Scatter
              data={chartData}
              fill="#8b5cf6"
              opacity={0.6}
              r={3}
            />
            {/* Regression line */}
            <Line
              data={regLineData}
              dataKey="regY"
              dot={false}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="6 3"
              type="linear"
              name="Regression Line"
            />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="mt-3 text-xs text-zinc-600 flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-violet-500 inline-block" />
            Data points
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-6 border-t-2 border-dashed border-yellow-500 inline-block" />
            Regression line
          </span>
          {reg.p_value < 0.05 && (
            <span className="text-green-400">Statistically significant (p &lt; 0.05)</span>
          )}
        </div>
      </div>

      {/* Regression Equation */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 font-mono text-sm text-zinc-300">
        <span className="text-zinc-500">ŷ = </span>
        <span className="text-orange-300">{reg.slope.toFixed(4)}</span>
        <span className="text-zinc-500"> × x + </span>
        <span className="text-violet-300">{reg.intercept.toFixed(4)}</span>
        <span className="text-zinc-600 ml-4 text-xs non-italic">
          R² = {reg.r_squared.toFixed(4)}
        </span>
      </div>
    </div>
  )
}
