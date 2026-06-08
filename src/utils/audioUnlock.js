// src/utils/audioUnlock.js
// "פתיחת" אודיו ל-WebView של האפליקציה הנייטיב.
// דפדפנים מובְנים (Android WebView) פותחים AudioContext במצב 'suspended'
// עד שיש אינטראקציה מהמשתמש, ולכן צליל הצלצול (Web Audio) לא נשמע
// באפליקציה המותקנת — רק בדפדפן רגיל.
// כאן יוצרים AudioContext משותף יחיד ומחזירים אותו ל-running כבר בנגיעה
// הראשונה של המשתמש במסך, כך שכשמגיעה שיחה האודיו כבר "פתוח".

let sharedCtx = null
let listenersAdded = false

function ensureCtx() {
  if (sharedCtx) return sharedCtx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  try { sharedCtx = new AC() } catch (e) { return null }
  return sharedCtx
}

// מחזיר ל-running ומנגן באפר שקט קצר כדי "לפתוח" את האודיו (no-op אם כבר פתוח)
export function unlockAudio() {
  const ctx = ensureCtx()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') ctx.resume()
    const buf = ctx.createBuffer(1, 1, 22050)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start(0)
  } catch (e) { /* ignore */ }
}

// מחזיר את ה-AudioContext המשותף (כבר פתוח), ומוודא שהוא running
export function getAudioCtx() {
  const ctx = ensureCtx()
  if (ctx && ctx.state === 'suspended') {
    try { ctx.resume() } catch (e) { /* ignore */ }
  }
  return ctx
}

// נרשם פעם אחת באתחול האפליקציה — בנגיעה/קליק הראשונים פותח את האודיו
export function initAudioUnlock() {
  if (listenersAdded) return
  listenersAdded = true
  const handler = () => unlockAudio()
  const opts = { passive: true }
  window.addEventListener('pointerdown', handler, opts)
  window.addEventListener('touchend', handler, opts)
  window.addEventListener('click', handler, opts)
  window.addEventListener('keydown', handler)
}
