"""Summary endpoint: KPI counts."""

from fastapi import APIRouter

from app.data_loader import get_store
from app.models import SummaryResponse

router = APIRouter(prefix="/api", tags=["summary"])


@router.get("/summary", response_model=SummaryResponse)
def get_summary() -> SummaryResponse:
    store = get_store()
    df = store.catchments
    priority_counts = df["priority"].value_counts().to_dict()
    regime_counts = df["regime"].value_counts().to_dict()
    p12_mask = df["priority"].isin(["P1 Critical", "P2 High"])
    population_p12 = float(df.loc[p12_mask, "pop_total"].sum())
    n_cascade = int(df["cascade_watch"].sum())
    return SummaryResponse(
        n_catchments=len(df),
        priority_counts=priority_counts,
        n_cascade_watch=n_cascade,
        n_emerging=0,
        population_p12=population_p12,
        regime_counts=regime_counts,
        n_events_all=len(store.events_all),
        n_events_town=len(store.events_town),
    )
