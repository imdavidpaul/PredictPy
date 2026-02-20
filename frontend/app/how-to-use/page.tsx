import Link from "next/link"
import { ArrowLeft, Upload, Eye, Target, ListOrdered, BarChart2, Cpu } from "lucide-react"
import PredictpyLogo from "@/components/PredictpyLogo"

export const metadata = {
  title: "How to Use — predictpy",
  description: "A step-by-step guide to using predictpy for ML feature selection.",
}

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload your dataset",
    description:
      "Drag and drop — or click to browse — a CSV, XLS, or XLSX file. predictpy accepts tabular data with any number of columns and rows.",
    tips: [
      "Make sure your file has a header row with column names.",
      "Missing values are handled automatically — no need to clean your data first.",
      "Files are processed in-memory and never saved to disk.",
    ],
  },
  {
    number: "02",
    icon: Eye,
    title: "Preview your dataset",
    description:
      "Review a column-by-column profile of your data. Each column shows its data type, missing value count, and key statistics (min, max, mean, std).",
    tips: [
      "Look out for columns with high missing rates — these may need to be dropped.",
      "Categorical columns are shown with unique value counts.",
    ],
  },
  {
    number: "03",
    icon: Target,
    title: "Select your target column",
    description:
      "Choose the column you want to predict. predictpy will auto-suggest the most likely target based on column names and data characteristics. You can override it manually.",
    tips: [
      "The target is the outcome variable — e.g. 'price', 'churn', 'diagnosis'.",
      "predictpy auto-detects whether this is a regression or classification problem.",
    ],
  },
  {
    number: "04",
    icon: ListOrdered,
    title: "Explore feature rankings",
    description:
      "Every remaining column is scored using a weighted combination of Pearson correlation, Spearman correlation, Mutual Information, and Random Forest importance.",
    tips: [
      "Higher scores mean stronger predictive relationship with your target.",
      "Use the Feature Engineering panel to create new derived columns (A+B, A×B, etc.).",
      "Export the full ranking as a CSV or PDF report.",
    ],
  },
  {
    number: "05",
    icon: BarChart2,
    title: "Visualize relationships",
    description:
      "The Charts step shows a scatter grid (one plot per top feature vs. the target) and a full correlation heatmap across all selected features.",
    tips: [
      "Scatter plots include a regression trend line for quick visual confirmation.",
      "The heatmap helps spot multicollinearity — features that are correlated with each other.",
    ],
  },
  {
    number: "06",
    icon: Cpu,
    title: "Train and export a model",
    description:
      "Select which features to include, choose a model type (XGBoost, LightGBM, Random Forest, etc.) and a cross-validation strategy. Hit Train and compare metrics.",
    tips: [
      "Stratified K-Fold is recommended for imbalanced classification datasets.",
      "Download the best model as a .pkl file for direct use in your Python projects.",
      "Feature importance is shown as a bar chart after training.",
    ],
  },
]

export default function HowToUsePage() {
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

        <h1 className="text-4xl font-bold tracking-tight mb-4">How to Use predictpy</h1>
        <p className="text-lg text-white/50 leading-relaxed mb-4">
          From raw dataset to trained model in six steps. Here&apos;s exactly how it works.
        </p>
        <div className="flex items-center gap-2 mb-12">
          <span className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-400/20 text-xs text-violet-400">
            Upload
          </span>
          <span className="text-white/20 text-xs">→</span>
          <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.07] text-xs text-white/40">
            Preview
          </span>
          <span className="text-white/20 text-xs">→</span>
          <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.07] text-xs text-white/40">
            Target
          </span>
          <span className="text-white/20 text-xs">→</span>
          <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.07] text-xs text-white/40">
            Features
          </span>
          <span className="text-white/20 text-xs">→</span>
          <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.07] text-xs text-white/40">
            Charts
          </span>
          <span className="text-white/20 text-xs">→</span>
          <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.07] text-xs text-white/40">
            Model
          </span>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {steps.map(({ number, icon: Icon, title, description, tips }) => (
            <section
              key={number}
              className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="shrink-0 w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-400/20 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <span className="text-xs text-violet-400/60 font-mono">Step {number}</span>
                  <h2 className="text-lg font-semibold text-white/90 leading-snug">{title}</h2>
                </div>
              </div>
              <p className="text-sm text-white/55 leading-relaxed mb-4">{description}</p>
              <ul className="space-y-1.5">
                {tips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-xs text-white/35 leading-relaxed">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center p-8 rounded-2xl bg-violet-500/[0.06] border border-violet-400/10">
          <p className="text-white/60 mb-4">Ready to try it yourself?</p>
          <Link
            href="/signup"
            className="inline-flex px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all"
          >
            Upload your first dataset
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-6 px-6 text-center text-xs text-white/20">
        © 2025 predictpy ·{" "}
        <Link href="/about" className="hover:text-white/40 transition-colors">
          About
        </Link>{" "}
        ·{" "}
        <Link href="/contact" className="hover:text-white/40 transition-colors">
          Contact
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="hover:text-white/40 transition-colors">
          Privacy Policy
        </Link>
      </footer>
    </div>
  )
}