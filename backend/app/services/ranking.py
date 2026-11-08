"""Ranking service: reproduces the notebook priority computation."""

from __future__ import annotations

import time

import numpy as np
import pandas as pd

from app.data_loader import DataStore


def compute_ranking(
    store: DataStore,
    weight_slope_p90: float = 1.0,
    weight_melton: float = 1.0,
    weight_drainage_density: float = 1.0,
    weight_inv_tc_min: float = 1.0,
    weight_p99_wetday: float = 1.0,
    weight_max3d: float = 1.0,
    weight_heavy_days: float = 1.0,
    response_rainfall_balance: float = 0.5,
    exposure_weight: float = 1.0,
    belt_min: float = 500,
    belt_max: float = 3500,
    p1_pct: float = 0.05,
    p2_pct: float = 0.05,
) -> tuple[pd.DataFrame, float]:
    """Recompute hazard index, priority score and classes for all catchments.

    Returns (result_df, elapsed_ms).
    """
    t0 = time.perf_counter()
    df = store.catchments.copy()

    resp_weights = np.array(
        [
            weight_slope_p90,
            weight_melton,
            weight_drainage_density,
            weight_inv_tc_min,
        ]
    )
    rain_weights = np.array(
        [
            weight_p99_wetday,
            weight_max3d,
            weight_heavy_days,
        ]
    )

    slope_r = df["slope_p90"].rank(pct=True).values
    melton_r = df["melton"].rank(pct=True).values
    dd_r = df["drainage_density"].rank(pct=True).values
    inv_tc_r = df["inv_tc_min"].rank(pct=True).values

    p99_r = df["p99_wetday"].rank(pct=True).values
    max3d_r = df["max3d"].rank(pct=True).values
    heavy_r = df["heavy_days"].rank(pct=True).values

    resp_sum = resp_weights.sum()
    rain_sum = rain_weights.sum()
    if resp_sum == 0:
        resp_sum = 1.0
    if rain_sum == 0:
        rain_sum = 1.0

    response_group = (
        resp_weights[0] * slope_r
        + resp_weights[1] * melton_r
        + resp_weights[2] * dd_r
        + resp_weights[3] * inv_tc_r
    ) / resp_sum

    rainfall_group = (
        rain_weights[0] * p99_r + rain_weights[1] * max3d_r + rain_weights[2] * heavy_r
    ) / rain_sum

    alpha = response_rainfall_balance
    hazard_index = alpha * response_group + (1 - alpha) * rainfall_group

    pop_total_r = df["pop_total"].rank(pct=True).values
    pop_near_r = df["pop_near_channel"].rank(pct=True).values
    exposure_index = (pop_total_r + pop_near_r) / 2.0

    priority_score = hazard_index * (exposure_index**exposure_weight)

    df["hazard_index_new"] = hazard_index
    df["priority_score_new"] = priority_score

    in_belt = (df["elev_mean"] >= belt_min) & (df["elev_mean"] <= belt_max)
    belt_scores = priority_score[in_belt]

    if len(belt_scores) > 0:
        belt_pct = pd.Series(belt_scores).rank(pct=True).values
        p1_thresh = 1.0 - p1_pct
        p2_thresh = 1.0 - p1_pct - p2_pct
        p3_lo = 0.7

        new_priority = pd.Series("P4 Routine", index=df.index)

        belt_idx = df.index[in_belt]
        for i, idx in enumerate(belt_idx):
            pct_val = belt_pct[i]
            if pct_val > p1_thresh:
                new_priority.iloc[idx] = "P1 Critical"
            elif pct_val > p2_thresh:
                new_priority.iloc[idx] = "P2 High"
            elif pct_val >= p3_lo:
                new_priority.iloc[idx] = "P3 Watch"

        outside_belt = ~in_belt
        cascade_high = df["cascade_risk"] == "High"
        cascade_watch_mask = outside_belt & cascade_high
        new_priority[cascade_watch_mask] = "P3 Watch"
    else:
        new_priority = pd.Series("P4 Routine", index=df.index)

    df["priority_new"] = new_priority

    elapsed = (time.perf_counter() - t0) * 1000
    return df, elapsed


def verify_reproduction(store: DataStore) -> bool:
    """Verify that default weights reproduce the notebook exactly."""
    df_result, _ = compute_ranking(store)
    original = store.catchments

    hi_match = np.allclose(
        df_result["hazard_index_new"].values,
        original["hazard_index"].values,
        atol=1e-6,
    )
    ps_match = np.allclose(
        df_result["priority_score_new"].values,
        original["priority_score"].values,
        atol=1e-6,
    )
    pri_match = (df_result["priority_new"] == original["priority"]).all()

    return hi_match and ps_match and pri_match
