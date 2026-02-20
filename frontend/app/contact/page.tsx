import Link from "next/link"
import { ArrowLeft, Mail, Github, MessageSquare } from "lucide-react"
import PredictpyLogo from "@/components/PredictpyLogo"

export const metadata = {
  title: "Contact — predictpy",
  description: "Get in touch with the predictpy team.",
}

export default function ContactPage() {
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
      <main className="max-w-2xl mx-auto px-6 pt-32 pb-24">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-10"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </Link>

        <h1 className="text-4xl font-bold tracking-tight mb-4">Contact Us</h1>
        <p className="text-lg text-white/50 leading-relaxed mb-12">
          Have a question, found a bug, or want to share feedback? We&apos;d love to hear from you.
        </p>

        {/* Contact cards */}
        <div className="space-y-4">
          {/* Email */}
          <a
            href="mailto:admin@predictpy.com"
            className="group flex items-center gap-5 p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-violet-500/30 hover:bg-zinc-900/80 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-400/20 flex items-center justify-center group-hover:bg-violet-500/20 group-hover:border-violet-400/40 transition-all">
              <Mail className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Email</p>
              <p className="text-white/80 font-medium group-hover:text-white transition-colors">
                admin@predictpy.com
              </p>
              <p className="text-xs text-white/30 mt-0.5">We aim to respond within 48 hours</p>
            </div>
          </a>

          {/* GitHub */}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-5 p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/80 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:bg-white/[0.08] transition-all">
              <Github className="w-5 h-5 text-white/60" />
            </div>
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-1">GitHub</p>
              <p className="text-white/80 font-medium group-hover:text-white transition-colors">
                Open an issue
              </p>
              <p className="text-xs text-white/30 mt-0.5">Bug reports and feature requests</p>
            </div>
          </a>

          {/* General feedback */}
          <div className="flex items-center gap-5 p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
            <div className="w-12 h-12 rounded-xl bg-fuchsia-500/10 border border-fuchsia-400/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-fuchsia-400" />
            </div>
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Feedback</p>
              <p className="text-white/80 font-medium">General questions &amp; suggestions</p>
              <p className="text-xs text-white/30 mt-0.5">
                Email us at{" "}
                <a
                  href="mailto:admin@predictpy.com"
                  className="text-violet-400 hover:text-violet-300 transition-colors"
                >
                  admin@predictpy.com
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Note */}
        <p className="mt-10 text-sm text-white/30 leading-relaxed text-center">
          predictpy is a small project — we appreciate your patience and every piece of feedback helps
          us improve.
        </p>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-6 px-6 text-center text-xs text-white/20">
        © 2025 predictpy ·{" "}
        <Link href="/about" className="hover:text-white/40 transition-colors">
          About
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="hover:text-white/40 transition-colors">
          Privacy Policy
        </Link>
      </footer>
    </div>
  )
}