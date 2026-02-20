# predictpy UI/UX Designer Memory

## Architecture
- 8-step linear flow: upload → preview → target → features → charts → model → predict → evaluation
- All routing via `currentStep` in Zustand store (NOT Next.js router)
- `reset()` wipes all Zustand state including sessionId
- Store uses `persist` middleware — partializes to localStorage (strips model_bytes, predictions, preview rows)

## Design Tokens (Enforced)
- Background: `zinc-950` | Card: `zinc-900` | Border: `zinc-800`
- Primary CTA: `bg-violet-600 hover:bg-violet-500`
- Input: `bg-zinc-800 border-zinc-700 focus:border-violet-500`
- Error: `bg-red-500/10 border-red-500/20 text-red-300`
- CV score: `text-cyan-400`
- Success: `text-green-400`
- Chart axis ticks: `{ fill: "#71717a", fontSize: 11 }` (zinc-500)
- Recharts tooltip: `{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }`

## Known Issues Identified (Feb 2026 Audit)
- `ModelEvaluation.tsx` line 68: informal error messages ("Oops! Not Today") — not brand-consistent
- `ModelEvaluation.tsx` ROC/scatter charts: axis tick fill is `#ffffff` (too harsh) — should be `#71717a`
- `Histogram.tsx`: axis tick fill is `#ffffff` throughout — should be `#71717a`
- `ModelResults.tsx` `MetricValue`: no color convention for good/bad metric values beyond best-model highlight
- `FeatureRanking.tsx`: "All Features — Click to select for scatter plot" header text explains behavior inline — should be a tooltip or separate callout
- `dashboard/page.tsx` upload step: feature pills (UPLOAD_FEATURES) use `hover:text-zinc-300` but not `cursor-default` — they are not interactive
- `StepIndicator.tsx`: only backward-navigation is allowed — forward jump disabled. This is correct but no affordance explains it to users
- `TargetSelector.tsx`: "Choose manually" / "Use suggestions instead" toggle is `underline` only — could be a better toggle button

## Component Conventions
- Cards always: `rounded-xl bg-zinc-900 border border-zinc-800`
- Section headers always: `text-sm font-semibold text-zinc-300 uppercase tracking-wide`
- Sub-labels always: `text-xs text-zinc-500`
- VIF color: green <5, amber 5-10, red >10
- Score colors: green ≥0.7, yellow ≥0.4, red <0.4 (defined in `scoreBg()` / `scoreColor()` in utils.ts)

## Links to Detailed Plans
- Full launch audit: see conversation history from 2026-02-20
