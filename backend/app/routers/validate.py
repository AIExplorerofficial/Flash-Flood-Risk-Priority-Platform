"""Validation endpoint."""

from fastapi import APIRouter

from app.data_loader import get_store
from app.models import ValidateRequest, ValidateResponse
from app.services.ranking import compute_ranking
from app.services.validation import run_validation

router = APIRouter(prefix="/api", tags=["validate"])


@router.post("/validate", response_model=ValidateResponse)
def validate(req: ValidateRequest) -> ValidateResponse:
    store = get_store()

    hazard_index = None
    priority_score = None
    priority = None

    if req.weights is not None:
        df_ranked, _ = compute_ranking(
            store,
            weight_slope_p90=req.weights.weight_slope_p90,
            weight_melton=req.weights.weight_melton,
            weight_drainage_density=req.weights.weight_drainage_density,
            weight_inv_tc_min=req.weights.weight_inv_tc_min,
            weight_p99_wetday=req.weights.weight_p99_wetday,
            weight_max3d=req.weights.weight_max3d,
            weight_heavy_days=req.weights.weight_heavy_days,
            response_rainfall_balance=req.weights.response_rainfall_balance,
            exposure_weight=req.weights.exposure_weight,
            belt_min=req.weights.belt_min,
            belt_max=req.weights.belt_max,
            p1_pct=req.weights.p1_pct,
            p2_pct=req.weights.p2_pct,
        )
        hazard_index = df_ranked["hazard_index_new"].values
        priority_score = df_ranked["priority_score_new"].values
        priority = df_ranked["priority_new"]

    result = run_validation(
        store,
        event_set=req.event_set,
        scope=req.scope,
        hazard_index=hazard_index,
        priority_score=priority_score,
        priority=priority,
    )

    return ValidateResponse(**result)
