import subprocess
import sys
from pathlib import Path

# ContourGenerate runs in an isolated subprocess to avoid fork-safety crashes
# with GDAL/libproj SQLite state inherited from Celery fork (same issue as cog_converter).
_CONTOUR_SCRIPT = """
import sys
from pathlib import Path
from osgeo import gdal, ogr

dtm_path = Path(sys.argv[1])
output_path = Path(sys.argv[2])
interval_m = float(sys.argv[3])

ds = gdal.Open(str(dtm_path))
if ds is None:
    sys.exit(1)

output_path.parent.mkdir(parents=True, exist_ok=True)
geojson_driver = gdal.GetDriverByName("GeoJSON")
contour_ds = geojson_driver.Create(str(output_path), 0, 0, 0, gdal.GDT_Unknown)
contour_layer = contour_ds.CreateLayer("contours")
contour_layer.CreateField(ogr.FieldDefn("elev", ogr.OFTReal))

gdal.ContourGenerate(
    ds.GetRasterBand(1),
    interval_m,
    0.0,
    [],
    0,
    0.0,
    contour_layer,
    -1,
    0,
)
contour_ds = None
ds = None
"""


def generate_contours(dtm_path: Path, output_path: Path, interval_m: float = 1.0) -> str | None:
    result = subprocess.run(
        [sys.executable, "-c", _CONTOUR_SCRIPT, str(dtm_path), str(output_path), str(interval_m)],
        capture_output=True,
        text=True,
        timeout=600,
    )
    if result.returncode != 0:
        return None
    return str(output_path) if output_path.exists() else None
