from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User
from app.db.repositories.user_repository import UserRepository
from app.db.session import get_db
from app.utils.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
user_repository = UserRepository()


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_error

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_error

    try:
        parsed_user_id = UUID(user_id)
    except ValueError as exc:
        raise credentials_error from exc

    user = await user_repository.get(db, parsed_user_id)
    if user is None:
        raise credentials_error
    return user


__all__ = ["get_db", "get_current_user"]
