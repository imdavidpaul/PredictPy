"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react"
import { useStore } from "@/store/useStore"
import { formatPct } from "@/lib/utils"
import { getOutliers } from "@/lib/api"
import type { OutlierColumn } from "@/lib/types"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

/** Format a number compactly: large numbers use K/M, small use toPrecision */
function fmtNum(n: number): string {
  if (!isFinite(n)) return String(n)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return (n / 1_000_000).toPrecision(4) + "M"
  if (abs >= 1_000) return (n / 1_000).toPrecision(4) + "K"
  if (abs === 0) return "0"
  if (abs < 0.001) return n.toExponential(2)
  return n.toPrecision(4)
}

function SkewBadge({ skew }: { skew: number }) {
  const abs = Math.abs(skew)
  const label = skew >= 0 ? `+${skew.toFixed(2)}` : skew.toFixed(2)
  const color =
    abs > 2 ? "text-red-400 border-red-500/30 bg-red-500/10" :
    abs > 1 ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
    "text-green-400 border-green-500/30 bg-green-500/10"
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] whitespace-nowrap ${color}`}>
      <span className="opacity-60">skew</span>
      <span className="font-mono">{label}</span>
    </span>
  )
}

function TransformPill({ t }: { t: "log" | "sqrt" | "none" }) {
  if (t === "none") return null
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] whitespace-nowrap text-violet-400 border-violet-500/30 bg-violet-500/10">
      suggest: {t}
    </span>
  )
}

export default function DatasetPreview() {
  const { profile, filename, problemHint, sessionId } = useStore()
  const [outlierData, setOutlierData] = useState<OutlierColumn[] | null>(null)
  const [outlierOpen, setOutlierOpen] = useState(false)
  const [outlierLoading, setOutlierLoading] = useState(false)

  useEffect(() => {
    if (!sessionId || !profile) return
    setOutlierLoading(true)
    getOutliers({ session_id: sessionId })
      .then((res) => setOutlierData(res.outliers))
      .catch(() => setOutlierData(null))
      .finally(() => setOutlierLoading(false))
  }, [sessionId, profile])

  if (!profile) return null

  const { shape, column_profiles, missing_values } = profile
  const missingCols = missing_values.columns_data
  const outlierCols = (outlierData ?? []).filter((c) => c.iqr_count > 0 || c.z_score_count > 0)

  return (
    <div className="space-y-6">
      {/* Dataset Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Rows", value: shape.rows.toLocaleString(), sub: "data points", color: "text-violet-300" },
          { label: "Columns", value: String(shape.columns), sub: "features", color: "text-violet-300" },
          {
            label: "Missing Cells",
            value: missing_values.total_missing_cells.toLocaleString(),
            sub: missing_values.total_missing_cells === 0 ? "none" : "cells",
            color: missing_values.total_missing_cells > 0 ? "text-amber-400" : "text-green-400",
          },
          {
            label: "Missing %",
            value: formatPct(missing_values.overall_missing_pct),
            sub: "of all cells",
            color: missing_values.overall_missing_pct > 0 ? "text-amber-400" : "text-green-400",
          },
        ].map(({ label, value, sub, color }) => (
          <div
            key={label}
            className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-center"
          >
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5 uppercase tracking-wide">{label}</p>
            {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Problem Type Badge */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-400">Detected problem type:</span>
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold ${
            problemHint === "classification"
              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
              : "bg-orange-500/20 text-orange-300 border border-orange-500/30"
          }`}
        >
          {problemHint === "classification" ? "Classification" : "Regression"}
        </span>
        <span className="text-xs text-zinc-500">
          (based on last column — you can override this in the Target step)
        </span>
      </div>

      {/* Missing Values Bar Chart */}
      {missingCols.length > 0 ? (
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4 uppercase tracking-wide">
            Missing Values by Column
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={missingCols}
              margin={{ top: 4, right: 16, left: 0, bottom: 60 }}
            >
              <XAxis
                dataKey="column"
                tick={{ fill: "#71717a", fontSize: 11 }}
                angle={-40}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: 8,
                  color: "#e4e4e7",
                  fontSize: 12,
                }}
                formatter={(value: number | undefined) => [`${value ?? 0}%`, "Missing"]}
              />
              <Bar dataKey="missing_pct" radius={[4, 4, 0, 0]}>
                {missingCols.map((entry) => (
                  <Cell
                    key={entry.column}
                    fill={
                      entry.missing_pct >= 50
                        ? "#ef4444"
                        : entry.missing_pct >= 20
                        ? "#f59e0b"
                        : "#8b5cf6"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-green-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-green-400 font-semibold text-sm">No missing values</p>
            <p className="text-xs text-zinc-500 mt-0.5">Your dataset is complete across all columns</p>
          </div>
        </div>
      )}

      {/* Outlier Summary */}
      {!outlierLoading && outlierCols.length > 0 && (
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-zinc-800/40 transition-colors"
            onClick={() => setOutlierOpen((o) => !o)}
          >
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
                Outlier Summary
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs border border-amber-500/30">
                {outlierCols.length} column{outlierCols.length !== 1 ? "s" : ""}
              </span>
            </div>
            {outlierOpen ? (
              <ChevronUp className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            )}
          </button>
          {outlierOpen && (
            <div className="overflow-x-auto border-t border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Column</th>
                    <th className="text-right px-4 py-3">Z-score outliers</th>
                    <th className="text-right px-4 py-3">IQR outliers</th>
                    <th className="text-right px-4 py-3">IQR %</th>
                  </tr>
                </thead>
                <tbody>
                  {outlierCols.map((col, i) => (
                    <tr
                      key={col.column}
                      className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-950/30"}`}
                    >
                      <td className="px-6 py-2 font-mono text-violet-300">{col.column}</td>
                      <td className="px-4 py-2 text-right text-zinc-300">{col.z_score_count}</td>
                      <td className="px-4 py-2 text-right text-zinc-300">{col.iqr_count}</td>
                      <td className="px-4 py-2 text-right">
                        <span
                          className={
                            col.iqr_pct >= 10 ? "text-red-400" :
                            col.iqr_pct >= 5 ? "text-amber-400" :
                            "text-zinc-400"
                          }
                        >
                          {col.iqr_pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Column Summary Table */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Column Profiles
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
                <th className="text-left px-6 py-3">Column</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Unique</th>
                <th className="text-right px-4 py-3">Missing</th>
                <th className="px-6 py-3">Statistics</th>
              </tr>
            </thead>
            <tbody>
              {column_profiles.map((col, i) => (
                <tr
                  key={col.column}
                  className={`border-b border-zinc-800/50 ${
                    i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-950/30"
                  }`}
                >
                  <td className="px-6 py-3 font-mono text-violet-300 font-medium whitespace-nowrap">
                    {col.column}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{col.column_type}</td>
                  <td className="px-4 py-3 text-right text-zinc-300 whitespace-nowrap">{col.n_unique}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span
                      className={
                        col.missing_pct >= 50
                          ? "text-red-400"
                          : col.missing_pct > 0
                          ? "text-yellow-400"
                          : "text-zinc-600"
                      }
                    >
                      {col.missing_count > 0
                        ? `${col.missing_count} (${formatPct(col.missing_pct)})`
                        : "—"}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {col.mean !== undefined && col.mean !== null ? (
                      /* Numeric column: show stat chips + skew/transform */
                      <div className="flex flex-wrap gap-1">
                        {([
                          { label: "count", val: col.count?.toLocaleString() },
                          { label: "sum",   val: col.sum !== undefined ? fmtNum(col.sum) : undefined },
                          { label: "min",   val: col.min !== undefined ? fmtNum(col.min) : undefined },
                          { label: "max",   val: col.max !== undefined ? fmtNum(col.max) : undefined },
                          { label: "mean",  val: col.mean !== undefined ? fmtNum(col.mean) : undefined },
                          { label: "std",   val: col.std  !== undefined ? fmtNum(col.std)  : undefined },
                        ] as { label: string; val: string | undefined }[]).map(
                          ({ label, val }) =>
                            val !== undefined && (
                              <span
                                key={label}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] whitespace-nowrap"
                              >
                                <span className="text-zinc-500">{label}</span>
                                <span className="text-zinc-300 font-mono">{val}</span>
                              </span>
                            )
                        )}
                        {col.skewness != null && (
                          <SkewBadge skew={col.skewness} />
                        )}
                        {col.suggested_transform && col.suggested_transform !== "none" && (
                          <TransformPill t={col.suggested_transform} />
                        )}
                      </div>
                    ) : col.top_value ? (
                      <span className="text-xs text-zinc-500">
                        top:{" "}
                        <span className="text-zinc-400 font-mono">{col.top_value}</span>
                        <span className="text-zinc-600 ml-1">({col.top_value_count}×)</span>
                      </span>
                    ) : (
                      <span className="text-zinc-700">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Preview */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Data Preview (first 10 rows)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 uppercase">
                {profile.columns.map((col) => (
                  <th key={col} className="text-left px-4 py-3 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profile.preview.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-zinc-800/30 ${
                    i % 2 === 0 ? "" : "bg-zinc-950/30"
                  }`}
                >
                  {profile.columns.map((col) => (
                    <td key={col} className="px-4 py-2 text-zinc-300 whitespace-nowrap">
                      {row[col] === null || row[col] === undefined ? (
                        <span className="text-red-500/60 italic">null</span>
                      ) : (
                        String(row[col])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
