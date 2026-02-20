"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import {
  Upload,
  FileText,
  AlertCircle,
  Loader2,
  LineChart as LineChartIcon,
  ScatterChart as ScatterChartIcon,
} from "lucide-react"
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts"
import { cn } from "@/lib/utils"
import { evaluateModel } from "@/lib/api"
import { useStore } from "@/store/useStore"
import type { DriftFeature } from "@/lib/types"

// ---------------------------------------------------------------------------
// ROC Curve Chart
// ---------------------------------------------------------------------------

function RocCurveChart({ data, auc }: { data: { fpr: number; tpr: number }[]; auc: number }) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <LineChartIcon className="w-5 h-5 text-violet-400" />
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            ROC AUC Curve
          </h3>
        </div>
        <div className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20">
          <span className="text-xs text-zinc-400 mr-2">AUC Score:</span>
          <span className="text-sm font-bold text-violet-300">{auc.toFixed(4)}</span>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="rocGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis
              type="number"
              dataKey="fpr"
              domain={[0, 1]}
              tick={{ fill: "#ffffff", fontSize: 11 }}
              label={{ value: "False Positive Rate", position: "insideBottom", offset: -5, fill: "#ffffff", fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="tpr"
              domain={[0, 1]}
              tick={{ fill: "#ffffff", fontSize: 11 }}
              label={{ value: "True Positive Rate", angle: -90, position: "insideLeft", fill: "#ffffff", fontSize: 11 }}
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
            <Area
              type="monotone"
              dataKey="tpr"
              stroke="#8b5cf6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#rocGradient)"
              isAnimationActive={true}
            />
            {/* Random guess line */}
            <Line
              data={[
                { fpr: 0, tpr: 0 },
                { fpr: 1, tpr: 1 },
              ]}
              dataKey="tpr"
              stroke="#52525b"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Actual vs Predicted Scatter
// ---------------------------------------------------------------------------

function EvalScatterChart({ data, r2, mae }: { data: { actual: number; predicted: number }[]; r2?: number; mae?: number }) {
  const allVals = data.flatMap((p) => [p.actual, p.predicted])
  const minVal = Math.min(...allVals)
  const maxVal = Math.max(...allVals)

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ScatterChartIcon className="w-5 h-5 text-violet-400" />
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Actual vs Predicted (Testing Set)
          </h3>
        </div>
        <div className="flex gap-3">
          {r2 !== undefined && (
            <div className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              <span className="text-[10px] text-zinc-500 uppercase mr-2">R²:</span>
              <span className="text-sm font-bold text-cyan-300">{r2.toFixed(4)}</span>
            </div>
          )}
          {mae !== undefined && (
            <div className="px-3 py-1 rounded-full bg-zinc-500/10 border border-zinc-500/20">
              <span className="text-[10px] text-zinc-500 uppercase mr-2">MAE:</span>
              <span className="text-sm font-bold text-zinc-300">{mae.toFixed(4)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              type="number"
              dataKey="actual"
              domain={[minVal, maxVal]}
              tick={{ fill: "#ffffff", fontSize: 11 }}
              label={{ value: "Actual Value", position: "insideBottom", offset: -5, fill: "#ffffff", fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="predicted"
              domain={[minVal, maxVal]}
              tick={{ fill: "#ffffff", fontSize: 11 }}
              label={{ value: "Predicted Value", angle: -90, position: "insideLeft", fill: "#ffffff", fontSize: 11 }}
            />
            <ZAxis type="number" range={[40, 40]} />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: 8,
                fontSize: 12,
              }}
              itemStyle={{ color: "#ffffff" }}
              labelStyle={{ color: "#ffffff", marginBottom: 4 }}
              cursor={{ strokeDasharray: '3 3' }}
            />
            <Scatter data={data} fill="#8b5cf6" fillOpacity={0.5} />
            {/* Perfect diagonal */}
            <Line
              data={[
                { actual: minVal, predicted: minVal },
                { actual: maxVal, predicted: maxVal },
              ]}
              dataKey="predicted"
              stroke="#f59e0b"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confusion Matrix
// ---------------------------------------------------------------------------

function ConfusionMatrixChart({
  matrix,
  labels,
}: {
  matrix: number[][]
  labels: string[]
}) {
  const maxVal = Math.max(...matrix.flat())

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4">
        Confusion Matrix
      </h3>
      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Column headers */}
          <div className="flex ml-16 mb-1">
            {labels.map((l) => (
              <div key={l} className="w-14 text-center text-[10px] text-zinc-500 truncate">{l}</div>
            ))}
          </div>
          {matrix.map((row, ri) => (
            <div key={ri} className="flex items-center gap-1 mb-1">
              <div className="w-14 text-right text-[10px] text-zinc-500 pr-2 truncate shrink-0">{labels[ri]}</div>
              {row.map((val, ci) => {
                const intensity = maxVal > 0 ? val / maxVal : 0
                return (
                  <div
                    key={ci}
                    className="w-14 h-10 flex items-center justify-center rounded text-xs font-mono font-bold"
                    style={{
                      background: `rgba(139, 92, 246, ${0.1 + intensity * 0.8})`,
                      color: intensity > 0.5 ? "#fff" : "#a1a1aa",
                    }}
                    title={`Actual: ${labels[ri]}, Predicted: ${labels[ci]}, Count: ${val}`}
                  >
                    {val}
                  </div>
                )
              })}
            </div>
          ))}
          <p className="text-[10px] text-zinc-600 mt-2 ml-16">Predicted →</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Residual Plot
// ---------------------------------------------------------------------------

function ResidualPlot({ data }: { data: { fitted: number; residual: number }[] }) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4">
        Residual Plot
      </h3>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              type="number"
              dataKey="fitted"
              name="Fitted"
              tick={{ fill: "#ffffff", fontSize: 11 }}
              label={{ value: "Fitted Values", position: "insideBottom", offset: -4, fill: "#ffffff", fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="residual"
              name="Residual"
              tick={{ fill: "#ffffff", fontSize: 11 }}
              label={{ value: "Residual", angle: -90, position: "insideLeft", fill: "#ffffff", fontSize: 11 }}
            />
            <ZAxis type="number" range={[30, 30]} />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
              itemStyle={{ color: "#ffffff" }}
              cursor={{ strokeDasharray: "3 3" }}
            />
            <Scatter data={data} fill="#8b5cf6" fillOpacity={0.55} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-zinc-600 mt-2 text-center">
        Random scatter around zero = well-fitted model
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Calibration Curve
// ---------------------------------------------------------------------------

function CalibrationChart({
  fractionOfPositives,
  meanPredicted,
}: {
  fractionOfPositives: number[]
  meanPredicted: number[]
}) {
  const data = meanPredicted.map((mp, i) => ({
    mean_predicted: mp,
    fraction_of_positives: fractionOfPositives[i],
  }))
  const perfect = [{ mean_predicted: 0, fraction_of_positives: 0 }, { mean_predicted: 1, fraction_of_positives: 1 }]

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4">
        Calibration Curve
      </h3>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              type="number"
              dataKey="mean_predicted"
              domain={[0, 1]}
              tick={{ fill: "#ffffff", fontSize: 11 }}
              label={{ value: "Mean Predicted Probability", position: "insideBottom", offset: -4, fill: "#ffffff", fontSize: 11 }}
            />
            <YAxis
              domain={[0, 1]}
              tick={{ fill: "#ffffff", fontSize: 11 }}
              label={{ value: "Fraction of Positives", angle: -90, position: "insideLeft", fill: "#ffffff", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
              itemStyle={{ color: "#ffffff" }}
            />
            <Line data={perfect} dataKey="fraction_of_positives" stroke="#52525b" strokeDasharray="5 5" strokeWidth={1} dot={false} name="Perfect" />
            <Line data={data} dataKey="fraction_of_positives" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6", r: 4 }} name="Model" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-zinc-600 mt-2 text-center">
        Closer to the dashed diagonal = better calibrated
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drift Detection Table
// ---------------------------------------------------------------------------

function DriftTable({ driftData }: { driftData: DriftFeature[] }) {
  const driftedCount = driftData.filter((d) => d.drifted).length

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
          Data Drift Detection
        </h3>
        {driftedCount > 0 ? (
          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs border border-red-500/30">
            {driftedCount} feature{driftedCount !== 1 ? "s" : ""} drifted
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 text-xs border border-green-500/30">
            No drift detected
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
              <th className="text-left px-6 py-3">Feature</th>
              <th className="text-left px-4 py-3">Test</th>
              <th className="text-right px-4 py-3">p-value</th>
              <th className="text-right px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {driftData.map((d, i) => (
              <tr
                key={d.feature}
                className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-950/30"}`}
              >
                <td className="px-6 py-2 font-mono text-violet-300 text-sm">{d.feature}</td>
                <td className="px-4 py-2 text-zinc-500 text-xs uppercase">
                  {d.test === "ks" ? "KS" : "χ²"}
                </td>
                <td className="px-4 py-2 text-right font-mono text-zinc-300 text-xs">
                  {d.p_value.toFixed(4)}
                </td>
                <td className="px-6 py-2 text-right">
                  {d.drifted ? (
                    <span className="text-xs text-red-400 font-medium">Drifted</span>
                  ) : (
                    <span className="text-xs text-green-400 font-medium">Stable</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-6 py-3 text-[10px] text-zinc-600">
        p &lt; 0.05 = statistically significant distribution shift. KS test for numeric; χ² for categorical.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Evaluation Component
// ---------------------------------------------------------------------------

export default function ModelEvaluation() {
  const {
    sessionId,
    selectedTarget,
    selectedProblemType,
    selectedFeatureColumns,
    modelResult,
    evaluationResult,
    setEvaluationResult,
    setLoading,
    setError,
    loading,
    error,
  } = useStore()

  const [filename, setFilename] = useState<string | null>(null)

  const processEvalFile = useCallback(
    async (file: File) => {
      if (!sessionId || !selectedTarget || !selectedProblemType) return

      setLoading(true)
      setError(null)
      setFilename(file.name)

      try {
        const result = await evaluateModel({
          session_id: sessionId,
          target_column: selectedTarget,
          problem_type: selectedProblemType,
          feature_columns: selectedFeatureColumns,
          file,
        })
        setEvaluationResult(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Evaluation failed.")
      } finally {
        setLoading(false)
      }
    },
    [sessionId, selectedTarget, selectedProblemType, selectedFeatureColumns, setLoading, setError, setEvaluationResult]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted, rejections) => {
      if (accepted.length > 0) {
        processEvalFile(accepted[0])
      } else if (rejections.length > 0) {
        const isTooLarge = rejections[0].errors.some((e: any) => e.code === "file-too-large")
        const isTooMany = rejections[0].errors.some((e: any) => e.code === "too-many-files")

        if (isTooLarge) {
          setError("File too large. Maximum size is 50 MB.")
        } else if (isTooMany) {
          setError("Please upload a single file at a time.")
        } else {
          setError("Unsupported file type. Please upload a CSV, XLS, or XLSX file.")
        }
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

  if (!modelResult) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-12 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-zinc-500" aria-hidden="true" />
        </div>
        <div>
          <p className="text-zinc-200 font-semibold mb-1">No model trained yet</p>
          <p className="text-sm text-zinc-500 max-w-sm">
            Train a model in the Model step before evaluating on a holdout dataset.
          </p>
        </div>
        <button
          onClick={() => useStore.getState().setStep("model")}
          className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 text-sm transition-colors"
        >
          Go to Model Training
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Upload Zone */}
      {!evaluationResult && (
        <div
          {...getRootProps()}
          className={cn(
            "relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300",
            isDragActive
              ? "border-violet-500 bg-violet-500/10 scale-[1.01]"
              : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60",
            loading && "opacity-50 cursor-not-allowed"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            {loading ? (
              <Loader2 className="w-12 h-12 text-violet-400 animate-spin" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Upload className="w-8 h-8 text-violet-400" />
              </div>
            )}
            <div className="max-w-xs mx-auto">
              <p className="text-lg font-semibold text-zinc-200">
                {loading ? "Evaluating model..." : "Upload Testing Dataset"}
              </p>
              <p className="text-sm text-zinc-500 mt-1">
                Drag and drop the testing file to verify model performance on unseen data.
              </p>
            </div>
            {!loading && (
              <span className="text-xs px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                Supports CSV, XLS, XLSX
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {evaluationResult && (
        <div className="space-y-6">
          {/* Success Banner */}
          <div className="flex items-center justify-between p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide">Evaluated Dataset</p>
                <p className="text-lg font-bold text-zinc-100">{filename}</p>
              </div>
            </div>
            <button
              onClick={() => setEvaluationResult(null)}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-all"
            >
              Test Another File
            </button>
          </div>

          {/* Results Grid */}
          <div className="space-y-6">
            {evaluationResult.problem_type === "regression" ? (
              <>
                <EvalScatterChart
                  data={evaluationResult.predictions || []}
                  r2={evaluationResult.r2}
                  mae={evaluationResult.mae}
                />
                {evaluationResult.residuals && evaluationResult.residuals.length > 0 && (
                  <ResidualPlot data={evaluationResult.residuals} />
                )}
              </>
            ) : (
              <>
                {evaluationResult.roc_curve && evaluationResult.roc_auc != null && (
                  <RocCurveChart
                    data={evaluationResult.roc_curve}
                    auc={evaluationResult.roc_auc}
                  />
                )}
                {evaluationResult.confusion_matrix && evaluationResult.class_labels && (
                  <ConfusionMatrixChart
                    matrix={evaluationResult.confusion_matrix}
                    labels={evaluationResult.class_labels}
                  />
                )}
                {evaluationResult.calibration && (
                  <CalibrationChart
                    fractionOfPositives={evaluationResult.calibration.fraction_of_positives}
                    meanPredicted={evaluationResult.calibration.mean_predicted}
                  />
                )}
              </>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col justify-center">
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Testing Samples</p>
                <p className="text-3xl font-bold text-zinc-100">{evaluationResult.n_samples}</p>
              </div>

              <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col justify-center">
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
                  {evaluationResult.problem_type === "regression" ? "Mean Absolute Error" : "Overall Accuracy"}
                </p>
                <p className="text-3xl font-bold text-violet-400">
                  {evaluationResult.problem_type === "regression"
                    ? evaluationResult.mae?.toFixed(4)
                    : evaluationResult.accuracy?.toFixed(4)}
                </p>
              </div>
            </div>

            {/* Drift Detection */}
            {evaluationResult.drift && evaluationResult.drift.length > 0 && (
              <DriftTable driftData={evaluationResult.drift} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
