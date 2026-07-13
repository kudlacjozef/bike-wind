import type { GeoPoint, WeatherSample } from '../domain/types'

const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
const BATCH_SIZE = 40
const CACHE_STORAGE_KEY = 'bikewind.wind-cache.v1'
const CACHE_TTL_MS = 20 * 60 * 1000
const CACHE_MAX_ENTRIES = 800
const RATE_LIMIT_RETRIES = 2

interface CachedWeather {
  sample: WeatherSample
  cachedAt: number
}

const weatherCache = new Map<string, CachedWeather>()
let cacheHydrated = false

interface WeatherRequestPoint {
  key: string
  point: GeoPoint
}

interface OpenMeteoLocation {
  hourly?: {
    time?: number[]
    wind_speed_10m?: number[]
    wind_direction_10m?: number[]
    wind_gusts_10m?: number[]
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size))
  return result
}

function locationKey(point: GeoPoint): string {
  return `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`
}

function cacheKey(point: GeoPoint, targetTimeMs: number): string {
  return `${locationKey(point)}:${Math.round(targetTimeMs / 3_600_000)}`
}

function hydrateCache(now = Date.now()): void {
  if (cacheHydrated) return
  cacheHydrated = true
  try {
    const stored = localStorage.getItem(CACHE_STORAGE_KEY)
    if (!stored) return
    const entries = JSON.parse(stored) as Array<[string, CachedWeather]>
    for (const [key, value] of entries) {
      if (now - value.cachedAt < CACHE_TTL_MS) weatherCache.set(key, value)
    }
  } catch {
    // Forecast caching is an optimization; private browsing may disable storage.
  }
}

function persistCache(now = Date.now()): void {
  try {
    const entries = [...weatherCache.entries()]
      .filter(([, value]) => now - value.cachedAt < CACHE_TTL_MS)
      .sort((a, b) => b[1].cachedAt - a[1].cachedAt)
      .slice(0, CACHE_MAX_ENTRIES)
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Keep using the in-memory cache when persistent storage is unavailable.
  }
}

function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      globalThis.clearTimeout(timeout)
      reject(new DOMException('The request was aborted.', 'AbortError'))
    }
    const timeout = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('retry-after')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return Math.min(5_000, Math.max(0, seconds * 1_000))
    const dateDelay = Date.parse(retryAfter) - Date.now()
    if (Number.isFinite(dateDelay)) return Math.min(5_000, Math.max(0, dateDelay))
  }
  return 1_000 * (attempt + 1)
}

async function fetchForecast(url: string, signal?: AbortSignal): Promise<Response> {
  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt += 1) {
    const response = await fetch(url, { signal })
    if (response.status !== 429) return response
    if (attempt < RATE_LIMIT_RETRIES) await abortableDelay(retryDelay(response, attempt), signal)
  }
  throw new Error('Open-Meteo is temporarily limiting wind requests. Wait a few minutes and try again.')
}

function closestWeather(location: OpenMeteoLocation, targetTimeMs: number): WeatherSample {
  const hourly = location.hourly
  const times = hourly?.time
  if (!hourly || !times?.length) throw new Error('The wind service returned no hourly forecast.')

  let closestIndex = 0
  let closestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < times.length; index += 1) {
    const time = times[index]
    if (time === undefined) continue
    const distance = Math.abs(time * 1000 - targetTimeMs)
    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = index
    }
  }

  const speedKmh = hourly.wind_speed_10m?.[closestIndex]
  const directionFromDegrees = hourly.wind_direction_10m?.[closestIndex]
  const gustKmh = hourly.wind_gusts_10m?.[closestIndex]
  const time = times[closestIndex]
  if (
    speedKmh === undefined ||
    directionFromDegrees === undefined ||
    gustKmh === undefined ||
    time === undefined
  ) {
    throw new Error('The wind service returned an incomplete forecast.')
  }
  return { speedKmh, directionFromDegrees, gustKmh, time: time * 1000 }
}

export async function fetchWindSamples(
  requests: Array<WeatherRequestPoint & { targetTimeMs: number }>,
  forecastHours: number,
  signal?: AbortSignal,
): Promise<Map<string, WeatherSample>> {
  const result = new Map<string, WeatherSample>()
  const now = Date.now()
  hydrateCache(now)

  const missing = requests.filter((request) => {
    const cached = weatherCache.get(cacheKey(request.point, request.targetTimeMs))
    if (!cached || now - cached.cachedAt >= CACHE_TTL_MS) return true
    result.set(request.key, cached.sample)
    return false
  })
  const locations = new Map<string, { point: GeoPoint; requests: typeof missing }>()
  for (const request of missing) {
    const key = locationKey(request.point)
    const location = locations.get(key)
    if (location) location.requests.push(request)
    else locations.set(key, { point: request.point, requests: [request] })
  }

  for (const batch of chunks([...locations.values()], BATCH_SIZE)) {
    const params = new URLSearchParams({
      latitude: batch.map(({ point }) => point.latitude.toFixed(5)).join(','),
      longitude: batch.map(({ point }) => point.longitude.toFixed(5)).join(','),
      hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      wind_speed_unit: 'kmh',
      timeformat: 'unixtime',
      forecast_hours: String(forecastHours),
    })
    const response = await fetchForecast(`${FORECAST_ENDPOINT}?${params}`, signal)
    if (!response.ok) throw new Error(`Wind service error (${response.status}). Please try again.`)
    const payload = (await response.json()) as OpenMeteoLocation | OpenMeteoLocation[]
    const forecasts = Array.isArray(payload) ? payload : [payload]
    if (forecasts.length !== batch.length) throw new Error('Wind service returned unexpected route data.')

    forecasts.forEach((forecast, index) => {
      const location = batch[index]
      if (!location) return
      for (const request of location.requests) {
        const sample = closestWeather(forecast, request.targetTimeMs)
        result.set(request.key, sample)
        weatherCache.set(cacheKey(request.point, request.targetTimeMs), { sample, cachedAt: now })
      }
    })
  }
  if (missing.length > 0) persistCache(now)
  return result
}
