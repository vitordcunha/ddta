"""Drone models table (parametrized + seed)."""

from __future__ import annotations

import math
import uuid

import sqlalchemy as sa
from alembic import op

revision = "015_drone_models"
down_revision = "014_workspace_map_api_keys"
branch_labels = None
depends_on = None


def _fov(sw: float, sh: float, fl: float) -> tuple[float, float]:
    h = math.degrees(2 * math.atan(sw / (2 * fl)))
    v = math.degrees(2 * math.atan(sh / (2 * fl)))
    return h, v


def upgrade() -> None:
    op.create_table(
        "drone_models",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("manufacturer", sa.String(length=128), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_custom", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("workspace_id", sa.String(length=128), nullable=True),
        sa.Column("sensor_width_mm", sa.Float(), nullable=False),
        sa.Column("sensor_height_mm", sa.Float(), nullable=False),
        sa.Column("focal_length_mm", sa.Float(), nullable=False),
        sa.Column("image_width_px", sa.Integer(), nullable=False),
        sa.Column("image_height_px", sa.Integer(), nullable=False),
        sa.Column("fov_horizontal_deg", sa.Float(), nullable=False),
        sa.Column("fov_vertical_deg", sa.Float(), nullable=False),
        sa.Column("gimbal_pitch_min", sa.Float(), nullable=False, server_default="-90"),
        sa.Column("gimbal_pitch_max", sa.Float(), nullable=False, server_default="30"),
        sa.Column("max_speed_ms", sa.Float(), nullable=False),
        sa.Column("max_altitude_m", sa.Float(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_drone_models_workspace_id", "drone_models", ["workspace_id"], unique=False)

    rows: list[dict] = [
        {
            "name": "Mavic 3",
            "manufacturer": "DJI",
            "is_default": True,
            "sw": 17.3,
            "sh": 13.0,
            "fl": 12.29,
            "iw": 5280,
            "ih": 3956,
            "max_speed": 21.0,
            "max_alt": 500.0,
        },
        {
            "name": "Air 2S",
            "manufacturer": "DJI",
            "is_default": False,
            "sw": 13.2,
            "sh": 8.8,
            "fl": 8.38,
            "iw": 5472,
            "ih": 3648,
            "max_speed": 19.0,
            "max_alt": 500.0,
        },
        {
            "name": "Mini 4 Pro",
            "manufacturer": "DJI",
            "is_default": False,
            "sw": 9.6,
            "sh": 7.2,
            "fl": 6.7,
            "iw": 4032,
            "ih": 3024,
            "max_speed": 16.0,
            "max_alt": 500.0,
        },
        {
            "name": "Mini 5 Pro",
            "manufacturer": "DJI",
            "is_default": False,
            "sw": 13.2,
            "sh": 8.8,
            "fl": 7.33,
            "iw": 8192,
            "ih": 6144,
            "max_speed": 18.0,
            "max_alt": 500.0,
        },
        {
            "name": "Phantom 4 Pro",
            "manufacturer": "DJI",
            "is_default": False,
            "sw": 13.2,
            "sh": 8.8,
            "fl": 8.8,
            "iw": 5472,
            "ih": 3648,
            "max_speed": 20.0,
            "max_alt": 500.0,
        },
        {
            "name": "M300 RTK",
            "manufacturer": "DJI",
            "is_default": False,
            "sw": 13.2,
            "sh": 8.8,
            "fl": 8.4,
            "iw": 5472,
            "ih": 3648,
            "max_speed": 17.0,
            "max_alt": 500.0,
        },
    ]

    drone_models = sa.table(
        "drone_models",
        sa.column("id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("name", sa.String),
        sa.column("manufacturer", sa.String),
        sa.column("is_default", sa.Boolean),
        sa.column("is_custom", sa.Boolean),
        sa.column("workspace_id", sa.String),
        sa.column("sensor_width_mm", sa.Float),
        sa.column("sensor_height_mm", sa.Float),
        sa.column("focal_length_mm", sa.Float),
        sa.column("image_width_px", sa.Integer),
        sa.column("image_height_px", sa.Integer),
        sa.column("fov_horizontal_deg", sa.Float),
        sa.column("fov_vertical_deg", sa.Float),
        sa.column("gimbal_pitch_min", sa.Float),
        sa.column("gimbal_pitch_max", sa.Float),
        sa.column("max_speed_ms", sa.Float),
        sa.column("max_altitude_m", sa.Float),
    )

    batch = []
    for r in rows:
        fh, fv = _fov(r["sw"], r["sh"], r["fl"])
        batch.append(
            {
                "id": uuid.uuid4(),
                "name": r["name"],
                "manufacturer": r["manufacturer"],
                "is_default": r["is_default"],
                "is_custom": False,
                "workspace_id": None,
                "sensor_width_mm": r["sw"],
                "sensor_height_mm": r["sh"],
                "focal_length_mm": r["fl"],
                "image_width_px": r["iw"],
                "image_height_px": r["ih"],
                "fov_horizontal_deg": fh,
                "fov_vertical_deg": fv,
                "gimbal_pitch_min": -90.0,
                "gimbal_pitch_max": 30.0,
                "max_speed_ms": r["max_speed"],
                "max_altitude_m": r["max_alt"],
            }
        )
    op.bulk_insert(drone_models, batch)


def downgrade() -> None:
    op.drop_index("ix_drone_models_workspace_id", table_name="drone_models")
    op.drop_table("drone_models")
