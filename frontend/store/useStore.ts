import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  AnalyzeResponse,
  AppStep,
  DatasetProfile,
  ProblemType,
  TargetSuggestion,
  TrainResponse,
  EvaluationResult,
} from "@/lib/types"

interface AppState {
  // Session
  sessionId: string | null
  filename: string | null

  // Step flow
  currentStep: AppStep

  // Dataset
  profile: DatasetProfile | null
  problemHint: ProblemType | null

  // Target selection
  targetSuggestions: TargetSuggestion[]
  selectedTarget: string | null
  selectedProblemType: ProblemType | null

  // Feature analysis
  analysisResult: AnalyzeResponse | null
  selectedFeature: string | null

  // Model training
  modelResult: TrainResponse | null
  selectedFeatureColumns: string[]
  evaluationResult: EvaluationResult | null

  // Loading / error
  loading: boolean
  error: string | null

  // Actions
  setSession: (sessionId: string, filename: string) => void
  setProfile: (profile: DatasetProfile, hint: ProblemType) => void
  setTargetSuggestions: (suggestions: TargetSuggestion[]) => void
  setSelectedTarget: (column: string, problemType: ProblemType) => void
  setAnalysisResult: (result: AnalyzeResponse) => void
  setSelectedFeature: (column: string | null) => void
  setModelResult: (result: TrainResponse) => void
  setSelectedFeatureColumns: (columns: string[]) => void
  setEvaluationResult: (result: EvaluationResult | null) => void
  setStep: (step: AppStep) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

const initialState = {
  sessionId: null,
  filename: null,
  currentStep: "upload" as AppStep,
  profile: null,
  problemHint: null,
  targetSuggestions: [],
  selectedTarget: null,
  selectedProblemType: null,
  analysisResult: null,
  selectedFeature: null,
  modelResult: null,
  selectedFeatureColumns: [],
  evaluationResult: null,
  loading: false,
  error: null,
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,

      setSession: (sessionId, filename) => set({ sessionId, filename }),
      setProfile: (profile, hint) => set({ profile, problemHint: hint }),
      setTargetSuggestions: (suggestions) => set({ targetSuggestions: suggestions }),
      setSelectedTarget: (column, problemType) =>
        set({ selectedTarget: column, selectedProblemType: problemType }),
      setAnalysisResult: (result) => set({ analysisResult: result }),
      setSelectedFeature: (column) => set({ selectedFeature: column }),
      setModelResult: (result) => set({ modelResult: result }),
      setSelectedFeatureColumns: (columns) => set({ selectedFeatureColumns: columns }),
      setEvaluationResult: (result) => set({ evaluationResult: result }),
      setStep: (step) => set({ currentStep: step }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      reset: () => set(initialState),
    }),
    {
      name: "predictpy-session",
      partialize: (state) => ({
        sessionId: state.sessionId,
        filename: state.filename,
        currentStep: state.currentStep,
        // Strip preview rows — they can be large and aren't needed across reloads
        profile: state.profile
          ? { ...state.profile, preview: [] }
          : null,
        problemHint: state.problemHint,
        targetSuggestions: state.targetSuggestions,
        selectedTarget: state.selectedTarget,
        selectedProblemType: state.selectedProblemType,
        analysisResult: state.analysisResult,
        selectedFeature: state.selectedFeature,
        // Strip model_bytes (base64 pickle) and per-model predictions — both huge
        modelResult: state.modelResult
          ? {
              ...state.modelResult,
              model_bytes: "",
              models: state.modelResult.models.map((m) => ({
                ...m,
                predictions: [],
              })),
            }
          : null,
        selectedFeatureColumns: state.selectedFeatureColumns,
        // Strip prediction arrays from evaluation result
        evaluationResult: state.evaluationResult
          ? { ...state.evaluationResult, predictions: [], residuals: null }
          : null,
      }),
    }
  )
)
