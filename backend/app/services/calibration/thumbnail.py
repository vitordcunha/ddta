"""Downscaled JPEG thumbnails for calibration pixel analysis (Fase 4)."""

from __future__ import annotations

from io import BytesIO

from PIL import Image

from app.config import settings

_SMALL_THUMB_W = 320
_SMALL_THUMB_H = 240
_SMALL_THUMB_QUALITY = 72


def build_calibration_thumbnail_jpeg(file_bytes: bytes) -> bytes:
    """Return a JPEG thumbnail (max side from settings), EXIF orientation applied.

    Used for pixel analysis (Fase 4) — typically ~1280 px max side.
    """
    img = Image.open(BytesIO(file_bytes))
    img = Image.exif_transpose(img)
    img = img.convert("RGB")
    w, h = img.size
    m = settings.calibration_pixel_thumb_max_px
    scale = min(m / w, m / h, 1.0)
    if scale < 1.0:
        nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
        img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=settings.calibration_pixel_jpeg_quality)
    return buf.getvalue()


def build_calibration_small_thumbnail_jpeg(file_bytes: bytes) -> bytes:
    """Return a compact 320×240 JPEG preview for slot inspector display (Fase 3-A).

    Uses thumbnail() which preserves aspect ratio within the bounding box,
    so the result may be smaller than 320×240 for non-4:3 sensors.
    """
    img = Image.open(BytesIO(file_bytes))
    img = Image.exif_transpose(img)
    img = img.convert("RGB")
    img.thumbnail((_SMALL_THUMB_W, _SMALL_THUMB_H), Image.Resampling.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=_SMALL_THUMB_QUALITY)
    return buf.getvalue()
