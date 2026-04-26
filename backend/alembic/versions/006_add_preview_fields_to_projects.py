"""Add preview and sparse cloud fields to projects.

Revision ID: 006_add_preview_fields
Revises: 005_add_planner_data
Create Date: 2026-04-25
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "006_add_preview_fields"
down_revision = "005_add_planner_data"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("preview_task_uuid", sa.String(100), nullable=True))
    op.add_column("projects", sa.Column("preview_odm_task_uuid", sa.String(100), nullable=True))
    op.add_column("projects", sa.Column("preview_status", sa.String(50), nullable=True))
    op.add_column("projects", sa.Column("preview_progress", sa.Integer(), nullable=False, server_default="0"))
    op.add_column(
        "projects",
        sa.Column("preview_assets", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("projects", sa.Column("sparse_cloud_path", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "sparse_cloud_path")
    op.drop_column("projects", "preview_assets")
    op.drop_column("projects", "preview_progress")
    op.drop_column("projects", "preview_status")
    op.drop_column("projects", "preview_odm_task_uuid")
    op.drop_column("projects", "preview_task_uuid")
