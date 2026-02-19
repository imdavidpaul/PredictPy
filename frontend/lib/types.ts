// ---------------------------------------------------------------------------
// User Profile Types
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: number
  email: string
  username: string | null
  display_name: string | null
  avatar_id: number
  bio: string | null
  city: string | null
  country: string | null
  website: string | null
  github_url: string | null
  created_at: string
  followers_count: number
  following_count: number
}

export interface UserSearchResult {
  id: number
  username: string
  display_name: string | null
  avatar_id: number
  followers_count: number
  following_count: number
}

export interface PublicProfile {
  id: number
  username: string
  display_name: string | null
  avatar_id: number
  bio: string | null
  city: string | null
  country: string | null
  website: string | null
  github_url: string | null
  created_at: string
  followers_count: number
  following_count: number
  is_following: boolean
}

export interface ProfileUpdateRequest {
  username?: string
  display_name?: string
  avatar_id?: number
  bio?: string
  city?: string
  country?: string
  website?: string
  github_url?: string
}

// ---------------------------------------------------------------------------
// Dataset Profile Types
// ---------------------------------------------------------------------------

export interface ColumnProfile {
  column: string
  dtype: string
  column_type: string
  n_unique: number
  missing_count: number
  missing_pct: number
  has_missing: boolean
  // Numeric columns
  count?: number
  sum?: number
  min?: number
  max?: number
  mean?: number
  std?: number
  median?: number
  q25?: number
  q75?: number
  // Categorical columns
  top_value?: string
  top_value_count?: number
}

export interface MissingColumnData {
  column: string
  missing_count: number
  missing_pct: number
}

export interface HeatmapCell {
  row: number
  column: string
  missing: number
}

export interface MissingValueSummary {
  total_rows: number
  total_columns: number
  total_missing_cells: number
  total_cells: number
  overall_missing_pct: number
  columns_with_missing: number
  columns_data: MissingColumnData[]
  heatmap_data: HeatmapCell[]
  rows_with_any_missing: number
  complete_rows: number
}

export interface DatasetProfile {
  shape: { rows: number; columns: number }
  numeric_columns: string[]
  categorical_columns: string[]
  column_profiles: ColumnProfile[]
  missing_values: MissingValueSummary
  preview: Record<string, unknown>[]
  columns: string[]
  dtypes: Record<string, string>
}

// ---------------------------------------------------------------------------
// Upload Response
// ---------------------------------------------------------------------------

export interface UploadResponse {
  session_id: string
  filename: string
  profile: DatasetProfile
  problem_hint: "regression" | "classification"
  hint_based_on_column: string
}

// ---------------------------------------------------------------------------
// Target Suggestion
// ---------------------------------------------------------------------------

export interface TargetSuggestion {
  column: string
  confidence: number
  problem_type: "regression" | "classification"
  n_unique: number
  dtype: string
}

export interface SuggestTargetResponse {
  suggestions: TargetSuggestion[]
}

// ---------------------------------------------------------------------------
// Feature Selection
// ---------------------------------------------------------------------------

export interface FeatureScores {
  // Regression methods
  pearson?: number
  spearman?: number
  mutual_info?: number
  rf_importance?: number
  // Classification methods
  anova_f?: number
  chi2?: number
}

export interface FeatureResult {
  column: string
  final_score: number
  scores: FeatureScores
  raw_scores: FeatureScores
  dtype: string
  n_unique: number
  correlation_direction: "positive" | "negative" | "n/a"
}

export interface AnalyzeResponse {
  problem_type: "regression" | "classification"
  target_column: string
  features: FeatureResult[]
  total_features_analyzed: number
  top_n: number
  weights_used: Record<string, number>
}

// ---------------------------------------------------------------------------
// Scatter / Charts
// ---------------------------------------------------------------------------

export interface ScatterPoint {
  x: number
  y: number
}

export interface RegressionLine {
  x: number[]
  y: number[]
  slope: number
  intercept: number
  r_squared: number
  p_value: number
}

export interface ScatterResponse {
  feature: string
  target: string
  points: ScatterPoint[]
  regression_line: RegressionLine
  n_points: number
}

// ---------------------------------------------------------------------------
// Correlation Matrix
// ---------------------------------------------------------------------------

export interface CorrelationCell {
  x: string
  y: string
  value: number
}

export interface CorrelationMatrixResponse {
  columns: string[]
  matrix: CorrelationCell[]
  method: string
}

// ---------------------------------------------------------------------------
// App State
// ---------------------------------------------------------------------------

export type ProblemType = "regression" | "classification"
export type AppStep = "upload" | "preview" | "target" | "features" | "charts" | "model"

// ---------------------------------------------------------------------------
// Model Training
// ---------------------------------------------------------------------------

export interface FeatureImportanceItem {
  feature: string
  importance: number
}

export interface ModelMetrics {
  r2?: number
  mae?: number
  rmse?: number
  accuracy?: number
  f1?: number
  roc_auc?: number | null
  cv_mean?: number | null
  cv_std?: number | null
}

export interface ModelResult {
  model_name: string
  metrics: ModelMetrics
  feature_importances: FeatureImportanceItem[] | null
  predictions: { actual: number; predicted: number }[]
}

export interface TrainResponse {
  problem_type: "regression" | "classification"
  target_column: string
  feature_columns: string[]
  test_size: number
  n_train: number
  n_test: number
  models: ModelResult[]
  best_model: string
  model_bytes: string
}

export interface TrainRequest {
  session_id: string
  target_column: string
  problem_type: "regression" | "classification"
  feature_columns: string[]
  test_size: number
  models_to_train?: string[]
  cv_strategy?: string
  cv_folds?: number
}

export interface EngineerFeatureRequest {
  session_id: string
  col_a: string
  col_b: string
  operation: "add" | "subtract" | "multiply" | "divide"
  new_name?: string
}

export interface EngineerFeatureResponse {
  success: boolean
  new_column: string
  columns: string[]
  n_columns: number
}

// ---------------------------------------------------------------------------
// Distribution Charts
// ---------------------------------------------------------------------------

export interface DistributionBin {
  label: string
  start?: number
  end?: number
  count: number
  midpoint: number
  mean_y: number | null
}

export interface KdePoint {
  x: number
  density: number
}

export interface BoxStats {
  min: number
  q1: number
  median: number
  q3: number
  max: number
  outliers: number[]
}

export interface CdfPoint {
  label: string
  cumulative_pct: number
}

export interface DistributionResponse {
  column: string
  col_type: "numeric" | "categorical"
  chart_type: "histogram" | "per_value"
  total: number
  unique: number
  n_nan: number
  bins: DistributionBin[]
  kde_points: KdePoint[] | null
  box_stats: BoxStats | null
  cdf: CdfPoint[] | null
}
