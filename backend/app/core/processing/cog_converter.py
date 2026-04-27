import subprocess
import sys
from pathlib import Path

# COG conversion runs in an isolated subprocess to avoid fork-safety crashes
# with native extensions (pyproj/rasterio/libproj SQLite state after Celery fork).
_COG_SCRIPT = """
import sys
from pathlib import Path
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles
import rasterio

tif_path = Path(sys.argv[1])
compression = sys.argv[2] if len(sys.argv) > 2 else "deflate"
tmp_path = tif_path.with_suffix(".tmp.tif")
profile = cog_profiles.get(compression)
with rasterio.open(tif_path) as src:
    cog_translate(src, str(tmp_path), profile, in_memory=False, quiet=True)
tmp_path.replace(tif_path)
"""


def convert_to_cog(tif_path: Path, compression: str = "deflate") -> None:
    result = subprocess.run(
        [sys.executable, "-c", _COG_SCRIPT, str(tif_path), compression],
        capture_output=True,
        text=True,
        timeout=1800,
    )
    if result.returncode != 0:
        raise RuntimeError(f"COG conversion failed:\n{result.stderr}")
