"use client"

import { ArrowRight, Upload } from "lucide-react"
import { HeroGeometric } from "@/components/ui/shape-landing-hero"
import PredictpyLogo from "@/components/PredictpyLogo"
import Link from "next/link"

export default function LandingPage() {
  return (
    <>
      {/* Top-right nav — minimal */}
      <nav className="fixed top-0 right-0 z-50 p-5 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all"
        >
          Open App
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </nav>

      {/* Hero */}
      <HeroGeometric badge="predictpy" title1="What do you want to" title2="predict?">
        {/* Upload CTA */}
        <div className="flex flex-col items-center gap-5 pt-2">
          <Link
            href="/dashboard"
            className="group relative flex flex-col items-center gap-4 w-72 rounded-2xl border-2 border-dashed border-white/[0.12] hover:border-violet-400/50 bg-white/[0.02] hover:bg-violet-500/[0.06] px-8 py-8 transition-all duration-300 cursor-pointer"
          >
            {/* Icon */}
            <div className="w-14 h-14 rounded-xl bg-violet-500/[0.12] border border-violet-400/20 flex items-center justify-center group-hover:bg-violet-500/[0.22] group-hover:border-violet-400/40 transition-all duration-300">
              <Upload className="w-7 h-7 text-violet-400/60 group-hover:text-violet-400 transition-colors" />
            </div>

            {/* Labels */}
            <div className="text-center">
              <p className="text-sm font-semibold text-white/70 group-hover:text-white/90 transition-colors">
                Upload your dataset
              </p>
              <p className="text-xs text-white/30 mt-1 tracking-wide">
                CSV · XLS · XLSX
              </p>
            </div>

            {/* Arrow hint */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="w-4 h-4 text-violet-400" />
            </div>
          </Link>

          {/* Sub-caption */}
          <p className="text-xs text-white/20 tracking-wide">
            Free to start · No credit card required
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 max-w-md mt-2">
            {[
              "Auto-detect problem type",
              "Feature ranking",
              "ML model training",
              "CSV & PDF export",
            ].map((f) => (
              <span
                key={f}
                className="px-3 py-1 rounded-full border border-white/[0.07] bg-white/[0.03] text-xs text-white/30 tracking-wide"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </HeroGeometric>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 px-6 py-3 bg-zinc-950/80 backdrop-blur-sm border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="opacity-40 hover:opacity-70 transition-opacity">
            <PredictpyLogo size="sm" />
          </div>
          <nav className="flex items-center gap-5">
            {[
              { label: "About", href: "/about" },
              { label: "How to Use", href: "/how-to-use" },
              { label: "Contact", href: "/contact" },
              { label: "Privacy Policy", href: "/privacy" },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-white/20">© 2025 predictpy</p>
        </div>
      </footer>
    </>
  )
}
