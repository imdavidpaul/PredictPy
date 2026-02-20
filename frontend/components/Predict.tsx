"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useDropzone } from "react-dropzone"
import {
  AlertTriangle,
  AlertCircle,
  Download,
  Loader2,
  Upload,
  Zap,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { predictSingle, predictBatch } from "@/lib/api"
import { useStore } from "@/store/useStore"
import type { PredictResponse, BatchPredictResponse } from "@/lib/types"

// ---------------------------------------------------------------------------
// What-If Panel
// ---------------------------------------------------------------------------

function WhatIfPanel() {
  const { sessionId, modelResult, selectedProblemType, profile } = useStore()

  const [values, setValues] = useState<Record<string, string>>({})
  const [result, setResult] = useState<PredictResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const featureColumns = modelResult?.feature_columns ?? []
  const numericCols = new Set(profile?.numeric_columns ?? [])

  // Initialise inputs to empty strings
  useEffect(() => {
    const init: Record<string, string> = {}
    featureColumns.forEach((col) => { init[col] = "" })
    setValues(init)
    setResult(null)
    setError(null)
  }, [featureColumns.join(",")])

  const runPredict = useCallback(
    async (currentValues: Record<string, string>) => {
      if (!sessionId) return

      // Skip if all inputs are empty
      const hasAny = featureColumns.some((col) => currentValues[col] !== "")
      if (!hasAny) {
        setResult(null)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const featureValues: Record<string, number | string> = {}
        for (const col of featureColumns) {
          const raw = currentValues[col]
          if (raw === "") continue
          featureValues[col] = numericCols.has(col) ? parseFloat(raw) || 0 : raw
        }
        const res = await predictSingle({ session_id: sessionId, feature_values: featureValues })
        setResult(res)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Prediction failed.")
        setResult(null)
      } finally {
        setLoading(false)
      }
    },
    [sessionId, featureColumns, numericCols]
  )

  const handleChange = (col: string, val: string) => {
    const next = { ...values, [col]: val }
    setValues(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runPredict(next), 300)
  }

  if (!modelResult) {
    return (
      <div className="p-10 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-2">
        <p className="text-zinc-300 font-medium">No model trained yet</p>
        <p className="text-zinc-500 text-sm">Go to the Model step to train a model before using What-If prediction.</p>
      </div>
    )
  }

  const probabilities = result?.probabilities
  const interval = result?.prediction_interval

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-2">
        <Zap className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
          What-If Predictor
        </h2>
        {loading && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin ml-auto" />}
      </div>

      <div className="p-6 space-y-6">
        {/* Feature Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featureColumns.map((col) => {
            const isNumeric = numericCols.has(col)
            const colProfile = profile?.column_profiles.find((p) => p.column === col)
            const placeholder = isNumeric && colProfile?.min !== undefined && colProfile?.max !== undefined
              ? `${colProfile.min} – ${colProfile.max}`
              : isNumeric ? "number" : "text"

            return (
              <div key={col}>
                <label className="block text-xs text-zinc-500 mb-1.5 font-mono truncate" title={col}>
                  {col}
                </label>
                <input
                  type={isNumeric ? "number" : "text"}
                  value={values[col] ?? ""}
                  onChange={(e) => handleChange(col, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 focus:border-violet-500 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors"
                />
              </div>
            )
          })}
        </div>

        {/* Extrapolation / category warnings */}
        {result && result.warnings.length > 0 && (
          <div className="space-y-2">
            {result.warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {w}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            {error}
          </div>
        )}

        {/* Prediction Result */}
        {result && (
          <div className="space-y-4">
            {/* Main prediction */}
            <div className="rounded-xl bg-zinc-800/60 border border-zinc-700 p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">
                    {selectedProblemType === "classification" ? "Predicted Class" : "Predicted Value"}
                  </p>
                  <p className="text-3xl font-bold text-violet-300 font-mono leading-none">
                    {typeof result.prediction === "number"
                      ? result.prediction.toFixed(4)
                      : result.prediction}
                  </p>
                </div>
                {interval && (
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">95% Interval</p>
                    <p className="text-sm font-mono text-zinc-300">
                      [{interval.lower_95.toFixed(4)}, {interval.upper_95.toFixed(4)}]
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Probability bars for classification */}
            {probabilities && (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 uppercase tracking-wide">Class Probabilities</p>
                {Object.entries(probabilities)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cls, prob]) => (
                    <div key={cls}>
                      <div className="flex justify-between text-xs text-zinc-400 mb-1">
                        <span className="font-mono">{cls}</span>
                        <span>{(prob * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-500 transition-all duration-500"
                          style={{ width: `${prob * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Batch Prediction Panel
// ---------------------------------------------------------------------------

function BatchPanel() {
  const { sessionId, modelResult } = useStore()

  const [result, setBatchResult] = useState<BatchPredictResponse | null>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processFile = useCallback(
    async (file: File) => {
      if (!sessionId) return
      setLoading(true)
      setError(null)
      setFilename(file.name)
      try {
        const res = await predictBatch(sessionId, file)
        setBatchResult(res)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Batch prediction failed.")
        setBatchResult(null)
      } finally {
        setLoading(false)
      }
    },
    [sessionId]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted, rejections) => {
      if (accepted.length > 0) {
        processFile(accepted[0])
      } else if (rejections.length > 0) {
        const isTooLarge = rejections[0].errors.some((e: { code: string }) => e.code === "file-too-large")
        setError(isTooLarge ? "File exceeds 50 MB limit." : "Invalid file type.")
      }
    },
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
    multiple: false,
    maxSize: 50 * 1024 * 1024,
    disabled: loading,
  })

  const downloadCsv = () => {
    if (!result) return
    const hasProbabilities = !!result.probabilities
    const probKeys = hasProbabilities ? Object.keys(result.probabilities![0] ?? {}) : []

    const header = ["prediction", ...probKeys.map((k) => `prob_${k}`)].join(",")
    const rows = result.predictions.map((pred, i) => {
      const probCols = hasProbabilities
        ? probKeys.map((k) => result.probabilities![i][k].toFixed(6)).join(",")
        : ""
      return probCols ? `${pred},${probCols}` : `${pred}`
    })

    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `predictions_${filename?.replace(/\.\w+$/, "") ?? "batch"}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!modelResult) {
    return (
      <div className="p-10 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-2">
        <p className="text-zinc-300 font-medium">No model trained yet</p>
        <p className="text-zinc-500 text-sm">Go to the Model step to train a model before using batch prediction.</p>
      </div>
    )
  }

  const PREVIEW_ROWS = 100
  const displayRows = result?.predictions.slice(0, PREVIEW_ROWS) ?? []

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Batch Prediction
          </h2>
        </div>
        {result && (
          <button
            onClick={downloadCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Download CSV
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Drop zone */}
        {!result && (
          <div
            {...getRootProps()}
            className={cn(
              "relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300",
              isDragActive
                ? "border-violet-500 bg-violet-500/10 scale-[1.01]"
                : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60",
              loading && "opacity-50 cursor-not-allowed"
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              {loading ? (
                <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-violet-400" />
                </div>
              )}
              <div>
                <p className="text-base font-semibold text-zinc-200">
                  {loading ? "Running batch prediction..." : "Upload Prediction Dataset"}
                </p>
                <p className="text-sm text-zinc-500 mt-1">
                  CSV / XLS / XLSX without the target column
                </p>
              </div>
              {!loading && (
                <span className="text-xs px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Supports CSV, XLS, XLSX · max 50 MB
                </span>
              )}
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/60 border border-zinc-700">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Rows Predicted</p>
                <p className="text-2xl font-bold text-zinc-100">{result.n_rows.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500 mb-0.5">File</p>
                <p className="text-sm text-zinc-300 font-mono">{filename}</p>
              </div>
              <button
                onClick={() => { setBatchResult(null); setFilename(null); setError(null) }}
                className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs transition-all"
              >
                New File
              </button>
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="space-y-1.5">
                {result.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {w}
                  </div>
                ))}
              </div>
            )}

            {/* Missing features */}
            {result.missing_features.length > 0 && (
              <div className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-400">
                Missing feature columns (filled with defaults):{" "}
                <span className="font-mono text-zinc-300">
                  {result.missing_features.join(", ")}
                </span>
              </div>
            )}

            {/* Predictions table */}
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-800/60 text-zinc-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium w-16">#</th>
                    <th className="text-left px-4 py-3 font-medium">Prediction</th>
                    {result.probabilities && result.probabilities[0] &&
                      Object.keys(result.probabilities[0]).map((cls) => (
                        <th key={cls} className="text-left px-4 py-3 font-medium font-mono">
                          P({cls})
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((pred, i) => (
                    <tr
                      key={i}
                      className="border-t border-zinc-800/60 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-zinc-500">{i + 1}</td>
                      <td className="px-4 py-2.5 font-mono text-violet-300 font-semibold">
                        {typeof pred === "number" ? pred.toFixed(4) : pred}
                      </td>
                      {result.probabilities && result.probabilities[i] &&
                        Object.values(result.probabilities[i]).map((p, j) => (
                          <td key={j} className="px-4 py-2.5 font-mono text-zinc-300">
                            {(p * 100).toFixed(1)}%
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.n_rows > PREVIEW_ROWS && (
                <div className="px-4 py-3 border-t border-zinc-800 text-xs text-zinc-500 text-center">
                  Showing first {PREVIEW_ROWS} of {result.n_rows} rows — download CSV for full results
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Predict Component
// ---------------------------------------------------------------------------

export default function Predict() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <WhatIfPanel />
      <BatchPanel />
    </div>
  )
}
