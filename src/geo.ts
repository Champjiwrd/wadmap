export type LngLat = [number, number]
export type Locale = 'th' | 'en'

export const EARTH_RADIUS_M = 6_371_008.8
const ARC_STEP_M = 50_000 // long segments are split so they follow the great circle on a globe
const SQM_PER_RAI = 1600

const rad = (deg: number) => deg * Math.PI / 180
const deg = (r: number) => r * 180 / Math.PI

/** Great-circle distance in meters */
export function haversine([lon1, lat1]: LngLat, [lon2, lat2]: LngLat) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Total length in meters of a path through the given points */
export function pathLength(points: LngLat[]) {
  return points.slice(1).reduce((sum, p, i) => sum + haversine(points[i]!, p), 0)
}

/** Area in square meters of a ring on the sphere (open or closed ring; same formula as turf.area) */
export function sphericalArea(ring: LngLat[]) {
  if (ring.length < 3) return 0
  let sum = 0
  ring.forEach(([lon1, lat1], i) => {
    const [lon2, lat2] = ring[(i + 1) % ring.length]!
    sum += rad(lon2 - lon1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)))
  })
  return Math.abs(sum * EARTH_RADIUS_M ** 2 / 2)
}

/** Points along the great circle from a to b, excluding b */
export function greatCircle(a: LngLat, b: LngLat, stepMeters = ARC_STEP_M): LngLat[] {
  const d = haversine(a, b) / EARTH_RADIUS_M
  const steps = Math.ceil(d * EARTH_RADIUS_M / stepMeters)
  if (steps <= 1) return [a]
  const [lon1, lat1, lon2, lat2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])]
  const points: LngLat[] = [a]
  for (let i = 1; i < steps; i++) {
    const f = i / steps
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    points.push([deg(Math.atan2(y, x)), deg(Math.atan2(z, Math.hypot(x, y)))])
  }
  return points
}

/**
 * Densified great-circle path through the given points, with longitudes kept continuous
 * (e.g. 179 → 181 instead of 179 → -179) so lines do not jump across the antimeridian
 */
export function arcLine(points: LngLat[], stepMeters = ARC_STEP_M): LngLat[] {
  if (points.length < 2) return points
  const line = [...points.slice(0, -1).flatMap((p, i) => greatCircle(p, points[i + 1]!, stepMeters)), points.at(-1)!]
  for (let i = 1; i < line.length; i++) {
    const prev = line[i - 1]![0]
    const [lon, lat] = line[i]!
    line[i] = [lon + Math.round((prev - lon) / 360) * 360, lat]
  }
  return line
}

const toVector = ([lon, lat]: LngLat) =>
  [Math.cos(rad(lat)) * Math.cos(rad(lon)), Math.cos(rad(lat)) * Math.sin(rad(lon)), Math.sin(rad(lat))] as const

/** The point halfway along the great circle from a to b, with its longitude kept next to a's */
export function midpoint(a: LngLat, b: LngLat): LngLat {
  const [ax, ay, az] = toVector(a)
  const [bx, by, bz] = toVector(b)
  const [x, y, z] = [ax + bx, ay + by, az + bz]
  const lon = deg(Math.atan2(y, x))
  return [lon + Math.round((a[0] - lon) / 360) * 360, deg(Math.atan2(z, Math.hypot(x, y)))]
}

/**
 * Moves points across the sphere so that `from` lands on `to`, by rotating the globe about the axis
 * through both. Distances, angles and area are kept exactly, unlike adding a lng/lat offset.
 * Longitudes come back within 180° of `to`'s, so `to` itself may be outside -180..180
 */
export function movePoints(points: LngLat[], from: LngLat, to: LngLat): LngLat[] {
  const a = toVector(from)
  const b = toVector(to)
  // Rotation axis a × b; its length is sin of the angle, a · b the cosine
  let k = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const sin = Math.hypot(k[0]!, k[1]!, k[2]!)
  const cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  k = sin < 1e-12 ? [0, 0, 0] : k.map(c => c / sin)
  const [kx, ky, kz] = k as [number, number, number]
  return points.map(p => {
    // Rodrigues' rotation formula
    const [x, y, z] = toVector(p)
    const dot = kx * x + ky * y + kz * z
    const cx = ky * z - kz * y
    const cy = kz * x - kx * z
    const cz = kx * y - ky * x
    const rx = x * cos + cx * sin + kx * dot * (1 - cos)
    const ry = y * cos + cy * sin + ky * dot * (1 - cos)
    const rz = z * cos + cz * sin + kz * dot * (1 - cos)
    const lon = sin < 1e-12 && cos > 0 ? p[0] : deg(Math.atan2(ry, rx))
    const lat = deg(Math.atan2(rz, Math.hypot(rx, ry)))
    return [lon + Math.round((to[0] - lon) / 360) * 360, lat]
  })
}

const number = (n: number, locale: Locale, digits: number) =>
  n.toLocaleString(locale === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: digits })

export function formatDistance(m: number, locale: Locale = 'th') {
  const [mUnit, kmUnit] = locale === 'th' ? ['ม.', 'กม.'] : ['m', 'km']
  return m < 1000 ? `${number(m, locale, 0)} ${mUnit}` : `${number(m / 1000, locale, 2)} ${kmUnit}`
}

export function formatArea(m2: number, locale: Locale = 'th') {
  if (locale === 'th') {
    if (m2 >= 1_000_000) return `${number(m2 / 1_000_000, locale, 2)} ตร.กม.`
    return `${number(m2, locale, 0)} ตร.ม. (${number(m2 / SQM_PER_RAI, locale, 2)} ไร่)`
  }
  if (m2 >= 1_000_000) return `${number(m2 / 1_000_000, locale, 2)} km²`
  if (m2 >= 10_000) return `${number(m2 / 10_000, locale, 2)} ha`
  return `${number(m2, locale, 0)} m²`
}
