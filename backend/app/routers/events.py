"""Events endpoint: event points for the map."""

from fastapi import APIRouter

from app.data_loader import get_store
from app.models import EventPoint, EventsResponse

router = APIRouter(prefix="/api", tags=["events"])


@router.get("/events", response_model=EventsResponse)
def get_events() -> EventsResponse:
    store = get_store()
    events_all = [
        EventPoint(
            lat=float(r["lat"]),
            lon=float(r["lon"]),
            date=str(r["date"]),
            location=str(r["location"]),
            precision=str(r["precision"]),
        )
        for _, r in store.events_all.iterrows()
    ]
    events_town = [
        EventPoint(
            lat=float(r["lat"]),
            lon=float(r["lon"]),
            date=str(r["date"]),
            location=str(r["location"]),
            precision=str(r["precision"]),
        )
        for _, r in store.events_town.iterrows()
    ]
    return EventsResponse(events_all=events_all, events_town=events_town)
