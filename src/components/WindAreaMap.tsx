import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import type { GeoPoint } from '../domain/types'
import {
  compassDirection,
  cyclingWindStrength,
  cyclingWindStrengthLabel,
  windTravelDirection,
  type CyclingWindStrength,
} from '../domain/wind'
import {
  fetchWindArea,
  nearestAreaWindSample,
  WIND_AREA_RADIUS_KM,
  type AreaWindSample,
} from '../services/windArea'
import { distanceKm } from '../domain/geo'

function windMarkerSize(strength: CyclingWindStrength): number {
  if (strength === 'weak') return 20
  if (strength === 'noticeable') return 24
  if (strength === 'strong') return 29
  return 34
}

function locationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Location access is off. Allow location for BikeWind in Safari settings, then try again.'
  }
  if (error.code === error.TIMEOUT) return 'Your location took too long to load. Please try again.'
  return 'BikeWind could not find your location. Check Location Services and try again.'
}

function getCurrentLocation(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available in this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(new Error(locationErrorMessage(error))),
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 15_000 },
    )
  })
}

function WindMapCanvas({ center, samples }: { center: GeoPoint; samples: AreaWindSample[] }) {
  const mapElement = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = mapElement.current
    if (!container || samples.length === 0) return

    const map = L.map(container, {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    })
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    const centerLatLng = L.latLng(center.latitude, center.longitude)
    const areaBounds = centerLatLng.toBounds(WIND_AREA_RADIUS_KM * 2000)
    map.fitBounds(areaBounds, { padding: [22, 22] })
    L.circle(centerLatLng, {
      radius: WIND_AREA_RADIUS_KM * 1000,
      color: '#08799e',
      weight: 1.5,
      opacity: 0.38,
      fillColor: '#b5e2ef',
      fillOpacity: 0.07,
      interactive: false,
    }).addTo(map)

    L.circleMarker(centerLatLng, {
      radius: 7,
      color: '#fffef9',
      weight: 3,
      fillColor: '#08799e',
      fillOpacity: 1,
    }).bindTooltip('You are here', { direction: 'top' }).addTo(map)

    const overviewZoom = map.getZoom()
    let windMarkers: L.Marker[] = []

    const addWindMarker = ({ point, weather }: AreaWindSample): L.Marker => {
      const speed = Math.round(weather.speedKmh)
      const gust = Math.round(weather.gustKmh)
      const from = compassDirection(weather.directionFromDegrees)
      const airflowDirection = windTravelDirection(weather.directionFromDegrees)
      const strength = cyclingWindStrength(weather.speedKmh, weather.gustKmh)
      const strengthLabel = cyclingWindStrengthLabel(strength)
      const markerSize = windMarkerSize(strength)
      const marker = L.marker([point.latitude, point.longitude], {
        interactive: true,
        keyboard: true,
        riseOnHover: true,
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
    }

    const displaySamples = (): AreaWindSample[] => {
      const zoomDifference = map.getZoom() - overviewZoom
      if (zoomDifference <= 0) return samples

      const size = map.getSize()
      const targetCount = samples.length
      const candidateCount = targetCount * 3
      const columns = Math.max(1, Math.ceil(Math.sqrt((candidateCount * size.x) / Math.max(size.y, 1))))
      const rows = Math.ceil(candidateCount / columns)
      const cellWidth = size.x / columns
      const cellHeight = size.y / rows
      const candidates: Array<AreaWindSample & { screenX: number; screenY: number }> = []
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const x = (column + 0.5) * cellWidth
          const y = (row + 0.5) * cellHeight
          const latLng = map.containerPointToLatLng([x, y])
          const point = { latitude: latLng.lat, longitude: latLng.lng }
          if (distanceKm(center, point) > WIND_AREA_RADIUS_KM) continue
          const nearest = nearestAreaWindSample(point, samples)
          if (nearest) {
            candidates.push({
              point,
              weather: nearest.weather,
              screenX: x,
              screenY: y,
            })
          }
        }
      }
      if (candidates.length <= targetCount) {
        return candidates.map(({ point, weather }) => ({ point, weather }))
      }

      const selected = [candidates[0]!]
      while (selected.length < targetCount) {
        let next: (typeof candidates)[number] | undefined
        let greatestSeparation = -1
        for (const candidate of candidates) {
          if (selected.includes(candidate)) continue
          const separation = Math.min(...selected.map((chosen) =>
            Math.hypot(candidate.screenX - chosen.screenX, candidate.screenY - chosen.screenY)))
          if (separation > greatestSeparation) {
            greatestSeparation = separation
            next = candidate
          }
        }
        if (!next) break
        selected.push(next)
      }
      return selected.map(({ point, weather }) => ({ point, weather }))
    }

    const redrawWindMarkers = () => {
      windMarkers.forEach((marker) => marker.removeFrom(map))
      windMarkers = displaySamples().map(addWindMarker)
    }
    redrawWindMarkers()
    map.on('moveend', redrawWindMarkers)

    const resizeFrame = window.requestAnimationFrame(() => {
      map.invalidateSize()
      redrawWindMarkers()
    })
    return () => {
      window.cancelAnimationFrame(resizeFrame)
      map.off('moveend', redrawWindMarkers)
      map.remove()
    }
  }, [center, samples])

  return (
    <div
      ref={mapElement}
      className="route-map wind-area-map"
      role="region"
      aria-label={`Current wind direction across ${WIND_AREA_RADIUS_KM} kilometres around your location`}
    />
  )
}

export function WindAreaView({ onClose }: { onClose: () => void }) {
  const [center, setCenter] = useState<GeoPoint | null>(null)
  const [samples, setSamples] = useState<AreaWindSample[]>([])
  const [error, setError] = useState<string | null>(null)
  const [requestNumber, setRequestNumber] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setCenter(null)
    setSamples([])
    setError(null)
    void getCurrentLocation()
      .then(async (location) => {
        setCenter(location)
        setSamples(await fetchWindArea(location, Date.now(), controller.signal))
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : 'Could not load the wind map.')
      })
    return () => controller.abort()
  }, [requestNumber])

  const loading = !error && (!center || samples.length === 0)

  return (
    <div className="detail wind-area-detail" role="dialog" aria-modal="true" aria-label="Wind map around your location">
      <header className="detail__header">
        <button className="icon-button" onClick={onClose} aria-label="Close wind map">×</button>
        <div>
          <p>LIVE WIND AROUND YOU</p>
          <h2>{WIND_AREA_RADIUS_KM} km wind map</h2>
        </div>
      </header>
      <div className="detail__content wind-area-content">
        {loading && (
          <div className="wind-map-status" role="status">
            <span className="spinner spinner--dark" />
            <strong>{center ? 'Loading current wind…' : 'Finding your location…'}</strong>
            <p>BikeWind uses your position only to build this map.</p>
          </div>
        )}
        {error && (
          <div className="wind-map-status wind-map-status--error" role="alert">
            <span className="wind-map-status__icon">⌖</span>
            <strong>Wind map unavailable</strong>
            <p>{error}</p>
            <button className="primary-button" onClick={() => setRequestNumber((value) => value + 1)}>Try again</button>
          </div>
        )}
        {center && samples.length > 0 && (
          <>
            <WindMapCanvas center={center} samples={samples} />
            <div className="wind-area-caption">
              <strong>Arrows show where the air is moving</strong>
              <span>29 arrows stay in view · tap for details</span>
            </div>
            <div className="wind-strength-scale wind-strength-scale--area" aria-label="Wind strength for cycling">
              <span><i className="wind-strength-dot wind-strength-dot--weak" />Weak</span>
              <span><i className="wind-strength-dot wind-strength-dot--noticeable" />Noticeable</span>
              <span><i className="wind-strength-dot wind-strength-dot--strong" />Strong</span>
              <span><i className="wind-strength-dot wind-strength-dot--very-strong" />Very strong</span>
            </div>
            <p className="fine-print">This is a regional forecast grid, not a measurement at every arrow. Hills, valleys, trees, and buildings can change the wind you feel.</p>
            <p className="attribution">Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a></p>
          </>
        )}
      </div>
    </div>
  )
}
