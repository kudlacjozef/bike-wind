import { bearingDegrees, distanceKm, routeDistanceKm } from './geo'
import type { GeoPoint, SegmentWind } from './types'

export type WindEffect = 'tailwind' | 'crosswind' | 'headwind'

export interface WindRouteGroup {
  effect: WindEffect
  points: GeoPoint[]
  startIndex: number
  endIndex: number
}

export interface DirectionAnchor {
  start: GeoPoint
  end: GeoPoint
  fraction: number
  bearingDegrees: number
}

export function windEffect(segment: SegmentWind): WindEffect {
  if (segment.alongKmh < -1) return 'headwind'
  if (segment.alongKmh > 1) return 'tailwind'
  return 'crosswind'
}

export function windJourneySequence(segments: SegmentWind[]): WindEffect[] {
  return segments.reduce<WindEffect[]>((sequence, segment) => {
    const effect = windEffect(segment)
    if (sequence.at(-1) !== effect) sequence.push(effect)
    return sequence
  }, [])
}

export function groupRouteByWind(points: GeoPoint[], segments: SegmentWind[]): WindRouteGroup[] {
  const firstPoint = points[0]
  const firstSegment = segments[0]
  if (!firstPoint || !firstSegment || points.length < 2) return []

  const groups: WindRouteGroup[] = []
  let weatherIndex = 0
  let weatherBoundaryKm = firstSegment.distanceKm
  let currentEffect = windEffect(firstSegment)
  let currentPoints: GeoPoint[] = [firstPoint]
  let routeDistanceKm = 0
  let currentStartIndex = 0

  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    const start = points[pointIndex - 1]
    const end = points[pointIndex]
    if (!start || !end) continue
    const pointSegmentDistanceKm = distanceKm(start, end)
    const midpointDistanceKm = routeDistanceKm + pointSegmentDistanceKm / 2

    while (weatherIndex < segments.length - 1 && midpointDistanceKm > weatherBoundaryKm) {
      weatherIndex += 1
      weatherBoundaryKm += segments[weatherIndex]?.distanceKm ?? 0
    }

    const effect = windEffect(segments[weatherIndex] ?? firstSegment)
    if (effect !== currentEffect) {
      groups.push({
        effect: currentEffect,
        points: currentPoints,
        startIndex: currentStartIndex,
        endIndex: pointIndex - 1,
      })
      currentPoints = [start, end]
      currentStartIndex = pointIndex - 1
      currentEffect = effect
    } else {
      currentPoints.push(end)
    }
    routeDistanceKm += pointSegmentDistanceKm
  }

  if (currentPoints.length > 1) {
    groups.push({
      effect: currentEffect,
      points: currentPoints,
      startIndex: currentStartIndex,
      endIndex: points.length - 1,
    })
  }
  return groups
}

export function routeDirectionAnchors(points: GeoPoint[], maximumMarkers = 12): DirectionAnchor[] {
  const totalDistanceKm = routeDistanceKm(points)
  if (totalDistanceKm <= 0 || points.length < 2) return []

  const markerCount = Math.min(maximumMarkers, Math.max(2, Math.round(totalDistanceKm / 5)))
  const intervalKm = totalDistanceKm / (markerCount + 1)
  const anchors: DirectionAnchor[] = []
  let travelledKm = 0
  let nextTargetKm = intervalKm

  for (let index = 1; index < points.length && anchors.length < markerCount; index += 1) {
    const start = points[index - 1]
    const end = points[index]
    if (!start || !end) continue
    const segmentDistanceKm = distanceKm(start, end)
    if (segmentDistanceKm === 0) continue

    while (travelledKm + segmentDistanceKm >= nextTargetKm && anchors.length < markerCount) {
      anchors.push({
        start,
        end,
        fraction: (nextTargetKm - travelledKm) / segmentDistanceKm,
        bearingDegrees: bearingDegrees(start, end),
      })
      nextTargetKm += intervalKm
    }
    travelledKm += segmentDistanceKm
  }
  return anchors
}
