// All TypeScript types matching backend Pydantic models

export interface SummaryResponse {
  n_catchments: number
  priority_counts: Record<string, number>
  n_cascade_watch: number
  n_emerging: number
  population_p12: number
  regime_counts: Record<string, number>
  n_events_all: number
  n_events_town: number
}

export interface CatchmentRow {
  catchment_id: number
  lat: number
  lon: number
  area_km2: number
  elev_mean: number
  regime: string
  priority: string
  priority_score: number
  hazard_index: number
  exposure_index: number
  cascade_risk: string
  cascade_watch: boolean
  populated: boolean
  action: string
  conf: number
  borderline: boolean
  pop_total: number
  pop_near_channel: number
  watch_mm: number
  warn_mm: number
  shift: number
}

export interface CatchmentListResponse {
  total: number
  page: number
  page_size: number
  rows: CatchmentRow[]
  matching_ids?: number[]
}

export interface FeaturePercentile {
  name: string
  value: number
  percentile: number
}

export interface SimilarCatchment {
  catchment_id: number
  regime: string
  priority: string
  priority_score: number
  distance: number
}

export interface CatchmentDetail {
  catchment_id: number
  lat: number
  lon: number
  area_km2: number
  up_area_km2: number
  elev_mean: number
  slope_p90: number
  melton: number
  drainage_density: number
  tc_min: number
  p99_wetday: number
  max3d: number
  heavy_days: number
  jjas_share: number
  frac_above_4500: number
  hazard_index: number
  exposure_index: number
  priority_score: number
  regime: string
  priority: string
  populated: boolean
  cascade_watch: boolean
  cascade_risk: string
  pop_total: number
  pop_near_channel: number
  watch_mm: number
  warn_mm: number
  watch_days_yr: number
  warn_days_yr: number
  imd_orange_days_yr: number
  rx3_trend: number
  rx3_q: number
  shift: number
  conf: number
  borderline: boolean
  action: string
  event_all: number
  event_town: number
  in_event_footprint: boolean
  feature_percentiles: FeaturePercentile[]
  similar_catchments: SimilarCatchment[]
}

export interface RankRequest {
  weight_slope_p90?: number
  weight_melton?: number
  weight_drainage_density?: number
  weight_inv_tc_min?: number
  weight_p99_wetday?: number
  weight_max3d?: number
  weight_heavy_days?: number
  response_rainfall_balance?: number
  exposure_weight?: number
  belt_min?: number
  belt_max?: number
  p1_pct?: number
  p2_pct?: number
  top_n?: number
}

export interface RankCatchmentResult {
  catchment_id: number
  priority: string
  priority_score: number
  hazard_index: number
  old_priority: string
  changed: boolean
}

export interface RankResponse {
  priority_counts: Record<string, number>
  population_p12: number
  total_belt: number
  total_outside: number
  processing_time_ms: number
  rows_processed: number
  top_n: CatchmentRow[]
  rank_changes: Record<string, number>
  catchment_classes: RankCatchmentResult[]
}

export interface ValidateRequest {
  event_set: 'all' | 'town_only'
  scope: 'footprint' | 'belt'
  weights?: RankRequest
}

export interface AUCResult {
  auc: number
  lo: number
  hi: number
}

export interface EventRateByRegime {
  regime: string
  n: number
  events: number
  rate: number
}

export interface ValidateResponse {
  n_catchments: number
  n_event_catchments: number
  auc: Record<string, AUCResult>
  p12_share: number
  p12_event_capture: number
  lift: number
  event_rate_by_regime: EventRateByRegime[]
}

export interface PlanRequest {
  classes?: string[]
  regimes?: string[]
  min_population?: number
  max_catchments?: number
}

export interface PlanCatchment {
  catchment_id: number
  lat: number
  lon: number
  regime: string
  priority: string
  priority_score: number
  action: string
  pop_total: number
  pop_near_channel: number
  elev_mean: number
  watch_mm: number
  warn_mm: number
}

export interface PlanResponse {
  catchments: PlanCatchment[]
  total_catchments: number
  total_population: number
  total_area: number
  by_action: Record<string, number>
  by_priority: Record<string, number>
}

export interface AlertResponse {
  catchment_id: number
  watch_mm: number
  warn_mm: number
  watch_days_yr: number
  warn_days_yr: number
  imd_orange_days_yr: number
  regime: string
  priority: string
}

export interface AlertTier {
  haz_tier: string
  watch_mm: number
  warn_mm: number
  watch_days_yr: number
  warn_days_yr: number
  imd_orange_days_yr: number
}

export interface AlertTiersResponse {
  tiers: AlertTier[]
}

export interface EventPoint {
  lat: number
  lon: number
  date: string
  location: string
  precision: 'town' | 'approx'
}

export interface EventsResponse {
  events_all: EventPoint[]
  events_town: EventPoint[]
}

export interface ModelRow {
  model: string
  k: number
  sil: number
  db: number
  bic: number | null
  stability: number
  min_size: number
  ARI_vs_ward: number
}

export interface MethodResponse {
  model_selection: ModelRow[]
  features: string[]
  pipeline_steps: string[]
  data_sources: Array<Record<string, string>>
  scope_facts: string[]
}

export interface ArchetypeProfile {
  h_rank: number
  n: number
  hazard_index: number
  area_km2: number
  elev_mean: number
  slope_p90: number
  melton: number
  drainage_density: number
  tc_min: number
  p99_wetday: number
  max3d: number
  heavy_days: number
  jjas_share: number
  frac_above_4500: number
  pop_total: number
  pop_near_channel: number
}

export interface FrontendData {
  title: string
  region: string
  summary: {
    n_catchments: number
    priority_counts: Record<string, number>
    n_cascade_watch: number
    n_emerging: number
  }
  regimes: Array<{
    regime: string
    n: number
    elev_mean: number
    slope_p90: number
    p99_wetday: number
    max3d: number
    pop_total: number
  }>
  validation: {
    belt_all: {
      n_catchments: number
      n_event_catchments: number
      auc: Record<string, AUCResult>
    }
    priority: {
      p12_share_of_belt: number
      p12_event_capture: number
      lift: number
    }
    event_rate_by_regime: EventRateByRegime[]
  }
  top50: Array<{
    catchment_id: number
    lat: number
    lon: number
    regime: string
    priority: string
    priority_score: number
    action: string
    conf: number
    borderline: boolean
    cascade_risk: string
    pop_total: number
    pop_near_channel: number
  }>
  catchments: CatchmentRow[]
}
