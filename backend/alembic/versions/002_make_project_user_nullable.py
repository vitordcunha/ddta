"""Allow projects without user ownership.

Revision ID: 002_make_project_user_nullable
Revises: 001_initial_schema
Create Date: 2026-04-24 00:00:01
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "002_make_project_user_nullable"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("projects", "user_id", existing_type=sa.UUID(), nullable=True)


def downgrade() -> None:
    op.alter_column("projects", "user_id", existing_type=sa.UUID(), nullable=False)
