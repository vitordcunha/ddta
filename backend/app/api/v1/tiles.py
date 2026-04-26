import io
from pathlib import Path
from uuid import UUID

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
