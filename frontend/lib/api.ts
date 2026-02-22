import type {
  AnalyzeResponse,
  BatchPredictResponse,
  CorrelationMatrixResponse,
  DistributionResponse,
  EngineerFeatureRequest,
  EngineerFeatureResponse,
  HandleMissingResponse,
  LearningCurveResponse,
  OutlierResponse,
  PDPResponse,
  PredictRequest,
  PredictResponse,
  ReduceResponse,
  RFECVResponse,
  ScatterResponse,
  SuggestTargetResponse,
  TransformFeatureRequest,
  TransformFeatureResponse,
  TuneResponse,
  TrainRequest,
  TrainResponse,
  UploadResponse,
  EvaluateRequest,
  EvaluationResult,
  VIFResponse,
} from "./types"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api"

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options)

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      message = body?.detail ?? message
    } catch {
      // ignore parse error
    }
    throw new Error(message)
  }

  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Dataset
// ---------------------------------------------------------------------------

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData()
  form.append("file", file)
  return request<UploadResponse>("/upload", { method: "POST", body: form })
}

export async function handleMissing(params: {
  session_id: string
  strategies: Record<string, string>
}): Promise<HandleMissingResponse> {
  return request<HandleMissingResponse>("/handle-missing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
}

export async function suggestTarget(sessionId: string): Promise<SuggestTargetResponse> {
  return request<SuggestTargetResponse>("/suggest-target", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  })
}

export async function analyzeFeatures(params: {
  session_id: string
  target_column: string
  problem_type?: "regression" | "classification" | null
  top_n?: number | null
}): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
}

export async function getScatterData(params: {
  session_id: string
  feature_column: string
  target_column: string
  max_points?: number
}): Promise<ScatterResponse> {
  return request<ScatterResponse>("/scatter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
}

export async function getCorrelationMatrix(params: {
  session_id: string
  columns?: string[]
  method?: "pearson" | "spearman" | "kendall"
}): Promise<CorrelationMatrixResponse> {
  return request<CorrelationMatrixResponse>("/correlation-matrix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
}

export async function trainModels(params: TrainRequest): Promise<TrainResponse> {
  return request<TrainResponse>("/train", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
}

export async function getAvailableModels(
  problemType: string
): Promise<{ models: string[] }> {
  return request<{ models: string[] }>(`/models?problem_type=${problemType}`, {
    method: "GET",
  })
}

export async function deleteSession(sessionId: string): Promise<void> {
  await request<void>(`/session/${sessionId}`, { method: "DELETE" })
}

export async function engineerFeature(
  params: EngineerFeatureRequest
): Promise<EngineerFeatureResponse> {
  return request<EngineerFeatureResponse>("/engineer-feature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
}

export async function transformFeature(
  params: TransformFeatureRequest
): Promise<TransformFeatureResponse> {
  return request<TransformFeatureResponse>("/transform-feature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
}

export async function dropFeature(
  sessionId: string,
  column: string
): Promise<{ success: boolean; dropped: string; columns: string[] }> {
  return request("/drop-feature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, column }),
  })
}

export async function getDistribution(params: {
  session_id: string
  column: string
  target_column?: string
  n_bins?: number
}): Promise<DistributionResponse> {
  return request<DistributionResponse>("/distribution", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
}

export async function evaluateModel(params: EvaluateRequest): Promise<EvaluationResult> {
  const form = new FormData()
  form.append("session_id", params.session_id)
  form.append("target_column", params.target_column)
  form.append("problem_type", params.problem_type)
  form.append("feature_columns", JSON.stringify(params.feature_columns))
  form.append("file", params.file)

  return request<EvaluationResult>("/evaluate", {
    method: "POST",
    body: form,
  })
}

export async function predictSingle(params: PredictRequest): Promise<PredictResponse> {
  return request<PredictResponse>("/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
}

export async function predictBatch(sessionId: string, file: File): Promise<BatchPredictResponse> {
  const form = new FormData()
  form.append("session_id", sessionId)
  form.append("file", file)
  return request<BatchPredictResponse>("/predict-batch", {
    method: "POST",
    body: form,
  })
}

// ---------------------------------------------------------------------------
// Phase 1: Outlier Detection
// ---------------------------------------------------------------------------

export async function getOutliers(params: {
  session_id: string
  columns?: string[]
}): Promise<OutlierResponse> {
  return request<OutlierResponse>("/outliers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
}

// ---------------------------------------------------------------------------
// Phase 1: VIF
// ---------------------------------------------------------------------------

export async function getVIF(params: {
  session_id: string
  feature_columns: string[]
}): Promise<VIFResponse> {
  return request<VIFResponse>("/vif", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
}

// ---------------------------------------------------------------------------
// Phase 3: Learning Curves
// ---------------------------------------------------------------------------

export async function getLearningCurve(params: {
  session_id: string
  target_column: string
  feature_columns: string[]
  problem_type: string
  model_name?: string
}): Promise<LearningCurveResponse> {
  return request<LearningCurveResponse>("/learning-curve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
}

// ---------------------------------------------------------------------------
// Phase 3: Partial Dependence Plot
// ---------------------------------------------------------------------------

export async function getPDP(params: {
  session_id: string
  feature_column: string
}): Promise<PDPResponse> {
  return request<PDPResponse>("/pdp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
}

// ---------------------------------------------------------------------------
// Phase 4: RFECV
// ---------------------------------------------------------------------------

export async function runRFECV(params: {
  session_id: string
  target_column: string
  feature_columns: string[]
  problem_type: string
}): Promise<RFECVResponse> {
  return request<RFECVResponse>("/rfecv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
}

// ---------------------------------------------------------------------------
// Phase 4: Hyperparameter Tuning
// ---------------------------------------------------------------------------

export async function tuneHyperparams(params: {
  session_id: string
  target_column: string
  feature_columns: string[]
  problem_type: string
  model_name: string
}): Promise<TuneResponse> {
  return request<TuneResponse>("/tune", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
}

// ---------------------------------------------------------------------------
// Phase 4: Dimensionality Reduction
// ---------------------------------------------------------------------------

export async function reduceDimensions(params: {
  session_id: string
  feature_columns: string[]
  target_column: string
  method?: "pca" | "tsne"
  n_components?: number
}): Promise<ReduceResponse> {
  return request<ReduceResponse>("/reduce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
}

// ---------------------------------------------------------------------------
// Export Notebook
// ---------------------------------------------------------------------------

export async function exportNotebook(params: {
  session_id: string
  target_column: string
  feature_columns: string[]
  problem_type: string
  evaluation_result: EvaluationResult
}): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/export-notebook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      message = body?.detail ?? message
    } catch {
      // ignore parse error
    }
    throw new Error(message)
  }

  return res.blob()
}

