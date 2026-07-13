import { routeDistanceKm, sameRouteGeometry } from './geo'
import type { GeoPoint, StoredRoute } from './types'

export type ParsedGpxRoute = Omit<StoredRoute, 'id' | 'favorite' | 'importedAt'>

function elementsByLocalName(root: Document, localName: string): Element[] {
  return Array.from(root.getElementsByTagName('*')).filter(
    (element) => element.localName.toLowerCase() === localName,
  )
}

function pointFromElement(element: Element): GeoPoint | null {
  const latitude = Number(element.getAttribute('lat'))
  const longitude = Number(element.getAttribute('lon'))
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  const elevationElement = Array.from(element.children).find(
    (child) => child.localName.toLowerCase() === 'ele',
  )
  const elevation = elevationElement ? Number(elevationElement.textContent) : undefined
  return {
    latitude,
    longitude,
    ...(Number.isFinite(elevation) ? { elevation } : {}),
  }
}

export function routeNameFromFileName(name: string): string {
  return name.replace(/\.gpx$/i, '').trim() || 'Untitled route'
}

export function parseGpx(xml: string, fileName: string): ParsedGpxRoute {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (document.querySelector('parsererror')) throw new Error('This file is not valid GPX XML.')

  const trackPoints = elementsByLocalName(document, 'trkpt')
  const routePoints = elementsByLocalName(document, 'rtept')
  const pointElements = trackPoints.length > 0 ? trackPoints : routePoints
  const points = pointElements.map(pointFromElement).filter((point): point is GeoPoint => point !== null)
  if (points.length < 2) throw new Error('The GPX file needs at least two track or route points.')

  return {
    name: routeNameFromFileName(fileName),
    points,
    distanceKm: routeDistanceKm(points),
  }
}

export function prepareImportedRoute(
  parsed: ParsedGpxRoute,
  existingRoutes: StoredRoute[],
  newId: string,
  importedAt: string,
): { route: StoredRoute; existingIndex: number } {
  const existingIndex = existingRoutes.findIndex((route) =>
    sameRouteGeometry(route.points, parsed.points))
  const existing = existingIndex >= 0 ? existingRoutes[existingIndex] : undefined
  return {
    existingIndex,
    route: existing
      ? { ...existing, ...parsed, importedAt }
      : { ...parsed, id: newId, favorite: true, importedAt },
  }
}
