"""Single-image statistics used for cross-image consistency in the report builder."""

from __future__ import annotations

import cv2
import numpy as np


def mean_luminance_01(bgr: np.ndarray) -> float:
    """Mean grayscale luminance normalized to 0..1."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float64) / 255.0
    return float(np.mean(gray))
