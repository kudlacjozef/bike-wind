import { describe, expect, it } from 'vitest'
import {
  compassDirection,
  cyclingWindStrength,
  windComponents,
  windTravelDirection,
} from './wind'

describe('wind components', () => {
  it('recognizes a tailwind', () => {
    const result = windComponents(20, 270, 90)
    expect(result.alongKmh).toBeCloseTo(20)
    expect(result.crossKmh).toBeCloseTo(0)
  })

  it('recognizes a headwind', () => {
    const result = windComponents(20, 90, 90)
    expect(result.alongKmh).toBeCloseTo(-20)
  })

  it('recognizes a crosswind', () => {
    const result = windComponents(20, 0, 90)
    expect(Math.abs(result.crossKmh)).toBeCloseTo(20)
    expect(result.alongKmh).toBeCloseTo(0)
  })

  it('converts meteorological wind-from direction into visible airflow direction', () => {
    expect(windTravelDirection(270)).toBe(90)
    expect(compassDirection(270)).toBe('W')
    expect(compassDirection(45)).toBe('NE')
  })

  it('classifies riding impact using sustained wind and gusts', () => {
    expect(cyclingWindStrength(7, 10)).toBe('weak')
    expect(cyclingWindStrength(14, 20)).toBe('noticeable')
    expect(cyclingWindStrength(16, 35)).toBe('strong')
    expect(cyclingWindStrength(25, 48)).toBe('very-strong')
  })
})
