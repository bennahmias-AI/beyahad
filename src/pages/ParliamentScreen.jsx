// src/pages/ParliamentScreen.jsx
// ─────────────────────────────────────────────────────────────
// פרלמנט - דיון קבוצתי עם וידאו ואודיו אמיתי דרך LiveKit
// 3 שלבים: מבוא -> סיבוב דוברים -> רצפה פתוחה
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import {
  LiveKitRoom,
  ParticipantTile,
  useTracks,
  useParticipants,
  RoomAudioRenderer,
  useLocalParticipant,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Track } from 'livekit-client'
import { useSessionStore } from '../stores/sessionStore.js'
import { useUserStore } from '../stores/userStore.js'
import { leaveParliamentSession } from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'
import { colors } from '../design-system/index.js'

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://your-project.livekit.cloud'

const SPEAKER_DURATION = 60
const OPEN_FLOOR_DURATION = 90

const TOPICS = [
  'האם לשמור על קשר קבוע עם הנכדים?',
  'מה הספר הכי טוב שקראתם השנה?',
  'איך מתמודדים עם בדידות בערב?',
  'מה הזיכרון הכי יפה מהילדות?',
  'האם חשוב להמשיך ללמוד דברים חדשים בגיל הזה?',
  'מה הייתם משנים בעולם של היום?',
  'איזה תחביב חדש הייתם רוצים לנסות?',
]

const PHASES = { INTRO: 'intro', SPEAKER: 'speaker', OPEN_FLOOR: 'open_floor' }

function ConnectingScreen({ onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(180deg, #1A2547 0%, #2B2A45 100%)',
      color: 'white',
      display: 'flex', flexDirection: 'column',
      padding: '32px 24px 28px',
      zIndex: 1000,
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button onClick={onCancel} style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'rgba(255,255,255,.12)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, border: 'none', cursor: 'pointer',
        }}>←</button>
      </div>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <div style={{ fontSize: 96 }}>🏛</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 800 }}>הפרלמנט</div>
          <div style={{ fontSize: 18, opacity: 0.8, marginTop: 6 }}>
            מתחברים לחדר הדיון...
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

function ParliamentUI({ onEnd }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  )
  const participants = useParticipants()
  const { localParticipant } = useLocalParticipant()

  const [phase, setPhase] = useState(PHASES.INTRO)
  const [topicIdx, setTopicIdx] = useState(0)
  const [speakerIdx, setSpeakerIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState(SPEAKER_DURATION)
  const [muted, setMuted] = useState(false)
  const [videoOff, setVideoOff] = useState(false)
  const intervalRef = useRef(null)

  const currentTopic = TOPICS[topicIdx]
  const currentSpeaker = participants[speakerIdx]
  const isMyTurn = phase === PHASES.SPEAKER && currentSpeaker?.identity === localParticipant?.identity

  useEffect(() => {
    if (phase === PHASES.INTRO) return
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { handlePhaseEnd(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
    // eslint-disable-next-line
  }, [phase, speakerIdx, topicIdx])

  useEffect(() => {
    if (!localParticipant) return
    if (phase === PHASES.SPEAKER) {
      const shouldEnable = isMyTurn && !muted
      localParticipant.setMicrophoneEnabled(shouldEnable).catch(console.error)
    } else if (phase === PHASES.OPEN_FLOOR) {
      localParticipant.setMicrophoneEnabled(!muted).catch(console.error)
    } else {
      localParticipant.setMicrophoneEnabled(false).catch(console.error)
    }
    // eslint-disable-next-line
  }, [phase, isMyTurn, muted, localParticipant])

  const handlePhaseEnd = () => {
    clearInterval(intervalRef.current)
    if (phase === PHASES.SPEAKER) {
      if (speakerIdx < participants.length - 1) {
        setSpeakerIdx(speakerIdx + 1)
        setTimeLeft(SPEAKER_DURATION)
      } else {
        setPhase(PHASES.OPEN_FLOOR)
        setTimeLeft(OPEN_FLOOR_DURATION)
      }
    } else if (phase === PHASES.OPEN_FLOOR) {
      nextTopic()
    }
  }

  const startDiscussion = () => {
    setPhase(PHASES.SPEAKER)
    setSpeakerIdx(0)
    setTimeLeft(SPEAKER_DURATION)
  }

  const nextTopic = () => {
    clearInterval(intervalRef.current)
    setTopicIdx((topicIdx + 1) % TOPICS.length)
    setSpeakerIdx(0)
    setPhase(PHASES.SPEAKER)
    setTimeLeft(SPEAKER_DURATION)
  }

  const skipSpeaker = () => {
    clearInterval(intervalRef.current)
    handlePhaseEnd()
  }

  const toggleMute = () => setMuted(!muted)

  const toggleVideo = async () => {
    if (!localParticipant) return
    const next = !videoOff
    setVideoOff(next)
    try { await localParticipant.setCameraEnabled(!next) } catch(e) { console.error(e) }
  }

  const formatTime = s => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`

  const getTrackForParticipant = (p) => {
    return tracks.find(t => t.participant?.identity === p.identity)
  }

  if (phase === PHASES.INTRO) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'linear-gradient(180deg, #0F2440 0%, #1A3A6B 100%)',
        color: '#F9F9FB',
        display: 'flex', flexDirection: 'column',
        padding: '16px 20px',
        zIndex: 1000, overflowY: 'auto', direction: 'rtl',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20,
        }}>
          <button onClick={onEnd} style={{
            background: 'rgba(255,255,255,0.1)', color: '#F9F9FB',
            border: 'none', padding: '8px 14px', borderRadius: 999,
            fontSize: 14, cursor: 'pointer',
          }}>✕ יציאה</button>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>🏛 פרלמנט</h1>
          <div style={{
            background: 'rgba(255,255,255,0.15)', padding: '4px 12px',
            borderRadius: 999, fontSize: 12,
          }}>מבוא</div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.1)', borderRadius: 24,
          padding: '24px 20px', marginBottom: 20, textAlign: 'center',
        }}>
          <div style={{
            fontSize: 12, color: 'rgba(255,255,255,0.7)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12,
          }}>נושא הדיון</div>
          <h2 style={{ fontSize: 22, fontWeight: 500, margin: 0, lineHeight: 1.4 }}>{currentTopic}</h2>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
          marginBottom: 16, fontSize: 16, color: 'rgba(255,255,255,0.95)',
        }}>
          <span style={{
            display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
            background: '#4ADE80',
          }}/>
          <strong>{participants.length}</strong> {participants.length === 1 ? 'משתתף בחדר' : 'משתתפים בחדר'}
        </div>

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12,
          justifyContent: 'center', marginBottom: 24,
        }}>
          {participants.map(p => (
            <div key={p.identity} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <Avatar name={p.name || p.identity} size={56} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
                {p.name || 'משתתף'}
              </span>
            </div>
          ))}
        </div>

        <div style={{
          textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.65)',
          marginBottom: 24, lineHeight: 1.6,
        }}>
          {participants.length === 1 ? (
            <>אתה לבד בחדר כרגע — מצב בדיקה<br/>תוכל להתחיל את הדיון בכל זאת</>
          ) : (
            <>כל משתתף יקבל {SPEAKER_DURATION} שניות לדבר<br/>ולאחר מכן {OPEN_FLOOR_DURATION} שניות שיחה פתוחה</>
          )}
        </div>

        <div style={{ flex: 1 }} />

        <button onClick={startDiscussion} style={{
          width: '100%', padding: '16px', borderRadius: 999,
          background: '#F9F9FB', color: '#1A3A6B',
          border: 'none', fontSize: 18, fontWeight: 700, cursor: 'pointer',
        }}>
          התחל דיון
        </button>
      </div>
    )
  }

  const progress = phase === PHASES.SPEAKER
    ? (timeLeft / SPEAKER_DURATION) * 100
    : (timeLeft / OPEN_FLOOR_DURATION) * 100

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0F2440', color: '#F9F9FB',
      display: 'flex', flexDirection: 'column',
      zIndex: 1000, overflow: 'hidden',
    }}>
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        background: 'rgba(0,0,0,.30)',
      }}>
        <div style={{ fontSize: 20 }}>🏛</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>
            {phase === PHASES.SPEAKER ? `דובר ${speakerIdx + 1}/${participants.length}` : 'רצפה פתוחה'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentTopic}
          </div>
        </div>
        <div style={{
          background: timeLeft <= 10 ? '#DC2626' : 'rgba(0,0,0,.30)',
          borderRadius: 999, padding: '5px 10px', fontSize: 13, fontWeight: 800,
        }}>
          {formatTime(timeLeft)}
        </div>
      </div>

      <div style={{ flexShrink: 0, height: 4, background: 'rgba(255,255,255,0.1)' }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: phase === PHASES.SPEAKER ? '#1D9E75' : '#5DCAA5',
          transition: 'width 0.5s linear',
        }}/>
      </div>

      <div style={{
        flex: 1, minHeight: 0, position: 'relative',
        background: '#0F1730', overflow: 'hidden',
      }}>
        {phase === PHASES.SPEAKER && currentSpeaker ? (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 16,
          }}>
            {getTrackForParticipant(currentSpeaker) ? (
              <div style={{
                width: '90%', maxWidth: 480, aspectRatio: '4/3',
                borderRadius: 20, overflow: 'hidden',
                border: '4px solid rgba(255,255,255,0.3)',
              }}>
                <ParticipantTile
                  trackRef={getTrackForParticipant(currentSpeaker)}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            ) : (
              <Avatar name={currentSpeaker.name || currentSpeaker.identity} size={140} />
            )}
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {currentSpeaker.name || 'משתתף'}
            </div>
            <div style={{
              padding: '6px 14px', borderRadius: 999,
              background: isMyTurn ? '#1D9E75' : 'rgba(255,255,255,0.1)',
              fontSize: 14, fontWeight: 600,
            }}>
              {isMyTurn ? '🎙️ תורך לדבר!' : '🎤 מדבר/ת עכשיו'}
            </div>
          </div>
        ) : (
          <div style={{
            position: 'absolute', inset: 0, padding: 16,
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(participants.length, 3)}, 1fr)`,
            gap: 10, alignContent: 'center',
          }}>
            {participants.map(p => {
              const track = getTrackForParticipant(p)
              return (
                <div key={p.identity} style={{
                  aspectRatio: '1', borderRadius: 16, overflow: 'hidden',
                  background: '#1A2547', position: 'relative',
                  border: '2px solid rgba(255,255,255,0.2)',
                }}>
                  {track ? (
                    <ParticipantTile trackRef={track} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Avatar name={p.name || p.identity} size={64} />
                    </div>
                  )}
                  <div style={{
                    position: 'absolute', bottom: 6, right: 6,
                    background: 'rgba(0,0,0,0.6)', padding: '2px 8px',
                    borderRadius: 999, fontSize: 11, fontWeight: 600,
                  }}>
                    {p.name || 'משתתף'}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {phase === PHASES.OPEN_FLOOR && (
          <div style={{
            position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(29,158,117,0.9)', color: 'white',
            padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700,
          }}>
            🎙️ כולם יכולים לדבר
          </div>
        )}
      </div>

      {phase === PHASES.SPEAKER && (
        <div style={{
          flexShrink: 0, display: 'flex', justifyContent: 'center', gap: 8,
          padding: '12px', background: 'rgba(0,0,0,0.3)',
        }}>
          {participants.map((p, idx) => {
            const isDone = idx < speakerIdx
            const isActive = idx === speakerIdx
            return (
              <div key={p.identity} style={{
                width: 40, height: 40, borderRadius: '50%',
                opacity: isActive ? 1 : isDone ? 0.3 : 0.5,
                boxShadow: isActive ? '0 0 0 3px #F9F9FB' : 'none',
                transition: 'all 0.3s',
              }}>
                <Avatar name={p.name || p.identity} size={40} />
              </div>
            )
          })}
        </div>
      )}

      <div style={{
        flexShrink: 0,
        padding: '10px 14px calc(10px + env(safe-area-inset-bottom)) 14px',
        background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        gap: 8,
      }}>
        <button onClick={toggleMute} style={{
          width: 60, height: 60, borderRadius: '50%',
          background: muted ? 'white' : 'rgba(255,255,255,.18)',
          color: muted ? '#1A2547' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, border: 'none', cursor: 'pointer',
        }} aria-label={muted ? 'בטל השתקה' : 'השתק'}>
          {muted ? '🔇' : '🎙️'}
        </button>

        <button onClick={toggleVideo} style={{
          width: 60, height: 60, borderRadius: '50%',
          background: videoOff ? 'white' : 'rgba(255,255,255,.18)',
          color: videoOff ? '#1A2547' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, border: 'none', cursor: 'pointer',
        }} aria-label={videoOff ? 'הפעל וידאו' : 'כבה וידאו'}>
          {videoOff ? '📵' : '📹'}
        </button>

        {phase === PHASES.SPEAKER && (
          <button onClick={skipSpeaker} style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'rgba(255,193,7,0.9)', color: '#1A2547',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, border: 'none', cursor: 'pointer', fontWeight: 800,
          }} aria-label="דלג">⏭</button>
        )}

        {phase === PHASES.OPEN_FLOOR && (
          <button onClick={nextTopic} style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'rgba(255,193,7,0.9)', color: '#1A2547',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, border: 'none', cursor: 'pointer', fontWeight: 800,
          }} aria-label="נושא הבא">🔄</button>
        )}

        <button onClick={onEnd} style={{
          width: 66, height: 66, borderRadius: '50%',
          background: '#DC2626', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, border: 'none', cursor: 'pointer',
        }} aria-label="יציאה">📞</button>
      </div>

      <RoomAudioRenderer />
    </div>
  )
}

export default function ParliamentScreen({ onExit }) {
  const { authUser } = useUserStore()
  const {
    parliamentToken, parliamentRoom, parliamentSession,
    clearParliament,
  } = useSessionStore()
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')

  const handleEnd = async () => {
    if (parliamentSession?.id && authUser?.uid) {
      await leaveParliamentSession(parliamentSession.id, authUser.uid).catch(console.error)
    }
    clearParliament()
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
        <div style={{ fontSize: 22, fontWeight: 800, color: colors.ink, textAlign: 'center' }}>
          לא הצלחנו להתחבר לפרלמנט
        </div>
        <div style={{ fontSize: 16, color: colors.ink2, textAlign: 'center' }}>{error}</div>
        <button onClick={handleEnd} className="big-btn big-btn--primary" style={{ width: '100%', maxWidth: 320 }}>
          חזרה
        </button>
      </div>
    )
  }

  if (!parliamentToken || !parliamentRoom) {
    return <ConnectingScreen onCancel={handleEnd} />
  }

  return (
    <>
      {!connected && <ConnectingScreen onCancel={handleEnd} />}
      <LiveKitRoom
        serverUrl={LIVEKIT_URL}
        token={parliamentToken}
        connect={true}
        video={true}
        audio={true}
        onConnected={() => setConnected(true)}
        onDisconnected={handleEnd}
        onError={(e) => setError(e.message)}
        style={{ display: connected ? 'block' : 'none' }}
      >
        <ParliamentUI onEnd={handleEnd} />
      </LiveKitRoom>
    </>
  )
}
