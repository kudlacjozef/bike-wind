import { bearingDegrees, midpoint, sampleRoute } from '../domain/geo'
import type {
  GeoPoint,
  RouteAnalysis,
  RouteDirection,
  SegmentWind,
  StoredRoute,
} from '../domain/types'
import { summarizeSegments, windComponents } from '../domain/wind'
import { fetchWindSamples } from './openMeteo'

interface PendingSegment {
  key: string
  routeId: string
  routeName: string
  direction: RouteDirection
  start: GeoPoint
  end: GeoPoint
  distanceKm: number
  targetTimeMs: number
}

export const WEATHER_SAMPLE_INTERVAL_KM = 1

interface AnalyzeRoutesOptions {
  startTimeMs?: number
  signal?: AbortSignal
}

function makePendingSegments(
  route: StoredRoute,
  direction: RouteDirection,
  averageSpeedKmh: number,
  startTimeMs: number,
): PendingSegment[] {
  const points = direction === 'forward' ? route.points : [...route.points].reverse()
  const samples = sampleRoute(points, WEATHER_SAMPLE_INTERVAL_KM)
  const segments: PendingSegment[] = []

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]
    const current = samples[index]
    if (!previous || !current) continue
    const segmentDistance = current.distanceFromStartKm - previous.distanceFromStartKm
    const arrivalDistance = previous.distanceFromStartKm + segmentDistance / 2
    segments.push({
      key: `${route.id}:${direction}:${index}`,
      routeId: route.id,
      routeName: route.name,
      direction,
      start: previous.point,
      end: current.point,
      distanceKm: segmentDistance,
      targetTimeMs: startTimeMs + (arrivalDistance / averageSpeedKmh) * 3_600_000,
    })
  }
  return segments
}

export async function analyzeRoutes(
  routes: StoredRoute[],
  averageSpeedKmh: number,
  options: AnalyzeRoutesOptions = {},
): Promise<RouteAnalysis[]> {
  if (routes.length === 0) return []
  const requestTimeMs = Date.now()
  const startTimeMs = options.startTimeMs ?? requestTimeMs
  const pending = routes.flatMap((route) => [
    ...makePendingSegments(route, 'forward', averageSpeedKmh, startTimeMs),
    ...makePendingSegments(route, 'reverse', averageSpeedKmh, startTimeMs),
  ])
  const longestDurationHours = Math.max(...routes.map((route) => route.distanceKm / averageSpeedKmh))
  const departureDelayHours = Math.max(0, (startTimeMs - requestTimeMs) / 3_600_000)
  const forecastHours = Math.max(
    3,
    Math.min(384, Math.ceil(departureDelayHours + longestDurationHours) + 2),
  )
  const weather = await fetchWindSamples(
    pending.map((segment) => ({
      key: segment.key,
      point: midpoint(segment.start, segment.end),
      targetTimeMs: segment.targetTimeMs,
    })),
    forecastHours,
    options.signal,
  )

  const analyses: RouteAnalysis[] = []
  for (const route of routes) {
    for (const direction of ['forward', 'reverse'] as const) {
      const routeSegments = pending.filter(
        (segment) => segment.routeId === route.id && segment.direction === direction,
      )
      const segments: SegmentWind[] = routeSegments.map((segment) => {
        const forecast = weather.get(segment.key)
        if (!forecast) throw new Error('A route section is missing wind data.')
        const bearing = bearingDegrees(segment.start, segment.end)
        const components = windComponents(forecast.speedKmh, forecast.directionFromDegrees, bearing)
        return {
          start: segment.start,
          end: segment.end,
          distanceKm: segment.distanceKm,
          bearingDegrees: bearing,
          windSpeedKmh: forecast.speedKmh,
          windFromDegrees: forecast.directionFromDegrees,
          gustKmh: forecast.gustKmh,
          alongKmh: components.alongKmh,
          crossKmh: components.crossKmh,
          arrivalTime: forecast.time,
        }
      })
      const summary = summarizeSegments(segments)
      analyses.push({
        id: `${route.id}:${direction}`,
        routeId: route.id,
        routeName: route.name,
        direction,
        distanceKm: route.distanceKm,
        durationMinutes: Math.round((route.distanceKm / averageSpeedKmh) * 60),
        segments,
        ...summary,
      })
    }
  }
  return analyses
}
