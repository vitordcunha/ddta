from __future__ import annotations

from dataclasses import dataclass
from math import ceil

from pyproj import CRS, Geod, Transformer
from shapely import affinity
from shapely.geometry import LineString, MultiLineString, Point, Polygon, shape

from app.core.flight.drone_specs import DroneSpec

WGS84 = CRS.from_epsg(4326)
GEOD = Geod(ellps="WGS84")


@dataclass(frozen=True, slots=True)
class FootprintResult:
    width_m: float
    height_m: float


@dataclass(frozen=True, slots=True)
class SpacingResult:
    forward_spacing_m: float
    side_spacing_m: float


@dataclass(frozen=True, slots=True)
class Waypoint:
    order: int
    lon: float
    lat: float
    altitude_m: float


@dataclass(frozen=True, slots=True)
class FlightStats:
    area_m2: float
    distance_m: float
    estimated_duration_s: float
    strip_count: int
    waypoint_count: int


def calculate_gsd(altitude_m: float, specs: DroneSpec) -> float:
    if altitude_m <= 0:
        raise ValueError("Altitude must be greater than zero.")
    return (altitude_m * specs.sensor_width_mm) / (
        specs.focal_length_mm * specs.image_width_px
    ) / 1000


def calculate_footprint(gsd_m: float, specs: DroneSpec) -> FootprintResult:
    if gsd_m <= 0:
        raise ValueError("GSD must be greater than zero.")
    return FootprintResult(
        width_m=gsd_m * specs.image_width_px,
        height_m=gsd_m * specs.image_height_px,
    )


def calculate_spacings(
    footprint: FootprintResult, forward_overlap: float, side_overlap: float
) -> SpacingResult:
    if not (0 < forward_overlap < 100) or not (0 < side_overlap < 100):
        raise ValueError("Overlaps must be percentages between 0 and 100.")
    return SpacingResult(
        forward_spacing_m=footprint.height_m * (1 - forward_overlap / 100),
        side_spacing_m=footprint.width_m * (1 - side_overlap / 100),
    )


def _extract_polygon(polygon_geojson: dict) -> Polygon:
    if polygon_geojson.get("type") == "Feature":
        polygon = shape(polygon_geojson["geometry"])
    else:
        polygon = shape(polygon_geojson)
    if not isinstance(polygon, Polygon):
        raise ValueError("Only Polygon geometry is supported.")
    if not polygon.is_valid:
        raise ValueError("Invalid polygon.")
    return polygon


def _build_local_transformers(polygon: Polygon) -> tuple[Transformer, Transformer]:
    centroid = polygon.centroid
    local_crs = CRS.from_proj4(
        f"+proj=aeqd +lat_0={centroid.y} +lon_0={centroid.x} +datum=WGS84 +units=m +no_defs"
    )
    to_local = Transformer.from_crs(WGS84, local_crs, always_xy=True)
    to_wgs84 = Transformer.from_crs(local_crs, WGS84, always_xy=True)
    return to_local, to_wgs84


def _project_polygon(polygon: Polygon, transformer: Transformer) -> Polygon:
    coords = [transformer.transform(lon, lat) for lon, lat in polygon.exterior.coords]
    return Polygon(coords)


def generate_flight_grid(
    polygon_geojson: dict, spacings: SpacingResult, rotation_angle: float
) -> list[list[tuple[float, float]]]:
    polygon_wgs84 = _extract_polygon(polygon_geojson)
    to_local, to_wgs84 = _build_local_transformers(polygon_wgs84)
    polygon_local = _project_polygon(polygon_wgs84, to_local)

    rotated = affinity.rotate(polygon_local, -rotation_angle, origin="centroid")
    centroid: Point = rotated.centroid
    minx, miny, maxx, maxy = rotated.bounds
    strips: list[list[tuple[float, float]]] = []
    cursor = minx

    while cursor <= maxx:
        line = LineString([(cursor, miny - 1000), (cursor, maxy + 1000)])
        intersection = rotated.intersection(line)
        segments = _segments_from_intersection(intersection)
        for segment in segments:
            strip = _sample_segment(
                segment,
                spacings.forward_spacing_m,
                rotation_angle,
                centroid,
                to_wgs84,
            )
            if len(strip) >= 2:
                strips.append(strip)
        cursor += spacings.side_spacing_m

    return strips


def _segments_from_intersection(geometry) -> list[LineString]:
    if geometry.is_empty:
        return []
    if isinstance(geometry, LineString):
        return [geometry]
    if isinstance(geometry, MultiLineString):
        return [line for line in geometry.geoms if line.length > 0]
    return []


def _sample_segment(
    segment: LineString,
    forward_spacing_m: float,
    rotation_angle: float,
    centroid: Point,
    to_wgs84: Transformer,
) -> list[tuple[float, float]]:
    total_len = segment.length
    steps = max(1, ceil(total_len / forward_spacing_m))
    distances = [min(i * forward_spacing_m, total_len) for i in range(steps + 1)]

    points: list[tuple[float, float]] = []
    for distance in distances:
        point = segment.interpolate(distance)
        rotated_back = affinity.rotate(point, rotation_angle, origin=centroid)
        lon, lat = to_wgs84.transform(rotated_back.x, rotated_back.y)
        points.append((lon, lat))
    return points


def generate_waypoints(strips: list[list[tuple[float, float]]], altitude_m: float) -> list[Waypoint]:
    waypoints: list[Waypoint] = []
    order = 1
    for index, strip in enumerate(strips):
        track = strip if index % 2 == 0 else list(reversed(strip))
        for lon, lat in track:
            waypoints.append(Waypoint(order=order, lon=lon, lat=lat, altitude_m=altitude_m))
            order += 1
    return waypoints


def calculate_stats(
    waypoints: list[Waypoint], polygon_geojson: dict, specs: DroneSpec, speed_ms: float
) -> FlightStats:
    polygon = _extract_polygon(polygon_geojson)
    lons, lats = zip(*list(polygon.exterior.coords), strict=False)
    area_m2, _ = GEOD.polygon_area_perimeter(lons, lats)

    total_distance = 0.0
    for previous, current in zip(waypoints, waypoints[1:], strict=False):
        _, _, dist = GEOD.inv(previous.lon, previous.lat, current.lon, current.lat)
        total_distance += dist

    duration = total_distance / speed_ms if speed_ms > 0 else 0.0
    _ = specs
    return FlightStats(
        area_m2=abs(area_m2),
        distance_m=total_distance,
        estimated_duration_s=duration,
        strip_count=max(1, len(waypoints) // 2),
        waypoint_count=len(waypoints),
    )
