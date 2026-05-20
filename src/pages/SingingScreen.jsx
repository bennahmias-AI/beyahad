// src/pages/SingingScreen.jsx
// ─────────────────────────────────────────────────────────────
// שירה בציבור — חדר קריוקי קבוצתי.
//
// הקסם: כל המשתתפים רואים זה את זה בווידאו, והמיקרופון של כל
// אחד דולק (הוא מרגיש שהוא משדר) — אבל אף אחד לא *מאזין* לאחרים.
// LiveKitRoom רץ עם audio={false} → לא מצטרפים תעלות אודיו
// נכנסות. כך כל אחד שר לעצמו אבל מרגיש שהוא שר עם כולם.
//
// המילים רצות על המסך לפי תזמון קבוע (קריוקי). אין מוזיקה
// אמיתית בשלב הזה — טון synth עדין נותן את הקצב.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import {
  LiveKitRoom,
  ParticipantTile,
  useTracks,
  useParticipants,
  useLocalParticipant,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Track } from 'livekit-client'
import { useSessionStore } from '../stores/sessionStore.js'
import { useUserStore } from '../stores/userStore.js'
import Avatar from '../components/Avatar.jsx'
import { colors } from '../design-system/index.js'

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://your-project.livekit.cloud'

// ─── שיר בדיקה: "הבה נגילה" (שיר עם, נחלת הכלל) ──────────────
// כל שורה: { text: המילים, at: שנייה שבה השורה מתחילה }
const SONG = {
  title: 'הבה נגילה',
  subtitle: 'שיר עם · קריוקי',
  bpmHint: 'מנגינה שמחה',
  duration: 48, // שניות
  lines: [
    { text: 'הָבָה נָגִילָה',            at: 2 },
    { text: 'הָבָה נָגִילָה',            at: 6 },
    { text: 'הָבָה נָגִילָה וְנִשְׂמְחָה', at: 10 },
    { text: 'הָבָה נָגִילָה',            at: 15 },
    { text: 'הָבָה נָגִילָה',            at: 19 },
    { text: 'הָבָה נָגִילָה וְנִשְׂמְחָה', at: 23 },
    { text: 'הָבָה נְרַנְּנָה',           at: 28 },
    { text: 'הָבָה נְרַנְּנָה',           at: 32 },
    { text: 'הָבָה נְרַנְּנָה וְנִשְׂמְחָה', at: 36 },
    { text: 'עוּרוּ עוּרוּ אַחִים',       at: 41 },
    { text: 'בְּלֵב שָׂמֵחַ',             at: 45 },
  ],
}

// ─── Connecting screen ───────────────────────────────────────
function ConnectingScreen({ onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(180deg, #6B3A4F 0%, #2B1828 100%)',
      color: '#FBF7EE',
      display: 'flex', flexDirection: 'column',
      padding: '32px 24px 28px',
      zIndex: 1000, direction: 'rtl',
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button onClick={onCancel} style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'rgba(255,255,255,.12)', color: '#FBF7EE',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, border: 'none', cursor: 'pointer',
        }}>←</button>
      </div>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <div style={{ fontSize: 96 }}>🎤</div>
        <div style={{ textAlign: 'center' }}>
          <div className="h-display" style={{ fontSize: 30 }}>שירה בציבור</div>
          <div style={{ fontSize: 18, opacity: 0.8, marginTop: 6 }}>
            מתחברים לחדר השירה...
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,.10)', borderRadius: 16,
          padding: '12px 18px', fontSize: 17, fontWeight: 500,
          textAlign: 'center', lineHeight: 1.4,
        }}>
          מפעילים מצלמה ומיקרופון<br/>זה ייקח רגע
        </div>
      </div>
      <button onClick={onCancel} className="big-btn big-btn--danger" style={{ width: '100%' }}>
        ✕ ביטול
      </button>
    </div>
  )
}

// ─── Singing room UI ─────────────────────────────────────────
function SingingUI({ onEnd }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  )
  const participants = useParticipants()
  const { localParticipant } = useLocalParticipant()

  const [videoOff, setVideoOff] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)   // שניות מתחילת השיר

  const tickRef = useRef(null)
  const audioCtxRef = useRef(null)
  const melodyTimerRef = useRef(null)

  // ── Keep my microphone ON the whole time ──────────────────
  // (So I feel like I'm broadcasting. Others never hear me
  //  because the room is joined with audio={false}.)
  useEffect(() => {
    if (!localParticipant) return
    localParticipant.setMicrophoneEnabled(true).catch(console.error)
  }, [localParticipant])

  // ── Song clock ─────────────────────────────────────────────
  useEffect(() => {
    if (!playing) return
    tickRef.current = setInterval(() => {
      setElapsed(e => {
        if (e >= SONG.duration) {
          setPlaying(false)
          return SONG.duration
        }
        return e + 0.25
      })
    }, 250)
    return () => clearInterval(tickRef.current)
  }, [playing])

  // ── Real "Hava Nagila" melody via Web Audio ────────────────
  // The melody is encoded as a list of notes (frequency in Hz +
  // duration in seconds). When the song starts we schedule the
  // whole tune on the AudioContext timeline so it plays in tune.
  useEffect(() => {
    if (!playing) {
      if (melodyTimerRef.current) {
        clearTimeout(melodyTimerRef.current)
        melodyTimerRef.current = null
      }
      return
    }

    // create audio context on first play (the "התחל לשיר" button
    // is the user gesture that allows audio)
    if (!audioCtxRef.current) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext
        audioCtxRef.current = new AC()
      } catch (e) { /* no audio — that's ok */ }
    }
    const ctx = audioCtxRef.current
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()

    // ── Note frequencies (Hz) ──
    const N = {
      A3: 220.00, B3: 246.94, C4: 261.63, D4: 293.66,
      Eb4: 311.13, E4: 329.63, F4: 349.23, G4: 392.00,
      Ab4: 415.30, A4: 440.00, B4: 493.88, C5: 523.25,
      REST: 0,
    }

    // ── "Hava Nagila" melody — note + beats ──
    // (classic folk tune, public domain). q=quarter, e=eighth, h=half
    const q = 0.42, e = 0.21, h = 0.84
    const melody = [
      // הבה נגילה
      [N.A4,e],[N.A4,e],[N.B4,e],[N.C5,e],[N.C5,e],[N.B4,e],[N.A4,q],
      [N.G4,e],[N.G4,e],[N.A4,e],[N.B4,e],[N.A4,q],[N.G4,q],
      [N.A4,h],[N.REST,e],
      // הבה נגילה
      [N.A4,e],[N.A4,e],[N.B4,e],[N.C5,e],[N.C5,e],[N.B4,e],[N.A4,q],
      [N.G4,e],[N.G4,e],[N.A4,e],[N.B4,e],[N.A4,q],[N.G4,q],
      [N.A4,h],[N.REST,e],
      // הבה נרננה
      [N.B4,e],[N.B4,e],[N.C5,e],[N.D4*2,e],[N.D4*2,e],[N.C5,e],[N.B4,q],
      [N.A4,e],[N.A4,e],[N.B4,e],[N.C5,e],[N.B4,q],[N.A4,q],
      [N.A4,h],[N.REST,e],
      // עורו עורו אחים — בלב שמח
      [N.E4,q],[N.E4,e],[N.F4,e],[N.G4,q],[N.G4,e],[N.F4,e],
      [N.E4,e],[N.F4,e],[N.G4,e],[N.A4,e],[N.G4,q],[N.F4,q],
      [N.E4,h],
    ]

    // schedule a single note
    const playNote = (freq, startAt, dur) => {
      if (!freq) return // rest
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle' // warm, music-box-like tone
      osc.frequency.value = freq
      const t0 = ctx.currentTime + startAt
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.95)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + dur)
    }

    // schedule the whole melody, looping until the song ends
    const scheduleMelody = () => {
      let cursor = 0
      for (const [freq, dur] of melody) {
        playNote(freq, cursor, dur)
        cursor += dur
      }
      return cursor // total melody length in seconds
    }

    const melodyLen = scheduleMelody()
    // loop the melody if the song is longer than one pass
    const loop = () => {
      const len = scheduleMelody()
      melodyTimerRef.current = setTimeout(loop, len * 1000)
    }
    melodyTimerRef.current = setTimeout(loop, melodyLen * 1000)

    return () => {
      if (melodyTimerRef.current) clearTimeout(melodyTimerRef.current)
    }
  }, [playing])

  // cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (melodyTimerRef.current) clearTimeout(melodyTimerRef.current)
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {})
    }
  }, [])

  const startSong = () => {
    setElapsed(0)
    setPlaying(true)
  }
  const restartSong = () => {
    setElapsed(0)
    setPlaying(true)
  }

  const toggleVideo = async () => {
    if (!localParticipant) return
    const next = !videoOff
    setVideoOff(next)
    try { await localParticipant.setCameraEnabled(!next) } catch(e) { console.error(e) }
  }

  const getTrackFor = (p) => tracks.find(t => t.participant?.identity === p?.identity)

  // ── Current + next lyric line ──────────────────────────────
  let currentLineIdx = -1
  for (let i = 0; i < SONG.lines.length; i++) {
    if (elapsed >= SONG.lines[i].at) currentLineIdx = i
  }
  const currentLine = SONG.lines[currentLineIdx]
  const nextLine = SONG.lines[currentLineIdx + 1]
  const songFinished = elapsed >= SONG.duration

  const formatTime = s => {
    const sec = Math.floor(s)
    return `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,'0')}`
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(180deg, #6B3A4F 0%, #2B1828 100%)',
      color: '#FBF7EE',
      display: 'flex', flexDirection: 'column',
      zIndex: 1000, overflow: 'hidden', direction: 'rtl',
    }}>
      {/* Top bar */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px',
        background: 'rgba(0,0,0,.25)',
      }}>
        <div style={{ fontSize: 22 }}>🎤</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="h-display" style={{ fontSize: 17 }}>{SONG.title}</div>
          <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 600 }}>
            {participants.length} {participants.length === 1 ? 'משתתף' : 'משתתפים'} · {SONG.subtitle}
          </div>
        </div>
        {playing && (
          <div style={{
            background: 'rgba(0,0,0,.30)', borderRadius: 999,
            padding: '5px 12px', fontSize: 13, fontWeight: 800,
          }}>
            {formatTime(elapsed)} / {formatTime(SONG.duration)}
          </div>
        )}
      </div>

      {/* Participant video strip */}
      <div style={{
        flexShrink: 0, padding: '10px 12px',
        display: 'flex', gap: 8, overflowX: 'auto',
        background: 'rgba(0,0,0,.15)',
      }}>
        {participants.map(p => {
          const track = getTrackFor(p)
          return (
            <div key={p.identity} style={{
              flexShrink: 0,
              width: 92, height: 92, borderRadius: 14, overflow: 'hidden',
              background: '#2B1828', position: 'relative',
              border: '2px solid rgba(255,255,255,0.18)',
            }}>
              {track ? (
                <ParticipantTile trackRef={track} style={{ width: '100%', height: '100%' }} />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Avatar name={p.name || p.identity} size={48} />
                </div>
              )}
              {/* "singing" mic indicator — everyone always looks active */}
              <div style={{
                position: 'absolute', bottom: 4, insetInlineEnd: 4,
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(79,107,74,.95)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11,
              }}>🎙️</div>
            </div>
          )
        })}
      </div>

      {/* Lyrics stage */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 28px', textAlign: 'center', gap: 20,
        position: 'relative',
      }}>
        {!playing && !songFinished && (
          <>
            <div style={{ fontSize: 80 }}>🎶</div>
            <div className="h-display" style={{ fontSize: 28 }}>{SONG.title}</div>
            <div style={{ fontSize: 16, opacity: 0.8, lineHeight: 1.5, maxWidth: 320 }}>
              כולם שרים יחד! אף אחד לא שומע אותך —
              אז תשיר/י בלי בושה 😊
            </div>
            <button onClick={startSong} className="big-btn" style={{
              background: '#FBF7EE', color: '#6B3A4F',
              boxShadow: '0 8px 20px -6px rgba(0,0,0,.5)',
              marginTop: 8, paddingInline: 36,
            }}>
              🎤 התחל לשיר
            </button>
          </>
        )}

        {playing && (
          <>
            {/* current line — big */}
            <div className="h-display" style={{
              fontSize: 36, lineHeight: 1.3,
              color: '#FBF7EE',
              textShadow: '0 2px 12px rgba(0,0,0,.4)',
              transition: 'all 0.3s',
            }}>
              {currentLine ? currentLine.text : '🎵'}
            </div>
            {/* next line — small preview */}
            {nextLine && (
              <div style={{
                fontSize: 20, opacity: 0.5, fontWeight: 600,
              }}>
                {nextLine.text}
              </div>
            )}
          </>
        )}

        {songFinished && (
          <>
            <div style={{ fontSize: 80 }}>👏</div>
            <div className="h-display" style={{ fontSize: 28 }}>כל הכבוד!</div>
            <div style={{ fontSize: 16, opacity: 0.8 }}>שרתם נהדר ביחד</div>
            <button onClick={restartSong} className="big-btn" style={{
              background: '#FBF7EE', color: '#6B3A4F',
              boxShadow: '0 8px 20px -6px rgba(0,0,0,.5)',
              marginTop: 8, paddingInline: 36,
            }}>
              🔁 לשיר שוב
            </button>
          </>
        )}
      </div>

      {/* Progress bar */}
      {playing && (
        <div style={{ flexShrink: 0, height: 4, background: 'rgba(255,255,255,0.1)' }}>
          <div style={{
            height: '100%', width: `${(elapsed / SONG.duration) * 100}%`,
            background: '#B89048',
            transition: 'width 0.25s linear',
          }}/>
        </div>
      )}

      {/* Bottom controls */}
      <div style={{
        flexShrink: 0,
        padding: '12px 14px calc(12px + env(safe-area-inset-bottom)) 14px',
        background: 'rgba(0,0,0,.40)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        gap: 8,
      }}>
        {/* Video toggle */}
        <button onClick={toggleVideo} style={{
          width: 60, height: 60, borderRadius: '50%',
          background: videoOff ? '#FBF7EE' : 'rgba(255,255,255,.18)',
          color: videoOff ? '#1B2540' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, border: 'none', cursor: 'pointer',
        }} aria-label={videoOff ? 'הפעל וידאו' : 'כבה וידאו'}>
          {videoOff ? '📵' : '📹'}
        </button>

        {/* Info pill — explains the magic gently */}
        <div style={{
          flex: 1, maxWidth: 200,
          background: 'rgba(255,255,255,.10)',
          borderRadius: 999, padding: '10px 14px',
          fontSize: 12, fontWeight: 600, textAlign: 'center',
          lineHeight: 1.3,
        }}>
          🎙️ המיקרופון שלך דולק<br/>שרו בלי בושה!
        </div>

        {/* Leave */}
        <button onClick={onEnd} style={{
          width: 66, height: 66, borderRadius: '50%',
          background: '#A33B30', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, border: 'none', cursor: 'pointer',
        }} aria-label="יציאה">📞</button>
      </div>
    </div>
  )
}

// ─── Root component ──────────────────────────────────────────
export default function SingingScreen({ onExit }) {
  const {
    singingToken, singingRoom, clearSinging,
  } = useSessionStore()
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')

  const handleEnd = () => {
    clearSinging()
    onExit?.()
  }

  if (error) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 20, padding: 24,
        background: colors.bgApp, zIndex: 1000,
      }}>
        <div style={{ fontSize: 48 }}>😕</div>
        <div className="h-display" style={{ fontSize: 22, color: colors.ink, textAlign: 'center' }}>
          לא הצלחנו להתחבר לחדר השירה
        </div>
        <div style={{ fontSize: 16, color: colors.ink2, textAlign: 'center' }}>{error}</div>
        <button onClick={handleEnd} className="big-btn big-btn--primary" style={{ width: '100%', maxWidth: 320 }}>
          חזרה
        </button>
      </div>
    )
  }

  if (!singingToken || !singingRoom) {
    return <ConnectingScreen onCancel={handleEnd} />
  }

  return (
    <>
      {!connected && <ConnectingScreen onCancel={handleEnd} />}
      {/* audio={false} — THIS is the magic: we publish our own mic
          but never subscribe to anyone else's audio. */}
      <LiveKitRoom
        serverUrl={LIVEKIT_URL}
        token={singingToken}
        connect={true}
        video={true}
        audio={false}
        onConnected={() => setConnected(true)}
        onDisconnected={handleEnd}
        onError={(e) => setError(e.message)}
        style={{ display: connected ? 'block' : 'none' }}
      >
        <SingingUI onEnd={handleEnd} />
      </LiveKitRoom>
    </>
  )
}
