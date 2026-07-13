import type { GeoPoint, WeatherSample } from '../domain/types'

const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
const BATCH_SIZE = 40

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

  for (const batch of chunks(requests, BATCH_SIZE)) {
    const params = new URLSearchParams({
      latitude: batch.map(({ point }) => point.latitude.toFixed(5)).join(','),
      longitude: batch.map(({ point }) => point.longitude.toFixed(5)).join(','),
      hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      wind_speed_unit: 'kmh',
      timeformat: 'unixtime',
      forecast_hours: String(forecastHours),
    })
    const response = await fetch(`${FORECAST_ENDPOINT}?${params}`, { signal })
    if (!response.ok) throw new Error(`Wind service error (${response.status}). Please try again.`)
    const payload = (await response.json()) as OpenMeteoLocation | OpenMeteoLocation[]
    const locations = Array.isArray(payload) ? payload : [payload]
    if (locations.length !== batch.length) throw new Error('Wind service returned unexpected route data.')

    locations.forEach((location, index) => {
      const request = batch[index]
      if (request) result.set(request.key, closestWeather(location, request.targetTimeMs))
    })
  }
  return result
}
