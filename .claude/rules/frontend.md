---
paths:
  - "frontend/**"
---

# Frontend Rules

## Component Inventory
| File | Purpose |
|---|---|
| `app/page.tsx` | Landing page — directs to /dashboard |
| `app/dashboard/page.tsx` | Main 6-step app shell, step navigation |
| `app/layout.tsx` | Root layout |
| `app/icon.tsx` | Browser tab favicon |
| `components/FileUpload.tsx` | Drag & drop upload |
| `components/DatasetPreview.tsx` | Column profiles with stat chips |
| `components/TargetSelector.tsx` | Target column selection (AI suggest + manual) |
| `components/FeatureRanking.tsx` | Ranked features + feature engineering panel |
| `components/ScatterGrid.tsx` | Grid of scatter plots |
| `components/CorrelationHeatmap.tsx` | Correlation matrix heatmap |
| `components/Histogram.tsx` | Feature distribution histograms |
| `components/StepIndicator.tsx` | Step nav — auto-hides "upload" step once `sessionId` is set |
| `components/ModelTrainer.tsx` | Model training config UI |
| `components/ModelResults.tsx` | Metrics table, feature importance, .pkl download |
| `lib/api.ts` | All API calls via `request<T>()` |
| `lib/types.ts` | All TypeScript interfaces |
| `lib/utils.ts` | `cn()`, `formatNumber()`, color helpers |
| `store/useStore.ts` | Zustand global state |

## State Management (Zustand)
- Single store in `store/useStore.ts` — import via `const { ... } = useStore()`.
- **Step routing** is controlled by `currentStep` in the store.
- `reset()` clears all state including `sessionId` and `modelResult`.

## API Client (`lib/api.ts`)
- All calls go through `request<T>(path, options)` — never call `fetch()` directly.
- `BASE_URL` = `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"`.

## Branding
- **Brand name:** `predictpy` (all lowercase)
- **Primary color:** `violet-600` (#7c3aed)
- **Accent / "py" brand color:** gradient `from-violet-400 to-fuchsia-400`
- **Background:** `zinc-950` (#09090b)
- **Card bg:** `zinc-900`
- **Border:** `zinc-800`

## Step Navigation Rules
- Step keys: `"upload"` | `"preview"` | `"target"` | `"features"` | `"charts"` | `"model"`
- When adding a new step: update `STEP_TITLES` in `dashboard/page.tsx`, `stepOrder`, and `StepIndicator`.

## SSR / Client-Side Import Rules
- `jsPDF` and `html2canvas` **must be dynamically imported inside click handlers**.
- `"use client"` directive required on any component that uses hooks or `window`.

## Design System
- Font: Geist Sans / Geist Mono
- Inputs: `bg-zinc-800 border-zinc-700 focus:border-violet-500`
- Transitions: `transition-all` or `transition-colors`
