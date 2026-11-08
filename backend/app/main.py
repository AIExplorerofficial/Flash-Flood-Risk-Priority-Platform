"""FastAPI application for Himalayan Catchment Flash-Flood Priority Platform."""

from __future__ import annotations

import gzip
import json
import logging
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from app.data_loader import get_store
from app.routers import (
    alerts,
    catchments,
    events,
    method,
    plan,
    rank,
    summary,
    validate,
)
from app.services.ranking import verify_reproduction

logger = logging.getLogger("uvicorn.error")

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


def create_app() -> FastAPI:
    store = get_store()
    store.load()

    logger.info("Running reproduction test...")
    if not verify_reproduction(store):
        logger.error(
            "REPRODUCTION TEST FAILED: recomputed hazard_index, priority_score "
            "or priority do not match catchment_features.csv. Server refuses to start."
        )
        sys.exit(1)
    logger.info("Reproduction test passed.")

    application = FastAPI(
        title="Himalayan Catchment Flash-Flood Priority Platform",
        version="1.0.0",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(summary.router)
    application.include_router(catchments.router)
    application.include_router(rank.router)
    application.include_router(validate.router)
    application.include_router(plan.router)
    application.include_router(alerts.router)
    application.include_router(events.router)
    application.include_router(method.router)

    geojson_bytes = gzip.compress(json.dumps(store.geojson).encode())

    @application.get("/api/geojson")
    def get_geojson() -> Response:
        return Response(
            content=geojson_bytes,
            media_type="application/geo+json",
            headers={
                "Content-Encoding": "gzip",
                "Cache-Control": "public, max-age=3600",
            },
        )

    @application.get("/api/archetype-profiles")
    def get_profiles() -> list[dict]:
        return store.archetype_profiles.to_dict(orient="records")

    @application.get("/api/frontend-data")
    def get_frontend_data() -> dict:
        return store.frontend_data

    if (DATA_DIR / "maps.png").exists():
        application.mount(
            "/static",
            StaticFiles(directory=str(DATA_DIR)),
            name="static",
        )

    return application


app = create_app()
