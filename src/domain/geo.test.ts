import { describe, expect, it } from 'vitest'
import { bearingDegrees, distanceKm, sameRouteGeometry, sampleRoute } from './geo'

describe('route geometry', () => {
  it('calculates approximate distance between Bratislava coordinates', () => {
    const distance = distanceKm(
      { latitude: 48.1486, longitude: 17.1077 },
      { latitude: 48.2082, longitude: 17.1502 },
    )
    expect(distance).toBeGreaterThan(7)
    expect(distance).toBeLessThan(8)
  })

  it('calculates cardinal bearings', () => {
    expect(bearingDegrees({ latitude: 48, longitude: 17 }, { latitude: 49, longitude: 17 })).toBeCloseTo(0)
    expect(bearingDegrees({ latitude: 48, longitude: 17 }, { latitude: 48, longitude: 18 })).toBeCloseTo(89.6, 0)
  })

  it('samples a route and includes its endpoint', () => {
    const samples = sampleRoute(
      [
        { latitude: 48, longitude: 17 },
        { latitude: 48, longitude: 17.2 },
      ],
      5,
    )
    expect(samples.length).toBeGreaterThan(2)
    expect(samples[0]?.distanceFromStartKm).toBe(0)
    expect(samples.at(-1)?.point.longitude).toBe(17.2)
  })

  it('recognizes the same imported route geometry', () => {
    const points = [
      { latitude: 48, longitude: 17 },
      { latitude: 48.1, longitude: 17.1 },
    ]
    expect(sameRouteGeometry(points, points.map((point) => ({ ...point })))).toBe(true)
    expect(sameRouteGeometry(points, [...points].reverse())).toBe(false)
  })
})
