"""UI helpers for sparse (SfM) cloud readiness during ODM processing."""


def sparse_cloud_track_payload(progress: int, status: str, sparse_available: bool) -> dict[str, int | str]:
    """
    Exposes a 0–100 sub-progress and a short hint for the client while the main job runs.

    With stock NodeODM, `opensfm/reconstruction.json` only exists on the API server until
    `download_assets` runs, so `sparse_cloud_available` typically flips after sync — usually
    in the final stretch. The track still follows overall ODM progress so the bar moves with the job.
    """
    if sparse_available:
        return {
            "sparse_cloud_track_progress": 100,
            "sparse_cloud_track_hint": "Nuvem esparsa (SfM) disponivel no mapa — camada Nuvem esparsa.",
        }
    st = (status or "").lower()
    if st not in ("processing", "queued"):
        return {"sparse_cloud_track_progress": 0, "sparse_cloud_track_hint": ""}

    p = max(0, min(100, int(progress)))
    # Rough phases aligned with typical ODM reporting (see PREVIEW_PLAN ~15–20% for SfM on node).
    if p < 15:
        sub = int(p / 15 * 35)
        hint = "Aproximando da fase SfM no ODM (~ate 15% do progresso reportado)."
    elif p < 25:
        sub = 35 + int((p - 15) / 10 * 25)
        hint = "Zona tipica do SfM; a nuvem esparsa fica disponivel apos sincronizar opensfm/reconstruction.json."
    elif p < 90:
        sub = 60 + int((p - 25) / 65 * 30)
        hint = "Processamento avancado; a nuvem esparsa aparece quando os artefactos OpenSfM forem obtidos."
    else:
        sub = 90 + int((p - 90) / 10 * 9)
        hint = "Etapa final (descarga/pos-processamento); a nuvem esparsa pode ficar disponivel agora."

    return {"sparse_cloud_track_progress": min(99, sub), "sparse_cloud_track_hint": hint}
