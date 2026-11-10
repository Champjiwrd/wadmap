# mapruler

Distance and area measuring tool for **Longdo Map v3** and **MapLibre GL JS**. Add it to your map with one line.

**English** | [ภาษาไทย](README.th.md)

> A personal project. Not an official Longdo Map product, and not affiliated with or endorsed by Longdo Map.

- Distances are great-circle accurate, and lines curve along the earth's surface on the globe
- Thai units: ม., กม., ตร.ม., **ไร่ (rai)**, ตร.กม. English units: m, km, ha, km²
- Built-in tool buttons with measurements shown as labels on the map, or run it headless and build your own UI
- Zero dependencies, about 17 KB minified

## Installation

### Via `<script>` (CDN)

```html
<script src="https://api.longdo.com/map3/?key=YOUR_KEY"></script>
<script src="https://cdn.jsdelivr.net/npm/mapruler@0.1.0/dist/mapruler.min.js"></script>
<script>
  const map = new longdo.Map({ placeholder: document.getElementById('map') })
  map.Event.bind(longdo.EventName.Ready, () => {
    new MapRuler(map, { control: true, locale: 'en' })
  })
</script>
```

### Via npm

```bash
npm install mapruler
```

```js
import { MapRuler } from 'mapruler'

map.Event.bind(longdo.EventName.Ready, () => {
  const ruler = new MapRuler(map, { control: true, locale: 'en' })
})
```

MapLibre works the same way: pass your `maplibregl.Map` once its `load` event has fired.

## Using it on the map

You can measure as many lines and areas as you like; each keeps its own label. To edit a shape, select it first.

| Action | Result |
|---|---|
| Click empty map | Start a new shape, then click to add points. A shape can't start inside an existing polygon, since that click selects it; start outside, the next points can go anywhere |
| Double-click / Enter | Finish the shape; it stays selected, ready to edit |
| Esc | Cancel the shape being drawn, or deselect |
| Click a line, inside a polygon, or a shape's label | Select it (a selected shape has larger points and a thicker line) |
| Drag a point | Move that point (selected shape, or the one being drawn) |
| Drag the small handle halfway along a segment | Add a point there (selected shape, or the one being drawn) |
| Drag a selected shape's line, or inside a selected polygon | Move the whole shape; its length and area stay the same anywhere on the globe |
| × on the selected shape's label, or Delete / Backspace | Remove that shape |
| Click empty map while a shape is selected | Deselect only; click again to start a new shape |

Shapes that aren't selected can't be dragged, so dragging over them pans the map as usual. Selecting and editing also work with both tools off; clicking empty map then only deselects and never starts a shape.

## Options

| Option | Default | Description |
|---|---|---|
| `control` | `false` | Show the built-in tool buttons. `true` places it bottom-right; or pass `'top-left'`, `'top-right'`, `'bottom-left'`, `'bottom-right'` |
| `locale` | `'th'` | `'th'` or `'en'` |
| `color` | `'#facc15'` | Color of the line, points and label |
| `label` | `true` | Show a measurement label next to the last point |
| `injectStyles` | `true` | Inject the default CSS automatically. Turn it off to style it yourself (all classes start with `mapruler-`) |

## API

```js
ruler.start('distance')   // or 'area'; turns the tool on or switches it, keeping shapes already drawn
ruler.stop()              // turn the tool off; shapes stay on the map and can still be selected and edited
ruler.finish()            // finish the shape being drawn and select it
ruler.select(id)          // select a shape by id; select(null) deselects
ruler.remove(id)          // remove one shape; without an id, the one being drawn or selected
ruler.clear()             // remove every shape; the tool stays on or off as it is
ruler.destroy()           // remove everything from the map

ruler.mode                // 'distance' | 'area' | null: the tool that clicking empty map draws
ruler.active              // true while a tool is on or a shape is selected; use it to keep your own click handlers quiet
ruler.state               // { mode, shapes, current, selected }
//   shapes:   every shape: { id, mode, points, finished, distance (m), area (m²) }
//   current:  the shape being drawn, or else the selected one (null if neither)
//   selected: id of the selected shape, or null

ruler.on('change', state => {})  // on every change, including mouse moves while drawing and drags
ruler.on('finish', state => {})  // when a shape is finished, and after a selected shape is edited or moved;
                                 // state.current is that shape
```

The math functions are exported separately and work without a map: `haversine`, `pathLength`, `sphericalArea`, `greatCircle`, `arcLine`, `midpoint`, `movePoints`, `formatDistance`, `formatArea`.

### Headless with Vue / React

Leave `control` off and render the values from the `change` event in your own component:

```js
const ruler = new MapRuler(map)
ruler.on('change', s => { distance.value = s.current?.distance ?? 0; area.value = s.current?.area ?? 0 })
// your buttons: ruler.start('distance'), ruler.stop(), ...
```

## Development

```bash
npm install
npm test          # unit tests for the math functions
npm run build     # dist/: ESM, CJS, IIFE (.min.js) and .d.ts
```

Examples live in `examples/`. Serve the repo root (for example `npx serve .`) and open:
- `examples/maplibre.html`: works without a key
- `examples/longdo.html?key=YOUR_LONGDO_KEY`: get a key at <https://map.longdo.com/console/>

## License

[MIT](LICENSE)
