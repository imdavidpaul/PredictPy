"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { motion } from "framer-motion"
import { getCorrelationMatrix } from "@/lib/api"
import { useStore } from "@/store/useStore"
import type { CorrelationMatrixResponse } from "@/lib/types"

// ---------------------------------------------------------------------------
// Color helpers — brand palette: zinc (0) → violet (+1) → rose (–1)
// ---------------------------------------------------------------------------

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t)
}

function cellBg(val: number): string {
  if (val > 0) {
    // zinc-800 → violet-600
    return `rgb(${lerp(39,124,val)},${lerp(39,58,val)},${lerp(42,237,val)})`
  }
  // zinc-800 → rose-600
  const t = Math.abs(val)
  return `rgb(${lerp(39,225,t)},${lerp(39,29,t)},${lerp(42,72,t)})`
}

function cellText(val: number): string {
  return Math.abs(val) > 0.4 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.4)"
}

// Friendly label + icon for a correlation value
function corrLabel(val: number): { label: string; Icon: typeof TrendingUp } {
  const a = Math.abs(val)
  if (a >= 0.8) return { label: "Very strong",  Icon: val > 0 ? TrendingUp  : TrendingDown }
  if (a >= 0.6) return { label: "Strong",        Icon: val > 0 ? TrendingUp  : TrendingDown }
  if (a >= 0.4) return { label: "Moderate",      Icon: val > 0 ? TrendingUp  : TrendingDown }
  if (a >= 0.2) return { label: "Weak",          Icon: val > 0 ? TrendingUp  : TrendingDown }
  return               { label: "Negligible",    Icon: Minus }
}

// ---------------------------------------------------------------------------
// Gradient legend bar
// ---------------------------------------------------------------------------

function LegendBar() {
  const stops = [
    { val: -1,    label: "-1.0", color: cellBg(-1) },
    { val: -0.5,  label: "-0.5", color: cellBg(-0.5) },
    { val:  0,    label:  "0",   color: cellBg(0) },
    { val:  0.5,  label: "+0.5", color: cellBg(0.5) },
    { val:  1,    label: "+1.0", color: cellBg(1) },
  ]

  const gradient = `linear-gradient(to right, ${
    stops.map((s) => s.color).join(", ")
  })`

  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-3 rounded-full w-64" style={{ background: gradient }} />
      <div className="flex justify-between w-64">
        {stops.map(({ label }) => (
          <span key={label} className="text-[10px] text-zinc-400 font-mono">{label}</span>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-0.5">
        <span className="flex items-center gap-1 text-[11px] text-rose-400">
          <TrendingDown className="w-3 h-3" /> Negative
        </span>
        <span className="flex items-center gap-1 text-[11px] text-zinc-400">
          <Minus className="w-3 h-3" /> None
        </span>
        <span className="flex items-center gap-1 text-[11px] text-violet-400">
          <TrendingUp className="w-3 h-3" /> Positive
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CorrelationHeatmap() {
  const { sessionId, profile } = useStore()
  const [data, setData]       = useState<CorrelationMatrixResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [method, setMethod]   = useState<"pearson" | "spearman" | "kendall">("pearson")
  const [hovered, setHovered] = useState<{ row: string; col: string } | null>(null)

  useEffect(() => {
    if (!sessionId || !profile) return
    setLoading(true)
    setError(null)
    const numericCols = profile.numeric_columns.slice(0, 20)
    getCorrelationMatrix({
      session_id: sessionId,
      columns: numericCols.length > 0 ? numericCols : undefined,
      method,
    })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId, profile, method])

  // Build lookup map once
  const lookup = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    data?.matrix.forEach(({ x, y, value }) => {
      if (!map[y]) map[y] = {}
      map[y][x] = value
    })
    return map
  }, [data])

  // Top correlated pairs (excluding diagonal, deduped)
  const topPairs = useMemo(() => {
    if (!data) return []
    const seen = new Set<string>()
    return data.matrix
      .filter(({ x, y }) => x !== y)
      .map(({ x, y, value }) => {
        const key = [x, y].sort().join("|||")
        return { x, y, value, key }
      })
      .filter(({ key }) => {
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 6)
  }, [data])

  // Adaptive cell size
  const cellSize = useMemo(() => {
    if (!data) return 36
    const n = data.columns.length
    if (n <= 6)  return 52
    if (n <= 10) return 42
    if (n <= 14) return 34
    return 28
  }, [data])

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-14 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
        <span className="text-sm text-zinc-500">Computing correlation matrix…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-6 text-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  if (!data) return null

  const cols = data.columns

  // Hovered cell info
  const hoveredVal = hovered ? (lookup[hovered.row]?.[hovered.col] ?? 0) : null
  const hoveredInfo = hoveredVal !== null ? corrLabel(hoveredVal) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between flex-wrap gap-4">
        <div className="min-h-[44px]">
          {hovered && hoveredVal !== null && hoveredInfo ? (
            <motion.div
              key={`${hovered.row}-${hovered.col}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-0.5"
            >
              <div className="flex items-center gap-2">
                <hoveredInfo.Icon
                  className={`w-4 h-4 ${hoveredVal > 0 ? "text-violet-400" : hoveredVal < 0 ? "text-rose-400" : "text-zinc-500"}`}
                />
                <span
                  className={`text-lg font-bold font-mono ${hoveredVal > 0 ? "text-violet-300" : hoveredVal < 0 ? "text-rose-300" : "text-zinc-400"}`}
                >
                  {hoveredVal > 0 ? "+" : ""}{hoveredVal.toFixed(3)}
                </span>
                <span className="text-xs text-zinc-500 px-2 py-0.5 rounded-full bg-zinc-800">
                  {hoveredInfo.label}
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-mono truncate max-w-xs">
                {hovered.row} × {hovered.col}
              </p>
            </motion.div>
          ) : (
            <div>
              <h3 className="font-semibold text-zinc-200 text-base">Correlation Matrix</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                {cols.length} numeric feature{cols.length !== 1 ? "s" : ""} · hover any cell to inspect
              </p>
            </div>
          )}
        </div>

        {/* Method tabs */}
        <div className="flex gap-1.5 p-1 rounded-xl bg-zinc-800/60 border border-zinc-700/50">
          {(["pearson", "spearman", "kendall"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                method === m
                  ? "bg-violet-600 text-white shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ── Heatmap grid ── */}
      <div className="px-6 pb-4 overflow-x-auto">
        <div className="inline-block">
          {/* Column headers */}
          <div className="flex" style={{ marginLeft: 120 }}>
            {cols.map((col) => (
              <div
                key={col}
                style={{ width: cellSize, height: 90 }}
                className="flex items-end justify-center pb-2"
              >
                <span
                  className={`text-[10px] font-mono whitespace-nowrap transition-colors duration-150 ${
                    hovered?.col === col ? "text-violet-300 font-semibold" : "text-zinc-300"
                  }`}
                  style={{
                    writingMode: "vertical-rl",
                    transform: "rotate(180deg)",
                    maxHeight: 80,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {col}
                </span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {cols.map((row) => (
            <div key={row} className="flex items-center">
              {/* Row label */}
              <div
                style={{ width: 120 }}
                className={`pr-3 text-right text-[10px] font-mono whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-150 ${
                  hovered?.row === row ? "text-violet-300 font-semibold" : "text-zinc-300"
                }`}
              >
                {row}
              </div>

              {/* Cells */}
              {cols.map((col) => {
                const val       = lookup[row]?.[col] ?? 0
                const isSelf    = row === col
                const isHovered = hovered?.row === row && hovered?.col === col
                const dimmed    = hovered !== null && hovered.row !== row && hovered.col !== col

                return (
                  <div
                    key={col}
                    onMouseEnter={() => setHovered({ row, col })}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: cellBg(val),
                      color: cellText(val),
                      fontSize: cellSize > 38 ? 10 : 9,
                      opacity: dimmed ? 0.3 : 1,
                      transform: isHovered ? "scale(1.15)" : "scale(1)",
                      boxShadow: isHovered
                        ? `0 0 0 2px #7c3aed, 0 4px 12px rgba(124,58,237,0.4)`
                        : isSelf
                        ? "inset 0 0 0 1.5px rgba(255,255,255,0.12)"
                        : "none",
                      zIndex: isHovered ? 10 : 1,
                    }}
                    className={`
                      relative flex items-center justify-center font-mono font-semibold
                      cursor-crosshair select-none rounded-[3px]
                      transition-all duration-100 ease-out
                    `}
                  >
                    {/* Show value if ≥ 0.05 (skip tiny noise) */}
                    {Math.abs(val) >= 0.05 && !isSelf
                      ? val.toFixed(2)
                      : isSelf
                      ? <span className="opacity-30">1.0</span>
                      : ""}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom section: legend + top pairs ── */}
      <div className="border-t border-zinc-800 px-6 py-5 flex flex-wrap gap-8 items-start">
        <LegendBar />

        {/* Top correlated pairs */}
        {topPairs.length > 0 && (
          <div className="flex-1 min-w-[200px]">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wide font-semibold mb-3">
              Strongest pairs
            </p>
            <div className="space-y-2">
              {topPairs.map(({ x, y, value }) => {
                const pct = Math.abs(value) * 100
                const isPos = value > 0
                return (
                  <div key={`${x}-${y}`} className="flex items-center gap-2 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-zinc-400 truncate font-mono">
                        <span className="text-zinc-300">{x}</span>
                        <span className="text-zinc-600 mx-1">×</span>
                        <span className="text-zinc-300">{y}</span>
                      </p>
                      <div className="mt-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isPos ? "bg-violet-500" : "bg-rose-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={`text-xs font-mono font-bold shrink-0 w-12 text-right ${
                        isPos ? "text-violet-400" : "text-rose-400"
                      }`}
                    >
                      {isPos ? "+" : ""}{value.toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
