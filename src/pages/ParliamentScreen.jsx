// src/pages/ParliamentScreen.jsx
// ─────────────────────────────────────────────────────────────
// פרלמנט — דיון קבוצתי מסונכרן עם וידאו/אודיו דרך LiveKit.
//
// סנכרון: מצב הדיון (שלב, דובר נוכחי, זמן) נשמר ב-Firestore תחת
// השדה `discussion` במסמך ה-session. ה"מארח" (המשתתף הראשון לפי
// סדר א"ב של ה-identity) הוא היחיד שמקדם את המצב. כל השאר רק
// מאזינים — כך כולם רואים בדיוק את אותו דובר ואותו טיימר.
//
// זרימה:
//   INTRO        → המארח מגריל סדר דוברים רנדומלי ולוחץ "התחל"
//   SPEAKER      → כל דובר 60 שניות, כולם חוץ ממנו מושתקים
//   OPEN_FLOOR   → 90 שניות, כולם יכולים לדבר
//   → נושא הבא, חוזר ל-SPEAKER
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useMemo } from 'react'
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
import {
  leaveParliamentSession,
  updateParliamentState,
  watchParliamentSession,
} from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'
import AddFriendButton from '../components/AddFriendButton.jsx'
import { colors } from '../design-system/index.js'

// extract the real uid from a LiveKit identity "<uid>__<random>"
function uidFromIdentity(identity) {
  if (!identity) return ''
  return String(identity).split('__')[0]
}

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://your-project.livekit.cloud'

const SPEAKER_DURATION = 60       // שניות לכל דובר
const OPEN_FLOOR_DURATION = 90    // שניות שיחה חופשית

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

// ─── Connecting screen ───────────────────────────────────────
function ConnectingScreen({ onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(180deg, #1B2540 0%, #0E1730 100%)',
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
        <div style={{ fontSize: 96 }}>🏛</div>
        <div style={{ textAlign: 'center' }}>
          <div className="h-display" style={{ fontSize: 30 }}>הפרלמנט</div>
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

// ─── Parliament UI ───────────────────────────────────────────
// אייקוני בקרת שיחה (SVG מצויר ידנית — לא אמוג'י)
function CtrlIcon({ id, size = 26, color = '#FBF7EE' }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', style: { display: 'block' } }
  switch (id) {
    case 'mic':
      return (
        <svg {...common}>
          <rect x="9" y="2.5" width="6" height="11" rx="3" fill={color} />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="17.5" x2="12" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <line x1="8.5" y1="21" x2="15.5" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'mic-off':
      return (
        <svg {...common}>
          <rect x="9" y="2.5" width="6" height="11" rx="3" fill="none" stroke={color} strokeWidth="2" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="17.5" x2="12" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <line x1="8.5" y1="21" x2="15.5" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <line x1="4" y1="3.2" x2="20" y2="21" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      )
    case 'camera':
      return (
        <svg {...common}>
          <rect x="2.5" y="6.5" width="12" height="11" rx="3.5" fill={color} />
          <path d="M14.8 11.1l5.2-3.3v8.6l-5.2-3.3z" fill={color} />
        </svg>
      )
    case 'camera-off':
      return (
        <svg {...common}>
          <rect x="2.5" y="6.5" width="12" height="11" rx="3.5" fill="none" stroke={color} strokeWidth="2" />
          <path d="M14.8 11.1l5.2-3.3v8.6l-5.2-3.3z" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          <line x1="4" y1="3.2" x2="20" y2="21" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      )
    case 'handoff':
      return (
        <svg {...common}>
          <rect x="3" y="5.5" width="2.3" height="13" rx="1.1" fill={color} />
          <path d="M13 5.5 L5.7 12 L13 18.5 Z" fill={color} />
          <path d="M20.3 5.5 L13 12 L20.3 18.5 Z" fill={color} />
        </svg>
      )
    case 'next-topic':
      return (
        <svg {...common}>
          <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M19.8 3.5V8H15.3" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'hangup':
      return (
        <svg {...common}>
          <g transform="rotate(133 12 12)">
            <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.5 21 3 13.5 3 4c0-.6.4-1 1-1h3.2c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1z" fill={color} />
          </g>
        </svg>
      )
    default:
      return null
  }
}

function ParliamentUI({ onEnd, sessionId, me }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  )
  const participants = useParticipants()
  const { localParticipant } = useLocalParticipant()

  // local UI controls
  const [muted, setMuted] = useState(false)
  const [videoOff, setVideoOff] = useState(false)

  // discussion state — synced from Firestore
  const [discussion, setDiscussion] = useState(null)
  // local ticking clock (for smooth countdown display)
  const [now, setNow] = useState(Date.now())

  const tickRef = useRef(null)
  const hostActionRef = useRef(false)

  // ── Who is the host? The participant whose identity sorts first.
  // Deterministic — every client computes the same host.
  const sortedIdentities = useMemo(
    () => participants.map(p => p.identity).sort(),
    [participants]
  )
  const hostIdentity = sortedIdentities[0]
  const myIdentity = localParticipant?.identity
  const isHost = myIdentity && myIdentity === hostIdentity

  // ── Watch the discussion state from Firestore ──────────────
  useEffect(() => {
    if (!sessionId) return
    const unsub = watchParliamentSession(sessionId, (session) => {
      if (session?.discussion) {
        setDiscussion(session.discussion)
      }
    })
    return () => unsub && unsub()
  }, [sessionId])

  // ── Local clock tick (updates the visible countdown) ───────
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(tickRef.current)
  }, [])

  // ── Derived values ─────────────────────────────────────────
  const phase = discussion?.phase || PHASES.INTRO
  const topicIdx = discussion?.topicIdx || 0
  const currentTopic = TOPICS[topicIdx % TOPICS.length]
  const speakerOrder = discussion?.speakerOrder || []
  const speakerPos = discussion?.speakerPos || 0
  const currentSpeakerIdentity = speakerOrder[speakerPos]
  const turnEndsAt = discussion?.turnEndsAt || 0

  const secondsLeft = Math.max(0, Math.ceil((turnEndsAt - now) / 1000))
  const isMyTurn = phase === PHASES.SPEAKER && currentSpeakerIdentity === myIdentity

  const currentSpeaker = participants.find(p => p.identity === currentSpeakerIdentity)

  // ── HOST: advance the discussion when a turn's time is up ──
  useEffect(() => {
    if (!isHost || !sessionId || !discussion) return
    if (phase === PHASES.INTRO) return
    if (secondsLeft > 0) return
    if (hostActionRef.current) return

    // time is up — host advances the state
    hostActionRef.current = true

    const advance = async () => {
      if (phase === PHASES.SPEAKER) {
        if (speakerPos < speakerOrder.length - 1) {
          // next speaker
          await updateParliamentState(sessionId, {
            ...discussion,
            speakerPos: speakerPos + 1,
            turnEndsAt: Date.now() + SPEAKER_DURATION * 1000,
          })
        } else {
          // all spoke → open floor
          await updateParliamentState(sessionId, {
            ...discussion,
            phase: PHASES.OPEN_FLOOR,
            turnEndsAt: Date.now() + OPEN_FLOOR_DURATION * 1000,
          })
        }
      } else if (phase === PHASES.OPEN_FLOOR) {
        // next topic — re-shuffle speaker order
        const order = shuffle(participants.map(p => p.identity))
        await updateParliamentState(sessionId, {
          phase: PHASES.SPEAKER,
          topicIdx: (topicIdx + 1) % TOPICS.length,
          speakerOrder: order,
          speakerPos: 0,
          turnEndsAt: Date.now() + SPEAKER_DURATION * 1000,
        })
      }
      hostActionRef.current = false
    }
    advance()
    // eslint-disable-next-line
  }, [isHost, secondsLeft, phase, discussion, sessionId])

  // ── Microphone control — follows the synced phase/turn ─────
  useEffect(() => {
    if (!localParticipant) return
    let shouldSpeak = false
    if (phase === PHASES.SPEAKER)      shouldSpeak = isMyTurn && !muted
    else if (phase === PHASES.OPEN_FLOOR) shouldSpeak = !muted
    else                                shouldSpeak = false
    localParticipant.setMicrophoneEnabled(shouldSpeak).catch(console.error)
  }, [phase, isMyTurn, muted, localParticipant])

  // ── Host starts the discussion ─────────────────────────────
  const startDiscussion = async () => {
    if (!sessionId) return
    const order = shuffle(participants.map(p => p.identity))
    await updateParliamentState(sessionId, {
      phase: PHASES.SPEAKER,
      topicIdx: 0,
      speakerOrder: order,
      speakerPos: 0,
      turnEndsAt: Date.now() + SPEAKER_DURATION * 1000,
    })
  }

  // ── Host skips the current speaker ─────────────────────────
  const skipSpeaker = async () => {
    if (!isHost || !sessionId || !discussion) return
    hostActionRef.current = true
    if (speakerPos < speakerOrder.length - 1) {
      await updateParliamentState(sessionId, {
        ...discussion,
        speakerPos: speakerPos + 1,
        turnEndsAt: Date.now() + SPEAKER_DURATION * 1000,
      })
    } else {
      await updateParliamentState(sessionId, {
        ...discussion,
        phase: PHASES.OPEN_FLOOR,
        turnEndsAt: Date.now() + OPEN_FLOOR_DURATION * 1000,
      })
    }
    hostActionRef.current = false
  }

  // ── Host moves to next topic ───────────────────────────────
  const nextTopic = async () => {
    if (!isHost || !sessionId) return
    hostActionRef.current = true
    const order = shuffle(participants.map(p => p.identity))
    await updateParliamentState(sessionId, {
      phase: PHASES.SPEAKER,
      topicIdx: (topicIdx + 1) % TOPICS.length,
      speakerOrder: order,
      speakerPos: 0,
      turnEndsAt: Date.now() + SPEAKER_DURATION * 1000,
    })
    hostActionRef.current = false
  }

  const toggleMute = () => setMuted(m => !m)
  const toggleVideo = async () => {
    if (!localParticipant) return
    const next = !videoOff
    setVideoOff(next)
    try { await localParticipant.setCameraEnabled(!next) } catch(e) { console.error(e) }
  }

  const formatTime = s => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`
  const getTrackFor = (p) => tracks.find(t => t.participant?.identity === p?.identity)

  // ════════════════════════════════════════════════════════════
  // INTRO SCREEN
  // ════════════════════════════════════════════════════════════
  if (phase === PHASES.INTRO) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'linear-gradient(180deg, #1B2540 0%, #0E1730 100%)',
        color: '#FBF7EE',
        display: 'flex', flexDirection: 'column',
        padding: '16px 20px',
        zIndex: 1000, overflowY: 'auto', direction: 'rtl',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20,
        }}>
          <button onClick={onEnd} style={{
            background: 'rgba(255,255,255,0.12)', color: '#FBF7EE',
            border: 'none', padding: '10px 16px', borderRadius: 999,
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>✕ יציאה</button>
          <h1 className="h-display" style={{ fontSize: 22, margin: 0 }}>🏛 הפרלמנט</h1>
          <div style={{
            background: 'rgba(255,255,255,0.15)', padding: '5px 13px',
            borderRadius: 999, fontSize: 12, fontWeight: 700,
          }}>מבוא</div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.10)', borderRadius: 22,
          padding: '24px 20px', marginBottom: 20, textAlign: 'center',
          border: '1px solid rgba(255,255,255,0.12)',
        }}>
          <div style={{
            fontSize: 12, color: 'rgba(255,255,255,0.65)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12,
            fontWeight: 700,
          }}>נושא הדיון</div>
          <h2 className="h-display" style={{ fontSize: 22, margin: 0, lineHeight: 1.4 }}>
            {currentTopic}
          </h2>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
          marginBottom: 16, fontSize: 16,
        }}>
          <span className="live-dot" style={{ background: '#4ADE80' }}/>
          <strong>{participants.length}</strong>
          {participants.length === 1 ? ' משתתף בחדר' : ' משתתפים בחדר'}
        </div>

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 14,
          justifyContent: 'center', marginBottom: 24,
        }}>
          {participants.map(p => {
            const pUid = uidFromIdentity(p.identity)
            const isMe = p.identity === myIdentity
            return (
              <div key={p.identity} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}>
                <Avatar name={p.name || p.identity} size={56} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                  {p.name || 'משתתף'}
                </span>
                {/* צרף לחבר — לא מוצג לעצמי */}
                {!isMe && me?.uid && pUid && (
                  <AddFriendButton
                    me={me}
                    target={{ uid: pUid, name: p.name || 'משתתף' }}
                    compact
                  />
                )}
              </div>
            )
          })}
        </div>

        <div style={{
          textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.6)',
          marginBottom: 24, lineHeight: 1.6,
        }}>
          {participants.length === 1 ? (
            <>אתה לבד בחדר כרגע — מצב בדיקה<br/>תוכל להתחיל את הדיון בכל זאת</>
          ) : (
            <>כל משתתף יקבל {SPEAKER_DURATION} שניות לדבר<br/>
            ולאחר מכן {OPEN_FLOOR_DURATION} שניות שיחה חופשית</>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {isHost ? (
          <button onClick={startDiscussion} className="big-btn" style={{
            width: '100%',
            background: '#FBF7EE', color: '#1B2540',
            boxShadow: '0 8px 20px -6px rgba(0,0,0,.4)',
          }}>
            התחל דיון
          </button>
        ) : (
          <div style={{
            width: '100%', padding: '16px', borderRadius: 18,
            background: 'rgba(255,255,255,0.10)',
            textAlign: 'center', fontSize: 16, fontWeight: 600,
          }}>
            ⏳ ממתינים שמנהל הדיון יתחיל...
          </div>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════
  // ACTIVE DISCUSSION (SPEAKER / OPEN_FLOOR)
  // ════════════════════════════════════════════════════════════
  const totalDuration = phase === PHASES.SPEAKER ? SPEAKER_DURATION : OPEN_FLOOR_DURATION
  const progress = (secondsLeft / totalDuration) * 100

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0E1730', color: '#FBF7EE',
      display: 'flex', flexDirection: 'column',
      zIndex: 1000, overflow: 'hidden', direction: 'rtl',
    }}>
      {/* רצועת השאלה למעלה — מקום קבוע, לא מסתירה אף משתתף */}
      <div style={{
        flexShrink: 0, background: 'rgba(0,0,0,.34)',
        padding: '10px 14px 9px', borderBottom: '1px solid rgba(255,255,255,.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap',
            background: phase === PHASES.SPEAKER ? 'rgba(79,107,74,.9)' : 'rgba(184,144,72,.92)',
            color: phase === PHASES.SPEAKER ? '#fff' : '#1B2540',
          }}>
            {phase === PHASES.SPEAKER ? `דובר ${speakerPos + 1}/${speakerOrder.length}` : '🎙️ שיחה חופשית'}
          </span>
          <span style={{
            marginInlineStart: 'auto', fontSize: 14, fontWeight: 800, padding: '3px 11px',
            borderRadius: 999, whiteSpace: 'nowrap',
            background: secondsLeft <= 10 ? '#A33B30' : 'rgba(255,255,255,.14)',
          }}>
            {formatTime(secondsLeft)}
          </span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', color: 'rgba(255,255,255,.55)', marginBottom: 3 }}>
          ❓ השאלה לדיון
        </div>
        <div style={{
          fontSize: 17, fontWeight: 800, lineHeight: 1.3, color: '#FBF7EE', marginBottom: 9,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {currentTopic}
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,.12)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`, borderRadius: 999,
            background: phase === PHASES.SPEAKER ? '#4F6B4A' : '#B89048',
            transition: 'width 0.3s linear',
          }}/>
        </div>
        {phase === PHASES.SPEAKER && speakerOrder.length > 0 && (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 7 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', fontWeight: 600, marginInlineEnd: 4 }}>תור הדוברים:</span>
            {speakerOrder.map((identity, idx) => (
              <span key={identity} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: idx === speakerPos ? '#B89048' : idx < speakerPos ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.3)',
                boxShadow: idx === speakerPos ? '0 0 0 2px rgba(184,144,72,.4)' : 'none',
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Main stage */}
      <div style={{
        flex: 1, minHeight: 0, position: 'relative',
        background: '#0E1730', overflow: 'hidden',
      }}>
        {false /* always grid - speaker highlighted inside grid */ ? (
          // ── Single speaker spotlight ──
          null
        ) : (
          // ── Open floor: grid of everyone ──
          <div style={{
            position: 'absolute', inset: 0, padding: 8,
            display: 'grid', gap: 8, gridAutoRows: '1fr',
            gridTemplateColumns: `repeat(${participants.length <= 2 ? 1 : 2}, 1fr)`,
          }}>
            {participants.map((p, i) => {
              const track = getTrackFor(p)
              const isSpeaking = phase === PHASES.SPEAKER && p.identity === currentSpeakerIdentity
              const isMe = p.identity === myIdentity
              const showMicOff = phase === PHASES.SPEAKER && !isSpeaking
              const cols = participants.length <= 2 ? 1 : 2
              const span2 = cols === 2 && participants.length % 2 === 1 && i === participants.length - 1
              return (
                <div key={p.identity} style={{
                  position: 'relative', borderRadius: 16, overflow: 'hidden', minHeight: 0,
                  background: '#1B2540',
                  border: isSpeaking ? '2px solid #B89048' : '2px solid rgba(255,255,255,.10)',
                  boxShadow: isSpeaking ? '0 0 0 3px rgba(184,144,72,.45)' : 'none',
                  gridColumn: span2 ? 'span 2' : 'auto',
                }}>
                  {track ? (
                    <ParticipantTile trackRef={track} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Avatar name={p.name || p.identity} size={64} />
                    </div>
                  )}
                  {isSpeaking && (
                    <div style={{
                      position: 'absolute', top: 7, insetInlineEnd: 7,
                      background: '#B89048', color: '#1B2540', fontSize: 11, fontWeight: 800,
                      padding: '3px 9px', borderRadius: 999,
                    }}>🎙️ מדבר/ת</div>
                  )}
                  {showMicOff && (
                    <div style={{
                      position: 'absolute', top: 7, insetInlineStart: 7,
                      background: 'rgba(163,59,48,.9)', width: 24, height: 24, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CtrlIcon id="mic-off" size={14} color="#fff" />
                    </div>
                  )}
                  <div style={{
                    position: 'absolute', bottom: 7, insetInlineEnd: 7,
                    background: isMe ? 'rgba(126,44,46,.8)' : 'rgba(0,0,0,.55)',
                    padding: '3px 9px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  }}>
                    {p.name || 'משתתף'}{isMe ? ' (אתה)' : ''}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* מצב הדיון מוצג ברצועת השאלה למעלה */}
      </div>

      {/* תור הדוברים מוצג ברצועת השאלה למעלה */}

      {/* Bottom controls */}
      <div style={{
        flexShrink: 0,
        padding: '10px 14px calc(10px + env(safe-area-inset-bottom)) 14px',
        background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        gap: 8,
      }}>
        {/* Mute */}
        <button onClick={toggleMute} style={{
          width: 60, height: 60, borderRadius: '50%',
          background: muted ? '#FBF7EE' : 'rgba(255,255,255,.18)',
          color: muted ? '#1B2540' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, border: 'none', cursor: 'pointer',
        }} aria-label={muted ? 'בטל השתקה' : 'השתק'}>
          <CtrlIcon id={muted ? 'mic-off' : 'mic'} size={26} color={muted ? '#1B2540' : '#FBF7EE'} />
        </button>

        {/* Video */}
        <button onClick={toggleVideo} style={{
          width: 60, height: 60, borderRadius: '50%',
          background: videoOff ? '#FBF7EE' : 'rgba(255,255,255,.18)',
          color: videoOff ? '#1B2540' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, border: 'none', cursor: 'pointer',
        }} aria-label={videoOff ? 'הפעל וידאו' : 'כבה וידאו'}>
          <CtrlIcon id={videoOff ? 'camera-off' : 'camera'} size={26} color={videoOff ? '#1B2540' : '#FBF7EE'} />
        </button>

        {/* Host-only: skip / next topic */}
        {isHost && phase === PHASES.SPEAKER && (
          <button onClick={skipSpeaker} style={{
            width: 60, height: 60, borderRadius: '50%',
            background: '#B89048', color: '#1B2540',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, border: 'none', cursor: 'pointer', fontWeight: 800,
          }} aria-label="דלג לדובר הבא"><CtrlIcon id="handoff" size={26} color="#1B2540" /></button>
        )}
        {isHost && phase === PHASES.OPEN_FLOOR && (
          <button onClick={nextTopic} style={{
            width: 60, height: 60, borderRadius: '50%',
            background: '#B89048', color: '#1B2540',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, border: 'none', cursor: 'pointer', fontWeight: 800,
          }} aria-label="נושא הבא"><CtrlIcon id="next-topic" size={26} color="#1B2540" /></button>
        )}

        {/* Leave */}
        <button onClick={onEnd} style={{
          width: 66, height: 66, borderRadius: '50%',
          background: '#A33B30', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, border: 'none', cursor: 'pointer',
        }} aria-label="יציאה"><CtrlIcon id="hangup" size={28} color="#fff" /></button>
      </div>

      <RoomAudioRenderer />
    </div>
  )
}

// ─── Helper: Fisher-Yates shuffle ────────────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Root component ──────────────────────────────────────────
export default function ParliamentScreen({ onExit }) {
  const { authUser, profile } = useUserStore()
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
        <div className="h-display" style={{ fontSize: 22, color: colors.ink, textAlign: 'center' }}>
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
        <ParliamentUI
          onEnd={handleEnd}
          sessionId={parliamentSession?.id}
          me={{ uid: authUser?.uid, name: profile?.name }}
        />
      </LiveKitRoom>
    </>
  )
}
