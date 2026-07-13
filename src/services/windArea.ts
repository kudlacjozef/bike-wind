import type { GeoPoint, WeatherSample } from '../domain/types'
import { distanceKm } from '../domain/geo'
import { fetchWindSamples } from './openMeteo'

export const WIND_AREA_RADIUS_KM = 100
const GRID_STEPS_FROM_CENTER = 3

export interface AreaWindSample {
  point: GeoPoint
  weather: WeatherSample
}

export function nearestAreaWindSample(
  point: GeoPoint,
  samples: AreaWindSample[],
): AreaWindSample | undefined {
  let nearest: AreaWindSample | undefined
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const sample of samples) {
    const distance = distanceKm(point, sample.point)
    if (distance < nearestDistance) {
      nearest = sample
      nearestDistance = distance
    }
  }
  return nearest
}

export function buildWindAreaGrid(
  center: GeoPoint,
  radiusKm = WIND_AREA_RADIUS_KM,
  stepsFromCenter = GRID_STEPS_FROM_CENTER,
): GeoPoint[] {
  const safeSteps = Math.max(1, Math.round(stepsFromCenter))
  const stepKm = radiusKm / safeSteps
  const latitudeKmPerDegree = 110.574
  const longitudeKmPerDegree = Math.max(11.132, 111.32 * Math.cos((center.latitude * Math.PI) / 180))
  const points: GeoPoint[] = []

  for (let northStep = -safeSteps; northStep <= safeSteps; northStep += 1) {
    for (let eastStep = -safeSteps; eastStep <= safeSteps; eastStep += 1) {
      const northKm = northStep * stepKm
      const eastKm = eastStep * stepKm
      if (Math.hypot(northKm, eastKm) > radiusKm + 0.01) continue
      points.push({
        latitude: center.latitude + northKm / latitudeKmPerDegree,
        longitude: center.longitude + eastKm / longitudeKmPerDegree,
      })
    }
  }

  return points
}

export async function fetchWindArea(
  center: GeoPoint,
  targetTimeMs = Date.now(),
  signal?: AbortSignal,
): Promise<AreaWindSample[]> {
  const points = buildWindAreaGrid(center)
  const requests = points.map((point, index) => ({
    key: `area-${index}`,
    point,
    targetTimeMs,
  }))
  const weatherByKey = await fetchWindSamples(requests, 3, signal)

  return requests.map(({ key, point }) => {
    const weather = weatherByKey.get(key)
    if (!weather) throw new Error('The wind service returned incomplete area data.')
    return { point, weather }
  })
}
