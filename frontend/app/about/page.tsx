import Link from "next/link"
import { ArrowLeft, BarChart2, Brain, FileText, Zap } from "lucide-react"
import PredictpyLogo from "@/components/PredictpyLogo"

export const metadata = {
  title: "About — predictpy",
  description: "Learn about predictpy — an intelligent ML feature selection tool built for data scientists.",
}

const features = [
  {
    icon: FileText,
    title: "Upload any dataset",
    description:
      "Drag and drop CSV, XLS, or XLSX files. predictpy parses and profiles every column automatically.",
  },
  {
    icon: Brain,
    title: "Intelligent feature ranking",
    description:
      "A multi-method scoring pipeline combines Pearson, Spearman, Mutual Information, and Random Forest importance to rank every feature.",
  },
  {
    icon: BarChart2,
    title: "Visual insights",
    description:
      "Scatter grids and correlation heatmaps make relationships between features immediately visible.",
  },
  {
    icon: Zap,
    title: "One-click model training",
    description:
      "Train XGBoost, LightGBM, and sklearn models with cross-validation in seconds. Export the best model as a .pkl file.",
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-zinc-950/80 backdrop-blur-sm border-b border-white/[0.04] flex items-center justify-between">
        <Link href="/" className="opacity-80 hover:opacity-100 transition-opacity">
          <PredictpyLogo size="sm" />
        </Link>
        <Link
          href="/signup"
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all"
        >
          Get started
        </Link>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-10"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </Link>

        {/* Hero */}
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          About{" "}
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            predictpy
          </span>
        </h1>
        <p className="text-lg text-white/50 leading-relaxed mb-12">
          predictpy is a free, open-access ML feature selection tool that helps data scientists and
          engineers quickly understand which variables in their dataset actually matter — and why.
        </p>

        {/* Mission */}
        <section className="mb-12 p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
          <h2 className="text-sm font-semibold text-violet-400 uppercase tracking-widest mb-3">
            Our Mission
          </h2>
          <p className="text-white/60 leading-relaxed">
            Feature selection is one of the most tedious steps in any ML workflow. It requires running
            multiple statistical tests, interpreting conflicting signals, and making judgement calls
            about which columns to keep. We built predictpy to automate that process — combining
            several proven methods into a single, weighted score so you can focus on building models,
            not wrangling data.
          </p>
        </section>

        {/* Features */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-6">What predictpy does</h2>
          <div className="grid gap-4">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex gap-4 p-5 rounded-xl bg-zinc-900 border border-zinc-800"
              >
                <div className="shrink-0 w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-400/20 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white/90 mb-1">{title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center p-8 rounded-2xl bg-violet-500/[0.06] border border-violet-400/10">
          <p className="text-white/60 mb-4">Ready to find your best features?</p>
          <Link
            href="/signup"
            className="inline-flex px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all"
          >
            Get started — it&apos;s free
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-6 px-6 text-center text-xs text-white/20">
        © 2025 predictpy ·{" "}
        <Link href="/privacy" className="hover:text-white/40 transition-colors">
          Privacy Policy
        </Link>{" "}
        ·{" "}
        <Link href="/contact" className="hover:text-white/40 transition-colors">
          Contact
        </Link>
      </footer>
    </div>
  )
}