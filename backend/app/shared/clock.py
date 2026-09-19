from datetime import date, datetime
from typing import Protocol
from zoneinfo import ZoneInfo


class Clock(Protocol):
    def today(self, tz: str) -> date: ...


class SystemClock:
    def today(self, tz: str) -> date:
        return datetime.now(ZoneInfo(tz)).date()


class FakeClock:
    """Pinned clock for tests: `today()` ignores tz and returns the fixed date."""

    def __init__(self, fixed: datetime | date):
        self.fixed = fixed.date() if isinstance(fixed, datetime) else fixed

    def today(self, tz: str) -> date:
        return self.fixed
