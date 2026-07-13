import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StoredRoute } from '../domain/types'
import { analyzeRoutes } from './analyzeRoutes'

afterEach(() => vi.unstubAllGlobals())

describe('route analysis', () => {
  it('calculates normal and reverse directions in route order', async () => {
    const route: StoredRoute = {
      id: 'test-route',
      name: 'East road',
      favorite: true,
      importedAt: '2026-01-01T00:00:00Z',
      distanceKm: 22,
      points: [
        { latitude: 48, longitude: 17 },
        { latitude: 48, longitude: 17.3 },
      ],
    }

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input))
        const locationCount = url.searchParams.get('latitude')?.split(',').length ?? 1
        const location = {
          hourly: {
            time: [0],
            wind_speed_10m: [20],
            wind_direction_10m: [270],
            wind_gusts_10m: [28],
          },
        }
        return {
          ok: true,
          status: 200,
          json: async () => Array.from({ length: locationCount }, () => location),
        }
      })
    vi.stubGlobal('fetch', fetchMock)

    const results = await analyzeRoutes([route], 24, { startTimeMs: Date.now() + 4 * 3_600_000 })
    expect(results).toHaveLength(2)
    expect(results[0]?.direction).toBe('forward')
    expect(results[1]?.direction).toBe('reverse')
    expect(results[0]?.segments.length).toBeGreaterThan(20)
    expect(results[0]?.averageTailwindKmh).toBeGreaterThan(19)
    expect(results[1]?.averageHeadwindKmh).toBeGreaterThan(19)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(requestedUrl.searchParams.get('latitude')?.split(',')).toHaveLength(results[0]?.segments.length ?? 0)
    expect(Number(requestedUrl.searchParams.get('forecast_hours'))).toBeGreaterThanOrEqual(7)
  })
})
