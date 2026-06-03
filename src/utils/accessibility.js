// src/utils/accessibility.js
// ─────────────────────────────────────────────────────────────
// הגדרות נגישות — נשמרות ב-localStorage ומוחלות על אלמנט <html>
// באמצעות data-attributes שה-CSS (index.css) מגיב להם.
//
// שלוש הגדרות:
//   fontScale:    'normal' | 'large' | 'xlarge'   → גודל טקסט וממשק
//   contrast:     'normal' | 'high'                → ניגודיות גבוהה
//   reduceMotion: false | true                     → הפחתת אנימציות
//
// הערכים נטענים פעם אחת בעליית האפליקציה (applyAccessibilityFromStorage)
// כדי שההעדפה תישמר בין כניסות, גם לפני שהמשתמש פותח את ההגדרות.
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'beyahad-accessibility'

const DEFAULTS = {
  fontScale: 'normal',
  contrast: 'normal',
  reduceMotion: false,
}

// קריאת ההגדרות מ-localStorage (עם ברירות מחדל בטוחות)
export function getAccessibilitySettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

// החלת ההגדרות על אלמנט <html>
function applySettings(settings) {
  const html = document.documentElement
  if (!html) return

  // גודל טקסט
  if (settings.fontScale && settings.fontScale !== 'normal') {
    html.setAttribute('data-font-scale', settings.fontScale)
  } else {
    html.removeAttribute('data-font-scale')
  }

  // ניגודיות
  if (settings.contrast === 'high') {
    html.setAttribute('data-contrast', 'high')
  } else {
    html.removeAttribute('data-contrast')
  }

  // הפחתת אנימציות
  if (settings.reduceMotion) {
    html.setAttribute('data-reduce-motion', 'on')
  } else {
    html.removeAttribute('data-reduce-motion')
  }
}

// שמירת הגדרה אחת (ממזג עם הקיימות) + החלה מיידית. מחזיר את ההגדרות המעודכנות.
export function setAccessibilitySetting(key, value) {
  const next = { ...getAccessibilitySettings(), [key]: value }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch { /* אם localStorage חסום — לפחות נחיל לסשן הנוכחי */ }
  applySettings(next)
  return next
}

// טעינה והחלה בעליית האפליקציה
export function applyAccessibilityFromStorage() {
  applySettings(getAccessibilitySettings())
}
