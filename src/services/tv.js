// src/services/tv.js
// -----------------------------------------------------------------
// שכבת גישה לערוצי טלוויזיה ציבוריים מ-iptv-org — המקבילה של
// Radio Browser לטלוויזיה. אנחנו משתמשים בפלייליסטים הרשמיים שנוצרים
// אוטומטית (לפי מדינה/קטגוריה). הם כבר מסננים ערוצים שהוסרו בגלל
// תביעות זכויות (blocklist) וערוצי מבוגרים.
//
//   ישראל:   https://iptv-org.github.io/iptv/countries/il.m3u
//   קטגוריה: https://iptv-org.github.io/iptv/categories/news.m3u
//
// הערה חשובה: חלק מהסטרימים דורשים כותרות Referer/User-Agent שדפדפן
// לא יכול לשלוח, או חסומים ב-CORS — אלו לא ינוגנו בדפדפן ואנחנו
// מנמיכים אותם בעדיפות / מסמנים אותם.
// -----------------------------------------------------------------

const PLAYLIST_BASE = 'https://iptv-org.github.io/iptv'

// מטמון בזיכרון לפי כתובת פלייליסט (כדי לא להוריד שוב ושוב)
const cache = new Map()

// ניתוח קובץ M3U לרשימת ערוצים גולמיים
function parseM3U(text) {
  const lines = text.split(/\r?\n/)
  const out = []
  let cur = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#EXTINF')) {
      const attrs = {}
      const attrRe = /([a-zA-Z0-9_-]+)="([^"]*)"/g
      let m
      while ((m = attrRe.exec(line))) attrs[m[1]] = m[2]
      const name = line.slice(line.lastIndexOf(',') + 1).trim()
      cur = {
        id: attrs['tvg-id'] || '',
        logo: attrs['tvg-logo'] || '',
        group: attrs['group-title'] || '',
        rawName: name,
        needsHeaders: false,
        url: '',
      }
    } else if (line.startsWith('#EXTVLCOPT')) {
      // סטרים שדורש Referer/User-Agent לא יעבוד בדפדפן
      if (/http-referrer|http-user-agent/i.test(line) && cur) cur.needsHeaders = true
    } else if (line.startsWith('#')) {
      // הוראות אחרות (#EXTM3U וכו') — מתעלמים
    } else if (cur) {
      cur.url = line
      out.push(cur)
      cur = null
    }
  }
  return out
}

// ניקוי שם הערוץ + חילוץ איכות/תוויות
function normalize(ch) {
  let name = ch.rawName || ''
  const q = name.match(/\((\d+p)\)/i)
  const quality = q ? q[1] : ''
  const geo = /\[Geo-blocked\]/i.test(name)
  const not247 = /\[Not 24\/7\]/i.test(name)
  // מסירים סוגריים (איכות) וסוגריים מרובעים (תוויות) מהשם המוצג
  name = name.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim()
  return {
    id: ch.id || name,
    name: name || 'ערוץ',
    logo: ch.logo || '',
    group: ch.group || '',
    url: ch.url,
    quality,
    geo,
    not247,
    needsHeaders: ch.needsHeaders,
  }
}

function isAdult(ch) {
  const g = (ch.group || '').toLowerCase()
  const n = (ch.name || '').toLowerCase()
  return g.includes('xxx') || g.includes('adult') || n.includes('xxx')
}

// מוריד ומנתח פלייליסט, עם מטמון. מחזיר Promise לרשימת ערוצים נקייה.
function loadPlaylist(url) {
  if (cache.has(url)) return cache.get(url)
  const p = (async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error('tv fetch failed ' + res.status)
    const text = await res.text()
    const list = parseM3U(text).map(normalize).filter(c => c.url && !isAdult(c))
    // קודם ערוצים שכן ינוגנו בדפדפן (בלי דרישת headers)
    list.sort((a, b) => (a.needsHeaders === b.needsHeaders ? 0 : a.needsHeaders ? 1 : -1))
    // הסרת כפילויות לפי מזהה/שם
    const seen = new Set()
    const dedup = []
    for (const c of list) {
      const key = (c.id || c.name).toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      dedup.push(c)
    }
    return dedup
  })()
  cache.set(url, p)
  // אם נכשל — לא משאירים Promise תקוע במטמון
  p.catch(() => cache.delete(url))
  return p
}

// -----------------------------------------------------------------
// שמות בעברית לערוצים ישראליים נפוצים (לפי מילת מפתח בשם/מזהה)
// -----------------------------------------------------------------
const HEBREW_NAME_RULES = [
  { re: /i24.*(hebrew|\bhe\b)/i, name: 'i24 חדשות' },
  { re: /\bi24\b/i, name: 'i24 NEWS' },
  { re: /kan.?educational|kan.?23|educational/i, name: 'כאן חינוכית 23' },
  { re: /kan.?11|כאן.?11/i, name: 'כאן 11' },
  { re: /makan|مكان|מכאן|kan.?33/i, name: 'מכאן 33' },
  { re: /kan.?88|כאן.?88/i, name: 'כאן 88' },
  { re: /kan.?(kids|hila)|הופ\b|\bhop\b/i, name: 'כאן הילה (ילדים)' },
  { re: /knesset|כנסת/i, name: 'ערוץ הכנסת' },
  { re: /keshet|channel.?12|ערוץ.?12|קשת/i, name: 'ערוץ 12 (קשת)' },
  { re: /reshet.?13|channel.?13|ערוץ.?13|\breshet\b|רשת/i, name: 'ערוץ 13 (רשת)' },
  { re: /now.?14|channel.?14|arutz.?14|ערוץ.?14/i, name: 'ערוץ 14' },
  { re: /channel.?9|israel.?plus|ערוץ.?9/i, name: 'ערוץ 9' },
  { re: /hidabroot|הידברות/i, name: 'הידברות' },
  { re: /arutz.?meir|meir.?tv|ערוץ.?מאיר/i, name: 'ערוץ מאיר' },
  { re: /sport.?5|ספורט.?5/i, name: 'ספורט 5' },
  { re: /music.?24|מוזיקה.?24/i, name: 'מוזיקה 24' },
]

// מחיל שמות בעברית על רשימת ערוצים (לפי הכללים)
function relabelHebrew(list) {
  return list.map(c => {
    const hay = `${c.name} ${c.id}`
    for (const r of HEBREW_NAME_RULES) {
      if (r.re.test(hay)) return { ...c, name: r.name }
    }
    return c
  })
}

// -----------------------------------------------------------------
// רשימה לבנה — רק שידור ציבורי רשמי: תאגיד השידור "כאן" + הכנסת.
// זה הקו הבטוח ביותר מבחינת זכויות: שידור ציבורי חופשי ומורשה.
// מסנן את הפלייליסט החי (הכתובות נשארות מעודכנות אוטומטית ע"י iptv-org).
// ערוצים מסחריים (12/13/14) ופרטיים — לא נכללים ברשימה הלבנה.
// -----------------------------------------------------------------
export const TV_IL_WHITELIST = [
  /kan.?11|כאן.?11|reshetkan|תאגיד/i,
  /kan.?educational|kan.?23|חינוכית/i,
  /makan|מכאן|kan.?33/i,
  /knesset|כנסת/i,
]

// האם הערוץ נמצא ברשימה הלבנה (רשמי/ציבורי)?
export function isOfficialIL(ch) {
  const hay = `${ch.name} ${ch.id}`
  return TV_IL_WHITELIST.some(re => re.test(hay))
}

// -----------------------------------------------------------------
// ערוצים ציבוריים ישירות מהמקור הרשמי (הכי בטוח מבחינת זכויות).
// אלה מוצגים ראשונים בלשונית ישראל, לפני מה שמגיע מ-iptv-org.
// כתובות הסטרים הרשמיות של כאן/הכנסת משתנות מדי פעם — צריך לאמת
// ולעדכן אותן (אפשר למצוא ב-Network של הדפדפן באתר הרשמי: קובץ .m3u8).
// פורמט כל ערוץ: { id, name, logo, url }
// דוגמה:
//   { id: 'kan11', name: 'כאן 11', logo: '', url: 'https://kanstreaming.../live.m3u8' },
// כל עוד הרשימה ריקה — לא משתנה כלום, וממשיכים עם הסינון מ-iptv-org.
// -----------------------------------------------------------------
export const IL_OFFICIAL_CHANNELS = [
  // TODO: למלא בכתובות רשמיות מאומתות של כאן 11 / חינוכית / מכאן / הכנסת
]

// הופך הגדרת ערוץ ידנית לאובייקט ערוץ מלא (כמו שמגיע מהפלייליסט)
function toChannel(o) {
  return {
    id: o.id || o.name,
    name: o.name,
    logo: o.logo || '',
    group: o.group || 'רשמי',
    url: o.url,
    quality: o.quality || '',
    geo: false,
    not247: false,
    needsHeaders: false,
    official: true,
  }
}

// ערוצים לפי מדינה (קוד ISO דו-אותי, למשל 'IL', 'US')
export async function fetchTVByCountry(code) {
  if (!code) return []
  try {
    const list = await loadPlaylist(`${PLAYLIST_BASE}/countries/${code.toLowerCase()}.m3u`)
    return code.toUpperCase() === 'IL' ? relabelHebrew(list) : list
  } catch (e) {
    console.error('fetchTVByCountry error:', e)
    return []
  }
}

// ערוצים ישראליים — איחוד פלייליסט המדינה (IL) + פלייליסט
// השפה העברית (heb) — תופס יותר ערוצים ישראליים, עם שמות
// בעברית והסרת כפילויות.
export async function fetchIsraeliTV() {
  const safe = (url) => loadPlaylist(url).catch(() => [])
  const [byCountry, byLang] = await Promise.all([
    safe(`${PLAYLIST_BASE}/countries/il.m3u`),
    safe(`${PLAYLIST_BASE}/languages/heb.m3u`),
  ])
  // קודם הערוצים הרשמיים הידניים (אם הוגדרו), אחר כך מה שמגיע מ-iptv-org
  const official = IL_OFFICIAL_CHANNELS.filter(o => o && o.url).map(toChannel)
  const seen = new Set()
  const merged = []
  for (const c of [...official, ...byCountry, ...byLang]) {
    const key = (c.url || '').toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(c)
  }
  return relabelHebrew(merged)
}

// ערוצים לפי קטגוריה (news, movies, music, kids, sports, ...)
export async function fetchTVByCategory(cat) {
  if (!cat) return []
  try {
    return await loadPlaylist(`${PLAYLIST_BASE}/categories/${cat}.m3u`)
  } catch (e) {
    console.error('fetchTVByCategory error:', e)
    return []
  }
}

// -----------------------------------------------------------------
// נגן HLS — טוען את hls.js רק כשצריך (דפדפנים שאין להם תמיכה מובנית).
// באייפון/ספארי יש תמיכה מובנית ב-HLS דרך <video> ואז לא צריך כלום.
// -----------------------------------------------------------------

// האם הדפדפן מנגן HLS באופן מובנה (Safari / iOS)?
export function nativeHlsSupported() {
  const v = document.createElement('video')
  return !!v.canPlayType('application/vnd.apple.mpegurl')
}

// טוענים את hls.js מ-CDN בזמן ריצה (בלי תלות/התקנה). הבילד הגלובלי
// מגדיר window.Hls. נטען פעם אחת, רק כשבאמת צריך (לא בספארי).
const HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js'
let hlsLoaderPromise = null
export function loadHls() {
  if (typeof window !== 'undefined' && window.Hls) return Promise.resolve(window.Hls)
  if (hlsLoaderPromise) return hlsLoaderPromise
  hlsLoaderPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = HLS_CDN
    s.async = true
    s.onload = () => window.Hls ? resolve(window.Hls) : reject(new Error('hls.js loaded but window.Hls missing'))
    s.onerror = () => { hlsLoaderPromise = null; reject(new Error('failed to load hls.js')) }
    document.head.appendChild(s)
  })
  return hlsLoaderPromise
}

// -----------------------------------------------------------------
// רשימות לתפריט — מדינות וקטגוריות נפוצות (שם בעברית + דגל/אמוג'י)
// -----------------------------------------------------------------
export const TV_COUNTRIES = [
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
  { code: 'PT', flag: '🇵🇹', name: 'פורטוגל' },
  { code: 'PL', flag: '🇵🇱', name: 'פולין' },
  { code: 'UA', flag: '🇺🇦', name: 'אוקראינה' },
  { code: 'RO', flag: '🇷🇴', name: 'רומניה' },
  { code: 'CA', flag: '🇨🇦', name: 'קנדה' },
  { code: 'BR', flag: '🇧🇷', name: 'ברזיל' },
  { code: 'AR', flag: '🇦🇷', name: 'ארגנטינה' },
  { code: 'MX', flag: '🇲🇽', name: 'מקסיקו' },
  { code: 'IN', flag: '🇮🇳', name: 'הודו' },
  { code: 'EG', flag: '🇪🇬', name: 'מצרים' },
  { code: 'JO', flag: '🇯🇴', name: 'ירדן' },
  { code: 'JP', flag: '🇯🇵', name: 'יפן' },
  { code: 'KR', flag: '🇰🇷', name: 'דרום קוריאה' },
  { code: 'CN', flag: '🇨🇳', name: 'סין' },
  { code: 'AU', flag: '🇦🇺', name: 'אוסטרליה' },
]

// כל קטגוריה: id (לתצוגה), emoji, שם, ו-cat (ה-slug בפלייליסט)
export const TV_CATEGORIES = [
  { id: 'country',  emoji: '🌍', name: 'לפי מדינה', kind: 'country' },
  { id: 'news',     emoji: '📰', name: 'חדשות',     kind: 'category', cat: 'news' },
  { id: 'movies',   emoji: '🎬', name: 'סרטים',     kind: 'category', cat: 'movies' },
  { id: 'series',   emoji: '📺', name: 'סדרות',     kind: 'category', cat: 'series' },
  { id: 'music',    emoji: '🎵', name: 'מוזיקה',    kind: 'category', cat: 'music' },
  { id: 'kids',     emoji: '🧸', name: 'ילדים',     kind: 'category', cat: 'kids' },
  { id: 'sports',   emoji: '⚽', name: 'ספורט',     kind: 'category', cat: 'sports' },
  { id: 'documentary', emoji: '🌿', name: 'דוקו',   kind: 'category', cat: 'documentary' },
  { id: 'entertainment', emoji: '🎭', name: 'בידור', kind: 'category', cat: 'entertainment' },
  { id: 'classic',  emoji: '🎞️', name: 'קלאסי',    kind: 'category', cat: 'classic' },
  { id: 'comedy',   emoji: '😄', name: 'קומדיה',    kind: 'category', cat: 'comedy' },
  { id: 'culture',  emoji: '🏛️', name: 'תרבות',     kind: 'category', cat: 'culture' },
  { id: 'cooking',  emoji: '🍳', name: 'אוכל',      kind: 'category', cat: 'cooking' },
  { id: 'religious', emoji: '🕊️', name: 'דת',       kind: 'category', cat: 'religious' },
]
