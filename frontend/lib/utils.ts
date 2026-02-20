import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number, decimals = 4): string {
  return n.toFixed(decimals)
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`
}

export function scoreColor(score: number): string {
  if (score >= 0.7) return "text-green-400"
  if (score >= 0.4) return "text-yellow-400"
  return "text-red-400"
}

export function scoreBg(score: number): string {
  if (score >= 0.7) return "bg-green-500"
  if (score >= 0.4) return "bg-yellow-500"
  return "bg-red-500"
}
