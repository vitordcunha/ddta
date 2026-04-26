from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base


class WorkspaceMapApiKeys(Base):
    """Chaves de APIs de mapas por workspace (header X-Workspace-Id)."""

    __tablename__ = "workspace_map_api_keys"

    workspace_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    mapbox_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_maps_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
