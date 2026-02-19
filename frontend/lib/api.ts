import type {
  AnalyzeResponse,
  CorrelationMatrixResponse,
  DistributionResponse,
  EngineerFeatureRequest,
  EngineerFeatureResponse,
  ScatterResponse,
  SuggestTargetResponse,
  TrainRequest,
  TrainResponse,
  UploadResponse,
} from "./types"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

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
