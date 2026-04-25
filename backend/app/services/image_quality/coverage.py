"""Local sharpness on a grid — soft corners vs centre."""

from __future__ import annotations

import cv2
import numpy as np


def grid_laplacian_profile(bgr: np.ndarray, grid: int = 4) -> dict:
    """Laplacian variance per cell; ratio of weakest corner to centre."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    vars_: list[float] = []
    for gi in range(grid):
        for gj in range(grid):
            y0, y1 = int(h * gi / grid), int(h * (gi + 1) / grid)
            x0, x1 = int(w * gj / grid), int(w * (gj + 1) / grid)
            y1, x1 = max(y0 + 1, y1), max(x0 + 1, x1)
            patch = gray[y0:y1, x0:x1]
            vars_.append(float(cv2.Laplacian(patch, cv2.CV_64F).var()))
    ci, cj = grid // 2, grid // 2
    center_idx = ci * grid + cj
    center_var = vars_[center_idx]
    corner_idx = (0, grid - 1, grid * (grid - 1), grid * grid - 1)
    edge_min = min(vars_[i] for i in corner_idx)
    ratio = edge_min / (center_var + 1e-6)
    return {
        "grid_laplacian_vars": vars_,
        "center_laplacian_var": center_var,
        "corner_min_laplacian_var": edge_min,
        "edge_to_center_sharpness_ratio": ratio,
    }
