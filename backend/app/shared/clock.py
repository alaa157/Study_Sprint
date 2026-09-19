from datetime import date, datetime, time, timezone
from typing import Protocol
from zoneinfo import ZoneInfo


class Clock(Protocol):
    def today(self, tz: str) -> date: ...


class SystemClock:
    def today(self, tz: str) -> date:
        return datetime.now(ZoneInfo(tz)).date()


class FakeClock:
    """Pinned clock for tests: `today(tz)` converts the fixed instant to `tz`.

    Unlike a bare fixed date, this exercises real tz conversion, so a test
    can pin a UTC instant where two zones disagree on the calendar date.
    """

    def __init__(self, fixed: datetime | date):
        if isinstance(fixed, datetime):
            instant = fixed
        else:
            instant = datetime.combine(fixed, time.min)
        self.instant = (
            instant if instant.tzinfo is not None else instant.replace(tzinfo=timezone.utc)
        )

    def today(self, tz: str) -> date:
        return self.instant.astimezone(ZoneInfo(tz)).date()
