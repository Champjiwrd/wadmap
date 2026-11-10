# wadmap

เครื่องมือวัดระยะและวัดพื้นที่สำหรับ **Longdo Map v3** และ **MapLibre GL JS**: เสียบเข้ากับแผนที่ได้ในบรรทัดเดียว

[English](README.md) | **ภาษาไทย**

> โปรเจกต์ส่วนตัว ไม่ใช่ผลิตภัณฑ์ทางการของ Longdo Map และไม่มีส่วนเกี่ยวข้องกับ Longdo Map

- ระยะคำนวณตามความโค้งของโลก (great circle) และเส้นบนลูกโลกจะโค้งตามผิวโลก
- รองรับหน่วยไทย: ม., กม., ตร.ม., **ไร่**, ตร.กม. และมีภาษาอังกฤษ (m, km, ha, km²)
- มีปุ่มเลือกเครื่องมือในตัว ค่าที่วัดได้แสดงเป็นป้ายบนแผนที่ หรือจะใช้แบบ headless แล้วทำ UI เองก็ได้
- ไม่มี dependency เลย ขนาดประมาณ 17 KB (minified)

## ติดตั้ง

### ผ่าน `<script>` (CDN)

```html
<script src="https://api.longdo.com/map3/?key=YOUR_KEY"></script>
<script src="https://cdn.jsdelivr.net/npm/wadmap@0.1.0/dist/wadmap.min.js"></script>
<script>
  const map = new longdo.Map({ placeholder: document.getElementById('map') })
  map.Event.bind(longdo.EventName.Ready, () => {
    new MapRuler(map, { control: true })
  })
</script>
```

### ผ่าน npm

```bash
npm install wadmap
```

```js
import { MapRuler } from 'wadmap'

map.Event.bind(longdo.EventName.Ready, () => {
  const ruler = new MapRuler(map, { control: true })
})
```

ใช้กับ MapLibre ได้เหมือนกัน แค่ส่ง `maplibregl.Map` เข้าไปหลังเกิด event `load`

## วิธีใช้งานบนแผนที่

วัดได้หลายเส้นและหลายพื้นที่พร้อมกัน แต่ละรูปมีป้ายตัวเลขของตัวเอง ถ้าจะแก้ไขรูปไหนต้องเลือกรูปนั้นก่อน

| การกระทำ | ผลลัพธ์ |
|---|---|
| คลิกที่ว่างบนแผนที่ | เริ่มรูปใหม่ แล้วคลิกต่อเพื่อวางจุด จุดแรกเริ่มในพื้นที่ polygon ที่มีอยู่ไม่ได้เพราะคลิกนั้นจะเป็นการเลือก ให้เริ่มจากด้านนอก จุดถัดไปวางที่ใดก็ได้ |
| ดับเบิลคลิก / Enter | จบรูปที่กำลังวาด รูปนั้นจะถูกเลือกไว้ แก้ไขต่อได้ทันที |
| Esc | ยกเลิกรูปที่กำลังวาด หรือเลิกเลือก |
| คลิกที่เส้น ในพื้นที่ polygon หรือป้ายตัวเลขของรูป | เลือกรูปนั้น (รูปที่เลือกจะมีจุดใหญ่ขึ้นและเส้นหนาขึ้น) |
| ลากจุด | ย้ายจุดนั้น (รูปที่เลือก หรือรูปที่กำลังวาด) |
| ลากจุดเล็กที่อยู่กึ่งกลางแต่ละช่วงของเส้น | เพิ่มจุดตรงนั้น (รูปที่เลือก หรือรูปที่กำลังวาด) |
| ลากเส้นของรูปที่เลือก หรือด้านใน polygon ที่เลือก | ย้ายทั้งรูป ระยะทางและพื้นที่คงเดิมไม่ว่าจะย้ายไปที่ใดบนโลก |
| กด × บนป้ายตัวเลขของรูปที่เลือก หรือกด Delete / Backspace | ลบรูปนั้น |
| คลิกที่ว่างขณะเลือกรูปอยู่ | เลิกเลือกอย่างเดียว คลิกอีกครั้งเพื่อเริ่มรูปใหม่ |

รูปที่ไม่ได้เลือกจะลากไม่ได้ ลากผ่านรูปเหล่านั้นจึงเป็นการเลื่อนแผนที่ตามปกติ การเลือกและแก้ไขรูปทำได้แม้ปิดเครื่องมือทั้งสองอยู่ ตอนนั้นคลิกที่ว่างจะเป็นแค่การเลิกเลือก ไม่เริ่มรูปใหม่

## Options

| Option | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|
| `control` | `false` | แสดงปุ่มเลือกเครื่องมือในตัว ใส่ `true` (มุมขวาล่าง) หรือ `'top-left'`, `'top-right'`, `'bottom-left'`, `'bottom-right'` |
| `locale` | `'th'` | `'th'` หรือ `'en'` |
| `color` | `'#facc15'` | สีของเส้น จุด และป้ายตัวเลข |
| `label` | `true` | แสดงป้ายตัวเลขของแต่ละรูป |
| `labelPosition` | `'end'` | ตำแหน่งป้าย: `'end'` (เหนือจุดสุดท้าย), `'start'` (เหนือจุดแรก), `'center'` (เหนือกึ่งกลางเส้นตามความยาว หรือกลาง polygon) หรือฟังก์ชัน `(shape) => [lng, lat]` (คืน `null` เพื่อซ่อนป้ายนั้น) |
| `injectStyles` | `true` | ใส่ CSS เริ่มต้นให้อัตโนมัติ ปิดได้ถ้าต้องการเขียน CSS เอง (class ขึ้นต้นด้วย `mapruler-`) |

## API

```js
ruler.start('distance')   // หรือ 'area' เปิดเครื่องมือหรือสลับเครื่องมือ รูปที่วาดไว้แล้วยังอยู่
ruler.stop()              // ปิดเครื่องมือ รูปยังค้างบนแผนที่ และยังเลือกและแก้ไขได้
ruler.finish()            // จบรูปที่กำลังวาดและเลือกรูปนั้นไว้
ruler.select(id)          // เลือกรูปตาม id ส่ง null เพื่อเลิกเลือก
ruler.remove(id)          // ลบรูปเดียว ถ้าไม่ใส่ id จะลบรูปที่กำลังวาดหรือรูปที่เลือกอยู่
ruler.clear()             // ลบทุกรูป เครื่องมือยังเปิดหรือปิดอยู่เหมือนเดิม
ruler.destroy()           // ถอดทุกอย่างออกจากแผนที่

ruler.mode                // 'distance' | 'area' | null: เครื่องมือที่ใช้ตอนคลิกที่ว่าง
ruler.labelPosition = 'center'  // เปลี่ยนตำแหน่งป้ายได้ทุกเมื่อ
ruler.active              // true ระหว่างเปิดเครื่องมือหรือมีรูปที่เลือกอยู่ ใช้กันไม่ให้ click handler อื่นของคุณทำงาน
ruler.state               // { mode, shapes, current, selected }
//   shapes:   ทุกรูป: { id, mode, points, finished, distance (ม.), area (ตร.ม.) }
//   current:  รูปที่กำลังวาด หรือถ้าไม่มีก็รูปที่เลือกอยู่ (null ถ้าไม่มีทั้งคู่)
//   selected: id ของรูปที่เลือก หรือ null

ruler.on('change', state => {})  // ทุกครั้งที่มีการเปลี่ยนแปลง รวมถึงตอนเลื่อนเมาส์ระหว่างวาดและตอนลาก
ruler.on('finish', state => {})  // ตอนจบรูป และหลังแก้ไขหรือย้ายรูปที่เลือก โดย state.current คือรูปนั้น
```

ฟังก์ชันคำนวณ export แยกไว้ใช้ได้โดยไม่ต้องมีแผนที่: `haversine`, `pathLength`, `sphericalArea`, `greatCircle`, `arcLine`, `midpoint`, `alongPath`, `centroid`, `interpolate`, `movePoints`, `formatDistance`, `formatArea`

### ใช้แบบ headless กับ Vue / React

ไม่ต้องเปิด `control` แล้วนำค่าจาก event `change` ไปแสดงใน component ของคุณเอง:

```js
const ruler = new MapRuler(map)
ruler.on('change', s => { distance.value = s.current?.distance ?? 0; area.value = s.current?.area ?? 0 })
// ปุ่มของคุณ: ruler.start('distance'), ruler.stop(), ...
```

## พัฒนา

```bash
npm install
npm test          # unit test ของฟังก์ชันคำนวณ
npm run build     # dist/: ESM, CJS, IIFE (.min.js) และ .d.ts
```

ตัวอย่างอยู่ใน `examples/` ให้ serve ที่ root ของ repo เช่น `npx serve .` แล้วเปิด:
- `examples/maplibre.html`: ใช้ได้เลยโดยไม่ต้องมี key
- `examples/longdo.html?key=YOUR_LONGDO_KEY`: ขอ key ได้ที่ <https://map.longdo.com/console/>

## License

[MIT](LICENSE)
