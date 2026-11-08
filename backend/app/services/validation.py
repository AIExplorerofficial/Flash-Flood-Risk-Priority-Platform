"""Validation service: AUC with bootstrap CI, lift, event rates."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

from app.data_loader import DataStore


def compute_auc_bootstrap(
    y_true: np.ndarray,
    scores: np.ndarray,
    n_draws: int = 300,
    seed: int = 42,
) -> tuple[float, float, float]:
    """Compute AUC with 95% bootstrap CI."""
    auc = float(roc_auc_score(y_true, scores))
    rng = np.random.RandomState(seed)
    n = len(y_true)
    aucs = []
    for _ in range(n_draws):
        idx = rng.randint(0, n, size=n)
        y_b = y_true[idx]
        s_b = scores[idx]
        if y_b.sum() == 0 or y_b.sum() == len(y_b):
            continue
        aucs.append(float(roc_auc_score(y_b, s_b)))
    aucs = sorted(aucs)
    lo = float(aucs[int(0.025 * len(aucs))]) if aucs else auc
    hi = float(aucs[int(0.975 * len(aucs))]) if aucs else auc
    return auc, lo, hi


def run_validation(
    store: DataStore,
    event_set: str = "all",
    scope: str = "belt",
    hazard_index: np.ndarray | None = None,
    priority_score: np.ndarray | None = None,
    priority: pd.Series | None = None,
) -> dict:
    """Run validation against recorded events."""
    df = store.catchments.copy()

    if hazard_index is not None:
        df["hazard_index"] = hazard_index
    if priority_score is not None:
        df["priority_score"] = priority_score
    if priority is not None:
        df["priority"] = priority

    event_col = "event_all" if event_set == "all" else "event_town"

    if scope == "footprint":
        mask = df["in_event_footprint"]
    else:
        mask = df["in_event_footprint"] & df["populated"]

    subset = df[mask].copy()
    n_catchments = len(subset)
    y_true = (subset[event_col] > 0).astype(int).values
    n_events = int(y_true.sum())

    score_cols = {
        "hazard_index": subset["hazard_index"].values,
        "slope_p90": subset["slope_p90"].values,
        "p99_wetday": subset["p99_wetday"].values,
        "max3d": subset["max3d"].values,
        "exposure_index": subset["exposure_index"].values,
        "priority_score": subset["priority_score"].values,
    }

    auc_results = {}
    for name, scores in score_cols.items():
        if n_events > 0 and n_events < n_catchments:
            a, lo, hi = compute_auc_bootstrap(y_true, scores)
            auc_results[name] = {"auc": a, "lo": lo, "hi": hi}
        else:
            auc_results[name] = {"auc": 0.5, "lo": 0.5, "hi": 0.5}

    p12_mask = subset["priority"].isin(["P1 Critical", "P2 High"])
    p12_count = int(p12_mask.sum())
    p12_share = p12_count / n_catchments if n_catchments > 0 else 0.0
    p12_events = int(y_true[p12_mask].sum()) if p12_count > 0 else 0
    p12_capture = p12_events / n_events if n_events > 0 else 0.0
    lift = p12_capture / p12_share if p12_share > 0 else 0.0

    regimes_in_scope = subset["regime"].unique()
    event_rate_by_regime = []
    for regime in sorted(regimes_in_scope):
        rmask = subset["regime"] == regime
        rcount = int(rmask.sum())
        revents = int(y_true[rmask].sum())
        rate = revents / rcount if rcount > 0 else 0.0
        event_rate_by_regime.append(
            {
                "regime": regime,
                "n": rcount,
                "events": revents,
                "rate": round(rate, 3),
            }
        )

    return {
        "n_catchments": n_catchments,
        "n_event_catchments": n_events,
        "auc": auc_results,
        "p12_share": p12_share,
        "p12_event_capture": p12_capture,
        "lift": lift,
        "event_rate_by_regime": event_rate_by_regime,
    }
