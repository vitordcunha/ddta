"""Histogram and highlight/shadow clipping metrics."""

from __future__ import annotations

import numpy as np


def analyze_exposure_bgr(bgr: np.ndarray) -> dict:
    """
    Per-channel percentiles and saturation at 0 / 255.
    ``bgr`` is uint8, shape (H, W, 3) in BGR order (OpenCV).
    """
    out: dict = {}
    for i, name in enumerate(("b", "g", "r")):
        ch = bgr[:, :, i].astype(np.float64)
        p1 = float(np.percentile(ch, 1))
        p99 = float(np.percentile(ch, 99))
        frac0 = float(np.mean(ch <= 0))
        frac255 = float(np.mean(ch >= 255))
        out[name] = {"p1": p1, "p99": p99, "frac_at_0": frac0, "frac_at_255": frac255}
    return out
