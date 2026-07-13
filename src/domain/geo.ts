import type { GeoPoint, RouteSample } from './types'

const EARTH_RADIUS_KM = 6371.0088

const radians = (degrees: number) => (degrees * Math.PI) / 180
const degrees = (radiansValue: number) => (radiansValue * 180) / Math.PI

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const lat1 = radians(a.latitude)
  const lat2 = radians(b.latitude)
  const deltaLat = lat2 - lat1
  const deltaLon = radians(b.longitude - a.longitude)
  const sinLat = Math.sin(deltaLat / 2)
  const sinLon = Math.sin(deltaLon / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function routeDistanceKm(points: GeoPoint[]): number {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    if (previous && current) total += distanceKm(previous, current)
  }
  return total
}

export function bearingDegrees(a: GeoPoint, b: GeoPoint): number {
  const lat1 = radians(a.latitude)
  const lat2 = radians(b.latitude)
  const deltaLon = radians(b.longitude - a.longitude)
  const y = Math.sin(deltaLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon)
  return (degrees(Math.atan2(y, x)) + 360) % 360
}

function interpolate(a: GeoPoint, b: GeoPoint, fraction: number): GeoPoint {
  const elevation =
    a.elevation !== undefined && b.elevation !== undefined
      ? a.elevation + (b.elevation - a.elevation) * fraction
      : undefined

  return {
    latitude: a.latitude + (b.latitude - a.latitude) * fraction,
    longitude: a.longitude + (b.longitude - a.longitude) * fraction,
    ...(elevation === undefined ? {} : { elevation }),
  }
}

export function sampleRoute(points: GeoPoint[], intervalKm = 1): RouteSample[] {
  const first = points[0]
  if (!first) return []
  if (points.length === 1) return [{ point: first, distanceFromStartKm: 0 }]

  const samples: RouteSample[] = [{ point: first, distanceFromStartKm: 0 }]
  let totalDistance = 0
  let nextTarget = intervalKm

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]
    const end = points[index]
    if (!start || !end) continue
    const segmentDistance = distanceKm(start, end)
    if (segmentDistance === 0) continue

    while (totalDistance + segmentDistance >= nextTarget) {
      const fraction = (nextTarget - totalDistance) / segmentDistance
      samples.push({ point: interpolate(start, end, fraction), distanceFromStartKm: nextTarget })
      nextTarget += intervalKm
    }
    totalDistance += segmentDistance
  }

  const last = points[points.length - 1]
  if (last && totalDistance - (samples.at(-1)?.distanceFromStartKm ?? 0) > 0.05) {
    samples.push({ point: last, distanceFromStartKm: totalDistance })
  }
  return samples
}

export function midpoint(a: GeoPoint, b: GeoPoint): GeoPoint {
  return interpolate(a, b, 0.5)
}
