// src/pages/ArenaGame.jsx
// ─────────────────────────────────────────────────────────────
// "מלך הזירה" — דו-קרב טריוויה אונליין (2 שחקנים).
//
// הכללים:
//   • 20 שאלות בסיבוב, אותו מאגר כמו "מי רוצה להיות מיליונר".
//   • שני השחקנים רואים את אותה שאלה במקביל; כל אחד בוחר תשובה
//     בלי לראות את הבחירה של השני.
//   • עד 30 שניות לכל שאלה. מי שלא ענה בזמן — מפסיד את הסיבוב.
//   • כששניהם ענו (או שנגמר הזמן) — נחשפת התשובה הנכונה ומי ענה מה.
//   • הניקוד עולה לפי רמת הקושי (כמו במיליונר) ונצבר לאורך הסיבוב.
//   • בסוף 20 השאלות — מי שצבר יותר נקודות הוא מלך הזירה. 👑
//
// סנכרון: מצב המשחק המלא נשמר כ-JSON על מסמך החדר (arenaRooms).
// המארח (player[0]) אחראי לקדם את השאלות; שני הצדדים צופים בזמן אמת.
//
//   המאגר: ../utils/triviaQuestions.js · הצלילים: ../utils/triviaSounds.js
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { IconBackRTL } from '../icons/index.jsx'
import { GameIcon } from '../icons/gameIcons.jsx'
import { useUserStore } from '../stores/userStore.js'
import { isMuted, setMuted } from '../utils/gameSounds.js'
import { playTriviaSound, warmTriviaAudio } from '../utils/triviaSounds.js'
import Avatar from '../components/Avatar.jsx'
import { ChatPanel, ChatToast } from '../components/GameChat.jsx'
import { GameVideoProvider, PlayerVideo, VideoControls, VideoConsentGate, RemoteVideoToggles, ProfilesProvider, usePlayerProfile } from '../components/GameVideo.jsx'
import { BANK } from '../utils/triviaQuestions.js'
import {
  createArenaRoom, joinArenaRoom, startArenaGame, updateArenaState,
  watchArenaRoom, leaveArenaRoom, findOrCreateArenaMatch, sendArenaChat,
  watchFriendships, sendGameInvite, watchUser,
} from '../services/firebase.js'

// ── פלטת צבעים — אווירת שעשועון (אוברגין/זהב, תואם המיליונר) ──
const BG_DEEP   = 'linear-gradient(180deg,#2A1438 0%,#1A0C25 100%)'
const GOLD      = '#E8C879'
const GOLD_DEEP = '#C9A24A'
const CREAM     = '#F3E2BE'
const PURPLE    = '#3C2154'
const NUM_QUESTIONS = 20
const TIME_LIMIT = 30

// רמת הקושי לכל שאלה (20 שאלות — עולה בהדרגה מקל לקשה)
const DIFFICULTY_LADDER = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5]
// כמה נקודות שווה כל רמת קושי
const POINTS_BY_DIFFICULTY = { 1: 100, 2: 200, 3: 400, 4: 800, 5: 1600 }

// ── עזר: ערבוב (Fisher-Yates) ──────────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function shuffleOptions(question) {
  const correctText = question.options[question.correct]
  const shuffled = shuffle(question.options)
  return { q: question.q, options: shuffled, correct: shuffled.indexOf(correctText) }
}

// בונה 20 שאלות לפי סולם הקושי, בלי חזרות בתוך אותה רמה
function buildQuestions() {
  const usedPerDiff = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  return DIFFICULTY_LADDER.map((diff, i) => {
    const pool = BANK[diff]
    let available = pool.filter((_, idx) => !usedPerDiff[diff].includes(idx))
    if (available.length === 0) { usedPerDiff[diff] = []; available = pool }
    const pick = available[Math.floor(Math.random() * available.length)]
    usedPerDiff[diff].push(pool.indexOf(pick))
    return { ...shuffleOptions(pick), difficulty: diff, points: POINTS_BY_DIFFICULTY[diff] }
  })
}

function fmtPoints(n) {
  return (n || 0).toLocaleString('he-IL')
}

// ════════════════════════════════════════════════════════
// רכיב ראשי — מנהל את שלבי האונליין
// ════════════════════════════════════════════════════════
export default function ArenaGame({ onBack, initialRoomId, autoInviteFriend = null }) {
  const { authUser, profile } = useUserStore()
  const [mode, setMode] = useState(initialRoomId ? 'friend' : (autoInviteFriend ? 'friend' : null))
  const [numPlayers, setNumPlayers] = useState(2)
  const [roomId, setRoomId] = useState(initialRoomId || null)

  useEffect(() => { if (initialRoomId) { setMode('friend'); setRoomId(initialRoomId) } }, [initialRoomId])

  const me = { uid: authUser?.uid, name: profile?.name || 'משתמש' }

  if (!mode) {
    return <ModeSelectScreen onBack={onBack}
      onSelectRandom={(n) => { setNumPlayers(n); setMode('random') }}
      onSelectFriend={(n) => { setNumPlayers(n); setMode('friend') }} />
  }

  if (!roomId) {
    return <Lobby mode={mode} me={me} numPlayers={numPlayers} autoInviteFriend={autoInviteFriend} onBack={autoInviteFriend ? onBack : () => setMode(null)} onReady={(id) => setRoomId(id)} />
  }
  return <RoomScreen roomId={roomId} me={me} onBack={() => { setRoomId(null); setMode(null) }} onExit={onBack} />
}

// ════════════════════════════════════════════════════════
// ראש מסך — מסגרת שעשועון
// ════════════════════════════════════════════════════════
function ArenaHeader({ title, onBack, onMenu, menuOpen, menuItems }) {
  return (
    <div style={{
      background: 'linear-gradient(155deg,#4A2A66 0%,#2A1438 60%,#1A0C25 100%)',
      borderBottom: `2px solid ${GOLD_DEEP}`, padding: '14px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      boxShadow: '0 4px 12px rgba(0,0,0,.4)',
    }}>
      <button onClick={onBack} aria-label="חזרה" style={{ position: 'absolute', insetInlineStart: 14, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
        <IconBackRTL size={24} color={GOLD} />
      </button>
      <div style={{ fontFamily: "'Suez One', serif", fontSize: 22, fontWeight: 700, color: GOLD, textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>{title}</div>
      {onMenu && (
        <button onClick={onMenu} aria-label="תפריט" style={{ position: 'absolute', insetInlineEnd: 14, background: 'none', border: 'none', cursor: 'pointer', color: GOLD, padding: 4, fontSize: 24 }}>☰</button>
      )}
      {menuOpen && menuItems && (
        <div style={{ position: 'absolute', top: '100%', insetInlineEnd: 10, marginTop: 6, background: '#2a1a3c', border: `1px solid ${GOLD_DEEP}`, borderRadius: 12, padding: 6, zIndex: 50, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
          {menuItems}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מסך בחירת מצב — רנדומלי / חברים
// ════════════════════════════════════════════════════════
function ModeSelectScreen({ onBack, onSelectRandom, onSelectFriend }) {
  // step: 'mode' → בחירת יריב (רנדומלי/חבר) ; 'random-count'/'friend-count' → כמה שחקנים
  const [step, setStep] = useState('mode')

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={step === 'mode' ? onBack : () => setStep('mode')} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <div className="screen-header__title">מלך הזירה</div>
      </div>

      <div style={{ padding: '8px 20px 32px' }}>
        <div style={{ background: 'linear-gradient(135deg, #4A2A66 0%, #2A1438 100%)', borderRadius: 20, padding: '20px 18px', color: '#FBF7EE', marginBottom: 24, boxShadow: '0 8px 20px -6px rgba(42,20,56,.5)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <GameIcon id="arena" size={52} />
          </div>
          <div className="h-display" style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 6 }}>מלך הזירה</div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'rgba(255,255,255,.92)' }}>קרב טריוויה — מי שיענה נכון על יותר שאלות מנצח!</div>
        </div>

        {step === 'mode' && (
          <>
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>בחרו יריב:</h2>
            <ModeButton onClick={() => setStep('random-count')} iconId="online-random" gradient="linear-gradient(135deg, #7E2C2E, #5A1D1E)" label="יריב רנדומלי" description="התמודדו מול אנשים אקראיים באפליקציה" />
            <ModeButton onClick={() => setStep('friend-count')} iconId="online-friend" gradient="linear-gradient(135deg, #4F6B4A, #354D31)" label="הזמן חברים" description="התמודדו מול חברים מהרשימה שלכם" />
          </>
        )}

        {step === 'random-count' && (
          <>
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 6px', color: 'var(--ink)' }}>כמה מתמודדים?</h2>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 12 }}>נחכה עד שיצטרפו מספיק אנשים, ואז הקרב יתחיל אוטומטית.</div>
            <CountPicker options={[2, 3]} labels={['2 מתמודדים', '3 מתמודדים']} onPick={(n) => onSelectRandom(n)} />
          </>
        )}

        {step === 'friend-count' && (
          <>
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 6px', color: 'var(--ink)' }}>כמה מתמודדים?</h2>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 12 }}>בחרו אם תשחקו אחד על אחד או שלושה.</div>
            <CountPicker options={[2, 3]} labels={['2 מתמודדים (אתה + חבר)', '3 מתמודדים (אתה + 2 חברים)']} onPick={(n) => onSelectFriend(n)} />
          </>
        )}
      </div>
    </div>
  )
}

function CountPicker({ options, labels, onPick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {options.map((n, i) => (
        <button key={n} onClick={() => onPick(n)} style={{
          width: '100%', textAlign: 'right', background: 'var(--surface)',
          border: '1px solid var(--line)', borderRadius: 16, padding: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
        }}>
          <span className="h-display" style={{ fontSize: 18, color: 'var(--ink)' }}>{labels[i]}</span>
          <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', background: 'linear-gradient(135deg,#4A2A66,#2A1438)', borderRadius: 10, padding: '5px 9px' }}>
            {Array.from({ length: n }).map((_, k) => <GameIcon key={k} id="arena" size={20} />)}
          </span>
        </button>
      ))}
    </div>
  )
}

function ModeButton({ onClick, iconId, gradient, label, description }) {
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '16px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <GameIcon id={iconId} size={34} />
      </div>
      <div style={{ flex: 1 }}>
        <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)', lineHeight: 1.15 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginTop: 2 }}>{description}</div>
      </div>
      <IconBackRTL size={20} color="#8389A4" />
    </button>
  )
}

// ════════════════════════════════════════════════════════
// Lobby — חיפוש רנדומלי / רשימת חברים
// ════════════════════════════════════════════════════════
function Lobby({ mode, me, numPlayers = 2, onBack, onReady, autoInviteFriend = null }) {
  const [phase, setPhase] = useState(mode === 'random' ? 'searching' : 'friend-list')
  const [errorMsg, setErrorMsg] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [friends, setFriends] = useState([])
  const startedRef = useRef(false)
  const autoInvitedRef = useRef(false)

  useEffect(() => {
    if (mode !== 'friend' || !me.uid) return
    const unsub = watchFriendships(me.uid, ({ friends }) => setFriends(friends))
    return () => unsub && unsub()
  }, [mode, me.uid])

  // הזמנה אוטומטית — כשהגיעו מ"משחק עם חבר" בדף החברים
  useEffect(() => {
    if (!autoInviteFriend || autoInvitedRef.current || !me.uid) return
    autoInvitedRef.current = true
    inviteFriend(autoInviteFriend)
    // eslint-disable-next-line
  }, [autoInviteFriend, me.uid])

  useEffect(() => {
    if (mode !== 'random' || startedRef.current) return
    startedRef.current = true
    ;(async () => {
      if (!me.uid) { setErrorMsg('צריך להיות מחובר'); setPhase('error'); return }
      try {
        const { roomId } = await findOrCreateArenaMatch({ player: me, maxPlayers: numPlayers })
        onReady(roomId)
      } catch (e) {
        console.error('arena match error:', e)
        setErrorMsg('לא הצלחנו למצוא יריב — נסו שוב')
        setPhase('error')
      }
    })()
  }, [mode]) // eslint-disable-line

  useEffect(() => {
    if (phase !== 'searching') return
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  const inviteFriend = async (friend) => {
    if (!me.uid) return
    setErrorMsg('')
    try {
      const { roomId } = await createArenaRoom({ host: me, roomType: 'private', maxPlayers: numPlayers })
      await sendGameInvite({
        from: me, to: { uid: friend.otherUid, name: friend.otherName },
        gameType: 'arena', roomId,
      })
      onReady(roomId)
    } catch (e) {
      console.error('inviteFriend error:', e)
      setErrorMsg('לא הצלחנו לשלוח הזמנה')
      setPhase('error')
    }
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  if (phase === 'searching') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: BG_DEEP, color: 'white', display: 'flex', flexDirection: 'column', padding: '32px 24px 28px', direction: 'rtl', zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={onBack} style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.12)', color: 'white', border: 'none', fontSize: 22, cursor: 'pointer' }}>←</button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
          <div style={{ fontSize: 72 }}>👑</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Suez One', serif" }}>{numPlayers >= 3 ? 'מחפש לך יריבים...' : 'מחפש לך יריב...'}</div>
            <div style={{ fontSize: 16, opacity: 0.85, marginTop: 8 }}>⏱ {formatTime(elapsed)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.10)', borderRadius: 16, padding: '14px 18px', fontSize: 15, textAlign: 'center', lineHeight: 1.5, maxWidth: 320 }}>💡 כשעוד מישהו ילחץ על "מלך הזירה"<br />תתחרו זה בזה</div>
        </div>
        <button onClick={onBack} className="big-btn big-btn--danger" style={{ width: '100%' }}>✕ ביטול</button>
      </div>
    )
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <div className="screen-header__title">{mode === 'random' ? 'יריב רנדומלי' : 'הזמן חבר'}</div>
      </div>
      <div style={{ padding: '20px 20px 32px' }}>
        {phase === 'friend-list' && <FriendList friends={friends} onInvite={inviteFriend} onBack={onBack} />}
        {phase === 'error' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 14 }}>😕</div>
            <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>משהו השתבש</div>
            <div style={{ fontSize: 15, color: 'var(--ink-2)', marginBottom: 18 }}>{errorMsg || 'נסו שוב'}</div>
            <button onClick={onBack} className="big-btn big-btn--primary" style={{ width: '100%' }}>חזרה</button>
          </div>
        )}
      </div>
    </div>
  )
}

function FriendList({ friends, onInvite, onBack }) {
  const [onlineMap, setOnlineMap] = useState({})
  const [profileMap, setProfileMap] = useState({})

  useEffect(() => {
    if (!friends || friends.length === 0) return
    const unsubs = friends.map(f => {
      if (!f.otherUid) return null
      return watchUser(f.otherUid, u => {
        const seen = u?.lastSeenAt
        const seenMs = seen && typeof seen.toMillis === 'function' ? seen.toMillis() : 0
        const fresh = seenMs && (Date.now() - seenMs) < 2 * 60 * 1000
        const isOnline = Boolean(fresh) && ['available', 'busy'].includes(u?.status)
        setOnlineMap(prev => ({ ...prev, [f.otherUid]: isOnline }))
        const fullName = [u?.name, u?.lastName].filter(Boolean).join(' ')
        setProfileMap(prev => ({ ...prev, [f.otherUid]: { name: fullName, photoURL: u?.photoURL || null } }))
      })
    })
    return () => unsubs.forEach(u => u && u())
  }, [friends])

  if (!friends || friends.length === 0) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '36px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 14 }}>👥</div>
        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>אין לך עדיין חברים ברשימה</div>
        <div style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 20 }}>הוסיפו חברים בקפה או בפרלמנט — ואז תוכלו להזמין אותם לדו-קרב.</div>
        <button onClick={onBack} className="big-btn big-btn--ghost" style={{ width: '100%' }}>חזרה</button>
      </div>
    )
  }

  const onlineFriends = friends.filter(f => onlineMap[f.otherUid])
  const offlineFriends = friends.filter(f => !onlineMap[f.otherUid])

  return (
    <>
      <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 6px', color: 'var(--ink)' }}>הזמינו חבר לדו-קרב</h2>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 14 }}>בחרו חבר אחד שיתמודד מולכם.</div>

      {onlineFriends.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--success)', margin: '4px 2px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            מחוברים עכשיו ({onlineFriends.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {onlineFriends.map(f => <FriendRow key={f.docId} friend={f} profile={profileMap[f.otherUid]} online onInvite={() => onInvite(f)} />)}
          </div>
        </>
      )}

      {offlineFriends.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink-3)', margin: '4px 2px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--ink-3)', display: 'inline-block' }} />
            לא מחוברים ({offlineFriends.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {offlineFriends.map(f => <FriendRow key={f.docId} friend={f} profile={profileMap[f.otherUid]} online={false} onInvite={() => onInvite(f)} />)}
          </div>
        </>
      )}
    </>
  )
}

function FriendRow({ friend, profile, online, onInvite }) {
  const displayName = profile?.name || friend.otherName
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <Avatar name={displayName} size={50} online={online} photoURL={profile?.photoURL} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="h-display" style={{ fontSize: 17, color: 'var(--ink)' }}>{displayName}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: online ? 'var(--success)' : 'var(--ink-3)' }}>
          {online ? 'מחובר עכשיו' : 'לא מחובר'}
        </div>
      </div>
      <button onClick={onInvite} style={{
        background: online ? 'var(--success)' : 'var(--burgundy)',
        color: 'white', border: 'none', borderRadius: 12, padding: '11px 16px',
        fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
      }}>הזמן</button>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מסך החדר — המתנה או משחק
// ════════════════════════════════════════════════════════
function RoomScreen({ roomId, me, onBack, onExit }) {
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const joinedRef = useRef(false)

  useEffect(() => {
    if (!joinedRef.current) {
      joinedRef.current = true
      joinArenaRoom(roomId, me).catch(() => {})
    }
    const unsub = watchArenaRoom(roomId, (data) => {
      if (!data) { setError('המשחק נסגר'); return }
      setRoom(data)
    })
    return () => unsub && unsub()
  }, [roomId])

  if (error) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl', background: BG_DEEP, minHeight: '100%' }}>
        <ArenaHeader title="מלך הזירה" onBack={onExit} />
        <div style={{ padding: 24 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 20, padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 14 }}>👋</div>
            <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>{error}</div>
            <button onClick={onExit} className="big-btn big-btn--primary" style={{ width: '100%', marginTop: 12 }}>חזרה לזירה</button>
          </div>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl', background: BG_DEEP, minHeight: '100%' }}>
        <ArenaHeader title="מלך הזירה" onBack={onBack} />
        <div style={{ padding: 24, textAlign: 'center', color: CREAM }}>טוען...</div>
      </div>
    )
  }

  if (room.status === 'waiting') {
    return <WaitingRoom room={room} roomId={roomId} me={me} onBack={onBack} />
  }
  return <ArenaPlay room={room} roomId={roomId} me={me} onBack={onBack} onExit={onExit} />
}

// ════════════════════════════════════════════════════════
// חדר המתנה — שני שחקנים, התחלה אוטומטית כששניהם פה
// ════════════════════════════════════════════════════════
function ArenaWaitPlayer({ p, meUid, hostUid }) {
  const { name, photoURL } = usePlayerProfile(p.uid, p.name)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'rgba(74,42,102,.5)', border: `1px solid ${GOLD_DEEP}`,
      borderRadius: 14, padding: '12px 16px',
    }}>
      <Avatar name={name} size={42} photoURL={photoURL} />
      <div style={{ flex: 1, fontFamily: "'Suez One', serif", fontSize: 17, color: CREAM }}>
        {name}{p.uid === meUid ? ' (אתה)' : ''}
      </div>
      {p.uid === hostUid && <span style={{ fontSize: 12, color: GOLD, fontWeight: 800 }}>👑 מארח</span>}
    </div>
  )
}

function WaitingRoom({ room, roomId, me, onBack }) {
  const isHost = room.hostUid === me.uid
  const players = room.players || []
  const maxPlayers = room.maxPlayers || 2
  const isRandom = room.roomType === 'random'
  const startedRef = useRef(false)
  const [friends, setFriends] = useState([])
  const [inviteMsg, setInviteMsg] = useState('')

  // מעקב אחרי חברים — רק במשחק חברים למארח (להזמנת מתמודד נוסף ל-3)
  useEffect(() => {
    if (isRandom || !isHost || !me.uid) return
    const unsub = watchFriendships(me.uid, ({ friends }) => setFriends(friends))
    return () => unsub && unsub()
  }, [isRandom, isHost, me.uid])

  const handleStart = async () => {
    if (startedRef.current || players.length < 2) return
    startedRef.current = true
    const questions = buildQuestions()
    const scores = {}
    players.forEach(p => { scores[p.uid] = 0 })
    const gameState = {
      questions,
      current: 0,
      phase: 'question',       // 'question' | 'reveal' | 'ended'
      answers: {},             // answers[questionIndex] = { [uid]: { choice, timeMs } }
      scores,
      questionStartTs: Date.now(),
    }
    await startArenaGame(roomId, gameState)
  }

  // כשהחדר מתמלא למספר המבוקש — המארח מתחיל אוטומטית
  useEffect(() => {
    if (isHost && players.length >= maxPlayers && !startedRef.current) {
      handleStart()
    }
  }, [isHost, players.length, maxPlayers]) // eslint-disable-line

  const handleLeave = async () => {
    if (isHost) await leaveArenaRoom(roomId)
    onBack()
  }

  const inviteMore = async (friend) => {
    try {
      await sendGameInvite({ from: me, to: { uid: friend.otherUid, name: friend.otherName }, gameType: 'arena', roomId })
      setInviteMsg(`הזמנה נשלחה ל${friend.otherName} ✓`)
      setTimeout(() => setInviteMsg(''), 2500)
    } catch (e) {
      console.error('inviteMore error:', e)
      setInviteMsg('לא הצלחנו לשלוח הזמנה')
    }
  }

  const alreadyIn = new Set(players.map(p => p.uid))
  const invitableFriends = (friends || []).filter(f => !alreadyIn.has(f.otherUid))
  const canManualStart = players.length >= 2 && players.length < maxPlayers

  return (
    <div className="scroll-area" style={{ direction: 'rtl', background: BG_DEEP, minHeight: '100%' }}>
      <ArenaHeader title="חדר המתנה" onBack={handleLeave} />
      <div style={{ padding: '20px 16px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>👑</div>
          <div className="h-display" style={{ fontSize: 22, color: GOLD }}>
            ממתינים למתמודדים ({players.length}/{maxPlayers})
          </div>
          <div style={{ marginTop: 8, fontSize: 14, color: CREAM, opacity: .85 }}>
            {players.length >= maxPlayers ? 'מתחילים… 🎉' : (isRandom ? 'הקרב יתחיל אוטומטית כשיצטרפו מספיק מתמודדים' : 'הקרב יתחיל אוטומטית כשכולם יצטרפו')}
          </div>
          {room.inviteCode && (
            <div style={{ marginTop: 10, fontSize: 14, color: CREAM }}>
              קוד הזמנה: <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, color: GOLD, letterSpacing: 2 }}>{room.inviteCode}</span>
            </div>
          )}
        </div>

        <ProfilesProvider uids={players.map(p => p.uid)} myUid={me.uid}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {players.map((p) => (
            <ArenaWaitPlayer key={p.uid} p={p} meUid={me.uid} hostUid={room.hostUid} />
          ))}
          {Array.from({ length: Math.max(0, maxPlayers - players.length) }).map((_, i) => (
            <div key={`empty-${i}`} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(74,42,102,.25)', border: '1px dashed rgba(201,162,74,.4)',
              borderRadius: 14, padding: '12px 16px', color: 'rgba(243,226,190,.5)',
            }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>＋</div>
              <div style={{ fontSize: 15 }}>ממתין למתמודד…</div>
            </div>
          ))}
        </div>
        </ProfilesProvider>

        {isRandom ? (
          <div style={{ textAlign: 'center', color: CREAM, fontSize: 15, padding: '12px' }}>
            ⏳ מחפשים מתמודדים…
          </div>
        ) : isHost ? (
          <>
            {maxPlayers >= 3 && players.length < maxPlayers && invitableFriends.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: GOLD, margin: '0 2px 10px' }}>הזמן עוד מתמודד</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {invitableFriends.map(f => <FriendRow key={f.docId} friend={f} online onInvite={() => inviteMore(f)} />)}
                </div>
              </div>
            )}
            {inviteMsg && (
              <div style={{ textAlign: 'center', color: GOLD, fontSize: 14, fontWeight: 700, marginTop: 12 }}>{inviteMsg}</div>
            )}
            {canManualStart && (
              <button onClick={handleStart} style={{
                width: '100%', marginTop: 16, borderRadius: 14, padding: '15px', fontSize: 17,
                fontWeight: 800, fontFamily: 'inherit', border: 'none', cursor: 'pointer',
                background: 'linear-gradient(180deg,#f2ce6a,#c9a24a)', color: '#3a2a08',
                boxShadow: '0 4px 12px rgba(201,162,74,.4)',
              }}>▶ התחל עכשיו ({players.length} מתמודדים)</button>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', color: CREAM, fontSize: 15, padding: '12px' }}>
            ⏳ מחכים שכולם יצטרפו…
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מסך המשחק — דו-קרב הטריוויה המסונכרן
// ════════════════════════════════════════════════════════
function ArenaPlay({ room, roomId, me, onBack, onExit }) {
  const { profile } = useUserStore()
  const state = room.gameStateJson ? JSON.parse(room.gameStateJson) : null
  const [muted, setMutedState] = useState(() => isMuted())
  const [selected, setSelected] = useState(null)      // הבחירה הזמנית שלי (לפני נעילה)
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)
  const [chatOpen, setChatOpen] = useState(false)
  const [revealCount, setRevealCount] = useState(3)
  const [videoChoice, setVideoChoice] = useState(null)  // null=טרם נשאל, true/false=הבחירה
  const isHost = room.hostUid === me.uid
  const players = room.players || []
  const chat = room.chat || []

  const myIndex = state ? players.findIndex(p => p.uid === me.uid) : -1
  const others = players.filter(p => p.uid !== me.uid)
  const opponent = others[0]   // לתאימות תצוגת 2 שחקנים

  const current = state?.current ?? 0
  const phase = state?.phase ?? 'question'
  const question = state?.questions?.[current]
  const answersThisQ = (state?.answers?.[current]) || {}
  const myAnswer = answersThisQ[me.uid]
  const oppAnswer = opponent ? answersThisQ[opponent.uid] : null

  // איפוס הבחירה המקומית כשמתחלפת שאלה
  useEffect(() => {
    setSelected(null)
    setTimeLeft(TIME_LIMIT)
  }, [current, phase])

  // טיימר ספירה לאחור — רק בשלב השאלה ורק אם לא עניתי עדיין
  useEffect(() => {
    if (phase !== 'question' || myAnswer) return
    if (timeLeft <= 0) {
      // נגמר הזמן — שולחים תשובה ריקה (הפסד בסיבוב)
      submitAnswer(null)
      return
    }
    const t = setTimeout(() => {
      setTimeLeft(s => {
        if (s <= 4 && s > 1) playTriviaSound('countdown')
        else if (s <= 6 && s > 1) playTriviaSound('tick')
        return s - 1
      })
    }, 1000)
    return () => clearTimeout(t)
  }, [phase, timeLeft, myAnswer]) // eslint-disable-line

  // המארח אחראי: כשכל המתמודדים ענו → מעבר לשלב חשיפה + עדכון ניקוד
  useEffect(() => {
    if (!isHost || phase !== 'question') return
    const a = (state?.answers?.[current]) || {}
    const allAnswered = players.length >= 2 && players.every(p => a[p.uid])
    if (allAnswered) { revealAndScore(); return }
    // רשת ביטחון: אם מתמודד לא ענה (למשל התנתק) — חושפים אחרי הזמן + שהות
    const startTs = state?.questionStartTs || Date.now()
    const msLeft = (TIME_LIMIT + 4) * 1000 - (Date.now() - startTs)
    const t = setTimeout(() => revealAndScore(), Math.max(500, msLeft))
    return () => clearTimeout(t)
  }, [isHost, phase, current, room.gameStateJson]) // eslint-disable-line

  function submitAnswer(choiceIndex) {
    if (!state || phase !== 'question' || myAnswer) return
    if (choiceIndex != null) playTriviaSound('lock')
    const timeMs = Date.now() - (state.questionStartTs || Date.now())
    const next = JSON.parse(JSON.stringify(state))
    if (!next.answers[current]) next.answers[current] = {}
    next.answers[current][me.uid] = { choice: choiceIndex, timeMs }
    updateArenaState(roomId, next)
  }

  function revealAndScore() {
    if (!state || state.phase !== 'question') return
    const next = JSON.parse(JSON.stringify(state))
    const a = next.answers[current] || {}
    // מוסיפים נקודות לכל מי שענה נכון
    players.forEach(p => {
      const ans = a[p.uid]
      if (ans && ans.choice === question.correct) {
        next.scores[p.uid] = (next.scores[p.uid] || 0) + question.points
      }
    })
    next.phase = 'reveal'
    next.revealTs = Date.now()
    updateArenaState(roomId, next)
  }

  function nextQuestion() {
    const next = JSON.parse(JSON.stringify(state))
    if (current + 1 >= NUM_QUESTIONS) {
      next.phase = 'ended'
    } else {
      next.current = current + 1
      next.phase = 'question'
      next.questionStartTs = Date.now()
    }
    updateArenaState(roomId, next)
  }

  // קידום אוטומטי אחרי חשיפה — ספירה לאחור 3·2·1 לכל המתמודדים.
  // הספירה מבוססת על revealTs שנשמר במצב — כך היא זהה אצל כולם. המארח בלבד מקדם.
  const advancedRef = useRef(-1)
  const countSoundRef = useRef(-1)
  useEffect(() => {
    if (phase !== 'reveal') { setRevealCount(3); return }
    const revealTs = state?.revealTs || Date.now()
    const tick = () => {
      const left = Math.max(0, Math.ceil(3 - (Date.now() - revealTs) / 1000))
      setRevealCount(left)
      if (left > 0 && countSoundRef.current !== left) {
        countSoundRef.current = left
        playTriviaSound('tick')
      }
      if (left <= 0 && isHost && advancedRef.current !== current) {
        advancedRef.current = current
        nextQuestion()
      }
    }
    tick()
    const t = setInterval(tick, 200)
    return () => clearInterval(t)
  }, [phase, current, room.gameStateJson]) // eslint-disable-line

  // צליל חשיפה — נכון/שגוי לפי התשובה שלי
  const revealSoundedRef = useRef(-1)
  useEffect(() => {
    if (phase === 'reveal' && revealSoundedRef.current !== current) {
      revealSoundedRef.current = current
      if (myAnswer && myAnswer.choice === question.correct) playTriviaSound('correct')
      else playTriviaSound('wrong')
    }
  }, [phase, current]) // eslint-disable-line

  // צליל "שאלה חדשה" — בכל פעם שמתחילה שאלה (כולל הראשונה, שהיא matchFound)
  const roundSoundedRef = useRef(-2)
  useEffect(() => {
    if (phase !== 'question') return
    if (roundSoundedRef.current === current) return
    roundSoundedRef.current = current
    if (current === 0) playTriviaSound('matchFound')   // תחילת הדו-קרב
    else playTriviaSound('roundStart')                  // שאלה חדשה
  }, [phase, current]) // eslint-disable-line

  // צליל "מתמודד ענה" — כשמישהו אחר נועל תשובה ואני עדיין לא
  const oppAnsweredRef = useRef(0)
  const othersAnsweredCount = others.filter(o => answersThisQ[o.uid]).length
  useEffect(() => {
    if (phase !== 'question') { oppAnsweredRef.current = 0; return }
    if (othersAnsweredCount > oppAnsweredRef.current) {
      oppAnsweredRef.current = othersAnsweredCount
      if (!myAnswer) playTriviaSound('opponentAnswered')  // רק אם אני עוד לא עניתי (זה מה שיוצר מתח)
    }
  }, [othersAnsweredCount, phase]) // eslint-disable-line

  // צליל סיום — ניצחון מלכותי / תיקו
  const endSoundedRef = useRef(false)
  useEffect(() => {
    if (phase === 'ended' && !endSoundedRef.current) {
      endSoundedRef.current = true
      const my = state?.scores?.[me.uid] || 0
      const top = Math.max(...players.map(p => state?.scores?.[p.uid] || 0))
      const topCount = players.filter(p => (state?.scores?.[p.uid] || 0) === top).length
      if (my === top && topCount > 1) playTriviaSound('tie')
      else if (my === top) playTriviaSound('victory')
      else playTriviaSound('wrong')
    }
  }, [phase]) // eslint-disable-line

  // צליל הודעת צ'אט נכנסת (מהיריב, כשהחלון סגור)
  const lastChatTsRef = useRef(chat.length ? (chat[chat.length - 1].ts || 0) : 0)
  useEffect(() => {
    if (!chat.length) return
    const last = chat[chat.length - 1]
    const ts = last.ts || 0
    if (ts <= lastChatTsRef.current) return
    lastChatTsRef.current = ts
    if (last.uid !== me.uid && !chatOpen) playTriviaSound('chatPop')
  }, [chat.length]) // eslint-disable-line

  const toggleMute = () => { const n = !muted; setMutedState(n); setMuted(n); if (!n) warmTriviaAudio() }
  const handleLeave = async () => {
    try {
      if (state && state.phase !== 'ended' && state.phase !== 'left') {
        // מסמנים לשאר המתמודדים שעזבתי — הם יקבלו התראה
        const next = JSON.parse(JSON.stringify(state))
        next.phase = 'left'
        next.leftName = me.name
        await updateArenaState(roomId, next)
      } else {
        await leaveArenaRoom(roomId)
      }
    } catch (e) { /* ignore */ }
    onExit()
  }

  if (!state || !question) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl', background: BG_DEEP, minHeight: '100%' }}>
        <ArenaHeader title="מלך הזירה" onBack={onBack} />
        <div style={{ padding: 24, textAlign: 'center', color: CREAM }}>טוען את המשחק...</div>
      </div>
    )
  }

  // ── אישור וידאו — לפני שמתחילים, כל שחקן בוחר אם להפעיל וידאו
  if (videoChoice === null) {
    return (
      <div style={{ direction: 'rtl', background: BG_DEEP, minHeight: '100%' }}>
        <ArenaHeader title="מלך הזירה" onBack={handleLeave} />
        <VideoConsentGate onDecide={(use) => setVideoChoice(use)} accent="#4A2A66" accentDeep="#C9A24A" />
      </div>
    )
  }

  // ── מסך סיום ──────────────────────────────────────────
  if (phase === 'left') {
    return (
      <div style={{ direction: 'rtl', background: BG_DEEP, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
        <ArenaHeader title="מלך הזירה" onBack={handleLeave} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: '32px 26px 24px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: 60, marginBottom: 12 }}>👋</div>
            <div className="h-display" style={{ fontSize: 24, color: 'var(--ink)', marginBottom: 8 }}>
              {state.leftName ? `${state.leftName} עזב את המשחק` : 'מתמודד עזב את המשחק'}
            </div>
            <div style={{ fontSize: 15, color: 'var(--ink-2)', marginBottom: 20, fontWeight: 600 }}>הקרב הסתיים. אפשר לחזור לזירה ולהתחיל משחק חדש.</div>
            <button onClick={handleLeave} className="big-btn big-btn--primary" style={{ width: '100%' }}>חזרה לזירה</button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'ended') {
    const ranking = players
      .map(p => ({ uid: p.uid, name: p.name, score: state.scores[p.uid] || 0 }))
      .sort((a, b) => b.score - a.score)
    const topScore = ranking.length ? ranking[0].score : 0
    const winners = ranking.filter(r => r.score === topScore)
    const iWon = winners.some(w => w.uid === me.uid)
    const tie = winners.length > 1
    return (
      <div style={{ direction: 'rtl', background: BG_DEEP, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
        <ArenaHeader title="מלך הזירה" onBack={handleLeave} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: '30px 26px 22px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>{tie && iWon ? '🤝' : iWon ? '👑' : '🎖️'}</div>
            <div className="h-display" style={{ fontSize: 28, color: tie && iWon ? '#B89048' : iWon ? '#4F6B4A' : '#7E2C2E', marginBottom: 6 }}>
              {tie && iWon ? 'תיקו בצמרת!' : iWon ? 'אתה מלך הזירה!' : `${ranking[0]?.name || 'היריב'} ניצח`}
            </div>
            <div style={{ fontSize: 16, color: 'var(--ink-2)', marginBottom: 18, fontWeight: 600 }}>
              {iWon && !tie ? 'כל הכבוד — צברת הכי הרבה נקודות!' : tie && iWon ? 'שוויון בצמרת — משחק צמוד!' : 'משחק יפה — בפעם הבאה תנצח'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {ranking.map((r, i) => (
                <ResultRow key={r.uid} rank={i + 1} name={r.name + (r.uid === me.uid ? ' (אתה)' : '')} score={r.score} highlight={r.score === topScore} />
              ))}
            </div>

            <button onClick={handleLeave} className="big-btn big-btn--primary" style={{ width: '100%' }}>חזרה לזירה</button>
          </div>
        </div>
      </div>
    )
  }

  // ── מסך השאלה / החשיפה ────────────────────────────────
  const myScore = state.scores[me.uid] || 0
  const oppScore = opponent ? (state.scores[opponent.uid] || 0) : 0

  return (
    <ProfilesProvider uids={players.map(p => p.uid)} myUid={me.uid}>
    <GameVideoProvider roomId={roomId} me={me} enabled={videoChoice !== null} startWithCam={videoChoice === true}>
    <div style={{ direction: 'rtl', background: BG_DEEP, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ArenaHeader title="מלך הזירה" onBack={handleLeave} onMenu={toggleMute} menuOpen={false} />

      {/* לוח ניקוד — כל המתמודדים */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px 0', flexShrink: 0, alignItems: 'stretch' }}>
        <PlayerScore uid={me.uid} name={me.name} score={myScore} you photoURL={profile?.photoURL} answered={!!myAnswer} phase={phase} />
        {others.length === 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: GOLD, fontFamily: "'Suez One', serif" }}>VS</div>
        )}
        {others.map(o => (
          <PlayerScore key={o.uid} uid={o.uid} name={o.name} score={state.scores[o.uid] || 0} answered={!!answersThisQ[o.uid]} phase={phase} />
        ))}
      </div>

      {/* מד התקדמות + טיימר */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 4px', flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: GOLD_DEEP, fontWeight: 800 }}>שאלה {current + 1} מתוך {NUM_QUESTIONS}</span>
        <span style={{ fontSize: 12, color: CREAM, opacity: .8 }}>שווה {fmtPoints(question.points)} נק׳</span>
        {phase === 'question' && !myAnswer && (
          <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Suez One', serif", color: timeLeft <= 5 ? '#ff9d8a' : GOLD }}>⏱ {timeLeft}</span>
        )}
        {phase === 'question' && myAnswer && (
          <span style={{ fontSize: 13, fontWeight: 700, color: CREAM }}>⏳ ממתין ליריב…</span>
        )}
        {phase === 'reveal' && (
          <span style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>נחשף!</span>
        )}
      </div>

      {/* גוף — השאלה והתשובות */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 16px 16px', display: 'flex', flexDirection: 'column' }}>
        {/* השאלה */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(232,200,121,.12), rgba(60,33,84,.4))',
          border: `1px solid ${GOLD_DEEP}`, borderRadius: 16, padding: '18px 16px',
          textAlign: 'center', marginBottom: 16, flexShrink: 0,
        }}>
          <div style={{ fontFamily: "'Suez One', serif", fontSize: 20, fontWeight: 700, color: CREAM, lineHeight: 1.4 }}>{question.q}</div>
        </div>

        {/* התשובות */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {question.options.map((opt, i) => {
            const pickedByNames = phase === 'reveal'
              ? others.filter(o => answersThisQ[o.uid] && answersThisQ[o.uid].choice === i).map(o => o.name)
              : []
            return (
              <AnswerButton
                key={i}
                letter={['א', 'ב', 'ג', 'ד'][i]}
                text={opt}
                phase={phase}
                isSelected={selected === i}
                isMyAnswer={myAnswer && myAnswer.choice === i}
                isCorrect={question.correct === i}
                pickedByNames={pickedByNames}
                locked={!!myAnswer || phase === 'reveal'}
                onClick={() => {
                  if (phase !== 'question' || myAnswer) return
                  playTriviaSound('select')
                  setSelected(i)
                }}
              />
            )
          })}
        </div>

        {/* כפתור נעילה / מצב */}
        <div style={{ marginTop: 16 }}>
          {phase === 'question' && !myAnswer && (
            <button
              onClick={() => selected != null && submitAnswer(selected)}
              disabled={selected == null}
              style={{
                width: '100%', borderRadius: 14, padding: '15px', fontSize: 17, fontWeight: 800,
                fontFamily: 'inherit', border: 'none', cursor: selected == null ? 'default' : 'pointer',
                background: selected == null ? 'rgba(255,255,255,.1)' : 'linear-gradient(180deg,#f2ce6a,#c9a24a)',
                color: selected == null ? 'rgba(243,226,190,.5)' : '#3a2a08',
                boxShadow: selected == null ? 'none' : '0 4px 12px rgba(201,162,74,.4)',
              }}
            >🔒 נעל תשובה</button>
          )}
          {phase === 'question' && myAnswer && (
            <div style={{ textAlign: 'center', color: CREAM, fontSize: 15, padding: '14px' }}>
              {myAnswer.choice == null ? '⏱ הזמן נגמר — אין תשובה' : '✓ נעלת תשובה'} — ממתין ליריב…
            </div>
          )}
          {phase === 'reveal' && (
            <RevealPanel
              question={question}
              myAnswer={myAnswer}
              others={others}
              answers={answersThisQ}
              countdown={revealCount}
              isLast={current + 1 >= NUM_QUESTIONS}
            />
          )}
        </div>
      </div>

      {/* כפתור צ'אט צף + מונה הודעות שלא נקראו */}
      <ArenaChatFab chat={chat} meUid={me.uid} open={chatOpen} onOpen={() => setChatOpen(true)} />

      {/* התראה צפה להודעה נכנסת (כשהחלון סגור) */}
      <ChatToast msgs={chat} meUid={me.uid} suppressed={chatOpen} onOpen={() => setChatOpen(true)} />

      {/* חלון הצ'אט */}
      {chatOpen && (
        <ChatPanel roomId={roomId} me={me} msgs={chat} onClose={() => setChatOpen(false)} sendFn={sendArenaChat} />
      )}
    </div>
    </GameVideoProvider>
    </ProfilesProvider>
  )
}

// ── כפתור צ'אט צף (פינה תחתונה) עם באדג'/מונה הודעות ──
function ArenaChatFab({ chat = [], meUid, open, onOpen }) {
  const [seen, setSeen] = useState(chat.length)
  useEffect(() => { if (open) setSeen(chat.length) }, [open, chat.length])
  const unread = open ? 0 : Math.max(0, chat.length - seen)
  return (
    <button onClick={onOpen} aria-label="צ'אט" style={{
      position: 'absolute', insetInlineEnd: 16, bottom: 16, zIndex: 60,
      width: 54, height: 54, borderRadius: '50%', cursor: 'pointer',
      background: 'linear-gradient(180deg,#4A2A66,#2A1438)', border: `2px solid ${GOLD_DEEP}`,
      color: GOLD, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 14px rgba(0,0,0,.5)',
    }}>
      💬
      {unread > 0 && (
        <span style={{
          position: 'absolute', top: -4, insetInlineStart: -4,
          background: '#E8484F', color: 'white', fontSize: 12, fontWeight: 800,
          minWidth: 20, height: 20, borderRadius: 10, padding: '0 5px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid #2A1438',
        }}>{unread}</span>
      )}
    </button>
  )
}

// ── כפתור תשובה ─────────────────────────────────────────
function AnswerButton({ letter, text, phase, isSelected, isMyAnswer, isCorrect, pickedByNames = [], locked, onClick }) {
  let border = '1px solid rgba(201,162,74,.35)'
  let color = CREAM
  let bgSurface = 'rgba(255,255,255,.06)'

  if (phase === 'reveal') {
    if (isCorrect) { bgSurface = 'rgba(79,107,74,.35)'; border = '2px solid #6CCB6C'; color = '#fff' }
    else if (isMyAnswer) { bgSurface = 'rgba(126,44,46,.35)'; border = '2px solid #E8484F'; color = '#fff' }
  } else if (isSelected) {
    bgSurface = 'rgba(232,200,121,.25)'; border = `2px solid ${GOLD}`; color = '#fff'
  }

  return (
    <button onClick={onClick} disabled={locked && phase === 'question'} style={{
      width: '100%', textAlign: 'right', display: 'flex', alignItems: 'center', gap: 12,
      background: bgSurface, border, borderRadius: 14, padding: '14px 14px',
      fontFamily: 'inherit', cursor: locked && phase === 'question' ? 'default' : 'pointer',
      transition: 'all .15s',
    }}>
      <span style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(232,200,121,.2)', color: GOLD, fontWeight: 800, fontSize: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Suez One', serif",
      }}>{letter}</span>
      <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color, lineHeight: 1.3 }}>{text}</span>
      {phase === 'reveal' && isCorrect && <span style={{ fontSize: 18 }}>✓</span>}
      {phase === 'reveal' && pickedByNames.length > 0 && (
        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {pickedByNames.map((nm, k) => (
            <span key={k} style={{ fontSize: 11, fontWeight: 800, color: GOLD, background: 'rgba(0,0,0,.3)', padding: '3px 7px', borderRadius: 8, whiteSpace: 'nowrap' }}>{nm}</span>
          ))}
        </span>
      )}
    </button>
  )
}

// ── פאנל חשיפה — תוצאת השאלה + כפתור הבא ──────────────
function RevealPanel({ question, myAnswer, others = [], answers = {}, countdown, isLast }) {
  const iWasRight = myAnswer && myAnswer.choice === question.correct
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: CREAM, marginBottom: 4 }}>
        {iWasRight ? `🎉 צדקת! +${fmtPoints(question.points)} נק׳` : (myAnswer?.choice == null ? '⏱ לא ענית בזמן' : '❌ טעית')}
      </div>
      {others.map(o => {
        const ans = answers[o.uid]
        const right = ans && ans.choice === question.correct
        return (
          <div key={o.uid} style={{ fontSize: 13, color: 'rgba(243,226,190,.75)', marginBottom: 2 }}>
            {o.name}: {right ? `צדק (+${fmtPoints(question.points)})` : (ans?.choice == null ? 'לא ענה בזמן' : 'טעה')}
          </div>
        )
      })}
      <div style={{
        marginTop: 14, padding: '14px', borderRadius: 14,
        background: 'rgba(232,200,121,.12)', border: `1px solid ${GOLD_DEEP}`,
        fontFamily: "'Suez One', serif", fontWeight: 800, color: GOLD, fontSize: 17,
      }}>
        {isLast ? 'התוצאות הסופיות בעוד' : 'השאלה הבאה בעוד'} {countdown}…
      </div>
    </div>
  )
}

// ── תצוגת ניקוד שחקן בראש המסך ──────────────────────────
function PlayerScore({ uid, name, score, you, photoURL, answered, phase }) {
  const { name: fullName } = usePlayerProfile(uid, name)
  return (
    <div style={{
      flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      background: 'rgba(74,42,102,.5)', border: `1px solid ${answered && phase === 'question' ? '#6CCB6C' : 'rgba(201,162,74,.35)'}`,
      borderRadius: 14, padding: '10px 8px', position: 'relative',
    }}>
      <PlayerVideo uid={uid} name={fullName} size={92} photoURL={photoURL} />
      {/* שורת שם — עם כפתורי שליטה משני הצדדים.
          אצלי (you): מצלמה/מיק שלי. אצל יריב: השתקה/הסתרה מקומית. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}>
        {you ? <VideoControls only="mic" size={32} /> : <RemoteVideoToggles uid={uid} only="audio" size={32} />}
        <div style={{ fontFamily: "'Suez One', serif", fontSize: 13, color: CREAM, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{fullName}{you ? ' (אתה)' : ''}</div>
        {you ? <VideoControls only="cam" size={32} /> : <RemoteVideoToggles uid={uid} only="video" size={32} />}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: GOLD, fontFamily: "'Suez One', serif", lineHeight: 1.2 }}>{fmtPoints(score)}</div>
      {phase === 'question' && answered && (
        <span style={{ position: 'absolute', top: 8, insetInlineEnd: 8, fontSize: 16, color: '#6CCB6C' }}>✓</span>
      )}
    </div>
  )
}

// ── גלולת ניקוד במסך הסיום ──────────────────────────────
function ResultRow({ rank, name, score, highlight }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: highlight ? 'rgba(79,107,74,.15)' : 'var(--bg-app)',
      border: highlight ? '1px solid #4F6B4A' : '1px solid var(--line)',
      borderRadius: 14, padding: '12px 14px',
    }}>
      <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>{medal}</span>
      <span style={{ flex: 1, textAlign: 'right', fontSize: 15, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <span style={{ fontSize: 18, fontWeight: 800, color: highlight ? '#4F6B4A' : 'var(--ink)', fontFamily: "'Suez One', serif" }}>{fmtPoints(score)}</span>
    </div>
  )
}
