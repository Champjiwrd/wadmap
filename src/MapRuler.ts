import { arcLine, formatArea, formatDistance, midpoint, movePoints, pathLength, sphericalArea, type LngLat, type Locale } from './geo'
import { Control, type ControlPosition } from './control'
import { injectStyles } from './style'

export type MeasureMode = 'distance' | 'area'

export interface MapRulerOptions {
  /** Line, point and label color. Default `#facc15` */
  color?: string
  /** Language for labels and the built-in control. Default `th` */
  locale?: Locale
  /** Show the built-in tool buttons. `true` puts them at bottom-right. Default `false` */
  control?: boolean | ControlPosition
  /** Show each shape's measurement next to its last point. Default `true` */
  label?: boolean
  /** Inject the default stylesheet. Turn off to ship your own CSS. Default `true` */
  injectStyles?: boolean
}

export interface ShapeState {
  id: number
  mode: MeasureMode
  /** Placed points as [lng, lat] */
  points: LngLat[]
  /** False while the shape is still being drawn */
  finished: boolean
  /** Path length in meters; the perimeter for an area. Includes the point under the cursor while drawing */
  distance: number
  /** Area in square meters; 0 for a distance */
  area: number
}

export interface MeasureState {
  /** The measuring tool that is on (what clicking empty map draws), or null when off */
  mode: MeasureMode | null
  /** Every shape on the map in drawing order, including one still being drawn */
  shapes: ShapeState[]
  /** The shape being drawn, or else the selected one. For `finish`, the shape that was finished or edited */
  current: ShapeState | null
  /** Id of the selected shape, the only finished shape that can be edited */
  selected: number | null
}

type EventName = 'change' | 'finish'
type Listener = (state: MeasureState) => void

interface Shape {
  id: number
  mode: MeasureMode
  points: LngLat[]
  finished: boolean
}

let instances = 0

// Pixels the pointer must travel before pressing on a point turns into a drag
const DRAG_THRESHOLD = 3
// How close, in pixels, the pointer must be to the selected shape's line to grab it
const LINE_TOLERANCE = 8

type ScreenPoint = { x: number; y: number }

/** What is under the pointer */
type Hit =
  // A point of the current shape
  | { kind: 'vertex'; index: number }
  // The handle halfway along a segment of the current shape; `index` is where its point goes
  | { kind: 'mid'; index: number; at: LngLat }
  // The line of the selected shape, or the inside of the selected polygon: dragging moves it all
  | { kind: 'body' }
  // The line or inside of another finished shape, which a click selects
  | { kind: 'select'; shape: Shape }

type DragHit = Exclude<Hit, { kind: 'select' }>

// Distance from p to the segment a-b
function distanceToSegment(p: ScreenPoint, a: ScreenPoint, b: ScreenPoint) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = dx || dy ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/**
 * Distance and area measuring tool for Longdo Map v3 and MapLibre GL JS.
 *
 * Pass a `longdo.Map` (after its `ready` event) or a `maplibregl.Map` (after `load`).
 */
export class MapRuler {
  readonly renderer: any
  private readonly options: Required<Omit<MapRulerOptions, 'control'>>
  private readonly id = `mapruler-${instances++}`
  private _mode: MeasureMode | null = null
  private shapes: Shape[] = []
  private nextId = 1
  // The shape being drawn; at most one at a time
  private drawing: Shape | null = null
  // The finished shape whose points can be dragged
  private selected: Shape | null = null
  // The point under the cursor, drawn as the next point of the shape being drawn
  private hover: LngLat | null = null
  // What is being dragged, with the pointer (`from`, the handle's spot for a midpoint) and the
  // shape's points (`origin`) at press time. `moved` stays false until the pointer passes DRAG_THRESHOLD
  private drag: { shape: Shape; hit: DragHit; from: LngLat; origin: LngLat[]; start: ScreenPoint; moved: boolean } | null = null
  // Swallow the click that follows a drag, so it doesn't add a point or change the selection
  private suppressClick = false
  // Whether the canvas cursor was set by us, so with the tool off we leave the app's own cursor alone
  private cursorOwned = false
  private listeners: Record<EventName, Set<Listener>> = { change: new Set(), finish: new Set() }
  private labels = new Map<number, HTMLDivElement>()
  private control: Control | null = null

  constructor(map: any, options: MapRulerOptions = {}) {
    // Longdo Map v3 renders with MapLibre and exposes it as map.Renderer
    this.renderer = map?.Renderer ?? map
    if (typeof this.renderer?.addSource !== 'function') {
      throw new TypeError('MapRuler: expected a longdo.Map (after ready) or a maplibregl.Map')
    }
    this.options = {
      color: options.color ?? '#facc15',
      locale: options.locale ?? 'th',
      label: options.label ?? true,
      injectStyles: options.injectStyles ?? true
    }
    if (this.options.injectStyles) injectStyles()

    const r = this.renderer
    r.on('click', this.onClick)
    r.on('mousemove', this.onMove)
    r.on('dblclick', this.onDblClick)
    r.on('mousedown', this.onDown)
    r.on('touchstart', this.onDown)
    r.on('touchmove', this.onTouchMove)
    r.on('move', this.placeLabels)
    // Changing the base layer replaces the style, which drops our source and layers: re-add them.
    // A full reload fires style.load; a diffing setStyle (what basemap switchers such as Longdo
    // Map's may use) removes them quietly and only fires styledata
    r.on('style.load', this.onStyleLoad)
    r.on('styledata', this.onStyleData)
    window.addEventListener('keydown', this.onKey)
    // On window so releasing outside the map still ends the drag
    for (const type of ['mouseup', 'touchend', 'touchcancel']) window.addEventListener(type, this.onUp)
    if (r.isStyleLoaded()) this.ensureLayers()
    else r.once('load', this.onStyleLoad)

    if (options.control) {
      this.control = new Control(this, r.getContainer(), options.control === true ? 'bottom-right' : options.control, this.options.locale)
    }
  }

  get mode() {
    return this._mode
  }

  get color() {
    return this.options.color
  }

  /**
   * True while a measuring tool is on or a shape is selected. Use it to ignore your own map click
   * handlers meanwhile
   */
  get active() {
    return this._mode !== null || this.selected !== null
  }

  get state(): MeasureState {
    const current = this.current
    return {
      mode: this._mode,
      shapes: this.shapes.map(this.shapeState),
      current: current && this.shapeState(current),
      selected: this.selected?.id ?? null
    }
  }

  /**
   * Turn a measuring tool on, or switch tools. Shapes already on the map stay; a shape still being
   * drawn is discarded
   */
  start(mode: MeasureMode) {
    this._mode = mode
    this.endDrag()
    this.setCursor(null)
    if (this.drawing) this.shapes = this.shapes.filter(s => s !== this.drawing)
    this.drawing = null
    this.selected = null
    this.hover = null
    this.render()
  }

  /**
   * Turn measuring off: clicking empty map no longer draws. Finished shapes stay on the map and can
   * still be selected and edited; a shape still being drawn is kept if it has two points, otherwise
   * dropped. Use clear() to remove the shapes
   */
  stop() {
    if (this.drawing) this.finish()
    if (this.drawing) this.remove(this.drawing.id)
    this.endDrag()
    this._mode = null
    this.selected = null
    this.hover = null
    this.setCursor(null)
    this.render()
  }

  /**
   * Complete the shape being drawn and select it, ready to edit. A shape needs at least two points,
   * so with fewer it stays open
   */
  finish() {
    const shape = this.drawing
    if (!shape) return
    this.hover = null
    if (shape.points.length > 1) {
      shape.finished = true
      this.drawing = null
      this.selected = shape
    }
    this.render()
    if (shape.finished) this.emit('finish', shape)
  }

  /** Select a finished shape by id so its points can be dragged, or pass null to deselect */
  select(id: number | null) {
    const shape = this.shapes.find(s => s.id === id && s.finished) ?? null
    if (shape === this.selected) return
    if (this.drawing) this.finish()
    // Too short to finish: drop it
    if (this.drawing) this.remove(this.drawing.id)
    this.selected = shape
    // Selecting happens under the pointer, which the next move sorts out; deselecting may leave it
    // over empty map, where clicks now draw again
    if (!shape) this.setCursor(null)
    this.render()
  }

  /** Remove one shape; by default the one being drawn, or else the selected one */
  remove(id = this.current?.id) {
    const shape = this.shapes.find(s => s.id === id)
    if (!shape) return
    if (this.drag?.shape === shape) this.endDrag()
    this.shapes = this.shapes.filter(s => s !== shape)
    if (this.drawing === shape) this.drawing = null
    if (this.selected === shape) this.selected = null
    this.hover = null
    this.render()
  }

  /** Remove every shape; the tool stays on or off as it is */
  clear() {
    this.endDrag()
    this.shapes = []
    this.drawing = null
    this.selected = null
    this.hover = null
    this.render()
  }

  on(event: EventName, listener: Listener) {
    this.listeners[event].add(listener)
    return this
  }

  off(event: EventName, listener: Listener) {
    this.listeners[event].delete(listener)
    return this
  }

  destroy() {
    const r = this.renderer
    r.off('click', this.onClick)
    r.off('mousemove', this.onMove)
    r.off('dblclick', this.onDblClick)
    r.off('mousedown', this.onDown)
    r.off('touchstart', this.onDown)
    r.off('touchmove', this.onTouchMove)
    r.off('move', this.placeLabels)
    r.off('style.load', this.onStyleLoad)
    r.off('styledata', this.onStyleData)
    r.off('load', this.onStyleLoad)
    window.removeEventListener('keydown', this.onKey)
    for (const type of ['mouseup', 'touchend', 'touchcancel']) window.removeEventListener(type, this.onUp)
    for (const layer of this.layers().reverse()) {
      if (r.getLayer(layer.id)) r.removeLayer(layer.id)
    }
    if (r.getSource(this.id)) r.removeSource(this.id)
    if (this.cursorOwned) r.getCanvas().style.cursor = ''
    this.labels.forEach(label => label.remove())
    this.labels.clear()
    this.control?.destroy()
    this.listeners.change.clear()
    this.listeners.finish.clear()
  }

  // The shape that shows its points and can be edited
  private get current() {
    return this.drawing ?? this.selected
  }

  // A shape's points plus the point under the cursor while it is being drawn
  private line(shape: Shape): LngLat[] {
    return shape === this.drawing && this.hover ? [...shape.points, this.hover] : shape.points
  }

  private shapeState = (shape: Shape): ShapeState => {
    const line = this.line(shape)
    const area = shape.mode === 'area'
    return {
      id: shape.id,
      mode: shape.mode,
      points: [...shape.points],
      finished: shape.finished,
      distance: pathLength(area && line.length > 2 ? [...line, line[0]!] : line),
      area: area ? sphericalArea(line) : 0
    }
  }

  private emit(event: EventName, shape?: Shape) {
    const state = this.state
    if (shape) state.current = this.shapeState(shape)
    this.listeners[event].forEach(fn => fn(state))
  }

  private geojson() {
    const features: any[] = []
    const feature = (type: string, coordinates: any, properties: object) =>
      features.push({ type: 'Feature', geometry: { type, coordinates }, properties })
    const current = this.current
    for (const shape of this.shapes) {
      const line = this.line(shape)
      const props = { shape: shape.id, active: shape === current }
      if (shape.mode === 'area' && line.length > 2) {
        const ring = arcLine([...line, line[0]!])
        feature('Polygon', [ring], props)
        feature('LineString', ring, props)
      } else if (line.length > 1) {
        feature('LineString', arcLine(line), props)
      }
      shape.points.forEach((p, index) => feature('Point', p, { ...props, kind: 'vertex', index }))
      // Handles for adding a point halfway along each segment, on the shape that can be edited
      if (shape === current) {
        for (let i = 0; i < this.segmentCount(shape); i++) {
          const at = midpoint(shape.points[i]!, shape.points[(i + 1) % shape.points.length]!)
          feature('Point', at, { ...props, kind: 'mid', index: i + 1 })
        }
      }
    }
    return { type: 'FeatureCollection', features }
  }

  // Our layers, bottom to top
  private layers(): any[] {
    const color = this.options.color
    const id = this.id
    const active = ['==', ['get', 'active'], true]
    const vertex = ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'kind'], 'vertex']]
    const handle = ['all', ['==', ['geometry-type'], 'Point'], ['in', ['get', 'kind'], ['literal', ['vertex', 'mid']]]]
    return [
      { id: `${id}-fill`, type: 'fill', source: id, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': color, 'fill-opacity': ['case', active, 0.25, 0.12] } },
      { id: `${id}-line`, type: 'line', source: id, filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': ['case', active, 3, 2], 'line-dasharray': [2, 1.5] } },
      // Invisible, wider lines and larger circles so shapes and points are easy to hit
      { id: `${id}-hit-line`, type: 'line', source: id, filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-width': LINE_TOLERANCE * 2, 'line-opacity': 0 } },
      { id: `${id}-hit`, type: 'circle', source: id, filter: ['all', handle, active], paint: { 'circle-radius': 12, 'circle-opacity': 0 } },
      { id: `${id}-mid`, type: 'circle', source: id, filter: ['==', ['get', 'kind'], 'mid'], paint: { 'circle-radius': 3.5, 'circle-color': color, 'circle-opacity': 0.55, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1, 'circle-stroke-opacity': 0.8 } },
      { id: `${id}-point`, type: 'circle', source: id, filter: vertex, paint: { 'circle-radius': ['case', active, 4.5, 3], 'circle-color': '#fff', 'circle-stroke-color': color, 'circle-stroke-width': ['case', active, 2, 1.5] } }
    ]
  }

  // Adds whatever of our source and layers is missing, and keeps the layers on top of the map's own
  // so a new base layer can't cover them
  private ensureLayers() {
    const r = this.renderer
    if (!r.getSource(this.id)) r.addSource(this.id, { type: 'geojson', data: this.geojson() })
    const layers = this.layers()
    for (const layer of layers) {
      if (!r.getLayer(layer.id)) r.addLayer(layer)
    }
    const order: string[] = r.getLayersOrder?.() ?? r.getStyle().layers.map((l: any) => l.id)
    const top = order.slice(-layers.length)
    if (layers.some((layer, i) => top[i] !== layer.id)) {
      for (const layer of layers) r.moveLayer(layer.id)
    }
  }

  private render() {
    this.renderer.getSource(this.id)?.setData(this.geojson())
    this.placeLabels()
    this.emit('change')
  }

  private placeLabels = () => {
    const seen = new Set<number>()
    if (this.options.label) {
      for (const shape of this.shapes) {
        seen.add(shape.id)
        this.placeLabel(shape)
      }
    }
    for (const [id, label] of this.labels) {
      if (seen.has(id)) continue
      label.remove()
      this.labels.delete(id)
    }
  }

  private placeLabel(shape: Shape) {
    const line = this.line(shape)
    const anchor = line.at(-1)
    let label = this.labels.get(shape.id)
    const occluded = anchor && this.renderer.transform?.isLocationOccluded?.({ lng: anchor[0], lat: anchor[1] })
    if (!anchor || line.length < 2 || occluded) {
      if (label) label.style.display = 'none'
      return
    }
    if (!label) {
      label = document.createElement('div')
      label.className = 'mapruler-label'
      label.style.setProperty('--mapruler-color', this.options.color)
      // Delete button, shown while the shape is selected; works without a keyboard too
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'mapruler-label-remove'
      remove.textContent = '×'
      remove.title = this.options.locale === 'th' ? 'ลบ' : 'Delete'
      remove.setAttribute('aria-label', remove.title)
      remove.addEventListener('click', e => {
        e.stopPropagation()
        this.remove(shape.id)
      })
      label.append(document.createElement('span'), remove)
      // Clicking the label selects its shape, like clicking the shape itself
      label.addEventListener('click', () => this.select(shape.id))
      this.renderer.getContainer().appendChild(label)
      this.labels.set(shape.id, label)
    }
    const { distance, area } = this.shapeState(shape)
    const { x, y } = this.renderer.project(anchor)
    label.firstChild!.textContent = shape.mode === 'area' && line.length > 2
      ? formatArea(area, this.options.locale)
      : formatDistance(distance, this.options.locale)
    label.classList.toggle('mapruler-label-active', shape === this.current)
    // While drawing, clicks pass through labels so a point can be placed under one
    label.style.pointerEvents = this.drawing ? 'none' : ''
    ;(label.lastChild as HTMLButtonElement).hidden = shape !== this.selected
    label.style.display = ''
    label.style.transform = `translate(${x}px, ${y}px) translate(-50%, calc(-100% - 12px))`
  }

  private onStyleLoad = () => {
    this.ensureLayers()
    this.render()
  }

  private onStyleData = () => {
    try {
      this.ensureLayers()
    } catch {
      // The new style is still loading; style.load will add them
    }
  }

  /**
   * What is at a screen position, in order of priority: a point or midpoint handle of the current
   * shape, the selected shape's line, another finished shape's line, the inside of the selected
   * polygon, or the inside of another polygon
   */
  private hitAt(point: ScreenPoint, tolerance = LINE_TOLERANCE): Hit | null {
    const r = this.renderer
    const id = this.id
    if (!r.getLayer(`${id}-hit`)) return null
    const current = this.current
    if (current) {
      const handles: any[] = r.queryRenderedFeatures(point, { layers: [`${id}-hit`] })
      const vertex = handles.find(f => f.properties.kind === 'vertex')
      if (vertex) return { kind: 'vertex', index: Number(vertex.properties.index) }
      const mid = handles.find(f => f.properties.kind === 'mid')
      if (mid) {
        const index = Number(mid.properties.index)
        const points = current.points
        return { kind: 'mid', index, at: midpoint(points[index - 1]!, points[index % points.length]!) }
      }
      if (current.finished && this.onLine(current, point, tolerance)) return { kind: 'body' }
    }
    // While drawing, a click anywhere adds a point, so other shapes can't be picked
    if (this.drawing) return null
    const lines: any[] = r.queryRenderedFeatures(point, { layers: [`${id}-hit-line`] })
    const other = lines.map(f => this.shapes.find(s => s.id === f.properties.shape)).find(s => s && s !== this.selected)
    if (other) return { kind: 'select', shape: other }
    const fills: any[] = r.queryRenderedFeatures(point, { layers: [`${id}-fill`] })
    // Where polygons overlap, the selected one keeps the press so it can still be moved
    if (this.selected && fills.some(f => f.properties.shape === this.selected!.id)) return { kind: 'body' }
    const inside = fills.map(f => this.shapes.find(s => s.id === f.properties.shape)).find(Boolean)
    return inside ? { kind: 'select', shape: inside } : null
  }

  // Segments between placed points; a polygon's closing one only exists once finished, since while
  // drawing it runs through the cursor
  private segmentCount(shape: Shape) {
    const n = shape.points.length
    return shape.mode === 'area' && shape.finished && n > 2 ? n : Math.max(0, n - 1)
  }

  // Whether a screen position is within `tolerance` pixels of the line between `shape`'s points
  private onLine(shape: Shape, point: ScreenPoint, tolerance: number) {
    const points = shape.points
    for (let i = 0; i < this.segmentCount(shape); i++) {
      // Follow the curved great-circle arc as drawn, not a straight screen line
      const arc = arcLine([points[i]!, points[(i + 1) % points.length]!]).map(p => this.renderer.project(p))
      for (let j = 0; j < arc.length - 1; j++) {
        if (distanceToSegment(point, arc[j], arc[j + 1]) <= tolerance) return true
      }
    }
    return false
  }

  /**
   * `cursor`, or null for the idle cursor: a crosshair where a click would place a point (drawing, or
   * a tool on with nothing selected), otherwise the map's own, since a click there only deselects
   */
  private setCursor(cursor: string | null) {
    const value = cursor ?? (this.drawing || (this._mode && !this.selected) ? 'crosshair' : '')
    // Leave a cursor the app set alone unless it was ours
    if (!value && !this.cursorOwned) return
    this.renderer.getCanvas().style.cursor = value
    this.cursorOwned = value !== ''
  }

  private onClick = (e: any) => {
    if (this.suppressClick) {
      this.suppressClick = false
      return
    }
    // The second click of a double-click: the first already placed the point, dblclick finishes
    const repeat = e.originalEvent?.detail > 1
    const point: LngLat = [e.lngLat.lng, e.lngLat.lat]
    if (this.drawing) {
      if (repeat) return
      this.drawing.points = [...this.drawing.points, point]
      return this.render()
    }
    const hit = this.hitAt(e.point)
    if (hit?.kind === 'select') return this.select(hit.shape.id)
    // Clicking empty map first lets go of the selection, so a stray click doesn't start a shape
    if (this.selected) return this.select(null)
    if (repeat || !this._mode) return
    this.drawing = { id: this.nextId++, mode: this._mode, points: [point], finished: false }
    this.shapes = [...this.shapes, this.drawing]
    this.render()
  }

  private onMove = (e: any) => {
    if (this.drag) return this.dragTo(e)
    if (!this._mode && !this.shapes.length) return
    const hit = this.hitAt(e.point)
    this.setCursor(!hit ? null : hit.kind === 'vertex' || hit.kind === 'body' ? 'move' : 'pointer')
    if (!this.drawing) return
    this.hover = [e.lngLat.lng, e.lngLat.lat]
    this.render()
  }

  private onDown = (e: any) => {
    this.suppressClick = false
    const shape = this.current
    if (!shape) return
    const event = e.originalEvent
    if (event?.touches ? event.touches.length !== 1 : event?.button !== 0) return
    // Fingers are less precise than a mouse
    const hit = this.hitAt(e.point, event.touches ? LINE_TOLERANCE * 2 : LINE_TOLERANCE)
    // Other shapes only get selected on click; they can't be dragged until then
    if (!hit || hit.kind === 'select') return
    // Keep the map from panning while a point or the shape is held
    e.preventDefault()
    const from: LngLat = hit.kind === 'mid' ? hit.at : [e.lngLat.lng, e.lngLat.lat]
    this.drag = { shape, hit, from, origin: shape.points, start: e.point, moved: false }
  }

  private onTouchMove = (e: any) => {
    if (this.drag) this.dragTo(e)
  }

  private dragTo(e: any) {
    const drag = this.drag!
    if (!drag.moved) {
      if (Math.hypot(e.point.x - drag.start.x, e.point.y - drag.start.y) < DRAG_THRESHOLD) return
      drag.moved = true
      this.hover = null
      this.setCursor('grabbing')
    }
    const to: LngLat = [e.lngLat.lng, e.lngLat.lat]
    const { hit, origin } = drag
    drag.shape.points = hit.kind === 'body' ? movePoints(origin, drag.from, to)
      : hit.kind === 'mid' ? [...origin.slice(0, hit.index), to, ...origin.slice(hit.index)]
      : origin.map((p, i) => i === hit.index ? to : p)
    this.render()
  }

  private onUp = () => {
    const drag = this.drag
    if (!drag) return
    this.endDrag()
    // Pressing on the selected shape never changes the selection. While drawing, a plain click on
    // its own point or line still adds a point at the end, so double-clicking still finishes
    this.suppressClick = drag.moved || drag.shape.finished
    if (drag.moved && drag.shape.finished) this.emit('finish', drag.shape)
  }

  private endDrag() {
    if (!this.drag) return
    this.drag = null
    this.setCursor(null)
  }

  private onDblClick = (e: any) => {
    // With the tool off, only a double-click on a shape is ours; elsewhere the map zooms as usual
    if (!this._mode && !this.hitAt(e.point)) return
    // Finish the shape instead of zooming in
    e.preventDefault()
    const shape = this.drawing
    if (!shape) return
    // A touch double-tap places both points; drop the second
    const [a, b] = shape.points.slice(-2).map(p => this.renderer.project(p))
    if (a && b && Math.hypot(a.x - b.x, a.y - b.y) < DRAG_THRESHOLD * 2) shape.points = shape.points.slice(0, -1)
    this.finish()
  }

  private onKey = (e: KeyboardEvent) => {
    if ((!this._mode && !this.selected) || isTyping(e.target)) return
    if (e.key === 'Enter') this.finish()
    if (e.key === 'Escape') {
      if (this.drawing) this.remove(this.drawing.id)
      else this.select(null)
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) this.remove(this.selected.id)
  }
}
