"""Remove auth: drop users table and project user_id.

Revision ID: 004_remove_users
Revises: 003_add_processing_task_fields
Create Date: 2026-04-24 12:00:00
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "004_remove_users"
down_revision = "003_add_processing_task_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for fk in inspector.get_foreign_keys("projects"):
        if fk.get("referred_table") == "users" and fk.get("constrained_columns") == ["user_id"]:
            op.drop_constraint(fk["name"], "projects", type_="foreignkey")
            break
    op.drop_column("projects", "user_id")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")


def downgrade() -> None:
    dt = sa.DateTime(timezone=True)
    now = sa.text("now()")
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", dt, server_default=now, nullable=False),
        sa.Column("updated_at", dt, server_default=now, nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    uid = postgresql.UUID(as_uuid=True)
    op.add_column("projects", sa.Column("user_id", uid, nullable=True))
    op.create_foreign_key(
        "projects_user_id_fkey",
        "projects",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
