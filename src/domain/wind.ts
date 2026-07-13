import type { SegmentWind } from './types'

export type CyclingWindStrength = 'weak' | 'noticeable' | 'strong' | 'very-strong'

const radians = (degrees: number) => (degrees * Math.PI) / 180

export function windTravelDirection(directionFromDegrees: number): number {
  return (directionFromDegrees + 180) % 360
}

export function compassDirection(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const normalized = ((degrees % 360) + 360) % 360
  return directions[Math.round(normalized / 45) % directions.length] ?? 'N'
}

export function cyclingWindStrength(speedKmh: number, gustKmh: number): CyclingWindStrength {
  const ridingImpactKmh = Math.max(speedKmh, gustKmh * 0.65)
  if (ridingImpactKmh < 10) return 'weak'
  if (ridingImpactKmh < 20) return 'noticeable'
  if (ridingImpactKmh < 30) return 'strong'
  return 'very-strong'
}

export function cyclingWindStrengthLabel(strength: CyclingWindStrength): string {
  if (strength === 'very-strong') return 'Very strong'
  return `${strength[0]?.toUpperCase() ?? ''}${strength.slice(1)}`
}

export function windComponents(
  speedKmh: number,
  directionFromDegrees: number,
  routeBearingDegrees: number,
): { alongKmh: number; crossKmh: number } {
  const directionToward = windTravelDirection(directionFromDegrees)
  const relativeAngle = radians(directionToward - routeBearingDegrees)
  return {
    alongKmh: speedKmh * Math.cos(relativeAngle),
    crossKmh: speedKmh * Math.sin(relativeAngle),
  }
}

export function summarizeSegments(segments: SegmentWind[]) {
  const totalDistance = segments.reduce((sum, segment) => sum + segment.distanceKm, 0)
  if (totalDistance === 0) {
    return {
      averageHeadwindKmh: 0,
      averageTailwindKmh: 0,
      averageCrosswindKmh: 0,
      headwindPercent: 0,
      tailwindPercent: 0,
      crosswindPercent: 0,
      maxGustKmh: 0,
    }
  }

  let headwindWeighted = 0
  let tailwindWeighted = 0
  let crosswindWeighted = 0
  let headwindDistance = 0
  let tailwindDistance = 0
  let crosswindDistance = 0
  let maxGustKmh = 0

  for (const segment of segments) {
    const headwind = Math.max(0, -segment.alongKmh)
    const tailwind = Math.max(0, segment.alongKmh)
    headwindWeighted += headwind * segment.distanceKm
    tailwindWeighted += tailwind * segment.distanceKm
    crosswindWeighted += Math.abs(segment.crossKmh) * segment.distanceKm
    maxGustKmh = Math.max(maxGustKmh, segment.gustKmh)

    if (segment.alongKmh < -1) headwindDistance += segment.distanceKm
    else if (segment.alongKmh > 1) tailwindDistance += segment.distanceKm
    else crosswindDistance += segment.distanceKm
  }

  const averageHeadwindKmh = headwindWeighted / totalDistance
  const averageTailwindKmh = tailwindWeighted / totalDistance
  const averageCrosswindKmh = crosswindWeighted / totalDistance
  return {
    averageHeadwindKmh,
    averageTailwindKmh,
    averageCrosswindKmh,
    headwindPercent: (headwindDistance / totalDistance) * 100,
    tailwindPercent: (tailwindDistance / totalDistance) * 100,
    crosswindPercent: (crosswindDistance / totalDistance) * 100,
    maxGustKmh,
  }
}
