import { describe, expect, it } from 'vitest'
import { buildWindAreaGrid } from './windArea'

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
})
