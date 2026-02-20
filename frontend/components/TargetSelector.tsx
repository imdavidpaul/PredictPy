"use client"

import { useState } from "react"
import { ChevronDown, Sparkles, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { analyzeFeatures } from "@/lib/api"
import { useStore } from "@/store/useStore"
import type { ProblemType } from "@/lib/types"

export default function TargetSelector() {
  const {
    profile,
    targetSuggestions,
    sessionId,
    selectedTarget,
    selectedProblemType,
    setSelectedTarget,
    setAnalysisResult,
    setStep,
    setLoading,
    setError,
    loading,
  } = useStore()

  const [manualTarget, setManualTarget] = useState("")
  const [manualProblemType, setManualProblemType] = useState<ProblemType>("regression")
  const [useManual, setUseManual] = useState(false)

  if (!profile || !sessionId) return null

  const handleAnalyze = async () => {
    const target = useManual ? manualTarget : selectedTarget
    const problemType = useManual ? manualProblemType : selectedProblemType

    if (!target) {
      useStore.getState().setError("Please select a target column.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await analyzeFeatures({
        session_id: sessionId,
        target_column: target,
        problem_type: problemType ?? null,
      })
      setSelectedTarget(target, result.problem_type)
      setAnalysisResult(result)
      setStep("features")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-zinc-200 mb-1">
          Select Target Variable
        </h2>
        <p className="text-sm text-zinc-500">
          The algorithm will rank all other columns by how strongly they correlate
          with your target.
        </p>
      </div>

      {/* Auto Suggestions */}
      {!useManual && targetSuggestions.length > 0 && (
        <div className="space-y-3" role="radiogroup" aria-label="Suggested target columns">
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" aria-hidden="true" />
            Auto Suggestions
          </p>
          {targetSuggestions.map((s) => (
            <button
              key={s.column}
              onClick={() => setSelectedTarget(s.column, s.problem_type)}
              role="radio"
              aria-checked={selectedTarget === s.column}
              className={cn(
                "w-full text-left rounded-xl border p-4 transition-colors",
                selectedTarget === s.column
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedTarget === s.column && (
                    <CheckCircle2 className="w-5 h-5 text-violet-400 shrink-0" />
                  )}
                  <div>
                    <p className="font-mono font-semibold text-zinc-200">{s.column}</p>
                    <div className="flex gap-2 mt-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          s.problem_type === "classification"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/20"
                            : "bg-orange-500/20 text-orange-300 border border-orange-500/20"
                        }`}
                      >
                        {s.problem_type}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {s.n_unique} unique values · {s.dtype}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-xs text-zinc-500">Confidence</p>
                  <p
                    className={`font-bold ${
                      s.confidence >= 0.7
                        ? "text-green-400"
                        : s.confidence >= 0.4
                        ? "text-yellow-400"
                        : "text-zinc-400"
                    }`}
                  >
                    {(s.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Manual Override Toggle */}
      <button
        onClick={() => setUseManual((v) => !v)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
          useManual
            ? "border-zinc-600 text-zinc-300 bg-zinc-800 hover:bg-zinc-700"
            : "border-violet-500/40 text-violet-400 bg-violet-500/10 hover:bg-violet-500/15"
        )}
      >
        {useManual ? "Use AI suggestions instead" : "Choose column manually"}
      </button>

      {useManual && (
        <div className="space-y-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <div>
            <label className="text-xs text-zinc-400 uppercase tracking-wide mb-2 block">
              Target Column
            </label>
            <div className="relative">
              <select
                value={manualTarget}
                onChange={(e) => setManualTarget(e.target.value)}
                className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-200 text-sm focus:outline-none focus:border-violet-500 pr-10"
              >
                <option value="">Select a column...</option>
                {profile.columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 uppercase tracking-wide mb-2 block">
              Problem Type
            </label>
            <div className="flex gap-3" role="radiogroup" aria-label="Problem type">
              {(["classification", "regression"] as ProblemType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setManualProblemType(t)}
                  role="radio"
                  aria-checked={manualProblemType === t}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-sm font-medium transition-colors capitalize",
                    manualProblemType === t
                      ? t === "classification"
                        ? "border-blue-500 bg-blue-500/10 text-blue-300"
                        : "border-orange-500 bg-orange-500/10 text-orange-300"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Run Analysis Button */}
      <button
        onClick={handleAnalyze}
        disabled={loading || (!useManual && !selectedTarget) || (useManual && !manualTarget)}
        className={cn(
          "w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2",
          "bg-violet-600 hover:bg-violet-500 text-white",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Running Feature Selection...
          </>
        ) : (
          "Run Feature Selection Algorithm"
        )}
      </button>
    </div>
  )
}
