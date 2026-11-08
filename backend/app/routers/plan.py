"""Action Planner endpoint."""

from __future__ import annotations

import csv
import io
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.data_loader import get_store
from app.models import PlanCatchment, PlanRequest, PlanResponse

router = APIRouter(prefix="/api", tags=["plan"])


@router.post("/plan", response_model=PlanResponse)
def create_plan(req: PlanRequest) -> PlanResponse:
    store = get_store()
    df = store.catchments

    mask = df["priority"].isin(req.classes)
    if req.regimes:
        regime_mask = df["regime"].apply(
            lambda r: any(r.startswith(rg.split(" ")[0]) for rg in req.regimes)
        )
        mask &= regime_mask
    if req.min_population > 0:
        mask &= df["pop_total"] >= req.min_population

    filtered = df[mask].nlargest(req.max_catchments, "priority_score")

    catchments = [
        PlanCatchment(
            catchment_id=int(r["catchment_id"]),
            lat=float(r["lat"]),
            lon=float(r["lon"]),
            regime=str(r["regime"]),
            priority=str(r["priority"]),
            priority_score=float(r["priority_score"]),
            action=str(r["action"]),
            pop_total=float(r["pop_total"]),
            pop_near_channel=float(r["pop_near_channel"]),
            elev_mean=float(r["elev_mean"]),
            watch_mm=float(r["watch_mm"]),
            warn_mm=float(r["warn_mm"]),
        )
        for _, r in filtered.iterrows()
    ]

    by_action = filtered["action"].value_counts().to_dict()
    by_priority = filtered["priority"].value_counts().to_dict()

    return PlanResponse(
        catchments=catchments,
        total_catchments=len(filtered),
        total_population=float(filtered["pop_total"].sum()),
        total_area=float(filtered["area_km2"].sum()),
        by_action=by_action,
        by_priority=by_priority,
    )


@router.post("/plan/export/csv")
def export_csv(req: PlanRequest) -> StreamingResponse:
    result = create_plan(req)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "catchment_id",
            "lat",
            "lon",
            "regime",
            "priority",
            "priority_score",
            "action",
            "pop_total",
            "pop_near_channel",
            "elev_mean",
            "watch_mm",
            "warn_mm",
        ]
    )
    for c in result.catchments:
        writer.writerow(
            [
                c.catchment_id,
                c.lat,
                c.lon,
                c.regime,
                c.priority,
                c.priority_score,
                c.action,
                c.pop_total,
                c.pop_near_channel,
                c.elev_mean,
                c.watch_mm,
                c.warn_mm,
            ]
        )
    buf.seek(0)
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=action_plan.csv"},
    )


@router.post("/plan/export/geojson")
def export_geojson(req: PlanRequest) -> StreamingResponse:
    result = create_plan(req)
    ids = {c.catchment_id for c in result.catchments}
    store = get_store()
    features = [
        f
        for f in store.geojson["features"]
        if f["properties"].get("catchment_id") in ids
    ]
    geojson = {"type": "FeatureCollection", "features": features}
    return StreamingResponse(
        io.BytesIO(json.dumps(geojson).encode()),
        media_type="application/geo+json",
        headers={"Content-Disposition": "attachment; filename=action_plan.geojson"},
    )
