// src/components/Lightbox.jsx
// תצוגת תמונה במסך מלא — לחיצה על הרקע או על ה-X סוגרת. Esc סוגר במקלדת.
import { useEffect } from 'react'

export default function Lightbox({ src, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!src) return null

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <button onClick={onClose} aria-label="סגירה" style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top, 0px) + 14px)', insetInlineStart: 16,
        width: 44, height: 44, borderRadius: '50%',
        background: 'rgba(255,255,255,.16)', color: '#fff', border: 'none',
        cursor: 'pointer', fontSize: 26, lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
      }}>×</button>
      <img
        src={src}
        alt=""
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
      />
    </div>
  )
}
