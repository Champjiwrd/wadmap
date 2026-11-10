import type { Locale } from './geo'
import type { MapRuler, MeasureMode, MeasureState } from './MapRuler'

export type ControlPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const TEXT = {
  th: { tools: 'เครื่องมือวัด', distance: 'วัดระยะ', area: 'วัดพื้นที่' },
  en: { tools: 'Measuring tools', distance: 'Distance', area: 'Area' }
}

const ICONS: Record<MeasureMode, string> = {
  distance: '<path d="M3 16l13-13 5 5-13 13z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2" stroke="currentColor" stroke-width="1.5"/>',
  area: '<path d="M4 7l7-3 9 5-3 11-11-2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
}

/** Built-in tool buttons, rendered inside the map container */
export class Control {
  private root = document.createElement('div')
  private modeButtons = {} as Record<MeasureMode, HTMLButtonElement>

  constructor(private ruler: MapRuler, container: HTMLElement, position: ControlPosition, locale: Locale) {
    const text = TEXT[locale]
    this.root.className = `mapruler-control ${position}`
    this.root.style.setProperty('--mapruler-color', ruler.color)

    const buttons = document.createElement('div')
    buttons.className = 'mapruler-buttons'
    buttons.setAttribute('role', 'group')
    buttons.setAttribute('aria-label', text.tools)
    for (const mode of ['distance', 'area'] as const) {
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('aria-pressed', 'false')
      button.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">${ICONS[mode]}</svg>`
      button.append(text[mode])
      button.addEventListener('click', () => ruler.mode === mode ? ruler.stop() : ruler.start(mode))
      this.modeButtons[mode] = button
      buttons.append(button)
    }
    this.root.append(buttons)
    container.append(this.root)
    ruler.on('change', this.update)
  }

  destroy() {
    this.ruler.off('change', this.update)
    this.root.remove()
  }

  private update = (state: MeasureState) => {
    for (const [mode, button] of Object.entries(this.modeButtons)) {
      button.setAttribute('aria-pressed', String(state.mode === mode))
    }
  }
}
