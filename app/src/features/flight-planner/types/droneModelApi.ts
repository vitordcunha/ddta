/** Resposta de `GET /api/v1/drone-models` (espelha DroneModelRead no backend). */
export type ApiDroneModel = {
  id: string
  name: string
  manufacturer: string
  is_default: boolean
  is_custom: boolean
  sensor_width_mm: number
  sensor_height_mm: number
  focal_length_mm: number
  image_width_px: number
  image_height_px: number
  fov_horizontal_deg: number
  fov_vertical_deg: number
  gimbal_pitch_min: number
  gimbal_pitch_max: number
  max_speed_ms: number
  max_altitude_m: number
  created_at: string
  updated_at: string
}

export type ApiDroneModelCreate = {
  name: string
  manufacturer: string
  sensor_width_mm: number
  sensor_height_mm: number
  focal_length_mm: number
  image_width_px: number
  image_height_px: number
  gimbal_pitch_min?: number
  gimbal_pitch_max?: number
  max_speed_ms: number
  max_altitude_m: number
}

export type ApiDroneModelUpdate = Partial<Omit<ApiDroneModelCreate, never>>
