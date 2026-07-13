import { routeDistanceKm } from './geo'
import type { GeoPoint, StoredRoute } from './types'

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

function fileNameWithoutExtension(name: string): string {
  return name.replace(/\.gpx$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled route'
}

export function parseGpx(xml: string, fileName: string): Omit<StoredRoute, 'id' | 'favorite' | 'importedAt'> {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (document.querySelector('parsererror')) throw new Error('This file is not valid GPX XML.')

  const trackPoints = elementsByLocalName(document, 'trkpt')
  const routePoints = elementsByLocalName(document, 'rtept')
  const pointElements = trackPoints.length > 0 ? trackPoints : routePoints
  const points = pointElements.map(pointFromElement).filter((point): point is GeoPoint => point !== null)
  if (points.length < 2) throw new Error('The GPX file needs at least two track or route points.')

  const nameElement = elementsByLocalName(document, 'name')[0]
  const name = nameElement?.textContent?.trim() || fileNameWithoutExtension(fileName)
  return { name, points, distanceKm: routeDistanceKm(points) }
}
