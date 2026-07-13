import { describe, expect, it } from 'vitest'
import { buildWindAreaGrid, nearestAreaWindSample, visibleWindTarget } from './windArea'

describe('buildWindAreaGrid', () => {
  it('creates an evenly distributed grid inside a 100 km radius', () => {
    const center = { latitude: 48.1486, longitude: 17.1077 }
    const points = buildWindAreaGrid(center)

    expect(points).toHaveLength(29)
    expect(points).toContainEqual(center)

    for (const point of points) {
      const northKm = (point.latitude - center.latitude) * 110.574
      const eastKm = (point.longitude - center.longitude)
        * 111.32
        * Math.cos((center.latitude * Math.PI) / 180)
      expect(Math.hypot(northKm, eastKm)).toBeLessThanOrEqual(100.01)
    }
  })

  it('uses the closest forecast point for additional display arrows', () => {
    const west = {
      point: { latitude: 48.1, longitude: 16.8 },
      weather: { time: 1, speedKmh: 10, directionFromDegrees: 90, gustKmh: 15 },
    }
    const east = {
      point: { latitude: 48.1, longitude: 17.4 },
      weather: { time: 1, speedKmh: 20, directionFromDegrees: 270, gustKmh: 28 },
    }

    expect(nearestAreaWindSample({ latitude: 48.1, longitude: 17.32 }, [west, east])).toBe(east)
  })

  it('shows fewer arrows as the map zooms but never drops below five', () => {
    expect([-2, 0, 1, 2, 3, 4, 5, 8].map((zoom) => visibleWindTarget(zoom))).toEqual([
      29, 29, 20, 14, 10, 7, 5, 5,
    ])
  })
})
