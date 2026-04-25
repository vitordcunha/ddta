import { describe, expect, it, vi, afterEach } from 'vitest'
import { fetchRainViewerRadarTileUrlTemplate } from '@/components/map/weather/fetchRainViewerRadarTemplate'

describe('fetchRainViewerRadarTileUrlTemplate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('monta URL a partir do ultimo frame past e host', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          host: 'https://tilecache.rainviewer.com',
          radar: {
            past: [{ path: '/v2/radar/aaa' }, { path: '/v2/radar/bbb' }],
          },
        }),
      })) as unknown as typeof fetch,
    )

    const url = await fetchRainViewerRadarTileUrlTemplate()
    expect(url).toBe(
      'https://tilecache.rainviewer.com/v2/radar/bbb/256/{z}/{x}/{y}/2/1_1.png',
    )
  })

  it('usa host padrao quando ausente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          radar: { past: [{ path: '/x/one' }] },
        }),
      })) as unknown as typeof fetch,
    )

    const url = await fetchRainViewerRadarTileUrlTemplate()
    expect(url).toBe('https://tilecache.rainviewer.com/x/one/256/{z}/{x}/{y}/2/1_1.png')
  })

  it('rejeita quando HTTP falha', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503 })) as unknown as typeof fetch,
    )
    await expect(fetchRainViewerRadarTileUrlTemplate()).rejects.toThrow('HTTP 503')
  })
})
