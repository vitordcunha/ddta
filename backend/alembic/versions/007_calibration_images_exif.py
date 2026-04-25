"""Calibration images + EXIF report (Fase 3).

Revision ID: 007_calibration_images_exif
Revises: 006_calibration_sessions
Create Date: 2026-04-24
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "007_calibration_images_exif"
down_revision = "006_calibration_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "calibration_sessions",
        sa.Column("exif_report", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_table(
        "calibration_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("filename", sa.String(length=512), nullable=False),
        sa.Column("storage_key", sa.String(length=1024), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("exif", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["calibration_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_calibration_images_session_id", "calibration_images", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_calibration_images_session_id", table_name="calibration_images")
    op.drop_table("calibration_images")
    op.drop_column("calibration_sessions", "exif_report")
