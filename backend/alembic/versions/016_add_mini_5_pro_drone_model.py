"""Insert DJI Mini 5 Pro into drone_models if missing (post-015 DBs)."""

from __future__ import annotations

import math
import uuid

import sqlalchemy as sa
from alembic import op

revision = "016_add_mini_5_pro_drone_model"
down_revision = "015_drone_models"
branch_labels = None
depends_on = None


def _fov(sw: float, sh: float, fl: float) -> tuple[float, float]:
    h = math.degrees(2 * math.atan(sw / (2 * fl)))
    v = math.degrees(2 * math.atan(sh / (2 * fl)))
    return h, v


def upgrade() -> None:
    conn = op.get_bind()
    exists = conn.execute(
        sa.text("SELECT 1 FROM drone_models WHERE name = :n AND workspace_id IS NULL LIMIT 1"),
        {"n": "Mini 5 Pro"},
    ).scalar()
    if exists:
        return

    sw, sh, fl = 13.2, 8.8, 7.33
    fh, fv = _fov(sw, sh, fl)
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
    op.bulk_insert(
        drone_models,
        [
            {
                "id": uuid.uuid4(),
                "name": "Mini 5 Pro",
                "manufacturer": "DJI",
                "is_default": False,
                "is_custom": False,
                "workspace_id": None,
                "sensor_width_mm": sw,
                "sensor_height_mm": sh,
                "focal_length_mm": fl,
                "image_width_px": 8192,
                "image_height_px": 6144,
                "fov_horizontal_deg": fh,
                "fov_vertical_deg": fv,
                "gimbal_pitch_min": -90.0,
                "gimbal_pitch_max": 30.0,
                "max_speed_ms": 18.0,
                "max_altitude_m": 500.0,
            }
        ],
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM drone_models WHERE name = 'Mini 5 Pro' "
            "AND is_custom = false AND workspace_id IS NULL"
        )
    )
