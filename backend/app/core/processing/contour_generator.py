from pathlib import Path


def generate_contours(dtm_path: Path, output_path: Path, interval_m: float = 1.0) -> str | None:
    try:
        from osgeo import gdal, ogr  # type: ignore
    except Exception:  # pragma: no cover
        return None

    ds = gdal.Open(str(dtm_path))
    if ds is None:
        return None

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
    return str(output_path)
