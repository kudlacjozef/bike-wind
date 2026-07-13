import { describe, expect, it } from 'vitest'
import { buildElevationProfile } from './elevationProfile'

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
