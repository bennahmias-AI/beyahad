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

// תחנות לפי מדינה (קוד מדינה ISO דו-אותי, למשל 'US', 'FR', 'IT')
export async function fetchStationsByCountry(countryCode, limit = 80) {
  if (!countryCode) return []
  try {
    const res = await fetch(
      `${BASE}/stations/bycountrycodeexact/${encodeURIComponent(countryCode)}?limit=${limit}&order=clickcount&reverse=true&hidebroken=true`,
      { headers: HEADERS },
    )
    if (!res.ok) throw new Error('radio country fetch failed')
    const data = await res.json()
    return clean(data)
  } catch (e) {
    console.error('fetchStationsByCountry error:', e)
    return []
  }
}

// מדווח ל-API על הקלקה (סטטיסטיקה קהילתית — עוזר לדירוג). לא חוסם.
export function reportClick(stationId) {
  if (!stationId) return
  fetch(`${BASE}/url/${stationId}`, { headers: HEADERS }).catch(() => {})
}

// ─── רשימת מדינות נפוצות לרדיו ──────────────────────────────
// קוד ISO דו-אותי, דגל אמוג'י ושם בעברית. מסודרות לפי פופולריות/קרבה.
export const RADIO_COUNTRIES = [
  { code: 'IL', flag: '🇮🇱', name: 'ישראל' },
  { code: 'US', flag: '🇺🇸', name: 'ארצות הברית' },
  { code: 'GB', flag: '🇬🇧', name: 'בריטניה' },
  { code: 'FR', flag: '🇫🇷', name: 'צרפת' },
  { code: 'IT', flag: '🇮🇹', name: 'איטליה' },
  { code: 'ES', flag: '🇪🇸', name: 'ספרד' },
  { code: 'DE', flag: '🇩🇪', name: 'גרמניה' },
  { code: 'RU', flag: '🇷🇺', name: 'רוסיה' },
  { code: 'GR', flag: '🇬🇷', name: 'יוון' },
  { code: 'TR', flag: '🇹🇷', name: 'טורקיה' },
  { code: 'NL', flag: '🇳🇱', name: 'הולנד' },
  { code: 'BE', flag: '🇧🇪', name: 'בלגיה' },
  { code: 'PT', flag: '🇵🇹', name: 'פורטוגל' },
  { code: 'CH', flag: '🇨🇭', name: 'שווייץ' },
  { code: 'AT', flag: '🇦🇹', name: 'אוסטריה' },
  { code: 'SE', flag: '🇸🇪', name: 'שוודיה' },
  { code: 'NO', flag: '🇳🇴', name: 'נורווגיה' },
  { code: 'DK', flag: '🇩🇰', name: 'דנמרק' },
  { code: 'FI', flag: '🇫🇮', name: 'פינלנד' },
  { code: 'PL', flag: '🇵🇱', name: 'פולין' },
  { code: 'UA', flag: '🇺🇦', name: 'אוקראינה' },
  { code: 'RO', flag: '🇷🇴', name: 'רומניה' },
  { code: 'HU', flag: '🇭🇺', name: 'הונגריה' },
  { code: 'CZ', flag: '🇨🇿', name: 'צ׳כיה' },
  { code: 'IE', flag: '🇮🇪', name: 'אירלנד' },
  { code: 'CA', flag: '🇨🇦', name: 'קנדה' },
  { code: 'MX', flag: '🇲🇽', name: 'מקסיקו' },
  { code: 'BR', flag: '🇧🇷', name: 'ברזיל' },
  { code: 'AR', flag: '🇦🇷', name: 'ארגנטינה' },
  { code: 'AU', flag: '🇦🇺', name: 'אוסטרליה' },
  { code: 'IN', flag: '🇮🇳', name: 'הודו' },
  { code: 'EG', flag: '🇪🇬', name: 'מצרים' },
  { code: 'MA', flag: '🇲🇦', name: 'מרוקו' },
  { code: 'JO', flag: '🇯🇴', name: 'ירדן' },
  { code: 'LB', flag: '🇱🇧', name: 'לבנון' },
  { code: 'JP', flag: '🇯🇵', name: 'יפן' },
  { code: 'CN', flag: '🇨🇳', name: 'סין' },
  { code: 'KR', flag: '🇰🇷', name: 'דרום קוריאה' },
  { code: 'ZA', flag: '🇿🇦', name: 'דרום אפריקה' },
]
