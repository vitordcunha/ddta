# Phase-1 options for selective processing: fast SfM only, generates reconstruction.json
# so the sparse cloud is available for boundary selection. No dense reconstruction.
SPARSE_PHASE_OPTIONS: dict = {
    "orthophoto-resolution": 20,
    "pc-quality": "lowest",
    "feature-quality": "low",
    "fast-orthophoto": True,
    "skip-3dmodel": True,
    "skip-report": True,
    "min-num-features": 5000,
    "dtm": False,
    "dsm": False,
}

FAST_PREVIEW_OPTIONS: dict = {
    "fast-orthophoto": True,
    "orthophoto-resolution": 5,
    "pc-quality": "lowest",
    "feature-quality": "medium",
    "mesh-octree-depth": 9,
    "dtm": False,
    "dsm": False,
    "skip-report": True,
    "min-num-features": 6000,
    "resize-to": 2048,
    "skip-3dmodel": True,
}

PROCESSING_PRESETS: dict[str, dict] = {
    "fast": {
        "orthophoto-resolution": 5,
        "pc-quality": "low",
        "feature-quality": "low",
        "dtm": False,
        "fast-orthophoto": True,
        "skip-3dmodel": True,
        "skip-report": True,
        "ignore-gsd": True,
    },
    "standard": {
        "orthophoto-resolution": 2,
        "pc-quality": "medium",
        "feature-quality": "medium",
        "dtm": True,
        "dsm": True,
        "skip-3dmodel": True,
        "skip-report": True,
    },
    "ultra": {
        "orthophoto-resolution": 1,
        "pc-quality": "ultra",
        "dtm": True,
        "dsm": True,
        "skip-report": True,
    },
}


def get_odm_options(preset: str, extra_options: dict | None = None) -> dict:
    if preset not in PROCESSING_PRESETS:
        raise ValueError(f"Unsupported preset '{preset}'")
    options = dict(PROCESSING_PRESETS[preset])
    if extra_options:
        options.update(extra_options)
    return options
