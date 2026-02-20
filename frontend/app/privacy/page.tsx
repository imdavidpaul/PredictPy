import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import PredictpyLogo from "@/components/PredictpyLogo"

export const metadata = {
  title: "Privacy Policy — predictpy",
  description: "How predictpy collects, uses, and protects your data.",
}

const sections = [
  {
    title: "Information We Collect",
    content: [
      "Account information: When you register, we collect your email address and a hashed version of your password. We never store passwords in plain text.",
      "OAuth data: If you sign in with Google or GitHub, we receive your email address and profile name from those providers.",
      "Uploaded datasets: Files you upload are stored temporarily in memory during your session. They are not written to permanent storage and are cleared when the server restarts.",
      "Usage data: We may log basic request metadata (timestamps, endpoints) for debugging and performance monitoring. This data is not sold or shared with third parties.",
    ],
  },
  {
    title: "How We Use Your Data",
    content: [
      "To authenticate your account and maintain secure sessions.",
      "To process your uploaded dataset and return feature analysis results.",
      "To train ML models on your data and return the results to you.",
      "We do not use your data to train our own models, and we do not share your data with third parties.",
    ],
  },
  {
    title: "Data Retention",
    content: [
      "Session data (your uploaded dataset and analysis results) exists only in memory and is deleted when your session ends or the server restarts.",
      "Account data (email, hashed password) is stored in a local SQLite database on our server.",
      "You may request deletion of your account and associated data at any time by contacting us.",
    ],
  },
  {
    title: "Cookies & Local Storage",
    content: [
      "predictpy uses browser localStorage to store your JWT authentication token. This token is used to authenticate API requests.",
      "We do not use third-party tracking cookies or advertising cookies.",
      "NextAuth.js may set session cookies for OAuth login flows. These are cleared when you sign out.",
    ],
  },
  {
    title: "Third-Party Services",
    content: [
      "Google OAuth: If you use Sign in with Google, your authentication is handled by Google's OAuth 2.0 service. Google's privacy policy applies to that interaction.",
      "GitHub OAuth: Similarly, Sign in with GitHub is handled by GitHub's OAuth service and subject to GitHub's privacy policy.",
      "We do not use analytics platforms, advertising networks, or data brokers.",
    ],
  },
  {
    title: "Security",
    content: [
      "All passwords are hashed with bcrypt before storage.",
      "Authentication tokens are signed JWTs with a 7-day expiry.",
      "We recommend using a strong, unique password and enabling two-factor authentication on connected OAuth providers.",
      "While we take reasonable precautions, no internet service is 100% secure. Use predictpy at your own risk for sensitive datasets.",
    ],
  },
  {
    title: "Your Rights",
    content: [
      "You may request access to, correction of, or deletion of your personal data at any time.",
      "You may opt out of account creation entirely by using predictpy as a guest (if available).",
      "To exercise any of these rights, contact us at admin@predictpy.com.",
    ],
  },
  {
    title: "Changes to This Policy",
    content: [
      "We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated effective date.",
      "Continued use of predictpy after changes constitutes acceptance of the revised policy.",
    ],
  },
]

export default function PrivacyPage() {
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

        <h1 className="text-4xl font-bold tracking-tight mb-3">Privacy Policy</h1>
        <p className="text-sm text-white/30 mb-10">Effective date: January 1, 2025</p>

        <p className="text-white/50 leading-relaxed mb-12">
          This Privacy Policy describes how predictpy (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or
          &ldquo;us&rdquo;) collects, uses, and protects information when you use our service. By
          using predictpy, you agree to the practices described here.
        </p>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map(({ title, content }, i) => (
            <section key={title}>
              <h2 className="text-lg font-semibold text-white/90 mb-3">
                <span className="text-violet-400 mr-2">{String(i + 1).padStart(2, "0")}.</span>
                {title}
              </h2>
              <ul className="space-y-2">
                {content.map((item, j) => (
                  <li key={j} className="flex gap-2 text-sm text-white/50 leading-relaxed">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Contact */}
        <div className="mt-12 p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
          <p className="text-sm text-white/50">
            Questions about this policy? Contact us at{" "}
            <a
              href="mailto:admin@predictpy.com"
              className="text-violet-400 hover:text-violet-300 transition-colors"
            >
              admin@predictpy.com
            </a>
          </p>
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
        </Link>
      </footer>
    </div>
  )
}