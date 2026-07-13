import { useEffect, useMemo, useRef, useState } from 'react'
import { RoutePreview, SegmentMap } from './components/RouteMap'
import { WindAreaView } from './components/WindAreaMap'
import { ElevationWindProfile, ElevationWindSparkline } from './components/ElevationWindProfile'
import { parseGpx, prepareImportedRoute } from './domain/gpx'
import type { RouteAnalysis, StoredRoute } from './domain/types'
import { analyzeRoutes } from './services/analyzeRoutes'
import { deleteRoute, getRoutes, saveRoute, setFavorite } from './storage/routes'

type Screen = 'ride' | 'routes'
type DepartureMode = 'now' | 'later'

const round = (value: number) => Math.round(value)
const DAY_MS = 24 * 60 * 60 * 1000

function toDateTimeInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function defaultLaterTime(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000)
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0)
  return toDateTimeInputValue(date)
}

function departureLabel(timeMs: number): string {
  if (!Number.isFinite(timeMs)) return 'Choose time'
  const date = new Date(timeMs)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return new Intl.DateTimeFormat(undefined, sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

function directionLabel(direction: RouteAnalysis['direction']): string {
  return direction === 'forward' ? 'Normal direction' : 'Reverse direction'
}

function directionArrow(direction: RouteAnalysis['direction']): string {
  return direction === 'forward' ? '→' : '←'
}

function routeDirectionName(routeName: string, direction: RouteAnalysis['direction']): string {
  return direction === 'forward' ? routeName : `${routeName} reverse`
}

function ResultCard({ analysis, route, onOpen }: { analysis: RouteAnalysis; route: StoredRoute; onOpen: () => void }) {
  const routePoints = analysis.direction === 'forward' ? route.points : [...route.points].reverse()
  const displayName = routeDirectionName(analysis.routeName, analysis.direction)
  return (
    <button
      className="result-card"
      onClick={onOpen}
      aria-label={displayName}
    >
      <div className="result-card__route-icon">
        <RoutePreview points={route.points} />
        <i className="result-card__route-direction">{directionArrow(analysis.direction)}</i>
      </div>
      <div className="result-card__body">
        <div className="result-card__heading">
          <div>
            <strong>{displayName}</strong>
            <p>{analysis.distanceKm.toFixed(1)} km · {durationLabel(analysis.durationMinutes)}</p>
          </div>
        </div>
        <div className="result-card__facts">
          <span><b>{round(analysis.tailwindPercent)}%</b> tailwind</span>
          <span><b>{round(analysis.headwindPercent)}%</b> headwind</span>
          <span><b>{round(analysis.maxGustKmh)}</b> km/h gust</span>
        </div>
        <ElevationWindSparkline points={routePoints} segments={analysis.segments} />
      </div>
      <span className="chevron">›</span>
    </button>
  )
}

function AnalysisDetail({ analysis, route, onClose }: { analysis: RouteAnalysis; route: StoredRoute; onClose: () => void }) {
  const routePoints = useMemo(
    () => (analysis.direction === 'forward' ? route.points : [...route.points].reverse()),
    [analysis.direction, route.points],
  )
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null)
  const selectedMapPoint = selectedPointIndex === null ? undefined : routePoints[selectedPointIndex]
  const displayName = routeDirectionName(analysis.routeName, analysis.direction)
  return (
    <div className="detail" role="dialog" aria-modal="true" aria-label={`${displayName} wind details`}>
      <header className="detail__header">
        <button className="icon-button" onClick={onClose} aria-label="Close details">×</button>
        <div>
          <p>{directionArrow(analysis.direction)} {directionLabel(analysis.direction)}</p>
          <h2>{displayName}</h2>
        </div>
      </header>
      <div className="detail__content">
        <SegmentMap
          points={routePoints}
          segments={analysis.segments}
          selectedPoint={selectedMapPoint}
        />
        <div className="wind-strength-scale" aria-label="Wind strength for cycling">
          <strong>Riding impact</strong>
          <span><i className="wind-strength-dot wind-strength-dot--weak" />Weak</span>
          <span><i className="wind-strength-dot wind-strength-dot--noticeable" />Noticeable</span>
          <span><i className="wind-strength-dot wind-strength-dot--strong" />Strong</span>
          <span><i className="wind-strength-dot wind-strength-dot--very-strong" />Very strong</span>
        </div>
        <ElevationWindProfile
          points={routePoints}
          segments={analysis.segments}
          selectedPointIndex={selectedPointIndex}
          onSelectedPointIndexChange={setSelectedPointIndex}
        />
        <div className="legend">
          <span><i className="dot dot--tail" />Tailwind</span>
          <span><i className="dot dot--cross" />Crosswind</span>
          <span><i className="dot dot--head" />Headwind</span>
          <span><i className="direction-key">➤</i>Ride direction</span>
          <span><i className="wind-key">➤</i>Wind flow</span>
        </div>
        <section className="detail-summary detail-summary--single">
          <div>
            <span>Max gust</span>
            <strong>{round(analysis.maxGustKmh)} km/h</strong>
          </div>
        </section>
        <p className="fine-print">Forecast conditions are estimates at 10 m above ground. Local terrain, trees, and buildings can change the wind you feel.</p>
      </div>
    </div>
  )
}

function EmptyRide({ onImport }: { onImport: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-illustration" aria-hidden="true">
        <span className="wind-line wind-line--one" />
        <span className="wind-line wind-line--two" />
        <span className="bike-mark">◉—◉</span>
      </div>
      <h2>Add your usual rides</h2>
      <p>Import GPX tracks once. BikeWind keeps them on this device and compares the wind whenever you’re ready to go.</p>
      <button className="primary-button" onClick={onImport}>Import GPX routes</button>
      <span className="privacy-note">No account · no server · no API key</span>
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState<Screen>('ride')
  const [routes, setRoutes] = useState<StoredRoute[]>([])
  const [loadingRoutes, setLoadingRoutes] = useState(true)
  const [averageSpeed, setAverageSpeed] = useState(() => Number(localStorage.getItem('averageSpeed')) || 24)
  const [departureMode, setDepartureMode] = useState<DepartureMode>('now')
  const [laterDeparture, setLaterDeparture] = useState(defaultLaterTime)
  const [calculatedDepartureTimeMs, setCalculatedDepartureTimeMs] = useState<number | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(true)
  const [results, setResults] = useState<RouteAnalysis[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [selectedAnalysis, setSelectedAnalysis] = useState<RouteAnalysis | null>(null)
  const [windAreaOpen, setWindAreaOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const abortController = useRef<AbortController | null>(null)

  const favoriteCount = routes.filter((route) => route.favorite).length
  const routesToAnalyze = useMemo(
    () => (favoritesOnly && favoriteCount > 0 ? routes.filter((route) => route.favorite) : routes),
    [favoriteCount, favoritesOnly, routes],
  )
  const selectedRoute = selectedAnalysis
    ? routes.find((route) => route.id === selectedAnalysis.routeId)
    : undefined

  useEffect(() => {
    getRoutes()
      .then(setRoutes)
      .catch(() => setError('This browser could not open local route storage.'))
      .finally(() => setLoadingRoutes(false))
    return () => abortController.current?.abort()
  }, [])

  async function reloadRoutes() {
    setRoutes(await getRoutes())
    setResults([])
  }

  async function importFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    let imported = 0
    let updated = 0
    const knownRoutes = await getRoutes()
    const failures: string[] = []
    for (const file of Array.from(files)) {
      try {
        const parsed = parseGpx(await file.text(), file.name)
        const { route, existingIndex } = prepareImportedRoute(
          parsed,
          knownRoutes,
          crypto.randomUUID(),
          new Date().toISOString(),
        )
        await saveRoute(route)
        if (existingIndex >= 0) {
          knownRoutes[existingIndex] = route
          updated += 1
        } else {
          knownRoutes.push(route)
          imported += 1
        }
      } catch (reason) {
        failures.push(`${file.name}: ${reason instanceof Error ? reason.message : 'Could not import.'}`)
      }
    }
    await reloadRoutes()
    setScreen('routes')
    const messages = [
      imported ? `${imported} route${imported === 1 ? '' : 's'} added` : '',
      updated ? `${updated} route${updated === 1 ? '' : 's'} updated with GPX filename${updated === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    setImportMessage(messages.length ? `${messages.join(' · ')}.` : null)
    if (failures.length) setError(failures.join(' '))
    if (fileInput.current) fileInput.current.value = ''
  }

  async function toggleFavorite(route: StoredRoute) {
    await setFavorite(route.id, !route.favorite)
    await reloadRoutes()
  }

  async function removeRoute(route: StoredRoute) {
    if (!window.confirm(`Remove “${route.name}” from this device?`)) return
    await deleteRoute(route.id)
    await reloadRoutes()
  }

  async function rideNow() {
    if (!routesToAnalyze.length) return
    const startTimeMs = departureMode === 'now' ? Date.now() : new Date(laterDeparture).getTime()
    if (!Number.isFinite(startTimeMs)) {
      setError('Choose a valid departure date and time.')
      return
    }
    if (departureMode === 'later' && startTimeMs < Date.now() - 60_000) {
      setError('The later departure time must be in the future.')
      return
    }
    if (startTimeMs > Date.now() + 7 * DAY_MS) {
      setError('Choose a departure within the next 7 days.')
      return
    }
    abortController.current?.abort()
    const controller = new AbortController()
    abortController.current = controller
    setAnalyzing(true)
    setError(null)
    setResults([])
    try {
      setResults(await analyzeRoutes(routesToAnalyze, averageSpeed, {
        startTimeMs,
        signal: controller.signal,
      }))
      setCalculatedDepartureTimeMs(startTimeMs)
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(reason instanceof Error ? reason.message : 'Could not check the wind. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  function updateSpeed(speed: number) {
    const safeSpeed = Math.max(8, Math.min(50, speed || 24))
    setAverageSpeed(safeSpeed)
    localStorage.setItem('averageSpeed', String(safeSpeed))
    setResults([])
  }

  function chooseDepartureMode(mode: DepartureMode) {
    if (mode === 'later' && new Date(laterDeparture).getTime() < Date.now()) {
      setLaterDeparture(defaultLaterTime())
    }
    setDepartureMode(mode)
    setResults([])
    setCalculatedDepartureTimeMs(null)
  }

  return (
    <div className="app-shell">
      <input
        ref={fileInput}
        className="visually-hidden"
        type="file"
        accept=".gpx,application/gpx+xml,application/xml,text/xml"
        multiple
        onChange={(event) => void importFiles(event.target.files)}
      />

      <main>
        {screen === 'ride' ? (
          <div className="screen ride-screen">
            <header className="topbar">
              <div>
                <span className="eyebrow">BIKEWIND</span>
                <h1>Where should I ride?</h1>
              </div>
              {routes.length > 0 && (
                <span className={`now-badge ${departureMode === 'later' ? 'now-badge--later' : ''}`}>
                  <i />
                  {departureMode === 'now' ? 'Now' : departureLabel(new Date(laterDeparture).getTime())}
                </span>
              )}
            </header>

            <button className="wind-map-launch" onClick={() => setWindAreaOpen(true)}>
              <span className="wind-map-launch__icon" aria-hidden="true">
                <i>➤</i><i>➤</i><i>➤</i>
              </span>
              <span className="wind-map-launch__copy">
                <strong>Show wind map</strong>
              </span>
              <span className="chevron">›</span>
            </button>

            {error && <div className="alert" role="alert">{error}<button onClick={() => setError(null)}>×</button></div>}
            {!loadingRoutes && routes.length === 0 ? (
              <EmptyRide onImport={() => fileInput.current?.click()} />
            ) : (
              <>
                <section className="control-card">
                  <div className="control-row">
                    <div>
                      <span>Routes to compare</span>
                      <strong>{favoritesOnly && favoriteCount > 0 ? `${favoriteCount} favorite${favoriteCount === 1 ? '' : 's'}` : `${routes.length} route${routes.length === 1 ? '' : 's'}`}</strong>
                    </div>
                    <label className="switch-row">
                      <span>Favorites only</span>
                      <input type="checkbox" checked={favoritesOnly} onChange={(event) => { setFavoritesOnly(event.target.checked); setResults([]) }} disabled={favoriteCount === 0} />
                      <i />
                    </label>
                  </div>
                  <div className={`control-row control-row--departure ${departureMode === 'later' ? 'control-row--expanded' : ''}`}>
                    <div>
                      <span>Departure</span>
                      <strong>{departureMode === 'now' ? 'Start now' : departureLabel(new Date(laterDeparture).getTime())}</strong>
                    </div>
                    <div className="departure-toggle" role="group" aria-label="Departure time">
                      <button
                        className={departureMode === 'now' ? 'active' : ''}
                        onClick={() => chooseDepartureMode('now')}
                        aria-pressed={departureMode === 'now'}
                      >Now</button>
                      <button
                        className={departureMode === 'later' ? 'active' : ''}
                        onClick={() => chooseDepartureMode('later')}
                        aria-pressed={departureMode === 'later'}
                      >Later</button>
                    </div>
                  </div>
                  {departureMode === 'later' && (
                    <label className="later-time-picker">
                      <span>Choose date and time</span>
                      <input
                        type="datetime-local"
                        value={laterDeparture}
                        min={toDateTimeInputValue(new Date())}
                        max={toDateTimeInputValue(new Date(Date.now() + 7 * DAY_MS))}
                        onChange={(event) => {
                          setLaterDeparture(event.target.value)
                          setResults([])
                          setCalculatedDepartureTimeMs(null)
                        }}
                      />
                    </label>
                  )}
                  <div className="control-row control-row--speed">
                    <div>
                      <span>Usual average speed</span>
                      <strong>Used to estimate where you’ll be</strong>
                    </div>
                    <div className="speed-input">
                      <button onClick={() => updateSpeed(averageSpeed - 1)} aria-label="Decrease speed">−</button>
                      <label><input type="number" inputMode="numeric" value={averageSpeed} onChange={(event) => updateSpeed(Number(event.target.value))} /><span>km/h</span></label>
                      <button onClick={() => updateSpeed(averageSpeed + 1)} aria-label="Increase speed">+</button>
                    </div>
                  </div>
                  <button className="ride-button" disabled={analyzing || routesToAnalyze.length === 0} onClick={() => void rideNow()}>
                    {analyzing
                      ? <><span className="spinner" />Checking every route…</>
                      : <><span className="ride-button__arrow">➜</span>{departureMode === 'now' ? 'Compare wind now' : `Compare wind at ${departureLabel(new Date(laterDeparture).getTime())}`}</>}
                  </button>
                  <p className="control-note">Checks normal and reverse direction using wind forecast for the time you reach each section.</p>
                </section>

                {results.length > 0 && (
                  <section className="results">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">
                          {calculatedDepartureTimeMs && departureMode === 'later'
                            ? `LEAVING ${departureLabel(calculatedDepartureTimeMs).toUpperCase()}`
                            : 'LEAVING NOW'}
                        </span>
                        <h2>{results.length} route directions</h2>
                      </div>
                      <button onClick={() => void rideNow()} aria-label="Refresh wind">↻</button>
                    </div>
                    <div className="results-list">
                      {results.map((analysis) => {
                        const route = routes.find((candidate) => candidate.id === analysis.routeId)
                        return route ? (
                          <ResultCard
                            key={analysis.id}
                            analysis={analysis}
                            route={route}
                            onOpen={() => setSelectedAnalysis(analysis)}
                          />
                        ) : null
                      })}
                    </div>
                    <p className="attribution">Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a></p>
                  </section>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="screen library-screen">
            <header className="topbar topbar--library">
              <div><span className="eyebrow">YOUR COLLECTION</span><h1>Routes</h1></div>
              <button className="add-button" onClick={() => fileInput.current?.click()}>＋ Add GPX</button>
            </header>
            {importMessage && <div className="success-message">{importMessage}<button onClick={() => setImportMessage(null)}>×</button></div>}
            {error && <div className="alert" role="alert">{error}<button onClick={() => setError(null)}>×</button></div>}
            {routes.length === 0 ? (
              <EmptyRide onImport={() => fileInput.current?.click()} />
            ) : (
              <>
                <p className="library-intro">Star the routes you want included when you compare the wind.</p>
                <div className="route-list">
                  {routes.map((route) => (
                    <article className="route-card" key={route.id}>
                      <div className="route-card__preview"><RoutePreview points={route.points} /></div>
                      <div className="route-card__copy">
                        <h3>{route.name}</h3>
                        <p>{route.distanceKm.toFixed(1)} km <span>·</span> {route.points.length.toLocaleString()} points</p>
                      </div>
                      <button className={`favorite-button ${route.favorite ? 'favorite-button--active' : ''}`} onClick={() => void toggleFavorite(route)} aria-label={route.favorite ? `Remove ${route.name} from favorites` : `Add ${route.name} to favorites`}>{route.favorite ? '★' : '☆'}</button>
                      <button className="more-button" onClick={() => void removeRoute(route)} aria-label={`Remove ${route.name}`}>×</button>
                    </article>
                  ))}
                </div>
                <div className="local-card"><span>⌁</span><div><strong>Routes stay on this device</strong><p>Your GPX files are stored privately in Safari. Nothing is uploaded to BikeWind.</p></div></div>
              </>
            )}
          </div>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={screen === 'ride' ? 'active' : ''} onClick={() => setScreen('ride')}><span>➤</span>Ride now</button>
        <button className={screen === 'routes' ? 'active' : ''} onClick={() => setScreen('routes')}><span>⌁</span>Routes{routes.length > 0 && <i>{routes.length}</i>}</button>
      </nav>

      {selectedAnalysis && selectedRoute && (
        <AnalysisDetail
          analysis={selectedAnalysis}
          route={selectedRoute}
          onClose={() => setSelectedAnalysis(null)}
        />
      )}
      {windAreaOpen && <WindAreaView onClose={() => setWindAreaOpen(false)} />}
    </div>
  )
}

export default App
