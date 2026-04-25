"""Calibration sessions for short calibration flights (planner Fase 2).

Revision ID: 006_calibration_sessions
Revises: 005_add_planner_data
Create Date: 2026-04-24
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "006_calibration_sessions"
down_revision = "005_add_planner_data"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "calibration_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("params_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("polygon_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_calibration_sessions_project_id", "calibration_sessions", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_calibration_sessions_project_id", table_name="calibration_sessions")
    op.drop_table("calibration_sessions")
