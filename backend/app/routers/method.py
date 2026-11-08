"""Data & Method endpoint."""

from fastapi import APIRouter

from app.data_loader import get_store
from app.models import MethodResponse, ModelRow

router = APIRouter(prefix="/api", tags=["method"])

FEATURES = [
    "slope_p90 – 90th percentile of slope (deg)",
    "melton – Melton ruggedness number",
    "drainage_density – channel length per unit area (km/km²)",
    "tc_min – time of concentration, Kirpich (min)",
    "p99_wetday – 99th percentile of wet-day rainfall (mm/day)",
    "max3d – mean annual max 3-day rainfall (mm)",
    "heavy_days – days per year above 64.5 mm",
    "jjas_share – monsoon share of annual rainfall",
    "frac_above_4500 – fraction of area above 4,500 m",
    "pop_total – estimated population (WorldPop 2017)",
    "pop_near_channel – population within ~500 m of channel",
    "exposure_index – mean percentile of pop_total and pop_near_channel",
]

PIPELINE_STEPS = [
    "DEM processing: SRTM 90 m, resampled to ~257 m, D8 flow routing",
    "Catchment delineation: ≥ 10 km², mean elevation ≥ 500 m",
    "Feature extraction: terrain (slope, Melton, drainage density, Tc), rainfall (IMD 0.25° daily), exposure (WorldPop 1 km)",
    "Standardisation: z-score of 12 features",
    "Clustering: Gaussian Mixture Model, K = 5, ordered by mean hazard index → Regimes R1–R5",
    "Hazard index: 0.5 × response group + 0.5 × rainfall group (percentile-ranked features)",
    "Priority scoring: hazard_index × exposure_index",
    "Priority classification: belt 500–3,500 m, P1 top 5%, P2 next 5%, P3 70th–90th pct, cascade watch outside belt",
    "Validation: AUC against 122 recorded events, bootstrap 95% CI",
]

DATA_SOURCES = [
    {
        "name": "DEM (Digital Elevation Model)",
        "source": "NASA SRTM 90 m, resampled to ~257 m D8 flow routing grid",
        "coverage": "Uttarakhand + Himachal Pradesh (lat 28.5–33.5°N, lon 75.5–81.0°E)",
    },
    {
        "name": "Rainfall (Daily Gridded)",
        "source": "India Meteorological Department (IMD) 0.25° × 0.25° daily gridded precipitation",
        "coverage": "2015–2025 (11 years), nearest-neighbour association within 0.3°",
    },
    {
        "name": "Population (Exposure)",
        "source": "WorldPop India 1 km resolution, UN-adjusted",
        "coverage": "2017 baseline (total population and channel proximity ≤500 m)",
    },
    {
        "name": "Recorded Flood Events",
        "source": "Published disaster reports and state emergency records (122 events)",
        "coverage": "Uttarakhand 1970–2025 (40 town-level, 82 approx 5 km). HP unverified (0 supplied event records).",
    },
]

SCOPE_FACTS = [
    "Catchments analysed: 3,067 micro-catchments (area ≥ 10 km², mean elevation ≥ 500 m)",
    "Study area: Uttarakhand and Himachal Pradesh, Western Himalaya (lat 28.5–33.5°N, lon 75.5–81.0°E)",
    "Populated belt: 500–3,500 m elevation band containing rain-fed human settlements",
    "Cascade watch zone: Outside populated belt with >50% glacial/periglacial area (>4,500 m)",
    "Rainfall extremes: IMD 0.25° daily (2015–2025), heavy rain threshold >64.5 mm/d, IMD orange = 115.6 mm/d",
    "Historical flood events: 122 records in Uttarakhand (1970–2025); footprint lat 29.2–31.1°N, lon 77.9–80.7°E",
    "Validation limitation: Event records exist only for Uttarakhand. Himachal Pradesh is unverified against historical events.",
]


@router.get("/method", response_model=MethodResponse)
def get_method() -> MethodResponse:
    store = get_store()
    ms = store.model_selection
    rows = [
        ModelRow(
            model=str(r["model"]),
            k=int(r["k"]),
            sil=float(r["sil"]),
            db=float(r["db"]),
            bic=float(r["bic"])
            if not (isinstance(r["bic"], float) and r["bic"] != r["bic"])
            else None,
            stability=float(r["stability"]),
            min_size=int(r["min_size"]),
            ARI_vs_ward=float(r["ARI_vs_ward"]),
        )
        for _, r in ms.iterrows()
    ]
    return MethodResponse(
        model_selection=rows,
        features=FEATURES,
        pipeline_steps=PIPELINE_STEPS,
        data_sources=DATA_SOURCES,
        scope_facts=SCOPE_FACTS,
    )
