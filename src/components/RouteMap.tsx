import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  groupRouteByWind,
  routeDirectionAnchors,
  type DirectionAnchor,
  type WindEffect,
} from '../domain/mapRoute'
import type { GeoPoint, SegmentWind } from '../domain/types'
import {
  compassDirection,
  cyclingWindStrength,
  cyclingWindStrengthLabel,
  windTravelDirection,
  type CyclingWindStrength,
} from '../domain/wind'

interface SegmentMapProps {
  points: GeoPoint[]
  segments: SegmentWind[]
  selectedPoint?: GeoPoint
}

interface RoutePreviewProps {
  points: GeoPoint[]
}

interface Projection {
  x: (point: GeoPoint) => number
  y: (point: GeoPoint) => number
}

function makeProjection(points: GeoPoint[]): Projection {
  const latitudes = points.map((point) => point.latitude)
  const longitudes = points.map((point) => point.longitude)
  const minLat = Math.min(...latitudes)
  const maxLat = Math.max(...latitudes)
  const minLon = Math.min(...longitudes)
  const maxLon = Math.max(...longitudes)
  const latSpan = Math.max(maxLat - minLat, 0.0001)
  const lonSpan = Math.max(maxLon - minLon, 0.0001)
  const scale = 82 / Math.max(latSpan, lonSpan)
  const xOffset = (100 - lonSpan * scale) / 2
  const yOffset = (100 - latSpan * scale) / 2
  return {
    x: (point) => xOffset + (point.longitude - minLon) * scale,
    y: (point) => 100 - (yOffset + (point.latitude - minLat) * scale),
  }
}

function effectColor(effect: WindEffect): string {
  if (effect === 'headwind') return '#db5a45'
  if (effect === 'tailwind') return '#2e8b70'
  return '#d99a33'
}

const ROUTE_OFFSET_PX = 5
const WIND_OFFSET_PX = 20
const MAX_WIND_ARROWS = 12

function displayedWindSegments(segments: SegmentWind[]): SegmentWind[] {
  if (segments.length <= MAX_WIND_ARROWS) return segments
  return Array.from({ length: MAX_WIND_ARROWS }, (_, index) => {
    const sourceIndex = Math.round((index * (segments.length - 1)) / (MAX_WIND_ARROWS - 1))
    return segments[sourceIndex]
  }).filter((segment): segment is SegmentWind => segment !== undefined)
}

function windMarkerSize(strength: CyclingWindStrength): number {
  if (strength === 'weak') return 20
  if (strength === 'noticeable') return 24
  if (strength === 'strong') return 29
  return 34
}

function normal(start: L.Point, end: L.Point): L.Point {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const length = Math.hypot(deltaX, deltaY)
  return length === 0 ? L.point(0, 0) : L.point(-deltaY / length, deltaX / length)
}

function offsetRoutePoints(map: L.Map, points: GeoPoint[], offsetPx: number): L.LatLng[] {
  const projected = points.map((point) => map.latLngToLayerPoint([point.latitude, point.longitude]))
  return projected.map((point, index) => {
    const previousNormal = index > 0 ? normal(projected[index - 1]!, point) : undefined
    const nextNormal = index < projected.length - 1 ? normal(point, projected[index + 1]!) : undefined
    let vertexNormal = nextNormal ?? previousNormal ?? L.point(0, 0)

    if (previousNormal && nextNormal) {
      const combined = L.point(previousNormal.x + nextNormal.x, previousNormal.y + nextNormal.y)
      const combinedLength = Math.hypot(combined.x, combined.y)
      vertexNormal = combinedLength < 0.25
        ? nextNormal
        : L.point(combined.x / combinedLength, combined.y / combinedLength)
    }

    return map.layerPointToLatLng(
      L.point(point.x + vertexNormal.x * offsetPx, point.y + vertexNormal.y * offsetPx),
    )
  })
}

function offsetAnchor(map: L.Map, anchor: DirectionAnchor, offsetPx: number): L.LatLng {
  const start = map.latLngToLayerPoint([anchor.start.latitude, anchor.start.longitude])
  const end = map.latLngToLayerPoint([anchor.end.latitude, anchor.end.longitude])
  const segmentNormal = normal(start, end)
  const base = L.point(
    start.x + (end.x - start.x) * anchor.fraction,
    start.y + (end.y - start.y) * anchor.fraction,
  )
  return map.layerPointToLatLng(
    L.point(base.x + segmentNormal.x * offsetPx, base.y + segmentNormal.y * offsetPx),
  )
}

export function SegmentMap({ points, segments, selectedPoint }: SegmentMapProps) {
  const mapElement = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const selectedPointMarker = useRef<L.Marker | null>(null)

  useEffect(() => {
    const container = mapElement.current
    if (!container || points.length < 2 || segments.length === 0) return

    const map = L.map(container, {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    })
    mapInstance.current = map
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    const latLngs = points.map((point) => L.latLng(point.latitude, point.longitude))
    const bounds = L.latLngBounds(latLngs)
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 })

    L.polyline(latLngs, {
      color: '#153f3a',
      weight: 2,
      opacity: 0.2,
      dashArray: '2 5',
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(map)

    const routeGroups = groupRouteByWind(points, segments)
    const shiftedRoute = offsetRoutePoints(map, points, ROUTE_OFFSET_PX)
    const coloredLines = routeGroups.map((group) =>
      L.polyline(shiftedRoute.slice(group.startIndex, group.endIndex + 1), {
        color: effectColor(group.effect),
        weight: 5,
        opacity: 0.96,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(map),
    )

    const directionAnchors = routeDirectionAnchors(points)
    const directionMarkers = directionAnchors.map((anchor) =>
      L.marker(offsetAnchor(map, anchor, ROUTE_OFFSET_PX), {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'route-direction-icon',
          html: `<span style="transform: rotate(${anchor.bearingDegrees - 90}deg)">➤</span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map),
    )

    const windSamples = displayedWindSegments(segments).map((segment) => ({
      segment,
      anchor: {
        start: segment.start,
        end: segment.end,
        fraction: 0.5,
        bearingDegrees: segment.bearingDegrees,
      } satisfies DirectionAnchor,
    }))
    const windMarkers = windSamples.map(({ segment, anchor }) => {
      const speed = Math.round(segment.windSpeedKmh)
      const gust = Math.round(segment.gustKmh)
      const from = compassDirection(segment.windFromDegrees)
      const airflowDirection = windTravelDirection(segment.windFromDegrees)
      const strength = cyclingWindStrength(segment.windSpeedKmh, segment.gustKmh)
      const strengthLabel = cyclingWindStrengthLabel(strength)
      const markerSize = windMarkerSize(strength)
      const marker = L.marker(offsetAnchor(map, anchor, WIND_OFFSET_PX), {
        interactive: true,
        keyboard: true,
        riseOnHover: true,
        zIndexOffset: 500,
        title: `${strengthLabel} riding wind: ${speed} km/h from ${from}, gusts ${gust} km/h`,
        alt: `${strengthLabel} riding wind, ${speed} km/h from ${from}`,
        icon: L.divIcon({
          className: `wind-direction-icon wind-strength--${strength}`,
          html: `<span style="transform: rotate(${airflowDirection - 90}deg)">➤</span>`,
          iconSize: [markerSize, markerSize],
          iconAnchor: [markerSize / 2, markerSize / 2],
        }),
      }).addTo(map)
      const popup = document.createElement('div')
      popup.className = 'wind-popup'
      const heading = document.createElement('strong')
      heading.textContent = `${strengthLabel} for riding`
      const speedLine = document.createElement('span')
      speedLine.textContent = `${speed} km/h wind`
      const details = document.createElement('span')
      details.textContent = `From ${from} · gusts ${gust} km/h`
      popup.append(heading, speedLine, details)
      marker.bindPopup(popup, { closeButton: false, offset: [0, -8] })
      return marker
    })

    const startAnchor: DirectionAnchor | undefined = points[0] && points[1]
      ? { start: points[0], end: points[1], fraction: 0, bearingDegrees: 0 }
      : undefined
    const endAnchor: DirectionAnchor | undefined = points.at(-2) && points.at(-1)
      ? { start: points.at(-2)!, end: points.at(-1)!, fraction: 1, bearingDegrees: 0 }
      : undefined
    const startMarker = startAnchor
      ? L.circleMarker(offsetAnchor(map, startAnchor, ROUTE_OFFSET_PX), {
          radius: 6,
          color: '#fffef9',
          weight: 3,
          fillColor: '#153f3a',
          fillOpacity: 1,
        }).bindTooltip('Start', { direction: 'top' }).addTo(map)
      : undefined
    const finishMarker = endAnchor
      ? L.circleMarker(offsetAnchor(map, endAnchor, ROUTE_OFFSET_PX), {
          radius: 6,
          color: '#153f3a',
          weight: 3,
          fillColor: '#fffef9',
          fillOpacity: 1,
        }).bindTooltip('Finish', { direction: 'top' }).addTo(map)
      : undefined

    const redrawOffsetLayers = () => {
      const shifted = offsetRoutePoints(map, points, ROUTE_OFFSET_PX)
      coloredLines.forEach((line, index) => {
        const group = routeGroups[index]
        if (group) line.setLatLngs(shifted.slice(group.startIndex, group.endIndex + 1))
      })
      directionMarkers.forEach((marker, index) => {
        const anchor = directionAnchors[index]
        if (anchor) marker.setLatLng(offsetAnchor(map, anchor, ROUTE_OFFSET_PX))
      })
      windMarkers.forEach((marker, index) => {
        const sample = windSamples[index]
        if (sample) marker.setLatLng(offsetAnchor(map, sample.anchor, WIND_OFFSET_PX))
      })
      if (startAnchor) startMarker?.setLatLng(offsetAnchor(map, startAnchor, ROUTE_OFFSET_PX))
      if (endAnchor) finishMarker?.setLatLng(offsetAnchor(map, endAnchor, ROUTE_OFFSET_PX))
    }
    map.on('zoomend', redrawOffsetLayers)
    const resizeFrame = window.requestAnimationFrame(() => map.invalidateSize())

    return () => {
      window.cancelAnimationFrame(resizeFrame)
      map.off('zoomend', redrawOffsetLayers)
      selectedPointMarker.current = null
      mapInstance.current = null
      map.remove()
    }
  }, [points, segments])

  useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    if (!selectedPoint) {
      selectedPointMarker.current?.removeFrom(map)
      selectedPointMarker.current = null
      return
    }

    const position = L.latLng(selectedPoint.latitude, selectedPoint.longitude)
    if (selectedPointMarker.current) {
      selectedPointMarker.current.setLatLng(position)
      return
    }

    selectedPointMarker.current = L.marker(position, {
      interactive: false,
      keyboard: false,
      zIndexOffset: 1200,
      alt: 'Selected point from elevation profile',
      icon: L.divIcon({
        className: 'profile-position-icon',
        html: '<span aria-hidden="true"><i></i></span>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    }).addTo(map)
  }, [selectedPoint, points, segments])

  return (
    <div
      ref={mapElement}
      className="route-map route-map--large"
      role="region"
      aria-label={selectedPoint
        ? 'Interactive map with the selected elevation profile point marked in blue'
        : 'Interactive map with the full GPX route colored by wind effect'}
    />
  )
}

export function RoutePreview({ points }: RoutePreviewProps) {
  const previewPoints = points.filter((_, index) => index % Math.max(1, Math.floor(points.length / 80)) === 0)
  const last = points.at(-1)
  if (last && previewPoints.at(-1) !== last) previewPoints.push(last)
  const projection = makeProjection(previewPoints)
  return (
    <svg className="route-preview" viewBox="0 0 100 100" aria-hidden="true">
      <polyline
        points={previewPoints.map((point) => `${projection.x(point)},${projection.y(point)}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
