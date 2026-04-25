"""Extract a small, JSON-serializable EXIF subset from JPEG bytes (no pixel decode)."""

from __future__ import annotations

import math
from datetime import datetime
from io import BytesIO
from typing import Any

from PIL import Image
from PIL.ExifTags import Base, IFD


def _rational_to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if hasattr(value, "numerator") and hasattr(value, "denominator"):
        d = float(value.denominator)
        if d == 0:
            return None
        return float(value.numerator) / d
    if isinstance(value, tuple) and len(value) == 2:
        d = float(value[1])
        if d == 0:
            return None
        return float(value[0]) / d
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _decode_str(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace").strip() or None
    s = str(value).strip()
    return s or None


def _gps_pair_to_float(values: Any, ref: Any) -> float | None:
    if not values or ref is None:
        return None
    try:
        deg = _rational_to_float(values[0])
        minutes = _rational_to_float(values[1])
        sec = _rational_to_float(values[2])
        if deg is None or minutes is None or sec is None:
            return None
        dec = deg + minutes / 60.0 + sec / 3600.0
        ref_s = ref.decode() if isinstance(ref, bytes) else str(ref)
        if ref_s in {"S", "W"}:
            dec *= -1
        return dec
    except (IndexError, TypeError, ValueError):
        return None


def _gps_altitude_m(value: Any, ref: Any) -> float | None:
    v = _rational_to_float(value)
    if v is None:
        return None
    ref_s = ref.decode() if isinstance(ref, bytes) else str(ref) if ref is not None else "0"
    if ref_s == "1":
        return -v
    return v


def extract_calibration_exif(file_bytes: bytes) -> dict[str, Any]:
    """Return normalized EXIF fields used by the calibration report."""
    out: dict[str, Any] = {}
    try:
        image = Image.open(BytesIO(file_bytes))
    except Exception:
        return {"_error": "not_a_valid_image"}

    exif = image.getexif()
    if not exif:
        return out

    exif_ifd = exif.get_ifd(IFD.Exif) if exif else {}

    def pick_exif(tag: int) -> Any:
        if tag in exif_ifd:
            return exif_ifd.get(tag)
        return exif.get(tag)

    # Main tags sometimes duplicated on root IFD
    exposure = pick_exif(Base.ExposureTime)
    fnumber = pick_exif(Base.FNumber)
    iso_raw = pick_exif(Base.ISOSpeedRatings)
    focal = pick_exif(Base.FocalLength)
    wb = pick_exif(Base.WhiteBalance)
    dt_orig = pick_exif(Base.DateTimeOriginal)
    make = pick_exif(Base.Make)
    model = pick_exif(Base.Model)
    software = pick_exif(Base.Software)
    orientation = pick_exif(Base.Orientation)

    exp_f = _rational_to_float(exposure)
    if exp_f is not None and exp_f > 0:
        out["exposure_time_s"] = exp_f
        out["exposure_time_log2"] = math.log2(exp_f)

    fn = _rational_to_float(fnumber)
    if fn is not None and fn > 0:
        out["f_number"] = fn
        out["f_number_log2"] = math.log2(fn)

    if iso_raw is not None:
        if isinstance(iso_raw, (tuple, list)):
            iso = int(iso_raw[0]) if iso_raw else None
        else:
            try:
                iso = int(iso_raw)
            except (TypeError, ValueError):
                iso = None
        if iso and iso > 0:
            out["iso"] = iso
            out["iso_log2"] = math.log2(iso)

    fl = _rational_to_float(focal)
    if fl is not None:
        out["focal_length_mm"] = fl

    if wb is not None:
        try:
            out["white_balance"] = int(wb)
        except (TypeError, ValueError):
            out["white_balance"] = str(wb)

    dto = _decode_str(dt_orig)
    if dto:
        out["datetime_original"] = dto
        try:
            out["datetime_original_parsed"] = datetime.strptime(dto, "%Y:%m:%d %H:%M:%S").isoformat()
        except ValueError:
            pass

    m = _decode_str(make)
    if m:
        out["make"] = m
    mo = _decode_str(model)
    if mo:
        out["model"] = mo
    sw = _decode_str(software)
    if sw:
        out["software"] = sw
    if orientation is not None:
        try:
            out["orientation"] = int(orientation)
        except (TypeError, ValueError):
            pass

    gps = exif.get_ifd(IFD.GPS) if exif else {}
    if gps:
        lat = _gps_pair_to_float(gps.get(2), gps.get(1))
        lon = _gps_pair_to_float(gps.get(4), gps.get(3))
        if lat is not None:
            out["gps_latitude"] = lat
        if lon is not None:
            out["gps_longitude"] = lon
        alt = _gps_altitude_m(gps.get(6), gps.get(5))
        if alt is not None:
            out["gps_altitude_m"] = alt

    return out
