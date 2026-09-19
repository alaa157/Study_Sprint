"""Domain errors: one mapping point from service failure to HTTP status.

Services raise these; FastAPI handlers in app.main translate them to
`{"detail": ...}` responses. Anything else escaping (e.g. SQLAlchemyError)
becomes a generic 500 that never leaks internals.
"""


class DomainError(Exception):
    status_code: int = 500
    detail: str = "InternalError"


class EmailTaken(DomainError):
    status_code = 409
    detail = "EmailTaken"


class BadCredentials(DomainError):
    status_code = 401
    detail = "BadCredentials"


class BadToken(DomainError):
    status_code = 401
    detail = "BadToken"


class GroupNotFound(DomainError):
    status_code = 404
    detail = "GroupNotFound"


class GroupFull(DomainError):
    status_code = 409
    detail = "GroupFull"


class QuorumNotMet(DomainError):
    status_code = 409
    detail = "QuorumNotMet"


class NotGroupMember(DomainError):
    status_code = 403
    detail = "NotGroupMember"


class AlreadyPromised(DomainError):
    status_code = 409
    detail = "AlreadyPromised"


class PromiseNotFound(DomainError):
    status_code = 404
    detail = "PromiseNotFound"


class FutureDate(DomainError):
    status_code = 400
    detail = "FutureDate"


def not_found_error(detail: str = "NotFound"):
    """Legacy helper kept for compatibility; prefer DomainError subclasses."""
    from fastapi import HTTPException, status

    raise HTTPException(status.HTTP_404_NOT_FOUND, detail)
