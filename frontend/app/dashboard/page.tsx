"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { RotateCcw, ChevronRight, ChevronLeft, Sparkles, AlertTriangle } from "lucide-react"
import PredictpyLogo from "@/components/PredictpyLogo"
import FileUpload from "@/components/FileUpload"
import StepIndicator from "@/components/StepIndicator"
import { useStore } from "@/store/useStore"

// Lazy-load all heavy components — only bundled when the user reaches that step
const DatasetPreview   = dynamic(() => import("@/components/DatasetPreview"), { ssr: false })
const TargetSelector   = dynamic(() => import("@/components/TargetSelector"), { ssr: false })
const FeatureRanking   = dynamic(() => import("@/components/FeatureRanking"), { ssr: false })
const ScatterGrid      = dynamic(() => import("@/components/ScatterGrid"), { ssr: false })
const CorrelationHeatmap = dynamic(() => import("@/components/CorrelationHeatmap"), { ssr: false })
const Histogram        = dynamic(() => import("@/components/Histogram"), { ssr: false })
const ModelTrainer     = dynamic(() => import("@/components/ModelTrainer"), { ssr: false })
const ModelResults     = dynamic(() => import("@/components/ModelResults"), { ssr: false })
const ModelEvaluation  = dynamic(() => import("@/components/ModelEvaluation"), { ssr: false })
const Predict          = dynamic(() => import("@/components/Predict"), { ssr: false })
const LearningCurve    = dynamic(() => import("@/components/LearningCurve"), { ssr: false })
const PartialDependence = dynamic(() => import("@/components/PartialDependence"), { ssr: false })
const DimensionReduction = dynamic(() => import("@/components/DimensionReduction"), { ssr: false })

const STEP_TITLES: Record<string, { title: string; subtitle: string }> = {
  upload: {
    title: "Upload Your Dataset",
    subtitle: "Supports CSV, XLS, and XLSX files up to 50 MB",
  },
  preview: {
    title: "Dataset Overview",
    subtitle: "Review column types, missing values, and statistical profiles",
  },
  target: {
    title: "Select Target Variable",
    subtitle: "Choose the outcome variable your ML model will learn to predict",
  },
  features: {
    title: "Feature Ranking",
    subtitle: "Features ranked by correlation strength using multiple statistical methods",
  },
  charts: {
    title: "Visualizations",
    subtitle: "Scatter plots, distribution histograms, and correlation heatmap",
  },
  model: {
    title: "Model Training",
    subtitle: "Train and compare ML models across your selected features",
  },
  predict: {
    title: "Real-Time Prediction",
    subtitle: "Enter feature values or upload a file to get instant predictions",
  },
  evaluation: {
    title: "Model Evaluation",
    subtitle: "Upload a holdout dataset to evaluate the best model's generalization",
  },
}

const UPLOAD_FEATURES = [
  "Auto problem detection",
  "Missing value analysis",
  "Smart target suggestion",
  "Pearson + Spearman",
  "Mutual Information",
  "Random Forest importance",
  "Scatter plots",
  "Correlation heatmap",
  "Model training",
  "CSV + PDF export",
]

function Dashboard() {
  const { currentStep, setStep, reset, filename, sessionId, modelResult } = useStore()
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const info = STEP_TITLES[currentStep]

  const stepOrder = sessionId
    ? ["preview", "target", "features", "charts", "model", "predict", "evaluation"]
    : ["upload", "preview", "target", "features", "charts", "model", "predict", "evaluation"]
  const stepIndex = stepOrder.indexOf(currentStep)

  const canGoBack = stepIndex > 0
  const canGoNext =
    stepIndex < stepOrder.length - 1 &&
    sessionId !== null &&
    currentStep !== "upload"

  const goBack = () => setStep(stepOrder[stepIndex - 1] as typeof currentStep)
  const goNext = () => setStep(stepOrder[stepIndex + 1] as typeof currentStep)

  const handleReset = () => {
    reset()
    setShowResetConfirm(false)
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <PredictpyLogo size="sm" />
            {filename && (
              <span className="text-xs text-zinc-500 font-mono hidden sm:block truncate max-w-[180px]">
                · {filename}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 min-w-0">
            {sessionId && <StepIndicator />}
            {sessionId && (
              <div className="relative shrink-0">
                {showResetConfirm ? (
                  <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-xs text-zinc-300">Reset session?</span>
                    <button
                      onClick={handleReset}
                      className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-zinc-900"
                    aria-label="Reset session and start over"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-10">
        {/* Step heading */}
        {currentStep !== "upload" && (
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">{info.title}</h1>
            <p className="text-zinc-500 mt-1 text-sm leading-relaxed">{info.subtitle}</p>
          </div>
        )}

        {/* Step content */}
        {currentStep === "upload" && (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="text-center mb-10 max-w-xl">
              <div className="flex items-center justify-center mx-auto mb-6">
                <PredictpyLogo size="lg" />
              </div>
              <h1 className="text-3xl font-bold text-zinc-100 mb-3 tracking-tight">
                Intelligent Feature Selection
              </h1>
              <p className="text-zinc-400 leading-relaxed text-sm sm:text-base">
                Upload your dataset and our algorithm will automatically detect the problem type,
                analyze missing values, suggest the target variable, and rank features by
                correlation strength using multiple statistical methods.
              </p>
            </div>

            <FileUpload />

            <div className="flex flex-wrap gap-2 justify-center mt-10 max-w-2xl">
              {UPLOAD_FEATURES.map((f) => (
                <span
                  key={f}
                  className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 select-none"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {currentStep === "preview" && (
          <>
            <DatasetPreview />
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setStep("target")}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors"
              >
                Select Target Variable
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </>
        )}

        {currentStep === "target" && <TargetSelector />}

        {currentStep === "features" && <FeatureRanking />}

        {currentStep === "charts" && (
          <div className="space-y-10">
            <ScatterGrid />
            <Histogram />
            <div>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">
                Correlation Matrix
              </h2>
              <CorrelationHeatmap />
            </div>
            <PartialDependence />
            <DimensionReduction />
            <div className="flex justify-end">
              <button
                onClick={() => setStep("model")}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                Train a Model
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {currentStep === "model" && (
          <div>
            <ModelTrainer />
            {modelResult && <ModelResults />}
            {modelResult && (
              <div className="mt-6 space-y-6">
                <LearningCurve />
              </div>
            )}
            {modelResult && currentStep === "model" && (
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setStep("predict")}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors"
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  Real-Time Prediction
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        )}

        {currentStep === "predict" && <Predict />}

        {currentStep === "evaluation" && <ModelEvaluation />}
      </main>

      {/* Bottom nav */}
      {sessionId && currentStep !== "upload" && (
        <div className="border-t border-zinc-800 bg-zinc-950/90 backdrop-blur-sm sticky bottom-0 z-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <button
              onClick={goBack}
              disabled={!canGoBack}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              Back
            </button>

            {/* Step progress indicator */}
            <span className="text-xs text-zinc-500 hidden sm:block">
              Step {stepIndex + 1} of {stepOrder.length}
            </span>

            <button
              onClick={goNext}
              disabled={!canGoNext}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return <Dashboard />
}
