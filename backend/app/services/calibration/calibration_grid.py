"""Theoretical photo grid over a calibration polygon (Fase 2) and GPS→slot matching (Fase 3)."""

from __future__ import annotations

import math
import uuid
from typing import Any

from pyproj import CRS, Transformer
from shapely.geometry import Point, Polygon, mapping, shape
from shapely.ops import transform as shapely_transform

# Mirrors frontend `droneSpecs` / presets (sensor mm, focal mm).
DRONE_SENSOR_DB: dict[str, dict[str, float]] = {
    "Mini 4 Pro": {"sensor_w_mm": 9.6, "sensor_h_mm": 7.2, "focal_length_mm": 6.72},
    "Mini 5 Pro": {"sensor_w_mm": 13.2, "sensor_h_mm": 8.8, "focal_length_mm": 7.33},
    "Air 3": {"sensor_w_mm": 9.6, "sensor_h_mm": 7.2, "focal_length_mm": 6.7},
    "Air 2S": {"sensor_w_mm": 13.2, "sensor_h_mm": 8.8, "focal_length_mm": 8.38},
    "Mavic 3": {"sensor_w_mm": 17.3, "sensor_h_mm": 13.0, "focal_length_mm": 12.3},
    "Phantom 4": {"sensor_w_mm": 13.2, "sensor_h_mm": 8.8, "focal_length_mm": 8.8},
    "Phantom 4 Pro": {"sensor_w_mm": 13.2, "sensor_h_mm": 8.8, "focal_length_mm": 8.8},
    "M300 RTK": {"sensor_w_mm": 13.2, "sensor_h_mm": 8.8, "focal_length_mm": 8.4},
}


def _utm_epsg(lon: float, lat: float) -> int:
    zone = int((lon + 180) // 6) + 1
    zone = min(60, max(1, zone))
    base = 32600 if lat >= 0 else 32700
    return base + zone


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def _polygon_from_geojson(data: dict[str, Any]) -> Polygon | None:
    g: dict[str, Any] = data
    if data.get("type") == "Feature":
        g = data.get("geometry") or {}
    if not g or g.get("type") != "Polygon":
        return None
    try:
        poly = shape(g)
        if not isinstance(poly, Polygon) or poly.is_empty:
            return None
        return poly
    except Exception:
        return None


def _sensor_from_params(params: dict[str, Any]) -> tuple[float, float, float]:
    """Prioriza snapshot explícito (Fase 9); senão legado por nome de modelo."""
    sw = params.get("sensorWidthMm")
    sh = params.get("sensorHeightMm")
    fl = params.get("focalLengthMm")
    try:
        if sw is not None and sh is not None and fl is not None:
            return float(sw), float(sh), float(fl)
    except (TypeError, ValueError):
        pass
    model = str(params.get("droneModel") or "")
    spec = DRONE_SENSOR_DB.get(model)
    if spec:
        return spec["sensor_w_mm"], spec["sensor_h_mm"], spec["focal_length_mm"]
    # Reasonable default (1" class wide camera)
    return 13.2, 8.8, 8.8


def compute_theoretical_grid(
    polygon_geojson: dict[str, Any],
    params_snapshot: dict[str, Any],
) -> dict[str, Any]:
    """
    Build a rotated slot grid in WGS84.

    Returns a JSON-serializable dict:
      version, tolerance_m, footprint_w_m, footprint_h_m, rotation_deg, slots[], utm_epsg
    """
    poly_ll = _polygon_from_geojson(polygon_geojson)
    if poly_ll is None:
        return {
            "version": 1,
            "tolerance_m": 0.0,
            "footprint_w_m": 0.0,
            "footprint_h_m": 0.0,
            "rotation_deg": 0.0,
            "utm_epsg": None,
            "slots": [],
            "error": "invalid_polygon_geojson",
        }

    c = poly_ll.centroid
    lon0, lat0 = float(c.x), float(c.y)
    epsg = _utm_epsg(lon0, lat0)
    wgs = CRS.from_epsg(4326)
    utm = CRS.from_epsg(epsg)
    to_utm = Transformer.from_crs(wgs, utm, always_xy=True)
    to_wgs = Transformer.from_crs(utm, wgs, always_xy=True)

    def ll_to_utm(poly: Polygon) -> Polygon:
        return shapely_transform(lambda x, y, z=None: to_utm.transform(x, y), poly)

    def utm_to_ll(poly: Polygon) -> Polygon:
        return shapely_transform(lambda x, y, z=None: to_wgs.transform(x, y), poly)

    poly_utm = ll_to_utm(poly_ll)
    if poly_utm.is_empty or not poly_utm.is_valid:
        poly_utm = poly_utm.buffer(0)

    alt_m = float(params_snapshot.get("altitudeM") or params_snapshot.get("altitude_m") or 80.0)
    alt_m = max(5.0, alt_m)
    fwd = float(params_snapshot.get("forwardOverlap") or params_snapshot.get("forward_overlap") or 0.7)
    side = float(params_snapshot.get("sideOverlap") or params_snapshot.get("side_overlap") or 0.6)
    fwd = min(0.95, max(0.05, fwd))
    side = min(0.95, max(0.05, side))
    rot_deg = float(params_snapshot.get("rotationDeg") or params_snapshot.get("rotation_deg") or 0.0)
    rot = math.radians(rot_deg)

    sw, sh, fl = _sensor_from_params(params_snapshot)
    fl = max(0.1, fl)
    footprint_w_m = (sw / fl) * alt_m
    footprint_h_m = (sh / fl) * alt_m
    step_along = footprint_h_m * (1.0 - fwd)
    step_cross = footprint_w_m * (1.0 - side)
    step_along = max(footprint_h_m * 0.08, step_along)
    step_cross = max(footprint_w_m * 0.08, step_cross)

    tolerance_m = min(footprint_w_m, footprint_h_m) * 0.5

    ox, oy = poly_utm.centroid.x, poly_utm.centroid.y
    sin_r, cos_r = math.sin(rot), math.cos(rot)
    # Along-track = flight direction; cross-track perpendicular (CCW from along in EN plane).
    u_along = (sin_r, cos_r)
    u_cross = (-cos_r, sin_r)

    def to_st(x: float, y: float) -> tuple[float, float]:
        dx, dy = x - ox, y - oy
        s = dx * u_along[0] + dy * u_along[1]
        t = dx * u_cross[0] + dy * u_cross[1]
        return s, t

    coords = list(poly_utm.exterior.coords)
    sts = [to_st(x, y) for x, y in coords]
    s_vals = [p[0] for p in sts]
    t_vals = [p[1] for p in sts]
    s_min, s_max = min(s_vals), max(s_vals)
    t_min, t_max = min(t_vals), max(t_vals)
    pad_s = footprint_h_m * 0.5 + step_along * 0.25
    pad_t = footprint_w_m * 0.5 + step_cross * 0.25
    s_min -= pad_s
    s_max += pad_s
    t_min -= pad_t
    t_max += pad_t

    slots: list[dict[str, Any]] = []
    row_idx = 0
    s = s_min + footprint_h_m / 2.0
    while s <= s_max + 1e-6:
        col_idx = 0
        t = t_min + footprint_w_m / 2.0
        while t <= t_max + 1e-6:
            cx = ox + s * u_along[0] + t * u_cross[0]
            cy = oy + s * u_along[1] + t * u_cross[1]
            center_pt = Point(cx, cy)
            if poly_utm.intersects(center_pt.buffer(0.25)):
                hw, hh = footprint_w_m / 2.0, footprint_h_m / 2.0
                corners = [
                    (cx - hh * u_along[0] - hw * u_cross[0], cy - hh * u_along[1] - hw * u_cross[1]),
                    (cx + hh * u_along[0] - hw * u_cross[0], cy + hh * u_along[1] - hw * u_cross[1]),
                    (cx + hh * u_along[0] + hw * u_cross[0], cy + hh * u_along[1] + hw * u_cross[1]),
                    (cx - hh * u_along[0] + hw * u_cross[0], cy - hh * u_along[1] + hw * u_cross[1]),
                    (cx - hh * u_along[0] - hw * u_cross[0], cy - hh * u_along[1] - hw * u_cross[1]),
                ]
                foot_utm = Polygon(corners)
                foot_ll = utm_to_ll(foot_utm)
                cll = utm_to_ll(center_pt)
                slot_id = str(uuid.uuid4())
                slots.append(
                    {
                        "id": slot_id,
                        "row": row_idx,
                        "col": col_idx,
                        "center_lat": float(cll.y),
                        "center_lon": float(cll.x),
                        "footprint_polygon": mapping(foot_ll),
                        "status": "empty",
                        "primary_image_id": None,
                    }
                )
            t += step_cross
            col_idx += 1
        s += step_along
        row_idx += 1

    if not slots:
        # Fallback: single slot at centroid
        hw, hh = footprint_w_m / 2.0, footprint_h_m / 2.0
        cx, cy = ox, oy
        corners = [
            (cx - hh * u_along[0] - hw * u_cross[0], cy - hh * u_along[1] - hw * u_cross[1]),
            (cx + hh * u_along[0] - hw * u_cross[0], cy + hh * u_along[1] - hw * u_cross[1]),
            (cx + hh * u_along[0] + hw * u_cross[0], cy + hh * u_along[1] + hw * u_cross[1]),
            (cx - hh * u_along[0] + hw * u_cross[0], cy - hh * u_along[1] + hw * u_cross[1]),
            (cx - hh * u_along[0] - hw * u_cross[0], cy - hh * u_along[1] - hw * u_cross[1]),
        ]
        foot_utm = Polygon(corners)
        foot_ll = utm_to_ll(foot_utm)
        cll = utm_to_ll(Point(cx, cy))
        slots.append(
            {
                "id": str(uuid.uuid4()),
                "row": 0,
                "col": 0,
                "center_lat": float(cll.y),
                "center_lon": float(cll.x),
                "footprint_polygon": mapping(foot_ll),
                "status": "empty",
                "primary_image_id": None,
            }
        )

    return {
        "version": 1,
        "tolerance_m": float(tolerance_m),
        "footprint_w_m": float(footprint_w_m),
        "footprint_h_m": float(footprint_h_m),
        "rotation_deg": float(rot_deg),
        "utm_epsg": epsg,
        "slots": slots,
    }


def assign_image_to_slot(
    gps_lat: float | None,
    gps_lon: float | None,
    grid_doc: dict[str, Any] | None,
) -> tuple[str | None, bool]:
    """
    Pick primary slot for a photo GPS position.

    Returns (slot_id_or_none, is_primary_core) where is_primary_core is True when
    distance to centroid <= tolerance_m * 0.5.
    """
    if gps_lat is None or gps_lon is None or not grid_doc:
        return None, False
    slots = grid_doc.get("slots")
    if not isinstance(slots, list) or not slots:
        return None, False
    tol = float(grid_doc.get("tolerance_m") or 0.0)
    if tol <= 0:
        return None, False

    best_id: str | None = None
    best_d = float("inf")
    for s in slots:
        if not isinstance(s, dict):
            continue
        sid = s.get("id")
        try:
            clat = float(s["center_lat"])
            clon = float(s["center_lon"])
        except (KeyError, TypeError, ValueError):
            continue
        if not sid:
            continue
        d = _haversine_m(gps_lat, gps_lon, clat, clon)
        if d < best_d:
            best_d = d
            best_id = str(sid)

    if best_id is None or best_d > tol:
        return None, False
    core = best_d <= tol * 0.5
    return best_id, core


_PIXEL_SLOT_KEYS = (
    "blur_score",
    "clipping_ratio",
    "shadow_noise",
    "feature_overlap_with_neighbors",
    "n_photos_covering",
    "best_score",
    "best_image_id",
)


def reset_slots_to_empty(grid_doc: dict[str, Any] | None) -> dict[str, Any] | None:
    """Clear run-specific slot fields before a new upload batch."""
    if not grid_doc or not isinstance(grid_doc.get("slots"), list):
        return grid_doc
    for s in grid_doc["slots"]:
        if isinstance(s, dict):
            s["status"] = "empty"
            s["primary_image_id"] = None
            for k in _PIXEL_SLOT_KEYS:
                s.pop(k, None)
    return grid_doc


def approx_photo_footprint_polygon(
    lat: float,
    lon: float,
    footprint_w_m: float,
    footprint_h_m: float,
    rotation_deg: float,
) -> dict[str, Any]:
    """
    GeoJSON Polygon (WGS84) for an approximate nadir footprint at ``(lat, lon)``.

    Uses the same along/cross axes as ``compute_theoretical_grid`` (ENU metres → degree deltas).
    """
    rot = math.radians(rotation_deg)
    sin_r, cos_r = math.sin(rot), math.cos(rot)
    u_along = (sin_r, cos_r)
    u_cross = (-cos_r, sin_r)
    hw, hh = footprint_w_m / 2.0, footprint_h_m / 2.0
    cos_lat = max(0.01, math.cos(math.radians(lat)))
    m_per_deg_lon = 111_320.0 * cos_lat
    m_per_deg_lat = 111_320.0

    def corner(de_m: float, dn_m: float) -> tuple[float, float]:
        dlat = dn_m / m_per_deg_lat
        dlon = de_m / m_per_deg_lon
        return lon + dlon, lat + dlat

    corners_m = [
        (-hh * u_along[0] - hw * u_cross[0], -hh * u_along[1] - hw * u_cross[1]),
        (hh * u_along[0] - hw * u_cross[0], hh * u_along[1] - hw * u_cross[1]),
        (hh * u_along[0] + hw * u_cross[0], hh * u_along[1] + hw * u_cross[1]),
        (-hh * u_along[0] + hw * u_cross[0], -hh * u_along[1] + hw * u_cross[1]),
        (-hh * u_along[0] - hw * u_cross[0], -hh * u_along[1] - hw * u_cross[1]),
    ]
    ring = [corner(de, dn) for de, dn in corners_m]
    return {
        "type": "Polygon",
        "coordinates": [ring],
    }


def apply_primary_slots_to_grid(
    grid_doc: dict[str, Any],
    assignments: list[tuple[str, str]],
) -> dict[str, Any]:
    """
    Update slot status from list of (image_id, primary_slot_id).

    For each slot, primary_image_id is the assigned image with minimum distance to centroid
    among those mapping to that slot (assignments must be pre-filtered to one slot per image).
    """
    if not grid_doc or "slots" not in grid_doc:
        return grid_doc
    slots = grid_doc.get("slots")
    if not isinstance(slots, list):
        return grid_doc

    by_slot: dict[str, list[str]] = {}
    for img_id, slot_id in assignments:
        if not slot_id:
            continue
        by_slot.setdefault(slot_id, []).append(img_id)

    for s in slots:
        if not isinstance(s, dict):
            continue
        sid = str(s.get("id") or "")
        imgs = by_slot.get(sid)
        if imgs:
            s["status"] = "covered"
            s["primary_image_id"] = imgs[0]
        else:
            s["status"] = "gap"
            s["primary_image_id"] = None

    return grid_doc


def grid_slot_summary(grid_doc: dict[str, Any] | None) -> dict[str, int]:
    if not grid_doc or not isinstance(grid_doc.get("slots"), list):
        return {"empty": 0, "covered": 0, "gap": 0, "total": 0}
    counts = {"empty": 0, "covered": 0, "gap": 0, "warning": 0, "critical": 0, "best": 0, "total": 0}
    for s in grid_doc["slots"]:
        if not isinstance(s, dict):
            continue
        st = str(s.get("status") or "empty")
        counts["total"] += 1
        if st in counts:
            counts[st] += 1
        else:
            counts["empty"] += 1
    return counts
