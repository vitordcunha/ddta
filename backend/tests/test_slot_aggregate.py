import numpy as np

from app.services.image_quality.analyze import analyze_bgr, decode_jpeg_bgr
from app.services.image_quality.report import build_pixel_report
from app.services.image_quality.slot_aggregate import apply_slot_patches_to_grid, compute_slot_pixel_bundle


def _tiny_jpeg_bgr() -> bytes:
    import cv2

    img = np.zeros((64, 64, 3), dtype=np.uint8)
    img[:] = (80, 120, 160)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def test_compute_slot_pixel_bundle_two_slots():
    grid = {
        "version": 1,
        "tolerance_m": 25.0,
        "footprint_w_m": 40.0,
        "footprint_h_m": 30.0,
        "rotation_deg": 0.0,
        "slots": [
            {
                "id": "s1",
                "row": 0,
                "col": 0,
                "center_lat": -23.0,
                "center_lon": -46.0,
                "footprint_polygon": {"type": "Polygon", "coordinates": [[[-46.0001, -23.0001], [-46.0, -23.0001], [-46.0, -23.0], [-46.0001, -23.0], [-46.0001, -23.0001]]]},
                "status": "covered",
                "primary_image_id": "00000000-0000-0000-0000-000000000001",
            },
            {
                "id": "s2",
                "row": 0,
                "col": 1,
                "center_lat": -23.0,
                "center_lon": -45.999,
                "footprint_polygon": {"type": "Polygon", "coordinates": [[[-45.9991, -23.0001], [-45.999, -23.0001], [-45.999, -23.0], [-45.9991, -23.0], [-45.9991, -23.0001]]]},
                "status": "covered",
                "primary_image_id": "00000000-0000-0000-0000-000000000002",
            },
        ],
    }
    raw = _tiny_jpeg_bgr()
    bgr = decode_jpeg_bgr(raw)
    assert bgr is not None
    m = analyze_bgr(bgr)
    import uuid

    u1, u2 = uuid.uuid4(), uuid.uuid4()
    ordered = [(u1, "a.jpg", "s1"), (u2, "b.jpg", "s2")]
    per_image = [m, m]
    bgr_by = {0: bgr, 1: bgr}
    reports, patches, best_flags, _ev = compute_slot_pixel_bundle(grid, ordered, per_image, bgr_by)
    assert len(reports) == 2
    apply_slot_patches_to_grid(grid, patches)
    assert grid["slots"][0].get("best_image_id")
    assert best_flags.get(u1) or best_flags.get(u2)


def test_build_pixel_report_includes_slot_reports():
    rep = build_pixel_report(["a.jpg"], [None], [], [None], slot_reports=[{"slot_id": "x", "status": "gap"}])
    assert rep["slot_reports"][0]["slot_id"] == "x"
