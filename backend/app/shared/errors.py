from fastapi import HTTPException, status


def not_found(detail: str = "NotFound") -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, detail)


def not_found_error(detail: str = "NotFound"):
    raise not_found(detail)


def conflict(detail: str = "Conflict"):
    raise HTTPException(status.HTTP_409_CONFLICT, detail)


def unauthorized(detail: str = "Unauthorized"):
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail)
