"""Add processing task identifiers to projects.

Revision ID: 003_add_processing_task_fields
Revises: 002_make_project_user_nullable
Create Date: 2026-04-24 00:00:02
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "003_add_processing_task_fields"
down_revision = "002_make_project_user_nullable"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("processing_task_uuid", sa.String(length=100), nullable=True))
    op.add_column("projects", sa.Column("odm_task_uuid", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "odm_task_uuid")
    op.drop_column("projects", "processing_task_uuid")
