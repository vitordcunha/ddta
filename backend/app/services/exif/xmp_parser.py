"""Parse DJI drone-dji XMP embedded in JPEG (stdlib only)."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path


DJI_NS = "http://www.dji.com/drone-dji/1.0/"


@dataclass
class DjiXmpData:
    relative_altitude: float | None  # m above takeoff (barometer)
    absolute_altitude: float | None  # AMSL (less precise)
    gimbal_pitch: float | None
    gimbal_yaw: float | None
    gimbal_roll: float | None
    flight_yaw: float | None
    flight_pitch: float | None
    flight_roll: float | None


def _to_float(value: str | None) -> float | None:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        return float(s.replace(",", "."))
    except ValueError:
        return None


def _extract_xmp_xml_from_bytes(data: bytes) -> str | None:
    """Locate XMP packet in JPEG APP1 or raw <x:xmpmeta> region."""
    i = 0
    n = len(data)
    while i < n - 3:
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker == 0xD8:
            i += 2
            continue
        if marker in (0xD9, 0xDA):
            break
        if i + 4 > n:
            break
        seg_len = int.from_bytes(data[i + 2 : i + 4], "big")
        seg_start = i + 4
        seg_end = min(seg_start + seg_len - 2, n)
        if marker == 0xE1 and seg_end > seg_start:
            payload = data[seg_start:seg_end]
            head = payload[:256]
            if b"http://ns.adobe.com/xap/1.0/" in head or b"<x:xmpmeta" in head:
                try:
                    return payload.decode("utf-8", errors="replace")
                except Exception:
                    return None
        i = seg_end

    start = data.find(b"<x:xmpmeta")
    if start < 0:
        start = data.find(b"<?xpacket")
    if start < 0:
        return None
    end = data.find(b"</x:xmpmeta>", start)
    if end < 0:
        end = data.find(b"<?xpacket end=", start)
        if end < 0:
            return None
        end = data.find(b"?>", end)
        if end < 0:
            return None
        end += 2
    else:
        end += len(b"</x:xmpmeta>")
    return data[start:end].decode("utf-8", errors="replace")


def _xmp_meta_fragment(xml_text: str) -> str:
    """ElementTree falha com <?xpacket ...?> envolvendo o meta; isola o bloco xmpmeta."""
    start = xml_text.find("<x:xmpmeta")
    if start >= 0:
        end = xml_text.find("</x:xmpmeta>", start)
        if end > start:
            return xml_text[start : end + len("</x:xmpmeta>")]
    return xml_text


def _get_dji_field(root: ET.Element, local_name: str) -> str | None:
    full = f"{{{DJI_NS}}}{local_name}"
    for el in root.iter():
        if el.tag == full and el.text and el.text.strip():
            return el.text.strip()
        for attr_key, attr_val in el.attrib.items():
            if attr_key == full or attr_key.endswith(f"}}{local_name}"):
                if str(attr_val).strip():
                    return str(attr_val).strip()
            if attr_key == local_name and str(attr_val).strip():
                return str(attr_val).strip()
    return None


class DjiXmpParser:
    """Extract metadata from the drone-dji namespace in DJI camera XMP."""

    XMP_NAMESPACE = DJI_NS

    def parse(self, image_path: Path) -> DjiXmpData | None:
        try:
            data = image_path.read_bytes()
        except OSError:
            return None
        return self.parse_bytes(data)

    def parse_bytes(self, data: bytes) -> DjiXmpData | None:
        xml_text = _extract_xmp_xml_from_bytes(data)
        if not xml_text:
            return None
        fragment = _xmp_meta_fragment(xml_text)
        try:
            root = ET.fromstring(fragment)
        except ET.ParseError:
            try:
                root = ET.fromstring(f"<xmpwrap>{fragment}</xmpwrap>")
            except ET.ParseError:
                return None

        def f(name: str) -> float | None:
            return _to_float(_get_dji_field(root, name))

        rel = f("RelativeAltitude")
        if rel is None:
            rel = f("RelativeAltitudeToGroundLevel")

        return DjiXmpData(
            relative_altitude=rel,
            absolute_altitude=f("AbsoluteAltitude"),
            gimbal_pitch=f("GimbalPitchDegree"),
            gimbal_yaw=f("GimbalYawDegree"),
            gimbal_roll=f("GimbalRollDegree"),
            flight_yaw=f("FlightYawDegree"),
            flight_pitch=f("FlightPitchDegree"),
            flight_roll=f("FlightRollDegree"),
        )
