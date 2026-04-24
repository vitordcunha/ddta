from __future__ import annotations

from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from pyproj import Geod

from app.core.flight.calculator import Waypoint

GEOD = Geod(ellps="WGS84")


def generate_dji_kmz(
    waypoints: list[Waypoint], altitude: float, speed: float, drone_model: str
) -> bytes:
    params = {
        "altitude": altitude,
        "speed": speed,
        "drone_model": drone_model,
        "distance_m": _total_distance_geodesic(waypoints),
    }
    template_kml = _build_template_kml(waypoints, params)
    waylines_wpml = _build_waylines_wpml(waypoints, params)

    output = BytesIO()
    with ZipFile(output, mode="w", compression=ZIP_DEFLATED) as kmz:
        kmz.writestr("template.kml", template_kml)
        kmz.writestr("waylines.wpml", waylines_wpml)
    return output.getvalue()


def _build_template_kml(waypoints: list[Waypoint], params: dict) -> str:
    placemarks = []
    for wp in waypoints:
        placemarks.append(
            f"""
      <Placemark>
        <name>WP {wp.order}</name>
        <Point><coordinates>{wp.lon},{wp.lat},{wp.altitude_m}</coordinates></Point>
      </Placemark>""".strip()
        )
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Flight Plan - {params["drone_model"]}</name>
    {"".join(placemarks)}
  </Document>
</kml>
"""


def _build_waylines_wpml(waypoints: list[Waypoint], params: dict) -> str:
    wp_entries = []
    for wp in waypoints:
        wp_entries.append(
            f"""
    <wpml:waypoint>
      <wpml:index>{wp.order}</wpml:index>
      <wpml:coordinate>{wp.lon},{wp.lat}</wpml:coordinate>
      <wpml:height>{wp.altitude_m}</wpml:height>
      <wpml:speed>{params["speed"]}</wpml:speed>
    </wpml:waypoint>""".strip()
        )

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<wpml:mission xmlns:wpml="http://www.dji.com/wpmz/1.0.0">
  <wpml:droneModel>{params["drone_model"]}</wpml:droneModel>
  <wpml:distance>{params["distance_m"]:.2f}</wpml:distance>
  {"".join(wp_entries)}
</wpml:mission>
"""


def _total_distance_geodesic(waypoints: list[Waypoint]) -> float:
    total = 0.0
    for previous, current in zip(waypoints, waypoints[1:], strict=False):
        _, _, dist = GEOD.inv(previous.lon, previous.lat, current.lon, current.lat)
        total += dist
    return total
