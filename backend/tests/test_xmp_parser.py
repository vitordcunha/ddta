"""Tests for DJI XMP extraction (Fase 11)."""

from __future__ import annotations

from app.services.exif.xmp_parser import DjiXmpParser, DJI_NS


def _wrap_xmp(inner: str) -> str:
    return f"""<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description xmlns:drone-dji="{DJI_NS}">
{inner}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>"""


def test_parse_dji_elements_text() -> None:
    inner = f"""
      <drone-dji:RelativeAltitude>42.5</drone-dji:RelativeAltitude>
      <drone-dji:GimbalPitchDegree>-15.2</drone-dji:GimbalPitchDegree>
      <drone-dji:FlightYawDegree>178.0</drone-dji:FlightYawDegree>
    """
    p = DjiXmpParser()
    data = p.parse_bytes(_wrap_xmp(inner).encode("utf-8"))
    assert data is not None
    assert data.relative_altitude == 42.5
    assert data.gimbal_pitch == -15.2
    assert data.flight_yaw == 178.0


def test_parse_rdf_description_attributes() -> None:
    """Alguns JPEGs DJI expoem valores como atributos no rdf:Description."""
    inner = (
        'rdf:about="" '
        f'xmlns:drone-dji="{DJI_NS}" '
        'drone-dji:RelativeAltitude="12.5" '
        'drone-dji:GimbalPitchDegree="-5" '
        'drone-dji:FlightYawDegree="90"'
    )
    wrapped = f"""<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description {inner} />
  </rdf:RDF>
</x:xmpmeta>"""
    p = DjiXmpParser()
    data = p.parse_bytes(wrapped.encode("utf-8"))
    assert data is not None
    assert data.relative_altitude == 12.5
    assert data.gimbal_pitch == -5.0
    assert data.flight_yaw == 90.0


def test_parse_returns_none_without_xmp() -> None:
    p = DjiXmpParser()
    assert p.parse_bytes(b"\xff\xd8\xff\xd9") is None
