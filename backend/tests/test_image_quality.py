import numpy as np

from app.services.image_quality.analyze import analyze_bgr, decode_jpeg_bgr
from app.services.image_quality.exposure import analyze_exposure_bgr
from app.services.image_quality.report import build_pixel_report


def test_exposure_clipping_saturated_red():
    h, w = 64, 64
    bgr = np.zeros((h, w, 3), dtype=np.uint8)
    bgr[:, :, 2] = 255  # red channel saturated
    exp = analyze_exposure_bgr(bgr)
    assert exp["r"]["frac_at_255"] > 0.99


def test_decode_roundtrip_small_jpeg():
    import cv2

    img = np.zeros((32, 32, 3), dtype=np.uint8)
    img[:, :] = (40, 120, 200)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    out = decode_jpeg_bgr(buf.tobytes())
    assert out is not None
    assert out.shape[0] == 32


def test_build_pixel_report_uniform_vs_sharp():
    h, w = 120, 160
    flat = np.full((h, w, 3), 120, dtype=np.uint8)
    noise = np.random.randint(0, 255, (h, w, 3), dtype=np.uint8)
    m_flat = analyze_bgr(flat)
    m_noise = analyze_bgr(noise)
    assert m_flat["laplacian_var_center"] < m_noise["laplacian_var_center"]

    filenames = ["a.jpg", "b.jpg"]
    per_image = [m_flat, m_noise]
    pairwise = [
        {
            "index_a": 0,
            "index_b": 1,
            "filename_a": "a.jpg",
            "filename_b": "b.jpg",
            "kp_a": 10,
            "kp_b": 10,
            "matches_good": 50,
            "match_ratio": 0.5,
        }
    ]
    iso = [100, 100]
    rep = build_pixel_report(filenames, per_image, pairwise, iso)
    assert rep["version"] == 1
    assert rep["summary"]["decoded_count"] == 2
    assert any(m["id"] == "features_orb" for m in rep["metrics"])
