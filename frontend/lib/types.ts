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
  skewness?: number | null
  kurtosis?: number | null
  suggested_transform?: "log" | "sqrt" | "none"
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

export interface ClassBalance {
  counts: Record<string, number>
  imbalance_ratio: number | null
  is_severe: boolean
  n_classes: number
}

export interface AnalyzeResponse {
  problem_type: "regression" | "classification"
  target_column: string
  features: FeatureResult[]
  total_features_analyzed: number
  top_n: number
  weights_used: Record<string, number>
  class_balance?: ClassBalance
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
export type AppStep = "upload" | "preview" | "target" | "features" | "charts" | "model" | "predict" | "evaluation"

// ---------------------------------------------------------------------------
// Model Training
// ---------------------------------------------------------------------------

export interface FeatureImportanceItem {
  feature: string
  importance: number
}

export interface MetricCI {
  lower: number
  upper: number
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
  ci?: Record<string, MetricCI> | null
}

export interface RocCurveEntry {
  fpr: number[]
  tpr: number[]
  auc: number
  label: string
}

export interface ModelResult {
  model_name: string
  metrics: ModelMetrics
  feature_importances: FeatureImportanceItem[] | null
  predictions: { actual: number; predicted: number }[]
  confusion_matrix?: number[][] | null
  class_labels?: string[] | null
  roc_curve_data?: RocCurveEntry[] | null
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
// Advanced Feature Transforms
// ---------------------------------------------------------------------------

export type FeatureTransformType =
  | "log1p"
  | "sqrt"
  | "square"
  | "reciprocal"
  | "power_transform"
  | "binning"
  | "clip_outliers"
  | "polynomial"

export interface TransformFeatureRequest {
  session_id: string
  transform: FeatureTransformType
  column?: string          // single-column transforms
  columns?: string[]       // multi-column transforms (polynomial)
  new_name?: string
  n_bins?: number          // for "binning"
  clip_lower?: number      // for "clip_outliers" (percentile 0-100)
  clip_upper?: number      // for "clip_outliers" (percentile 0-100)
}

export interface TransformFeatureResponse {
  success: boolean
  transform: FeatureTransformType
  created_columns: string[]
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

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export interface DriftFeature {
  feature: string
  test: "ks" | "chi2"
  p_value: number
  drifted: boolean
}

export interface EvaluationResult {
  problem_type: "regression" | "classification"
  n_samples: number
  // Regression
  predictions?: { actual: number; predicted: number }[]
  residuals?: { fitted: number; residual: number }[] | null
  r2?: number
  mae?: number
  rmse?: number
  // Classification
  accuracy?: number
  f1?: number
  roc_curve?: { fpr: number; tpr: number }[] | null
  roc_auc?: number | null
  confusion_matrix?: number[][] | null
  class_labels?: string[] | null
  calibration?: {
    fraction_of_positives: number[]
    mean_predicted: number[]
  } | null
  // Drift detection
  drift?: DriftFeature[] | null
}

export interface EvaluateRequest {
  session_id: string
  target_column: string
  problem_type: "regression" | "classification"
  feature_columns: string[]
  file: File
}

// ---------------------------------------------------------------------------
// Prediction
// ---------------------------------------------------------------------------

export interface PredictRequest {
  session_id: string
  feature_values: Record<string, number | string>
}

export interface PredictResponse {
  prediction: number | string
  probabilities?: Record<string, number>
  prediction_interval?: { lower_95: number; upper_95: number }
  warnings: string[]
}

export interface BatchPredictResponse {
  predictions: (number | string)[]
  probabilities?: Record<string, number>[]
  n_rows: number
  warnings: string[]
  missing_features: string[]
}

// ---------------------------------------------------------------------------
// Outlier Detection
// ---------------------------------------------------------------------------

export interface OutlierColumn {
  column: string
  z_score_count: number
  iqr_count: number
  z_score_pct: number
  iqr_pct: number
  n_valid: number
}

export interface OutlierResponse {
  outliers: OutlierColumn[]
  n_rows: number
}

// ---------------------------------------------------------------------------
// VIF (Multicollinearity)
// ---------------------------------------------------------------------------

export interface VIFEntry {
  feature: string
  vif: number | null
}

export interface VIFResponse {
  vif: VIFEntry[]
}

// ---------------------------------------------------------------------------
// Learning Curves
// ---------------------------------------------------------------------------

export interface LearningCurvePoint {
  train_size: number
  train_score: number
  val_score: number
  val_std: number
}

export interface LearningCurveResponse {
  learning_curve: LearningCurvePoint[]
  scoring: string
}

// ---------------------------------------------------------------------------
// Partial Dependence Plot
// ---------------------------------------------------------------------------

export interface PDPResponse {
  feature: string
  values: number[]
  average: number[]
}

// ---------------------------------------------------------------------------
// SHAP Values
// ---------------------------------------------------------------------------

export interface SHAPFeature {
  feature: string
  value: number
}

export interface SHAPResponse {
  mean_abs_shap: SHAPFeature[]
  sample_shap: number[][]
  sample_feature_values: number[][]
  n_samples: number
  feature_columns: string[]
  method?: string   // "shap" | "model_importance" | "coefficients" | "uniform"
}

// ---------------------------------------------------------------------------
// RFECV
// ---------------------------------------------------------------------------

export interface RFECVRanking {
  feature: string
  rank: number
}

export interface RFECVResponse {
  optimal_features: string[]
  n_optimal: number
  ranking: RFECVRanking[]
  cv_scores: number[]
}

// ---------------------------------------------------------------------------
// Hyperparameter Tuning
// ---------------------------------------------------------------------------

export interface TuneResult {
  params: Record<string, unknown>
  score: number
  std: number
}

export interface TuneResponse {
  best_params: Record<string, unknown>
  best_score: number
  results: TuneResult[]
  scoring: string
}

// ---------------------------------------------------------------------------
// Dimensionality Reduction (PCA / t-SNE)
// ---------------------------------------------------------------------------

export interface ReductionPoint {
  x: number
  y: number
  target: number
}

export interface ReduceResponse {
  method: "pca" | "tsne"
  points: ReductionPoint[]
  explained_variance: number[] | null
  n_points: number
  feature_columns: string[]
}
