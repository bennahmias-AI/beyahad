// src/components/AvatarPicker.jsx
// ─────────────────────────────────────────────────────────────
// בורר אווטרים מובנים — מודאל שמציג גלריה של 18 אווטרים מוכנים,
// למשתמשים שלא רוצים להעלות תמונת פרופיל משלהם.
//
// כל אווטר "נחתך" מתוך גיליון מקור אחד (public/avatars.png.jpeg)
// באמצעות CSS background-position — ללא צורך ב-18 קבצים נפרדים.
//
// בחירת אווטר מחזירה מחרוזת בפורמט "avatar:N" (N בין 0 ל-17),
// שנשמרת בשדה photoURL של המשתמש — בדיוק כמו תמונה רגילה.
// כך האווטר מופיע אוטומטית בכל מקום (משחקים, צ'אט, חברים).
// ─────────────────────────────────────────────────────────────
import { builtInAvatarSrc, avatarsForGender } from './Avatar.jsx'

export default function AvatarPicker({ current, gender, onPick, onClose }) {
  // אינדקס האווטר הנבחר כרגע (אם current הוא "avatar:N")
  const currentIdx = (() => {
    if (typeof current !== 'string') return null
    const m = current.match(/^avatar:(\d+)$/)
    return m ? parseInt(m[1], 10) : null
  })()

  // מציגים רק אווטרים המתאימים למגדר שהמשתמש בחר (אם אין מגדר — הכל)
  const avatarIdxs = avatarsForGender(gender)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,23,42,0.6)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 1200, direction: 'rtl',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderTopLeftRadius: 26, borderTopRightRadius: 26,
          padding: '20px 18px calc(20px + env(safe-area-inset-bottom))',
          width: '100%', maxWidth: 480,
          boxShadow: '0 -8px 30px -8px rgba(20,23,42,.3)',
          maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        {/* ידית עליונה */}
        <div style={{
          width: 40, height: 5, borderRadius: 999,
          background: 'var(--line-strong)', margin: '0 auto 16px',
        }} />

        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', textAlign: 'center', marginBottom: 4 }}>
          בחרו תמונה
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, textAlign: 'center', marginBottom: 18 }}>
          בחרו דמות שתייצג אתכם
        </div>

        {/* גלריית האווטרים — 3 בשורה */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
        }}>
          {avatarIdxs.map((idx) => {
            const selected = currentIdx === idx
            return (
              <button
                key={idx}
                onClick={() => onPick(`avatar:${idx}`)}
                aria-label={`אווטר ${idx + 1}`}
                style={{
                  aspectRatio: '1',
                  borderRadius: 18,
                  border: selected ? '3px solid var(--burgundy)' : '2px solid var(--line)',
                  padding: 0, cursor: 'pointer',
                  overflow: 'hidden', position: 'relative',
                  background: '#FFFFFF',
                  boxShadow: selected ? '0 4px 14px -4px rgba(126,44,46,.5)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <img src={builtInAvatarSrc(idx)} alt={`אווטר ${idx + 1}`}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                {selected && (
                  <div style={{
                    position: 'absolute', insetInlineEnd: 5, top: 5,
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--burgundy)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 800,
                    boxShadow: '0 2px 6px rgba(0,0,0,.3)',
                  }}>✓</div>
                )}
              </button>
            )
          })}
        </div>

        {/* כפתור סגירה */}
        <button
          onClick={onClose}
          className="big-btn big-btn--ghost"
          style={{ width: '100%', marginTop: 20 }}
        >
          סגירה
        </button>
      </div>
    </div>
  )
}
