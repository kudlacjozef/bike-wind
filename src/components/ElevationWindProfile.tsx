import { buildElevationProfile, type ElevationProfilePoint } from '../domain/elevationProfile'
import { groupRouteByWind, type WindEffect } from '../domain/mapRoute'
import type { GeoPoint, SegmentWind } from '../domain/types'

const CHART_WIDTH = 640
const CHART_HEIGHT = 170
const CHART_TOP = 10
const CHART_BOTTOM = 12
const MAX_PROFILE_POINTS = 360

function effectClass(effect: WindEffect): string {
  return `elevation-profile__line--${effect}`
}

function sampleIndices(startIndex: number, endIndex: number, totalPointCount: number): number[] {
  const length = endIndex - startIndex + 1
  const allowance = Math.max(2, Math.round((length / totalPointCount) * MAX_PROFILE_POINTS))
  const step = Math.max(1, Math.ceil((length - 1) / (allowance - 1)))
  const indices: number[] = []
  for (let index = startIndex; index <= endIndex; index += step) indices.push(index)
  if (indices.at(-1) !== endIndex) indices.push(endIndex)
  return indices
}

function pointCoordinates(
  point: ElevationProfilePoint,
  totalDistanceKm: number,
  chartMinElevationM: number,
  chartElevationSpanM: number,
): string {
  const x = totalDistanceKm > 0 ? (point.distanceKm / totalDistanceKm) * CHART_WIDTH : 0
  const y = CHART_TOP + (
    (chartMinElevationM + chartElevationSpanM - point.elevationM) / chartElevationSpanM
  ) * (CHART_HEIGHT - CHART_TOP - CHART_BOTTOM)
  return `${x.toFixed(1)},${y.toFixed(1)}`
}

export function ElevationWindProfile({
  points,
  segments,
}: {
  points: GeoPoint[]
  segments: SegmentWind[]
}) {
  const profile = buildElevationProfile(points)
  if (!profile) {
    return (
      <section className="elevation-profile elevation-profile--empty" aria-label="Elevation and wind profile unavailable">
        <div>
          <h3>Elevation &amp; wind</h3>
          <span>No elevation data</span>
        </div>
        <p>This GPX does not include enough elevation points to draw the climbs and descents.</p>
      </section>
    )
  }

  const elevationRangeM = profile.maxElevationM - profile.minElevationM
  const chartElevationSpanM = Math.max(20, elevationRangeM * 1.16)
  const chartMinElevationM = profile.minElevationM - (chartElevationSpanM - elevationRangeM) / 2
  const profileGroups = groupRouteByWind(points, segments)
  const areaIndices = sampleIndices(0, profile.points.length - 1, profile.points.length)
  const areaLine = areaIndices.map((index) => {
    const point = profile.points[index]
    return point
      ? pointCoordinates(point, profile.totalDistanceKm, chartMinElevationM, chartElevationSpanM)
      : ''
  }).filter(Boolean).join(' ')
  const areaPoints = `0,${CHART_HEIGHT} ${areaLine} ${CHART_WIDTH},${CHART_HEIGHT}`

  return (
    <section className="elevation-profile" aria-label="Elevation profile colored by wind effect">
      <div className="elevation-profile__heading">
        <div>
          <span className="eyebrow">RIDE PROFILE</span>
          <h3>Elevation &amp; wind</h3>
        </div>
        <strong>{Math.round(profile.minElevationM)}–{Math.round(profile.maxElevationM)} m</strong>
      </div>
      <svg
        className="elevation-profile__chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line className="elevation-profile__grid" x1="0" y1="10" x2={CHART_WIDTH} y2="10" />
        <line className="elevation-profile__grid" x1="0" y1={CHART_HEIGHT / 2} x2={CHART_WIDTH} y2={CHART_HEIGHT / 2} />
        <line className="elevation-profile__grid" x1="0" y1={CHART_HEIGHT - CHART_BOTTOM} x2={CHART_WIDTH} y2={CHART_HEIGHT - CHART_BOTTOM} />
        <polygon className="elevation-profile__area" points={areaPoints} />
        {profileGroups.map((group, index) => {
          const indices = sampleIndices(group.startIndex, group.endIndex, profile.points.length)
          const linePoints = indices.map((pointIndex) => {
            const point = profile.points[pointIndex]
            return point
              ? pointCoordinates(point, profile.totalDistanceKm, chartMinElevationM, chartElevationSpanM)
              : ''
          }).filter(Boolean).join(' ')
          return (
            <polyline
              key={`${group.effect}-${group.startIndex}-${index}`}
              className={`elevation-profile__line ${effectClass(group.effect)}`}
              points={linePoints}
            />
          )
        })}
      </svg>
      <div className="elevation-profile__axis"><span>Start</span><span>Finish</span></div>
      <p>Rising line = climbing · color = wind on that section</p>
    </section>
  )
}
