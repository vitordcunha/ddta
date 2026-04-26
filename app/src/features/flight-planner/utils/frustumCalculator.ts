import type { Waypoint } from '@/features/flight-planner/types/waypoint'
import { waypointDisplayAltitudeMeters } from '@/features/map-engine/layers/waypointDisplayAltitude'
import {
  defaultDroneCameraParams,
  type DroneCameraParams,
} from '@/features/flight-planner/utils/defaultDroneCamera'

const DEG2RAD = Math.PI / 180
const EARTH_MEAN_R_M = 6371008.8

export type FrustumGeometry = {
  apex: [number, number, number]
  /** Anel fechado lng/lat (primeiro ponto = último) no terreno. */
  footprintPolygon: [number, number][]
  /** Quatro faces laterais; cada uma é um anel triangular [lng,lat,alt] fechado. */
  sidePolygons: [number, number, number][][]
}

type Vec3 = [number, number, number]

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s]
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function len(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2])
}

function normalize(v: Vec3): Vec3 {
  const L = len(v)
  if (L < 1e-12) return [0, 0, 0]
  return [v[0] / L, v[1] / L, v[2] / L]
}

/** ENU em metros (east, north, up) a partir do waypoint: converte offset para [lng, lat]. */
function offsetMetersToLngLat(
  lat0: number,
  lng0: number,
  eastM: number,
  northM: number,
): [number, number] {
  const cosLat = Math.cos(lat0 * DEG2RAD)
  const dLat = (northM / EARTH_MEAN_R_M) * (180 / Math.PI)
  const dLng = (eastM / (EARTH_MEAN_R_M * Math.max(1e-6, cosLat))) * (180 / Math.PI)
  return [lng0 + dLng, lat0 + dLat]
}

function enuToLngLatAlt(
  lat0: number,
  lng0: number,
  zAmsl: number,
  enu: Vec3,
): [number, number, number] {
  const [lng, lat] = offsetMetersToLngLat(lat0, lng0, enu[0], enu[1])
  return [lng, lat, zAmsl]
}

/**
 * Base ortonormal: forward (boresight DJI), right, up (eixo “para cima” da imagem).
 * Heading 0° = norte, horário visto de cima.
 */
function cameraBasis(headingDeg: number, gimbalPitchDeg: number): { f: Vec3; r: Vec3; u: Vec3 } {
  const psi = headingDeg * DEG2RAD
  const p = gimbalPitchDeg * DEG2RAD
  const f: Vec3 = [Math.cos(p) * Math.sin(psi), Math.cos(p) * Math.cos(psi), Math.sin(p)]
  const z: Vec3 = [0, 0, 1]
  let r = cross(z, f)
  const horiz = Math.hypot(r[0], r[1])
  if (horiz < 1e-4) {
    r = [1, 0, 0]
  } else {
    r = normalize(r)
  }
  let camUp = cross(f, r)
  camUp = normalize(camUp)
  r = normalize(cross(camUp, f))
  return { f, r, u: camUp }
}

function groundPlaneAmsl(w: Waypoint, zDroneAmsl: number): number {
  const t = w.terrainElevation
  if (typeof t === 'number' && Number.isFinite(t)) return t
  if (w.altitudeMode === 'agl') return zDroneAmsl - Math.max(1, w.altitude)
  return zDroneAmsl - 50
}

/**
 * Calcula frustum a partir do waypoint, FOV e atitude (heading / gimbal).
 * Terreno aproximado por plano AMSL em `terrainElevation` do waypoint (ou fallback).
 */
export function computeFrustumGeometry(
  waypoint: Waypoint,
  camera: DroneCameraParams = defaultDroneCameraParams(),
): FrustumGeometry | null {
  const lat0 = waypoint.lat
  const lng0 = waypoint.lng
  const zDrone = waypointDisplayAltitudeMeters(waypoint)
  const zGround = groundPlaneAmsl(waypoint, zDrone)
  const H = Math.max(1, zDrone - zGround)

  const pitchRad = waypoint.gimbalPitch * DEG2RAD
  const cosP = Math.cos(pitchRad)
  const cosClamped = Math.max(0.05, cosP)
  const d = Math.min(8000, H / cosClamped)

  const hfov = camera.fovHorizontalDeg * DEG2RAD
  const vfov = camera.fovVerticalDeg * DEG2RAD
  const hw = d * Math.tan(hfov / 2)
  const hh = d * Math.tan(vfov / 2)

  const { f, r, u } = cameraBasis(waypoint.heading, waypoint.gimbalPitch)
  const apexEnu: Vec3 = [0, 0, H]
  const O = apexEnu

  const cornersIdx: [number, number][] = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ]

  const groundEnu: Vec3[] = []
  for (const [ix, iy] of cornersIdx) {
    const Q = add(O, add(add(scale(f, d), scale(r, ix * hw)), scale(u, iy * hh)))
    const dir = normalize(sub(Q, O))
    const wz = dir[2]
    // Use wz when it points clearly downward; clamp to -0.001 when near-horizontal
    // or upward to prevent infinite / negative lambda (max range ~15 km).
    const wzUse = wz < -0.001 ? wz : -0.001
    const lam = -H / wzUse
    const maxLam = 15000
    const lamClamped = Math.min(maxLam, Math.max(0, lam))
    groundEnu.push([lamClamped * dir[0], lamClamped * dir[1], 0])
  }

  const footprintLngLat: [number, number][] = groundEnu.map((g) =>
    offsetMetersToLngLat(lat0, lng0, g[0], g[1]),
  )
  const closed: [number, number][] = [...footprintLngLat, footprintLngLat[0]!]

  const apex: [number, number, number] = [lng0, lat0, zDrone]

  const groundVerts: [number, number, number][] = groundEnu.map((g) =>
    enuToLngLatAlt(lat0, lng0, zGround, g),
  )

  const sidePolygons: [number, number, number][][] = []
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    const a = apex
    const b = groundVerts[i]!
    const c = groundVerts[j]!
    sidePolygons.push([a, b, c, a])
  }

  return {
    apex,
    footprintPolygon: closed,
    sidePolygons,
  }
}
