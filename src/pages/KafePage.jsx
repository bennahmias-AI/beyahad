// src/pages/KafePage.jsx
// ─────────────────────────────────────────────────────────────
// Real 1:1 video call using LiveKit.
// Design: exact original ביחד aesthetic.
// Flow: partner info → LiveKit room → call controls → end.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  useTracks,
  RoomAudioRenderer,
  useLocalParticipant,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Track } from 'livekit-client'
import { useSessionStore } from '../stores/sessionStore.js'
import { useUserStore } from '../stores/userStore.js'
import { endCafeSession } from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'
import { colors } from '../design-system/index.js'

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://your-project.livekit.cloud'
const KAFE_QUESTIONS = [
  'מהו זיכרון הילדות הכי יקר לך?',
  'אם היית יכול/ה לחזור לרגע אחד בעבר — איזה רגע היית בוחר/ת?',
  'מהו השיר שמלווה אותך כל החיים?',
  'ספר/י לי על אדם אחד שהכי השפיע על מי שאת/ה היום.',
  'איזו עצה היית רוצה לתת לעצמך הצעיר/ה?',
]

// ─── Connecting screen (waiting for LiveKit) ──────────────────
function ConnectingScreen({ partner, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: `linear-gradient(180deg, #1A2547 0%, #2B2A45 100%)`,
      color: 'white',
      display: 'flex', flexDirection: 'column',
      padding: '32px 24px 28px',
      zIndex: 1000,
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button onClick={onCancel} style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'rgba(255,255,255,.12)',
          color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, border: 'none', cursor: 'pointer',
        }}>←</button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', inset: -30, borderRadius: '50%',
            border: '3px solid rgba(255,255,255,.15)',
            animation: 'livePulse 1.5s ease-out infinite',
          }}/>
          <div style={{
            position: 'absolute', inset: -54, borderRadius: '50%',
            border: '3px solid rgba(255,255,255,.08)',
            animation: 'livePulse 1.5s ease-out 0.5s infinite',
          }}/>
          <Avatar name={partner?.name || '?'} size={160} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{partner?.name}</div>
          <div style={{ fontSize: 18, opacity: 0.8, marginTop: 6 }}>
            {partner?.city && `${partner.city} · `}מתחברים...
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,.10)',
          borderRadius: 16, padding: '12px 18px',
          fontSize: 17, fontWeight: 500, textAlign: 'center', lineHeight: 1.4,
        }}>
          המערכת מחברת אתכם<br/>זה ייקח רגע
        </div>
      </div>

      <button onClick={onCancel} className="big-btn big-btn--danger" style={{ width: '100%' }}>
        ✕ ביטול
      </button>
    </div>
  )
}

// ─── The actual call UI inside LiveKit room ───────────────────
function CallUI({ partner, sessionId, onEnd }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true },
     { source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false }
  )
  const { localParticipant } = useLocalParticipant()
  const [muted, setMuted] = useState(false)
  const [videoOff, setVideoOff] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [mode, setMode] = useState('invite') // invite | playing | free | chat
  const [qIndex, setQIndex] = useState(0)
  const [turn, setTurn] = useState('partner')
  const [turnLeft, setTurnLeft] = useState(60)

  // Call timer
  useEffect(() => {
    const t = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Actually toggle the LiveKit mic / camera when the user toggles
  const toggleMute = useCallback(async () => {
    if (!localParticipant) return
    const next = !muted
    setMuted(next)
    try { await localParticipant.setMicrophoneEnabled(!next) } catch (e) { console.error(e) }
  }, [localParticipant, muted])

  const toggleVideo = useCallback(async () => {
    if (!localParticipant) return
    const next = !videoOff
    setVideoOff(next)
    try { await localParticipant.setCameraEnabled(!next) } catch (e) { console.error(e) }
  }, [localParticipant, videoOff])

  const nextTurn = useCallback(() => {
    if (turn === 'partner') {
      setTurn('me')
      setTurnLeft(60)
    } else {
      if (qIndex < KAFE_QUESTIONS.length - 1) {
        setQIndex(q => q + 1)
        setTurn('partner')
        setTurnLeft(60)
      } else {
        setMode('free')
      }
    }
  }, [turn, qIndex])

  // Per-turn countdown (only when playing)
  useEffect(() => {
    if (mode !== 'playing') return
    setTurnLeft(60)
    const t = setInterval(() => {
      setTurnLeft(prev => {
        if (prev <= 1) {
          nextTurn()
          return 60
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [mode, turn, qIndex, nextTurn])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#1A2547',
      color: 'white',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      zIndex: 1000,
    }}>
      {/* Header — fixed height */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px',
        background: 'rgba(0,0,0,.30)',
      }}>
        <div style={{ fontSize: 20 }}>☕</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>קפה בסלון · אחד על אחד</div>
          <div style={{ fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {partner?.name}
          </div>
        </div>
        <div style={{
          background: 'rgba(0,0,0,.30)', borderRadius: 999,
          padding: '5px 10px', fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6,
          flexShrink: 0,
        }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: '#4ADE80',
          }}/>
          {mm}:{ss}
        </div>
      </div>

      {/* Video area - takes ALL remaining space */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', background: '#0F1730' }}>
        <GridLayout tracks={tracks} style={{ height: '100%', width: '100%' }}>
          <ParticipantTile />
        </GridLayout>
        <RoomAudioRenderer />

        {/* Question card - playing mode */}
        {mode === 'playing' && (
          <div style={{
            position: 'absolute', bottom: 10, left: 10, right: 10,
            background: 'white', color: colors.ink,
            borderRadius: 18, padding: '14px 16px',
            boxShadow: '0 6px 0 rgba(0,0,0,.3)',
            border: `2px solid ${colors.gold}`,
            zIndex: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: colors.mustard, color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800,
                }}>{qIndex + 1}</div>
                <div style={{ fontSize: 12, color: colors.ink3, fontWeight: 700 }}>
                  שאלה {qIndex + 1} מתוך {KAFE_QUESTIONS.length}
                </div>
              </div>
              <div style={{
                background: turnLeft <= 10 ? colors.danger : colors.surface2,
                color: turnLeft <= 10 ? 'white' : colors.ink,
                borderRadius: 999, padding: '3px 9px',
                fontSize: 13, fontWeight: 800,
              }}>
                0:{String(turnLeft).padStart(2, '0')}
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3 }}>
              {KAFE_QUESTIONS[qIndex]}
            </div>
            <div style={{
              marginTop: 8, padding: '6px 10px',
              background: turn === 'me' ? colors.burgundySoft : colors.wineSoft,
              border: `2px solid ${turn === 'me' ? colors.burgundy : colors.wine}`,
              borderRadius: 10, fontSize: 13, fontWeight: 700,
              color: turn === 'me' ? colors.burgundyDeep : colors.wineDeep,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>{turn === 'me' ? '🎙️ עכשיו תורך לענות' : `🎙️ ${partner?.name?.split(' ')[0]} עונה`}</span>
              {turn === 'me' && (
                <button onClick={nextTurn} style={{
                  background: colors.burgundy, color: 'white',
                  borderRadius: 8, padding: '5px 10px',
                  fontSize: 12, fontWeight: 800,
                  border: 'none', cursor: 'pointer',
                }}>סיימתי</button>
              )}
            </div>
          </div>
        )}

        {/* Free mode banner */}
        {mode === 'free' && (
          <div style={{
            position: 'absolute', bottom: 10, left: 10, right: 10,
            background: 'rgba(255,216,107,.96)', color: colors.ink,
            borderRadius: 18, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
            zIndex: 10,
          }}>
            <div style={{ fontSize: 28 }}>💡</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>סיימתם את השאלות 🎉</div>
              <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>עכשיו זמן חופשי לדבר</div>
            </div>
          </div>
        )}

        {/* Questionnaire invite popup */}
        {mode === 'invite' && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(20,15,12,.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, zIndex: 20,
          }}>
            <div style={{
              background: 'white', color: colors.ink,
              borderRadius: 22, padding: '20px 20px 16px',
              boxShadow: '0 8px 0 rgba(0,0,0,.3)',
              border: `3px solid ${colors.ink}`,
              maxWidth: 340, textAlign: 'center',
            }}>
              <div style={{ fontSize: 42, marginBottom: 8 }}>💡</div>
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
                לשחק שאלון היכרות?
              </div>
              <div style={{ fontSize: 15, color: colors.ink2, marginTop: 8, lineHeight: 1.4 }}>
                5 שאלות נחמדות. כל אחד/ת עונה דקה בתור,
                ואז יש זמן חופשי לדבר.
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setMode('chat')} className="big-btn big-btn--ghost" style={{ flex: 1, fontSize: 16, minHeight: 52 }}>
                  לא, רק נדבר
                </button>
                <button onClick={() => setMode('playing')} className="big-btn big-btn--primary" style={{ flex: 1.4, fontSize: 16, minHeight: 52 }}>
                  כן, בואי!
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls — fixed at bottom, always visible */}
      <div style={{
        flexShrink: 0,
        padding: '10px 14px calc(10px + env(safe-area-inset-bottom)) 14px',
        background: 'rgba(0,0,0,.40)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        gap: 8,
      }}>
        {/* Mute */}
        <button
          onClick={toggleMute}
          style={{
            width: 60, height: 60, borderRadius: '50%',
            background: muted ? 'white' : 'rgba(255,255,255,.18)',
            color: muted ? colors.ink : 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, border: 'none', cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label={muted ? 'בטל השתקה' : 'השתק'}
        >
          {muted ? '🔇' : '🎙️'}
        </button>

        {/* Video toggle */}
        <button
          onClick={toggleVideo}
          style={{
            width: 60, height: 60, borderRadius: '50%',
            background: videoOff ? 'white' : 'rgba(255,255,255,.18)',
            color: videoOff ? colors.ink : 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, border: 'none', cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label={videoOff ? 'הפעל וידאו' : 'כבה וידאו'}
        >
          {videoOff ? '📵' : '📹'}
        </button>

        {/* Questionnaire button */}
        {mode === 'chat' && (
          <button
            onClick={() => setMode('invite')}
            style={{
              width: 60, height: 60, borderRadius: '50%',
              background: colors.mustard,
              color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, border: 'none', cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="שאלון היכרות"
          >💡</button>
        )}

        {/* End call */}
        <button
          onClick={onEnd}
          style={{
            width: 66, height: 66, borderRadius: '50%',
            background: colors.danger || '#DC2626',
            color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, border: 'none', cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="סיום שיחה"
        >📞</button>
      </div>
    </div>
  )
}

// ─── Main KafePage ────────────────────────────────────────────
export default function KafePage({ onEnd }) {
  const { cafePartner, livekitToken, livekitRoom, cafeSession, clearCafe } = useSessionStore()
  const { profile } = useUserStore()
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')

  const handleEnd = async () => {
    if (cafeSession?.id) {
      await endCafeSession(cafeSession.id).catch(console.error)
    }
    clearCafe()
    onEnd?.()
  }

  if (error) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 20, padding: 24,
        background: colors.bgApp,
        zIndex: 1000,
      }}>
        <div style={{ fontSize: 48 }}>😕</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: colors.ink, textAlign: 'center' }}>
          לא הצלחנו להתחבר
        </div>
        <div style={{ fontSize: 16, color: colors.ink2, textAlign: 'center' }}>{error}</div>
        <button onClick={handleEnd} className="big-btn big-btn--primary" style={{ width: '100%', maxWidth: 320 }}>
          חזרה
        </button>
      </div>
    )
  }

  if (!livekitToken || !livekitRoom) {
    return <ConnectingScreen partner={cafePartner} onCancel={handleEnd} />
  }

  return (
    <>
      {!connected && <ConnectingScreen partner={cafePartner} onCancel={handleEnd} />}
      <LiveKitRoom
        serverUrl={LIVEKIT_URL}
        token={livekitToken}
        connect={true}
        video={true}
        audio={true}
        onConnected={() => setConnected(true)}
        onDisconnected={handleEnd}
        onError={(e) => setError(e.message)}
        style={{ display: connected ? 'block' : 'none' }}
      >
        <CallUI
          partner={cafePartner}
          sessionId={cafeSession?.id}
          onEnd={handleEnd}
        />
      </LiveKitRoom>
    </>
  )
}
