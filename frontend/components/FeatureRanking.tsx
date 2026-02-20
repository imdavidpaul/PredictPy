"use client"

import { useState, useRef, useEffect } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Legend,
} from "recharts"
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Download, FileDown, FlaskConical, Loader2, X, RefreshCw, Wand2, AlertTriangle } from "lucide-react"
import { cn, formatNumber, scoreBg } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { engineerFeature, transformFeature, analyzeFeatures, getVIF, runRFECV } from "@/lib/api"
import type { FeatureResult, FeatureTransformType, VIFEntry } from "@/lib/types"

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

function exportCSV(features: FeatureResult[], target: string) {
  const methodKeys = Object.keys(features[0]?.scores ?? {})
  const header = ["rank", "column", "final_score", ...methodKeys, "dtype", "correlation_direction"]
  const rows = features.map((f, i) => [
    i + 1,
    f.column,
    f.final_score,
    ...methodKeys.map((k) => f.scores[k as keyof typeof f.scores] ?? ""),
    f.dtype,
    f.correlation_direction,
  ])
  const csv = [header, ...rows].map((row) => row.join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `feature_rankings_${target}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function exportPDF(ref: React.RefObject<HTMLDivElement | null>, target: string) {
  if (!ref.current) return
  const html2canvas = (await import("html2canvas")).default
  const { jsPDF } = await import("jspdf")
  const canvas = await html2canvas(ref.current, {
    backgroundColor: "#09090b",
    scale: 2,
    useCORS: true,
  })
  const imgData = canvas.toDataURL("image/png")
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [canvas.width / 2, canvas.height / 2],
  })
  pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2)
  pdf.save(`feature_rankings_${target}.pdf`)
}

// Gradient score bar
function ScoreBar({ score }: { score: number }) {
  return (
    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", scoreBg(score))}
        style={{ width: `${score * 100}%` }}
      />
    </div>
  )
}

// Direction icon
function DirectionIcon({ direction }: { direction: string }) {
  if (direction === "positive") return <TrendingUp className="w-4 h-4 text-green-400" />
  if (direction === "negative") return <TrendingDown className="w-4 h-4 text-red-400" />
  return <Minus className="w-4 h-4 text-zinc-500" />
}

// Expandable row with method breakdown
function FeatureRow({
  feature,
  rank,
  onClick,
  isSelected,
}: {
  feature: FeatureResult
  rank: number
  onClick: () => void
  isSelected: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const methodKeys = Object.keys(feature.scores) as (keyof typeof feature.scores)[]

  return (
    <div
      className={cn(
        "rounded-xl border transition-all mb-2",
        isSelected
          ? "border-violet-500 bg-violet-500/5"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
      )}
    >
      {/* Main row */}
      <div
        role="button"
        tabIndex={0}
        className="flex items-center gap-4 px-5 py-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-t-xl"
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onClick()
          }
        }}
      >
        {/* Rank */}
        <span className="text-zinc-600 font-mono text-sm w-6 shrink-0">#{rank}</span>

        {/* Column name */}
        <div className="flex-1 min-w-0">
          <p className="font-mono font-semibold text-zinc-200 truncate">{feature.column}</p>
          <p className="text-xs text-zinc-600 mt-0.5">{feature.dtype}</p>
        </div>

        {/* Score bar */}
        <div className="w-32 hidden sm:block">
          <ScoreBar score={feature.final_score} />
        </div>

        {/* Score value */}
        <span
          className={cn(
            "text-sm font-bold w-14 text-right shrink-0",
            feature.final_score >= 0.7
              ? "text-green-400"
              : feature.final_score >= 0.4
              ? "text-yellow-400"
              : "text-red-400"
          )}
        >
          {(feature.final_score * 100).toFixed(1)}%
        </span>

        {/* Direction */}
        <DirectionIcon direction={feature.correlation_direction} />

        {/* Expand toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} method breakdown for ${feature.column}`}
          className="text-zinc-600 hover:text-zinc-400 ml-2 p-0.5 rounded transition-colors"
        >
          {expanded ? (
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Expanded method breakdown */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-zinc-800 pt-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
            Method Scores (normalized)
          </p>
          <div className="grid grid-cols-2 gap-3">
            {methodKeys.map((method) => {
              const val = feature.scores[method] ?? 0
              return (
                <div key={method} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 w-28 capitalize">
                    {method.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1">
                    <ScoreBar score={val} />
                  </div>
                  <span className="text-xs text-zinc-200 w-10 text-right">
                    {(val * 100).toFixed(0)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feature Engineering Panel (expanded: arithmetic, transforms, polynomial)
// ---------------------------------------------------------------------------

const OPS = [
  { value: "add",      label: "A + B",  symbol: "+" },
  { value: "subtract", label: "A − B",  symbol: "−" },
  { value: "multiply", label: "A × B",  symbol: "×" },
  { value: "divide",   label: "A ÷ B",  symbol: "÷" },
] as const

type EngTab = "arithmetic" | "transforms" | "polynomial"

const SINGLE_TRANSFORMS: {
  value: FeatureTransformType
  label: string
  desc: string
  needsParams?: "binning" | "clip"
}[] = [
  { value: "log1p",           label: "Log (1+x)",       desc: "Log transform for right-skewed data. Requires non-negative values." },
  { value: "sqrt",            label: "Square Root",      desc: "Moderate compression of right-skewed data. Requires non-negative values." },
  { value: "square",          label: "Square (x^2)",      desc: "Amplifies large values, useful for expanding left-skewed data." },
  { value: "reciprocal",      label: "Reciprocal (1/x)", desc: "Inverse transform. Zeros become missing values." },
  { value: "power_transform", label: "Yeo-Johnson",      desc: "Automatic power transform to approximate normality. Handles negatives." },
  { value: "binning",         label: "Quantile Binning", desc: "Discretize into equal-frequency bins.", needsParams: "binning" },
  { value: "clip_outliers",   label: "Clip Outliers",    desc: "Winsorize: clip values outside percentile bounds.", needsParams: "clip" },
]

function FeatureEngineeringPanel({ numericCols }: { numericCols: string[] }) {
  const { sessionId, analysisResult, selectedTarget, selectedProblemType, setAnalysisResult } = useStore()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<EngTab>("arithmetic")

  // Shared state
  const [loading, setLoading] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<string[]>([])

  // Arithmetic tab state
  const [colA, setColA] = useState("")
  const [colB, setColB] = useState("")
  const [op, setOp] = useState<"add" | "subtract" | "multiply" | "divide">("multiply")
  const [arithName, setArithName] = useState("")

  // Transform tab state
  const [txCol, setTxCol] = useState("")
  const [txType, setTxType] = useState<FeatureTransformType>("log1p")
  const [txName, setTxName] = useState("")
  const [nBins, setNBins] = useState(5)
  const [clipLower, setClipLower] = useState(1)
  const [clipUpper, setClipUpper] = useState(99)

  // Polynomial tab state
  const [polyCols, setPolyCols] = useState<string[]>([])

  const handleReanalyze = async () => {
    if (!sessionId || !analysisResult) return
    setReanalyzing(true)
    setError(null)
    try {
      const result = await analyzeFeatures({
        session_id: sessionId,
        target_column: analysisResult.target_column,
        problem_type: selectedProblemType ?? analysisResult.problem_type,
      })
      setAnalysisResult(result)
      setCreated([])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-analysis failed.")
    } finally {
      setReanalyzing(false)
    }
  }

  const handleArithmetic = async () => {
    if (!sessionId || !colA || !colB) return
    setLoading(true)
    setError(null)
    try {
      const res = await engineerFeature({
        session_id: sessionId,
        col_a: colA,
        col_b: colB,
        operation: op,
        new_name: arithName.trim() || undefined,
      })
      setCreated((prev) => [...prev, res.new_column])
      setArithName("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Feature creation failed.")
    } finally {
      setLoading(false)
    }
  }

  const handleTransform = async () => {
    if (!sessionId || !txCol) return
    setLoading(true)
    setError(null)
    try {
      const res = await transformFeature({
        session_id: sessionId,
        transform: txType,
        column: txCol,
        new_name: txName.trim() || undefined,
        ...(txType === "binning" ? { n_bins: nBins } : {}),
        ...(txType === "clip_outliers" ? { clip_lower: clipLower, clip_upper: clipUpper } : {}),
      })
      setCreated((prev) => [...prev, ...res.created_columns])
      setTxName("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transform failed.")
    } finally {
      setLoading(false)
    }
  }

  const handlePolynomial = async () => {
    if (!sessionId || polyCols.length < 2) return
    setLoading(true)
    setError(null)
    try {
      const res = await transformFeature({
        session_id: sessionId,
        transform: "polynomial",
        columns: polyCols,
      })
      setCreated((prev) => [...prev, ...res.created_columns])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Polynomial feature creation failed.")
    } finally {
      setLoading(false)
    }
  }

  const togglePolyCol = (col: string) => {
    setPolyCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    )
  }

  const selectedTxMeta = SINGLE_TRANSFORMS.find((t) => t.value === txType)

  const TABS: { key: EngTab; label: string }[] = [
    { key: "arithmetic", label: "Arithmetic" },
    { key: "transforms", label: "Transforms" },
    { key: "polynomial", label: "Polynomial" },
  ]

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Feature Engineering
          </span>
          {created.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
              {created.length} created
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-zinc-800 pt-4 space-y-4">
          {/* Tab selector */}
          <div className="flex gap-1 p-1 bg-zinc-800/50 rounded-lg">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setError(null) }}
                className={cn(
                  "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
                  tab === t.key
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ---- ARITHMETIC TAB ---- */}
          {tab === "arithmetic" && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">
                Combine two numeric columns with an arithmetic operation.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Column A</label>
                  <select
                    value={colA}
                    onChange={(e) => setColA(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                  >
                    <option value="">Select column...</option>
                    {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Column B</label>
                  <select
                    value={colB}
                    onChange={(e) => setColB(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                  >
                    <option value="">Select column...</option>
                    {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Operation</label>
                  <div className="flex gap-1.5">
                    {OPS.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => setOp(o.value)}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-mono font-bold transition-all border",
                          op === o.value
                            ? "bg-violet-600 border-violet-500 text-white"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                        )}
                        title={o.label}
                      >
                        {o.symbol}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wide mb-1">
                    New column name <span className="normal-case text-zinc-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={arithName}
                    onChange={(e) => setArithName(e.target.value)}
                    placeholder={colA && colB ? `${colA}_${op}_${colB}` : "auto-generated"}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
              <button
                onClick={handleArithmetic}
                disabled={loading || !colA || !colB}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
                Create Feature
              </button>
            </div>
          )}

          {/* ---- TRANSFORMS TAB ---- */}
          {tab === "transforms" && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">
                Apply a mathematical transform to a single numeric column.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Column */}
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Column</label>
                  <select
                    value={txCol}
                    onChange={(e) => setTxCol(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                  >
                    <option value="">Select column...</option>
                    {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Transform type */}
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Transform</label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as FeatureTransformType)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                  >
                    {SINGLE_TRANSFORMS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Binning params */}
                {selectedTxMeta?.needsParams === "binning" && (
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wide mb-1">
                      Number of bins
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={nBins}
                      onChange={(e) => setNBins(Math.max(2, Math.min(20, parseInt(e.target.value) || 5)))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                )}

                {/* Clip params */}
                {selectedTxMeta?.needsParams === "clip" && (
                  <>
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase tracking-wide mb-1">
                        Lower percentile
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={49}
                        value={clipLower}
                        onChange={(e) => setClipLower(Math.max(0, Math.min(49, parseInt(e.target.value) || 1)))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase tracking-wide mb-1">
                        Upper percentile
                      </label>
                      <input
                        type="number"
                        min={51}
                        max={100}
                        value={clipUpper}
                        onChange={(e) => setClipUpper(Math.max(51, Math.min(100, parseInt(e.target.value) || 99)))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </>
                )}

                {/* Custom name */}
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wide mb-1">
                    New column name <span className="normal-case text-zinc-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={txName}
                    onChange={(e) => setTxName(e.target.value)}
                    placeholder="auto-generated"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Description */}
              {selectedTxMeta && (
                <p className="text-xs text-zinc-500 bg-zinc-800/50 rounded-lg px-3 py-2">
                  {selectedTxMeta.desc}
                </p>
              )}

              <button
                onClick={handleTransform}
                disabled={loading || !txCol}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                Apply Transform
              </button>
            </div>
          )}

          {/* ---- POLYNOMIAL TAB ---- */}
          {tab === "polynomial" && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">
                Generate degree-2 polynomial features: squared terms (A^2, B^2) and interaction terms (A*B) for each pair of selected columns.
              </p>
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-wide mb-2">
                  Select 2 or more numeric columns
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {numericCols.map((c) => (
                    <button
                      key={c}
                      onClick={() => togglePolyCol(c)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-mono transition-all border",
                        polyCols.includes(c)
                          ? "bg-violet-600 border-violet-500 text-white"
                          : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {polyCols.length >= 2 && (
                  <p className="text-xs text-zinc-500 mt-2">
                    Will create {polyCols.length} squared + {polyCols.length * (polyCols.length - 1) / 2} cross terms = {polyCols.length + polyCols.length * (polyCols.length - 1) / 2} new features
                  </p>
                )}
              </div>
              <button
                onClick={handlePolynomial}
                disabled={loading || polyCols.length < 2}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
                Generate Polynomial Features
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Re-analyze + created list (shared across tabs) */}
          {created.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-zinc-800">
              <div className="flex flex-wrap gap-2">
                {created.map((col) => (
                  <span key={col} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-mono">
                    {col}
                  </span>
                ))}
              </div>
              <button
                onClick={handleReanalyze}
                disabled={reanalyzing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-600 text-zinc-300 hover:border-zinc-400 text-sm font-medium transition-all disabled:opacity-40"
              >
                {reanalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Re-analyze with new features
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function FeatureRanking() {
  const { analysisResult, setSelectedFeature, setStep, selectedFeature, sessionId } = useStore()
  const exportRef = useRef<HTMLDivElement>(null)
  const [vifData, setVifData] = useState<VIFEntry[] | null>(null)
  const [vifLoading, setVifLoading] = useState(false)
  const [rfecvLoading, setRfecvLoading] = useState(false)
  const [rfecvOptimal, setRfecvOptimal] = useState<string[] | null>(null)
  const [rfecvError, setRfecvError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId || !analysisResult) return
    const numericFeatures = analysisResult.features
      .filter((f) => f.dtype.includes("float") || f.dtype.includes("int"))
      .map((f) => f.column)
    if (numericFeatures.length < 2) return
    setVifLoading(true)
    getVIF({ session_id: sessionId, feature_columns: numericFeatures })
      .then((res) => setVifData(res.vif))
      .catch(() => setVifData(null))
      .finally(() => setVifLoading(false))
  }, [sessionId, analysisResult])

  const handleRFECV = async () => {
    if (!sessionId || !analysisResult) return
    setRfecvLoading(true)
    setRfecvError(null)
    try {
      const res = await runRFECV({
        session_id: sessionId,
        target_column: analysisResult.target_column,
        feature_columns: analysisResult.features.map((f) => f.column),
        problem_type: analysisResult.problem_type,
      })
      setRfecvOptimal(res.optimal_features)
    } catch (e) {
      setRfecvError(e instanceof Error ? e.message : "RFECV failed")
    } finally {
      setRfecvLoading(false)
    }
  }

  if (!analysisResult) return null

  const { features, problem_type, target_column, weights_used, class_balance } = analysisResult
  const numericCols = features.map((f) => f.column)

  const vifMap = new Map<string, number | null>(vifData?.map((v) => [v.feature, v.vif]) ?? [])

  const getVifColor = (vif: number | null) => {
    if (vif === null) return "text-zinc-600"
    if (vif < 5) return "text-green-400"
    if (vif < 10) return "text-amber-400"
    return "text-red-400"
  }

  if (features.length === 0) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-12 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
          <X className="w-5 h-5 text-zinc-500" aria-hidden="true" />
        </div>
        <div>
          <p className="text-zinc-200 font-semibold mb-1">No features could be ranked</p>
          <p className="text-sm text-zinc-500 max-w-sm">
            The selected target column may have too few unique values or too much missing data.
            Go back and choose a different target column.
          </p>
        </div>
        <button
          onClick={() => useStore.getState().setStep("target")}
          className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 text-sm transition-colors"
        >
          Change Target Column
        </button>
      </div>
    )
  }

  // Top 10 for bar chart
  const top10 = features.slice(0, 10)

  // Radar data for top 5 features
  const radarMethods = Object.keys(features[0]?.scores ?? {})
  const top5 = features.slice(0, 5)
  const radarData = radarMethods.map((method) => {
    const entry: Record<string, string | number> = {
      method: method.replace(/_/g, " "),
    }
    top5.forEach((f) => {
      entry[f.column] = (f.scores[method as keyof typeof f.scores] ?? 0) as number
    })
    return entry
  })

  const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"]

  return (
    <div className="space-y-8" ref={exportRef}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-200">Feature Rankings</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Target:{" "}
            <span className="font-mono text-violet-300">{target_column}</span> ·{" "}
            <span
              className={
                problem_type === "classification" ? "text-blue-300" : "text-orange-300"
              }
            >
              {problem_type}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV(features, target_column)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 text-sm transition-all"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={() => exportPDF(exportRef, target_column)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 text-sm transition-all"
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={() => setStep("charts")}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            View Charts
          </button>
        </div>
      </div>

      {/* Class Imbalance Warning */}
      {class_balance?.is_severe && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-300">Severe class imbalance detected</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              Imbalance ratio: <span className="font-mono font-bold">{class_balance.imbalance_ratio?.toFixed(1)}×</span> across{" "}
              {class_balance.n_classes} classes. Consider using class_weight=&apos;balanced&apos;, oversampling, or stratified CV.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(class_balance.counts).map(([cls, cnt]) => (
                <span key={cls} className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-mono border border-amber-500/20">
                  {cls}: {cnt}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bar Chart — Top 10 */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Top 10 Feature Scores
          </h3>
          <span className="text-xs text-zinc-600">Click a bar to select for scatter plot</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={top10.map((f) => ({
              name: f.column.length > 12 ? f.column.slice(0, 12) + "…" : f.column,
              score: parseFloat((f.final_score * 100).toFixed(1)),
              full: f.column,
            }))}
            margin={{ top: 4, right: 8, left: 0, bottom: 60 }}
            onClick={(data: unknown) => {
              const d = data as { activePayload?: { payload: { full: string } }[] }
              if (d?.activePayload?.[0]) {
                setSelectedFeature(d.activePayload[0].payload.full)
              }
            }}
          >
            <XAxis
              dataKey="name"
              tick={{ fill: "#ffffff", fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fill: "#ffffff", fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 100]}
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
              formatter={(v: number | undefined) => [`${v ?? 0}%`, "Score"]}
            />
            <Bar dataKey="score" radius={[4, 4, 0, 0]} cursor="pointer">
              {top10.map((f, i) => (
                <Cell
                  key={f.column}
                  fill={
                    selectedFeature === f.column
                      ? "#a78bfa"
                      : COLORS[i % COLORS.length]
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Radar Chart — Top 5 method comparison */}
      {top5.length >= 3 && (
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4">
            Method Score Comparison — Top 5 Features
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#3f3f46" />
              <PolarAngleAxis
                dataKey="method"
                tick={{ fill: "#ffffff", fontSize: 11 }}
              />
              {top5.map((f, i) => (
                <Radar
                  key={f.column}
                  name={f.column}
                  dataKey={f.column}
                  stroke={COLORS[i]}
                  fill={COLORS[i]}
                  fillOpacity={0.1}
                />
              ))}
              <Legend
                formatter={(v) => (
                  <span className="text-white text-[11px]">{v}</span>
                )}
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
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weights */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
        <h3 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
          Algorithm Weights Used
        </h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(weights_used).map(([method, weight]) => (
            <div
              key={method}
              className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700"
            >
              <p className="text-xs text-zinc-300 capitalize">{method.replace(/_/g, " ")}</p>
              <p className="text-sm font-bold text-white">{(weight * 100).toFixed(0)}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* RFECV Auto-Select */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Auto-Select via RFECV</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Uses recursive feature elimination with cross-validation to find the optimal feature subset.
            </p>
          </div>
          <button
            onClick={handleRFECV}
            disabled={rfecvLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {rfecvLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {rfecvLoading ? "Running RFECV…" : "Run RFECV"}
          </button>
        </div>
        {rfecvError && (
          <p className="text-xs text-red-400 mt-3 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{rfecvError}</p>
        )}
        {rfecvOptimal && (
          <div className="mt-3">
            <p className="text-xs text-zinc-400 mb-2">
              Optimal features ({rfecvOptimal.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {rfecvOptimal.map((col) => (
                <span key={col} className="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-mono">
                  {col}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Feature List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
              All Features
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">Click a row to select that feature for the scatter plot</p>
          </div>
          {vifData && (
            <span className="text-xs text-zinc-500">
              VIF: <span className="text-green-400">&lt;5 ok</span> · <span className="text-amber-400">5–10 warn</span> · <span className="text-red-400">&gt;10 high</span>
            </span>
          )}
        </div>
        {features.map((f, i) => {
          const vif = vifMap.get(f.column)
          return (
            <div key={f.column} className="flex items-center gap-2">
              <div className="flex-1">
                <FeatureRow
                  feature={f}
                  rank={i + 1}
                  isSelected={selectedFeature === f.column}
                  onClick={() => setSelectedFeature(selectedFeature === f.column ? null : f.column)}
                />
              </div>
              {vifData !== null && (
                <div className="w-20 shrink-0 text-right pb-2">
                  {vif !== undefined ? (
                    <span className={`text-xs font-mono ${getVifColor(vif)}`}>
                      {vif !== null ? `VIF ${vif.toFixed(1)}` : "—"}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-700">—</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Feature Engineering */}
      <FeatureEngineeringPanel numericCols={numericCols} />
    </div>
  )
}
