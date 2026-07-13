import { describe, expect, it } from 'vitest'
import type { GeoPoint, SegmentWind } from './types'
import { groupRouteByWind, routeDirectionAnchors, windJourneySequence } from './mapRoute'

function windSegment(alongKmh: number, distance: number): SegmentWind {
  return {
    start: { latitude: 48, longitude: 17 },
    end: { latitude: 48, longitude: 17.1 },
    distanceKm: distance,
    bearingDegrees: 90,
    windSpeedKmh: 20,
    windFromDegrees: 270,
    gustKmh: 28,
    alongKmh,
    crossKmh: 0,
    arrivalTime: 0,
  }
}

describe('full-resolution map route', () => {
  it('keeps all GPX points while assigning sampled wind sections', () => {
    const points: GeoPoint[] = Array.from({ length: 11 }, (_, index) => ({
      latitude: 48,
      longitude: 17 + index * 0.01,
    }))
    const groups = groupRouteByWind(points, [windSegment(12, 4), windSegment(-12, 4)])

    expect(groups).toHaveLength(2)
    expect(groups[0]?.effect).toBe('tailwind')
    expect(groups[1]?.effect).toBe('headwind')
    expect(new Set(groups.flatMap((group) => group.points))).toEqual(new Set(points))
    expect(groups.flatMap((group) => group.points)).toHaveLength(points.length + 1)
  })

  it('places direction arrows along both legs of an out-and-back route', () => {
    const points: GeoPoint[] = [
      { latitude: 48, longitude: 17 },
      { latitude: 48, longitude: 17.2 },
      { latitude: 48, longitude: 17 },
    ]
    const anchors = routeDirectionAnchors(points, 8)

    expect(anchors.length).toBeGreaterThanOrEqual(4)
    expect(anchors.length).toBeLessThanOrEqual(8)
    expect(anchors.some((anchor) => anchor.bearingDegrees > 80 && anchor.bearingDegrees < 100)).toBe(true)
    expect(anchors.some((anchor) => anchor.bearingDegrees > 260 && anchor.bearingDegrees < 280)).toBe(true)
  })

  it('compresses the ride into a chronological wind sequence', () => {
    const sequence = windJourneySequence([
      windSegment(-12, 1),
      windSegment(-8, 1),
      windSegment(9, 1),
      windSegment(11, 1),
      windSegment(-5, 1),
    ])
    expect(sequence).toEqual(['headwind', 'tailwind', 'headwind'])
  })
})
