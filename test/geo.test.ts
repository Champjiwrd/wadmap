import { describe, expect, it } from 'vitest'
import { EARTH_RADIUS_M, alongPath, arcLine, centroid, formatArea, formatDistance, greatCircle, haversine, midpoint, movePoints, pathLength, sphericalArea, type LngLat } from '../src/geo'

const ONE_DEGREE_M = 2 * Math.PI * EARTH_RADIUS_M / 360

describe('haversine', () => {
  it('measures one degree along a meridian', () => {
    expect(haversine([100, 13], [100, 14])).toBeCloseTo(ONE_DEGREE_M, 3)
  })

  it('measures Bangkok to Chiang Mai at about 580 km', () => {
    expect(haversine([100.5018, 13.7563], [98.9853, 18.7883]) / 1000).toBeCloseTo(582, -1)
  })

  it('is zero for the same point', () => {
    expect(haversine([100, 13], [100, 13])).toBe(0)
  })
})

describe('pathLength', () => {
  it('adds up every segment', () => {
    expect(pathLength([[0, 0], [0, 1], [0, 2]])).toBeCloseTo(2 * ONE_DEGREE_M, 3)
  })
})

describe('sphericalArea', () => {
  it('matches the exact area of a 1° x 1° cell at the equator', () => {
    const exact = EARTH_RADIUS_M ** 2 * (Math.PI / 180) * Math.sin(Math.PI / 180)
    expect(sphericalArea([[0, 0], [1, 0], [1, 1], [0, 1]])).toBeCloseTo(exact, 0)
  })

  it('does not depend on winding order', () => {
    const ring: [number, number][] = [[100, 13], [100.01, 13], [100.01, 13.01]]
    expect(sphericalArea(ring)).toBeCloseTo(sphericalArea([...ring].reverse()), 6)
  })

  it('is zero for fewer than three points', () => {
    expect(sphericalArea([[0, 0], [1, 1]])).toBe(0)
  })
})

describe('greatCircle', () => {
  it('returns only the start for short segments', () => {
    expect(greatCircle([100, 13], [100.1, 13])).toEqual([[100, 13]])
  })

  it('stays on the great circle (equator stays at latitude 0)', () => {
    for (const [, lat] of greatCircle([0, 0], [90, 0])) expect(lat).toBeCloseTo(0, 9)
  })
})

describe('arcLine', () => {
  it('starts and ends at the given points', () => {
    const line = arcLine([[100.5, 13.7], [139.7, 35.7]])
    expect(line[0]).toEqual([100.5, 13.7])
    expect(line.at(-1)).toEqual([139.7, 35.7])
    expect(line.length).toBeGreaterThan(2)
  })

  it('keeps longitudes continuous across the antimeridian', () => {
    const line = arcLine([[170, 0], [-170, 0]])
    for (let i = 1; i < line.length; i++) {
      expect(Math.abs(line[i]![0] - line[i - 1]![0])).toBeLessThan(180)
    }
    expect(line.at(-1)![0]).toBeCloseTo(190, 9)
  })
})

describe('format', () => {
  it('formats distance in Thai and English', () => {
    expect(formatDistance(850)).toBe('850 ม.')
    expect(formatDistance(12_345)).toBe('12.35 กม.')
    expect(formatDistance(12_345, 'en')).toBe('12.35 km')
  })

  it('formats area with rai in Thai', () => {
    expect(formatArea(3200)).toBe('3,200 ตร.ม. (2 ไร่)')
    expect(formatArea(2_500_000)).toBe('2.5 ตร.กม.')
    expect(formatArea(25_000, 'en')).toBe('2.5 ha')
  })
})

describe('movePoints', () => {
  const square: LngLat[] = [[100, 13], [101, 13], [101, 14], [100, 14]]

  it('puts the grabbed point exactly under the cursor', () => {
    const [moved] = movePoints([[100.5, 13.5]], [100.5, 13.5], [120, 40])
    expect(moved![0]).toBeCloseTo(120, 9)
    expect(moved![1]).toBeCloseTo(40, 9)
  })

  it('keeps area and side lengths when moved far north', () => {
    const moved = movePoints(square, [100.5, 13.5], [20, 60])
    // sphericalArea is an approximation (as in turf), so allow 0.05%
    expect(sphericalArea(moved) / sphericalArea(square)).toBeCloseTo(1, 3)
    expect(pathLength(moved)).toBeCloseTo(pathLength(square), 3)
  })

  it('returns the same points when not moved', () => {
    movePoints(square, [100.5, 13.5], [100.5, 13.5]).forEach((p, i) => {
      expect(p[0]).toBeCloseTo(square[i]![0], 9)
      expect(p[1]).toBeCloseTo(square[i]![1], 9)
    })
  })

  it('keeps longitudes near the cursor across the antimeridian', () => {
    const moved = movePoints(square, [100.5, 13.5], [190, 13.5])
    for (const [lon] of moved) expect(Math.abs(lon - 190)).toBeLessThan(5)
  })
})

describe('midpoint', () => {
  it('is equally far from both ends, on the great circle', () => {
    const a: LngLat = [100, 13]
    const b: LngLat = [120, 40]
    const m = midpoint(a, b)
    expect(haversine(a, m)).toBeCloseTo(haversine(m, b), 3)
    expect(haversine(a, m) + haversine(m, b)).toBeCloseTo(haversine(a, b), 3)
  })

  it('keeps the longitude next to the first point across the antimeridian', () => {
    const [lon, lat] = midpoint([179, 0], [-179, 0])
    expect(lon).toBeCloseTo(180, 9)
    expect(lat).toBeCloseTo(0, 9)
  })
})

describe('alongPath', () => {
  it('finds the halfway point by length, not by point count', () => {
    const [lon, lat] = alongPath([[100, 0], [100.1, 0], [100.4, 0]])!
    expect(lon).toBeCloseTo(100.2, 6)
    expect(lat).toBeCloseTo(0, 6)
  })

  it('returns the ends at 0 and 1', () => {
    const path: LngLat[] = [[100, 13], [101, 14]]
    const [lon0, lat0] = alongPath(path, 0)!
    expect(lon0).toBeCloseTo(100, 9)
    expect(lat0).toBeCloseTo(13, 9)
    expect(alongPath(path, 1)![0]).toBeCloseTo(101, 9)
  })
})

describe('centroid', () => {
  it('finds the center of a square', () => {
    const [lon, lat] = centroid([[100, 13], [101, 13], [101, 14], [100, 14]])!
    expect(lon).toBeCloseTo(100.5, 9)
    expect(lat).toBeCloseTo(13.5, 9)
  })

  it('weights by area, not by point count', () => {
    // Extra points along the bottom edge must not pull the center down
    const [, lat] = centroid([[0, 0], [0.25, 0], [0.5, 0], [0.75, 0], [1, 0], [1, 1], [0, 1]])!
    expect(lat).toBeCloseTo(0.5, 9)
  })

  it('handles a polygon across the antimeridian', () => {
    const [lon] = centroid([[179, 0], [-179, 0], [-179, 1], [179, 1]])!
    expect(((lon % 360) + 360) % 360).toBeCloseTo(180, 9)
  })
})
