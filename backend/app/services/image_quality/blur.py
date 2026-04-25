"""Global blur via Laplacian variance on a central crop."""

from __future__ import annotations

import cv2
import numpy as np


def laplacian_variance_center(bgr: np.ndarray, center_frac: float = 0.35) -> float:
    """Variance of Laplacian on central ``center_frac`` of min(height, width)."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    side = int(min(h, w) * center_frac)
    side = max(side, 32)
    y0 = (h - side) // 2
    x0 = (w - side) // 2
    patch = gray[y0 : y0 + side, x0 : x0 + side]
    return float(cv2.Laplacian(patch, cv2.CV_64F).var())
