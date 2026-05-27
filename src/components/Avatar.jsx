// src/components/Avatar.jsx
import { useState, useEffect } from 'react'
import { avatarColor } from '../design-system/index.js'

// אם מועבר photoURL תקין — מציג תמונה. אחרת — ראשי תיבות על רקע צבעוני.
// אם התמונה נכשלת בטעינה (base64 פגום וכו') — נופל בחזרה לראשי תיבות.
export default function Avatar({ name = '', size = 56, color, online = false, photoURL = null }) {
  const bg = color || avatarColor(name)
  const initials = name.split(' ').slice(0, 2).map(s => s[0]).join('')
  const fontSize = Math.round(size * 0.42)

  // track whether the photo failed to load
  const [imgFailed, setImgFailed] = useState(false)

  // reset the failed flag whenever the photo changes
  useEffect(() => { setImgFailed(false) }, [photoURL])

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
      {validPhoto ? (
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
