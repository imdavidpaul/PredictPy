# UI/UX Designer Agent Memory — predictpy

## Project Design System (confirmed)
- Primary: `violet-600`, accent gradient `from-violet-400 to-fuchsia-400` ("py" suffix only)
- Backgrounds: `zinc-950` (page) / `zinc-900` (card) / `zinc-800` (inputs, nested cards)
- Border: `zinc-800` (cards), `zinc-700` (inputs)
- CV/metric scores: `text-cyan-400`
- Error: `bg-red-500/10 border-red-500/20 text-red-300` + `role="alert"`
- Success state inline: `text-green-400` + `bg-green-500/10 border-green-500/20`
- Disabled: `disabled:opacity-40 disabled:cursor-not-allowed` (standardized across all components)
- Transitions: `transition-colors` preferred over `transition-all` (use `transition-all` only for scale/transform changes)

## Key Architectural Facts
- Step routing is via Zustand `currentStep`, NOT Next.js router
- `StepIndicator` hides "upload" once `sessionId` is set; uses `overflow-x-auto` + `scrollbar-none` for overflow
- `reset()` clears all Zustand state — a confirmation dialog is shown before reset (added in dashboard/page.tsx)
- `jsPDF` + `html2canvas` must be dynamically imported inside click handlers (done correctly in FeatureRanking.tsx)
- `getAvailableModels()` now exported from `lib/api.ts` — ModelTrainer no longer uses raw `fetch()`
- Zustand store is persisted via `persist` middleware; large fields (model_bytes, predictions, preview rows) stripped

## Confirmed Component Patterns
- Cards: `rounded-xl bg-zinc-900 border border-zinc-800 p-5` (or p-6)
- Section headers: `text-sm font-semibold text-zinc-300 uppercase tracking-wide`
- Sub-labels: `text-[10px] text-zinc-500 uppercase tracking-wide`
- Mono column names: `font-mono text-violet-300`
- Primary CTA: `px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors`
- Full-width primary: `w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors`
- Secondary: `border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500`
- Error messages require `role="alert"` for screen reader accessibility
- Radio-group patterns: `role="radiogroup"` + `role="radio"` + `aria-checked` on toggle buttons

## PredictpyLogo
- Uses `useId()` to generate unique SVG gradient IDs — prevents collision when rendered multiple times on same page
- Upload step renders PredictpyLogo twice (header + hero) — unique IDs required
- Component is NOT a "use client" component — no hooks except `useId` from React

## Known Issues Resolved (2026-02-20 audit)
- `globals.css` body font was `Arial` — fixed to `var(--font-geist-sans)` + added antialiasing
- PredictpyLogo gradient IDs were static — fixed with `useId()`
- ModelTrainer used raw `fetch()` — fixed by adding `getAvailableModels()` to `lib/api.ts`
- `ModelResults.tsx` axis ticks were `#ffffff` — fixed to `#71717a` (zinc-500)
- StepIndicator had no `aria-label`, `aria-current` — added
- Landing footer copyright was "2025" — fixed to "2026"
- Landing feature pills were `text-white/30` (invisible) — improved to `text-white/50`
- Reset button had no confirmation — added inline confirm dialog
- Empty states lacked actionable CTAs — fixed in FeatureRanking and Predict

## Recharts Conventions (confirmed + codified)
- Tooltip: `{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#e4e4e7", fontSize: 12 }` — extract as `RECHARTS_TOOLTIP_STYLE` const
- Axis ticks: `{ fill: "#71717a", fontSize: 11 }` — extract as `AXIS_TICK_STYLE` const
- Bar radius for vertical bars: `[0, 4, 4, 0]`, for horizontal top: `[4, 4, 0, 0]`

## UX Decisions (deliberate)
- Upload step shows logo + description + feature pills below FileUpload
- StepIndicator step labels hidden on mobile (`hidden md:inline`), only numbered circles shown
- What-If predictor auto-runs on debounced input change (300ms) — no submit button
- Batch predictor resets when user clicks "New File"
- FeatureRanking empty state now includes actionable "Change Target Column" button
- BestModelBanner in ModelResults now uses `Star` icon + stat blocks for better visual hierarchy
- Bottom nav now shows "Step X of Y" progress text (hidden on mobile)
