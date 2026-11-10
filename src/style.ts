const STYLE_ID = 'mapruler-styles'

const CSS = `
.mapruler-label {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  padding: 3px 8px;
  color: #1a1a1a;
  font: 600 12px system-ui, sans-serif;
  white-space: nowrap;
  background: var(--mapruler-color, #facc15);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  cursor: pointer;
}
.mapruler-label-active { box-shadow: 0 0 0 2px #fff, 0 2px 8px rgba(0, 0, 0, 0.4); }
.mapruler-label { display: flex; align-items: center; gap: 6px; }
.mapruler-label-remove {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  margin-right: -4px;
  padding: 0;
  color: inherit;
  font: 700 14px/1 system-ui, sans-serif;
  background: rgba(0, 0, 0, 0.12);
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}
.mapruler-label-remove[hidden] { display: none; }
.mapruler-label-remove:hover { color: #fff; background: #dc2626; }
.mapruler-label-remove:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
.mapruler-control {
  position: absolute;
  right: 16px;
  bottom: 32px;
  z-index: 3;
  color: #e6edf3;
  font: 13px system-ui, sans-serif;
}
.mapruler-control.top-left { top: 16px; left: 16px; right: auto; bottom: auto; }
.mapruler-control.top-right { top: 16px; bottom: auto; }
.mapruler-control.bottom-left { left: 16px; right: auto; }
/* Segmented button group: one pill, the active tool filled with the theme color */
.mapruler-buttons {
  display: flex;
  padding: 3px;
  background: rgba(15, 25, 45, 0.7);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}
.mapruler-buttons button {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  color: inherit;
  font: inherit;
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
/* Divider between buttons, hidden next to the active one where the fill already separates them */
.mapruler-buttons button + button::before {
  content: '';
  position: absolute;
  top: 25%;
  left: 0;
  width: 1px;
  height: 50%;
  background: rgba(255, 255, 255, 0.2);
  transition: opacity 0.15s;
}
.mapruler-buttons button[aria-pressed="true"] + button::before,
.mapruler-buttons button + button[aria-pressed="true"]::before { opacity: 0; }
.mapruler-buttons button:hover { background: rgba(255, 255, 255, 0.1); }
.mapruler-buttons button:focus-visible { outline: 2px solid var(--mapruler-color, #facc15); outline-offset: 1px; }
.mapruler-buttons button[aria-pressed="true"] {
  color: #1a1a1a;
  background: var(--mapruler-color, #facc15);
}
`

/** Adds the default stylesheet once per document */
export function injectStyles(doc: Document = document) {
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  doc.head.appendChild(style)
}
