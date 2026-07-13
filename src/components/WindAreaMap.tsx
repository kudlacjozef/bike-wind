import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import type { GeoPoint, WeatherSample } from '../domain/types'
import {
  compassDirection,
  cyclingWindStrength,
  cyclingWindStrengthLabel,
  windTravelDirection,
  type CyclingWindStrength,
} from '../domain/wind'
import {
  fetchWindArea,
  fetchWindForPoints,
  nearestAreaWindSample,
  visibleWindTarget,
  WIND_AREA_RADIUS_KM,
  type AreaWindSample,
} from '../services/windArea'

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
    const forecastTime = samples[0]?.weather.time ?? Date.now()
    const controller = new AbortController()
    let disposed = false

    interface WindMarkerEntry {
      marker: L.Marker
      point: GeoPoint
      weather: WeatherSample
      minimumZoom: number
    }

    const knownSamples = [...samples]
    const windMarkers: WindMarkerEntry[] = []

    const markerPresentation = (weather: WeatherSample) => {
      const speed = Math.round(weather.speedKmh)
      const gust = Math.round(weather.gustKmh)
      const from = compassDirection(weather.directionFromDegrees)
      const airflowDirection = windTravelDirection(weather.directionFromDegrees)
      const strength = cyclingWindStrength(weather.speedKmh, weather.gustKmh)
      const strengthLabel = cyclingWindStrengthLabel(strength)
      const markerSize = windMarkerSize(strength)
      const popup = document.createElement('div')
      popup.className = 'wind-popup'
      const heading = document.createElement('strong')
      heading.textContent = `${strengthLabel} for riding`
      const speedLine = document.createElement('span')
      speedLine.textContent = `${speed} km/h wind`
      const details = document.createElement('span')
      details.textContent = `From ${from} · gusts ${gust} km/h`
      popup.append(heading, speedLine, details)
      return {
        speed,
        gust,
        from,
        strengthLabel,
        popup,
        icon: L.divIcon({
          className: `wind-direction-icon wind-strength--${strength}`,
          html: `<span style="transform: rotate(${airflowDirection - 90}deg)">➤</span>`,
          iconSize: [markerSize, markerSize],
          iconAnchor: [markerSize / 2, markerSize / 2],
        }),
      }
    }

    const applyWeather = (marker: L.Marker, weather: WeatherSample) => {
      const presentation = markerPresentation(weather)
      marker.options.title = `${presentation.strengthLabel} riding wind: ${presentation.speed} km/h from ${presentation.from}, gusts ${presentation.gust} km/h`
      marker.options.alt = `${presentation.strengthLabel} riding wind, ${presentation.speed} km/h from ${presentation.from}`
      marker.setIcon(presentation.icon)
      marker.unbindPopup().bindPopup(presentation.popup, { closeButton: false, offset: [0, -8] })
      const element = marker.getElement()
      element?.setAttribute('title', `${presentation.strengthLabel} riding wind: ${presentation.speed} km/h from ${presentation.from}, gusts ${presentation.gust} km/h`)
      element?.setAttribute('aria-label', `${presentation.strengthLabel} riding wind, ${presentation.speed} km/h from ${presentation.from}`)
    }

    const addWindMarker = (
      { point, weather }: AreaWindSample,
      minimumZoom: number,
      showImmediately = false,
    ): WindMarkerEntry => {
      const presentation = markerPresentation(weather)
      const marker = L.marker([point.latitude, point.longitude], {
        interactive: true,
        keyboard: true,
        riseOnHover: true,
        title: `${presentation.strengthLabel} riding wind: ${presentation.speed} km/h from ${presentation.from}, gusts ${presentation.gust} km/h`,
        alt: `${presentation.strengthLabel} riding wind, ${presentation.speed} km/h from ${presentation.from}`,
        icon: presentation.icon,
      })
      marker.bindPopup(presentation.popup, { closeButton: false, offset: [0, -8] })
      if (showImmediately) marker.addTo(map)
      const entry = { marker, point, weather, minimumZoom }
      windMarkers.push(entry)
      return entry
    }

    samples.forEach((sample) => addWindMarker(sample, overviewZoom, true))

    const spreadEntries = (
      candidates: WindMarkerEntry[],
      targetCount: number,
      preserved: WindMarkerEntry[] = [],
    ): WindMarkerEntry[] => {
      if (targetCount <= 0 || candidates.length === 0) return []
      const size = map.getSize()
      const selected = preserved.filter((entry) => candidates.includes(entry)).slice(0, targetCount)
      const screenPoint = (entry: WindMarkerEntry) => {
        const point = map.latLngToContainerPoint([entry.point.latitude, entry.point.longitude])
        return { screenX: point.x, screenY: point.y }
      }

      if (selected.length === 0) {
        const centerEntry = [...candidates].sort((a, b) => {
          const aPoint = screenPoint(a)
          const bPoint = screenPoint(b)
          return Math.hypot(aPoint.screenX - size.x / 2, aPoint.screenY - size.y / 2)
            - Math.hypot(bPoint.screenX - size.x / 2, bPoint.screenY - size.y / 2)
        })[0]
        if (centerEntry) selected.push(centerEntry)
      }

      while (selected.length < Math.min(targetCount, candidates.length)) {
        const selectedPoints = selected.map(screenPoint)
        let next: WindMarkerEntry | undefined
        let greatestSeparation = -1
        for (const candidate of candidates) {
          if (selected.includes(candidate)) continue
          const candidatePoint = screenPoint(candidate)
          const separation = Math.min(...selectedPoints.map((chosen) =>
            Math.hypot(
              candidatePoint.screenX - chosen.screenX,
              candidatePoint.screenY - chosen.screenY,
            )))
          if (separation > greatestSeparation) {
            greatestSeparation = separation
            next = candidate
          }
        }
        if (!next) break
        selected.push(next)
      }
      return selected
    }

    const refreshArrows = () => {
      const currentZoom = map.getZoom()
      const targetCount = visibleWindTarget(currentZoom - overviewZoom, samples.length)
      const bounds = map.getBounds()
      const eligibleMarkers = windMarkers.filter(({ point, minimumZoom }) =>
        minimumZoom <= currentZoom && bounds.contains([point.latitude, point.longitude]))
      const displayedEligibleMarkers = eligibleMarkers.filter(({ marker }) => map.hasLayer(marker))
      const displayedMarkers = displayedEligibleMarkers.length > targetCount
        ? spreadEntries(displayedEligibleMarkers, targetCount)
        : spreadEntries(eligibleMarkers, targetCount, displayedEligibleMarkers)
      const missingCount = targetCount - displayedMarkers.length

      const size = map.getSize()
      if (size.x <= 0 || size.y <= 0) return
      const candidateCount = Math.max(targetCount * 4, 32)
      const columns = Math.max(1, Math.ceil(Math.sqrt((candidateCount * size.x) / Math.max(size.y, 1))))
      const rows = Math.ceil(candidateCount / columns)
      const cellWidth = size.x / columns
      const cellHeight = size.y / rows
      const candidates: Array<{ point: GeoPoint; screenX: number; screenY: number }> = []
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const screenX = (column + 0.5) * cellWidth
          const screenY = (row + 0.5) * cellHeight
          const latLng = map.containerPointToLatLng([screenX, screenY])
          candidates.push({
            point: { latitude: latLng.lat, longitude: latLng.lng },
            screenX,
            screenY,
          })
        }
      }

      const occupied = windMarkers.filter(({ point }) =>
        bounds.contains([point.latitude, point.longitude])).map(({ point }) => {
        const screenPoint = map.latLngToContainerPoint([point.latitude, point.longitude])
        return { screenX: screenPoint.x, screenY: screenPoint.y }
      })
      const selected: typeof candidates = []
      if (missingCount > 0 && occupied.length === 0 && candidates.length > 0) {
        const centerCandidate = [...candidates].sort((a, b) =>
          Math.hypot(a.screenX - size.x / 2, a.screenY - size.y / 2)
          - Math.hypot(b.screenX - size.x / 2, b.screenY - size.y / 2))[0]
        if (centerCandidate) selected.push(centerCandidate)
      }
      while (missingCount > 0 && selected.length < missingCount) {
        let next: (typeof candidates)[number] | undefined
        let greatestSeparation = -1
        for (const candidate of candidates) {
          if (selected.includes(candidate)) continue
          const anchors = [...occupied, ...selected]
          const separation = anchors.length === 0
            ? Number.POSITIVE_INFINITY
            : Math.min(...anchors.map((chosen) =>
                Math.hypot(candidate.screenX - chosen.screenX, candidate.screenY - chosen.screenY)))
          if (separation > greatestSeparation) {
            greatestSeparation = separation
            next = candidate
          }
        }
        if (!next) break
        selected.push(next)
      }

      const newEntries = selected.slice(0, Math.max(0, missingCount)).flatMap(({ point }) => {
        const nearest = nearestAreaWindSample(point, knownSamples)
        return nearest ? [addWindMarker({ point, weather: nearest.weather }, currentZoom)] : []
      })
      const markersToShow = new Set([...displayedMarkers, ...newEntries])
      windMarkers.forEach((entry) => {
        const { marker } = entry
        if (markersToShow.has(entry)) {
          if (!map.hasLayer(marker)) marker.addTo(map)
        } else if (map.hasLayer(marker)) {
          marker.removeFrom(map)
        }
      })

      if (newEntries.length === 0) return

      void fetchWindForPoints(newEntries.map(({ point }) => point), forecastTime, controller.signal)
        .then((freshSamples) => {
          if (disposed) return
          freshSamples.forEach((fresh, index) => {
            const entry = newEntries[index]
            if (!entry) return
            entry.weather = fresh.weather
            knownSamples.push(fresh)
            applyWeather(entry.marker, fresh.weather)
          })
        })
        .catch((reason) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return
          // Keep the immediate nearest-forecast arrows if refreshing a newly revealed area fails.
        })
    }
    map.on('moveend', refreshArrows)

    const resizeFrame = window.requestAnimationFrame(() => {
      map.invalidateSize()
      refreshArrows()
    })
    return () => {
      disposed = true
      controller.abort()
      window.cancelAnimationFrame(resizeFrame)
      map.off('moveend', refreshArrows)
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
              <span>Density follows zoom · new areas fill as you move</span>
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
