"""Backend tests: reproduction, direct endpoint functions, AUC correctness."""

from __future__ import annotations

import pytest
from sklearn.metrics import roc_auc_score

from app.data_loader import get_store
from app.models import PlanRequest, RankRequest, ValidateRequest
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
from app.services.validation import compute_auc_bootstrap


@pytest.fixture(scope="session")
def store():
    s = get_store()
    return s


def test_reproduction(store):
    assert verify_reproduction(store), (
        "Recomputed hazard_index / priority_score / priority do not match catchment_features.csv"
    )


def test_summary_endpoint():
    data = summary.get_summary()
    assert data.n_catchments == 3067
    assert data.priority_counts["P1 Critical"] == 71
    assert data.priority_counts["P2 High"] == 70
    assert data.n_cascade_watch == 1192
    assert data.n_events_all == 122
    assert data.n_events_town == 40


def test_catchments_list():
    data = catchments.list_catchments(page_size=10, sort="priority_score", order="desc")
    assert data.total == 3067
    assert len(data.rows) == 10
    scores = [row.priority_score for row in data.rows]
    assert scores == sorted(scores, reverse=True)


def test_catchment_detail():
    data = catchments.get_catchment(1847)
    assert data.catchment_id == 1847
    assert data.priority == "P1 Critical"
    assert len(data.feature_percentiles) > 0
    assert len(data.similar_catchments) > 0


def test_catchment_not_found():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as excinfo:
        catchments.get_catchment(999999)
    assert excinfo.value.status_code == 404


def test_rank_defaults():
    data = rank.rerank(RankRequest())
    assert data.priority_counts["P1 Critical"] == 71
    assert data.priority_counts["P2 High"] == 70


def test_validate_belt_all_auc():
    data = validate.validate(ValidateRequest(event_set="all", scope="belt"))
    assert abs(data.auc["hazard_index"].auc - 0.513) < 0.01
    assert abs(data.auc["exposure_index"].auc - 0.595) < 0.01
    assert abs(data.auc["priority_score"].auc - 0.619) < 0.01
    assert abs(data.p12_share - 0.0893) < 0.005
    assert abs(data.p12_event_capture - 0.1026) < 0.005
    assert abs(data.lift - 1.15) < 0.05


def test_auc_matches_sklearn(store):
    df = store.catchments
    footprint = df[df["in_event_footprint"] & df["populated"]]
    y = (footprint["event_all"] > 0).astype(int).values
    scores = footprint["priority_score"].values
    if y.sum() > 0 and y.sum() < len(y):
        auc_sklearn = float(roc_auc_score(y, scores))
        auc_ours, _, _ = compute_auc_bootstrap(y, scores, n_draws=1)
        assert abs(auc_sklearn - auc_ours) < 1e-9


def test_plan_endpoint():
    data = plan.create_plan(
        PlanRequest(classes=["P1 Critical", "P2 High"], max_catchments=50)
    )
    assert data.total_catchments == 50
    assert data.total_population > 0


def test_alerts_endpoint():
    data = alerts.get_alerts(1847)
    assert data.watch_mm > 0
    assert data.warn_mm > data.watch_mm


def test_alert_tiers():
    data = alerts.get_alert_tiers()
    assert len(data.tiers) == 4


def test_events_endpoint():
    data = events.get_events()
    assert len(data.events_all) == 122
    assert len(data.events_town) == 40


def test_method_endpoint():
    data = method.get_method()
    assert len(data.model_selection) == 10
    assert len(data.features) > 0


def test_catchments_partial_search():
    data = catchments.list_catchments(search="18", page_size=20)
    assert data.total > 1
    ids = [row.catchment_id for row in data.rows]
    assert 18 in ids or data.rows[0].catchment_id == 18


def test_geojson_enriched_properties(store):
    feat = store.geojson["features"][0]["properties"]
    assert "exposure_index" in feat
    assert "slope_p90" in feat
    assert len(store.geojson["features"]) == 3067
