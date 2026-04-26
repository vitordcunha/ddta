import type { IElevationService } from "@/features/flight-planner/types/elevationService";
import {
  idbElevationKeyForPoint,
  idbGetElevationM,
  idbSetElevationM,
} from "@/features/flight-planner/services/elevationIdbCache";

const TERRAIN_TILESET = "mapbox.mapbox-terrain-dem-v1";
const TERRAIN_ZOOM = 14;
const DEG2RAD = Math.PI / 180;

/** Mapbox/Terrain-RGB: metros (aprox. MSL) */
export function rgbToElevationM(r: number, g: number, b: number): number {
  return -10_000 + (r * 256 * 256 + g * 256 + b) * 0.1;
}

export function cacheKeyForPoint(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function loadTerrainTilePng(
  z: number,
  x: number,
  y: number,
  accessToken: string,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = `https://api.mapbox.com/v4/${TERRAIN_TILESET}/${z}/${x}/${y}.pngraw?access_token=${encodeURIComponent(
      accessToken,
    )}`;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("terrain_tile_load"));
    img.src = url;
  });
}

/**
 * Ponto WGS84 (lat,lng) → píxel (px,py) inteiros no tile, tile WMTS.
 */
function lngLatToTilePixel(
  lat: number,
  lng: number,
  z: number,
  tileX: number,
  tileY: number,
  w: number,
  h: number,
): { px: number; py: number } {
  const n = 2 ** z;
  const xFloat = ((lng + 180) / 360) * n;
  const latRad = lat * DEG2RAD;
  const yFloat =
    ((1.0 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    n;
  const u = xFloat - tileX;
  const v = yFloat - tileY;
  const px = Math.min(w - 1, Math.max(0, Math.floor(u * w)));
  const py = Math.min(h - 1, Math.max(0, Math.floor(v * h)));
  return { px, py };
}

function sampleRgbFromImage(
  image: HTMLImageElement,
  px: number,
  py: number,
): [number, number, number] {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) return [0, 0, 0];
  g.drawImage(image, 0, 0);
  const d = g.getImageData(px, py, 1, 1).data;
  return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0];
}

type TileKey = string;

type Pending = { index: number; lat: number; lng: number };

/**
 * Elevation a partir de tiles RGB Mapbox, com L1 (memória) e L2 (IndexedDB, TTL 7d).
 */
export class MapboxElevationService implements IElevationService {
  private readonly cache = new Map<string, number>();

  private readonly accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  getElevations(points: Array<[number, number]>): Promise<number[]> {
    const token = this.accessToken.trim();
    if (!token.length) {
      return Promise.resolve(points.map(() => 0));
    }
    return this.getElevationsWithToken(points, token);
  }

  private async getElevationsWithToken(
    points: Array<[number, number]>,
    token: string,
  ): Promise<number[]> {
    const out: number[] = new Array(points.length);
    const pending: Pending[] = [];
    for (let i = 0; i < points.length; i += 1) {
      const [lat, lng] = points[i]!;
      const key = cacheKeyForPoint(lat, lng);
      const c = this.cache.get(key);
      if (c !== undefined) {
        out[i] = c;
        continue;
      }
      pending.push({ index: i, lat, lng });
    }
    if (pending.length === 0) {
      return out;
    }

    const idbResults = await Promise.all(
      pending.map(async (p) => {
        const k = idbElevationKeyForPoint(p.lat, p.lng);
        const m = await idbGetElevationM(k);
        return { p, m: m as number | undefined };
      }),
    );
    const still: Pending[] = [];
    for (const { p, m } of idbResults) {
      if (m !== undefined) {
        this.cache.set(cacheKeyForPoint(p.lat, p.lng), m);
        out[p.index] = m;
      } else {
        still.push(p);
      }
    }
    if (still.length === 0) {
      return out;
    }

    const z = TERRAIN_ZOOM;
    const n = 2 ** z;
    const byTile = new Map<TileKey, Pending[]>();
    for (const p of still) {
      const xFloat = ((p.lng + 180) / 360) * n;
      const latRad = p.lat * DEG2RAD;
      const yFloat =
        ((1.0 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
      const tx = Math.floor(xFloat);
      const ty = Math.floor(yFloat);
      const k = `${z}/${tx}/${ty}` as TileKey;
      if (!byTile.has(k)) byTile.set(k, []);
      byTile.get(k)!.push(p);
    }
    for (const [k, jobs] of byTile) {
      const [zs, tx, ty] = k.split("/").map(Number) as [number, number, number];
      let image: HTMLImageElement;
      try {
        image = await loadTerrainTilePng(zs, tx, ty, token);
      } catch {
        for (const j of jobs) {
          this.cache.set(cacheKeyForPoint(j.lat, j.lng), 0);
          out[j.index] = 0;
        }
        continue;
      }
      for (const j of jobs) {
        const { px, py } = lngLatToTilePixel(
          j.lat,
          j.lng,
          z,
          tx,
          ty,
          image.naturalWidth,
          image.naturalHeight,
        );
        const [r, g, b] = sampleRgbFromImage(image, px, py);
        const el = rgbToElevationM(r, g, b);
        this.cache.set(cacheKeyForPoint(j.lat, j.lng), el);
        out[j.index] = el;
        void idbSetElevationM(idbElevationKeyForPoint(j.lat, j.lng), el);
      }
    }
    return out;
  }
}

export function createMapboxElevationService(
  mapboxToken: string,
): IElevationService {
  return new MapboxElevationService(mapboxToken);
}