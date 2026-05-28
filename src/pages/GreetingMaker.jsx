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
import { IconBackRTL, IconTemplates, IconBackground, IconText, IconSender, IconFont, IconEffects, IconColor, IconSize } from '../icons/index.jsx'
import { GREETING_FONTS } from '../greetingFonts.js'

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
  { dir: 'SHABAT', label: 'שבת שלום', count: 10, ext: 'png', match: ['שבת'],
    textZone: 'top', ink: '#5A3D2B', accent: '#B89048' },
  { dir: 'SHAVUA TOV', label: 'שבוע טוב', count: 5, ext: 'png', match: ['שבוע טוב', 'יום ראשון'],
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
export default function GreetingMaker({ onBack }) {
  const { profile } = useUserStore()
  const [step, setStep] = useState('text')

  const [text, setText] = useState('')

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

  const goBack = () => step === 'design' ? setStep('text') : onBack()

  // מרכיב את השם מהפרופיל — שם פרטי + שם משפחה (אם יש)
  const senderName = (() => {
    if (!profile) return ''
    const first = (profile.name || '').trim()
    const last = (profile.lastName || '').trim()
    return [first, last].filter(Boolean).join(' ')
  })()

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      {step === 'text' ? (
        <>
          <div className="screen-header">
            <button className="screen-header__back" onClick={goBack} aria-label="חזרה">
              <IconBackRTL size={24} color="#1B2540" />
            </button>
            <div className="screen-header__title">ברכה אישית</div>
          </div>
          <div style={{ padding: '8px 20px 32px' }}>
            <TextStep
              text={text} setText={setText}
              onNext={() => setStep('design')}
            />
          </div>
        </>
      ) : (
        <DesignStep
          onBack={goBack}
          text={text} setText={setText}
          senderName={senderName}
          showSender={showSender} setShowSender={setShowSender}
          templateId={templateId} setTemplateId={setTemplateId}
          paletteId={paletteId} setPaletteId={setPaletteId}
          fontId={fontId} setFontId={setFontId}
          sizeId={sizeId} setSizeId={setSizeId}
          effectId={effectId} setEffectId={setEffectId}
          textColorId={textColorId} setTextColorId={setTextColorId}
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
  onBack, text, setText, senderName, setSenderName,
  templateId, setTemplateId,
  paletteId, setPaletteId, fontId, setFontId, sizeId, setSizeId,
  effectId, setEffectId, textColorId, setTextColorId,
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  // איזו לשונית פתוחה ב-bottom sheet (null = סגור)
  const [activeTab, setActiveTab] = useState(null)

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
  const textColor = TEXT_COLORS.find(c => c.id === textColorId) || TEXT_COLORS[0]
  const tpl = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0]
  // השם אופציונלי — אם ריק, לא מופיע כלל בכרטיס
  const cardName = senderName.trim()

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
  }, [])

  // היסט אנכי נפרד לטקסט הראשי ולשם (בפיקסלי SVG, טווח 1080)
  const [offsetYText, setOffsetYText] = useState(0)
  const [offsetYName, setOffsetYName] = useState(0)
  const [dragTarget, setDragTarget] = useState('text')

  // כשמחליפים תבנית/רקע — מאפסים את שני ההיסטים
  useEffect(() => { setOffsetYText(0); setOffsetYName(0) }, [templateId, bgId])

  // ── גרירה ──────────────────────────────────────
  // שתי ידיות נפרדות: אחת לטקסט הראשי, אחת לשם.
  // לחיצה בחצי העליון של הכרטיס = גוררים את הטקסט,
  // בחצי התחתון = גוררים את השם.
  const previewRef = useRef(null)
  const dragRef = useRef(null)

  const clampOffset = (v) => Math.max(-380, Math.min(380, v))

  const onDragStart = (clientY) => {
    dragRef.current = {
      startY: clientY,
      startOffset: dragTarget === 'name' ? offsetYName : offsetYText,
    }
  }
  const onDragMove = (clientY) => {
    if (!dragRef.current || !previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    const scale = 1080 / rect.height
    const deltaPx = (clientY - dragRef.current.startY) * scale
    const next = clampOffset(dragRef.current.startOffset + deltaPx)
    if (dragTarget === 'name') setOffsetYName(next)
    else setOffsetYText(next)
  }
  const onDragEnd = () => { dragRef.current = null }

  const svg = buildSVG({ text, cardName, tpl, palette, font, size, bg, offsetYText, offsetYName, effect, textColor })

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
    const len = text.trim().length
    let bigFont = len > 80 ? 50 : len > 50 ? 60 : len > 26 ? 72 : len > 16 ? 88 : 104
    bigFont = Math.round(bigFont * size.scale)
    const maxCharsPerLine = Math.floor(760 / (bigFont * 0.56))
    const lines = wrapText(text.trim(), maxCharsPerLine)
    let actualFont = bigFont
    if (lines.length > 4) actualFont = Math.max(40, bigFont - (lines.length - 4) * 8)
    const lineHeight = actualFont * 1.32
    const blockHeight = lines.length * lineHeight

    // מיקום אנכי לפי textZone
    const zone = (tpl && tpl.textZone) || 'center'
    const centerY = zone === 'top'    ? H * 0.27
                  : zone === 'bottom' ? H * 0.72
                  : H * 0.50
    const firstLineY = centerY - blockHeight / 2 + lineHeight / 2 + offsetYText

    // צבע הטקסט
    const baseInk = bg ? bg.ink : palette.ink
    const ink = (textColor && textColor.hex) ? textColor.hex : baseInk

    // המשפחת הפונט ל-Canvas
    const fam = (font.css.match(/'([^']+)'/) || [])[1] || font.css
    ctx.font = `${font.weight} ${actualFont}px "${fam}", serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.direction = 'rtl'

    // מצייר כל שורה עם האפקט המתאים
    const effId = (effect && effect.id) || 'none'
    lines.forEach((ln, i) => {
      const x = W / 2
      const y = firstLineY + i * lineHeight
      drawTextWithEffect(ctx, ln, x, y, ink, effId, actualFont)
    })

    // ── שם המאחל + קו מפריד ──
    if (cardName) {
      const dividerY = firstLineY + (lines.length - 1) * lineHeight + actualFont * 0.85 + offsetYName
      const senderY = dividerY + 70
      const accent = bg ? bg.accent : palette.accent

      // קו
      ctx.strokeStyle = accent
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.8
      ctx.beginPath()
      ctx.moveTo(W / 2 - 120, dividerY)
      ctx.lineTo(W / 2 + 120, dividerY)
      ctx.stroke()
      ctx.globalAlpha = 1

      // שם — עטוף לשורות אם ארוך
      ctx.font = `${Math.min(font.weight, 700)} 40px "${fam}", serif`
      ctx.fillStyle = ink
      ctx.globalAlpha = 0.92
      const nameLines = wrapText(cardName, 26)
      nameLines.forEach((ln, i) => {
        ctx.fillText(ln, W / 2, senderY + i * 50)
      })
      ctx.globalAlpha = 1
    }

    // ── כיתוב שיווקי ──
    ctx.font = '600 21px "Heebo", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#1B1B1B'
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 4
    ctx.lineJoin = 'round'
    ctx.strokeText('ברכה זו נוצרה באמצעות אפליקציית ביחד', W / 2, H - 48)
    ctx.fillText('ברכה זו נוצרה באמצעות אפליקציית ביחד', W / 2, H - 48)

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
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'ברכה-אישית.png'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMsg('✓ נשמר!')
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
      const file = new File([blob], 'ברכה-אישית.png', { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: text, text })
      } else if (navigator.share) {
        await navigator.share({ title: text, text })
      } else {
        const t = encodeURIComponent(text + '\n\nנוצר באמצעות אפליקציית ביחד')
        window.open(`https://wa.me/?text=${t}`, '_blank')
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
    { id: 'sender',    label: 'שם המאחל', Icon: IconSender },
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
          📲 שתף
        </button>
        <button onClick={handleSave} disabled={busy} aria-label="שמור" style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'var(--surface)', border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 18,
          opacity: busy ? 0.6 : 1,
        }}>
          📥
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
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); onDragStart(e.clientY) }}
          onPointerMove={e => onDragMove(e.clientY)}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
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

      {/* בורר — מה גוררים: הברכה או השם */}
      <div style={{
        flexShrink: 0, display: 'flex', gap: 8, justifyContent: 'center',
        alignItems: 'center', padding: '0 16px 8px',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>
          גרורו למיקום:
        </span>
        <button onClick={() => setDragTarget('text')} style={{
          padding: '7px 16px', borderRadius: 10,
          background: dragTarget === 'text' ? 'var(--burgundy)' : 'var(--surface)',
          color: dragTarget === 'text' ? 'white' : 'var(--ink)',
          border: dragTarget === 'text' ? 'none' : '1px solid var(--line)',
          fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
        }}>
          📝 הברכה
        </button>
        {cardName && (
          <button onClick={() => setDragTarget('name')} style={{
            padding: '7px 16px', borderRadius: 10,
            background: dragTarget === 'name' ? 'var(--burgundy)' : 'var(--surface)',
            color: dragTarget === 'name' ? 'white' : 'var(--ink)',
            border: dragTarget === 'name' ? 'none' : '1px solid var(--line)',
            fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
          }}>
            👤 השם
          </button>
        )}
      </div>

      {/* ─── סרגל לשוניות תחתון ─── */}
      <div style={{
        flexShrink: 0,
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
      {activeTab && (
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
            </div>
          )}

          {activeTab === 'sender' && (
            <div style={{ width: '100%' }}>
              <input
                value={senderName}
                onChange={e => setSenderName(e.target.value.slice(0, MAX_NAME))}
                maxLength={MAX_NAME}
                placeholder="השם שלך"
                style={{
                  width: '100%', fontSize: 16, fontFamily: 'inherit',
                  padding: '12px 14px', borderRadius: 10,
                  border: '1.5px solid var(--line-strong)',
                  background: 'var(--bg-app)', color: 'var(--ink)',
                  direction: 'rtl',
                }}
              />
              <div style={{
                textAlign: 'left', fontSize: 12, fontWeight: 600, marginTop: 4,
                color: senderName.length >= MAX_NAME ? 'var(--burgundy)' : 'var(--ink-3)',
              }}>
                {senderName.length} / {MAX_NAME}
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
              {TEXT_COLORS.map(c => (
                <button key={c.id} onClick={() => setTextColorId(c.id)} aria-label={c.name} style={{
                  padding: 0,
                  background: c.hex || 'conic-gradient(from 0deg, #FF6B6B, #FFD93D, #6BCB77, #4D96FF, #B86BFF, #FF6B6B)',
                  border: c.id === textColorId ? '3px solid var(--ink)' : '2px solid var(--line)',
                  borderRadius: 14, cursor: 'pointer',
                  width: 56, height: 56, flexShrink: 0,
                  position: 'relative',
                }}>
                  {c.id === 'auto' && (
                    <span style={{
                      position: 'absolute', inset: 0, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, color: 'white',
                      textShadow: '0 1px 2px rgba(0,0,0,.5)',
                    }}>אוטו</span>
                  )}
                </button>
              ))}
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
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// EditStrip — רצועה קטנה מעל הסרגל, לא מכסה את התצוגה
// ═══════════════════════════════════════════════════════════════
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

function buildSVG({ text, cardName, tpl, palette, font, size, bg, offsetYText = 0, offsetYName = 0, effect, textColor }) {
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

  const dividerY = firstLineY + (lines.length - 1) * lineHeight + bigFont * 0.85
  const senderY = dividerY + 70

  // בונה את שכבת הטקסט לפי האפקט הנבחר (uid ייחודי ל-id הפילטר)
  const effId = (effect && effect.id) || 'none'
  const fxUid = Math.random().toString(36).slice(2, 8)
  const fx = buildTextWithEffect({
    effectId: effId, textLines, fontCss: font.css, fontWeight: font.weight,
    fontSize: bigFont, fill: ink, uid: fxUid,
  })

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

  // ── עטיפת שם המאחל לשורות אם ארוך ──────────────────────────────
  // שם גדול עלול לברוח מהכרטיס — מגבילים את הרוחב הזמין ועוטפים לשורות לפי הצורך.
  const nameMaxChars = 26
  const nameLines = cardName ? wrapText(cardName, nameMaxChars) : []
  const nameLineHeight = 50
  const nameTspans = nameLines.map((ln, i) =>
    `<tspan x="${W / 2}" y="${senderY + i * nameLineHeight}">${escapeXML(ln)}</tspan>`
  ).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet">
  <defs><style>${buildFontFace(font.id)}</style>${fx.defs}</defs>
  ${background}

  <g transform="translate(0, ${offsetYText})">
    ${fx.content}
  </g>

  <!-- בלוק השם הנגרר (קו מפריד + שם) — נגרר בנפרד -->
  ${cardName ? `<g transform="translate(0, ${offsetYName})">
    <line x1="${W / 2 - 120}" y1="${dividerY}" x2="${W / 2 + 120}" y2="${dividerY}"
          stroke="${accent}" stroke-width="2" opacity="0.8"/>
    <text font-family="${font.css}"
          font-size="40" font-weight="${Math.min(font.weight, 700)}" fill="${ink}" text-anchor="middle"
          direction="rtl" opacity="0.92">${nameTspans}</text>
  </g>` : ''}

  <!-- כיתוב שיווקי — קבוע בתחתית, לא זז עם הגרירה.
       כתב שחור עם קו-מתאר לבן (paint-order=stroke) כדי שיהיה קריא על כל רקע. -->
  <text x="${W / 2}" y="${H - 48}"
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
