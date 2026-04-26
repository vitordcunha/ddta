from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class DroneSpec:
    model: str
    sensor_width_mm: float
    sensor_height_mm: float
    focal_length_mm: float
    image_width_px: int
    image_height_px: int


DRONE_SPECS: dict[str, DroneSpec] = {
    "mini-4-pro": DroneSpec(
        model="Mini 4 Pro",
        sensor_width_mm=9.6,
        sensor_height_mm=7.2,
        focal_length_mm=6.7,
        image_width_px=8064,
        image_height_px=6048,
    ),
    "mini-5-pro": DroneSpec(
        model="Mini 5 Pro",
        sensor_width_mm=13.2,
        sensor_height_mm=8.8,
        focal_length_mm=7.33,
        image_width_px=8192,
        image_height_px=6144,
    ),
    "air-3": DroneSpec(
        model="Air 3",
        sensor_width_mm=9.6,
        sensor_height_mm=7.2,
        focal_length_mm=6.7,
        image_width_px=8064,
        image_height_px=6048,
    ),
    "mavic-3": DroneSpec(
        model="Mavic 3",
        sensor_width_mm=17.3,
        sensor_height_mm=13.0,
        focal_length_mm=12.3,
        image_width_px=5280,
        image_height_px=3956,
    ),
    "phantom-4": DroneSpec(
        model="Phantom 4",
        sensor_width_mm=13.2,
        sensor_height_mm=8.8,
        focal_length_mm=8.8,
        image_width_px=5472,
        image_height_px=3648,
    ),
}


def get_specs(model: str) -> DroneSpec:
    key = model.strip().lower()
    if key not in DRONE_SPECS:
        raise ValueError(f"Unsupported drone model: {model}")
    return DRONE_SPECS[key]
