"""Catchments list and detail endpoints."""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter, HTTPException

from app.data_loader import get_store
from app.models import (
    CatchmentDetailResponse,
    CatchmentListResponse,
    CatchmentRow,
    FeaturePercentile,
    SimilarCatchment,
)

router = APIRouter(prefix="/api", tags=["catchments"])

SORTABLE = {
    "catchment_id",
    "priority_score",
    "hazard_index",
    "exposure_index",
    "elev_mean",
    "pop_total",
    "area_km2",
    "slope_p90",
    "watch_mm",
}


@router.get("/catchments", response_model=CatchmentListResponse)
def list_catchments(
    regime: str | None = None,
    priority: str | None = None,
    elev_min: float | None = None,
    elev_max: float | None = None,
    pop_min: float | None = None,
    pop_max: float | None = None,
    search: str | None = None,
    cascade: bool | None = None,
    sort: str = "priority_score",
    order: str = "desc",
    page: int = 1,
    page_size: int = 25,
) -> CatchmentListResponse:
    store = get_store()
    df = store.catchments

    mask = np.ones(len(df), dtype=bool)
    if regime:
        mask &= df["regime"].str.startswith(str(regime).split(" ")[0])
    if priority:
        mask &= df["priority"].str.startswith(str(priority))
    if elev_min is not None and isinstance(elev_min, (int, float)):
        mask &= df["elev_mean"] >= elev_min
    if elev_max is not None and isinstance(elev_max, (int, float)):
        mask &= df["elev_mean"] <= elev_max
    if pop_min is not None and isinstance(pop_min, (int, float)):
        mask &= df["pop_total"] >= pop_min
    if pop_max is not None and isinstance(pop_max, (int, float)):
        mask &= df["pop_total"] <= pop_max
    if cascade is not None and isinstance(cascade, bool):
        mask &= df["cascade_watch"] == cascade
    if search:
        search_str = str(search).strip()
        id_str = df["catchment_id"].astype(str)
        mask &= id_str.str.contains(search_str)

    filtered = df[mask].copy()
    sort_col = sort if isinstance(sort, str) and sort in SORTABLE else "priority_score"
    ascending = order == "asc"

    if search:
        search_str = str(search).strip()
        id_s = filtered["catchment_id"].astype(str)
        filtered["_exact"] = id_s == search_str
        filtered["_starts"] = id_s.str.startswith(search_str)
        filtered["_len"] = id_s.str.len()
        filtered = filtered.sort_values(
            by=["_exact", "_starts", "_len", sort_col],
            ascending=[False, False, True, ascending],
        )
    else:
        filtered = filtered.sort_values(sort_col, ascending=ascending)

    total = len(filtered)
    matching_ids = filtered["catchment_id"].astype(int).tolist()
    page_val = max(1, page) if isinstance(page, int) else 1
    ps_val = min(max(1, page_size), 200) if isinstance(page_size, int) else 25
    start = (page_val - 1) * ps_val
    page_df = filtered.iloc[start : start + ps_val]

    rows = [
        CatchmentRow(
            catchment_id=int(r["catchment_id"]),
            lat=float(r["lat"]),
            lon=float(r["lon"]),
            area_km2=float(r["area_km2"]),
            elev_mean=float(r["elev_mean"]),
            regime=str(r["regime"]),
            priority=str(r["priority"]),
            priority_score=float(r["priority_score"]),
            hazard_index=float(r["hazard_index"]),
            exposure_index=float(r["exposure_index"]),
            cascade_risk=str(r["cascade_risk"]),
            cascade_watch=bool(r["cascade_watch"]),
            populated=bool(r["populated"]),
            action=str(r["action"]),
            conf=float(r["conf"]),
            borderline=bool(r["borderline"]),
            pop_total=float(r["pop_total"]),
            pop_near_channel=float(r["pop_near_channel"]),
            watch_mm=float(r["watch_mm"]),
            warn_mm=float(r["warn_mm"]),
            shift=int(r["shift"]),
        )
        for _, r in page_df.iterrows()
    ]
    return CatchmentListResponse(
        total=total,
        page=page_val,
        page_size=ps_val,
        rows=rows,
        matching_ids=matching_ids,
    )


@router.get("/catchments/{catchment_id}", response_model=CatchmentDetailResponse)
def get_catchment(catchment_id: int) -> CatchmentDetailResponse:
    store = get_store()
    if catchment_id not in store.catchment_index:
        raise HTTPException(404, f"Catchment {catchment_id} not found")

    idx = store.catchment_index[catchment_id]
    r = store.catchments.iloc[idx]

    feat_names = [
        "slope_p90",
        "melton",
        "drainage_density",
        "inv_tc_min",
        "p99_wetday",
        "max3d",
        "heavy_days",
        "elev_mean",
        "area_km2",
        "pop_total",
        "pop_near_channel",
        "exposure_index",
        "hazard_index",
        "priority_score",
    ]
    percs = []
    for fname in feat_names:
        if fname in store.percentile_ranks:
            display = fname.replace("inv_tc_min", "1/tc_min")
            percs.append(
                FeaturePercentile(
                    name=display,
                    value=float(r[fname]) if fname in r.index else 0.0,
                    percentile=float(store.percentile_ranks[fname].iloc[idx]),
                )
            )

    regime = r["regime"]
    same_regime = store.catchments[
        (store.catchments["regime"] == regime)
        & (store.catchments["catchment_id"] != catchment_id)
    ]
    if len(same_regime) > 0 and idx < len(store.standardised):
        point = store.standardised[idx]
        regime_indices = same_regime.index.values
        regime_std = store.standardised[regime_indices]
        dists = np.sqrt(((regime_std - point) ** 2).sum(axis=1))
        nearest = np.argsort(dists)[:5]
        similar = [
            SimilarCatchment(
                catchment_id=int(same_regime.iloc[ni]["catchment_id"]),
                regime=str(same_regime.iloc[ni]["regime"]),
                priority=str(same_regime.iloc[ni]["priority"]),
                priority_score=float(same_regime.iloc[ni]["priority_score"]),
                distance=float(dists[ni]),
            )
            for ni in nearest
        ]
    else:
        similar = []

    return CatchmentDetailResponse(
        catchment_id=int(r["catchment_id"]),
        lat=float(r["lat"]),
        lon=float(r["lon"]),
        area_km2=float(r["area_km2"]),
        up_area_km2=float(r["up_area_km2"]),
        elev_mean=float(r["elev_mean"]),
        slope_p90=float(r["slope_p90"]),
        melton=float(r["melton"]),
        drainage_density=float(r["drainage_density"]),
        tc_min=float(r["tc_min"]),
        p99_wetday=float(r["p99_wetday"]),
        max3d=float(r["max3d"]),
        heavy_days=float(r["heavy_days"]),
        jjas_share=float(r["jjas_share"]),
        frac_above_4500=float(r["frac_above_4500"]),
        hazard_index=float(r["hazard_index"]),
        exposure_index=float(r["exposure_index"]),
        priority_score=float(r["priority_score"]),
        regime=str(r["regime"]),
        priority=str(r["priority"]),
        populated=bool(r["populated"]),
        cascade_watch=bool(r["cascade_watch"]),
        cascade_risk=str(r["cascade_risk"]),
        pop_total=float(r["pop_total"]),
        pop_near_channel=float(r["pop_near_channel"]),
        watch_mm=float(r["watch_mm"]),
        warn_mm=float(r["warn_mm"]),
        watch_days_yr=float(r["watch_days_yr"]),
        warn_days_yr=float(r["warn_days_yr"]),
        imd_orange_days_yr=float(r["imd_orange_days_yr"]),
        rx3_trend=float(r["rx3_trend"]),
        rx3_q=float(r["rx3_q"]),
        shift=int(r["shift"]),
        conf=float(r["conf"]),
        borderline=bool(r["borderline"]),
        action=str(r["action"]),
        event_all=int(r["event_all"]),
        event_town=int(r["event_town"]),
        in_event_footprint=bool(r["in_event_footprint"]),
        feature_percentiles=percs,
        similar_catchments=similar,
    )
