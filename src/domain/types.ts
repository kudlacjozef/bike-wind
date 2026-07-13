export interface GeoPoint {
  latitude: number
  longitude: number
  elevation?: number
}

export interface StoredRoute {
  id: string
  name: string
  points: GeoPoint[]
  distanceKm: number
  favorite: boolean
  importedAt: string
}

export interface RouteSample {
  point: GeoPoint
  distanceFromStartKm: number
}

export interface WeatherSample {
  time: number
  speedKmh: number
  directionFromDegrees: number
  gustKmh: number
}

export interface SegmentWind {
  start: GeoPoint
  end: GeoPoint
  distanceKm: number
  bearingDegrees: number
  windSpeedKmh: number
  windFromDegrees: number
  gustKmh: number
  alongKmh: number
  crossKmh: number
  arrivalTime: number
}

export type RouteDirection = 'forward' | 'reverse'

export interface RouteAnalysis {
  id: string
  routeId: string
  routeName: string
  direction: RouteDirection
  distanceKm: number
  durationMinutes: number
  averageHeadwindKmh: number
  averageTailwindKmh: number
  averageCrosswindKmh: number
  headwindPercent: number
  tailwindPercent: number
  crosswindPercent: number
  maxGustKmh: number
  segments: SegmentWind[]
}
