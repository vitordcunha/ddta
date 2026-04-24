from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.project import Project
from app.db.repositories.base import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    def __init__(self) -> None:
        super().__init__(Project)

    async def list_all(self, db: AsyncSession) -> list[Project]:
        result = await db.execute(select(Project).order_by(Project.created_at.desc()))
        return list(result.scalars().all())

    async def get_with_images(self, db: AsyncSession, project_id: UUID) -> Project | None:
        result = await db.execute(
            select(Project)
            .options(selectinload(Project.images))
            .where(Project.id == project_id)
        )
        return result.scalar_one_or_none()

    async def create(self, db: AsyncSession, **data) -> Project:
        project = Project(**data)
        db.add(project)
        await db.commit()
        await db.refresh(project)
        return project

    async def update(self, db: AsyncSession, project: Project, **data) -> Project:
        for key, value in data.items():
            setattr(project, key, value)
        await db.commit()
        await db.refresh(project)
        return project

    async def delete(self, db: AsyncSession, project: Project) -> None:
        await db.delete(project)
        await db.commit()

    async def update_status(
        self, db: AsyncSession, project_id: UUID, status: str, progress: int
    ) -> Project | None:
        project = await self.get(db, project_id)
        if not project:
            return None
        project.status = status
        project.progress = progress
        await db.commit()
        await db.refresh(project)
        return project

    async def update_assets(self, db: AsyncSession, project_id: UUID, assets: dict) -> Project | None:
        project = await self.get(db, project_id)
        if not project:
            return None
        project.assets = assets
        await db.commit()
        await db.refresh(project)
        return project
