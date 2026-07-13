import { describe, expect, it } from 'vitest'
import {
  buildElevationProfile,
  closestElevationPointIndex,
  windSegmentAtDistance,
} from './elevationProfile'
import type { SegmentWind } from './types'

describe('buildElevationProfile', () => {
  it('keeps the elevation sequence in ride order', () => {
    const points = [
      { latitude: 48, longitude: 17, elevation: 120 },
      { latitude: 48, longitude: 17.01, elevation: 220 },
      { latitude: 48, longitude: 17.02, elevation: 160 },
    ]

    const forward = buildElevationProfile(points)
    const reverse = buildElevationProfile([...points].reverse())

    expect(forward?.points.map(({ elevationM }) => elevationM)).toEqual([120, 220, 160])
    expect(reverse?.points.map(({ elevationM }) => elevationM)).toEqual([160, 220, 120])
    expect(forward?.minElevationM).toBe(120)
    expect(forward?.maxElevationM).toBe(220)
  })

  it('interpolates occasional missing elevation values', () => {
    const profile = buildElevationProfile([
      { latitude: 48, longitude: 17, elevation: 100 },
      { latitude: 48, longitude: 17.01 },
      { latitude: 48, longitude: 17.02, elevation: 200 },
    ])

    expect(profile?.points[1]?.elevationM).toBeCloseTo(150, 0)
  })

  it('does not create a profile without enough elevation data', () => {
    expect(buildElevationProfile([
      { latitude: 48, longitude: 17 },
      { latitude: 48, longitude: 17.01, elevation: 100 },
    ])).toBeNull()
  })
})

describe('elevation profile selection', () => {
  it('finds the nearest profile point by distance', () => {
    const points = [
      { distanceKm: 0, elevationM: 100 },
      { distanceKm: 2, elevationM: 140 },
      { distanceKm: 5, elevationM: 180 },
    ]

    expect(closestElevationPointIndex(points, 0.2)).toBe(0)
    expect(closestElevationPointIndex(points, 1.6)).toBe(1)
    expect(closestElevationPointIndex(points, 4.7)).toBe(2)
  })

  it('returns the wind segment covering the selected distance', () => {
    const segment = (distanceKm: number, windSpeedKmh: number): SegmentWind => ({
      start: { latitude: 48, longitude: 17 },
      end: { latitude: 48, longitude: 17.01 },
      distanceKm,
      bearingDegrees: 0,
      windSpeedKmh,
      windFromDegrees: 180,
      gustKmh: windSpeedKmh + 5,
      alongKmh: -windSpeedKmh,
      crossKmh: 0,
      arrivalTime: 0,
    })
    const segments = [segment(2, 10), segment(3, 20)]

    expect(windSegmentAtDistance(segments, 1.5)?.windSpeedKmh).toBe(10)
    expect(windSegmentAtDistance(segments, 2.5)?.windSpeedKmh).toBe(20)
    expect(windSegmentAtDistance(segments, 9)?.windSpeedKmh).toBe(20)
  })
})
