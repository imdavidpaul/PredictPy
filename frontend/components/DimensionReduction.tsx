"use client"

import { useState } from "react"
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Loader2, Layers } from "lucide-react"
import { reduceDimensions } from "@/lib/api"
import { useStore } from "@/store/useStore"
import type { ReductionPoint } from "@/lib/types"

function colorForTarget(val: number, min: number, max: number): string {
  const t = max > min ? (val - min) / (max - min) : 0.5
  // Interpolate from cyan (low) to violet (high)
  const r = Math.round(139 * t + 6 * (1 - t))
  const g = Math.round(92 * t + 182 * (1 - t))
  const b = Math.round(246 * t + 212 * (1 - t))
  return `rgb(${r},${g},${b})`
}

export default function DimensionReduction() {
  const { sessionId, selectedTarget, selectedFeatureColumns, modelResult } = useStore()
  const [method, setMethod] = useState<"pca" | "tsne">("pca")
  const [points, setPoints] = useState<ReductionPoint[] | null>(null)
  const [explainedVariance, setExplainedVariance] = useState<number[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const features = selectedFeatureColumns.length > 0 ? selectedFeatureColumns : (modelResult?.feature_columns ?? [])
  const target = selectedTarget

  const handleCompute = async (m: "pca" | "tsne") => {
    if (!sessionId || !target || features.length < 2) return
    setMethod(m)
    setLoading(true)
    setError(null)
    setPoints(null)
    try {
      const res = await reduceDimensions({
        session_id: sessionId,
        feature_columns: features,
        target_column: target,
        method: m,
        n_components: 2,
      })
      setPoints(res.points)
      setExplainedVariance(res.explained_variance)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reduction failed")
    } finally {
      setLoading(false)
    }
  }

  if (!sessionId || !target || features.length < 2) return null

  const targetVals = points?.map((p) => p.target) ?? []
  const minTarget = Math.min(...targetVals)
  const maxTarget = Math.max(...targetVals)

  // Group points by color bucket for recharts (approximate by discrete bins)
  const coloredData = points?.map((p) => ({
    ...p,
    color: colorForTarget(p.target, minTarget, maxTarget),
  })) ?? []

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-violet-400" />
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Dimensionality Reduction
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {(["pca", "tsne"] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleCompute(m)}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border disabled:opacity-40 ${
                method === m && points
                  ? "bg-violet-600 border-violet-500 text-white"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
          {loading && <Loader2 className="w-4 h-4 animate-spin text-violet-400" />}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2 mb-4">{error}</p>
      )}

      {explainedVariance && method === "pca" && (
        <p className="text-xs text-zinc-500 mb-3">
          Explained variance: PC1 <span className="text-violet-300 font-mono">{(explainedVariance[0] * 100).toFixed(1)}%</span>
          {" · "}PC2 <span className="text-violet-300 font-mono">{(explainedVariance[1] * 100).toFixed(1)}%</span>
        </p>
      )}

      {coloredData.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                type="number"
                dataKey="x"
                name={method === "pca" ? "PC1" : "Dim 1"}
                tick={{ fill: "#71717a", fontSize: 11 }}
                label={{ value: method === "pca" ? "PC1" : "Dim 1", position: "insideBottom", offset: -4, fill: "#71717a", fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={method === "pca" ? "PC2" : "Dim 2"}
                tick={{ fill: "#71717a", fontSize: 11 }}
                label={{ value: method === "pca" ? "PC2" : "Dim 2", angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 11 }}
              />
              <ZAxis type="number" range={[25, 25]} />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                itemStyle={{ color: "#fff" }}
                formatter={(v: number | undefined, name: string | undefined) => [(v ?? 0).toFixed(4), name ?? ""]}
              />
              <Scatter
                data={coloredData}
                fill="#8b5cf6"
                fillOpacity={0.7}
                shape={(props: { cx?: number; cy?: number; payload?: { color: string } }) => {
                  const { cx = 0, cy = 0, payload } = props
                  return <circle cx={cx} cy={cy} r={4} fill={payload?.color ?? "#8b5cf6"} fillOpacity={0.7} />
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-xs text-zinc-600 mt-2 text-center">
            Points colored by <span className="font-mono text-violet-400">{target}</span> value
          </p>
        </>
      ) : (
        !loading && (
          <p className="text-sm text-zinc-600 text-center py-12">
            Click PCA or t-SNE to visualize the feature space
          </p>
        )
      )}
    </div>
  )
}
