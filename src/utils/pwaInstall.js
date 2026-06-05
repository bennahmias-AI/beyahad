// src/utils/pwaInstall.js
// ─────────────────────────────────────────────────────────────
// תופס את אירוע ההתקנה (beforeinstallprompt) של ה-PWA בעלייה של האפליקציה
// ושומר אותו, כך שכל כפתור "התקנה" באפליקציה יוכל להפעיל את דיאלוג ההתקנה
// המקורי — גם אם האירוע הגיע לפני שהרכיב נטען. רכיבים יכולים להירשם
// לשינויי זמינות דרך subscribe().
//
// • אנדרואיד/כרום: האירוע נתפס → canPrompt() מחזיר true → promptInstall() פותח דיאלוג.
// • אייפון (סאפארי): אין אירוע כזה — צריך הנחיה ידנית (שיתוף → הוסף למסך הבית).
// ─────────────────────────────────────────────────────────────

let deferredPrompt = null
const listeners = new Set()

function emit() {
  listeners.forEach(fn => { try { fn() } catch (e) { /* ignore */ } })
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // מונע מהדפדפן להציג את הבאנר האוטומטי שלו — אנחנו שולטים בעיתוי
    e.preventDefault()
    deferredPrompt = e
    emit()
  })
  // לאחר התקנה מוצלחת — מנקים את האירוע
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    emit()
  })
}

// האם האפליקציה כבר רצה כמותקנת (standalone)?
export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
}

// האם המכשיר הוא iOS (אין בו beforeinstallprompt — צריך הנחיה ידנית)?
export function isIOS() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream
}

// האם יש אירוע התקנה זמין (כלומר אפשר לפתוח דיאלוג התקנה מקורי)?
export function canPrompt() {
  return !!deferredPrompt
}

// הרשמה לשינויי זמינות. מחזיר פונקציית ביטול-הרשמה.
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// מפעיל את דיאלוג ההתקנה המקורי.
// מחזיר: 'accepted' | 'dismissed' | 'unavailable'.
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable'
  const e = deferredPrompt
  deferredPrompt = null
  emit()
  try {
    e.prompt()
    const choice = await e.userChoice
    return (choice && choice.outcome) || 'dismissed'
  } catch (err) {
    return 'dismissed'
  }
}
