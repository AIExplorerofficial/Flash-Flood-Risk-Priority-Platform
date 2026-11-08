"""Pydantic models for API request/response contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SummaryResponse(BaseModel):
    n_catchments: int
    priority_counts: dict[str, int]
    n_cascade_watch: int
    n_emerging: int
    population_p12: float
    regime_counts: dict[str, int]
    n_events_all: int
    n_events_town: int


class CatchmentRow(BaseModel):
    catchment_id: int
    lat: float
    lon: float
    area_km2: float
    elev_mean: float
    regime: str
    priority: str
    priority_score: float
    hazard_index: float
    exposure_index: float
    cascade_risk: str
    cascade_watch: bool
    populated: bool
    action: str
    conf: float
    borderline: bool
    pop_total: float
    pop_near_channel: float
    watch_mm: float
    warn_mm: float
    shift: int


class CatchmentListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    rows: list[CatchmentRow]
    matching_ids: list[int] | None = None


class FeaturePercentile(BaseModel):
    name: str
    value: float
    percentile: float


class SimilarCatchment(BaseModel):
    catchment_id: int
    regime: str
    priority: str
    priority_score: float
    distance: float


class CatchmentDetailResponse(BaseModel):
    catchment_id: int
    lat: float
    lon: float
    area_km2: float
    up_area_km2: float
    elev_mean: float
    slope_p90: float
    melton: float
    drainage_density: float
    tc_min: float
    p99_wetday: float
    max3d: float
    heavy_days: float
    jjas_share: float
    frac_above_4500: float
    hazard_index: float
    exposure_index: float
    priority_score: float
    regime: str
    priority: str
    populated: bool
    cascade_watch: bool
    cascade_risk: str
    pop_total: float
    pop_near_channel: float
    watch_mm: float
    warn_mm: float
    watch_days_yr: float
    warn_days_yr: float
    imd_orange_days_yr: float
    rx3_trend: float
    rx3_q: float
    shift: int
    conf: float
    borderline: bool
    action: str
    event_all: int
    event_town: int
    in_event_footprint: bool
    feature_percentiles: list[FeaturePercentile]
    similar_catchments: list[SimilarCatchment]


class RankRequest(BaseModel):
    weight_slope_p90: float = Field(default=1.0, ge=0, le=5)
    weight_melton: float = Field(default=1.0, ge=0, le=5)
    weight_drainage_density: float = Field(default=1.0, ge=0, le=5)
    weight_inv_tc_min: float = Field(default=1.0, ge=0, le=5)
    weight_p99_wetday: float = Field(default=1.0, ge=0, le=5)
    weight_max3d: float = Field(default=1.0, ge=0, le=5)
    weight_heavy_days: float = Field(default=1.0, ge=0, le=5)
    response_rainfall_balance: float = Field(default=0.5, ge=0, le=1)
    exposure_weight: float = Field(default=1.0, ge=0, le=5)
    belt_min: float = Field(default=500)
    belt_max: float = Field(default=3500)
    p1_pct: float = Field(default=0.05, gt=0, le=0.5)
    p2_pct: float = Field(default=0.05, gt=0, le=0.5)
    top_n: int = Field(default=20, ge=1, le=100)


class RankCatchmentResult(BaseModel):
    catchment_id: int
    priority: str
    priority_score: float
    hazard_index: float
    old_priority: str
    changed: bool


class RankResponse(BaseModel):
    priority_counts: dict[str, int]
    population_p12: float
    total_belt: int
    total_outside: int
    processing_time_ms: float
    rows_processed: int
    top_n: list[CatchmentRow]
    rank_changes: dict[str, int]
    catchment_classes: list[RankCatchmentResult]


class ValidateRequest(BaseModel):
    event_set: str = Field(default="all", pattern="^(all|town_only)$")
    scope: str = Field(default="belt", pattern="^(footprint|belt)$")
    weights: RankRequest | None = None


class AUCResult(BaseModel):
    auc: float
    lo: float
    hi: float


class ValidateResponse(BaseModel):
    n_catchments: int
    n_event_catchments: int
    auc: dict[str, AUCResult]
    p12_share: float
    p12_event_capture: float
    lift: float
    event_rate_by_regime: list[dict]


class PlanRequest(BaseModel):
    classes: list[str] = Field(default=["P1 Critical", "P2 High"])
    regimes: list[str] | None = None
    min_population: float = Field(default=0, ge=0)
    max_catchments: int = Field(default=200, ge=1, le=3067)


class PlanCatchment(BaseModel):
    catchment_id: int
    lat: float
    lon: float
    regime: str
    priority: str
    priority_score: float
    action: str
    pop_total: float
    pop_near_channel: float
    elev_mean: float
    watch_mm: float
    warn_mm: float


class PlanResponse(BaseModel):
    catchments: list[PlanCatchment]
    total_catchments: int
    total_population: float
    total_area: float
    by_action: dict[str, int]
    by_priority: dict[str, int]


class AlertResponse(BaseModel):
    catchment_id: int
    watch_mm: float
    warn_mm: float
    watch_days_yr: float
    warn_days_yr: float
    imd_orange_days_yr: float
    regime: str
    priority: str


class AlertTier(BaseModel):
    haz_tier: str
    watch_mm: float
    warn_mm: float
    watch_days_yr: float
    warn_days_yr: float
    imd_orange_days_yr: float


class AlertTiersResponse(BaseModel):
    tiers: list[AlertTier]


class EventPoint(BaseModel):
    lat: float
    lon: float
    date: str
    location: str
    precision: str


class EventsResponse(BaseModel):
    events_all: list[EventPoint]
    events_town: list[EventPoint]


class ModelRow(BaseModel):
    model: str
    k: int
    sil: float
    db: float
    bic: float | None
    stability: float
    min_size: int
    ARI_vs_ward: float


class MethodResponse(BaseModel):
    model_selection: list[ModelRow]
    features: list[str]
    pipeline_steps: list[str]
    data_sources: list[dict[str, str]]
    scope_facts: list[str]
