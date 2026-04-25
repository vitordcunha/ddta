"""Noise / texture in shadow regions (low luminance)."""

from __future__ import annotations

import cv2
import numpy as np


def shadow_region_stats(bgr: np.ndarray) -> dict:
    """Std dev of luminance in pixels below the 30th percentile (rough shadow mask)."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float64)
    p30 = float(np.percentile(gray, 30))
    thresh = max(p30, 8.0)
    mask = gray < thresh
    n = int(np.count_nonzero(mask))
    if n < 200:
        return {"shadow_pixel_count": n, "shadow_luma_std": None}
    vals = gray[mask]
    return {"shadow_pixel_count": n, "shadow_luma_std": float(np.std(vals))}
