"""Seed demo data through service interfaces only (no raw SQL).

Usage:
    cd backend && python seed.py            # local dev DB
    make seed                                # same, inside docker compose

Creates 12 users (3 timezones x 3 subject cohorts + spares), 3 groups of 4,
1 live session on the first group, and check-ins for two members.
Idempotent: re-runs skip rows that already exist.
"""

from fastapi import HTTPException

from app.modules.checkins import service as checkins
from app.modules.identity import service as identity
from app.modules.identity.models import User
from app.modules.identity.schemas import UserRegister
from app.modules.matching import service as matching
from app.modules.rooms import service as rooms
from app.shared.clock import SystemClock
from app.shared.db import Base, SessionLocal, engine

PASSWORD = "secret123"
TIMEZONES = ["UTC", "America/New_York", "Pacific/Kiritimati"]
COHORTS = [
    {"subject": "math", "goal": "exam"},
    {"subject": "physics", "goal": "lab"},
    {"subject": "biology", "goal": "field"},
]

clock = SystemClock()


def get_or_register(db, email: str, timezone: str, subjects: list, goals: list) -> User:
    try:
        identity.register(
            db,
            UserRegister(
                email=email, password=PASSWORD, timezone=timezone,
                subjects=subjects, goals=goals,
            ),
        )
    except HTTPException as e:
        if e.detail != "EmailTaken":
            raise
    user = db.query(User).filter_by(email=email).first()
    assert user is not None
    return user


def main() -> None:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        users = []
        for i, cohort in enumerate(COHORTS):
            for j in range(4):
                tz = TIMEZONES[(i + j) % len(TIMEZONES)]
                email = f"demo-{cohort['subject']}-{j}@x.com"
                users.append(
                    get_or_register(db, email, tz, [cohort["subject"]], [cohort["goal"]])
                )

        groups = []
        for i in range(3):
            cohort = users[i * 4:(i + 1) * 4]
            founder = cohort[0]
            db.refresh(founder)
            if founder.group_id is None:
                gid = matching.propose_group(db, founder)["id"]
            else:
                gid = founder.group_id
            for member in cohort[1:]:
                db.refresh(member)
                if member.group_id is None:
                    matching.join_group(db, member, gid)
            print(f"group #{gid}: {[u.email for u in cohort]}")
            groups.append(gid)

        first = groups[0]
        existing = (
            db.query(rooms.RoomSession)
            .filter_by(group_id=first, status="live")
            .first()
        )
        if existing is None:
            founder = db.query(User).filter_by(group_id=first).first()
            session = rooms.start_session(db, founder, first, 1500)
        else:
            session = existing
        print(f"live session #{session.id} on group #{first}")

        members = matching.group_members(db, first)
        for member in members[:2]:
            today = clock.today(member.timezone)
            try:
                checkins.promise_today(db, member, "seeded focus block", today)
            except HTTPException as e:
                assert e.detail == "AlreadyPromised", e.detail
            checkins.complete_today(db, member, today, clock)
            print(f"{member.email}: streak={checkins.get_streak(db, member, clock)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
