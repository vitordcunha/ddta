from pathlib import Path


def convert_to_cog(tif_path: Path) -> None:
    try:
        from rio_cogeo.cogeo import cog_translate  # type: ignore
        from rio_cogeo.profiles import cog_profiles  # type: ignore
        import rasterio  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("rio-cogeo/rasterio not available for COG conversion.") from exc

    tmp_path = tif_path.with_suffix(".tmp.tif")
    profile = cog_profiles.get("deflate")
    with rasterio.open(tif_path) as src:
        cog_translate(src, str(tmp_path), profile, in_memory=False, quiet=True)
    tmp_path.replace(tif_path)
