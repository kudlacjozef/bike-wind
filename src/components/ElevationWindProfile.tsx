import { useRef } from 'react'
import {
  buildElevationProfile,
  closestElevationPointIndex,
  windSegmentAtDistance,
  type ElevationProfilePoint,
} from '../domain/elevationProfile'
import {
  groupRouteByWind,
  windEffect,
  windJourneySequence,
  type WindEffect,
} from '../domain/mapRoute'
import type { GeoPoint, SegmentWind } from '../domain/types'

const CHART_WIDTH = 640
const CHART_HEIGHT = 170
const CHART_TOP = 10
const CHART_BOTTOM = 12
const MAX_PROFILE_POINTS = 360
const SPARK_WIDTH = 320
const SPARK_HEIGHT = 58
const SPARK_TOP = 4
const SPARK_BOTTOM = 4
const MAX_SPARK_POINTS = 180

function effectClass(effect: WindEffect): string {
  return `elevation-profile__line--${effect}`
}

function sampleIndices(
  startIndex: number,
  endIndex: number,
  totalPointCount: number,
  maximumPoints = MAX_PROFILE_POINTS,
): number[] {
  const length = endIndex - startIndex + 1
  const allowance = Math.max(2, Math.round((length / totalPointCount) * maximumPoints))
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
): { x: number; y: number } {
  const x = totalDistanceKm > 0 ? (point.distanceKm / totalDistanceKm) * CHART_WIDTH : 0
  const y = CHART_TOP + (
    (chartMinElevationM + chartElevationSpanM - point.elevationM) / chartElevationSpanM
  ) * (CHART_HEIGHT - CHART_TOP - CHART_BOTTOM)
  return { x, y }
}

function pointCoordinatesText(
  point: ElevationProfilePoint,
  totalDistanceKm: number,
  chartMinElevationM: number,
  chartElevationSpanM: number,
): string {
  const { x, y } = pointCoordinates(
    point,
    totalDistanceKm,
    chartMinElevationM,
    chartElevationSpanM,
  )
  return `${x.toFixed(1)},${y.toFixed(1)}`
}

function sparkPointCoordinates(
  point: ElevationProfilePoint,
  totalDistanceKm: number,
  chartMinElevationM: number,
  chartElevationSpanM: number,
): string {
  const x = totalDistanceKm > 0 ? (point.distanceKm / totalDistanceKm) * SPARK_WIDTH : 0
  const y = SPARK_TOP + (
    (chartMinElevationM + chartElevationSpanM - point.elevationM) / chartElevationSpanM
  ) * (SPARK_HEIGHT - SPARK_TOP - SPARK_BOTTOM)
  return `${x.toFixed(1)},${y.toFixed(1)}`
}

function effectLabel(effect: WindEffect): string {
  if (effect === 'headwind') return 'Head'
  if (effect === 'tailwind') return 'Tail'
  return 'Cross'
}

function WindJourneyFallback({ segments }: { segments: SegmentWind[] }) {
  const sequence = windJourneySequence(segments)
  const startEffect = segments[0] ? windEffect(segments[0]) : 'crosswind'
  const finishEffect = segments.at(-1) ? windEffect(segments.at(-1)!) : 'crosswind'
  return (
    <div className="wind-journey" aria-label={`From start to finish: ${sequence.map(effectLabel).join(' → ')}`}>
      <div className="wind-journey__track">
        {segments.map((segment, index) => (
          <span
            key={`${segment.arrivalTime}-${index}`}
            className={`wind-journey__segment wind-journey__segment--${windEffect(segment)}`}
            style={{ flexGrow: segment.distanceKm }}
          />
        ))}
      </div>
      <div className="wind-journey__axis">
        <span><i className={`wind-endpoint wind-endpoint--${startEffect}`} />Start</span>
        <i aria-hidden="true">→</i>
        <span>Finish<i className={`wind-endpoint wind-endpoint--${finishEffect}`} /></span>
      </div>
    </div>
  )
}

export function ElevationWindSparkline({
  points,
  segments,
}: {
  points: GeoPoint[]
  segments: SegmentWind[]
}) {
  const profile = buildElevationProfile(points)
  if (!profile) return <WindJourneyFallback segments={segments} />

  const sequence = windJourneySequence(segments)
  const startEffect = segments[0] ? windEffect(segments[0]) : 'crosswind'
  const finishEffect = segments.at(-1) ? windEffect(segments.at(-1)!) : 'crosswind'
  const elevationRangeM = profile.maxElevationM - profile.minElevationM
  const chartElevationSpanM = Math.max(20, elevationRangeM * 1.16)
  const chartMinElevationM = profile.minElevationM - (chartElevationSpanM - elevationRangeM) / 2
  const profileGroups = groupRouteByWind(points, segments)
  const areaIndices = sampleIndices(
    0,
    profile.points.length - 1,
    profile.points.length,
    MAX_SPARK_POINTS,
  )
  const areaLine = areaIndices.map((index) => {
    const point = profile.points[index]
    return point
      ? sparkPointCoordinates(point, profile.totalDistanceKm, chartMinElevationM, chartElevationSpanM)
      : ''
  }).filter(Boolean).join(' ')

  return (
    <div
      className="elevation-sparkline"
      aria-label={`Elevation from start to finish, wind: ${sequence.map(effectLabel).join(' → ')}`}
    >
      <svg
        className="elevation-sparkline__chart"
        viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polygon
          className="elevation-sparkline__area"
          points={`0,${SPARK_HEIGHT} ${areaLine} ${SPARK_WIDTH},${SPARK_HEIGHT}`}
        />
        {profileGroups.map((group, index) => {
          const indices = sampleIndices(
            group.startIndex,
            group.endIndex,
            profile.points.length,
            MAX_SPARK_POINTS,
          )
          const linePoints = indices.map((pointIndex) => {
            const point = profile.points[pointIndex]
            return point
              ? sparkPointCoordinates(point, profile.totalDistanceKm, chartMinElevationM, chartElevationSpanM)
              : ''
          }).filter(Boolean).join(' ')
          return (
            <polyline
              key={`${group.effect}-${group.startIndex}-${index}`}
              className={`elevation-sparkline__line ${effectClass(group.effect)}`}
              points={linePoints}
            />
          )
        })}
      </svg>
      <div className="wind-journey__axis elevation-sparkline__axis">
        <span><i className={`wind-endpoint wind-endpoint--${startEffect}`} />Start</span>
        <i aria-hidden="true">→</i>
        <span>Finish<i className={`wind-endpoint wind-endpoint--${finishEffect}`} /></span>
      </div>
    </div>
  )
}

export function ElevationWindProfile({
  points,
  segments,
  selectedPointIndex,
  onSelectedPointIndexChange,
}: {
  points: GeoPoint[]
  segments: SegmentWind[]
  selectedPointIndex: number | null
  onSelectedPointIndexChange: (pointIndex: number | null) => void
}) {
  const activePointer = useRef<number | null>(null)
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
      ? pointCoordinatesText(point, profile.totalDistanceKm, chartMinElevationM, chartElevationSpanM)
      : ''
  }).filter(Boolean).join(' ')
  const areaPoints = `0,${CHART_HEIGHT} ${areaLine} ${CHART_WIDTH},${CHART_HEIGHT}`
  const selectedPoint = selectedPointIndex === null ? undefined : profile.points[selectedPointIndex]
  const selectedSegment = selectedPoint
    ? windSegmentAtDistance(segments, selectedPoint.distanceKm)
    : undefined
  const selectedEffect = selectedSegment ? windEffect(selectedSegment) : undefined
  const selectedCoordinates = selectedPoint
    ? pointCoordinates(selectedPoint, profile.totalDistanceKm, chartMinElevationM, chartElevationSpanM)
    : undefined
  const chartMaxElevationM = chartMinElevationM + chartElevationSpanM
  const chartMiddleElevationM = chartMinElevationM + chartElevationSpanM / 2

  const selectDistance = (distanceKm: number) => {
    const pointIndex = closestElevationPointIndex(profile.points, distanceKm)
    if (pointIndex >= 0) onSelectedPointIndexChange(pointIndex)
  }

  const moveSelection = (step: number) => {
    const current = selectedPointIndex ?? 0
    onSelectedPointIndexChange(Math.max(0, Math.min(profile.points.length - 1, current + step)))
  }

  const selectFromPointer = (clientX: number, chart: SVGSVGElement) => {
    const bounds = chart.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width))
    selectDistance(fraction * profile.totalDistanceKm)
  }

  return (
    <section className="elevation-profile" aria-label="Elevation profile colored by wind effect">
      <div className="elevation-profile__heading">
        <div>
          <span className="eyebrow">RIDE PROFILE</span>
          <h3>Elevation &amp; wind</h3>
        </div>
        <strong>{Math.round(profile.minElevationM)}–{Math.round(profile.maxElevationM)} m</strong>
      </div>
      <div
        className={`elevation-profile__readout${selectedEffect ? ` elevation-profile__readout--${selectedEffect}` : ''}`}
        aria-live="polite"
      >
        {selectedPoint && selectedSegment && selectedEffect ? (
          <>
            <strong>{selectedPoint.distanceKm.toFixed(1)} km</strong>
            <span>{Math.round(selectedPoint.elevationM)} m altitude</span>
            <span><i />{selectedSegment.windSpeedKmh.toFixed(1)} km/h · {effectLabel(selectedEffect)}wind</span>
          </>
        ) : <span>Tap or slide across the profile to inspect the ride</span>}
      </div>
      <div className="elevation-profile__plot">
        <span className="elevation-profile__y-title">Altitude (m)</span>
        <div className="elevation-profile__y-axis" aria-hidden="true">
          <span>{Math.round(chartMaxElevationM)}</span>
          <span>{Math.round(chartMiddleElevationM)}</span>
          <span>{Math.round(chartMinElevationM)}</span>
        </div>
        <svg
          className="elevation-profile__chart"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          role="button"
          tabIndex={0}
          aria-label="Interactive elevation profile. Tap, slide, or use arrow keys to inspect wind speed."
          onPointerDown={(event) => {
            activePointer.current = event.pointerId
            event.currentTarget.setPointerCapture(event.pointerId)
            selectFromPointer(event.clientX, event.currentTarget)
          }}
          onPointerMove={(event) => {
            if (activePointer.current === event.pointerId) {
              selectFromPointer(event.clientX, event.currentTarget)
            }
          }}
          onPointerUp={(event) => {
            if (activePointer.current !== event.pointerId) return
            activePointer.current = null
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
          }}
          onPointerCancel={(event) => {
            if (activePointer.current === event.pointerId) activePointer.current = null
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault()
              moveSelection(event.key === 'ArrowLeft' ? -1 : 1)
            }
          }}
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
                ? pointCoordinatesText(point, profile.totalDistanceKm, chartMinElevationM, chartElevationSpanM)
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
          {selectedCoordinates && selectedEffect && (
            <g className={`elevation-profile__selection elevation-profile__selection--${selectedEffect}`}>
              <line x1={selectedCoordinates.x} y1={CHART_TOP} x2={selectedCoordinates.x} y2={CHART_HEIGHT - CHART_BOTTOM} />
              <circle cx={selectedCoordinates.x} cy={selectedCoordinates.y} r="8" />
            </g>
          )}
        </svg>
      </div>
      <div className="elevation-profile__x-axis" aria-hidden="true">
        <span>0 km</span>
        <span>{(profile.totalDistanceKm / 2).toFixed(1)} km</span>
        <span>{profile.totalDistanceKm.toFixed(1)} km</span>
      </div>
      <p>Distance (km) · rising line = climbing · color = wind on that section</p>
    </section>
  )
}
