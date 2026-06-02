// src/services/radio.js
// ─────────────────────────────────────────────────────────────
// שכבת גישה ל-Radio Browser API — מאגר קהילתי חינמי וחופשי של
// תחנות רדיו באינטרנט (מעל 50,000 תחנות). ללא מפתח, ללא הרשמה.
//
// תיעוד: https://api.radio-browser.info
//
// הערה: ל-Radio Browser יש כמה שרתי מראה. אנו פונים לשרת קבוע
// אמין; אם הוא נופל אפשר להחליף ל-de1/de2/at1 וכו'.
// ─────────────────────────────────────────────────────────────

const BASE = 'https://de1.api.radio-browser.info/json'

// כותרת User-Agent נדרשת לפי נהלי ה-API (מזהה את האפליקציה)
const HEADERS = { 'Content-Type': 'application/json' }

// ממיר תחנה גולמית מה-API למבנה הפנימי הנקי שלנו
function normalize(s) {
  return {
    id: s.stationuuid,
    name: (s.name || '').trim() || 'תחנה ללא שם',
    url: s.url_resolved || s.url,
    favicon: s.favicon || '',
    country: s.country || '',
    countryCode: s.countrycode || '',
    tags: s.tags || '',
    codec: s.codec || '',
    bitrate: s.bitrate || 0,
    votes: s.votes || 0,
  }
}

// מסנן תחנות לא-תקינות (בלי כתובת סטרים) ומסיר כפילויות לפי שם
function clean(list) {
  const seen = new Set()
  return list
    .map(normalize)
    .filter(s => {
      if (!s.url) return false
      const key = s.name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

// תחנות ישראליות פופולריות (לפי מספר הקלקות, הכי פופולריות קודם)
export async function fetchIsraeliStations(limit = 60) {
  try {
    const res = await fetch(
      `${BASE}/stations/bycountrycodeexact/IL?limit=${limit}&order=clickcount&reverse=true&hidebroken=true`,
      { headers: HEADERS },
    )
    if (!res.ok) throw new Error('radio fetch failed')
    const data = await res.json()
    return clean(data)
  } catch (e) {
    console.error('fetchIsraeliStations error:', e)
    return []
  }
}

// חיפוש חופשי לפי שם תחנה (בכל העולם)
export async function searchStations(term, limit = 50) {
  if (!term || !term.trim()) return []
  try {
    const res = await fetch(
      `${BASE}/stations/search?name=${encodeURIComponent(term.trim())}&limit=${limit}&order=clickcount&reverse=true&hidebroken=true`,
      { headers: HEADERS },
    )
    if (!res.ok) throw new Error('radio search failed')
    const data = await res.json()
    return clean(data)
  } catch (e) {
    console.error('searchStations error:', e)
    return []
  }
}

// תחנות לפי סוגה/תגית (למשל 'pop', 'classical', 'news')
export async function fetchStationsByTag(tag, limit = 50) {
  try {
    const res = await fetch(
      `${BASE}/stations/bytagexact/${encodeURIComponent(tag)}?limit=${limit}&order=clickcount&reverse=true&hidebroken=true`,
      { headers: HEADERS },
    )
    if (!res.ok) throw new Error('radio tag fetch failed')
    const data = await res.json()
    return clean(data)
  } catch (e) {
    console.error('fetchStationsByTag error:', e)
    return []
  }
}

// מדווח ל-API על הקלקה (סטטיסטיקה קהילתית — עוזר לדירוג). לא חוסם.
export function reportClick(stationId) {
  if (!stationId) return
  fetch(`${BASE}/url/${stationId}`, { headers: HEADERS }).catch(() => {})
}
