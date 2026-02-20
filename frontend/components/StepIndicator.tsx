"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import type { AppStep } from "@/lib/types"

const ALL_STEPS: { key: AppStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "preview", label: "Preview" },
  { key: "target", label: "Target" },
  { key: "features", label: "Features" },
  { key: "charts", label: "Charts" },
  { key: "model", label: "Model" },
  { key: "predict", label: "Predict" },
  { key: "evaluation", label: "Evaluation" },
]

const ALL_ORDER: AppStep[] = [
  "upload", "preview", "target", "features", "charts", "model", "predict", "evaluation",
]

export default function StepIndicator() {
  const { currentStep, setStep, sessionId } = useStore()

  // Once a dataset is uploaded, hide the Upload step from the indicator
  const STEPS = sessionId ? ALL_STEPS.filter((s) => s.key !== "upload") : ALL_STEPS
  const ORDER = sessionId ? ALL_ORDER.filter((s) => s !== "upload") : ALL_ORDER

  const currentIndex = ORDER.indexOf(currentStep)

  return (
    <nav aria-label="Progress steps" className="flex items-center gap-0.5 overflow-x-auto max-w-[520px] scrollbar-none">
      {STEPS.map(({ key, label }, i) => {
        const done = i < currentIndex
        const active = i === currentIndex
        const reachable = i <= currentIndex && sessionId !== null

        return (
          <div key={key} className="flex items-center shrink-0">
            <button
              onClick={() => reachable && setStep(key)}
              disabled={!reachable}
              aria-current={active ? "step" : undefined}
              aria-label={`${label} — ${done ? "completed" : active ? "current" : "upcoming"}`}
              title={
                !reachable && !done
                  ? `Complete previous steps to unlock ${label}`
                  : undefined
              }
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors",
                active && "bg-violet-600 text-white",
                done && "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer",
                !done && !active && "text-zinc-600 cursor-not-allowed opacity-50"
              )}
            >
              {done ? (
                <Check className="w-3 h-3 shrink-0" aria-hidden="true" />
              ) : (
                <span
                  aria-hidden="true"
                  className={cn(
                    "w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] font-bold shrink-0",
                    active ? "border-white/80" : "border-zinc-600"
                  )}
                >
                  {i + 1}
                </span>
              )}
              <span className="hidden md:inline">{label}</span>
            </button>

            {i < STEPS.length - 1 && (
              <div
                aria-hidden="true"
                className={cn(
                  "w-5 h-0.5 mx-0.5 shrink-0 rounded-full",
                  i < currentIndex ? "bg-violet-800" : "bg-zinc-800"
                )}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}
