"""ORB feature overlap between adjacent frames (proxy for stitching overlap)."""

from __future__ import annotations

import cv2
import numpy as np


def orb_good_match_ratio(img_a: np.ndarray, img_b: np.ndarray, max_features: int = 1000) -> dict:
    """
    Lowe ratio test on ORB Hamming matches between two BGR uint8 images.
    Returns match counts and ``match_ratio`` = good / min(kp counts).
    """
    gray_a = cv2.cvtColor(img_a, cv2.COLOR_BGR2GRAY) if img_a.ndim == 3 else img_a
    gray_b = cv2.cvtColor(img_b, cv2.COLOR_BGR2GRAY) if img_b.ndim == 3 else img_b
    orb = cv2.ORB_create(nfeatures=max_features, fastThreshold=8)
    kp1, des1 = orb.detectAndCompute(gray_a, None)
    kp2, des2 = orb.detectAndCompute(gray_b, None)
    n1, n2 = len(kp1), len(kp2)
    if des1 is None or des2 is None or n1 < 4 or n2 < 4:
        return {"kp_a": n1, "kp_b": n2, "matches_good": 0, "match_ratio": 0.0}
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    pairs = bf.knnMatch(des1, des2, k=2)
    good = 0
    for item in pairs:
        if len(item) < 2:
            continue
        m, n = item[0], item[1]
        if m.distance < 0.75 * n.distance:
            good += 1
    denom = max(1, min(n1, n2))
    return {"kp_a": n1, "kp_b": n2, "matches_good": good, "match_ratio": good / denom}
