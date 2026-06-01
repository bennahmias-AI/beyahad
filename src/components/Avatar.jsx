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

// אם מועבר photoURL תקין — מציג תמונה. אם הוא "avatar:N" — מציג אווטר מובנה.
// אחרת — ראשי תיבות על רקע צבעוני.
// אם התמונה נכשלת בטעינה (base64 פגום וכו') — נופל בחזרה לראשי תיבות.
export default function Avatar({ name = '', size = 56, color, online = false, photoURL = null }) {
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
