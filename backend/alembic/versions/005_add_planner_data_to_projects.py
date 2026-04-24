"""Add planner_data JSONB to projects for full UI flight plan snapshot.

Revision ID: 005_add_planner_data
Revises: 004_remove_users
Create Date: 2026-04-24
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "005_add_planner_data"
down_revision = "004_remove_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("planner_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "planner_data")
