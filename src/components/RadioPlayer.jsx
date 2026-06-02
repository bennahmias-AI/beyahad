// src/components/RadioPlayer.jsx
// ─────────────────────────────────────────────────────────────
// נגן הרדיו הגלובלי הצף.
//
// מורכב פעם אחת ברמת ה-App, מעל כל המסכים. כולל את אלמנט ה-<audio>
// היחיד שמנגן בפועל, ואת ה-UI הצף (פס תחתון קומפקטי) שמופיע רק כשיש
// תחנה פעילה. כך המוזיקה ממשיכה לנגן גם כשעוברים בין דפים.
//
// ה-state מגיע מ-radioStore (גלובלי). הנגן עצמו רק "מציית" ל-store:
// מתחבר לכתובת הסטרים, מנגן/עוצר, מכוון ווליום.
// ─────────────────────────────────────────────────────────────
import { useRef, useEffect, useState } from 'react'
import { useRadioStore } from '../stores/radioStore.js'
import { reportClick } from '../services/radio.js'
import { IconPlay, IconPause, IconX, IconHeart } from '../icons/index.jsx'

const ACCENT = '#6B3A4F'

export default function RadioPlayer() {
  const audioRef = useRef(null)
  const {
    station, playing, volume, loading,
    setPlaying, setLoading, togglePlay, stop,
    toggleFavorite, favorites,
  } = useRadioStore()
  const [error, setError] = useState(false)

  const isFav = station && favorites.find(f => f.id === station.id)

  // כשהתחנה משתנה — טוענים את כתובת הסטרים החדשה ומדווחים קליק
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !station) return
    setError(false)
    audio.src = station.url
    audio.load()
    reportClick(station.id)
    if (playing) {
      audio.play().catch(() => { /* יטופל ב-onError / חוסם autoplay */ })
    }
    // eslint-disable-next-line
  }, [station?.id])

  // ניגון / עצירה לפי ה-state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !station) return
    if (playing) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [playing, station])

  // ווליום
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  if (!station) {
    // עדיין מרנדרים את ה-audio כדי שלא יאבד בין מעברים — אך בלי UI
    return <audio ref={audioRef} />
  }

  return (
    <>
      <audio
        ref={audioRef}
        onPlaying={() => { setLoading(false); setError(false) }}
        onWaiting={() => setLoading(true)}
        onError={() => { setError(true); setLoading(false); setPlaying(false) }}
      />

      {/* פס נגן צף — תמיד מעל התוכן, מעל סרגל הניווט התחתון */}
      <div style={{
        position: 'fixed', insetInline: 0, bottom: 0, zIndex: 1500,
        background: `linear-gradient(180deg, ${ACCENT} 0%, #482638 100%)`,
        color: '#FBF7EE', direction: 'rtl',
        padding: '10px 14px calc(10px + env(safe-area-inset-bottom))',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 -4px 18px -6px rgba(0,0,0,.4)',
      }}>
        {/* לוגו/אייקון התחנה */}
        <div style={{
          width: 46, height: 46, borderRadius: 12, flexShrink: 0, overflow: 'hidden',
          background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <span style={{ position: 'absolute', fontSize: 22 }}>📻</span>
          {station.favicon && (
            <img src={station.favicon} alt="" style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'cover' }}
                 onError={e => { e.target.style.display = 'none' }} />
          )}
        </div>

        {/* שם התחנה + סטטוס */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            fontFamily: "'Suez One', serif",
          }}>{station.name}</div>
          <div style={{ fontSize: 12.5, opacity: 0.85, fontWeight: 600 }}>
            {error ? '⚠ לא הצלחנו להתחבר לתחנה' : loading ? 'מתחבר...' : playing ? '● משדר עכשיו' : 'מושהה'}
          </div>
        </div>

        {/* מועדף */}
        <button onClick={() => toggleFavorite(station)} aria-label="הוסף למועדפים" style={{
          width: 42, height: 42, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', border: 'none',
          background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconHeart size={20} color={isFav ? '#FFB4C0' : '#FBF7EE'} />
        </button>

        {/* נגן / השהה */}
        <button onClick={togglePlay} aria-label={playing ? 'השהה' : 'נגן'} style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', border: 'none',
          background: '#FBF7EE', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {playing ? <IconPause size={24} color={ACCENT} /> : <IconPlay size={24} color={ACCENT} />}
        </button>

        {/* סגירה */}
        <button onClick={stop} aria-label="סגור רדיו" style={{
          width: 42, height: 42, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', border: 'none',
          background: 'rgba(255,255,255,.15)', color: '#FBF7EE',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconX size={20} color="#FBF7EE" />
        </button>
      </div>
    </>
  )
}
