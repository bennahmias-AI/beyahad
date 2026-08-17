// src/hooks/useGameMusic.js
// ─────────────────────────────────────────────────────────────
// מוזיקת רקע למשחקים — הוק + כפתור שליטה משותפים.
//
// למה קובץ נפרד? כדי ששני מסכים של אותו משחק (מקומי ואונליין)
// ישתמשו באותו קוד בלי ייבוא מעגלי ביניהם.
//
// התנהגות (זהה לשאר המשחקים): דלוקה כברירת מחדל, עוצמה נשמרת,
// מעבר אוטומטי לשיר הבא, ו"בעיטה" במגע הראשון (דפדפנים חוסמים
// ניגון אוטומטי לפני אינטראקציה של המשתמש).
//
// שימוש:
//   const music = useGameMusic('beyahad-bridge-music')
//   <div onPointerDown={music.kick}> ... <GameMusicButton {...music} /> </div>
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { MUSIC_TRACKS, isMuted, setMuted } from '../utils/gameSounds.js'
import { IconMusicNote, IconSpeaker, IconSpeakerOff } from '../icons/index.jsx'

export function useGameMusic(storageKey = 'beyahad-game-music') {
  const volKey = storageKey + '-vol'

  const [musicOn, setMusicOn] = useState(() => {
    try { return localStorage.getItem(storageKey) !== '0' } catch { return true }
  })
  // עוצמת ברירת המחדל — זהה ל"מסביב לעולם": מוזיקה שקטה ברקע שלא מפריעה לשיחה
  const DEFAULT_VOL = 0.10
  const [vol, setVol] = useState(() => {
    try {
      const saved = parseFloat(localStorage.getItem(volKey))
      return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : DEFAULT_VOL
    } catch { return DEFAULT_VOL }
  })
  const [muted, setMutedState] = useState(() => { try { return isMuted() } catch { return false } })

  const audioRef = useRef(null)
  const idxRef = useRef(Math.floor(Math.random() * MUSIC_TRACKS.length))

  // נגן יחיד + מעבר לשיר הבא בסיום רצועה
  useEffect(() => {
    const a = new Audio()
    a.preload = 'auto'
    audioRef.current = a
    const onEnded = () => {
      idxRef.current = (idxRef.current + 1) % MUSIC_TRACKS.length
      a.src = MUSIC_TRACKS[idxRef.current]
      a.play().catch(() => {})
    }
    a.addEventListener('ended', onEnded)
    return () => { a.removeEventListener('ended', onEnded); try { a.pause() } catch {} audioRef.current = null }
  }, [])

  useEffect(() => { if (audioRef.current) audioRef.current.volume = vol }, [vol])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (musicOn) {
      if (!a.src) a.src = MUSIC_TRACKS[idxRef.current]
      a.volume = vol
      a.play().catch(() => {})   // אם נחסם — kick יפעיל אחרי המגע הראשון
    } else {
      try { a.pause() } catch {}
    }
    try { localStorage.setItem(storageKey, musicOn ? '1' : '0') } catch {}
  }, [musicOn])

  const kick = () => {
    const a = audioRef.current
    if (!a || !musicOn || !a.paused) return
    if (!a.src) a.src = MUSIC_TRACKS[idxRef.current]
    a.volume = vol
    a.play().catch(() => {})
  }

  const nextTrack = () => {
    const a = audioRef.current
    if (!a) return
    idxRef.current = (idxRef.current + 1) % MUSIC_TRACKS.length
    a.src = MUSIC_TRACKS[idxRef.current]
    if (musicOn) a.play().catch(() => {})
  }

  const changeVol = (delta) => {
    setVol(v => {
      // אותו טווח כמו ב"מסביב לעולם"
      const nv = Math.min(0.60, Math.max(0.02, +(v + delta).toFixed(2)))
      try { localStorage.setItem(volKey, String(nv)) } catch {}
      return nv
    })
  }

  const toggleMute = () => {
    const n = !muted
    try { setMuted(n) } catch {}
    setMutedState(n)
  }

  return {
    musicOn, muted, kick, nextTrack, changeVol, toggleMute,
    toggleMusic: () => setMusicOn(o => !o),
  }
}

// ── כפתור מוזיקה וצלילים ─────────────────────────────────
// מקבל ישירות את מה ש-useGameMusic מחזיר.
export function GameMusicButton({ musicOn, muted, toggleMusic, toggleMute, nextTrack, changeVol }) {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (!open) return; const t = setTimeout(() => setOpen(false), 3500); return () => clearTimeout(t) }, [open])

  const item = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'right',
    background: 'none', border: 'none', color: '#EAF3DE', fontSize: 14, fontWeight: 700,
    fontFamily: 'inherit', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', minHeight: 'unset',
  }
  const volBtn = {
    width: 34, height: 34, borderRadius: 8, border: '1px solid #6ba883',
    background: '#2E6B45', color: '#EAF3DE', fontSize: 18, fontWeight: 800,
    cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1, padding: 0, minHeight: 'unset',
  }

  return (
    <div style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} aria-label="מוזיקה" style={{
        width: 36, height: 36, borderRadius: '50%', border: 'none', padding: 0, minHeight: 'unset',
        background: 'rgba(255,255,255,.14)', color: '#F6F0E3', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: musicOn ? 1 : 0.55,
      }}><IconMusicNote size={18} color="#F6F0E3" /></button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />
          <div style={{
            position: 'absolute', top: '120%', insetInlineEnd: 0, background: '#1d4a2e',
            border: '1px solid #6ba883', borderRadius: 12, padding: 8, display: 'flex',
            flexDirection: 'column', gap: 4, zIndex: 60, minWidth: 168, boxShadow: '0 8px 24px rgba(0,0,0,.5)',
          }}>
            <button onClick={toggleMusic} style={item}>
              <IconMusicNote size={16} color="#EAF3DE" /> {musicOn ? 'כבה מוזיקה' : 'הפעל מוזיקה'}
            </button>
            <button onClick={toggleMute} style={item}>
              {muted ? <IconSpeakerOff size={16} color="#EAF3DE" /> : <IconSpeaker size={16} color="#EAF3DE" />}
              {muted ? 'הפעל צלילים' : 'השתק צלילים'}
            </button>
            <button onClick={nextTrack} style={item}>♪ שיר הבא</button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '2px 6px' }}>
              <span style={{ color: '#EAF3DE', fontSize: 14, fontWeight: 700 }}>עוצמה</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => changeVol(-0.03)} style={volBtn} aria-label="החלש">−</button>
                <button onClick={() => changeVol(0.03)} style={volBtn} aria-label="הגבר">+</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
