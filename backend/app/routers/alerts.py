"""Alert levels endpoint."""

from fastapi import APIRouter, HTTPException

from app.data_loader import get_store
from app.models import AlertResponse, AlertTier, AlertTiersResponse

router = APIRouter(prefix="/api", tags=["alerts"])


@router.get("/alerts/tiers", response_model=AlertTiersResponse)
def get_alert_tiers() -> AlertTiersResponse:
    store = get_store()
    tiers = [
        AlertTier(
            haz_tier=str(r["haz_tier"]),
            watch_mm=float(r["watch_mm"]),
            warn_mm=float(r["warn_mm"]),
            watch_days_yr=float(r["watch_days_yr"]),
            warn_days_yr=float(r["warn_days_yr"]),
            imd_orange_days_yr=float(r["imd_orange_days_yr"]),
        )
        for _, r in store.alert_tiers.iterrows()
    ]
    return AlertTiersResponse(tiers=tiers)


@router.get("/alerts/{catchment_id}", response_model=AlertResponse)
def get_alerts(catchment_id: int) -> AlertResponse:
    store = get_store()
    if catchment_id not in store.catchment_index:
        raise HTTPException(404, f"Catchment {catchment_id} not found")
    idx = store.catchment_index[catchment_id]
    r = store.catchments.iloc[idx]
    return AlertResponse(
        catchment_id=int(r["catchment_id"]),
        watch_mm=float(r["watch_mm"]),
        warn_mm=float(r["warn_mm"]),
        watch_days_yr=float(r["watch_days_yr"]),
        warn_days_yr=float(r["warn_days_yr"]),
        imd_orange_days_yr=float(r["imd_orange_days_yr"]),
        regime=str(r["regime"]),
        priority=str(r["priority"]),
    )
