"use client"

import { useState, useEffect } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { Loader2, Sparkles } from "lucide-react"
import { getSHAP } from "@/lib/api"
import { useStore } from "@/store/useStore"
import type { SHAPFeature } from "@/lib/types"

export default function ShapPlot() {
  const { sessionId, modelResult } = useStore()
  const [data, setData] = useState<SHAPFeature[] | null>(null)
  const [method, setMethod] = useState<string>("shap")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId || !modelResult) return
    setLoading(true)
    setError(null)
    getSHAP({ session_id: sessionId, max_samples: 100 })
      .then((res) => {
        setData(res.mean_abs_shap.slice(0, 15))
        setMethod(res.method ?? "shap")
      })
      .catch((e) => setError(e instanceof Error ? e.message : "SHAP computation failed"))
      .finally(() => setLoading(false))
  }, [sessionId, modelResult])

  if (!sessionId || !modelResult) return null

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-violet-400" />
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
          {method === "shap" ? "SHAP Feature Importance" :
           method === "model_importance" ? "Feature Importance" :
           method === "coefficients" ? "Coefficient Magnitudes" :
           "Feature Importance"}
        </h3>
        <span className="text-xs text-zinc-600">
          {method === "shap" ? "(mean |SHAP|)" :
           method === "model_importance" ? "(model built-in)" :
           method === "coefficients" ? "(|coef|)" : ""}
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Computing SHAP values…</span>
        </div>
      )}

      {error && (
        <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2">
          {error}
        </p>
      )}

      {data && data.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={data.length * 32 + 20}>
            <BarChart
              data={[...data].reverse()}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            >
              <XAxis
                type="number"
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickFormatter={(v: number) => v.toFixed(3)}
              />
              <YAxis
                type="category"
                dataKey="feature"
                tick={{ fill: "#a1a1aa", fontSize: 11, fontFamily: "monospace" }}
                width={130}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                itemStyle={{ color: "#ffffff" }}
                formatter={(v: number | undefined) => [(v ?? 0).toFixed(6), "Mean |SHAP|"]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {[...data].reverse().map((_, i) => (
                  <Cell
                    key={i}
                    fill={i === data.length - 1 ? "#8b5cf6" : i >= data.length - 3 ? "#6d28d9" : "#4c1d95"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-zinc-600 mt-2 text-center">
            Higher = feature has larger impact on model output
            {method !== "shap" && (
              <span className="ml-1 text-amber-600/70">(install <code>shap</code> for true SHAP values)</span>
            )}
          </p>
        </>
      )}
    </div>
  )
}
