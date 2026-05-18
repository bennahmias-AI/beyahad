// src/pages/KafePage.jsx
// ─────────────────────────────────────────────────────────────
// Real 1:1 video call using LiveKit.
// Design: exact original ביחד aesthetic.
// Flow: partner info → LiveKit room → call controls → end.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import {
  LiveKitRoom,
  VideoConference,
  GridLayout,
  ParticipantTile,
  useTracks,
  RoomAudioRenderer,
  ControlBar,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Track } from 'livekit-client'
import { useSessionStore } from '../stores/sessionStore.js'
import { useUserStore } from '../stores/userStore.js'
import { endCafeSession, fetchLiveKitToken } from '../services/firebase.js'
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
      flex: 1,
      background: `linear-gradient(180deg, #1A2547 0%, #2B2A45 100%)`,
      color: 'white',
      display: 'flex', flexDirection: 'column',
      padding: '32px 24px 28px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button onClick={onCancel} style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'rgba(255,255,255,.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
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
  }, [mode, turn, qIndex])

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

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <div style={{
      flex: 1,
      background: 'linear-gradient(180deg, #1A2547 0%, #1A2547 100%)',
      color: 'white',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px',
        background: 'rgba(0,0,0,.30)',
      }}>
        <div style={{ fontSize: 22 }}>☕</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 600 }}>קפה בסלון · אחד על אחד</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{partner?.name}</div>
        </div>
        <div style={{
          background: 'rgba(0,0,0,.30)', borderRadius: 999,
          padding: '6px 12px', fontSize: 14, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span className="live-dot" style={{ background: '#4ADE80' }}/>
          {mm}:{ss}
        </div>
      </div>

      {/* Video area - LiveKit grid */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <GridLayout tracks={tracks} style={{ height: '100%' }}>
          <ParticipantTile />
        </GridLayout>
        <RoomAudioRenderer />

        {/* Question card - playing mode */}
        {mode === 'playing' && (
          <div style={{
            position: 'absolute', bottom: 10, left: 10, right: 10,
            background: 'white', color: colors.ink,
            borderRadius: 22, padding: '16px 18px',
            boxShadow: '0 8px 0 #1A2547',
            border: `2px solid ${colors.gold}`,
            zIndex: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: colors.mustard, color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800,
                }}>{qIndex + 1}</div>
                <div style={{ fontSize: 13, color: colors.ink3, fontWeight: 700 }}>
                  שאלה {qIndex + 1} מתוך {KAFE_QUESTIONS.length}
                </div>
              </div>
              <div style={{
                background: turnLeft <= 10 ? colors.danger : colors.surface2,
                color: turnLeft <= 10 ? 'white' : colors.ink,
                borderRadius: 999, padding: '4px 10px',
                fontSize: 14, fontWeight: 800,
              }}>
                0:{String(turnLeft).padStart(2, '0')}
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.3 }}>
              {KAFE_QUESTIONS[qIndex]}
            </div>
            <div style={{
              marginTop: 10, padding: '8px 12px',
              background: turn === 'me' ? colors.burgundySoft : colors.wineSoft,
              border: `2px solid ${turn === 'me' ? colors.burgundy : colors.wine}`,
              borderRadius: 12, fontSize: 14, fontWeight: 700,
              color: turn === 'me' ? colors.burgundyDeep : colors.wineDeep,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>{turn === 'me' ? '🎙️ עכשיו תורך לענות' : `🎙️ ${partner?.name?.split(' ')[0]} עונה`}</span>
              {turn === 'me' && (
                <button onClick={nextTurn} style={{
                  background: colors.burgundy, color: 'white',
                  borderRadius: 10, padding: '6px 12px',
                  fontSize: 13, fontWeight: 800, minHeight: 'unset',
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
            borderRadius: 22, padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: 12,
            zIndex: 10,
          }}>
            <div style={{ fontSize: 32 }}>💡</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>סיימתם את השאלות 🎉</div>
              <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.85 }}>עכשיו זמן חופשי לדבר</div>
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
              borderRadius: 24, padding: '22px 22px 18px',
              boxShadow: '0 8px 0 #1A2547',
              border: `3px solid ${colors.ink}`,
              maxWidth: 340, textAlign: 'center',
            }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>💡</div>
              <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
                לשחק שאלון היכרות?
              </div>
              <div style={{ fontSize: 16, color: colors.ink2, marginTop: 8, lineHeight: 1.4 }}>
                5 שאלות נחמדות. כל אחד/ת עונה דקה בתור,
                ואז יש זמן חופשי לדבר.
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button onClick={() => setMode('chat')} className="big-btn big-btn--ghost" style={{ flex: 1, fontSize: 18, minHeight: 58 }}>
                  לא, רק נדבר
                </button>
                <button onClick={() => setMode('playing')} className="big-btn big-btn--primary" style={{ flex: 1.4, fontSize: 18, minHeight: 58 }}>
                  כן, בואי!
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        padding: '12px 18px 16px',
        background: 'rgba(0,0,0,.30)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Mute */}
        <button
          onClick={() => setMuted(m => !m)}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: muted ? 'white' : 'rgba(255,255,255,.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, minHeight: 'unset',
          }}
          aria-label={muted ? 'בטל השתקה' : 'השתק'}
        >
          {muted ? '🔇' : '🎙️'}
        </button>

        {/* Video toggle */}
        <button
          onClick={() => setVideoOff(v => !v)}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: videoOff ? 'white' : 'rgba(255,255,255,.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, minHeight: 'unset',
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
              width: 72, height: 72, borderRadius: '50%',
              background: colors.mustard,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, minHeight: 'unset',
              boxShadow: `0 3px 0 ${colors.mustardDeep}`,
            }}
            aria-label="שאלון היכרות"
          >💡</button>
        )}

        {/* End call */}
        <button
          onClick={onEnd}
          style={{
            width: 76, height: 76, borderRadius: '50%',
            background: colors.danger,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, minHeight: 'unset',
            boxShadow: `0 4px 0 ${colors.burgundyDeep}`,
          }}
          aria-label="סיום שיחה"
        >📵</button>
      </div>

      {/* Labels */}
      <div style={{
        display: 'flex', justifyContent: 'space-around',
        padding: '0 10px 10px',
        fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.7)',
      }}>
        <span style={{ width: 72, textAlign: 'center' }}>{muted ? 'מבוטל' : 'השתק'}</span>
        <span style={{ width: 72, textAlign: 'center' }}>וידאו</span>
        {mode === 'chat' && <span style={{ width: 72, textAlign: 'center' }}>שאלון</span>}
        <span style={{ width: 76, textAlign: 'center' }}>סיום</span>
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
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 20, padding: 24,
        background: colors.bgApp,
      }}>
        <div style={{ fontSize: 48 }}>😕</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: colors.ink, textAlign: 'center' }}>
          לא הצלחנו להתחבר
        </div>
        <div style={{ fontSize: 16, color: colors.ink2, textAlign: 'center' }}>{error}</div>
        <button onClick={handleEnd} className="big-btn big-btn--primary" style={{ width: '100%' }}>
          חזרה
        </button>
      </div>
    )
  }

  if (!livekitToken || !livekitRoom) {
    return <ConnectingScreen partner={cafePartner} onCancel={handleEnd} />
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {!connected && <ConnectingScreen partner={cafePartner} onCancel={handleEnd} />}

      <div style={{ flex: 1, display: connected ? 'flex' : 'none', flexDirection: 'column' }}>
        <LiveKitRoom
          serverUrl={LIVEKIT_URL}
          token={livekitToken}
          connect={true}
          video={true}
          audio={true}
          onConnected={() => setConnected(true)}
          onDisconnected={handleEnd}
          onError={(e) => setError(e.message)}
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        >
          <CallUI
            partner={cafePartner}
            sessionId={cafeSession?.id}
            onEnd={handleEnd}
          />
        </LiveKitRoom>
      </div>
    </div>
  )
}
