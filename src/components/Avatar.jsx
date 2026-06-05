// src/components/Avatar.jsx
import { useState, useEffect } from 'react'
import { avatarColor } from '../design-system/index.js'

// האווטרים המובנים — כל אחד קובץ PNG נפרד בתיקייה public/avatars/
// (1.png עד 38.png). ללא חיתוך — כל תמונה נטענת מלאה ונקייה.
//
// חוקיות מגדר: מספר אי-זוגי = אשה (1,3,5...), מספר זוגי = גבר (2,4,6...).
// כך אפשר לסנן אווטרים לפי מגדר המשתמש ישירות מהמספר.
export const AVATAR_COUNT = 38
export const AVATAR_DIR = '/avatars'

// מחזיר את נתיב הקובץ של אווטר מובנה לפי האינדקס (0–37 → 1.png–38.png).
export function builtInAvatarSrc(idx) {
  return `${AVATAR_DIR}/${idx + 1}.png`
}

// מחזיר רשימת אינדקסים של אווטרים המתאימים למגדר נתון.
// gender: 'female' | 'male' | אחר (אז מחזיר את הכל).
// הקובץ ה-N מיוצג כאינדקס N-1, אז: אינדקס זוגי (0,2,4..)=אשה (קובץ 1,3,5),
// אינדקס אי-זוגי (1,3,5..)=גבר (קובץ 2,4,6).
export function avatarsForGender(gender) {
  const all = Array.from({ length: AVATAR_COUNT }, (_, i) => i)
  if (gender === 'female') return all.filter(i => i % 2 === 0)  // קבצים אי-זוגיים 1,3,5...
  if (gender === 'male')   return all.filter(i => i % 2 === 1)  // קבצים זוגיים 2,4,6...
  return all
}

// בודק אם photoURL הוא אווטר מובנה (פורמט "avatar:N") ומחזיר את האינדקס, אחרת null.
export function parseBuiltInAvatar(photoURL) {
  if (typeof photoURL !== 'string') return null
  const m = photoURL.match(/^avatar:(\d+)$/)
  if (!m) return null
  const idx = parseInt(m[1], 10)
  if (idx < 0 || idx >= AVATAR_COUNT) return null
  return idx
}

// קבצי אווטר שחסרים פיזית מהתיקייה (לא לבחור אותם אוטומטית) — אינדקס 18 = 19.png
const MISSING_AVATARS = new Set([18])

// hash יציב ממחרוזת — כדי לבחור אותו אווטר לאותו משתמש בכל פעם
function hashStr(s) {
  let h = 0
  const str = String(s || '')
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

// שמות עבריים נפוצים — לניחוש מגדר כשאין שדה gender.
const FEMALE_NAMES = new Set(['דנה','שרה','רחל','לאה','מרים','אסתר','חנה','רבקה','יעל','מיכל','נעמי','תמר','רות','דבורה','ציפורה','גולדה','מלכה','פנינה','שושנה','ברכה','יהודית','חוה','אילנה','אורנה','סיגל','גלית','ענת','ליאת','רונית','אביבה','זהבה','מזל','סימה','ויקי','חיה','שירה','נועה','מאיה','טליה','עדי','הילה','קרן','דפנה','אורלי','מירב','שני','רוני','ספיר','אלה','איילת','אפרת','בתיה','דליה','דורית','חגית','יפה','כרמלה','לבנה','מרגלית','נורית','סופיה','עדינה','פרידה','צילה','רוזה','רותי','שולמית','תקווה','מירה','מילי','אמי','אסנת','מאירה','גילה','ברוריה','מלי','מירי','נילי','עידית','ריקי','שרי','תהילה','אביגיל','אורית','שרהלה','פרחיה','בתשבע','ירין','Mira','MIRA','mira'])
const MALE_NAMES = new Set(['בן','אבי','יעקב','משה','דוד','יוסף','אברהם','יצחק','חיים','שלמה','מרדכי','אהרון','אהרן','שמואל','ניסים','עוזי','עמי','שמוליק','נתן','אריה','ראובן','שמעון','יהודה','מנחם','צבי','דב','אורי','רון','גיא','עמית','איתן','איתי','יוסי','מוטי','אלי','ציון','שלום','עמוס','גד','דן','אסף','יואב','עידו','עומר','נדב','רואי','ליאור','עוז','ירון','סמי','אבנר','בני','גדי','דורון','חנן','יגאל','יחיאל','מאיר','מיכאל','נחום','סהר','עמנואל','פנחס','צחי','קובי','רפאל','שגיא','אורן','בועז','זאב','יהונתן','כפיר','מתן','סער','עידן','רן','שחר','עתי','ניסן'])

// מנחש מגדר: שדה מפורש > רשימת שמות > היוריסטיקת סיומת עברית. מחזיר 'female'|'male'|null.
export function inferGender(name, explicit) {
  if (explicit === 'female' || explicit === 'male') return explicit
  const first = String(name || '').trim().split(/\s+/)[0]
  if (!first) return null
  if (FEMALE_NAMES.has(first)) return 'female'
  if (MALE_NAMES.has(first)) return 'male'
  if (/(ית|יה|ה|ת)$/.test(first)) return 'female'   // סיומת נשית נפוצה (ניחוש חלש)
  return null
}

// אם מועבר photoURL תקין — מציג תמונה. אם הוא "avatar:N" — מציג אווטר מובנה.
// אחרת — ראשי תיבות על רקע צבעוני.
// אם התמונה נכשלת בטעינה (base64 פגום וכו') — נופל בחזרה לראשי תיבות.
export default function Avatar({ name = '', size = 56, color, online = false, photoURL = null, seed = null, gender = null }) {
  const bg = color || avatarColor(name)
  const initials = name.split(' ').slice(0, 2).map(s => s[0]).join('')
  const fontSize = Math.round(size * 0.42)

  // track whether the photo failed to load
  const [imgFailed, setImgFailed] = useState(false)

  // reset the failed flag whenever the photo changes
  useEffect(() => { setImgFailed(false) }, [photoURL])

  // אווטר מובנה (מתוך גיליון האווטרים)
  const builtInIdx = parseBuiltInAvatar(photoURL)

  // a photo is usable only if it exists, looks like a data/http URL,
  // and hasn't already failed to load
  const validPhoto =
    photoURL &&
    typeof photoURL === 'string' &&
    (photoURL.startsWith('data:image') || photoURL.startsWith('http')) &&
    !imgFailed

  // אווטר אוטומטי: אין תמונה ואין אווטר מובנה שנבחר → בוחרים אווטר מובנה
  // אקראי-יציב לפי seed/שם, מסונן לפי מגדר (מהשדה gender או מניחוש לפי השם).
  let autoIdx = null
  if (builtInIdx === null && !validPhoto) {
    const g = inferGender(name, gender)
    const pool = avatarsForGender(g).filter(i => !MISSING_AVATARS.has(i))
    if (pool.length) autoIdx = pool[hashStr(seed || name || 'x') % pool.length]
  }

  return (
    <div
      className="avatar"
      style={{
        width: size, height: size, fontSize,
        background: bg,                       // colored bg always (shows if no/failed photo)
        position: 'relative',
        overflow: 'hidden',
      }}
      aria-label={name}
    >
      {builtInIdx !== null ? (
        <img
          src={builtInAvatarSrc(builtInIdx)}
          alt={name}
          onError={() => setImgFailed(true)}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : validPhoto ? (
        <img
          src={photoURL}
          alt={name}
          onError={() => setImgFailed(true)}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (autoIdx !== null && !imgFailed) ? (
        <img
          src={builtInAvatarSrc(autoIdx)}
          alt={name}
          onError={() => setImgFailed(true)}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <span>{initials}</span>
      )}

      {online && (
        <span style={{
          position: 'absolute',
          insetInlineEnd: 2, bottom: 2,
          width: size * 0.22, height: size * 0.22,
          borderRadius: '50%',
          background: '#2E7D4E',
          border: `${Math.max(2, size * 0.05)}px solid #F2E7CB`,
          zIndex: 2,
        }} />
      )}
    </div>
  )
}
