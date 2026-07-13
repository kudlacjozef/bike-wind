import { describe, expect, it } from 'vitest'
import { prepareImportedRoute, routeNameFromFileName } from './gpx'

describe('routeNameFromFileName', () => {
  it('uses the GPX filename without its extension', () => {
    expect(routeNameFromFileName('Danube-loop.gpx')).toBe('Danube-loop')
    expect(routeNameFromFileName('Morning_Ride.GPX')).toBe('Morning_Ride')
  })

  it('falls back when the filename has no usable name', () => {
    expect(routeNameFromFileName('  .gpx')).toBe('Untitled route')
  })
})

describe('prepareImportedRoute', () => {
  it('updates a legacy embedded name when the same GPX is reimported', () => {
    const points = [
      { latitude: 48, longitude: 17 },
      { latitude: 48.1, longitude: 17.1 },
    ]
    const existing = {
      id: 'existing-id',
      name: 'Afternoon Ride',
      points,
      distanceKm: 10,
      favorite: false,
      importedAt: 'old',
    }
    const result = prepareImportedRoute(
      { name: 'Filename-Route', points: points.map((point) => ({ ...point })), distanceKm: 10 },
      [existing],
      'unused-new-id',
      'new',
    )

    expect(result.existingIndex).toBe(0)
    expect(result.route).toMatchObject({
      id: 'existing-id',
      name: 'Filename-Route',
      favorite: false,
      importedAt: 'new',
    })
  })
})
