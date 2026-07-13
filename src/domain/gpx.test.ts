import { describe, expect, it } from 'vitest'
import { routeNameFromFileName } from './gpx'

describe('routeNameFromFileName', () => {
  it('uses the GPX filename without its extension', () => {
    expect(routeNameFromFileName('Danube-loop.gpx')).toBe('Danube-loop')
    expect(routeNameFromFileName('Morning_Ride.GPX')).toBe('Morning_Ride')
  })

  it('falls back when the filename has no usable name', () => {
    expect(routeNameFromFileName('  .gpx')).toBe('Untitled route')
  })
})
