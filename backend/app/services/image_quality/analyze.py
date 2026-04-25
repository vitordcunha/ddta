"""Decode JPEG bytes and run all per-image metrics."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np

from app.services.image_quality.blur import laplacian_variance_center
from app.services.image_quality.consistency import mean_luminance_01
from app.services.image_quality.coverage import grid_laplacian_profile
from app.services.image_quality.exposure import analyze_exposure_bgr
from app.services.image_quality.hotspots import bright_blob_metrics
from app.services.image_quality.shadows import shadow_region_stats


def analyze_bgr(bgr: np.ndarray) -> dict[str, Any]:
    """Run all per-image metrics on a decoded BGR ``uint8`` array."""
    return {
        "laplacian_var_center": laplacian_variance_center(bgr),
        "mean_luminance_01": mean_luminance_01(bgr),
        "exposure": analyze_exposure_bgr(bgr),
        "grid_profile": grid_laplacian_profile(bgr),
        "shadow": shadow_region_stats(bgr),
        "hotspots": bright_blob_metrics(bgr),
    }


def decode_jpeg_bgr(jpeg_bytes: bytes) -> np.ndarray | None:
    arr = np.frombuffer(jpeg_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return None
    return img


def analyze_single_image(jpeg_bytes: bytes) -> dict[str, Any] | None:
    bgr = decode_jpeg_bgr(jpeg_bytes)
    if bgr is None:
        return None
    return analyze_bgr(bgr)


