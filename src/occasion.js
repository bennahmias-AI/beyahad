// src/occasion.js
// ─────────────────────────────────────────────────────────────
// מזהה את "ההזדמנות" של היום — חג עברי או יום בשבוע — ומחזיר
// טקסט ברכה מוצע + תווית קצרה למסך הבית.
// ללא תלות חיצונית: משתמש בלוח השנה העברי המובנה של הדפדפן (Intl)
// לזיהוי החג, ובימות השבוע הרגילים אחרת.
//
// getOccasion(date) → { label, text, isHoliday }
//   label  — תווית קצרה למסך הבית, למשל "ליום ראשון" / "לסוכות"
//   text   — טקסט הברכה המוצע למחולל, למשל "יום ראשון מבורך"
//   isHoliday — האם זוהה חג (true) או יום רגיל (false)
//
// הערה: הלוח העברי מתחיל בשקיעה; כאן ההמרה לפי תאריך אזרחי (חצות),
// כך שערב חג עשוי להופיע מהבוקר של אותו יום אזרחי — מספיק טוב להצעה.
// ─────────────────────────────────────────────────────────────

// ברכות לפי יום בשבוע (0=ראשון ... 6=שבת)
const WEEKDAY = [
  { id: 'YOM_RISHON',   label: 'ליום ראשון', text: 'יום ראשון מבורך' },
  { id: 'YOM_SHENI',    label: 'ליום שני', text: 'יום שני מבורך' },
  { id: 'YOM_SHLISHI',  label: 'ליום שלישי', text: 'יום שלישי מבורך' },
  { id: 'YOM_RVII',     label: 'ליום רביעי', text: 'יום רביעי מבורך' },
  { id: 'YOM_CHAMISHI', label: 'ליום חמישי', text: 'יום חמישי מבורך' },
  { id: 'SHABAT',       label: 'לשבת', text: 'שבת שלום ומבורכת' },   // שישי — לקראת שבת
  { id: 'SHAVUA_TOV',   label: 'לשבוע טוב', text: 'שבוע טוב ומבורך' },   // שבת (לקראת שבוע חדש)
]

// מחזיר { month (שם אנגלי), day (מספר) } לפי הלוח העברי, או null אם נכשל.
function hebrewParts(date) {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long' }).formatToParts(date)
    const month = (parts.find(p => p.type === 'month') || {}).value || ''
    const day = parseInt((parts.find(p => p.type === 'day') || {}).value || '0', 10)
    if (!month || !day) return null
    return { month: month.toLowerCase(), day }
  } catch { return null }
}

// מזהה חג עברי לפי חודש+יום (כולל ערב החג). מחזיר { label, text } או null.
function hebrewHoliday(date) {
  const hp = hebrewParts(date)
  if (!hp) return null
  const m = hp.month, d = hp.day
  const is = (stem) => m.includes(stem)

  // ראש השנה — א׳–ב׳ תשרי (וערב = כ״ט אלול)
  if (is('tishr') && (d === 1 || d === 2)) return { id: 'ROSH_HASHANA', label: 'לראש השנה', text: 'שנה טובה ומתוקה' }
  if (is('elul') && d === 29) return { id: 'ROSH_HASHANA', label: 'לראש השנה', text: 'שנה טובה ומתוקה' }
  // יום כיפור — ערב (ט׳) ויום (י׳) תשרי
  if (is('tishr') && (d === 9 || d === 10)) return { id: 'YOM_KIPUR', label: 'ליום כיפור', text: 'גמר חתימה טובה' }
  // סוכות — י״ד (ערב) עד כ״א תשרי
  if (is('tishr') && d >= 14 && d <= 21) return { id: 'SUKOT', label: 'לסוכות', text: 'חג סוכות שמח' }
  // שמחת תורה — כ״ב תשרי
  if (is('tishr') && d === 22) return { id: 'SUKOT', label: 'לשמחת תורה', text: 'חג שמח' }
  // חנוכה — כ״ד כסלו (ערב) עד ג׳ טבת
  if (is('kislev') && d >= 24) return { id: 'CHANUKA', label: 'לחנוכה', text: 'חנוכה שמח ומואר' }
  if (is('tevet') && d <= 3) return { id: 'CHANUKA', label: 'לחנוכה', text: 'חנוכה שמח ומואר' }
  // ט״ו בשבט
  if (is('shevat') && d === 15) return { label: 'לט״ו בשבט', text: 'ט״ו בשבט שמח' }
  // פורים — י״ג–ט״ו אדר (בשנה מעוברת: אדר ב׳ בלבד, לא אדר א׳)
  const isAdar2 = is('adar') && m.includes('ii')
  const isAdarPlain = m.trim() === 'adar'
  if ((isAdarPlain || isAdar2) && d >= 13 && d <= 15) return { id: 'PURIM', label: 'לפורים', text: 'פורים שמח' }
  // פסח — י״ד (ערב) עד כ״א ניסן
  if (is('nisan') && d >= 14 && d <= 21) return { id: 'PESACH', label: 'לפסח', text: 'חג פסח כשר ושמח' }
  // שבועות — ערב (ה׳) ויום (ו׳) סיוון
  if (is('sivan') && (d === 5 || d === 6)) return { id: 'SHAVUOT', label: 'לשבועות', text: 'חג שבועות שמח' }

  return null
}

// מחזיר את ההזדמנות של היום — חג קודם ליום בשבוע.
export function getOccasion(date = new Date()) {
  const holiday = hebrewHoliday(date)
  if (holiday) return { ...holiday, isHoliday: true }
  const wd = WEEKDAY[date.getDay()] || WEEKDAY[0]
  return { ...wd, isHoliday: false }
}
