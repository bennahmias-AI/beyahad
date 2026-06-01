// src/components/VoiceMessage.jsx
// ─────────────────────────────────────────────────────────────
// נגן הודעה קולית בתוך בועת צ'אט — כפתור נגן/עצור + פס התקדמות + משך.
// mine = האם זו ההודעה שלי (משפיע על הצבעים).
// ─────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export default function VoiceMessage({ audioUrl, durationSec, mine }) {
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const audioRef = useRef(null)

  useEffect(() => {
    const audio = new Audio(audioUrl)
    audioRef.current = audio
    const onTime = () => setCurrent(audio.currentTime)
    const onEnd = () => { setPlaying(false); setCurrent(0) }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnd)
    }
  }, [audioUrl])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().then(() => setPlaying(true)).catch(e => console.error('audio play error:', e))
    }
  }

  const fg = mine ? '#fff' : 'var(--burgundy)'
  const trackBg = mine ? 'rgba(255,255,255,.3)' : 'var(--line)'
  const total = durationSec || 0
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0
  const label = playing || current > 0 ? fmt(current) : fmt(total)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 160 }}>
      <button
        onClick={toggle}
        aria-label={playing ? 'עצור' : 'נגן'}
        style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: mine ? 'rgba(255,255,255,.2)' : 'var(--burgundy-soft)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {playing ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill={fg}>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill={fg}>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ height: 4, borderRadius: 2, background: trackBg, position: 'relative' }}>
          <div style={{
            position: 'absolute', insetInlineStart: 0, top: 0, height: '100%',
            width: `${pct}%`, background: fg, borderRadius: 2,
          }} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, color: fg, opacity: .9 }}>
          {label}
        </div>
      </div>
    </div>
  )
}
