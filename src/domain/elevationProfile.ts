import { distanceKm } from './geo'
import type { GeoPoint } from './types'

export interface ElevationProfilePoint {
  distanceKm: number
  elevationM: number
}

export interface ElevationProfile {
  points: ElevationProfilePoint[]
  minElevationM: number
  maxElevationM: number
  totalDistanceKm: number
}

export function buildElevationProfile(points: GeoPoint[]): ElevationProfile | null {
  if (points.length < 2) return null

  const knownIndices = points.flatMap((point, index) =>
    Number.isFinite(point.elevation) ? [index] : [])
  if (knownIndices.length < 2) return null

  const distances = [0]
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    distances.push((distances[index - 1] ?? 0) + (
      previous && current ? distanceKm(previous, current) : 0
    ))
  }

  let knownCursor = 0
  const profilePoints = points.map((point, index): ElevationProfilePoint => {
    const distance = distances[index] ?? 0
    if (Number.isFinite(point.elevation)) {
      while (knownIndices[knownCursor] !== undefined && knownIndices[knownCursor]! < index) {
        knownCursor += 1
      }
      return { distanceKm: distance, elevationM: point.elevation! }
    }

    while (knownIndices[knownCursor] !== undefined && knownIndices[knownCursor]! < index) {
      knownCursor += 1
    }
    const nextIndex = knownIndices[knownCursor]
    const previousIndex = knownIndices[Math.max(0, knownCursor - 1)]
    if (previousIndex === undefined && nextIndex === undefined) {
      return { distanceKm: distance, elevationM: 0 }
    }
    if (previousIndex === undefined || previousIndex >= index) {
      return { distanceKm: distance, elevationM: points[nextIndex!]?.elevation ?? 0 }
    }
    if (nextIndex === undefined || nextIndex <= index) {
      return { distanceKm: distance, elevationM: points[previousIndex]?.elevation ?? 0 }
    }

    const previousDistance = distances[previousIndex] ?? 0
    const nextDistance = distances[nextIndex] ?? previousDistance
    const span = nextDistance - previousDistance
    const fraction = span > 0 ? (distance - previousDistance) / span : 0
    const previousElevation = points[previousIndex]?.elevation ?? 0
    const nextElevation = points[nextIndex]?.elevation ?? previousElevation
    return {
      distanceKm: distance,
      elevationM: previousElevation + (nextElevation - previousElevation) * fraction,
    }
  })

  const elevations = profilePoints.map(({ elevationM }) => elevationM)
  return {
    points: profilePoints,
    minElevationM: Math.min(...elevations),
    maxElevationM: Math.max(...elevations),
    totalDistanceKm: profilePoints.at(-1)?.distanceKm ?? 0,
  }
}
