import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWindSamples } from './openMeteo'

afterEach(() => vi.unstubAllGlobals())

function successfulForecast(locationCount = 1) {
  const location = {
    hourly: {
      time: [0, 3_600],
      wind_speed_10m: [10, 20],
      wind_direction_10m: [90, 180],
      wind_gusts_10m: [15, 28],
    },
  }
  return {
    ok: true,
    status: 200,
    json: async () => locationCount === 1
      ? location
      : Array.from({ length: locationCount }, () => location),
  }
}

describe('Open-Meteo wind requests', () => {
  it('requests a shared location once and caches its hourly results', async () => {
    const fetchMock = vi.fn(async () => successfulForecast())
    vi.stubGlobal('fetch', fetchMock)
    const point = { latitude: 47.12345, longitude: 18.54321 }
    const requests = [
      { key: 'outbound', point, targetTimeMs: 0 },
      { key: 'return', point, targetTimeMs: 3_600_000 },
    ]

    const first = await fetchWindSamples(requests, 3)
    const second = await fetchWindSamples(requests, 3)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first.get('outbound')?.speedKmh).toBe(10)
    expect(first.get('return')?.speedKmh).toBe(20)
    expect(second.get('return')?.speedKmh).toBe(20)
  })

  it('briefly retries a rate-limited request', async () => {
    const rateLimited = {
      ok: false,
      status: 429,
      headers: { get: () => '0' },
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(rateLimited)
      .mockResolvedValueOnce(rateLimited)
      .mockResolvedValueOnce(successfulForecast())
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchWindSamples([{
      key: 'retry',
      point: { latitude: 46.98765, longitude: 19.12345 },
      targetTimeMs: 0,
    }], 3)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result.get('retry')?.speedKmh).toBe(10)
  })
})
