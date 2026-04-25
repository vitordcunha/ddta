"""Regression-style cases for ``build_recommendations`` (Fase 5)."""

from __future__ import annotations

import pytest

from app.services.recommendation_engine import build_recommendations

BASE_PARAMS = {
    "droneModel": "Mavic 3",
    "altitudeM": 100.0,
    "forwardOverlap": 75.0,
    "sideOverlap": 70.0,
    "rotationDeg": 0.0,
    "speedMs": 8.0,
}


def _ids(recs: list) -> list[str]:
    return [r["id"] for r in recs]


@pytest.mark.parametrize(
    "case_id,exif,pixel,weather,expected_id",
    [
        (
            "nd_when_clip_bad_tight_shutter_low_iso",
            {
                "version": 1,
                "summary": {
                    "parsed_count": 8,
                    "median_exposure_s": 0.003,
                    "min_shutter_hint_s": 0.0025,
                    "median_iso": 200,
                },
                "metrics": [
                    {
                        "id": "shutter_vs_motion",
                        "title": "x",
                        "severity": "ok",
                        "detail": "",
                        "value": 1.1,
                    }
                ],
            },
            {
                "version": 1,
                "summary": {"decoded_count": 8, "max_channel_frac_at_255": 0.12},
                "metrics": [
                    {
                        "id": "histogram_clip_high",
                        "title": "Realces",
                        "severity": "bad",
                        "detail": "Saturação",
                        "value": 12.0,
                    }
                ],
            },
            None,
            "clip_nd",
        ),
        (
            "shutter_before_nd_when_slow",
            {
                "version": 1,
                "summary": {
                    "parsed_count": 8,
                    "median_exposure_s": 0.04,
                    "min_shutter_hint_s": 0.012,
                    "median_iso": 200,
                },
                "metrics": [
                    {
                        "id": "shutter_vs_motion",
                        "title": "x",
                        "severity": "bad",
                        "detail": "",
                        "value": 3.5,
                    }
                ],
            },
            {
                "version": 1,
                "summary": {"decoded_count": 8, "max_channel_frac_at_255": 0.1},
                "metrics": [
                    {
                        "id": "histogram_clip_high",
                        "title": "Realces",
                        "severity": "bad",
                        "detail": "Saturação",
                        "value": 10.0,
                    }
                ],
            },
            None,
            "clip_shutter_first",
        ),
        (
            "blur_reduces_speed",
            {"version": 1, "summary": {"parsed_count": 5}, "metrics": []},
            {
                "version": 1,
                "summary": {"decoded_count": 5, "median_laplacian_var": 12.0},
                "metrics": [
                    {
                        "id": "blur_global",
                        "title": "Desfoque",
                        "severity": "bad",
                        "detail": "Baixo Laplaciano",
                        "value": 12.0,
                    }
                ],
            },
            {"windGustsMs": 9.0},
            "blur_motion",
        ),
        (
            "exposure_inconsistent_manual",
            {
                "version": 1,
                "summary": {"parsed_count": 6, "exposure_time_log2_stdev": 0.9},
                "metrics": [
                    {
                        "id": "exposure_consistency",
                        "title": "Exp",
                        "severity": "bad",
                        "detail": "Auto",
                        "value": 0.9,
                    }
                ],
            },
            {"version": 1, "summary": {"decoded_count": 6}, "metrics": []},
            None,
            "exposure_auto",
        ),
        (
            "orb_bad_overlap",
            {"version": 1, "summary": {"parsed_count": 5}, "metrics": []},
            {
                "version": 1,
                "summary": {"decoded_count": 5},
                "metrics": [
                    {
                        "id": "features_orb",
                        "title": "ORB",
                        "severity": "bad",
                        "detail": "Poucas correspondências",
                        "value": 0.008,
                    }
                ],
            },
            None,
            "overlap_orb",
        ),
        (
            "gps_alt_warn",
            {
                "version": 1,
                "summary": {"parsed_count": 5},
                "metrics": [
                    {
                        "id": "gps_altitude",
                        "title": "GPS",
                        "severity": "bad",
                        "detail": "Δ grande",
                        "value": 55.0,
                    }
                ],
            },
            {"version": 1, "summary": {"decoded_count": 5}, "metrics": []},
            None,
            "gps_altitude",
        ),
        (
            "shadow_noise_high_iso",
            {
                "version": 1,
                "summary": {"parsed_count": 5, "median_iso": 800},
                "metrics": [],
            },
            {
                "version": 1,
                "summary": {"decoded_count": 5},
                "metrics": [
                    {
                        "id": "shadow_noise",
                        "title": "Sombras",
                        "severity": "warn",
                        "detail": "Ruído",
                    }
                ],
            },
            None,
            "shadow_iso",
        ),
    ],
)
def test_recommendation_regression_row(case_id, exif, pixel, weather, expected_id):
    recs = build_recommendations(BASE_PARAMS, weather, exif, pixel)
    ids = _ids(recs)
    assert expected_id in ids, f"{case_id}: expected {expected_id} in {ids}"


def test_all_ok_when_metrics_clean():
    exif = {
        "version": 1,
        "summary": {"parsed_count": 6},
        "metrics": [
            {
                "id": "exposure_consistency",
                "title": "Exp",
                "severity": "ok",
                "detail": "",
                "value": 0.2,
            }
        ],
    }
    pixel = {
        "version": 1,
        "summary": {"decoded_count": 6, "max_channel_frac_at_255": 0.001, "median_laplacian_var": 120.0},
        "metrics": [
            {
                "id": "histogram_clip_high",
                "title": "H",
                "severity": "ok",
                "detail": "",
                "value": 0.1,
            },
            {
                "id": "blur_global",
                "title": "B",
                "severity": "ok",
                "detail": "",
                "value": 120.0,
            },
            {
                "id": "features_orb",
                "title": "O",
                "severity": "ok",
                "detail": "",
                "value": 0.08,
            },
        ],
    }
    recs = build_recommendations(BASE_PARAMS, None, exif, pixel)
    assert "all_ok" in _ids(recs)


def test_every_recommendation_has_rationale_and_action():
    exif = {
        "version": 1,
        "summary": {"parsed_count": 5, "median_iso": 500},
        "metrics": [
            {
                "id": "white_balance",
                "title": "WB",
                "severity": "warn",
                "detail": "Auto",
            }
        ],
    }
    pixel = {
        "version": 1,
        "summary": {"decoded_count": 5, "max_channel_frac_at_255": 0.2},
        "metrics": [
            {
                "id": "histogram_clip_high",
                "title": "clip",
                "severity": "bad",
                "detail": "x",
                "value": 20.0,
            }
        ],
    }
    recs = build_recommendations(BASE_PARAMS, None, exif, pixel)
    for r in recs:
        assert r.get("rationale"), r
        assert r.get("text"), r
        assert "porque" in r["rationale"].lower()
