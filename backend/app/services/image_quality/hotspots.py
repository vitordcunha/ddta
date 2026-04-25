"""Bright saturated regions (glare / hot spots)."""

from __future__ import annotations

import cv2
import numpy as np
from skimage import measure


def bright_blob_metrics(bgr: np.ndarray, luma_threshold: int = 250, min_area: int = 48) -> dict:
    """Fraction of very bright pixels and count of connected components above ``min_area``."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    bright = gray >= luma_threshold
    frac = float(np.mean(bright))
    labeled = measure.label(bright, connectivity=2)
    regions = measure.regionprops(labeled)
    big = sum(1 for r in regions if r.area >= min_area)
    return {"bright_pixel_frac": frac, "bright_blob_count": int(big)}
