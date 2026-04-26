"""Unit tests for EXIF aggregation heuristics (no database)."""

import math

import pytest

from app.services.calibration.exif_aggregate import build_exif_report, min_shutter_from_gsd_speed


def test_min_shutter_from_gsd_speed():
    assert min_shutter_from_gsd_speed(3.0, 10.0) == pytest.approx(0.003)
    assert min_shutter_from_gsd_speed(None, 10.0) is None


def test_auto_white_balance_warns():
    rows = [
        {"exposure_time_s": 0.01, "exposure_time_log2": -6.64, "iso": 400, "iso_log2": 8.64, "white_balance": 0},
        {"exposure_time_s": 0.01, "exposure_time_log2": -6.64, "iso": 400, "iso_log2": 8.64, "white_balance": 0},
    ]
    params = {
        "speedMs": 10,
        "altitudeM": 80,
        "_calibration": {"gsdCm": 2.5, "estimatedPhotos": 10, "estimatedTimeMin": 1},
    }
    report = build_exif_report(rows, params)
    wb = next(m for m in report["metrics"] if m["id"] == "white_balance")
    assert wb["severity"] == "warn"


def test_focal_length_matches_model_ok():
    rows = [
        {
            "exposure_time_s": 0.01,
            "exposure_time_log2": -6.64,
            "iso": 100,
            "iso_log2": 6.64,
            "focal_length_mm": 12.3,
        },
        {
            "exposure_time_s": 0.01,
            "exposure_time_log2": -6.64,
            "iso": 100,
            "iso_log2": 6.64,
            "focal_length_mm": 12.35,
        },
    ]
    params = {"speedMs": 8, "altitudeM": 100, "focalLengthMm": 12.29}
    report = build_exif_report(rows, params)
    m = next(x for x in report["metrics"] if x["id"] == "focal_vs_model")
    assert m["severity"] == "ok"


def test_exposure_inconsistency_bad():
    rows = []
    for i in range(5):
        t = 0.002 * (2**i)
        rows.append(
            {
                "exposure_time_s": t,
                "exposure_time_log2": math.log2(t),
                "iso": 100,
                "iso_log2": math.log2(100),
            }
        )
    report = build_exif_report(rows, {"speedMs": 8, "altitudeM": 100})
    exp = next(m for m in report["metrics"] if m["id"] == "exposure_consistency")
    assert exp["severity"] == "bad"
