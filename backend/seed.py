"""Seed demo data through service interfaces only (no raw SQL).

Usage:
    cd backend && python seed.py            # local dev DB (DATABASE_URL)
    make seed                                # same, inside docker compose

Creates 12 users (3 subject cohorts x 4, rotating over 3 timezones),
3 groups, 1 live session on the first group, and check-ins for two members.
The third group keeps one seat open so a newcomer can join a real group
during the demo instead of stranding in a solo queue.

Idempotent: re-runs skip rows that already exist.
"""

from alembic.config import Config
from alembic import command

from app.modules.checkins import service as checkins
from app.modules.identity import service as identity
from app.modules.identity.models import User
from app.modules.identity.schemas import UserRegister
from app.modules.matching import service as matching
from app.modules.rooms import service as rooms
from app.shared.clock import SystemClock
from app.shared.db import SessionLocal
from app.shared.errors import AlreadyPromised, EmailTaken

PASSWORD = "secret123"
TIMEZONES = ["UTC", "America/New_York", "Pacific/Kiritimati"]
COHORTS = [
    {"subject": "math", "goal": "exam"},
    {"subject": "physics", "goal": "lab"},
    {"subject": "biology", "goal": "field"},
]
# Cohort sizes: the last group keeps one seat open for demo newcomers.
COHORT_SIZES = [4, 4, 3]

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
    except EmailTaken:
        pass
    user = db.query(User).filter_by(email=email).first()
    assert user is not None
    return user


def main() -> None:
    command.upgrade(Config("alembic.ini"), "head")
    db = SessionLocal()
    try:
        cohorts = []
        for i, cohort in enumerate(COHORTS):
            members = []
            for j in range(4):
                tz = TIMEZONES[(i + j) % len(TIMEZONES)]
                email = f"demo-{cohort['subject']}-{j}@x.com"
                members.append(
                    get_or_register(db, email, tz, [cohort["subject"]], [cohort["goal"]])
                )
            cohorts.append(members)

        group_ids = []
        for i, members in enumerate(cohorts):
            founder = members[0]
            db.refresh(founder)
            gid = matching.member_group_id(db, founder.id)
            if gid is None:
                gid = matching.propose_group(db, founder)["id"]
            for member in members[1:COHORT_SIZES[i]]:
                db.refresh(member)
                if matching.member_group_id(db, member.id) is None:
                    matching.join_group(db, member, gid)
            group_ids.append(gid)
            placed = [m.email for m in matching.group_members(db, gid)]
            print(f"group #{gid}: {placed}")

        first = group_ids[0]
        session = rooms.live_session_for_group(db, first)
        if session is None:
            founder = matching.group_members(db, first)[0]
            session = rooms.start_session(db, founder, first, 1500)
        print(f"live session #{session.id} on group #{first}")

        members = matching.group_members(db, first)
        for member in members[:2]:
            today = clock.today(member.timezone)
            try:
                checkins.promise_today(db, member, "seeded focus block", today)
            except AlreadyPromised:
                pass
            checkins.complete_today(db, member, today, clock)
            print(f"{member.email}: streak={checkins.get_streak(db, member, clock)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
