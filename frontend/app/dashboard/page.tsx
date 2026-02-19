"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { RotateCcw, ChevronRight, ChevronLeft, LogOut, Sparkles, Search } from "lucide-react"
import { AnimatePresence } from "framer-motion"
import PredictpyLogo from "@/components/PredictpyLogo"
import { Avatar } from "@/components/Avatar"
import UserSearch from "@/components/UserSearch"
import { deleteSession, getProfile } from "@/lib/api"
import FileUpload from "@/components/FileUpload"
import DatasetPreview from "@/components/DatasetPreview"
import TargetSelector from "@/components/TargetSelector"
import FeatureRanking from "@/components/FeatureRanking"
import ScatterGrid from "@/components/ScatterGrid"
import CorrelationHeatmap from "@/components/CorrelationHeatmap"
import Histogram from "@/components/Histogram"
import StepIndicator from "@/components/StepIndicator"
import ModelTrainer from "@/components/ModelTrainer"
import ModelResults from "@/components/ModelResults"
import { useStore } from "@/store/useStore"
import { clearAuth, getEmail, getToken } from "@/lib/auth"

const STEP_TITLES: Record<string, { title: string; subtitle: string }> = {
  upload: {
    title: "Upload Your Dataset",
    subtitle: "Supports CSV, XLS, and XLSX files",
  },
  preview: {
    title: "Dataset Overview",
    subtitle: "Review your data, column types, and missing values",
  },
  target: {
    title: "Select Target Variable",
    subtitle: "Choose the outcome variable for your ML model",
  },
  features: {
    title: "Feature Ranking",
    subtitle: "Features ranked by correlation strength to your target",
  },
  charts: {
    title: "Visualizations",
    subtitle: "Scatter plots and correlation heatmap",
  },
  model: {
    title: "Model Training",
    subtitle: "Train ML models on your selected features and compare performance",
  },
}

export default function Dashboard() {
  const router = useRouter()
  const { currentStep, setStep, reset, filename, sessionId, modelResult } = useStore()
  const [username, setUsername]     = useState<string | null>(null)
  const [avatarId, setAvatarId]     = useState(1)
  const [searchOpen, setSearchOpen] = useState(false)

  // Auth guard — redirect to /login if no token; also fetch avatar + username
  useEffect(() => {
    if (!getToken()) {
      router.push("/login")
    } else {
      getProfile()
        .then((p) => {
          setAvatarId(p.avatar_id ?? 1)
          setUsername(p.username ?? getEmail())
        })
        .catch(() => {
          setUsername(getEmail())
        })
    }
  }, [router])

  const info = STEP_TITLES[currentStep]

  const stepOrder = sessionId
    ? ["preview", "target", "features", "charts", "model"]
    : ["upload", "preview", "target", "features", "charts", "model"]
  const stepIndex = stepOrder.indexOf(currentStep)

  const canGoBack = stepIndex > 0
  const canGoNext =
    stepIndex < stepOrder.length - 1 &&
    sessionId !== null &&
    currentStep !== "upload"

  const goBack = () => setStep(stepOrder[stepIndex - 1] as typeof currentStep)
  const goNext = () => setStep(stepOrder[stepIndex + 1] as typeof currentStep)

  const handleLogout = async () => {
    if (sessionId) {
      try { await deleteSession(sessionId) } catch { /* best-effort */ }
    }
    clearAuth()
    reset()
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PredictpyLogo size="sm" />
            {filename && (
              <span className="text-xs text-zinc-500 font-mono hidden sm:block">
                · {filename}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {sessionId && <StepIndicator />}
            {sessionId && (
              <button
                onClick={reset}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
            {/* Search users */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Search users"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search</span>
            </button>
            <div className="flex items-center gap-3 border-l border-zinc-800 pl-4">
              {username && (
                <span className="text-xs text-zinc-500 hidden sm:block truncate max-w-[140px]">
                  {username.startsWith("@") ? username : `@${username}`}
                </span>
              )}
              {/* Avatar → profile link */}
              <Link
                href="/profile"
                title="Edit profile"
                className="rounded-xl overflow-hidden opacity-90 hover:opacity-100 hover:ring-2 hover:ring-violet-500 transition-all"
              >
                <Avatar avatarId={avatarId} size={32} />
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        {/* Step heading */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-100">{info.title}</h1>
          <p className="text-zinc-500 mt-1 text-sm">{info.subtitle}</p>
        </div>

        {/* Step content */}
        {currentStep === "upload" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-center mb-12 max-w-xl">
              <div className="flex items-center justify-center mx-auto mb-6">
                <PredictpyLogo size="lg" />
              </div>
              <h2 className="text-3xl font-bold text-zinc-100 mb-3">
                Intelligent Feature Selection
              </h2>
              <p className="text-zinc-400 leading-relaxed">
                Upload your dataset and our algorithm will automatically detect the problem type,
                analyze missing values, suggest the target variable, and rank features by
                correlation strength using multiple statistical methods.
              </p>
            </div>

            <FileUpload />

            <div className="flex flex-wrap gap-3 justify-center mt-10">
              {[
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
              ].map((f) => (
                <span
                  key={f}
                  className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400"
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
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all"
              >
                Select Target Variable
                <ChevronRight className="w-4 h-4" />
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
            <div className="flex justify-end">
              <button
                onClick={() => setStep("model")}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Train a Model
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {currentStep === "model" && (
          <div>
            <ModelTrainer />
            {modelResult && <ModelResults />}
          </div>
        )}
      </main>

      {/* Bottom nav */}
      {sessionId && currentStep !== "upload" && (
        <div className="border-t border-zinc-800 bg-zinc-950">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={goBack}
              disabled={!canGoBack}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={goNext}
              disabled={!canGoNext}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* User search modal */}
      <AnimatePresence>
        {searchOpen && <UserSearch onClose={() => setSearchOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
