// <script> build: exposes window.MapRuler (the class, with the helpers attached)
import { MapRuler } from './MapRuler'
import * as geo from './geo'

;(window as any).MapRuler = Object.assign(MapRuler, geo)
