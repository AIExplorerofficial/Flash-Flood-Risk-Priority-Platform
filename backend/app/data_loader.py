"""Load all data files once at startup. Provides a singleton DataStore."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Self

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

RESPONSE_FEATURES = ["slope_p90", "melton", "drainage_density", "inv_tc_min"]
RAINFALL_FEATURES = ["p99_wetday", "max3d", "heavy_days"]
PERCENTILE_FEATURES = [
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


class DataStore:
    """Singleton holding all project data in memory."""

    _instance: DataStore | None = None

    def __new__(cls) -> Self:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._loaded = False
        return cls._instance

    def load(self) -> None:
        if self._loaded:
            return
        self._load_catchments()
        self._load_geojson()
        self._load_frontend_data()
        self._load_events()
        self._load_profiles()
        self._load_model_selection()
        self._load_alert_tiers()
        self._load_action_tables()
        self._precompute()
        self._loaded = True

    def _load_catchments(self) -> None:
        self.catchments = pd.read_csv(DATA_DIR / "catchment_features.csv")
        self.catchments["inv_tc_min"] = 1.0 / self.catchments["tc_min"]
        bool_cols = ["populated", "cascade_watch", "borderline", "in_event_footprint"]
        for col in bool_cols:
            self.catchments[col] = self.catchments[col].astype(bool)

    def _load_geojson(self) -> None:
        with open(DATA_DIR / "catchments_risk.geojson", "r") as f:
            self.geojson = json.load(f)
        # Enrich feature properties with full attributes from catchment_features.csv (source of truth)
        df_records = self.catchments.set_index("catchment_id").to_dict(orient="index")
        for feat in self.geojson["features"]:
            cid = feat["properties"].get("catchment_id")
            if cid in df_records:
                feat["properties"].update(df_records[cid])
            if cid is not None:
                feat["id"] = int(cid)
        self.geojson_bytes: bytes | None = None

    def _load_frontend_data(self) -> None:
        with open(DATA_DIR / "frontend_data.json", "r") as f:
            self.frontend_data = json.load(f)

    def _load_events(self) -> None:
        self.events_all = pd.read_csv(DATA_DIR / "events_all.csv")
        self.events_town = pd.read_csv(DATA_DIR / "events_town_only.csv")

    def _load_profiles(self) -> None:
        self.archetype_profiles = pd.read_csv(DATA_DIR / "archetype_profiles.csv")

    def _load_model_selection(self) -> None:
        self.model_selection = pd.read_csv(DATA_DIR / "model_selection.csv")

    def _load_alert_tiers(self) -> None:
        self.alert_tiers = pd.read_csv(DATA_DIR / "alert_thresholds_by_tier.csv")

    def _load_action_tables(self) -> None:
        self.top50 = pd.read_csv(DATA_DIR / "top50_action_table.csv")
        self.action_summary = pd.read_csv(DATA_DIR / "action_summary.csv")

    def _precompute(self) -> None:
        df = self.catchments
        self.percentile_ranks: dict[str, pd.Series] = {}
        for feat in PERCENTILE_FEATURES:
            if feat in df.columns:
                self.percentile_ranks[feat] = df[feat].rank(pct=True)

        features_for_std = [
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
        ]
        cols = [c for c in features_for_std if c in df.columns]
        feat_matrix = df[cols].values.astype(np.float64)
        self.std_means = feat_matrix.mean(axis=0)
        self.std_stds = feat_matrix.std(axis=0)
        self.std_stds[self.std_stds == 0] = 1.0
        self.standardised = (feat_matrix - self.std_means) / self.std_stds
        self.std_cols = cols

        self.catchment_index = {
            int(row["catchment_id"]): idx for idx, row in df.iterrows()
        }


def get_store() -> DataStore:
    s = DataStore()
    if not s._loaded:
        s.load()
    return s
