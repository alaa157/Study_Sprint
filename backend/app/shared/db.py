import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://studysprint:studysprint@localhost:5432/studysprint",
)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Register Base subclasses so metadata/create_all and Alembic see all tables.
# Bottom import is intentional: models import Base from this module.
from app.modules.identity import models as _identity_models  # noqa: E402,F401
from app.modules.matching import models as _matching_models  # noqa: E402,F401
from app.modules.rooms import models as _rooms_models  # noqa: E402,F401
from app.modules.rooms import presence as _rooms_presence  # noqa: E402,F401
from app.modules.checkins import models as _checkins_models  # noqa: E402,F401