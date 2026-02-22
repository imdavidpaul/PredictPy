"use client"

import { useState } from "react"
import { AlertCircle, Loader2, LogIn, UserPlus } from "lucide-react"
import { login, register } from "@/lib/api"
import { useStore } from "@/store/useStore"

type Tab = "login" | "register"

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { token, setAuth } = useStore()

  // If already authenticated, render the app
  if (token) return <>{children}</>

  return <AuthScreen onAuth={setAuth} />
}

function AuthScreen({ onAuth }: { onAuth: (token: string, username: string) => void }) {
  const [tab, setTab] = useState<Tab>("login")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    setError(null)
    try {
      const res = tab === "login"
        ? await login(username.trim(), password)
        : await register(username.trim(), password)
      onAuth(res.access_token, res.username)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center px-4">
      {/* Ambient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.06] via-transparent to-fuchsia-500/[0.06] blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <p className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-300 via-white/90 to-fuchsia-300">
            predictpy
          </p>
          <p className="text-sm text-zinc-500 mt-1">ML feature selection & model training</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-zinc-800">
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null) }}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                  tab === t
                    ? "text-violet-300 border-b-2 border-violet-500 bg-violet-500/5"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 uppercase tracking-wide">Username</label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 uppercase tracking-wide">Password</label>
              <input
                type="password"
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
              {tab === "register" && (
                <p className="text-[11px] text-zinc-600 mt-1">Minimum 6 characters</p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : tab === "login"
                  ? <LogIn className="w-4 h-4" />
                  : <UserPlus className="w-4 h-4" />
              }
              {loading ? "Please wait…" : tab === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          Your data is private and tied to your account.
        </p>
      </div>
    </div>
  )
}
