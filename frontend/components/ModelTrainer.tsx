"use client"

import { useState, useEffect } from "react"
import { Loader2, CheckSquare, Square, Brain } from "lucide-react"
import { cn } from "@/lib/utils"
import { trainModels } from "@/lib/api"
import { useStore } from "@/store/useStore"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export default function ModelTrainer() {
  const {
    analysisResult,
    sessionId,
    selectedTarget,
    selectedProblemType,
    setModelResult,
    setSelectedFeatureColumns,
    selectedFeatureColumns,
  } = useStore()

  const [testSize, setTestSize] = useState(0.2)
  const [cvStrategy, setCvStrategy] = useState("train_test_split")
  const [cvFolds, setCvFolds] = useState(5)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-check top 10 features by default
  useEffect(() => {
    if (analysisResult && selectedFeatureColumns.length === 0) {
      const top10 = analysisResult.features.slice(0, 10).map((f) => f.column)
      setSelectedFeatureColumns(top10)
    }
  }, [analysisResult, selectedFeatureColumns.length, setSelectedFeatureColumns])

  // Fetch available models from backend (reflects installed packages)
  useEffect(() => {
    if (!analysisResult) return
    const pt = selectedProblemType ?? analysisResult.problem_type
    fetch(`${BASE_URL}/models?problem_type=${pt}`)
      .then((r) => r.json())
      .then((d) => setAvailableModels(d.models ?? []))
      .catch(() => {
        // Fallback list if endpoint fails
        setAvailableModels(
          pt === "regression"
            ? ["Linear Regression", "Ridge Regression", "LASSO", "Random Forest"]
            : ["Logistic Regression", "Random Forest"]
        )
      })
  }, [analysisResult, selectedProblemType])

  if (!analysisResult || !sessionId || !selectedTarget) return null

  const { features, problem_type, target_column } = analysisResult

  const toggleFeature = (col: string) => {
    setSelectedFeatureColumns(
      selectedFeatureColumns.includes(col)
        ? selectedFeatureColumns.filter((c) => c !== col)
        : [...selectedFeatureColumns, col]
    )
  }

  const selectAll = () => setSelectedFeatureColumns(features.map((f) => f.column))
  const deselectAll = () => setSelectedFeatureColumns([])

  const handleTrain = async () => {
    if (selectedFeatureColumns.length === 0) {
      setError("Select at least one feature.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await trainModels({
        session_id: sessionId,
        target_column: selectedTarget,
        problem_type: (selectedProblemType ?? problem_type) as "regression" | "classification",
        feature_columns: selectedFeatureColumns,
        test_size: testSize,
        cv_strategy: cvStrategy,
        cv_folds: cvFolds,
      })
      setModelResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Training failed.")
    } finally {
      setLoading(false)
    }
  }

  const trainPct = Math.round((1 - testSize) * 100)
  const testPct = Math.round(testSize * 100)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-zinc-200 mb-1">Configure Model Training</h2>
        <p className="text-sm text-zinc-500">
          Target: <span className="font-mono text-violet-300">{target_column}</span>
          {" · "}
          <span className={problem_type === "classification" ? "text-blue-300" : "text-orange-300"}>
            {problem_type}
          </span>
        </p>
      </div>

      {/* Feature Selection */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Features ({selectedFeatureColumns.length}/{features.length} selected)
          </p>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-violet-400 hover:text-violet-300 underline underline-offset-2"
            >
              All
            </button>
            <span className="text-zinc-700">·</span>
            <button
              onClick={deselectAll}
              className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
            >
              None
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
          {features.map((f) => {
            const checked = selectedFeatureColumns.includes(f.column)
            return (
              <button
                key={f.column}
                onClick={() => toggleFeature(f.column)}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all",
                  checked
                    ? "border-violet-500/50 bg-violet-500/5"
                    : "border-zinc-800 hover:border-zinc-700"
                )}
              >
                {checked ? (
                  <CheckSquare className="w-4 h-4 text-violet-400 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-zinc-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-mono text-zinc-300 truncate">{f.column}</p>
                  <p className="text-[10px] text-zinc-600">
                    score: {(f.final_score * 100).toFixed(1)}%
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Test Size Slider */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Train / Test Split
          </p>
          <div className="flex gap-3 text-sm">
            <span className="text-green-400 font-semibold">Train {trainPct}%</span>
            <span className="text-zinc-600">/</span>
            <span className="text-orange-400 font-semibold">Test {testPct}%</span>
          </div>
        </div>
        <input
          type="range"
          min={10}
          max={40}
          step={5}
          value={testSize * 100}
          onChange={(e) => setTestSize(parseInt(e.target.value) / 100)}
          className="w-full accent-violet-500"
        />
        <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
          <span>10% test</span>
          <span>40% test</span>
        </div>
      </div>

      {/* Validation Strategy */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
        <p className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
          Validation Strategy
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wide mb-1.5">Method</label>
            <select
              value={cvStrategy}
              onChange={(e) => setCvStrategy(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
            >
              <option value="train_test_split">Train / Test Split</option>
              <option value="k_fold">K-Fold Cross-Validation</option>
              {problem_type === "classification" && (
                <option value="stratified_k_fold">Stratified K-Fold</option>
              )}
              <option value="loo">Leave-One-Out (LOO)</option>
            </select>
          </div>
          {(cvStrategy === "k_fold" || cvStrategy === "stratified_k_fold") && (
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wide mb-1.5">
                Number of Folds
              </label>
              <select
                value={cvFolds}
                onChange={(e) => setCvFolds(Number(e.target.value))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
              >
                {[3, 5, 10].map((k) => (
                  <option key={k} value={k}>{k} folds</option>
                ))}
              </select>
            </div>
          )}
        </div>
        {cvStrategy !== "train_test_split" && (
          <p className="text-[10px] text-zinc-600">
            CV scores (mean ± std) will appear in the results alongside test-set metrics.
            {cvStrategy === "loo" && " LOO is capped at 200 samples for performance."}
          </p>
        )}
      </div>

      {/* Models to be trained */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
        <p className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">
          Models (all will be trained)
        </p>
        <div className="flex flex-wrap gap-2">
          {availableModels.length === 0 ? (
            <span className="text-xs text-zinc-600">Loading…</span>
          ) : availableModels.map((m) => (
            <span
              key={m}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 flex items-center gap-1.5"
            >
              <Brain className="w-3 h-3 text-violet-400" />
              {m}
            </span>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <button
        onClick={handleTrain}
        disabled={loading || selectedFeatureColumns.length === 0}
        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Training models... (this may take a moment)
          </>
        ) : (
          <>
            <Brain className="w-4 h-4" />
            Train Models
          </>
        )}
      </button>
    </div>
  )
}
