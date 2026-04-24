from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

ModelType = TypeVar("ModelType")


class BaseRepository(Generic[ModelType]):
    def __init__(self, model: type[ModelType]) -> None:
        self.model = model

    async def get(self, db: AsyncSession, item_id: UUID) -> ModelType | None:
        result = await db.execute(select(self.model).where(self.model.id == item_id))
        return result.scalar_one_or_none()
