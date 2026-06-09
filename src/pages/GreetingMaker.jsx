// src/pages/GreetingMaker.jsx
// ─────────────────────────────────────────────────────────────
// מחולל ברכה אישית — בסגנון Canva למובייל.
//
// זרימה:
//   1. כתיבת הברכה (טקסט + מאת)
//   2. בחירת תבנית + עריכה דרך סרגל תחתון עם לשוניות
//
// מבנה מסך העריכה (DesignStep):
//   • למעלה: כותרת + כפתורי שמירה/שיתוף
//   • באמצע: תצוגה מקדימה של הברכה (תופסת רוב המסך)
//   • למטה: סרגל לשוניות (תבניות, טקסט, מאת, פונט, צבע, גודל)
//   • לחיצה על לשונית פותחת bottom sheet עם הבחירות
//
// כל תבנית יודעת איפה בכרטיס לשבץ את הטקסט (top/center/bottom)
// כדי שלא יחפוף לאיור.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { logActivity, createOrUpdateUser } from '../services/firebase.js'
import { IconBackRTL, IconTemplates, IconBackground, IconText, IconSender, IconFont, IconEffects, IconColor, IconSize, IconShare, IconDownload } from '../icons/index.jsx'
import HomeButton from '../components/HomeButton.jsx'
import { GREETING_FONTS } from '../greetingFonts.js'
import { getOccasion } from '../occasion.js'
import { GREETING_GROUPS, READY_OCCASIONS, occasionsByGroup, findOccasion, fillName, randomGreeting } from '../data/readyGreetings.js'
import { saveImageBlob, shareImageBlob } from '../utils/saveImage.js'

// מטמון לתמונות רקע שכבר הומרו ל-base64 (לפי url)
const bgDataCache = {}

// טוען תמונה וממיר אותה ל-data URL (base64).
// זה הכרחי כדי שהתמונה תופיע בתוך SVG שמוטמע ב-data URL,
// וגם כדי ששמירת ה-PNG תעבוד (canvas לא מזדהם).
function loadBgAsDataURL(url) {
  return new Promise((resolve, reject) => {
    if (bgDataCache[url]) { resolve(bgDataCache[url]); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      try {
        const dataUrl = canvas.toDataURL('image/png')
        bgDataCache[url] = dataUrl
        resolve(dataUrl)
      } catch (e) { reject(e) }
    }
    img.onerror = () => reject(new Error('bg image load failed: ' + url))
    img.src = url
  })
}

const MAX_TEXT = 120
const MAX_NAME = 30

// ═══════════════════════════════════════════════════════════════
// מכסת "ברכה מהירה" — עד 3 ברכות ביום לכל קטגוריה (ללא פרימיום).
// נשמר לפי המשתמש (לא לפי מכשיר) במסמך המשתמש — כשדה מחרוזת
// (greetingQuotaJSON) כדי שמיזוג Firestore לא ידביק מפתחות מאתמול.
// מבנה: { date: 'YYYY-M-D', cats: { <מזהה קטגוריה>: [אינדקסים שהוצגו] } }
// מתאפס אוטומטית כשמשתנה התאריך.
function greetingTodayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}
function readQuotaCats(profile) {
  try {
    const q = JSON.parse(profile?.greetingQuotaJSON || '{}')
    if (q.date !== greetingTodayKey()) return {}
    return q.cats || {}
  } catch { return {} }
}

// ═══════════════════════════════════════════════════════════════
// פונטים
// ═══════════════════════════════════════════════════════════════
const FONTS = [
  { id: 'heebo',     name: 'מודרני',    css: "'Heebo', sans-serif",            weight: 800 },
  { id: 'assistant', name: 'נקי',       css: "'Assistant', sans-serif",        weight: 800 },
  { id: 'rubik',     name: 'עגול',      css: "'Rubik', sans-serif",            weight: 700 },
  { id: 'fredoka',   name: 'שובב',      css: "'Fredoka', sans-serif",          weight: 600 },
  { id: 'secular',   name: 'מודגש',     css: "'Secular One', sans-serif",      weight: 400 },
  { id: 'frank',     name: 'קלאסי',     css: "'Frank Ruhl Libre', serif",      weight: 900 },
  { id: 'david',     name: 'מסורתי',    css: "'David Libre', serif",           weight: 700 },
  { id: 'suez',      name: 'חגיגי',     css: "'Suez One', serif",              weight: 400 },
  { id: 'amatic',    name: 'מצויר',     css: "'Amatic SC', cursive",           weight: 700 },
  { id: 'gveret',    name: 'כתב יד',    css: "'Gveret Levin', cursive",        weight: 400 },
]

// בונה הגדרת @font-face עם base64 לפונט הנבחר.
// מוטמע בתוך ה-SVG כך שהפונט "נוסע" עם הגרפיקה גם כשמוטמע ב-<img>.
// fontId = ה-id מתוך FONTS (תואם למפתח ב-GREETING_FONTS).
// שימוש במרכאות כפולות ב-url() — כדי ש-XML parser לא יתבלבל עם מרכאות בודדות בותוך ה-attribute.
function buildFontFace(fontId) {
  const f = GREETING_FONTS[fontId]
  if (!f) return ''
  const fmt = f.fmt || (f.mime === 'font/woff' ? 'woff' : f.mime === 'font/woff2' ? 'woff2' : 'truetype')
  return `@font-face{font-family:&quot;${f.family}&quot;;` +
    `src:url(&quot;data:${f.mime};base64,${f.b64}&quot;) format(&quot;${fmt}&quot;);` +
    `font-weight:1 999;font-display:block;}`
}

// בונה @font-face לכולל הפונטים — שימוש בהזרקה ל-<head>.
function buildAllFontsCSS() {
  return Object.keys(GREETING_FONTS).map(id => {
    const f = GREETING_FONTS[id]
    const fmt = f.fmt || (f.mime === 'font/woff' ? 'woff' : f.mime === 'font/woff2' ? 'woff2' : 'truetype')
    return `@font-face{font-family:'${f.family}';` +
      `src:url('data:${f.mime};base64,${f.b64}') format('${fmt}');` +
      `font-weight:1 999;font-display:block;}`
  }).join('\n')
}

// מזריק את כל הפונטים (base64) ל-<head> של הדף פעם אחת.
// כך הדפדפן מפענח אותם מראש והם זמינים מיד גם בתוך ה-SVG המוטמע כ-<img>.
function injectAllFonts() {
  if (typeof document === 'undefined') return
  if (document.getElementById('greeting-fonts-style')) return // כבר הוזרק
  const css = buildAllFontsCSS()
  if (!css) return
  const style = document.createElement('style')
  style.id = 'greeting-fonts-style'
  style.textContent = css
  document.head.appendChild(style)
}

// ═══════════════════════════════════════════════════════════════
// פלטות צבע
// ═══════════════════════════════════════════════════════════════
const PALETTES = [
  { id: 'burgundy', name: 'בורדו',  bg: '#7E2C2E', bgDeep: '#5A1D1E', ink: '#FBF7EE', accent: '#E8C879' },
  { id: 'teal',     name: 'טורקיז', bg: '#2C5566', bgDeep: '#173846', ink: '#FBF7EE', accent: '#E8C879' },
  { id: 'forest',   name: 'ירוק',   bg: '#4F6B4A', bgDeep: '#354D31', ink: '#FBF7EE', accent: '#D9C89A' },
  { id: 'wine',     name: 'יין',    bg: '#6B3A4F', bgDeep: '#482638', ink: '#FBF7EE', accent: '#E8C879' },
  { id: 'cream',    name: 'שמנת',   bg: '#F4EFE6', bgDeep: '#E8DEC8', ink: '#2A2118', accent: '#7E2C2E' },
  { id: 'navy',     name: 'נייבי',  bg: '#1B2540', bgDeep: '#0E1730', ink: '#FBF7EE', accent: '#B89048' },
]

// ═══════════════════════════════════════════════════════════════
// גדלי טקסט
// ═══════════════════════════════════════════════════════════════
const TEXT_SIZES = [
  { id: 'sm', name: 'קטן',   scale: 0.82 },
  { id: 'md', name: 'בינוני', scale: 1.0  },
  { id: 'lg', name: 'גדול',  scale: 1.18 },
]

// ══════════════════════════════════════════════════════════
// צבעי כתב — משנה את צבע הטקסט עצמו (נפרד מצבע הרקע)
// ══════════════════════════════════════════════════════════
// id 'auto' = משתמש בצבע הברירה (ink) של הרקע/תבנית.
const TEXT_COLORS = [
  { id: 'auto',   name: 'אוטומטי', hex: null },
  { id: 'white',  name: 'לבן',     hex: '#FFFFFF' },
  { id: 'black',  name: 'שחור',    hex: '#1B1B1B' },
  { id: 'gold',   name: 'זהב',     hex: '#D4A437' },
  { id: 'burgundy', name: 'בורדו', hex: '#7E2C2E' },
  { id: 'cream',  name: 'שמנת',    hex: '#FBF1DC' },
  { id: 'navy',   name: 'כחול',    hex: '#1B2540' },
  { id: 'teal',   name: 'טורקיז',  hex: '#2C7A7B' },
  { id: 'pink',   name: 'ורוד',    hex: '#D6498B' },
  { id: 'green',  name: 'ירוק',    hex: '#3E8E5A' },
  { id: 'red',     name: 'אדום',   hex: '#D7263D' },
  { id: 'orange',  name: 'כתום',   hex: '#E8841A' },
  { id: 'purple',  name: 'סגול',   hex: '#7E3FF2' },
  { id: 'sky',     name: 'תכלת',   hex: '#2E9BD6' },
  { id: 'brown',   name: 'חום',    hex: '#6E4B2A' },
  { id: 'silver',  name: 'כסף',    hex: '#9AA3AD' },
]

// ══════════════════════════════════════════════════════════
// אפקטים לכתב — כמו בקאנווה
// ══════════════════════════════════════════════════════════
const TEXT_EFFECTS = [
  { id: 'none',     name: 'ללא' },
  { id: 'shadow',   name: 'צל' },
  { id: 'lift',     name: 'צל רך' },
  { id: 'longshadow', name: 'צל ארוך' },
  { id: 'outline',  name: 'חלול' },
  { id: 'glow',     name: 'זוהר' },
  { id: 'neon',     name: 'ניאון' },
  { id: 'block',    name: 'תלת-מימד' },
  { id: 'glitch',   name: "גליץ'" },
  { id: 'sticker',  name: 'מדבקה' },
]

// ═══════════════════════════════════════════════════════════
// רקעי תמונה — תמונות מאוירות שמונחות ב-public/backgrounds/
// ═══════════════════════════════════════════════════════════
// כל רקע מגדיר:
//   url      — נתיב הקובץ (מתוך public, מתחיל ב-/)
//   textZone — איפה הטקסט ישב: top / center / bottom
//   ink      — צבע הטקסט (כהה לרקע בהיר, בהיר לרקע כהה)
//   accent   — צבע הקו המפריד והעיטורים
//   label    — השם שמופיע למשתמש
//
// להוספת רקע חדש: שמור תמונה ב-public/backgrounds/ והוסף שורה כאן.
//
// הגדרת הקטגוריות — לכל אחת: מזהה תיקיה, שם עברי, מספר קבצים, צבעי טקסט.
// count = כמה תמונות יש בתיקיה (הקבצים חייבים להיקרא 1.png, 2.png, ...).
// match = מילות מפתח בטקסט הברכה שמקשרות אליה — אם הטקסט מכיל אחת מהן,
//         הקטגוריה תוצג ראשונה בלשונית הרקע.
// להוספת קטגוריה: צור תיקיה תחת backgrounds/, שמור בה 1.png…2.png..., והוסף שורה כאן.
const BG_CATEGORIES = [
  // ── קיימות (נוצרו ידנית — לא לגעת) ──
  { dir: 'SHABAT', label: 'שבת שלום', count: 30, ext: 'png', match: ['שבת'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'SHAVUA TOV', label: 'שבוע טוב', count: 25, ext: 'png', match: ['שבוע טוב', 'יום ראשון'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },

  // ── ימים ──
  { dir: 'YOM_RISHON', label: 'יום ראשון', count: 10, ext: 'png', match: ['יום ראשון'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'YOM_SHENI', label: 'יום שני', count: 10, ext: 'png', match: ['יום שני'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'YOM_SHLISHI', label: 'יום שלישי', count: 10, ext: 'png', match: ['יום שלישי'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'YOM_RVII', label: 'יום רביעי', count: 10, ext: 'png', match: ['יום רביעי'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'YOM_CHAMISHI', label: 'יום חמישי', count: 10, ext: 'png', match: ['יום חמישי'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },

  // ── חגים ──
  { dir: 'ROSH_HASHANA', label: 'ראש השנה', count: 10, ext: 'png', match: ['שנה טובה', 'ראש השנה'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'YOM_KIPUR', label: 'יום כיפור', count: 10, ext: 'png', match: ['גמר חתימה', 'כיפור'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'SUKOT', label: 'סוכות', count: 10, ext: 'png', match: ['סוכות'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'CHANUKA', label: 'חנוכה', count: 10, ext: 'png', match: ['חנוכה'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'PURIM', label: 'פורים', count: 10, ext: 'png', match: ['פורים'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'PESACH', label: 'פסח', count: 10, ext: 'png', match: ['פסח'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'SHAVUOT', label: 'שבועות', count: 10, ext: 'png', match: ['שבועות'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },

  // ── איחולים ──
  { dir: 'MAZAL_TOV', label: 'מזל טוב', count: 10, ext: 'png', match: ['מזל טוב'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'YOM_HULEDET', label: 'יום הולדת', count: 10, ext: 'png', match: ['יום הולדת'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'REFUA_SHLEMA', label: 'רפואה שלמה', count: 10, ext: 'png', match: ['רפואה שלמה'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'BEHATZLACHA', label: 'בהצלחה', count: 10, ext: 'png', match: ['בהצלחה'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'BEAHAVA', label: 'באהבה', count: 10, ext: 'png', match: ['באהבה'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'TODA', label: 'תודה רבה', count: 10, ext: 'png', match: ['תודה'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
]

// קטגוריית הפרחים הכללית (BEAHAVA) — מצטרפת כתוספת לסוף כל קטגוריה.
// כך בכל ברכה המשתמש רואה קודם את הרקעים הספציפיים לברכה, ואז 10 תמונות פרחים.
const FLOWERS_EXTRA = { dir: 'BEAHAVA', count: 10, ext: 'png', textZone: 'top', ink: '#5A3D2B', accent: '#B89048' }

// בונה את רשימת הרקעים. קבצי public נגישים ישירות דרך /backgrounds/<dir>/<n>.<ext>
function buildBackgrounds() {
  const list = []
  for (const cat of BG_CATEGORIES) {
    for (let n = 1; n <= cat.count; n++) {
      list.push({
        id: `${cat.dir}-${n}`,
        category: cat.dir,
        categoryLabel: cat.label,
        match: cat.match || [],
        url: `/backgrounds/${encodeURIComponent(cat.dir)}/${n}.${cat.ext}`,
        textZone: cat.textZone,
        ink: cat.ink,
        accent: cat.accent,
        label: cat.label,
      })
    }
    // תוספת פרחים כללית בסוף כל קטגוריה — חוץ מקטגוריית הפרחים עצמה (לא לשכפל).
    if (cat.dir !== FLOWERS_EXTRA.dir) {
      for (let n = 1; n <= FLOWERS_EXTRA.count; n++) {
        list.push({
          id: `${cat.dir}-flower-${n}`,
          category: cat.dir,
          categoryLabel: cat.label,
          match: cat.match || [],
          url: `/backgrounds/${encodeURIComponent(FLOWERS_EXTRA.dir)}/${n}.${FLOWERS_EXTRA.ext}`,
          textZone: FLOWERS_EXTRA.textZone,
          ink: FLOWERS_EXTRA.ink,
          accent: FLOWERS_EXTRA.accent,
          label: cat.label,
        })
      }
    }
  }
  return list
}

const BACKGROUNDS = buildBackgrounds()

// ═══════════════════════════════════════════════════════════════
// בחירת רקע רלוונטי לטקסט הברכה
// ═══════════════════════════════════════════════════════════════
// מחלצת רקע רנדומלי מתוך הקטגוריה שמתאימה לטקסט (לפי match ב-BG_CATEGORIES).
// אם אין התאמה — מחזיר null (התבנית תהיה על רקע צבע אחיד).
//
// ה-excludeId מאפשר לבקש רקע אחר (לכפתור "ערבב") — לא יחזור אתו האחד.
function pickBackgroundForText(text, excludeId = null) {
  const matches = BACKGROUNDS.filter(b =>
    (b.match || []).some(kw => (text || '').includes(kw))
  )
  const pool = matches.length > 0 ? matches : null
  if (!pool) return null
  // מסנן את ה-excludeId אם אפשר (ויש אחרים בקטגוריה)
  const filtered = (excludeId && pool.length > 1)
    ? pool.filter(b => b.id !== excludeId)
    : pool
  return filtered[Math.floor(Math.random() * filtered.length)]
}

// ═══════════════════════════════════════════════════════════════
// תבניות חיות — "מתכונים" של סגנון
// ═══════════════════════════════════════════════════════════════
// כל תבנית מגדירה את הסגנון העיצובי בלבד (פונט+אפקט+צבע+מיקום),
// והרקע נבחר אוטומטית בזמן ריצה מתוך הקטגוריה המתאימה לטקסט הברכה.
// כך הברכה תמיד תקבל רקע רלוונטי (חג→חג, יום שני→יום שני וכו'),
// ולחיצה על אותה תבנית בברכות שונות תיתן תוצאות שונות מאוד.
//
// שדות:
//   id        — מזהה ייחודי
//   label     — שם התבנית (לתצוגה)
//   font      — מזהה פונט מתוך FONTS
//   effect    — מזהה אפקט מתוך TEXT_EFFECTS
//   textColor — מזהה צבע כתב מתוך TEXT_COLORS
//   textZone  — top / center / bottom (איפה הטקסט יישב על הרקע)
//   size      — sm / md / lg (גודל הטקסט)
const TEMPLATES = [
  // ── חגיגי ומפואר ──
  { id: 't01', label: 'חגיגי', font: 'suez', effect: 'shadow', textColor: 'white', textZone: 'center', size: 'lg' },
  { id: 't02', label: 'זהב מלכותי', font: 'frank', effect: 'glow', textColor: 'gold', textZone: 'center', size: 'lg' },
  { id: 't03', label: 'מודגש', font: 'secular', effect: 'sticker', textColor: 'burgundy', textZone: 'center', size: 'md' },

  // ── רך ועדין ──
  { id: 't04', label: 'עדין', font: 'frank', effect: 'lift', textColor: 'cream', textZone: 'top', size: 'md' },
  { id: 't05', label: 'קלאסי', font: 'david', effect: 'shadow', textColor: 'white', textZone: 'center', size: 'md' },
  { id: 't06', label: 'נקי', font: 'assistant', effect: 'lift', textColor: 'white', textZone: 'top', size: 'md' },

  // ── אומנותי ──
  { id: 't07', label: 'כתב יד', font: 'gveret', effect: 'shadow', textColor: 'white', textZone: 'center', size: 'lg' },
  { id: 't08', label: 'מצויר', font: 'amatic', effect: 'sticker', textColor: 'navy', textZone: 'center', size: 'lg' },
  { id: 't09', label: 'שובב', font: 'fredoka', effect: 'block', textColor: 'pink', textZone: 'bottom', size: 'lg' },

  // ── מודרני ──
  { id: 't10', label: 'מודרני', font: 'heebo', effect: 'shadow', textColor: 'white', textZone: 'top', size: 'md' },
  { id: 't11', label: 'תלת-מימד', font: 'rubik', effect: 'block', textColor: 'gold', textZone: 'center', size: 'lg' },
  { id: 't12', label: 'חלול', font: 'heebo', effect: 'outline', textColor: 'white', textZone: 'center', size: 'lg' },
]

// ═══════════════════════════════════════════════════════════════
// ברכות מוכנות
// ═══════════════════════════════════════════════════════════════
const PRESET_GREETINGS = {
  'ימים': [
    'שבוע טוב ומבורך', 'יום ראשון מבורך', 'יום שני מבורך',
    'יום שלישי מבורך', 'יום רביעי מבורך', 'יום חמישי מבורך',
    'שבת שלום ומבורכת',
  ],
  'חגים': [
    'שנה טובה ומתוקה', 'גמר חתימה טובה', 'חג סוכות שמח',
    'חנוכה שמח ומואר', 'פורים שמח', 'חג פסח כשר ושמח',
    'חג שבועות שמח',
  ],
  'איחולים': [
    'מזל טוב!', 'יום הולדת שמח', 'רפואה שלמה', 'בהצלחה רבה',
    'באהבה רבה', 'תודה רבה לך',
  ],
}

// ═══════════════════════════════════════════════════════════════
// המסך הראשי
// ═══════════════════════════════════════════════════════════════
export default function GreetingMaker({ onBack, onHome }) {
  const { profile } = useUserStore()
  const [step, setStep] = useState('choose')

  // טקסט התחלתי — הברכה המתאימה להיום (חג עברי או יום בשבוע). ניתן לשינוי.
  const [text, setText] = useState(() => getOccasion().text)

  // תבנית הברירה — מתבצעת בתוך DesignStep (במקום של לחיצה ידנית בלשונית תבניות)
  const [templateId, setTemplateId] = useState('t01')
  // הגדרות עיצוביות — יכולות להיות מהתבנית או להשתנות ידנית ע"י המשתמש
  const [paletteId, setPaletteId] = useState('burgundy')
  const [fontId, setFontId] = useState('frank')
  const [sizeId, setSizeId] = useState('md')
  const [effectId, setEffectId] = useState('shadow')
  const [textColorId, setTextColorId] = useState('auto')
  // האם להציג את השם של המאחל (ברירת מחדל: כן, אם יש שם בפרופיל)
  const [showSender, setShowSender] = useState(true)
  // בלוקי טקסט נוספים שהמשתמש מוסיף — מופיעים מתחת לטקסט הראשי
  const [extraTexts, setExtraTexts] = useState([])

  const goBack = () => {
    if (step === 'design') { setStep('text'); return }
    if (step === 'text' || step === 'bank') { setStep('choose'); return }
    onBack()
  }

  // מרכיב את השם מהפרופיל — שם פרטי + שם משפחה (אם יש)
  const senderName = (() => {
    if (!profile) return ''
    const first = (profile.name || '').trim()
    const last = (profile.lastName || '').trim()
    return [first, last].filter(Boolean).join(' ')
  })()

  // פועל האיחול לפי מגדר — אישה "מאחלת", אחרת "מאחל" (ברירת מחדל למשתמשים ישנים ללא מגדר)
  const senderVerb = profile?.gender === 'female' ? 'מאחלת' : 'מאחל'

  // פרימיום (או אדמין) — ללא הגבלה על מספר הברכות
  const isPremium = profile?.role === 'premium' || profile?.role === 'admin'
  // המכסה שנוצלה היום (לפי קטגוריה) — מתעדכן חי מהפרופיל
  const quotaCats = readQuotaCats(profile)
  // שמירת המכסה לקטגוריה (best-effort — לא חוסם את המשתמש)
  const persistQuota = (catId, arr) => {
    const uid = useUserStore.getState().authUser?.uid
    if (!uid) return
    const cats = { ...readQuotaCats(useUserStore.getState().profile), [catId]: arr }
    createOrUpdateUser(uid, { greetingQuotaJSON: JSON.stringify({ date: greetingTodayKey(), cats }) }).catch(() => {})
  }
  // מעבר לעיצוב אישי באותה קטגוריה — ממלא טקסט מתאים כך שהרקע יתאים אוטומטית
  const goPersonalForOccasion = (occ) => {
    let t = ''
    try { t = fillName(randomGreeting(occ.id).text || '', '') } catch {}
    setText(t || occ.label)
    setStep('design')
  }

  return (
    <div className="scroll-area rise-in" style={{ direction: 'rtl' }}>
      {step === 'choose' && (
        <>
          <div className="screen-header">
            <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
              <IconBackRTL size={24} color="#1B2540" />
            </button>
            <HomeButton onClick={onHome} />
            <div className="screen-header__title">ברכות</div>
          </div>
          <ChooseStep
            onDesign={() => { setText(getOccasion().text); setStep('text') }}
            onReady={() => setStep('bank')}
          />
        </>
      )}

      {step === 'bank' && (
        <>
          <div className="screen-header">
            <button className="screen-header__back" onClick={goBack} aria-label="חזרה">
              <IconBackRTL size={24} color="#1B2540" />
            </button>
            <HomeButton onClick={onHome} />
            <div className="screen-header__title">ברכה מהמאגר</div>
          </div>
          <BankStep
            senderName={senderName} senderVerb={senderVerb}
            isPremium={isPremium}
            quotaCats={quotaCats}
            onPersistQuota={persistQuota}
            onCreatePersonal={goPersonalForOccasion}
          />
        </>
      )}

      {step === 'text' && (
        <>
          <div className="screen-header">
            <button className="screen-header__back" onClick={goBack} aria-label="חזרה">
              <IconBackRTL size={24} color="#1B2540" />
            </button>
            <HomeButton onClick={onHome} />
            <div className="screen-header__title">ברכה אישית</div>
          </div>
          <div style={{ padding: '8px 20px 32px' }}>
            <TextStep
              text={text} setText={setText}
              onNext={() => setStep('design')}
            />
          </div>
        </>
      )}

      {step === 'design' && (
        <DesignStep
          onBack={goBack}
          text={text} setText={setText}
          senderName={senderName}
          senderVerb={senderVerb}
          showSender={showSender} setShowSender={setShowSender}
          templateId={templateId} setTemplateId={setTemplateId}
          paletteId={paletteId} setPaletteId={setPaletteId}
          fontId={fontId} setFontId={setFontId}
          sizeId={sizeId} setSizeId={setSizeId}
          effectId={effectId} setEffectId={setEffectId}
          textColorId={textColorId} setTextColorId={setTextColorId}
          extraTexts={extraTexts} setExtraTexts={setExtraTexts}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// STEP 1 — כתיבת הטקסט (ללא שינוי מהותי)
// ═══════════════════════════════════════════════════════════════
function TextStep({ text, setText, onNext }) {
  const [openCat, setOpenCat] = useState('ימים')

  return (
    <>
      <p style={{
        fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.5,
        marginTop: 0, marginBottom: 16, fontWeight: 500,
      }}>
        כתבו ברכה משלכם, או בחרו מהמוכנות:
      </p>

      <textarea
        value={text}
        onChange={e => setText(e.target.value.slice(0, MAX_TEXT))}
        rows={3}
        maxLength={MAX_TEXT}
        placeholder="כתבו כאן את הברכה שלכם..."
        style={{
          width: '100%', fontSize: 18, fontFamily: 'inherit',
          padding: '14px', borderRadius: 14,
          border: '2px solid var(--line-strong)',
          background: 'var(--surface)', color: 'var(--ink)',
          marginBottom: 6, direction: 'rtl', resize: 'vertical',
          lineHeight: 1.4,
        }}
      />

      <div style={{
        textAlign: 'left', fontSize: 13, fontWeight: 600,
        color: text.length >= MAX_TEXT ? 'var(--burgundy)' : 'var(--ink-3)',
        marginBottom: 18,
      }}>
        {text.length} / {MAX_TEXT} תווים
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {Object.keys(PRESET_GREETINGS).map(cat => (
          <button key={cat} onClick={() => setOpenCat(cat)} style={{
            flex: 1, padding: '10px 8px', borderRadius: 12,
            background: openCat === cat ? 'var(--burgundy)' : 'var(--surface)',
            color: openCat === cat ? 'white' : 'var(--ink-2)',
            border: openCat === cat ? 'none' : '1px solid var(--line)',
            fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
          }}>
            {cat}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {PRESET_GREETINGS[openCat].map((g, i) => (
          <button key={i} onClick={() => setText(g)} style={{
            width: '100%', textAlign: 'right',
            background: text === g ? 'var(--burgundy-soft)' : 'var(--surface)',
            border: text === g ? '2px solid var(--burgundy)' : '1px solid var(--line)',
            borderRadius: 12, padding: '13px 14px',
            fontSize: 16, fontWeight: 600, color: 'var(--ink)',
            fontFamily: 'inherit',
          }}>
            {g}
          </button>
        ))}
      </div>

      <button
        onClick={onNext}
        disabled={!text.trim()}
        className="big-btn big-btn--primary"
        style={{ width: '100%', opacity: text.trim() ? 1 : 0.5 }}
      >
        המשך לעיצוב ←
      </button>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// STEP 2 — מסך עיצוב בסגנון Canva
// ═══════════════════════════════════════════════════════════════
function DesignStep({
  onBack, locked = false, lockedCategory = null, text, setText, senderName, senderVerb = 'מאחל',
  showSender, setShowSender,
  templateId, setTemplateId,
  paletteId, setPaletteId, fontId, setFontId, sizeId, setSizeId,
  effectId, setEffectId, textColorId, setTextColorId,
  extraTexts = [], setExtraTexts,
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  // איזו לשונית פתוחה ב-bottom sheet (null = סגור)
  const [activeTab, setActiveTab] = useState(null)
  // צבע מותאם אישית (מבורר הצבעים המלא) + ref לפתיחתו
  const [customColor, setCustomColor] = useState('#D4A437')
  // האם בורר הצבע המלא פתוח (מודאל מותאם — אחיד בכל מכשיר, במקום הדיאלוג הטבעי של אנדרואיד)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const colorInputRef = useRef(null)

  // רישום לבקרת הניהול — יצירת ברכה (פעם אחת לכניסה) + שמירה/שיתוף.
  // best-effort — לעולם לא חוסם את המשתמש.
  const createdLoggedRef = useRef(false)
  const logGreeting = (action) => {
    try {
      const { authUser, profile } = useUserStore.getState()
      if (!authUser?.uid) return
      const name = profile?.name || ''
      const detail = (text || '').trim().slice(0, 80)
      // סופרים "נוצרה ברכה" פעם אחת בכל כניסה לעריכה (שמירה/שיתוף ראשון)
      if (!createdLoggedRef.current) {
        createdLoggedRef.current = true
        logActivity({ uid: authUser.uid, name, type: 'greeting', detail })
      }
      // ואז רושמים את הפעולה עצמה (greeting_save / greeting_share)
      logActivity({ uid: authUser.uid, name, type: action, detail })
    } catch { /* לא חוסם */ }
  }

  // מזריק את כל הפונטים ל-<head> פעם אחת בכניסה למסך,
  // ואז מבקש מהדפדפן לטעון אותם — כדי שיהיו זמינים בתוך הגרפיקה.
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => {
    injectAllFonts()
    if (!document.fonts || !document.fonts.ready) { setFontsReady(true); return }
    let cancelled = false
    // טוען את כל הפונטים במפורש
    const loads = FONTS.map(f => {
      const fam = (f.css.match(/'([^']+)'/) || [])[1] || f.css
      return document.fonts.load(`${f.weight} 100px '${fam}'`, 'אבגדהוזחטיכ').catch(() => {})
    })
    Promise.all(loads).then(() => document.fonts.ready).then(() => {
      if (!cancelled) setFontsReady(true)
    }).catch(() => { if (!cancelled) setFontsReady(true) })
    return () => { cancelled = true }
  }, [])
  // רקע תמונה נבחר (null = משתמשים בצבע/תבנית רגילה)
  const [bgId, setBgId] = useState(null)
  const bgMeta = BACKGROUNDS.find(b => b.id === bgId) || null
  // ה-base64 של תמונת הרקע (נטען אסינכרונית)
  const [bgData, setBgData] = useState(null)

  // כשבוחרים רקע — טוענים את התמונה וממירים ל-base64
  useEffect(() => {
    if (!bgMeta) { setBgData(null); return }
    let cancelled = false
    loadBgAsDataURL(bgMeta.url)
      .then(d => { if (!cancelled) setBgData(d) })
      .catch(() => { if (!cancelled) setBgData(null) })
    return () => { cancelled = true }
  }, [bgMeta])

  // אובייקט הרקע שמועבר ל-buildSVG: משלב מטה-data עם ה-base64
  const bg = (bgMeta && bgData) ? { ...bgMeta, dataUrl: bgData } : null

  // ╔══════════════════════════════════════════════════════════════╗
  // מחיל תבנית — מחיל את כל הסגנון של תבנית + בוחר רקע רלוונטי
  // ╚══════════════════════════════════════════════════════════════╝
  const applyTemplate = (templateId) => {
    const t = TEMPLATES.find(x => x.id === templateId)
    if (!t) return
    setTemplateId(templateId)
    setFontId(t.font)
    setEffectId(t.effect)
    setTextColorId(t.textColor)
    setSizeId(t.size)
    // בוחר רקע רנדומלי מהקטגוריה המתאימה
    const picked = pickBackgroundForText(text)
    if (picked) setBgId(picked.id)
    // אם אין רקע מתאים — משאירים את ה-bgId הקיים (המשתמש בחר מראש רקע ספציפי)
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ערבוב — בוחר רקע אחר מאותה קטגוריה (לא חוזר על הנוכחי)
  // ╚══════════════════════════════════════════════════════════════╝
  const shuffleBg = () => {
    const picked = pickBackgroundForText(text, bgId)
    if (picked) setBgId(picked.id)
  }

  const palette = PALETTES.find(p => p.id === paletteId) || PALETTES[0]
  const font = FONTS.find(f => f.id === fontId) || FONTS[0]
  const size = TEXT_SIZES.find(s => s.id === sizeId) || TEXT_SIZES[1]
  const effect = TEXT_EFFECTS.find(e => e.id === effectId) || TEXT_EFFECTS[0]
  const textColor = textColorId === 'custom'
    ? { id: 'custom', name: 'מותאם', hex: customColor }
    : (TEXT_COLORS.find(c => c.id === textColorId) || TEXT_COLORS[0])
  const tpl = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0]
  // השם מוצג רק אם המשתמש בחר להציג אותו (ויש לו שם בפרופיל)
  const cardName = (showSender && senderName) ? senderName.trim() : ''

  // מיון הרקעים: קטגוריה שמילת מפתח שלה מופיעה בטקסט — מוצגת ראשונה.
  // כך בוחר 'יום ראשון, שבוע טוב...' רואה קודם את רקעי 'שבוע טוב'.
  const sortedBackgrounds = (() => {
    const t = text || ''
    const isMatch = (b) => (b.match || []).some(kw => t.includes(kw))
    return [...BACKGROUNDS].sort((a, b) => (isMatch(b) ? 1 : 0) - (isMatch(a) ? 1 : 0))
  })()

  // ברירת מחדל — מחילה את התבנית הראשונה (עם רקע מתאים) בכניסה למסך.
  // כך המשתמש טיפה מטופל בתוצאה מעוצבת — לא מסך ריק.
  // רץ פעם אחת בלבד (ref שומר לא לדרוס בחירה ידנית).
  const didInitialApply = useRef(false)
  useEffect(() => {
    if (didInitialApply.current) return
    didInitialApply.current = true
    applyTemplate(templateId)
    if (locked && lockedCategory) {
      const opts = BACKGROUNDS.filter(b => b.category === lockedCategory)
      if (opts.length) setBgId(opts[Math.floor(Math.random() * opts.length)].id)
    }
    // צבע כתב התחלתי אקראי וקריא (לעולם לא לבן) — משתנה בכל כניסה למסך העיצוב
    const rc = randomReadableColor()
    setCustomColor(rc)
    setTextColorId('custom')
  }, [])

  // מיקום הטקסט הראשי (היסט מברירת המחדל, בפיקסלי SVG בטווח 1080)
  const [mainPos, setMainPos] = useState({ dx: 0, dy: 0 })
  // מכפיל הגדלה ידני לטקסט הראשי (צביטה דו-אצבעית) — 1 = גודל רגיל
  const [mainScale, setMainScale] = useState(1)
  // איזה בלוק נבחר/נגרר: 'main' | אינדקס טקסט נוסף | null
  const [selected, setSelected] = useState(null)

  // החלפת תבנית משנה את אזור ברירת המחדל של הטקסט הראשי — מאפסים את מיקומו
  useEffect(() => { setMainPos({ dx: 0, dy: 0 }) }, [templateId])

  // פריסת בלוקי הטקסט (ראשי + נוספים) — מקור אמת יחיד לתצוגה, לשמירה ולגרירה
  const W = 1080, H = 1080
  const baseInk = bg ? bg.ink : palette.ink
  const ink = (textColor && textColor.hex) ? textColor.hex : baseInk
  const effId = (effect && effect.id) || 'none'
  // גודל הטקסט הראשי לפי אורך + סקייל
  let mainFont = (() => {
    const n = (text || '').trim().length
    return n > 80 ? 50 : n > 50 ? 60 : n > 26 ? 72 : n > 16 ? 88 : 104
  })()
  mainFont = Math.round(mainFont * size.scale)
  {
    const tmp = wrapText((text || '').trim(), Math.floor(760 / (mainFont * 0.56)))
    if (tmp.length > 4) mainFont = Math.max(40, mainFont - (tmp.length - 4) * 8)
  }
  const zone = (tpl && tpl.textZone) || 'center'
  const mainCenterY0 = zone === 'top' ? H * 0.27 : zone === 'bottom' ? H * 0.72 : H * 0.50
  // גודל בסיס לטקסט המשני (לפני הגדלת-הצביטה של הטקסט הראשי)
  const extraFontBase = Math.max(34, Math.round(mainFont * 0.5))
  // הגדלה/הקטנה ידנית בצביטה דו-אצבעית (כמו בקאנווה) — מכפיל על גודל הבסיס
  mainFont = Math.max(24, Math.min(260, Math.round(mainFont * mainScale)))

  // בונה בלוק טקסט: שורות גלושות סביב מרכז (centerX, centerY)
  const makeBlock = (kind, idx, str, fontPx, centerX, centerY) => {
    const lines = wrapText((str || '').trim(), Math.floor(760 / (fontPx * 0.56)))
    const lineHeight = fontPx * 1.32
    const blockHeight = lines.length * lineHeight
    const firstLineY = centerY - blockHeight / 2 + lineHeight / 2
    const maxChars = Math.max(1, ...lines.map(l => l.length))
    const halfW = Math.min(W / 2 - 16, maxChars * fontPx * 0.3)
    return { kind, idx, lines, fontPx, centerX, centerY, lineHeight, blockHeight, firstLineY, halfW }
  }

  const blocks = []
  blocks.push(makeBlock('main', -1, text, mainFont, W / 2 + mainPos.dx, mainCenterY0 + mainPos.dy))
  ;(extraTexts || []).forEach((ex, i) => {
    if (!ex || !((ex.text || '').trim())) return
    const ef = Math.max(20, Math.min(220, Math.round(extraFontBase * (ex.scale || 1))))
    blocks.push(makeBlock('extra', i, ex.text, ef, W / 2 + (ex.dx || 0), H * 0.66 + i * 132 + (ex.dy || 0)))
  })

  // ── גרירה ──────────────────────────────────────
  // שתי ידיות נפרדות: אחת לטקסט הראשי, אחת לשם.
  // לחיצה בחצי העליון של הכרטיס = גוררים את הטקסט,
  // בחצי התחתון = גוררים את השם.
  const previewRef = useRef(null)
  const dragRef = useRef(null)
  const pointersRef = useRef(new Map())   // pointerId → {x,y} — לזיהוי צביטה
  const pinchRef = useRef(null)           // { target, startDist, startScale }

  const clampPos = (v) => Math.max(-470, Math.min(470, v))

  // מאתר את הבלוק הקרוב ביותר לנקודת מגע (בקואורדינטות SVG)
  const blockAt = (sx, sy) => {
    let best = null, bestD = Infinity
    for (const b of blocks) {
      const d = Math.hypot(sx - b.centerX, sy - b.centerY)
      if (d < bestD) { bestD = d; best = b }
    }
    return best
  }

  const onDragStart = (clientX, clientY) => {
    if (!previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    const sx = (clientX - rect.left) * (1080 / rect.width)
    const sy = (clientY - rect.top) * (1080 / rect.height)
    const b = blockAt(sx, sy)
    if (!b) return
    const key = b.kind === 'main' ? 'main' : b.idx
    setSelected(key)
    const cur = b.kind === 'main' ? mainPos : (extraTexts[b.idx] || { dx: 0, dy: 0 })
    dragRef.current = { kind: b.kind, idx: b.idx, startX: clientX, startY: clientY, startDx: cur.dx || 0, startDy: cur.dy || 0 }
  }
  const onDragMove = (clientX, clientY) => {
    if (!dragRef.current || !previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    const dx = clampPos(dragRef.current.startDx + (clientX - dragRef.current.startX) * (1080 / rect.width))
    const dy = clampPos(dragRef.current.startDy + (clientY - dragRef.current.startY) * (1080 / rect.height))
    if (dragRef.current.kind === 'main') {
      setMainPos({ dx, dy })
    } else {
      const i = dragRef.current.idx
      setExtraTexts(extraTexts.map((x, j) => j === i ? { ...x, dx, dy } : x))
    }
  }
  const onDragEnd = () => { dragRef.current = null }

  // צביטה דו-אצבעית להגדלה/הקטנה (כמו בקאנווה)
  const scaleOf = (key) => key === 'main' ? mainScale : ((extraTexts[key] || {}).scale || 1)
  const applyScale = (key, val) => {
    const v = Math.max(0.4, Math.min(3, val))
    if (key === 'main') setMainScale(v)
    else setExtraTexts(prev => prev.map((x, j) => j === key ? { ...x, scale: v } : x))
  }
  const pinchDist = () => {
    const pts = [...pointersRef.current.values()]
    if (pts.length < 2) return 0
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
  }
  const onPointerDownH = (e) => {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointersRef.current.size === 1) {
      onDragStart(e.clientX, e.clientY)
    } else if (pointersRef.current.size === 2) {
      dragRef.current = null // עוברים ממצב גרירה למצב צביטה
      let key = selected
      if (key == null && previewRef.current) {
        const pts = [...pointersRef.current.values()]
        const rect = previewRef.current.getBoundingClientRect()
        const mx = ((pts[0].x + pts[1].x) / 2 - rect.left) * (1080 / rect.width)
        const my = ((pts[0].y + pts[1].y) / 2 - rect.top) * (1080 / rect.height)
        const b = blockAt(mx, my)
        key = b ? (b.kind === 'main' ? 'main' : b.idx) : 'main'
        setSelected(key)
      }
      pinchRef.current = { target: key, startDist: pinchDist() || 1, startScale: scaleOf(key) }
    }
  }
  const onPointerMoveH = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinchRef.current && pointersRef.current.size >= 2) {
      const ratio = pinchDist() / (pinchRef.current.startDist || 1)
      applyScale(pinchRef.current.target, pinchRef.current.startScale * ratio)
    } else if (dragRef.current) {
      onDragMove(e.clientX, e.clientY)
    }
  }
  const onPointerUpH = (e) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 0) onDragEnd()
  }

  const svg = buildCardSVG({ blocks, selected, cardName, senderVerb, palette, font, bg, ink, effId })

  // תמונת תצוגה מקדימה לתבנית: משתמשת ברקע מתאים לטקסט הברכה אם יש.
  // התבנית המשתנה היא בסגנון (פונט/אפקט/צבע), אז מספיק לתת תצוגה
  // מקוצרת עם שם התבנית מעל הרקע — כך כל תבנית תיראה שונה גם בתצוגה המקדימה.
  const buildThumb = (t) => {
    const previewBg = pickBackgroundForText(text) // אוטומטי לפי הטקסט
    return previewBg ? previewBg.url : null
  }

  // רנדור ל-PNG דרך Canvas 2D ישיר — עוקף את נושא SVG sandbox.
  // מצייר ישירות ל-canvas עם הפונטים שכבר טעונים ב-document.
  const renderPNG = async () => {
    const W = 1080, H = 1080

    // מוודא שהפונט נטען לגמרי לפני הציור
    if (document.fonts && document.fonts.load) {
      const fam = (font.css.match(/'([^']+)'/) || [])[1] || font.css
      try {
        await document.fonts.load(`${font.weight} 100px '${fam}'`, text.trim().slice(0, 40) || 'אבגד')
        await document.fonts.load("700 28px 'M PLUS Rounded 1c'", 'מאחלאבגד')
        await document.fonts.load("600 21px 'Huninn'", 'ברכהזונוצרה')
        await document.fonts.ready
      } catch (e) { /* ממשיכים */ }
    }

    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')

    // ── רקע ──
    if (bg) {
      // טוען את תמונת הרקע (כבר ב-cache כ-base64 — נטען מיד)
      const bgImg = new Image()
      bgImg.src = bg.dataUrl
      if (bgImg.decode) {
        try { await bgImg.decode() } catch (e) {}
      }
      ctx.drawImage(bgImg, 0, 0, W, H)
    } else {
      // מדרג צבע
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, palette.bg)
      grad.addColorStop(1, palette.bgDeep)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)
    }

    // ── טקסט ראשי ──
    // גלישת טקסט + גודל
    const fam = (font.css.match(/'([^']+)'/) || [])[1] || font.css
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.direction = 'rtl'
    for (const b of blocks) {
      ctx.font = `${font.weight} ${b.fontPx}px "${fam}", serif`
      b.lines.forEach((ln, i) => {
        drawTextWithEffect(ctx, ln, b.centerX, b.firstLineY + i * b.lineHeight, ink, effId, b.fontPx)
      })
    }

    // ── טקסטים נוספים — מתחת לטקסט הראשי ──
    const extraClean = []

    // ── שם המאחל — מוצג מעל הכיתוב השיווקי, עם קו-מתאר לבן לקריאות על כל רקע ──
    if (cardName) {
      const senderText = `${senderVerb}: ${cardName}`
      ctx.font = `700 28px "M PLUS Rounded 1c", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      const sw = ctx.measureText(senderText).width
      drawPill(ctx, W / 2, H - 80, sw, 28, 'rgba(251,247,238,0.82)')  // כרית לבנה שקופה
      ctx.fillStyle = '#1B1B1B'
      ctx.fillText(senderText, W / 2, H - 80)
    }

    // ── כיתוב שיווקי ──
    const credit = 'ברכה זו נוצרה באמצעות אפליקציית ביחד'
    ctx.font = '600 21px "Huninn", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    const cw = ctx.measureText(credit).width
    drawPill(ctx, W / 2, H - 40, cw, 21, 'rgba(24,18,16,0.46)')  // כרית כהה
    ctx.fillStyle = '#FBF7EE'
    ctx.fillText(credit, W / 2, H - 40)

    return new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png')
    })
  }

  // מוודא שהפונט הנבחר נטען לפני רינדור (אחרת ה-PNG יוצא בפונט ברירת מחדל)
  const ensureFontLoaded = async () => {
    if (!document.fonts || !document.fonts.load) return
    // מחלץ את שם המשפחה מתוך ה-css (החלק שבמרכאות)
    const fam = (font.css.match(/'([^']+)'/) || [])[1] || font.css
    try {
      await document.fonts.load(`${font.weight} 100px '${fam}'`, 'אבגדהו')
      await document.fonts.ready
    } catch (e) { /* אם נכשל — ממשיכים בכל מקרה */ }
  }

  const handleSave = async () => {
    setBusy(true); setMsg('')
    try {
      await ensureFontLoaded()
      const blob = await renderPNG()
      const res = await saveImageBlob(blob, 'ברכה-אישית.png')
      logGreeting('greeting_save')
      if (res.ok) {
        setMsg(res.where === 'gallery' ? '✓ נשמר לגלריה!' : '✓ נשמר!')
      } else {
        setMsg('שגיאה בשמירה')
      }
      setTimeout(() => setMsg(''), 2000)
    } catch (e) {
      console.error(e); setMsg('שגיאה בשמירה')
    }
    setBusy(false)
  }

  const handleShare = async () => {
    setBusy(true); setMsg('')
    try {
      await ensureFontLoaded()
      const blob = await renderPNG()
      const res = await shareImageBlob(blob, 'ברכה-אישית.png', text)
      if (res.ok) {
        logGreeting('greeting_share')
      } else if (res.notSupported) {
        // דפדפן ללא תמיכה בשיתוף — פתיחת וואטסאפ עם הטקסט
        const t = encodeURIComponent(text + '\n\nנוצר באמצעות אפליקציית ביחד')
        window.open(`https://wa.me/?text=${t}`, '_blank')
        logGreeting('greeting_share')
      } else {
        setMsg('שיתוף נכשל')
        setTimeout(() => setMsg(''), 2000)
      }
    } catch (e) {
      if (e?.name !== 'AbortError') { console.error(e); setMsg('שיתוף נכשל') }
    }
    setBusy(false)
  }

  // ── הלשוניות של הסרגל התחתון ─────────────────────────────
  const TABS = [
    { id: 'templates', label: 'תבניות', Icon: IconTemplates },
    { id: 'backgrounds', label: 'רקע', Icon: IconBackground },
    { id: 'text',      label: 'טקסט',   Icon: IconText },
    { id: 'font',      label: 'פונט',   Icon: IconFont },
    { id: 'effect',    label: 'אפקטים', Icon: IconEffects },
    { id: 'color',     label: 'צבע',    Icon: IconColor },
    { id: 'size',      label: 'גודל',   Icon: IconSize },
  ]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', maxHeight: '100vh', overflow: 'hidden',
      position: 'relative',
    }}>
      {/* ─── כותרת עליונה: חזרה + שמירה/שיתוף ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px',
        background: 'var(--bg-app)',
        borderBottom: '1px solid var(--line)',
        flexShrink: 0,
      }}>
        <button onClick={onBack} aria-label="חזרה" style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'var(--surface)', border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <IconBackRTL size={20} color="#1B2540" />
        </button>
        <div style={{ flex: 1, fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
          עצבו את הברכה
        </div>
        <button onClick={handleShare} disabled={busy} style={{
          padding: '10px 16px', borderRadius: 12,
          background: 'var(--burgundy)', color: 'white',
          border: 'none', fontSize: 14, fontWeight: 700,
          fontFamily: 'inherit', cursor: 'pointer',
          opacity: busy ? 0.6 : 1,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <IconShare size={18} color="#fff" /> שתף
        </button>
        <button onClick={handleSave} disabled={busy} aria-label="שמור" style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'var(--surface)', border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          opacity: busy ? 0.6 : 1,
        }}>
          <IconDownload size={20} color="#1B2540" />
        </button>
      </div>

      {/* הודעת מצב */}
      {msg && (
        <div style={{
          textAlign: 'center', padding: '6px 16px',
          background: 'var(--burgundy-soft)', color: 'var(--burgundy)',
          fontSize: 14, fontWeight: 700,
        }}>{msg}</div>
      )}

      {/* ─── תצוגה מקדימה גדולה ─── */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        background: 'var(--bg-page)',
        overflow: 'hidden',
      }}>
        <div ref={previewRef} style={{
          width: '100%', maxWidth: 'min(100%, calc(100vh - 280px))',
          aspectRatio: '1',
          borderRadius: 20, overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
          background: palette.bgDeep,
          position: 'relative',
          touchAction: 'none', cursor: 'grab',
        }}
          onPointerDown={locked ? undefined : onPointerDownH}
          onPointerMove={locked ? undefined : onPointerMoveH}
          onPointerUp={locked ? undefined : onPointerUpH}
          onPointerCancel={locked ? undefined : onPointerUpH}
        >
          {/* SVG מוטמע inline (לא כ-<img>) — כך הגרפיקה יורשת
              את הפונטים שהוזרקו לדף. SVG בתוך <img> מרונדר
              בהקשר מבודד ולא רואה פונטים חיצוניים. */}
          <div
            dangerouslySetInnerHTML={{ __html: svg }}
            style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
          />
        </div>
      </div>

      {/* רמז מונדרני — להזכיר למשתמש שהתצוגה ניתנת לגרירה */}
      <div style={{
        flexShrink: 0, display: locked ? 'none' : 'flex', gap: 6, justifyContent: 'center',
        alignItems: 'center', padding: '0 16px 8px',
        fontSize: 12, fontWeight: 600, color: 'var(--ink-3)',
      }}>
        <span>👆 געו וגררו · צביטה בשתי אצבעות להגדלה</span>
      </div>

      {/* ─── סרגל לשוניות תחתון ─── */}
      <div style={{
        flexShrink: 0,
        display: locked ? 'none' : 'block',
        background: 'var(--surface)',
        borderTop: '1px solid var(--line)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
          padding: '8px 4px',
        }}>
          {TABS.map(t => {
            const isActive = activeTab === t.id
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: '8px 4px', border: 'none',
                background: 'transparent', cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 5,
                fontFamily: 'inherit',
                color: isActive ? 'var(--burgundy)' : 'var(--ink-2)',
              }}>
                <t.Icon size={24} color={isActive ? 'var(--burgundy)' : 'var(--ink-2)'} />
                <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 600 }}>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── רצועת בחירות — נפתחת מעל הסרגל לפי הלשונית הפעילה ─── */}
      {!locked && activeTab && (
        <EditStrip
          title={TABS.find(t => t.id === activeTab)?.label}
          onClose={() => setActiveTab(null)}
        >
          {activeTab === 'templates' && (
            <div>
              {/* כפתור ערבוב — מחליף רק את הרקע, שומר את התבנית */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button onClick={shuffleBg} disabled={!bg} style={{
                  padding: '6px 12px', borderRadius: 10,
                  background: bg ? 'var(--burgundy-soft)' : 'var(--surface)',
                  color: bg ? 'var(--burgundy)' : 'var(--ink-3)',
                  border: bg ? '1px solid var(--burgundy)' : '1px solid var(--line)',
                  fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                  cursor: bg ? 'pointer' : 'default',
                  opacity: bg ? 1 : 0.5,
                }}>
                  🔀 ערבב רקע
                </button>
              </div>
              <HScroll>
                {TEMPLATES.map(t => {
                  const thumbUrl = buildThumb(t)
                  // צבע התבנית לתצוגה (גרדיאנט יפה לפי המיקום)
                  const tplColor = (TEXT_COLORS.find(c => c.id === t.textColor) || {}).hex || '#7E2C2E'
                  return (
                    <button key={t.id} onClick={() => applyTemplate(t.id)} style={{
                      padding: 0,
                      border: t.id === templateId ? '3px solid var(--burgundy)' : '2px solid var(--line)',
                      borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                      width: 92, height: 92, flexShrink: 0,
                      position: 'relative',
                      background: thumbUrl ? 'var(--surface)' : `linear-gradient(135deg, ${tplColor}, #1B2540)`,
                    }}>
                      {thumbUrl && (
                        <img src={thumbUrl} alt={t.label}
                             style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
                      )}
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                        color: 'white', fontSize: 11, fontWeight: 700,
                        padding: '14px 4px 5px', textAlign: 'center',
                        fontFamily: 'inherit',
                      }}>
                        {t.label}
                      </div>
                    </button>
                  )
                })}
              </HScroll>
            </div>
          )}

          {activeTab === 'backgrounds' && (
            <HScroll>
              {/* אפשרות "ללא רקע" — חוזרים לצבע/תבנית */}
              <button onClick={() => setBgId(null)} style={{
                padding: 0,
                border: !bg ? '3px solid var(--burgundy)' : '2px solid var(--line)',
                borderRadius: 12, cursor: 'pointer',
                background: 'var(--surface)',
                width: 92, height: 92, flexShrink: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
                color: 'var(--ink-2)', fontFamily: 'inherit',
              }}>
                <span style={{ fontSize: 22 }}>✕</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>ללא רקע</span>
              </button>
              {sortedBackgrounds.map(b => (
                <button key={b.id} onClick={() => setBgId(b.id)} style={{
                  padding: 0,
                  border: bg?.id === b.id ? '3px solid var(--burgundy)' : '2px solid var(--line)',
                  borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                  background: 'var(--surface)',
                  width: 92, height: 92, flexShrink: 0,
                  position: 'relative',
                }}>
                  <img src={b.url} alt={b.label}
                       style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </HScroll>
          )}

          {activeTab === 'text' && (
            <div style={{ width: '100%' }}>
              <textarea
                value={text}
                onChange={e => setText(e.target.value.slice(0, MAX_TEXT))}
                rows={2}
                maxLength={MAX_TEXT}
                placeholder="כתבו כאן את הברכה..."
                style={{
                  width: '100%', fontSize: 16, fontFamily: 'inherit',
                  padding: '10px 12px', borderRadius: 10,
                  border: '1.5px solid var(--line-strong)',
                  background: 'var(--bg-app)', color: 'var(--ink)',
                  direction: 'rtl', resize: 'none', lineHeight: 1.4,
                }}
              />
              <div style={{
                textAlign: 'left', fontSize: 12, fontWeight: 600, marginTop: 4,
                color: text.length >= MAX_TEXT ? 'var(--burgundy)' : 'var(--ink-3)',
              }}>
                {text.length} / {MAX_TEXT}
              </div>

              {/* Toggle להצגת שם המאחל — השם מגיע מהפרופיל אוטומטית */}
              {senderName && (
                <div style={{
                  marginTop: 12, padding: '10px 12px',
                  background: 'var(--surface)', borderRadius: 10,
                  border: '1px solid var(--line)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                      הצג מאחל על הברכה
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', marginTop: 2 }}>
                      {senderVerb}: {senderName}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowSender(!showSender)}
                    aria-label={showSender ? 'הסתר מאחל' : 'הצג מאחל'}
                    style={{
                      width: 48, height: 28, borderRadius: 14,
                      background: showSender ? 'var(--burgundy)' : 'var(--line-strong)',
                      border: 'none', cursor: 'pointer',
                      position: 'relative', transition: 'background 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3,
                      [showSender ? 'right' : 'left']: 3,
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      transition: 'all 0.2s',
                    }} />
                  </button>
                </div>
              )}

              {/* טקסטים נוספים — בלוקים שיופיעו מתחת לטקסט הראשי */}
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {extraTexts.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <textarea
                      value={t.text || ''}
                      onChange={e => { const v = e.target.value.slice(0, MAX_TEXT); setExtraTexts(extraTexts.map((x, j) => j === i ? { ...x, text: v } : x)) }}
                      rows={1}
                      maxLength={MAX_TEXT}
                      placeholder="טקסט נוסף..."
                      style={{
                        flex: 1, fontSize: 15, fontFamily: 'inherit',
                        padding: '9px 11px', borderRadius: 10,
                        border: '1.5px solid var(--line-strong)',
                        background: 'var(--bg-app)', color: 'var(--ink)',
                        direction: 'rtl', resize: 'none', lineHeight: 1.4,
                      }}
                    />
                    <button onClick={() => setExtraTexts(extraTexts.filter((_, j) => j !== i))}
                      aria-label="הסר טקסט נוסף" style={{
                        width: 38, height: 38, flexShrink: 0, borderRadius: 10,
                        background: 'var(--surface)', border: '1px solid var(--line)',
                        color: 'var(--burgundy)', fontSize: 18, cursor: 'pointer', lineHeight: 1,
                      }}>×</button>
                  </div>
                ))}
                <button
                  onClick={() => setExtraTexts([...extraTexts, { text: '', dx: 0, dy: 0 }])}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    width: '100%', padding: '11px', borderRadius: 10,
                    background: 'var(--surface)', border: '1.5px dashed var(--burgundy)',
                    color: 'var(--burgundy)', fontSize: 15, fontWeight: 700,
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>+</span>
                  הוספת טקסט נוסף
                </button>
              </div>
            </div>
          )}

          {activeTab === 'font' && (
            <HScroll>
              {FONTS.map(f => (
                <button key={f.id} onClick={() => setFontId(f.id)} style={{
                  padding: '10px 16px', borderRadius: 12,
                  background: fontId === f.id ? 'var(--burgundy)' : 'var(--surface)',
                  color: fontId === f.id ? 'white' : 'var(--ink)',
                  border: fontId === f.id ? 'none' : '1px solid var(--line)',
                  fontFamily: f.css, fontWeight: f.weight,
                  fontSize: 18, flexShrink: 0,
                  minWidth: 92, height: 56,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {f.name}
                </button>
              ))}
            </HScroll>
          )}

          {activeTab === 'effect' && (
            <HScroll>
              {TEXT_EFFECTS.map(e => (
                <button key={e.id} onClick={() => setEffectId(e.id)} style={{
                  padding: '10px 16px', borderRadius: 12,
                  background: effectId === e.id ? 'var(--burgundy)' : 'var(--surface)',
                  color: effectId === e.id ? 'white' : 'var(--ink)',
                  border: effectId === e.id ? 'none' : '1px solid var(--line)',
                  fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
                  flexShrink: 0, minWidth: 80, height: 56,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {e.name}
                </button>
              ))}
            </HScroll>
          )}

          {activeTab === 'color' && (
            <HScroll>
              {/* בורר צבע מלא — כל צבע אפשרי (ראשון) */}
              <button
                onClick={() => setShowColorPicker(true)}
                aria-label="בחר צבע כלשהו"
                style={{
                  padding: 0, position: 'relative', flexShrink: 0,
                  width: 56, height: 56, borderRadius: 14, cursor: 'pointer',
                  border: textColorId === 'custom' ? '3px solid var(--ink)' : '2px solid var(--line)',
                  background: textColorId === 'custom'
                    ? customColor
                    : 'conic-gradient(from 0deg, #FF6B6B, #FFD93D, #6BCB77, #4D96FF, #B86BFF, #FF6B6B)',
                }}
              >
                <span style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 800, lineHeight: 1,
                  color: 'white', textShadow: '0 1px 3px rgba(0,0,0,.6)',
                }}>{textColorId === 'custom' ? '' : '+'}</span>
              </button>
              {/* צבעים מוכנים (ללא אוטו) */}
              {TEXT_COLORS.filter(c => c.id !== 'auto').map(c => (
                <button key={c.id} onClick={() => setTextColorId(c.id)} aria-label={c.name} style={{
                  padding: 0,
                  background: c.hex,
                  border: c.id === textColorId ? '3px solid var(--ink)' : '2px solid var(--line)',
                  borderRadius: 14, cursor: 'pointer',
                  width: 56, height: 56, flexShrink: 0,
                  position: 'relative',
                }} />
              ))}
              {/* צבע אקראי (היה "אוטו") — בוחר צבע קריא רנדומלי בכל לחיצה (אחרון) */}
              <button
                onClick={() => { const rc = randomReadableColor(customColor); setCustomColor(rc); setTextColorId('custom') }}
                aria-label="צבע אקראי"
                style={{
                  padding: 0, position: 'relative', flexShrink: 0,
                  width: 56, height: 56, borderRadius: 14, cursor: 'pointer',
                  border: '2px solid var(--line)',
                  background: 'conic-gradient(from 0deg, #FF6B6B, #FFD93D, #6BCB77, #4D96FF, #B86BFF, #FF6B6B)',
                }}
              >
                <span style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color: 'white',
                  textShadow: '0 1px 2px rgba(0,0,0,.5)',
                }}>אוטו</span>
              </button>
            </HScroll>
          )}

          {activeTab === 'size' && (
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              {TEXT_SIZES.map(s => (
                <button key={s.id} onClick={() => setSizeId(s.id)} style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  background: sizeId === s.id ? 'var(--burgundy)' : 'var(--surface)',
                  color: sizeId === s.id ? 'white' : 'var(--ink)',
                  border: sizeId === s.id ? 'none' : '1px solid var(--line)',
                  fontSize: s.id === 'sm' ? 14 : s.id === 'md' ? 17 : 20,
                  fontWeight: 700, fontFamily: 'inherit',
                }}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </EditStrip>
      )}

      {/* בורר הצבע המלא — מודאל מותאם שמוצג זהה בכל מכשיר (במקום <input type=color> הטבעי) */}
      {showColorPicker && (
        <ColorPickerModal
          initial={customColor}
          onCancel={() => setShowColorPicker(false)}
          onConfirm={(hexVal) => { setCustomColor(hexVal); setTextColorId('custom'); setShowColorPicker(false) }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// EditStrip — רצועה קטנה מעל הסרגל, לא מכסה את התצוגה
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// ColorPickerModal — בורר צבע מלא ואחיד בכל המכשירים
// ═══════════════════════════════════════════════════════════════════
// מחליף את <input type="color"> הטבעי, שמוצג שונה בכל מערכת הפעלה
// (במחשב — בורר עשיר; באנדרואיד — רשת צבעים מצומצמת). כאן בונים
// בורר משלנו עם מחווני גוון/עוצמה/בהירות גדולים וברורים — זהה בכל מכשיר.
function ColorPickerModal({ initial = '#D4A437', onConfirm, onCancel }) {
  // המרת hex → HSL כדי לאתחל את המחוונים מהצבע הנוכחי
  const hexToHsl = (hexStr) => {
    let c = String(hexStr || '').replace('#', '')
    if (c.length === 3) c = c.split('').map(x => x + x).join('')
    const r = parseInt(c.slice(0, 2), 16) / 255
    const g = parseInt(c.slice(2, 4), 16) / 255
    const b = parseInt(c.slice(4, 6), 16) / 255
    if ([r, g, b].some(Number.isNaN)) return { h: 45, s: 65, l: 52 }
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
    const li = (max + min) / 2
    let hue = 0, sat = 0
    if (d !== 0) {
      sat = d / (1 - Math.abs(2 * li - 1))
      if (max === r) hue = ((g - b) / d) % 6
      else if (max === g) hue = (b - r) / d + 2
      else hue = (r - g) / d + 4
      hue = Math.round(hue * 60); if (hue < 0) hue += 360
    }
    return { h: hue, s: Math.round(sat * 100), l: Math.round(li * 100) }
  }

  const init = hexToHsl(initial)
  const [h, setH] = useState(init.h)
  const [s, setS] = useState(init.s)
  const [l, setL] = useState(init.l)
  const hex = hslToHex(h, s, l)

  // מחוונים בכיוון LTR קבוע (מינימום משמאל) — כדי שהתנהגות תהיה צפויה גם במסך RTL
  const sliderBase = {
    width: '100%', height: 26, borderRadius: 13, margin: 0,
    cursor: 'pointer', direction: 'ltr', accentColor: 'var(--burgundy)',
  }
  const labelStyle = { fontSize: 15, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 7 }

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, direction: 'rtl',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360,
          background: 'var(--surface)', borderRadius: 20,
          padding: '20px 20px 16px',
          boxShadow: '0 16px 50px rgba(0,0,0,.35)',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', marginBottom: 14, textAlign: 'center' }}>
          בחירת צבע
        </div>

        {/* תצוגה מקדימה של הצבע הנבחר */}
        <div style={{
          height: 72, borderRadius: 14, marginBottom: 18,
          background: hex, border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 16, fontWeight: 800, letterSpacing: 1,
            color: l > 60 ? '#1B1B1B' : '#FFFFFF',
            textShadow: l > 60 ? 'none' : '0 1px 2px rgba(0,0,0,.4)',
          }}>{hex.toUpperCase()}</span>
        </div>

        {/* גוון */}
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>גוון</div>
          <input type="range" min="0" max="360" value={h}
            onChange={e => setH(Number(e.target.value))}
            style={{
              ...sliderBase,
              background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            }} />
        </div>

        {/* עוצמת הצבע (רוויה) */}
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>עוצמת הצבע</div>
          <input type="range" min="0" max="100" value={s}
            onChange={e => setS(Number(e.target.value))}
            style={{
              ...sliderBase,
              background: `linear-gradient(to right, ${hslToHex(h, 0, l)}, ${hslToHex(h, 100, l)})`,
            }} />
        </div>

        {/* בהירות */}
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>בהירות</div>
          <input type="range" min="0" max="100" value={l}
            onChange={e => setL(Number(e.target.value))}
            style={{
              ...sliderBase,
              background: `linear-gradient(to right, #000, ${hslToHex(h, s, 50)}, #fff)`,
            }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '13px', borderRadius: 12,
            background: 'var(--surface)', border: '1.5px solid var(--line-strong)',
            color: 'var(--ink-2)', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
          }}>ביטול</button>
          <button onClick={() => onConfirm(hex)} style={{
            flex: 1, padding: '13px', borderRadius: 12,
            background: 'var(--burgundy)', border: 'none',
            color: 'white', fontSize: 16, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
          }}>אישור</button>
        </div>
      </div>
    </div>
  )
}

function EditStrip({ title, onClose, children }) {
  return (
    <div style={{
      position: 'absolute', bottom: 'calc(82px + env(safe-area-inset-bottom))',
      left: 0, right: 0,
      background: 'var(--bg-app)',
      borderTop: '1px solid var(--line)',
      boxShadow: '0 -8px 24px -8px rgba(20,23,42,.12)',
      padding: '10px 14px 14px',
      zIndex: 5,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)' }}>
          {title}
        </div>
        <button onClick={onClose} aria-label="סגור" style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'var(--surface)', border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 16, color: 'var(--ink-2)', lineHeight: 1,
        }}>×</button>
      </div>
      {children}
    </div>
  )
}

// רצועה אופקית אופקית — אפשר לגלול שמאלה לראות עוד אפשרויות
function HScroll({ children }) {
  return (
    <div style={{
      display: 'flex', gap: 8,
      overflowX: 'auto', overflowY: 'hidden',
      WebkitOverflowScrolling: 'touch',
      paddingBottom: 4,
      // מסתיר את פס הגלילה המכוער
      scrollbarWidth: 'none', msOverflowStyle: 'none',
    }}>
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// בוני SVG — איורים מובנים
// ═══════════════════════════════════════════════════════════════

function illustMenorah(W, H, accent, ink) {
  // חנוכייה למעלה (כדי שהטקסט יושב למטה — textZone: 'bottom')
  const cx = W / 2, cy = H * 0.26
  let g = ''
  g += `<rect x="${cx - 220}" y="${cy + 150}" width="440" height="30" rx="8" fill="${accent}" opacity="0.92"/>`
  g += `<rect x="${cx - 140}" y="${cy + 110}" width="280" height="48" rx="6" fill="${accent}" opacity="0.92"/>`
  g += `<rect x="${cx - 8}" y="${cy - 30}" width="16" height="140" fill="${accent}" opacity="0.92"/>`
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue
    const x = cx + i * 50
    g += `<path d="M ${cx} ${cy + 50} Q ${cx + i * 25} ${cy - 30} ${x} ${cy - 30} L ${x} ${cy + 50}" fill="none" stroke="${accent}" stroke-width="6" opacity="0.92"/>`
    g += `<rect x="${x - 6}" y="${cy - 60}" width="12" height="30" fill="${accent}" opacity="0.9"/>`
    g += `<ellipse cx="${x}" cy="${cy - 72}" rx="6" ry="14" fill="${ink}" opacity="0.95"/>`
    g += `<ellipse cx="${x}" cy="${cy - 74}" rx="3" ry="8" fill="${accent}"/>`
  }
  g += `<rect x="${cx - 6}" y="${cy - 70}" width="12" height="40" fill="${accent}" opacity="0.92"/>`
  g += `<ellipse cx="${cx}" cy="${cy - 86}" rx="8" ry="18" fill="${ink}" opacity="0.95"/>`
  g += `<ellipse cx="${cx}" cy="${cy - 88}" rx="4" ry="11" fill="${accent}"/>`
  return g
}

function illustPomegranate(W, H, accent, ink) {
  // רימונים בפינות עליונות וימין-תחתון — לא בולעים מרכז
  return `
    <g transform="translate(${W * 0.18}, ${H * 0.18})">
      <ellipse cx="0" cy="0" rx="110" ry="120" fill="${accent}" opacity="0.92"/>
      <path d="M -10 -105 L 0 -130 L 10 -105 M -20 -100 L -10 -125 L 0 -105 M 0 -105 L 10 -125 L 20 -100"
            stroke="${accent}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.92"/>
      <circle cx="-30" cy="-20" r="9" fill="${ink}" opacity="0.65"/>
      <circle cx="20" cy="0" r="9" fill="${ink}" opacity="0.65"/>
      <circle cx="-10" cy="35" r="9" fill="${ink}" opacity="0.65"/>
      <circle cx="40" cy="40" r="9" fill="${ink}" opacity="0.65"/>
      <circle cx="-40" cy="50" r="9" fill="${ink}" opacity="0.65"/>
    </g>
    <g transform="translate(${W * 0.82}, ${H * 0.82}) scale(0.55)">
      <ellipse cx="0" cy="0" rx="110" ry="120" fill="${accent}" opacity="0.7"/>
      <path d="M -10 -105 L 0 -130 L 10 -105 M -20 -100 L -10 -125 L 0 -105 M 0 -105 L 10 -125 L 20 -100"
            stroke="${accent}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.7"/>
    </g>`
}

function illustFlowers(W, H, accent, ink) {
  // 4 פרחים רק בפינות — האמצע פנוי לטקסט
  const flower = (cx, cy, r, color) => {
    let g = ''
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3
      g += `<ellipse cx="${cx + Math.cos(a) * r * 0.55}" cy="${cy + Math.sin(a) * r * 0.55}" rx="${r * 0.36}" ry="${r * 0.52}" fill="${color}" opacity="0.85" transform="rotate(${a * 180 / Math.PI} ${cx + Math.cos(a) * r * 0.55} ${cy + Math.sin(a) * r * 0.55})"/>`
    }
    g += `<circle cx="${cx}" cy="${cy}" r="${r * 0.32}" fill="${ink}" opacity="0.8"/>`
    return g
  }
  return `
    ${flower(W * 0.14, H * 0.14, 72, accent)}
    ${flower(W * 0.86, H * 0.16, 60, accent)}
    ${flower(W * 0.12, H * 0.86, 65, accent)}
    ${flower(W * 0.86, H * 0.86, 72, accent)}
  `
}

// זר ורדים — למעלה (כי textZone: 'top' = הטקסט בחלק העליון... רגע, הפוך!)
// textZone: 'top' אומר שהטקסט בחלק העליון של הכרטיס,
// אז האיור צריך להיות בחלק התחתון.
function illustRoseBouquet(W, H, accent, ink) {
  // הזר בחצי התחתון של הכרטיס
  const cx = W / 2, cy = H * 0.85
  const rose = (x, y, r, fill, depth) => `
    <g transform="translate(${x},${y})">
      <circle r="${r}" fill="${depth}"/>
      <path d="M -${r * 0.45} 0 A ${r * 0.45} ${r * 0.45} 0 0 1 ${r * 0.45} 0 A ${r * 0.7} ${r * 0.7} 0 0 0 -${r * 0.45} 0 Z" fill="${fill}"/>
      <path d="M -${r * 0.25} -${r * 0.15} A ${r * 0.3} ${r * 0.3} 0 0 1 ${r * 0.25} -${r * 0.15} A ${r * 0.4} ${r * 0.4} 0 0 0 -${r * 0.25} -${r * 0.15} Z" fill="${depth}"/>
      <circle cy="-${r * 0.1}" r="${r * 0.18}" fill="${fill}"/>
    </g>`
  let g = ''
  // גבעולים
  g += `<path d="M ${cx} ${cy - 20} L ${cx - 100} ${H + 50} L ${cx + 100} ${H + 50} Z" fill="${ink}" opacity="0.5"/>`
  // סרט
  g += `<rect x="${cx - 130}" y="${cy - 50}" width="260" height="20" rx="6" fill="${accent}" opacity="0.85"/>`
  // עלים
  g += `<ellipse cx="${cx - 150}" cy="${cy - 70}" rx="45" ry="22" fill="${accent}" opacity="0.55" transform="rotate(-30 ${cx - 150} ${cy - 70})"/>`
  g += `<ellipse cx="${cx + 150}" cy="${cy - 70}" rx="45" ry="22" fill="${accent}" opacity="0.55" transform="rotate(30 ${cx + 150} ${cy - 70})"/>`
  // ורדים
  g += rose(cx - 95, cy - 65, 42, accent, ink)
  g += rose(cx - 30, cy - 80, 45, accent, ink)
  g += rose(cx + 30, cy - 80, 45, accent, ink)
  g += rose(cx + 95, cy - 65, 42, accent, ink)
  g += rose(cx - 60, cy - 130, 40, accent, ink)
  g += rose(cx,      cy - 145, 46, accent, ink)
  g += rose(cx + 60, cy - 130, 40, accent, ink)
  return g
}

// עוגת יום הולדת — בחצי התחתון (textZone: 'top' = טקסט למעלה)
function illustBirthdayCake(W, H, accent, ink) {
  const cx = W / 2, cy = H * 0.62
  let g = ''
  // מגש
  g += `<rect x="${cx - 200}" y="${cy + 200}" width="400" height="24" rx="6" fill="${ink}" opacity="0.5"/>`
  // קומה תחתונה
  g += `<rect x="${cx - 180}" y="${cy + 100}" width="360" height="100" rx="8" fill="${accent}" opacity="0.95"/>`
  g += `<path d="M ${cx - 180} ${cy + 100} Q ${cx - 160} ${cy + 80} ${cx - 140} ${cy + 100} Q ${cx - 120} ${cy + 80} ${cx - 100} ${cy + 100} Q ${cx - 80} ${cy + 80} ${cx - 60} ${cy + 100} Q ${cx - 40} ${cy + 80} ${cx - 20} ${cy + 100} Q ${cx} ${cy + 80} ${cx + 20} ${cy + 100} Q ${cx + 40} ${cy + 80} ${cx + 60} ${cy + 100} Q ${cx + 80} ${cy + 80} ${cx + 100} ${cy + 100} Q ${cx + 120} ${cy + 80} ${cx + 140} ${cy + 100} Q ${cx + 160} ${cy + 80} ${cx + 180} ${cy + 100} L ${cx + 180} ${cy + 110} L ${cx - 180} ${cy + 110} Z" fill="${ink}" opacity="0.85"/>`
  // קומה אמצעית
  g += `<rect x="${cx - 140}" y="${cy + 20}" width="280" height="85" rx="6" fill="${accent}" opacity="0.95"/>`
  g += `<path d="M ${cx - 140} ${cy + 20} Q ${cx - 120} ${cy + 5} ${cx - 100} ${cy + 20} Q ${cx - 80} ${cy + 5} ${cx - 60} ${cy + 20} Q ${cx - 40} ${cy + 5} ${cx - 20} ${cy + 20} Q ${cx} ${cy + 5} ${cx + 20} ${cy + 20} Q ${cx + 40} ${cy + 5} ${cx + 60} ${cy + 20} Q ${cx + 80} ${cy + 5} ${cx + 100} ${cy + 20} Q ${cx + 120} ${cy + 5} ${cx + 140} ${cy + 20} L ${cx + 140} ${cy + 30} L ${cx - 140} ${cy + 30} Z" fill="${ink}" opacity="0.85"/>`
  // קומה עליונה
  g += `<rect x="${cx - 100}" y="${cy - 50}" width="200" height="70" rx="6" fill="${accent}" opacity="0.95"/>`
  // נרות
  for (let i = -1; i <= 1; i++) {
    const x = cx + i * 60
    g += `<rect x="${x - 5}" y="${cy - 110}" width="10" height="60" fill="${ink}" opacity="0.9"/>`
    g += `<ellipse cx="${x}" cy="${cy - 122}" rx="7" ry="16" fill="${ink}" opacity="0.7"/>`
    g += `<ellipse cx="${x}" cy="${cy - 124}" rx="4" ry="11" fill="${accent}"/>`
    g += `<ellipse cx="${x}" cy="${cy - 126}" rx="2" ry="6" fill="#FFF7C8"/>`
  }
  // סוכריות
  const sprinkles = [
    [cx - 80, cy + 60], [cx - 30, cy + 75], [cx + 50, cy + 65], [cx + 95, cy + 80],
    [cx - 60, cy + 145], [cx + 20, cy + 155], [cx + 90, cy + 140], [cx - 110, cy + 160],
  ]
  sprinkles.forEach(([x, y]) => {
    g += `<circle cx="${x}" cy="${y}" r="4" fill="${ink}" opacity="0.7"/>`
  })
  return g
}

// יונים — למעלה (textZone: 'bottom' = הטקסט בחלק התחתון)
function illustDovesWithFlowers(W, H, accent, ink) {
  let g = ''
  const tinyFlower = (cx, cy, r, color) => {
    let f = ''
    for (let i = 0; i < 5; i++) {
      const a = i * 2 * Math.PI / 5 - Math.PI / 2
      f += `<circle cx="${cx + Math.cos(a) * r * 0.55}" cy="${cy + Math.sin(a) * r * 0.55}" r="${r * 0.42}" fill="${color}" opacity="0.85"/>`
    }
    f += `<circle cx="${cx}" cy="${cy}" r="${r * 0.28}" fill="${ink}" opacity="0.7"/>`
    return f
  }
  // יונים בחצי העליון
  const cx1 = W * 0.32, cy1 = H * 0.22
  g += `<ellipse cx="${cx1}" cy="${cy1}" rx="55" ry="40" fill="${accent}" opacity="0.95"/>`
  g += `<circle cx="${cx1 - 45}" cy="${cy1 - 16}" r="20" fill="${accent}" opacity="0.95"/>`
  g += `<path d="M ${cx1 - 65} ${cy1 - 16} L ${cx1 - 82} ${cy1 - 13} L ${cx1 - 65} ${cy1 - 8} Z" fill="#E8A93B"/>`
  g += `<circle cx="${cx1 - 50}" cy="${cy1 - 20}" r="2.5" fill="${ink}"/>`
  g += `<path d="M ${cx1 + 8} ${cy1 - 8} Q ${cx1 + 28} ${cy1 - 36} ${cx1 + 50} ${cy1 - 3} Q ${cx1 + 32} ${cy1 + 4} ${cx1 + 8} ${cy1 - 8} Z" fill="${ink}" opacity="0.25"/>`
  g += `<path d="M ${cx1 + 50} ${cy1 + 3} L ${cx1 + 85} ${cy1 + 16} L ${cx1 + 80} ${cy1 + 20} L ${cx1 + 50} ${cy1 + 10} Z" fill="${accent}" opacity="0.95"/>`

  const cx2 = W * 0.68, cy2 = H * 0.22
  g += `<ellipse cx="${cx2}" cy="${cy2}" rx="55" ry="40" fill="${accent}" opacity="0.95"/>`
  g += `<circle cx="${cx2 + 45}" cy="${cy2 - 16}" r="20" fill="${accent}" opacity="0.95"/>`
  g += `<path d="M ${cx2 + 65} ${cy2 - 16} L ${cx2 + 82} ${cy2 - 13} L ${cx2 + 65} ${cy2 - 8} Z" fill="#E8A93B"/>`
  g += `<circle cx="${cx2 + 50}" cy="${cy2 - 20}" r="2.5" fill="${ink}"/>`
  g += `<path d="M ${cx2 - 8} ${cy2 - 8} Q ${cx2 - 28} ${cy2 - 36} ${cx2 - 50} ${cy2 - 3} Q ${cx2 - 32} ${cy2 + 4} ${cx2 - 8} ${cy2 - 8} Z" fill="${ink}" opacity="0.25"/>`
  g += `<path d="M ${cx2 - 50} ${cy2 + 3} L ${cx2 - 85} ${cy2 + 16} L ${cx2 - 80} ${cy2 + 20} L ${cx2 - 50} ${cy2 + 10} Z" fill="${accent}" opacity="0.95"/>`

  // זר פרחים בין היונים (חלק עליון)
  g += tinyFlower(W * 0.5, H * 0.16, 38, accent)
  g += tinyFlower(W * 0.5 - 50, H * 0.13, 28, accent)
  g += tinyFlower(W * 0.5 + 50, H * 0.13, 28, accent)
  return g
}

// ═══════════════════════════════════════════════════════════════
// בונה SVG ראשי
// ═══════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// drawTextWithEffect — מצייר טקסט עם אפקט ישירות ל-canvas (לצורך PNG export).
// משמש את אותה תפקיד כמו buildTextWithEffect של ה-SVG, אבל על canvas 2D.
// ════════════════════════════════════════════════════════════════
// מצייר "כרית" (מלבן מעוגל) מאחורי טקסט — לכיתובים התחתונים בברכה (שם המברך / קרדיט).
function drawPill(ctx, cx, baselineY, textW, fontSize, fillStyle) {
  const padX = Math.round(fontSize * 0.8)
  const w = Math.round(textW + padX * 2)
  const h = Math.round(fontSize * 1.7)
  const x = Math.round(cx - w / 2)
  const y = Math.round((baselineY - fontSize * 0.33) - h / 2)
  const r = Math.round(h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.fillStyle = fillStyle
  ctx.fill()
}

function drawTextWithEffect(ctx, text, x, y, fill, effectId, fontSize) {
  // שומר את המצב הנוכחי לשחזורה
  const reset = () => {
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    ctx.globalAlpha = 1
  }

  switch (effectId) {
    case 'shadow': {
      ctx.shadowColor = 'rgba(0,0,0,0.45)'
      ctx.shadowBlur = 6
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 8
      ctx.fillStyle = fill
      ctx.fillText(text, x, y)
      reset()
      break
    }
    case 'lift': {
      ctx.shadowColor = 'rgba(0,0,0,0.35)'
      ctx.shadowBlur = 18
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 4
      ctx.fillStyle = fill
      ctx.fillText(text, x, y)
      reset()
      break
    }
    case 'longshadow': {
      // צל ארוך — לולאה של שכבות מוזזות
      ctx.fillStyle = 'rgba(0,0,0,0.13)'
      for (let i = 18; i >= 1; i--) {
        ctx.fillText(text, x + i * 3, y + i * 3)
      }
      ctx.fillStyle = fill
      ctx.fillText(text, x, y)
      break
    }
    case 'outline': {
      ctx.lineWidth = Math.max(3, fontSize * 0.045)
      ctx.strokeStyle = fill
      ctx.lineJoin = 'round'
      ctx.strokeText(text, x, y)
      // ללא fill — רק מתאר
      break
    }
    case 'glow': {
      // זוהר — צל עם צבע המילוי במקום שחור
      ctx.shadowColor = fill
      ctx.shadowBlur = 24
      ctx.fillStyle = fill
      ctx.fillText(text, x, y)
      // שכבה שניה להגברת הזוהר
      ctx.shadowBlur = 12
      ctx.fillText(text, x, y)
      reset()
      break
    }
    case 'neon': {
      // ניאון — ממלא זוהר עם מילוי קרים באמצע
      ctx.shadowColor = fill
      ctx.shadowBlur = 32
      ctx.fillStyle = '#FFF7F0'
      ctx.fillText(text, x, y)
      ctx.shadowBlur = 16
      ctx.fillText(text, x, y)
      ctx.shadowBlur = 6
      ctx.lineWidth = 2
      ctx.strokeStyle = fill
      ctx.strokeText(text, x, y)
      ctx.fillText(text, x, y)
      reset()
      break
    }
    case 'block': {
      // תלת-מימד — שכבות כהות מאחור קדימה
      ctx.fillStyle = 'rgba(0,0,0,0.33)'
      for (let i = 10; i >= 1; i--) {
        ctx.fillText(text, x + i * 2.5, y + i * 2.5)
      }
      ctx.fillStyle = fill
      ctx.fillText(text, x, y)
      break
    }
    case 'glitch': {
      // גליץ' — שלוש שכבות: ציאן, מגנטה, מקורי
      ctx.fillStyle = '#00E5FF'
      ctx.fillText(text, x - 8, y)
      ctx.fillStyle = '#FF0066'
      ctx.fillText(text, x + 8, y)
      ctx.fillStyle = fill
      ctx.fillText(text, x, y)
      break
    }
    case 'sticker': {
      // מדבקה — קו-מתאר לבן עבה + צל
      ctx.lineWidth = Math.max(10, fontSize * 0.16)
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineJoin = 'round'
      ctx.shadowColor = 'rgba(0,0,0,0.4)'
      ctx.shadowBlur = 5
      ctx.shadowOffsetY = 6
      ctx.strokeText(text, x, y)
      ctx.fillStyle = fill
      ctx.fillText(text, x, y)
      reset()
      break
    }
    default: {
      // ללא אפקט
      ctx.fillStyle = fill
      ctx.fillText(text, x, y)
    }
  }
}

// ════════════════════════════════════════════════════════════════
// בונה SVG ראשי (לתצוגה מקדימה בלבד)
// ════════════════════════════════════════════════════════════════
function buildTextWithEffect({ effectId, textLines, fontCss, fontWeight, fontSize, fill, uid }) {
  const txt = (extra = '', fillOverride = fill) =>
    `<text font-family="${fontCss}" font-size="${fontSize}" font-weight="${fontWeight}" ` +
    `fill="${fillOverride}" text-anchor="middle" direction="rtl" ${extra}>${textLines}</text>`

  switch (effectId) {
    case 'shadow': {
      const f = `eff-shadow-${uid}`
      return {
        defs: `<filter id="${f}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.45"/></filter>`,
        content: txt(`filter="url(#${f})"`),
      }
    }
    case 'lift': {
      const f = `eff-lift-${uid}`
      return {
        defs: `<filter id="${f}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="18" flood-color="#000000" flood-opacity="0.35"/></filter>`,
        content: txt(`filter="url(#${f})"`),
      }
    }
    case 'longshadow': {
      let shadow = ''
      for (let i = 18; i >= 1; i--) shadow += txt(`transform="translate(${i * 3}, ${i * 3})"`, 'rgba(0,0,0,0.13)')
      return { defs: '', content: shadow + txt() }
    }
    case 'outline': {
      return { defs: '', content: txt(`stroke="${fill}" stroke-width="${Math.max(3, fontSize * 0.045)}" paint-order="stroke"`, 'none') }
    }
    case 'glow': {
      const f = `eff-glow-${uid}`
      return {
        defs: `<filter id="${f}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="${fill}" flood-opacity="0.9"/><feDropShadow dx="0" dy="0" stdDeviation="24" flood-color="${fill}" flood-opacity="0.6"/></filter>`,
        content: txt(`filter="url(#${f})"`),
      }
    }
    case 'neon': {
      const f = `eff-neon-${uid}`
      return {
        defs: `<filter id="${f}" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="${fill}" flood-opacity="1"/><feDropShadow dx="0" dy="0" stdDeviation="16" flood-color="${fill}" flood-opacity="0.9"/><feDropShadow dx="0" dy="0" stdDeviation="32" flood-color="${fill}" flood-opacity="0.7"/></filter>`,
        content: txt(`filter="url(#${f})" stroke="${fill}" stroke-width="2"`, '#FFF7F0'),
      }
    }
    case 'block': {
      let layers = ''
      for (let i = 10; i >= 1; i--) layers += txt(`transform="translate(${i * 2.5}, ${i * 2.5})"`, '#00000055')
      return { defs: '', content: layers + txt() }
    }
    case 'glitch': {
      return {
        defs: '',
        content: txt(`transform="translate(-8, 0)"`, '#00E5FF') + txt(`transform="translate(8, 0)"`, '#FF0066') + txt(),
      }
    }
    case 'sticker': {
      const f = `eff-sticker-${uid}`
      return {
        defs: `<filter id="${f}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000000" flood-opacity="0.4"/></filter>`,
        content: txt(`stroke="#FFFFFF" stroke-width="${Math.max(10, fontSize * 0.16)}" paint-order="stroke" filter="url(#${f})"`, fill),
      }
    }
    default:
      return { defs: '', content: txt() }
  }
}

function buildSVG({ text, extraTexts = [], cardName, senderVerb = 'מאחל', tpl, palette, font, size, bg, offsetYText = 0, effect, textColor }) {
  const W = 1080, H = 1080

  // כשיש רקע תמונה — הוא גובר על הצבע/תבנית.
  const baseInk = bg ? bg.ink : palette.ink
  const accent = bg ? bg.accent : palette.accent
  // צבע הכתב: אם המשתמש בחר צבע מפורש — הוא גובר; אחרת צבע הברירה.
  const ink = (textColor && textColor.hex) ? textColor.hex : baseInk

  // גלישת טקסט + גודל
  const len = text.trim().length
  let bigFont = len > 80 ? 50 : len > 50 ? 60 : len > 26 ? 72 : len > 16 ? 88 : 104
  bigFont = Math.round(bigFont * size.scale)
  const maxCharsPerLine = Math.floor(760 / (bigFont * 0.56))
  const lines = wrapText(text.trim(), maxCharsPerLine)
  if (lines.length > 4) bigFont = Math.max(40, bigFont - (lines.length - 4) * 8)
  const lineHeight = bigFont * 1.32

  const blockHeight = lines.length * lineHeight

  // ── מרכז אנכי של הטקסט לפי textZone ─────────────────────
  // top    = 25% (איור בחצי התחתון)
  // center = 50% (איור בפינות / לא חופף)
  // bottom = 72% (איור בחצי העליון)
  const zone = (tpl && tpl.textZone) || 'center'
  const centerY = zone === 'top'    ? H * 0.27
                : zone === 'bottom' ? H * 0.72
                : H * 0.50

  const firstLineY = centerY - blockHeight / 2 + lineHeight / 2
  const textLines = lines.map((ln, i) =>
    `<tspan x="${W / 2}" y="${firstLineY + i * lineHeight}">${escapeXML(ln)}</tspan>`
  ).join('')

  // בונה את שכבת הטקסט לפי האפקט הנבחר (uid ייחודי ל-id הפילטר)
  const effId = (effect && effect.id) || 'none'
  const fxUid = Math.random().toString(36).slice(2, 8)
  const fx = buildTextWithEffect({
    effectId: effId, textLines, fontCss: font.css, fontWeight: font.weight,
    fontSize: bigFont, fill: ink, uid: fxUid,
  })

  // ── טקסטים נוספים — מתחת לטקסט הראשי, באותו צבע/פונט/אפקט, קטן יותר ──
  const extraClean = (extraTexts || []).map(s => (s || '').trim()).filter(Boolean)
  let extraDefs = '', extraContent = ''
  if (extraClean.length) {
    const extraFont = Math.max(34, Math.round(bigFont * 0.5))
    const extraLineHeight = extraFont * 1.3
    const extraMaxChars = Math.floor(760 / (extraFont * 0.56))
    const extraLines = []
    for (const t of extraClean) for (const ln of wrapText(t, extraMaxChars)) extraLines.push(ln)
    const lastMainY = firstLineY + (lines.length - 1) * lineHeight
    const extraFirstY = lastMainY + lineHeight * 0.4 + extraLineHeight
    const extraTspans = extraLines.map((ln, i) =>
      `<tspan x="${W / 2}" y="${extraFirstY + i * extraLineHeight}">${escapeXML(ln)}</tspan>`
    ).join('')
    const fxe = buildTextWithEffect({
      effectId: effId, textLines: extraTspans, fontCss: font.css, fontWeight: font.weight,
      fontSize: extraFont, fill: ink, uid: fxUid + 'e',
    })
    extraDefs = fxe.defs
    extraContent = fxe.content
  }

  // ── רקע + דקורציה ─────────────────────────────────────────
  let background = ''

  // רקע תמונה אם יש; אחרת — מדרג צבע מהפלטה הנוכחית.
  if (bg) {
    background = `<image href="${bg.dataUrl}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
  } else {
    background = `<defs><linearGradient id="bg-grad-${fxUid}" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${palette.bg}"/>` +
      `<stop offset="1" stop-color="${palette.bgDeep}"/>` +
      `</linearGradient></defs>` +
      `<rect width="${W}" height="${H}" fill="url(#bg-grad-${fxUid})"/>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet">
  <defs><style>${buildFontFace(font.id)}</style>${fx.defs}${extraDefs}</defs>
  ${background}

  <g transform="translate(0, ${offsetYText})">
    ${fx.content}${extraContent}
  </g>

  <!-- שם המאחל — מוצג מעל הכיתוב השיווקי, עם קו-מתאר לבן לקריאות על כל רקע -->
  ${cardName ? `<text x="${W / 2}" y="${H - 80}"
        font-family="${font.css}" font-size="28" font-weight="700"
        fill="#1B1B1B" stroke="#FFFFFF" stroke-width="4" paint-order="stroke"
        stroke-linejoin="round" text-anchor="middle"
        direction="rtl">${escapeXML(senderVerb)}: ${escapeXML(cardName)}</text>` : ''}

  <!-- כיתוב שיווקי — קבוע בתחתית, לא זז עם הגרירה.
       כתב שחור עם קו-מתאר לבן (paint-order=stroke) כדי שיהיה קריא על כל רקע. -->
  <text x="${W / 2}" y="${H - 40}"
        font-family="'Heebo', sans-serif" font-size="21" font-weight="600"
        fill="#1B1B1B" stroke="#FFFFFF" stroke-width="4" paint-order="stroke"
        stroke-linejoin="round" text-anchor="middle"
        direction="rtl" letter-spacing="0.5">ברכה זו נוצרה באמצעות אפליקציית ביחד</text>
</svg>`
}

// ── עזר ──────────────────────────────────────────────────────
function wrapText(text, maxChars) {
  const rawWords = text.split(/\s+/).filter(Boolean)
  if (rawWords.length === 0) return ['']
  const words = []
  for (const w of rawWords) {
    if (w.length <= maxChars) words.push(w)
    else for (let i = 0; i < w.length; i += maxChars) words.push(w.slice(i, i + maxChars))
  }
  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? current + ' ' + word : word
    if (candidate.length > maxChars && current) { lines.push(current); current = word }
    else current = candidate
  }
  if (current) lines.push(current)
  return lines
}

function escapeXML(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── צבע אקראי קריא ──
// גוון אקראי עם רוויה/בהירות בטווח קריא (לא בהיר/כהה מדי),
// כך שהטקסט נשאר ברור. avoid = הצבע הנוכחי (כדי לא להגריל אותו שוב).
function hslToHex(h, s, l) {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = n => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * c).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function randomReadableColor(avoid) {
  let hex = ''
  for (let i = 0; i < 5; i++) {
    const hue = Math.floor(Math.random() * 360)
    const sat = 55 + Math.floor(Math.random() * 25)    // 55–80%
    const light = 38 + Math.floor(Math.random() * 16)  // 38–53%
    hex = hslToHex(hue, sat, light)
    if (!avoid || hex.toLowerCase() !== String(avoid).toLowerCase()) break
  }
  return hex
}

// ═════════════════════════════════════════════════════════════════
// בונה SVG לכרטיס — כל בלוק טקסט במיקום העצמאי שלו (מרכז X,Y מחושב ב-DesignStep).
// מצייר גם מסגרת בחירה מקווקות סביב הבלוק הנבחר (לתצוגה בלבד — לא נכנסת ל-PNG).
// השם והכיתוב השיווקי קבועים בתחתית (לא נגררים).
// ═════════════════════════════════════════════════════════════════
function buildCardSVG({ blocks, selected, cardName, senderVerb = 'מאחל', palette, font, bg, ink, effId }) {
  const W = 1080, H = 1080
  const fxUid = Math.random().toString(36).slice(2, 8)

  // רקע: תמונה אם יש, אחרת מדרג צבע
  let bgDefs = '', background = ''
  if (bg) {
    background = `<image href="${bg.dataUrl}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
  } else {
    bgDefs = `<linearGradient id="bg-grad-${fxUid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${palette.bg}"/><stop offset="1" stop-color="${palette.bgDeep}"/></linearGradient>`
    background = `<rect width="${W}" height="${H}" fill="url(#bg-grad-${fxUid})"/>`
  }

  // כל בלוק טקסט במיקומו
  let defs = '', body = '', selRect = ''
  blocks.forEach((b, bi) => {
    const tspans = b.lines.map((ln, i) =>
      `<tspan x="${b.centerX}" y="${b.firstLineY + i * b.lineHeight}">${escapeXML(ln)}</tspan>`
    ).join('')
    const fx = buildTextWithEffect({
      effectId: effId, textLines: tspans, fontCss: font.css, fontWeight: font.weight,
      fontSize: b.fontPx, fill: ink, uid: `${fxUid}-${bi}`,
    })
    defs += fx.defs
    body += fx.content
    const key = b.kind === 'main' ? 'main' : b.idx
    if (selected === key) {
      const pad = 18
      const rx = Math.max(6, b.centerX - b.halfW - pad)
      const ry = b.centerY - b.blockHeight / 2 - pad
      selRect = `<rect x="${rx}" y="${ry}" width="${b.halfW * 2 + pad * 2}" height="${b.blockHeight + pad * 2}" rx="14" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-dasharray="14 10" opacity="0.85"/>`
    }
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet">
  <defs><style>${buildFontFace(font.id)}</style>${bgDefs}${defs}</defs>
  ${background}
  ${body}
  ${selRect}

  ${cardName ? (() => {
    const fs = 28, by = H - 80
    const w = Math.min(W - 60, (senderVerb + ': ' + cardName).length * fs * 0.58 + fs * 1.6)
    const h = Math.round(fs * 1.7), py = Math.round((by - fs * 0.33) - h / 2), px = Math.round(W / 2 - w / 2)
    return `<rect x="${px}" y="${py}" width="${Math.round(w)}" height="${h}" rx="${Math.round(h / 2)}" fill="#FBF7EE" fill-opacity="0.82"/>
  <text x="${W / 2}" y="${by}" font-family="'M PLUS Rounded 1c', sans-serif" font-size="${fs}" font-weight="700" fill="#1B1B1B" text-anchor="middle" direction="rtl">${escapeXML(senderVerb)}: ${escapeXML(cardName)}</text>`
  })() : ''}

  ${(() => {
    const credit = 'ברכה זו נוצרה באמצעות אפליקציית ביחד'
    const fs = 21, by = H - 40
    const w = Math.min(W - 50, credit.length * fs * 0.5 + fs * 1.8)
    const h = Math.round(fs * 1.7), py = Math.round((by - fs * 0.33) - h / 2), px = Math.round(W / 2 - w / 2)
    return `<rect x="${px}" y="${py}" width="${Math.round(w)}" height="${h}" rx="${Math.round(h / 2)}" fill="#181210" fill-opacity="0.46"/>
  <text x="${W / 2}" y="${by}" font-family="'Huninn', sans-serif" font-size="${fs}" font-weight="600" fill="#FBF7EE" text-anchor="middle" direction="rtl" letter-spacing="0.5">${credit}</text>`
  })()}
</svg>`
}

// ════════ מסך כניסה + מסך המאגר (ברכה מהירה) ════════
// שיתוף/שמירה של תמונת ברכה מוכנה (קובץ סטטי)
async function shareReadyImage(url) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const r = await shareImageBlob(blob, 'ברכה.jpg', 'ברכה מאפליקציית ביחד')
    if (r.ok || r.notSupported === false) return
  } catch (e) { if (e?.name === 'AbortError') return }
  downloadReadyImage(url)
}
async function downloadReadyImage(url) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    await saveImageBlob(blob, 'ברכה.jpg')
  } catch (e) {
    // גיבוי אחרון — הורדת דפדפן ישירה
    const a = document.createElement('a')
    a.href = url; a.download = 'ברכה.jpg'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }
}

// טעינת תמונה
function loadImg(src) {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => resolve(im)
    im.onerror = reject
    im.src = src
  })
}

// מרכיב תמונת מאגר + שכבות שלנו: שם המאחל (אופציונלי) + קרדיט (תמיד)
async function composeReadyImage(url, senderLine) {
  const img = await loadImg(url)
  const W = img.naturalWidth || 1024
  const H = img.naturalHeight || 1024
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, W, H)

  const scale = W / 1080
  injectAllFonts()
  try {
    await document.fonts.load(`700 ${Math.round(28 * scale)}px 'M PLUS Rounded 1c'`, 'מאחל')
    await document.fonts.load(`600 ${Math.round(21 * scale)}px 'Huninn'`, 'ברכה')
    await document.fonts.ready
  } catch (e) { /* ממשיכים */ }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.direction = 'rtl'

  // שם המאחל (אם מוצג)
  if (senderLine) {
    const sf = Math.round(28 * scale)
    ctx.font = `700 ${sf}px "M PLUS Rounded 1c", sans-serif`
    const sw = ctx.measureText(senderLine).width
    drawPill(ctx, W / 2, H - Math.round(80 * scale), sw, sf, 'rgba(251,247,238,0.82)')
    ctx.fillStyle = '#1B1B1B'
    ctx.fillText(senderLine, W / 2, H - Math.round(80 * scale))
  }

  // קרדיט שיווקי (תמיד)
  const credit = 'ברכה זו נוצרה באמצעות אפליקציית ביחד'
  const cf = Math.round(21 * scale)
  ctx.font = `600 ${cf}px "Huninn", sans-serif`
  const cw = ctx.measureText(credit).width
  drawPill(ctx, W / 2, H - Math.round(40 * scale), cw, cf, 'rgba(24,18,16,0.46)')
  ctx.fillStyle = '#FBF7EE'
  ctx.fillText(credit, W / 2, H - Math.round(40 * scale))

  // JPEG (לא PNG) — לתמונה צילומית זה קטן ומהיר במידה רבה מ-PNG,
  // וכך השמירה/שיתוף/הצגת השם מהירים בהרבה (במיוחד באפליקציה).
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
  const blob = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.9))
  return { dataUrl, blob }
}

// צופה תמונה מוכנה — מרכיב את השכבות שלנו, מציג תצוגה מקדימה, ומאפשר שיתוף/שמירה
function ReadyViewer({ url, senderName, senderVerb, onBack, backLabel = '← חזרה לגלריה', footerControls = null }) {
  const [showSender, setShowSender] = useState(true)
  const [busy, setBusy] = useState(false)
  const [composed, setComposed] = useState(null)
  const blobRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setComposed(null); blobRef.current = null
    const senderLine = (showSender && senderName) ? `${senderVerb}: ${senderName}` : ''
    composeReadyImage(url, senderLine)
      .then(({ dataUrl, blob }) => { if (!cancelled) { setComposed(dataUrl); blobRef.current = blob } })
      .catch(() => { if (!cancelled) { setComposed(url); blobRef.current = null } })
    return () => { cancelled = true }
  }, [url, showSender, senderName, senderVerb])

  const doShare = async () => {
    setBusy(true)
    try {
      const blob = blobRef.current
      if (blob) {
        const res = await shareImageBlob(blob, 'ברכה.jpg', 'ברכה מאפליקציית ביחד')
        if (!res.ok && res.notSupported) await shareReadyImage(url)
      } else {
        await shareReadyImage(url)
      }
    } catch (e) { if (e?.name !== 'AbortError') console.error(e) }
    setBusy(false)
  }

  const doSave = async () => {
    if (blobRef.current) {
      await saveImageBlob(blobRef.current, 'ברכה.jpg')
    } else {
      downloadReadyImage(url)
    }
  }

  return (
    <div style={{ padding: '8px 16px 32px' }}>
      <img src={composed || url} alt="" style={{ width: '100%', borderRadius: 16, display: 'block', boxShadow: 'var(--shadow-md)' }} />
      {senderName ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 2px 8px', fontSize: 16, fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showSender} onChange={e => setShowSender(e.target.checked)} style={{ width: 20, height: 20 }} />
          להציג את שמי כמאחל ({senderName})
        </label>
      ) : null}
      <div style={{ display: 'flex', gap: 10, marginTop: senderName ? 6 : 16 }}>
        <button className="big-btn big-btn--primary" disabled={busy || !composed} style={{ flex: 1, opacity: (busy || !composed) ? 0.6 : 1 }} onClick={doShare}>
          שיתוף
        </button>
        <button className="big-btn" disabled={!composed} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)', opacity: composed ? 1 : 0.6 }} onClick={doSave}>
          שמירה
        </button>
      </div>
      {footerControls}
      <button onClick={onBack} style={{ marginTop: 14, width: '100%', background: 'none', border: 'none', color: 'var(--ink-2)', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', padding: 10, cursor: 'pointer' }}>
        {backLabel}
      </button>
    </div>
  )
}

// כרטיס בחירה בסגנון המתכונים — תמונת שער + שכבת גרדיאנט כהה + כותרת/תיאור.
// אם התמונה חסרה/נכשלת — נופלים יפה לגרדיאנט הצבע (fallbackGrad) עם אייקון.
function ChooseCard({ img, fallbackGrad, icon, title, subtitle, onClick }) {
  const [imgOk, setImgOk] = useState(Boolean(img))
  const showImg = img && imgOk
  return (
    <button onClick={onClick} style={{
      border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
      borderRadius: 20, overflow: 'hidden', position: 'relative',
      width: '100%', aspectRatio: '1 / 1.08', boxShadow: 'var(--shadow-md)',
      background: fallbackGrad, display: 'block',
    }}>
      {showImg && (
        <img
          src={img}
          alt={title}
          loading="lazy"
          onError={() => setImgOk(false)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {/* שכבת כהה תחתונה לקריאות + תוכן (מסודר בטור) */}
      <div style={{
        position: 'absolute', inset: 0, padding: '16px 16px',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 6, textAlign: 'right',
        background: showImg
          ? 'linear-gradient(to top, rgba(20,23,42,.85) 0%, rgba(20,23,42,.3) 50%, rgba(20,23,42,0) 100%)'
          : 'linear-gradient(to top, rgba(20,23,42,.34) 0%, rgba(20,23,42,0) 60%)',
      }}>
        <span style={{ display: 'block', color: '#fff', fontSize: 19, fontWeight: 900, lineHeight: 1.2, textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>{title}</span>
        <span style={{ display: 'block', color: 'rgba(255,255,255,.92)', fontSize: 13, fontWeight: 600, lineHeight: 1.35, textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>{subtitle}</span>
      </div>
    </button>
  )
}

// אייקון קו קטן לכל קבוצה (ימים=שמש, חגים=להבה, איחולים=פרח)
function GroupIcon({ id }) {
  const p = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flexShrink: 0 } }
  if (id === 'days') return (
    <svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
    </svg>
  )
  if (id === 'holidays') return (
    <svg {...p}>
      <path d="M12 3c1.2 2.5 4 3.8 4 7.5A4 4 0 0 1 8 10.5C8 9 8.7 8 9.5 7.3c.3 1 1.2 1.7 1.8 1.7C10.5 7 10.8 4.8 12 3Z" />
    </svg>
  )
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="12" cy="6.6" r="2" />
      <circle cx="12" cy="17.4" r="2" />
      <circle cx="6.6" cy="12" r="2" />
      <circle cx="17.4" cy="12" r="2" />
    </svg>
  )
}

function ChooseStep({ onDesign, onReady }) {
  // אייקונים לבנים גדולים (אותם אייקונים כמו קודם, בלבן על התמונה)
  const sparkleIcon = (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z" />
      <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
    </svg>
  )
  const paletteIcon = (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".7" fill="#fff" stroke="none" />
      <circle cx="17.5" cy="10.5" r=".7" fill="#fff" stroke="none" />
      <circle cx="8.5" cy="7.5" r=".7" fill="#fff" stroke="none" />
      <circle cx="6.5" cy="12.5" r=".7" fill="#fff" stroke="none" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.83-.44-1.12-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67H16c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z" />
    </svg>
  )
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '12px 20px 32px' }}>
      <p style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 14px', fontWeight: 500 }}>
        איך תרצו ליצור את הברכה?
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <ChooseCard
        onClick={onReady}
        img="/choose/bank.jpg"
        fallbackGrad="linear-gradient(135deg,#7E2C2E,#5A1D1E)"
        title="ברכה מהירה מהמאגר"
        subtitle="בוחרים אירוע ובוחרים ברכה יפה ומוכנה לשיתוף"
      />
      <ChooseCard
        onClick={onDesign}
        img="/choose/design.jpg"
        fallbackGrad="linear-gradient(135deg,#2C5566,#173846)"
        title="ברכה בעיצוב אישי"
        subtitle="כותבים ומעצבים בעצמכם — טקסט, רקע, צבעים"
      />
      </div>
    </div>
  )
}

// גלריית האופציה האקראית לקטגוריה — מציגה ברכה אחת אקראית בכל פעם,
// עם כפתור "תראה לי עוד אופציה", מגבלת 3 ליום (ללא פרימיום),
// ניווט בין האופציות שכבר הוצגו, והצעת מעבר לעיצוב אישי.
function OccasionGallery({ occ, count, isPremium, savedShown, senderName, senderVerb, onPersist, onBackToList, onCreatePersonal }) {
  const DAILY_LIMIT = 3
  // shown = אינדקסים (1-based) שכבר הוצגו היום. null = עוד לא הוצגה הראשונה.
  const [shown, setShown] = useState(() => (savedShown && savedShown.length) ? savedShown.slice() : null)
  const [pos, setPos] = useState(() => (savedShown && savedShown.length) ? savedShown.length - 1 : 0)

  // בוחר אינדקס חדש אקראי שלא הוצג עדיין; null אם נגמרו התמונות
  const pickNew = (current) => {
    if (!count || count <= 0) return null
    const used = new Set(current)
    if (used.size >= count) return null
    let idx = 0, guard = 0
    do { idx = 1 + Math.floor(Math.random() * count); guard++ } while (used.has(idx) && guard < 60)
    return used.has(idx) ? null : idx
  }

  // חשיפת האופציה הראשונה בכניסה (אם עוד לא הוצגה היום). תלוי ב-count
  // כדי לעבוד גם כשה-manifest נטען אחרי הרנדור הראשון.
  useEffect(() => {
    if (shown !== null) return
    if (!count || count <= 0) return
    const first = pickNew([])
    if (first == null) return
    const arr = [first]
    setShown(arr); setPos(0)
    if (!isPremium) onPersist(occ.id, arr)
  }, [count])

  const revealed = shown ? shown.length : 0
  const limitReached = !isPremium && revealed >= DAILY_LIMIT
  const noMore = count > 0 && revealed >= count
  const canMore = !limitReached && !noMore

  const showAnother = () => {
    if (!canMore || !shown) return
    const idx = pickNew(shown)
    if (idx == null) return
    const arr = [...shown, idx]
    setShown(arr); setPos(arr.length - 1)
    if (!isPremium) onPersist(occ.id, arr)
  }

  const navBtn = (disabled) => ({
    padding: '8px 14px', borderRadius: 10, border: '1px solid var(--line)',
    background: 'var(--surface)', color: disabled ? 'var(--ink-3)' : 'var(--ink)',
    fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
  })

  if (count === 0) {
    return (
      <div style={{ padding: '8px 16px 32px' }}>
        <button onClick={onBackToList} style={{ background: 'none', border: 'none', color: 'var(--ink-2)', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', padding: '4px 0 14px', cursor: 'pointer' }}>
          ← {occ.label}
        </button>
        <p style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 17, fontWeight: 600, padding: '50px 16px', lineHeight: 1.6 }}>
          ברכות לקטגוריה זו יתווספו בקרוב
        </p>
      </div>
    )
  }
  if (!shown) return null

  const url = `/ready/${occ.id}/${shown[pos]}.jpg`

  const controls = (
    <div style={{ marginTop: 16 }}>
      {/* ניווט בין האופציות שכבר הוצגו */}
      {shown.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
          <button onClick={() => setPos(p => Math.max(0, p - 1))} disabled={pos === 0} style={navBtn(pos === 0)}>‹ הקודמת</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)' }}>{pos + 1} / {shown.length}</span>
          <button onClick={() => setPos(p => Math.min(shown.length - 1, p + 1))} disabled={pos === shown.length - 1} style={navBtn(pos === shown.length - 1)}>הבאה ›</button>
        </div>
      )}

      {/* כפתור עוד אופציה */}
      {canMore && (
        <button onClick={showAnother} className="big-btn" style={{ width: '100%', background: 'var(--surface)', border: '1.5px solid var(--burgundy)', color: 'var(--burgundy)' }}>
          🔀 תראה לי עוד אופציה{!isPremium ? ` · ${DAILY_LIMIT - revealed} נותרו היום` : ''}
        </button>
      )}

      {/* הגעת לסף היומי — הצעה לעיצוב אישי */}
      {limitReached && (
        <div style={{ marginTop: 4, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>הגעת לסף היומי</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 14 }}>
            ראית 3 ברכות בקטגוריה זו היום. לא אהבת? אפשר ליצור ברכה אישית ומיוחדת משלך.
          </div>
          <button onClick={() => onCreatePersonal(occ)} className="big-btn big-btn--primary" style={{ width: '100%' }}>
            קח אותי לשם ←
          </button>
        </div>
      )}
    </div>
  )

  return (
    <ReadyViewer
      url={url}
      senderName={senderName}
      senderVerb={senderVerb}
      onBack={onBackToList}
      backLabel={`← ${occ.label}`}
      footerControls={controls}
    />
  )
}

function BankStep({ senderName, senderVerb, isPremium, quotaCats, onPersistQuota, onCreatePersonal }) {
  const [groupId, setGroupId] = useState('days')
  const [occ, setOcc] = useState(null)        // אירוע שנבחר ואושר → גלריה
  const [selectedOcc, setSelectedOcc] = useState(null) // אירוע מסומן (לפני לחיצת המשך)
  const [counts, setCounts] = useState({})    // כמה תמונות יש בכל אירוע (מ-manifest)
  const occasions = occasionsByGroup(groupId)
  const autoRef = useRef(false)               // בחירת היום האוטומטית — פעם אחת

  useEffect(() => {
    fetch('/ready/manifest.json')
      .then(r => r.json())
      .then(data => {
        setCounts(data)
        // בחירת היום אוטומטית — מסמן את הקבוצה והאירוע של היום
        // (ללא פתיחת הגלריה — כמו בעיצוב אישי שמנחת על היום)
        if (!autoRef.current) {
          autoRef.current = true
          const todayId = getOccasion().id
          const todayOcc = todayId ? findOccasion(todayId) : null
          if (todayOcc) { setGroupId(todayOcc.group); setSelectedOcc(todayOcc) }
        }
      })
      .catch(() => {})
  }, [])

  // ── גלריית האופציה האקראית לאירוע ──
  if (occ) {
    const n = counts[occ.id] ?? (occ.readyCount || 0)
    return (
      <OccasionGallery
        occ={occ}
        count={n}
        isPremium={isPremium}
        savedShown={(quotaCats && quotaCats[occ.id]) || []}
        senderName={senderName}
        senderVerb={senderVerb}
        onPersist={onPersistQuota}
        onBackToList={() => setOcc(null)}
        onCreatePersonal={onCreatePersonal}
      />
    )
  }

  // ── בחירת קבוצה + אירוע ──
  return (
    <div style={{ padding: '8px 20px 36px' }}>
      <p style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 14px', fontWeight: 500 }}>
        בחרו את סוג הברכה:
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {GREETING_GROUPS.map(g => (
          <button key={g.id} onClick={() => { setGroupId(g.id); setSelectedOcc(null) }} style={{
            flex: 1, padding: '12px 8px', borderRadius: 12,
            background: groupId === g.id ? 'var(--burgundy)' : 'var(--surface)',
            color: groupId === g.id ? 'white' : 'var(--ink-2)',
            border: groupId === g.id ? 'none' : '1px solid var(--line)',
            fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {g.label}
            </span>
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {occasions.map(o => {
          const isSel = selectedOcc?.id === o.id
          return (
          <button key={o.id} onClick={() => setSelectedOcc(o)} style={{
            padding: '18px 12px', borderRadius: 14,
            background: isSel ? 'var(--burgundy-soft)' : 'var(--surface)',
            border: isSel ? '2px solid var(--burgundy)' : '1px solid var(--line)',
            color: isSel ? 'var(--burgundy)' : 'var(--ink)', fontSize: 17, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
          }}>{o.label}</button>
          )
        })}
      </div>

      {/* כפתור המשך — פותח את הגלריה של האירוע המסומן */}
      <button
        onClick={() => { if (selectedOcc) setOcc(selectedOcc) }}
        disabled={!selectedOcc}
        className="big-btn big-btn--primary"
        style={{ width: '100%', marginTop: 20, opacity: selectedOcc ? 1 : 0.5 }}
      >
        המשך ←
      </button>
    </div>
  )
}
