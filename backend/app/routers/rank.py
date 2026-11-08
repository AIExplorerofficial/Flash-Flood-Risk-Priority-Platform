"""Priority Builder endpoint: recompute rankings with custom weights."""

from fastapi import APIRouter

from app.data_loader import get_store
from app.models import CatchmentRow, RankCatchmentResult, RankRequest, RankResponse
from app.services.ranking import compute_ranking

router = APIRouter(prefix="/api", tags=["rank"])


@router.post("/rank", response_model=RankResponse)
def rerank(req: RankRequest) -> RankResponse:
    store = get_store()
    df, elapsed_ms = compute_ranking(
        store,
        weight_slope_p90=req.weight_slope_p90,
        weight_melton=req.weight_melton,
        weight_drainage_density=req.weight_drainage_density,
        weight_inv_tc_min=req.weight_inv_tc_min,
        weight_p99_wetday=req.weight_p99_wetday,
        weight_max3d=req.weight_max3d,
        weight_heavy_days=req.weight_heavy_days,
        response_rainfall_balance=req.response_rainfall_balance,
        exposure_weight=req.exposure_weight,
        belt_min=req.belt_min,
        belt_max=req.belt_max,
        p1_pct=req.p1_pct,
        p2_pct=req.p2_pct,
    )

    priority_counts = df["priority_new"].value_counts().to_dict()
    p12_mask = df["priority_new"].isin(["P1 Critical", "P2 High"])
    population_p12 = float(df.loc[p12_mask, "pop_total"].sum())
    in_belt = (df["elev_mean"] >= req.belt_min) & (df["elev_mean"] <= req.belt_max)
    total_belt = int(in_belt.sum())
    total_outside = int((~in_belt).sum())

    changed = df["priority_new"] != df["priority"]
    upgrades = int(
        ((df["priority_new"].str[1] < df["priority"].str[1]) & changed).sum()
    )
    downgrades = int(
        ((df["priority_new"].str[1] > df["priority"].str[1]) & changed).sum()
    )
    rank_changes = {
        "upgraded": upgrades,
        "downgraded": downgrades,
        "unchanged": int((~changed).sum()),
    }

    top_df = df[p12_mask].nlargest(req.top_n, "priority_score_new")
    top_rows = [
        CatchmentRow(
            catchment_id=int(r["catchment_id"]),
            lat=float(r["lat"]),
            lon=float(r["lon"]),
            area_km2=float(r["area_km2"]),
            elev_mean=float(r["elev_mean"]),
            regime=str(r["regime"]),
            priority=str(r["priority_new"]),
            priority_score=float(r["priority_score_new"]),
            hazard_index=float(r["hazard_index_new"]),
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
        for _, r in top_df.iterrows()
    ]

    catchment_classes = [
        RankCatchmentResult(
            catchment_id=int(r["catchment_id"]),
            priority=str(r["priority_new"]),
            priority_score=float(r["priority_score_new"]),
            hazard_index=float(r["hazard_index_new"]),
            old_priority=str(r["priority"]),
            changed=bool(r["priority_new"] != r["priority"]),
        )
        for _, r in df.iterrows()
    ]

    return RankResponse(
        priority_counts=priority_counts,
        population_p12=population_p12,
        total_belt=total_belt,
        total_outside=total_outside,
        processing_time_ms=round(elapsed_ms, 1),
        rows_processed=len(df),
        top_n=top_rows,
        rank_changes=rank_changes,
        catchment_classes=catchment_classes,
    )
