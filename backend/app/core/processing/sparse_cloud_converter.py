import json
from math import cos, radians
from pathlib import Path


def reconstruction_to_geojson(reconstruction_path: Path, output_path: Path) -> Path:
    """
    Convert OpenSfM reconstruction.json to a GeoJSON FeatureCollection of georeferenced points.
    Applies uniform sampling to cap at 50k points for web performance.
    """
    with open(reconstruction_path) as f:
        reconstruction = json.load(f)

    MAX_POINTS = 50_000
    features = []

    for recon in reconstruction:
        points = recon.get("points", {})
        coords = recon.get("reference_lla", {})
        ref_lat = coords.get("latitude", 0)
        ref_lon = coords.get("longitude", 0)
        ref_alt = coords.get("altitude", 0)

        all_points = list(points.values())
        step = max(1, len(all_points) // MAX_POINTS)
        sampled = all_points[::step]

        cos_lat = cos(radians(ref_lat)) or 1e-10  # avoid division by zero near poles

        for pt in sampled:
            coords_xyz = pt.get("coordinates")
            if not coords_xyz or len(coords_xyz) < 3:
                continue
            x, y, z = coords_xyz
            # Approximate local→geographic conversion (planar, valid for small areas <5 km)
            lat = ref_lat + (y / 111_320)
            lon = ref_lon + (x / (111_320 * cos_lat))
            alt = ref_alt + z

            features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [lon, lat, alt]},
                    "properties": {"color": pt.get("color", [128, 128, 128])},
                }
            )

    geojson = {"type": "FeatureCollection", "features": features}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(geojson, f)

    return output_path
