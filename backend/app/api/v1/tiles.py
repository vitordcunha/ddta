import io
import json
from pathlib import Path
from uuid import UUID

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.project import Project
from app.dependencies import get_db

router = APIRouter(tags=["tiles"])


def _find_ortho(assets: dict | None) -> str | None:
    if not assets:
        return None
    for key, path in assets.items():
        if "odm_orthophoto.tif" in key.lower():
            return path
    return None


def _assets_for_source_and_run(project: Project, source: str, run_id: str | None) -> dict | None:
    if not run_id:
        if source == "preview":
            return project.preview_assets
        if source == "full":
            return project.assets
        return None
    if source == "preview":
        for entry in project.preview_runs or []:
            if isinstance(entry, dict) and entry.get("run_id") == run_id:
                return entry.get("preview_assets") if isinstance(entry.get("preview_assets"), dict) else None
        return None
    if source == "full":
        for entry in project.processing_runs or []:
            if isinstance(entry, dict) and entry.get("run_id") == run_id:
                return entry.get("assets") if isinstance(entry.get("assets"), dict) else None
        return None
    return None


def _resolve_orthophoto_path(project: Project, source: str, run_id: str | None = None) -> str | None:
    if run_id:
        assets = _assets_for_source_and_run(project, source, run_id)
        return _find_ortho(assets)
    if source == "preview":
        return _find_ortho(project.preview_assets)
    if source == "full":
        return _find_ortho(project.assets)
    # auto: prefer full over preview
    return _find_ortho(project.assets) or _find_ortho(project.preview_assets)


def _find_dem_asset(assets: dict | None, dem_type: str) -> str | None:
    """Find DSM or DTM path in assets. dem_type: 'dsm' or 'dtm'."""
    if not assets:
        return None
    target = f"{dem_type}.tif"
    for key, path in assets.items():
        normalized = key.lower().replace("\\", "/")
        if normalized.endswith(target):
            return path
    return None


def _render_dem_tile(dem_path: str, x: int, y: int, z: int, colormap_name: str) -> bytes:
    from rio_tiler.colormap import cmap
    from rio_tiler.errors import TileOutsideBounds
    from rio_tiler.io import COGReader

    colormap = cmap.get(colormap_name)
    try:
        with COGReader(dem_path) as cog:
            img = cog.tile(x, y, z, tilesize=256)
    except TileOutsideBounds:
        return _empty_png_tile()

    # Normalize per-tile so the colormap covers the visible elevation range
    valid = img.data[0][img.mask == 255]
    if valid.size > 0:
        vmin = float(np.percentile(valid, 2))
        vmax = float(np.percentile(valid, 98))
        if vmax > vmin:
            img.rescale(in_range=((vmin, vmax),))

    return img.render(img_format="PNG", colormap=colormap)


def _empty_png_tile() -> bytes:
    from PIL import Image as PILImage

    img = PILImage.new("RGBA", (256, 256), (0, 0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@router.get("/projects/{project_id}/tiles/{z}/{x}/{y}.png")
async def get_project_tile(
    project_id: UUID,
    z: int,
    x: int,
    y: int,
    source: str = Query(default="auto", description="'preview' | 'full' | 'auto'"),
    run_id: str | None = Query(
        default=None,
        description="Orthophoto de uma execução arquivada (exige source=full ou preview).",
    ),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """
    Serve XYZ tiles from the project orthophoto via COG.
    source=auto uses preview if available, full if completed.
    Com run_id, usa os assets dessa entrada em processing_runs ou preview_runs.
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if run_id and source == "auto":
        raise HTTPException(
            status_code=400,
            detail="Informe source=full ou source=preview quando usar run_id",
        )

    ortho_path = _resolve_orthophoto_path(project, source, run_id)
    if not ortho_path:
        raise HTTPException(status_code=404, detail="No orthophoto available")

    if not Path(ortho_path).exists():
        raise HTTPException(status_code=404, detail="Orthophoto file not found on disk")

    try:
        from rio_tiler.errors import TileOutsideBounds
        from rio_tiler.io import COGReader

        with COGReader(ortho_path) as cog:
            img = cog.tile(x, y, z, tilesize=256)
        png_bytes = img.render(img_format="PNG")
        return Response(
            content=png_bytes,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=3600"},
        )
    except Exception as exc:
        # Import here to avoid circular import issues at module level
        try:
            from rio_tiler.errors import TileOutsideBounds

            if isinstance(exc, TileOutsideBounds):
                return Response(content=_empty_png_tile(), media_type="image/png")
        except ImportError:
            pass
        raise HTTPException(status_code=500, detail=f"Tile rendering error: {exc}") from exc


@router.get("/projects/{project_id}/dsm-tiles/{z}/{x}/{y}.png")
async def get_project_dsm_tile(
    project_id: UUID,
    z: int,
    x: int,
    y: int,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Serve XYZ tiles from the project DSM (Digital Surface Model) via COG with terrain colormap."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    dsm_path = _find_dem_asset(project.assets, "dsm")
    if not dsm_path:
        raise HTTPException(status_code=404, detail="DSM not available for this project")
    if not Path(dsm_path).exists():
        raise HTTPException(status_code=404, detail="DSM file not found on disk")

    try:
        png_bytes = _render_dem_tile(dsm_path, x, y, z, colormap_name="terrain")
        return Response(
            content=png_bytes,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=3600"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DSM tile rendering error: {exc}") from exc


@router.get("/projects/{project_id}/dtm-tiles/{z}/{x}/{y}.png")
async def get_project_dtm_tile(
    project_id: UUID,
    z: int,
    x: int,
    y: int,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Serve XYZ tiles from the project DTM (Digital Terrain Model) via COG with earth colormap."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    dtm_path = _find_dem_asset(project.assets, "dtm")
    if not dtm_path:
        raise HTTPException(status_code=404, detail="DTM not available for this project")
    if not Path(dtm_path).exists():
        raise HTTPException(status_code=404, detail="DTM file not found on disk")

    try:
        png_bytes = _render_dem_tile(dtm_path, x, y, z, colormap_name="gist_earth")
        return Response(
            content=png_bytes,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=3600"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DTM tile rendering error: {exc}") from exc


@router.get("/projects/{project_id}/contours")
async def get_project_contours(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Return the project contour lines as GeoJSON."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    contours_path: str | None = None
    if project.assets:
        contours_path = project.assets.get("contours")

    if not contours_path:
        raise HTTPException(status_code=404, detail="Contours not available for this project")
    if not Path(contours_path).exists():
        raise HTTPException(status_code=404, detail="Contours file not found on disk")

    try:
        geojson_bytes = Path(contours_path).read_bytes()
        return Response(
            content=geojson_bytes,
            media_type="application/geo+json",
            headers={"Cache-Control": "public, max-age=3600"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error reading contours: {exc}") from exc
