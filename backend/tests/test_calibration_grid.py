import pytest

from app.services.calibration.calibration_grid import (
    assign_image_to_slot,
    compute_theoretical_grid,
    reset_slots_to_empty,
)


def _square_poly(cx: float, cy: float, half_deg: float = 0.0004) -> dict:
    """Small square around (lon, lat) = (cx, cy) in GeoJSON Feature."""
    return {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [cx - half_deg, cy - half_deg],
                    [cx + half_deg, cy - half_deg],
                    [cx + half_deg, cy + half_deg],
                    [cx - half_deg, cy + half_deg],
                    [cx - half_deg, cy - half_deg],
                ]
            ],
        },
    }


def test_compute_theoretical_grid_uses_explicit_sensor_from_snapshot():
    poly = _square_poly(-46.6, -23.5)
    params = {
        "droneModel": "Mini 4 Pro",
        "sensorWidthMm": 20.0,
        "sensorHeightMm": 15.0,
        "focalLengthMm": 10.0,
        "altitudeM": 100,
        "forwardOverlap": 0.75,
        "sideOverlap": 0.65,
        "rotationDeg": 0,
    }
    grid = compute_theoretical_grid(poly, params)
    assert grid.get("error") is None
    assert grid["footprint_w_m"] == pytest.approx(200.0, rel=1e-3)
    assert grid["footprint_h_m"] == pytest.approx(150.0, rel=1e-3)


def test_compute_theoretical_grid_returns_slots():
    poly = _square_poly(-46.6, -23.5)
    params = {
        "droneModel": "Mini 4 Pro",
        "altitudeM": 80,
        "forwardOverlap": 0.75,
        "sideOverlap": 0.65,
        "rotationDeg": 15,
    }
    grid = compute_theoretical_grid(poly, params)
    assert grid.get("error") is None
    assert grid["version"] == 1
    assert grid["tolerance_m"] > 0
    assert len(grid["slots"]) >= 1
    s0 = grid["slots"][0]
    assert "id" in s0 and "center_lat" in s0 and "center_lon" in s0
    assert s0["footprint_polygon"]["type"] == "Polygon"


def test_assign_image_to_slot_near_centroid():
    poly = _square_poly(-46.62, -23.52, half_deg=0.00025)
    params = {
        "droneModel": "Mini 4 Pro",
        "altitudeM": 60,
        "forwardOverlap": 0.7,
        "sideOverlap": 0.6,
        "rotationDeg": 0,
    }
    grid = compute_theoretical_grid(poly, params)
    slots = grid["slots"]
    assert slots
    mid = slots[len(slots) // 2]
    lat, lon = mid["center_lat"], mid["center_lon"]
    sid, core = assign_image_to_slot(lat, lon, grid)
    assert sid == mid["id"]
    assert core is True

    # Far away — no slot
    sid2, _ = assign_image_to_slot(lat + 0.5, lon + 0.5, grid)
    assert sid2 is None


def test_assign_without_gps():
    grid = compute_theoretical_grid(_square_poly(-40, -20), {"droneModel": "Air 3", "altitudeM": 100})
    assert assign_image_to_slot(None, -40.0, grid) == (None, False)


def test_reset_slots_to_empty():
    grid = compute_theoretical_grid(_square_poly(-46.6, -23.5), {"droneModel": "Mini 4 Pro", "altitudeM": 90})
    grid["slots"][0]["status"] = "covered"
    grid["slots"][0]["primary_image_id"] = "x"
    reset_slots_to_empty(grid)
    assert grid["slots"][0]["status"] == "empty"
    assert grid["slots"][0]["primary_image_id"] is None


def test_drone_default_unknown_model_still_grids():
    poly = _square_poly(-46.6, -23.5)
    grid = compute_theoretical_grid(poly, {"droneModel": "Unknown X", "altitudeM": 80})
    assert len(grid["slots"]) >= 1
    assert grid["footprint_w_m"] > 0
