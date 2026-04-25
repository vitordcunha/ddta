import { describe, expect, it } from 'vitest'
import { owmMapTileSlug } from '@/components/map/weather/mapWeatherTypes'

describe('owmMapTileSlug', () => {
  it('mapeia ids OWM para slugs da API de tiles', () => {
    expect(owmMapTileSlug('owm_wind')).toBe('wind_new')
    expect(owmMapTileSlug('owm_clouds')).toBe('clouds_new')
    expect(owmMapTileSlug('owm_precipitation')).toBe('precipitation_new')
    expect(owmMapTileSlug('owm_temp')).toBe('temp_new')
  })

  it('retorna null para camadas que nao sao OWM', () => {
    expect(owmMapTileSlug('none')).toBeNull()
    expect(owmMapTileSlug('radar')).toBeNull()
  })
})
