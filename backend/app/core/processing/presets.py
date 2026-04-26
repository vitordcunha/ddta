FAST_PREVIEW_OPTIONS: dict = {
    "orthophoto-resolution": 8,
    "pc-quality": "lowest",
    "feature-quality": "lowest",
    "mesh-octree-depth": 9,
    "dtm": False,
    "dsm": False,
    "fast-orthophoto": True,
    "skip-report": True,
    "min-num-features": 4000,
}

PROCESSING_PRESETS: dict[str, dict] = {
    "fast": {
        "orthophoto-resolution": 5,
        "pc-quality": "low",
        "dtm": False,
    },
    "standard": {
        "orthophoto-resolution": 2,
        "pc-quality": "medium",
        "dtm": True,
    },
    "ultra": {
        "orthophoto-resolution": 1,
        "pc-quality": "ultra",
        "dtm": True,
    },
}


def get_odm_options(preset: str, extra_options: dict | None = None) -> dict:
    if preset not in PROCESSING_PRESETS:
        raise ValueError(f"Unsupported preset '{preset}'")
    options = dict(PROCESSING_PRESETS[preset])
    if extra_options:
        options.update(extra_options)
    return options
