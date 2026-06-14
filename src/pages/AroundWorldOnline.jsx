/*
  AroundWorldOnline.jsx
  "מסביב לעולם" אונליין — שחקן רנדומלי + שחק עם חברים (2-4 שחקנים).

  זרימה (זהה לרמיקוב):
    1. Lobby       — חיפוש רנדומלי או בחירת חברים להזמנה.
    2. WaitingRoom — רשימת השחקנים שהצטרפו; המארח לוחץ "התחל".
    3. OnlineGame  — מסך המשחק המסונכרן.

  הסנכרון: מצב המשחק המלא נשמר כ-JSON על מסמך החדר (aroundworldRooms).
  בשונה מרמיקוב (תור סינכרוני), המנוע כאן אסינכרוני (הטלה →
  צעידה תא-תא → נחיתה → קלף). לכן:
    • רק מי-שבתורו מריץ את המנוע. הוא מטיל, צועד (אנימציה מקומית),
      נוחת, ומחליט על הקלף — ובסוף כל "מהלך" כותב את המצב המלא דרך
      updateAroundWorldState. התור עובר לשחקן הבא, שהופך לכותב הבא.
    • שאר השחקנים צופים: הלוח שלהם מצייר את ה-tokens לפי המצב,
      והדיסקיות זזות בתנועה חלקה (CSS) למקום החדש.
*/

import { useState, useEffect, useRef } from 'react'
import { IconBackRTL } from '../icons/index.jsx'
import { GameIcon } from '../icons/gameIcons.jsx'
import HomeButton from '../components/HomeButton.jsx'
import { useUserStore } from '../stores/userStore.js'
import Avatar from '../components/Avatar.jsx'
import LeaveConfirmModal from '../components/LeaveConfirmModal.jsx'
import { ChatPanel, ChatToast } from '../components/GameChat.jsx'
import { GameVideoProvider, PlayerVideo, VideoControls, RemoteVideoToggles, VideoConsentGate, ProfilesProvider } from '../components/GameVideo.jsx'
import { playSound, isMuted, setMuted } from '../utils/gameSounds.js'
import AroundWorldBoard from './AroundWorldBoard.jsx'
import { PropertyCard, CardsModal, CardFooter } from './AroundWorldCards.jsx'
import { flagSVG } from '../data/aroundWorldFlags.js'
import { cardBack } from '../data/aroundWorldBoardArt.js'
import {
  TILES, TILE_COUNT, RULES, TOKEN_COLORS, GROUPS, MAX_LEVEL, LEVEL_NAMES,
  rentFor, buildCost, nextBuildLabel, randomPriceIndex, applyIndex,
} from '../data/aroundWorldBoard.js'
import {
  createAroundWorldRoom, joinAroundWorldRoom, startAroundWorldGame,
  updateAroundWorldState, watchAroundWorldRoom, leaveAroundWorldRoom,
  findOrCreateAroundWorldMatch, watchFriendships, sendGameInvite,
  watchUser, sendAroundWorldChat, sendFriendRequest, quitAroundWorldGame,
  pauseAroundWorldGame, returnToAroundWorldGame,
} from '../services/firebase.js'

const INK = '#1c1c1c'
const CREAM = '#f6efdf'
const AW_BLUE = '#2f73c9'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── חפיסות זמניות (זהות ל-AroundWorldGame עד שבן יאשר את נתוני האקסל) ──
const LOTTO_CARDS = [
  { text: 'זכית בפרס הראשון בלוטו!', amount: +200 },
  { text: 'זכית בפרס השני בלוטו!', amount: +100 },
  { text: 'ניחשת חמישה מספרים - יפה מאוד!', amount: +80 },
  { text: 'מספר אחד היה חסר לזכייה הגדולה...', amount: +50 },
  { text: 'הכרטיס לא זכה הפעם. קנית עוד אחד.', amount: -20 },
  { text: 'מילאת טופס כפול בטעות.', amount: -40 },
  { text: 'זכית בפרס ניחומים.', amount: +30 },
  { text: 'חבר מילא עליך כרטיס - והוא זכה!', amount: +120 },
]
const CHANCE_CARDS = [
  { text: 'מצאת ארנק ברחוב והחזרת אותו. קיבלת פרס.', amount: +100 },
  { text: 'קיבלת החזר מס מהמדינה.', amount: +150 },
  { text: 'דוח חניה... משלמים.', amount: -50 },
  { text: 'הרכב נכנס למוסך לתיקון.', amount: -100 },
  { text: 'יום הולדת לנכד - קנית מתנה.', amount: -60 },
  { text: 'מכרת מזכרות מהטיול ברווח.', amount: +80 },
  { text: 'נסיעה ישר להתחלה! קבל 200.', goto: 0, amount: +200 },
  { text: 'שכחת את הדרכון - חוזרים 3 צעדים.', back: 3 },
]

// ── עזרי מצב ────────────────────────────────────────────────
function netWorth(p, owners) {
  let v = p.cash
  for (const t of TILES) if (t.type === 'prop' && owners[t.id] === p.uid) v += t.price
  return v
}
function focusWindow(pos) {
  const ids = []
  for (let d = -1; d <= 2; d++) ids.push(((pos + d) % TILE_COUNT + TILE_COUNT) % TILE_COUNT)
  return ids
}

// מצב התחלתי למשחק אונליין — נשמר כאובייקט פשוט (JSON-safe).
function initAroundWorldState(playerDefs) {
  const players = playerDefs.map((p, i) => ({
    uid: p.uid, name: p.name, color: TOKEN_COLORS[i].color,
    cash: RULES.START_CASH, pos: 0, skip: 0, dead: false,
  }))
  return {
    players,
    owners: {},          // { [tileId]: uid }
    hotels: {},          // { [tileId]: level }
    turnIdx: 0,
    round: 1,
    dice: [null, null],
    priceIndex: randomPriceIndex(),
    pendingCard: null,   // הקלף שממתין להכרעה (מוצג לכולם)
    phase: 'idle',       // idle | resolving | ended
    winner: null,        // uid המנצח
    seq: 0,              // מונה מהלכים — מבטיח שכל עדכון נחשב "חדש"
    lastActorPos: {},    // אחרון מיקום שכל token עצר בו (לאנימציה)
  }
}

// ════════════════════════════════════════════════════════
// רכיב ראשי — מנהל את שלבי האונליין
// ════════════════════════════════════════════════════════
export default function AroundWorldOnline({ mode, numPlayers = 4, initialRoomId, onBack, onHome, onExit, autoInviteFriend = null }) {
  const { authUser, profile } = useUserStore()
  const [roomId, setRoomId] = useState(initialRoomId || null)

  useEffect(() => { if (initialRoomId) setRoomId(initialRoomId) }, [initialRoomId])

  const me = { uid: authUser?.uid, name: profile?.name || 'משתמש', photoURL: profile?.photoURL || '' }

  if (!roomId) {
    return <Lobby mode={mode} me={me} numPlayers={numPlayers} autoInviteFriend={autoInviteFriend} onBack={onBack} onHome={onHome} onReady={(id) => setRoomId(id)} />
  }
  return <RoomScreen roomId={roomId} me={me} onBack={() => { setRoomId(null); onBack() }} onHome={onHome} onExit={onExit} />
}

// ════════════════════════════════════════════════════════
// Lobby — חיפוש רנדומלי / רשימת חברים
// ════════════════════════════════════════════════════════
function Lobby({ mode, me, numPlayers = 4, onBack, onHome, onReady, autoInviteFriend = null }) {
  const [phase, setPhase] = useState(mode === 'online-random' ? 'searching' : 'friend-list')
  const [errorMsg, setErrorMsg] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [friends, setFriends] = useState([])
  const [sending, setSending] = useState(false)
  const startedRef = useRef(false)
  const autoInvitedRef = useRef(false)

  useEffect(() => {
    if (mode !== 'online-friend' || !me.uid) return
    const unsub = watchFriendships(me.uid, ({ friends }) => setFriends(friends))
    return () => unsub && unsub()
  }, [mode, me.uid])

  useEffect(() => {
    if (!autoInviteFriend || autoInvitedRef.current || !me.uid) return
    autoInvitedRef.current = true
    inviteFriend(autoInviteFriend)
    // eslint-disable-next-line
  }, [autoInviteFriend, me.uid])

  useEffect(() => {
    if (mode !== 'online-random' || startedRef.current) return
    startedRef.current = true
    ;(async () => {
      if (!me.uid) { setErrorMsg('צריך להיות מחובר'); setPhase('error'); return }
      try {
        const { roomId } = await findOrCreateAroundWorldMatch({ player: me, maxPlayers: numPlayers })
        onReady(roomId)
      } catch (e) {
        console.error('around-world match error:', e)
        setErrorMsg('לא הצלחנו למצוא משחק — נסו שוב')
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
    if (!me.uid || sending) return
    setSending(true)
    setErrorMsg('')
    try {
      const { roomId } = await createAroundWorldRoom({ host: me, roomType: 'private' })
      await sendGameInvite({
        from: me, to: { uid: friend.otherUid, name: friend.otherName },
        gameType: 'aroundworld', roomId,
      })
      onReady(roomId)
    } catch (e) {
      console.error('inviteFriend error:', e)
      setErrorMsg('לא הצלחנו לשלוח הזמנה')
      setPhase('error')
      setSending(false)
    }
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  if (phase === 'searching') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, #1d4e8f, #14405f)', color: 'white', display: 'flex', flexDirection: 'column', padding: '32px 24px 28px', direction: 'rtl', zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={onBack} style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.12)', color: 'white', border: 'none', fontSize: 22, cursor: 'pointer' }}>←</button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><GameIcon id="aroundworld" size={84} /></div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Rubik, Heebo, sans-serif' }}>מחפש לך יריבים...</div>
            <div style={{ fontSize: 16, opacity: 0.85, marginTop: 8 }}>⏱ {formatTime(elapsed)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.10)', borderRadius: 16, padding: '14px 18px', fontSize: 15, textAlign: 'center', lineHeight: 1.5, maxWidth: 320 }}>💡 כשעוד שחקנים יבחרו "מסביב לעולם"<br />תתחברו לאותו לוח</div>
        </div>
        <button onClick={onBack} className="big-btn big-btn--danger" style={{ width: '100%' }}>✕ ביטול</button>
      </div>
    )
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">{mode === 'online-random' ? 'שחקן רנדומלי' : 'שחק עם חברים'}</div>
      </div>
      <div style={{ padding: '20px 20px 32px' }}>
        {phase === 'friend-list' && <FriendList friends={friends} sending={sending} onInvite={inviteFriend} onBack={onBack} />}
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

function FriendList({ friends, sending, onInvite, onBack }) {
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
        <div style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 20 }}>הוסיפו חברים בקפה או בפרלמנט — ואז תוכלו להזמין אותם למשחק.</div>
        <button onClick={onBack} className="big-btn big-btn--ghost" style={{ width: '100%' }}>חזרה</button>
      </div>
    )
  }

  const onlineFriends = friends.filter(f => onlineMap[f.otherUid])
  const offlineFriends = friends.filter(f => !onlineMap[f.otherUid])

  return (
    <>
      <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 6px', color: 'var(--ink)' }}>הזמינו חברים ללוח</h2>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 14 }}>אפשר להזמין עד 3 חברים. כשהם יצטרפו — תתחילו לשחק.</div>

      {onlineFriends.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--success)', margin: '4px 2px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            מחוברים עכשיו ({onlineFriends.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {onlineFriends.map(f => <FriendRow key={f.docId} friend={f} profile={profileMap[f.otherUid]} online sending={sending} onInvite={() => onInvite(f)} />)}
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
            {offlineFriends.map(f => <FriendRow key={f.docId} friend={f} profile={profileMap[f.otherUid]} online={false} sending={sending} onInvite={() => onInvite(f)} />)}
          </div>
        </>
      )}
    </>
  )
}

function FriendRow({ friend, profile, online, sending, onInvite }) {
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
      <button onClick={onInvite} disabled={sending} style={{
        background: online ? 'var(--success)' : AW_BLUE,
        color: 'white', border: 'none', borderRadius: 12, padding: '11px 16px',
        fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: sending ? 'default' : 'pointer',
        whiteSpace: 'nowrap', opacity: sending ? 0.6 : 1,
      }}>{sending ? 'שולח...' : '🎮 הזמן'}</button>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מסך החדר — המתנה או משחק
// ════════════════════════════════════════════════════════
function RoomScreen({ roomId, me, onBack, onHome, onExit }) {
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const joinedRef = useRef(false)

  useEffect(() => {
    if (!joinedRef.current) {
      joinedRef.current = true
      joinAroundWorldRoom(roomId, me).catch(() => {})
    }
    const unsub = watchAroundWorldRoom(roomId, (data) => {
      if (!data) { setError('המשחק נסגר'); return }
      setRoom(data)
    })
    return () => unsub && unsub()
  }, [roomId])

  if (error) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl' }}>
        <div className="screen-header">
          <button className="screen-header__back" onClick={onExit} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
          <HomeButton onClick={onHome} />
          <div className="screen-header__title">מסביב לעולם</div>
        </div>
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
      <div className="scroll-area" style={{ direction: 'rtl' }}>
        <div className="screen-header">
          <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
          <HomeButton onClick={onHome} />
          <div className="screen-header__title">מסביב לעולם</div>
        </div>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-2)' }}>טוען...</div>
      </div>
    )
  }

  if (room.status === 'waiting') {
    return <WaitingRoom room={room} roomId={roomId} me={me} onBack={onBack} onHome={onHome} />
  }
  return <OnlineGame room={room} roomId={roomId} me={me} onBack={onBack} onHome={onHome} onExit={onExit} />
}

// ════════════════════════════════════════════════════════
// חדר המתנה — רשימת שחקנים + כפתור התחלה למארח
// ════════════════════════════════════════════════════════
function WaitingRoom({ room, roomId, me, onBack, onHome }) {
  const isHost = room.hostUid === me.uid
  const players = room.players || []
  const maxPlayers = room.maxPlayers || 4
  const isRandom = room.roomType === 'random'
  const canStart = players.length >= 2
  const startedRef = useRef(false)
  const [showInvite, setShowInvite] = useState(false)
  const canInviteMore = !isRandom && players.length < maxPlayers

  const handleInviteMore = async (friend) => {
    try {
      await sendGameInvite({
        from: me, to: { uid: friend.otherUid, name: friend.otherName },
        gameType: 'aroundworld', roomId,
      })
    } catch (e) { console.error('invite more error:', e) }
  }

  const handleStart = async () => {
    if (startedRef.current) return
    startedRef.current = true
    const defs = players.map(p => ({ uid: p.uid, name: p.name }))
    const state = initAroundWorldState(defs)
    await startAroundWorldGame(roomId, state)
  }

  useEffect(() => {
    if (isRandom && isHost && players.length >= maxPlayers && !startedRef.current) {
      handleStart()
    }
  }, [isRandom, isHost, players.length, maxPlayers]) // eslint-disable-line

  const handleLeave = async () => {
    if (isHost) await leaveAroundWorldRoom(roomId)
    onBack()
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={handleLeave} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">חדר המתנה</div>
      </div>
      <div style={{ padding: '20px 16px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, #2f73c9, #1d557f)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,.18)' }}>
              <GameIcon id="aroundworld" size={50} />
            </div>
          </div>
          <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)' }}>
            {isRandom
              ? `ממתינים לשחקנים (${players.length}/${maxPlayers})`
              : (isHost ? 'מחכים לשחקנים' : 'הצטרפת ללוח')}
          </div>
          {isRandom && (
            <div style={{ marginTop: 8, fontSize: 14, color: 'var(--ink-2)' }}>
              {players.length >= maxPlayers ? 'מתחילים… 🎉' : 'המשחק יתחיל אוטומטית כשיצטרפו מספיק אנשים'}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {players.map((p) => (
            <WaitPlayerRow key={p.uid} p={p} meUid={me.uid} hostUid={room.hostUid} />
          ))}
          {Array.from({ length: maxPlayers - players.length }).map((_, i) => {
            const isInviteSlot = canInviteMore && i === 0
            return (
              <div key={`empty-${i}`}
                onClick={isInviteSlot ? () => setShowInvite(true) : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: isInviteSlot ? '#eef4fb' : 'var(--surface)',
                  border: isInviteSlot ? `1px solid ${AW_BLUE}` : '1px dashed var(--line)',
                  borderRadius: 14, padding: '12px 16px',
                  color: 'var(--ink-2)',
                  cursor: isInviteSlot ? 'pointer' : 'default',
                }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: isInviteSlot ? AW_BLUE : 'var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: isInviteSlot ? '#fff' : 'var(--ink-3)' }}>＋</div>
                <div style={{ fontSize: 15, fontWeight: isInviteSlot ? 800 : 400 }}>{isInviteSlot ? 'הזמן עוד חבר' : 'ממתין לשחקן…'}</div>
              </div>
            )
          })}
        </div>

        {isRandom ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-2)', fontSize: 15, padding: '12px' }}>
            ⏳ מחפשים עוד שחקנים…
          </div>
        ) : isHost ? (
          <>
            <button onClick={canStart ? handleStart : undefined} disabled={!canStart}
              className="big-btn big-btn--primary" style={{ width: '100%', opacity: canStart ? 1 : 0.55 }}>
              {canStart ? `✓ התחל משחק (${players.length})` : 'צריך לפחות 2 שחקנים'}
            </button>
            <div style={{ height: 10 }} />
            <div style={{ fontSize: 13, color: 'var(--ink-2)', textAlign: 'center' }}>
              אפשר להתחיל מ-2 שחקנים, או לחכות לעוד (עד 4)
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--ink-2)', fontSize: 15, padding: '12px' }}>
            ⏳ מחכים שהמארח יתחיל את המשחק…
          </div>
        )}
      </div>

      {showInvite && (
        <InvitePicker me={me} players={players} onClose={() => setShowInvite(false)} onInvite={handleInviteMore} />
      )}
    </div>
  )
}

function WaitPlayerRow({ p, meUid, hostUid }) {
  const [prof, setProf] = useState({ name: p.name, photoURL: null })
  useEffect(() => {
    if (!p.uid) return
    const unsub = watchUser(p.uid, u => {
      const fullName = [u?.name, u?.lastName].filter(Boolean).join(' ') || p.name
      setProf({ name: fullName, photoURL: u?.photoURL || null })
    })
    return () => unsub && unsub()
  }, [p.uid])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 16px' }}>
      <Avatar name={prof.name} size={42} photoURL={prof.photoURL} />
      <div style={{ flex: 1, fontFamily: 'Rubik, Heebo, sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>
        {prof.name}{p.uid === meUid ? ' (אתה)' : ''}
      </div>
      {p.uid === hostUid && <span style={{ fontSize: 12, color: AW_BLUE, fontWeight: 800 }}>👑 מארח</span>}
    </div>
  )
}

function InvitePicker({ me, players, onInvite, onClose }) {
  const [friends, setFriends] = useState([])
  const [invited, setInvited] = useState({})
  const [profileMap, setProfileMap] = useState({})

  useEffect(() => {
    if (!me.uid) return
    const unsub = watchFriendships(me.uid, ({ friends }) => setFriends(friends))
    return () => unsub && unsub()
  }, [me.uid])

  useEffect(() => {
    if (!friends || friends.length === 0) return
    const unsubs = friends.map(f => {
      if (!f.otherUid) return null
      return watchUser(f.otherUid, u => {
        const fullName = [u?.name, u?.lastName].filter(Boolean).join(' ')
        setProfileMap(prev => ({ ...prev, [f.otherUid]: { name: fullName, photoURL: u?.photoURL || null } }))
      })
    })
    return () => unsubs.forEach(u => u && u())
  }, [friends])

  const inRoom = new Set(players.map(p => p.uid))
  const available = friends.filter(f => f.otherUid && !inRoom.has(f.otherUid))

  const pick = (f) => {
    setInvited(prev => ({ ...prev, [f.otherUid]: true }))
    onInvite(f)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(20,15,8,.72)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', direction: 'rtl' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, maxHeight: '72vh', overflowY: 'auto', padding: '20px 18px 28px', boxShadow: '0 -8px 30px rgba(0,0,0,.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="h-display" style={{ fontSize: 20, color: 'var(--ink)' }}>הזמן חבר ללוח</div>
          <button onClick={onClose} aria-label="סגור" style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'var(--line)', color: 'var(--ink)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        {available.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-2)', padding: '26px 0', fontSize: 15 }}>אין חברים נוספים זמינים להזמנה</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {available.map(f => {
              const prof = profileMap[f.otherUid]
              const dispName = prof?.name || f.otherName
              return (
                <div key={f.docId} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar name={dispName} size={46} photoURL={prof?.photoURL} />
                  <div className="h-display" style={{ flex: 1, minWidth: 0, fontSize: 16, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dispName}</div>
                  <button disabled={!!invited[f.otherUid]} onClick={() => pick(f)} style={{
                    background: invited[f.otherUid] ? 'var(--success)' : AW_BLUE,
                    color: 'white', border: 'none', borderRadius: 12, padding: '10px 16px',
                    fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
                    cursor: invited[f.otherUid] ? 'default' : 'pointer', whiteSpace: 'nowrap',
                  }}>{invited[f.otherUid] ? '✓ נשלח' : '🎮 הזמן'}</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מסך המשחק המסונכרן
// ════════════════════════════════════════════════════════
function OnlineGame({ room, roomId, me, onBack, onHome, onExit }) {
  const state = room.gameStateJson ? JSON.parse(room.gameStateJson) : null

  // אוריינטציה — סיבוב אוטומטי לרוחב (זהה ל-AroundWorldGame)
  const [isPortrait, setIsPortrait] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const fn = (e) => setIsPortrait(e.matches)
    mq.addEventListener('change', fn)
    try {
      const so = window.screen && window.screen.orientation
      if (so && so.lock) { const p = so.lock('landscape'); if (p && p.catch) p.catch(() => {}) }
    } catch { /* unsupported */ }
    return () => {
      mq.removeEventListener('change', fn)
      try {
        const so = window.screen && window.screen.orientation
        if (so && so.lock) { const p = so.lock('portrait'); if (p && p.catch) p.catch(() => { try { so.unlock && so.unlock() } catch {} }) }
        else if (so && so.unlock) so.unlock()
      } catch {}
    }
  }, [])

  // local view state
  const [cameraMode, setCameraMode] = useState(() => {
    try { return localStorage.getItem('beyahad_aroundworld_camera') || 'zoom' } catch { return 'zoom' }
  })
  const [focusTiles, setFocusTiles] = useState(null)
  const [viewPlayer, setViewPlayer] = useState(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [peek, setPeek] = useState(false)        // צביטה/הצצה: לוח מלא זמני כשלא בתורי
  const [localDice, setLocalDice] = useState([null, null])
  const [walkingTiles, setWalkingTiles] = useState(null)  // אנימציית הליכה מקומית (לכותב בלבד)
  const [localTokens, setLocalTokens] = useState(null)    // מיקומי דיסקיות מקומיים בזמן צעידה (לכותב בלבד)
  const [muted, setMutedState] = useState(() => isMuted())
  const [videoChoice, setVideoChoice] = useState(null)  // null=טרם נשאל, true/false=הבחירה
  const [friendUids, setFriendUids] = useState(() => new Set())  // רשימת ה-uids שעל ה-uid המחובר — למי מהשחקנים שקיימת בקשת חברות
  const busyRef = useRef(false)                   // נועל מהלך בזמן ריצה

  // מעקב אחר חברים הקיימים — כך הכפתור "הוסף לחברים" מופיע רק מול מי שלא ברשימת החברים שלי
  useEffect(() => {
    if (!me.uid) return
    const unsub = watchFriendships(me.uid, ({ friends }) => {
      setFriendUids(new Set((friends || []).map(f => f.otherUid)))
    })
    return () => unsub && unsub()
  }, [me.uid])

  const myIndex = state ? state.players.findIndex(p => p.uid === me.uid) : -1
  const turnIdx = state?.turn ?? state?.turnIdx ?? 0
  const isMyTurn = state && turnIdx === myIndex && state.phase === 'idle' && !state.winner
  const active = state?.players[turnIdx]
  const winner = state?.winner ? state.players.find(p => p.uid === state.winner) : null

  // אם השחקן חזר למשחק אחרי נטישה זמנית (לחץ על הבאנר בדף הבית) — מנקה את pendingLeave והמשחק חוזר
  useEffect(() => {
    if (state?.pendingLeave?.uid === me.uid) {
      returnToAroundWorldGame(roomId, me.uid).catch(() => {})
    }
  // eslint-disable-next-line
  }, [state?.pendingLeave?.uid, me.uid, roomId])

  // pinch / double-tap להצצה כשלא בתור; כשמגיע התור — חוזר אוטומטית
  useEffect(() => {
    if (isMyTurn && peek) setPeek(false)
  }, [isMyTurn]) // eslint-disable-line

  if (!state || myIndex < 0) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl' }}>
        <div className="screen-header">
          <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
          <HomeButton onClick={onHome} />
          <div className="screen-header__title">מסביב לעולם</div>
        </div>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-2)' }}>טוען את המשחק...</div>
      </div>
    )
  }

  // אישור וידאו — לפני שמתחילים, כל שחקן בוחר אם להפעיל וידאו+שמע
  if (videoChoice === null) {
    return (
      <div style={{ direction: 'rtl', minHeight: '100%', background: 'linear-gradient(160deg, #2f6ea0 0%, #1d557f 55%, #14405f 100%)' }}>
        <VideoConsentGate onDecide={(use) => setVideoChoice(use)} accent="#1d557f" accentDeep="#2f73c9" />
      </div>
    )
  }

  // ── עזרי כתיבת-מצב (רק הכותב הפעיל מריץ אותם) ──
  const push = (next) => updateAroundWorldState(roomId, { ...next, seq: (next.seq || 0) + 1 })

  const focus = (ids) => setFocusTiles((cameraMode === 'zoom' && !peek) ? ids : null)

  // ── המהלך: הטלה → צעידה → נחיתה → קלף (רק מי שבתורו) ──
  async function rollAndWalk() {
    if (!isMyTurn || busyRef.current) return
    if (state.pendingLeave) return    // המשחק מושהה עד שהשחקן יחזור או שהזמן יפוג
    busyRef.current = true
    const d1 = 1 + Math.floor(Math.random() * 6)
    const d2 = 1 + Math.floor(Math.random() * 6)
    setLocalDice([d1, d2])
    playSound('dice')

    // מצב ביניים: walking — מסמנים לכולם שהקוביות יצאו
    let s = { ...state, dice: [d1, d2], phase: 'walking' }
    await push(s)

    const steps = d1 + d2
    const p = { ...s.players[turnIdx] }
    focus(focusWindow(p.pos))
    await sleep(cameraMode === 'zoom' ? 700 : 300)

    // צעידה תא-תא — דוחפים כל צעד ל-Firestore כדי שגם הצופים יראו את התנועה
    let pos = p.pos
    let cash = p.cash
    for (let i = 0; i < steps; i++) {
      pos = (pos + 1) % TILE_COUNT
      if (pos === 0) cash += RULES.PASS_START_BONUS
      const players = s.players.map((pp, idx) => idx === turnIdx ? { ...pp, pos, cash } : pp)
      s = { ...s, players }
      // מזיזים את הדיסקית מקומית מיד (לתגובה מיידית אצל הכותב)
      setLocalTokens(players.filter(pp => !pp.dead).map(pp => ({ uid: pp.uid, color: pp.color, tileId: pp.pos })))
      setWalkingTiles(focusWindow(pos))
      focus(focusWindow(pos))
      playSound('step')
      // דוחפים את הצעד לכולם (הצופים יראו את הדיסקית מתקדמת תא-תא) —
      // מחכים ל-push כך שהמהלך מסתנכרן לפני הממתין הבא
      await push(s)
      await sleep(420)
    }
    setWalkingTiles(null)
    await push(s)            // עדכון מיקום סופי לכולם
    await sleep(300)
    setLocalTokens(null)     // משחררים — מכאן הלוח מצייר לפי ה-state המסונכרן
    await landOn(s)
  }

  async function landOn(s) {
    const uid = me.uid
    const p = s.players[turnIdx]
    const tile = TILES[p.pos]
    let card = null

    if (tile.type === 'prop') {
      const owner = s.owners[tile.id]
      if (!owner) {
        card = { kind: 'buy', tileId: tile.id, uid, price: applyIndex(tile.price, s.priceIndex, tile) }
      } else if (owner === uid) {
        const level = s.hotels[tile.id] || 0
        if (level < MAX_LEVEL) card = { kind: 'hotel', tileId: tile.id, uid, level }
        else card = { kind: 'info', tileId: tile.id, uid, text: 'עיר הבירה כבר בנויה כאן - המדינה בשיאה!' }
      } else {
        const rent = applyIndex(rentFor(tile, s.owners, s.hotels), s.priceIndex, tile)
        card = { kind: 'rent', tileId: tile.id, uid, owner, amount: rent }
        playSound('badStep')
      }
    } else if (tile.type === 'special') {
      if (tile.amount === 'birthday') card = { kind: 'birthday', tileId: tile.id, uid }
      else { card = { kind: 'pay', tileId: tile.id, uid, amount: tile.amount }; if (tile.amount < 0) playSound('badStep') }
    } else if (tile.type === 'lotto') {
      const c = LOTTO_CARDS[Math.floor(Math.random() * LOTTO_CARDS.length)]
      card = { kind: 'lotto', tileId: tile.id, uid, ...c }
    } else if (tile.type === 'chance') {
      const c = CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)]
      card = { kind: 'chance', tileId: tile.id, uid, ...c }
    } else {
      if (tile.key === 'einKnisa') { card = { kind: 'pay', tileId: tile.id, uid, amount: -RULES.EIN_KNISA_FINE }; playSound('badStep') }
      else if (tile.key === 'atzor') { card = { kind: 'atzor', tileId: tile.id, uid }; playSound('badStep') }
      else if (tile.key === 'odPaam') card = { kind: 'odPaam', tileId: tile.id, uid }
      else card = { kind: 'info', tileId: tile.id, uid, text: 'נחת על ההתחלה!' }
    }

    await push({ ...s, phase: 'card', pendingCard: card })
    busyRef.current = false
  }

  // ── הכרעת קלף (רק מי שבתורו) ──
  async function resolveCard(action) {
    if (busyRef.current) return
    if (state.pendingLeave) return    // המשחק מושהה
    const c = state.pendingCard
    if (!c || c.uid !== me.uid) return
    busyRef.current = true

    let s = { ...state, players: state.players.map(p => ({ ...p })), owners: { ...state.owners }, hotels: { ...state.hotels } }
    const tile = TILES[c.tileId]
    const meP = s.players[turnIdx]
    let extraTurn = false

    if (c.kind === 'buy' && action === 'yes') {
      meP.cash -= (c.price ?? tile.price)
      s.owners[c.tileId] = me.uid
    } else if (c.kind === 'hotel' && action === 'yes') {
      meP.cash -= buildCost(tile, c.level)
      s.hotels[c.tileId] = (s.hotels[c.tileId] || 0) + 1
    } else if (c.kind === 'rent') {
      meP.cash -= c.amount
      const owner = s.players.find(p => p.uid === c.owner)
      if (owner) owner.cash += c.amount
    } else if (c.kind === 'pay') {
      meP.cash += c.amount
    } else if (c.kind === 'birthday') {
      playSound('win')
      const others = s.players.filter(p => p.uid !== me.uid && !p.dead)
      meP.cash += RULES.BIRTHDAY_GIFT * others.length
      s.players.forEach(p => { if (p.uid !== me.uid && !p.dead) p.cash -= RULES.BIRTHDAY_GIFT })
    } else if (c.kind === 'lotto' || c.kind === 'chance') {
      if (typeof c.amount === 'number') { meP.cash += c.amount; if (c.amount > 0) playSound('win') }
    } else if (c.kind === 'atzor') {
      meP.skip = RULES.ATZOR_SKIP_TURNS
    } else if (c.kind === 'odPaam') {
      extraTurn = true
    }

    s.pendingCard = null

    // תנועת הפתעה (goto / back)
    if (c.kind === 'chance' && typeof c.goto === 'number') {
      meP.pos = c.goto
      s.phase = 'walking'
      await push(s)
      focus(focusWindow(c.goto))
      await sleep(800)
    }
    if (c.kind === 'chance' && c.back) {
      meP.pos = (meP.pos - c.back + TILE_COUNT) % TILE_COUNT
      s.phase = 'walking'
      await push(s)
      focus(focusWindow(meP.pos))
      await sleep(700)
      await landOn(s)   // נוחת מחדש אחרי הצעדים אחורה
      return
    }

    await sleep(150)
    await endTurn(s, extraTurn)
  }

  async function endTurn(s, extraTurn) {
    // פשיטות רגל
    s.players.forEach(p => { if (!p.dead && p.cash < 0) p.dead = true })
    // שחרור נכסים של מי שפרש
    for (const tid in s.owners) {
      const ow = s.players.find(p => p.uid === s.owners[tid])
      if (ow && ow.dead) delete s.owners[tid]
    }
    const living = s.players.filter(p => !p.dead)
    if (living.length === 1) {
      s.winner = living[0].uid; s.phase = 'ended'; playSound('win')
      await push(s); busyRef.current = false; return
    }

    // ניצחון לפי סה"כ נכסים — הראשון שמגיע ל-15,000 ₪ (מזומן+נכסים) מנצח
    const rich = living.find(p => netWorth(p, s.owners) >= RULES.WIN_NETWORTH_THRESHOLD)
    if (rich) {
      s.winner = rich.uid; s.phase = 'ended'; playSound('win')
      await push(s); busyRef.current = false; return
    }

    if (extraTurn) {
      const p = s.players[turnIdx]
      if (p && !p.dead) { s.phase = 'idle'; await push(s); busyRef.current = false; return }
    }

    // מעבר לשחקן החי הבא (דילוג על עוצרים)
    let ti = turnIdx
    let r = s.round
    for (let hops = 0; hops < s.players.length * 3; hops++) {
      ti = (ti + 1) % s.players.length
      if (ti === 0) r += 1
      const np = s.players[ti]
      if (np.dead) continue
      if (np.skip > 0) { np.skip -= 1; continue }
      break
    }

    if (r !== s.round) s.priceIndex = randomPriceIndex()  // מדד מתחלף כל סיבוב
    s.turnIdx = ti; s.round = r; s.phase = 'idle'
    setFocusTiles(null)
    await push(s)
    busyRef.current = false
  }

  // ── derived for the board ──
  const tokens = localTokens || state.players.filter(p => !p.dead).map(p => ({ uid: p.uid, color: p.color, tileId: p.pos }))
  const tokenColors = Object.fromEntries(state.players.map(p => [p.uid, p.color]))
  const dice = isMyTurn ? (localDice[0] ? localDice : state.dice) : state.dice
  const showFull = peek || cameraMode === 'full'

  const handleLeave = async () => {
    // אם המשחק גמור (יש מנצח) — יציאה סופית ללא חלון 60 שניות. אחרת — מעבירים ל-pause שמאפשר חזרה
    const gameEnded = !!winner || state?.phase === 'ended'
    if (gameEnded) {
      await quitAroundWorldGame(roomId, me.uid)
    } else {
      await pauseAroundWorldGame(roomId, me.uid, me.name)
    }
    onExit ? onExit() : onBack()
  }

  const panelCard = (p) => {
    const isActive = active?.uid === p.uid
    const isMe = p.uid === me.uid
    const videoH = isMe ? 88 : 92   // מקטן לתת מקום לשם+כסף+כפתורי וידאו/מיק
    const videoW = isMe ? 193 : 178  // רוחב מספרי (לא 100%) — חיוני למנגנון סיבוב תקין ב-PlayerVideo
    return (
      <div key={p.uid} style={{
        background: CREAM,
        border: isActive ? `3px solid #2f9e3f` : `1px solid ${INK}`,
        borderRadius: 12, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0,   // הקלף לא מתכווץ — כל התוכן תמיד נראה (וידאו, שם, כסף, כפתורים)
        opacity: p.dead ? 0.4 : 1,
      }}>
        {/* וידאו מלבני בראש הקלף — תופס את כל הרוחב, בסגנון Zoom. PlayerVideo מזהה אוטומטית אם המקור portrait או landscape */}
        <div onClick={() => setViewPlayer(p)} role="button" style={{ cursor: 'pointer', borderBottom: `2px solid ${INK}` }}>
          <PlayerVideo uid={p.uid} name={p.name} width={videoW} height={videoH} />
        </div>
        {/* שם + כסף בשורה אחת. כפתורי וידאו/מיק בתחתית — שלי (מצלמה+מיק) או של אחרים (הסתרת וידאו / השתקת אודיו — חשוב למודרציה מול משתמשים לא רצויים) */}
        <div style={{ padding: '6px 9px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.color, border: `1.5px solid ${INK}`, flex: 'none' }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.name}{isMe ? ' (אתה)' : ''}{p.skip > 0 ? ' (עוצר)' : ''}{p.dead ? ' - פרש' : ''}
              </span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 14, color: p.cash < 200 ? '#a32d2d' : '#1c4e26', flex: 'none' }}>
              {p.cash.toLocaleString()} ₪
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', borderTop: '1px solid #ddd', paddingTop: 4 }}>
            {isMe
              ? <VideoControls size={34} />
              : <RemoteVideoToggles uid={p.uid} size={30} />}
          </div>
        </div>
      </div>
    )
  }

  const chatMsgs = room.chat || []

  const gameInner = (
    <div style={{ position: isPortrait ? 'absolute' : 'fixed', inset: 0, zIndex: 1000, background: 'linear-gradient(160deg, #2f6ea0 0%, #1d557f 55%, #14405f 100%)', direction: 'rtl', fontFamily: 'Heebo, sans-serif', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'row', gap: 8, padding: 8 }}>

        {/* right panel: ME only + dice + controls */}
        <div style={{ width: 195, flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <button onClick={() => setConfirmLeave(true)} aria-label="יציאה מהמשחק" style={{ alignSelf: 'flex-start', width: 40, height: 40, borderRadius: 12, border: `2px solid ${INK}`, background: '#fff', fontSize: 19, fontWeight: 900, cursor: 'pointer', color: INK }}>✕</button>
          {state.players.filter(p => p.uid === me.uid).map(panelCard)}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
              {[0, 1].map(i => (
                <div key={i} style={{ width: 38, height: 38, borderRadius: 9, background: '#fff', border: `2.5px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 21, color: INK }}>
                  {dice[i] ?? '·'}
                </div>
              ))}
            </div>
            <button
              onClick={rollAndWalk}
              disabled={!isMyTurn}
              style={{
                background: isMyTurn ? '#f4c20d' : '#d9d4c2', border: `3px solid ${INK}`, borderRadius: 12,
                padding: '10px 6px', fontSize: 16, fontWeight: 800, color: INK, cursor: isMyTurn ? 'pointer' : 'default',
                fontFamily: 'inherit', opacity: isMyTurn ? 1 : 0.6,
              }}>
              🎲 הטלת קוביות
            </button>
            <div style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.4)' }}>
              {winner ? '' : isMyTurn ? 'תורך!' : `תור ${active?.name || ''}`}
            </div>
            {/* control row: camera · sound · chat */}
            <div style={{ display: 'flex', gap: 5 }}>
              <button
                onClick={() => {
                  const m = cameraMode === 'zoom' ? 'full' : 'zoom'
                  setCameraMode(m)
                  try { localStorage.setItem('beyahad_aroundworld_camera', m) } catch {}
                  if (m === 'full') setFocusTiles(null)
                }}
                aria-label="מצלמה"
                title={cameraMode === 'zoom' ? 'מצלמה עוקבת' : 'לוח מלא'}
                style={{ flex: 1, background: '#fff', border: `2px solid ${INK}`, borderRadius: 11, padding: '7px 0', fontSize: 17, color: INK, cursor: 'pointer', fontFamily: 'inherit' }}>
                {cameraMode === 'zoom' ? '🎥' : '🗺️'}
              </button>
              <button
                onClick={() => { const m = !muted; setMuted(m); setMutedState(m) }}
                aria-label="סאונד"
                title={muted ? 'הפעל סאונד' : 'השתק'}
                style={{ flex: 1, background: '#fff', border: `2px solid ${INK}`, borderRadius: 11, padding: '7px 0', fontSize: 17, color: INK, cursor: 'pointer', fontFamily: 'inherit' }}>
                {muted ? '🔇' : '🔊'}
              </button>
              <button onClick={() => setChatOpen(true)} aria-label="צ'אט" title="צ'אט"
                style={{ flex: 1, background: '#fff', border: `2px solid ${INK}`, borderRadius: 11, padding: '7px 0', fontSize: 17, color: INK, cursor: 'pointer', fontFamily: 'inherit' }}>
                💬
              </button>
            </div>
          </div>
        </div>

        {/* board center — לחיצה כפולה = הצצה (כשלא בתורי) */}
        <div
          style={{ flex: 1, minWidth: 0, position: 'relative' }}
          onDoubleClick={() => { if (!isMyTurn) setPeek(v => !v) }}
        >
          <AroundWorldBoard
            focusTiles={showFull ? null : focusTiles}
            tokens={tokens}
            owners={state.owners}
            hotels={state.hotels}
            tokenColors={tokenColors}
            priceIndex={state.priceIndex}
          />
          {peek && !isMyTurn && (
            <div style={{ position: 'absolute', top: 8, insetInlineStart: '50%', transform: 'translateX(-50%)', background: 'rgba(28,28,28,.78)', color: '#fff', borderRadius: 999, padding: '5px 14px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
              👁 מצב הצצה — לחיצה כפולה לחזרה
            </div>
          )}
        </div>

        {/* left panel: ALL OTHER players */}
        <div style={{ width: 180, flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.4)', textAlign: 'center', padding: '2px 0' }}>
            השחקנים
          </div>
          {state.players.filter(p => p.uid !== me.uid).map(panelCard)}
        </div>
      </div>

      {/* player cards modal */}
      {viewPlayer && (
        <CardsModal
          player={viewPlayer}
          players={state.players}
          owners={state.owners}
          hotels={state.hotels}
          myUid={me.uid}
          isFriend={friendUids.has(viewPlayer.uid)}
          onAddFriend={async () => {
            try {
              await sendFriendRequest({ uid: me.uid, name: me.name }, { uid: viewPlayer.uid, name: viewPlayer.name })
            } catch (e) { console.error('add friend error:', e) }
          }}
          onClose={() => setViewPlayer(null)}
          rotate={isPortrait}
        />
      )}

      {/* card flip (lotto/chance) — מוצג לכולם; רק הכותב מסיים */}
      {state.pendingCard && (state.pendingCard.kind === 'lotto' || state.pendingCard.kind === 'chance') && (
        <CardFlip
          key={state.seq}
          card={state.pendingCard}
          isActor={state.pendingCard.uid === me.uid}
          onDone={() => resolveCard('ok')}
        />
      )}

      {/* landing card (everything else) */}
      {state.pendingCard && state.pendingCard.kind !== 'lotto' && state.pendingCard.kind !== 'chance' && (
        <LandingCard card={state.pendingCard} players={state.players} myUid={me.uid} onAction={resolveCard} />
      )}

      {/* game over */}
      {winner && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(28,28,28,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: CREAM, border: `3px solid ${INK}`, borderRadius: 18, padding: '26px 30px', textAlign: 'center', width: 'min(92vw, 400px)' }}>
            <div style={{ fontSize: 50 }}>🏆</div>
            <div style={{ fontWeight: 900, fontSize: 26, color: INK, margin: '8px 0' }}>
              {winner.uid === me.uid ? 'ניצחת!' : `${winner.name} ניצח!`}
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#444', marginBottom: 18 }}>
              שווי כולל: {netWorth(winner, state.owners).toLocaleString()} ₪
            </div>
            <button onClick={handleLeave} style={{ width: '100%', background: '#2f9e3f', color: '#fff', border: `2.5px solid ${INK}`, borderRadius: 12, padding: 12, fontSize: 17, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              חזרה לזירה
            </button>
          </div>
        </div>
      )}

      {/* pending leave modal — מוצג לשאר השחקנים כשמישהו נטש — מחכה לחזרה תוך 60 שניות */}
      {state.pendingLeave && state.pendingLeave.uid !== me.uid && (
        <PendingLeaveModal
          pendingLeave={state.pendingLeave}
          onExpire={() => quitAroundWorldGame(roomId, state.pendingLeave.uid).catch(() => {})}
        />
      )}

      {/* chat */}
      <ChatToast msgs={chatMsgs} meUid={me.uid} suppressed={chatOpen} onOpen={() => setChatOpen(true)} />
      {chatOpen && <ChatPanel roomId={roomId} me={me} msgs={chatMsgs} onClose={() => setChatOpen(false)} sendFn={sendAroundWorldChat} />}

      {/* אישור יציאה — בתוך gameInner כדי שיסתובב עם המשחק במצב מסובב */}
      {confirmLeave && (
        <LeaveConfirmModal
          title="לעזוב את המשחק?"
          subtitle="המשחק הנוכחי יסתיים והיריבים יקבלו הודעה"
          stayLabel="לא, להישאר במשחק"
          leaveLabel="כן, לעזוב"
          onStay={() => setConfirmLeave(false)}
          onLeave={() => { setConfirmLeave(false); handleLeave() }}
        />
      )}
    </div>
  )

  return (
    <ProfilesProvider uids={state.players.map(p => p.uid)} myUid={me.uid}>
    <GameVideoProvider roomId={roomId} me={me} enabled={videoChoice !== null} startWithCam={videoChoice === true}>
      {isPortrait ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: '100vh', height: '100vw', transform: 'translate(-50%,-50%) rotate(90deg)', transformOrigin: 'center center' }}>
            {gameInner}
          </div>
        </div>
      ) : gameInner}
    </GameVideoProvider>
    </ProfilesProvider>
  )
}

// ── PendingLeaveModal — מוצג לשאר השחקנים כששחקן נטש זמנית (ספירת לחזרה של 60 שניות) ──
function PendingLeaveModal({ pendingLeave, onExpire }) {
  const [remainingSec, setRemainingSec] = useState(() =>
    Math.max(0, Math.ceil((pendingLeave.expiresMs - Date.now()) / 1000))
  )
  const expiredRef = useRef(false)

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((pendingLeave.expiresMs - Date.now()) / 1000))
      setRemainingSec(remaining)
      if (remaining === 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpire && onExpire()
      }
    }
    const interval = setInterval(tick, 500)
    tick()
    return () => clearInterval(interval)
  }, [pendingLeave.expiresMs, onExpire])

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 35, background: 'rgba(28,28,28,.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', padding: 16 }}>
      <div style={{ background: CREAM, border: `3px solid ${INK}`, borderRadius: 18, padding: '24px 26px', textAlign: 'center', maxWidth: 'min(86vw, 360px)', width: '100%', boxShadow: '0 18px 50px rgba(0,0,0,.4)' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>⏳</div>
        <div style={{ fontWeight: 900, fontSize: 22, color: INK, marginBottom: 10 }}>
          {pendingLeave.name} יצא/ה מהמשחק
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#555', lineHeight: 1.5, marginBottom: 18 }}>
          המשחק מושהה עד שיחזור/ת— אם לא יחזור/ת בזמן, המשחק ימשיך בלעדיה/ו.
        </div>
        <div style={{ fontWeight: 900, fontSize: 48, color: remainingSec <= 10 ? '#d8402a' : INK, marginBottom: 4, lineHeight: 1 }}>
          {remainingSec}
        </div>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#888' }}>שניות</div>
      </div>
    </div>
  )
}

// ── landing card (online) — כמו ב-AroundWorldGame, מותאם ל-myUid ──
function LandingCard({ card, players, myUid, onAction }) {
  const t = TILES[card.tileId]
  const actor = players.find(p => p.uid === card.uid)
  const ownerP = card.owner ? players.find(p => p.uid === card.owner) : null
  const isMine = card.uid === myUid
  const grp = t && t.type === 'prop' ? GROUPS[t.group] : null

  const btn = (label, action, bg, fg = '#fff') => (
    <button key={label} onClick={() => onAction(action)} style={{
      flex: 1, background: bg, color: fg, border: `2.5px solid ${INK}`, borderRadius: 12,
      padding: '13px 8px', fontSize: 18, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
    }}>{label}</button>
  )

  // property → card + action side panel
  if (t && t.type === 'prop' && (card.kind === 'buy' || card.kind === 'hotel' || card.kind === 'rent')) {
    let hl = -1, sideTitle = '', sideSub = '', actions = null
    if (card.kind === 'buy') {
      const eff = card.price ?? t.price
      const pct = (eff !== t.price && card.price != null) ? Math.round((eff / t.price - 1) * 100) : 0
      const canAfford = actor && actor.cash >= eff
      sideTitle = 'מדינה פנויה'
      sideSub = grp.label + (pct ? ' · מדד ' + (pct > 0 ? '+' : '') + pct + '%' : '')
      if (canAfford) {
        actions = [btn('לקנות · ' + eff + ' ₪', 'yes', '#2f9e3f'), btn('לא עכשיו', 'no', '#fff', INK)]
      } else {
        // אין מספיק כסף — מסירים את כפתור הקנייה, משאירים רק "המשך" עם הודעה
        sideSub += ' · אין מספיק כסף לקנייה'
        actions = [btn('המשך', 'no', '#d8402a')]
      }
    } else if (card.kind === 'hotel') {
      hl = card.level + 1
      const cost = buildCost(t, card.level)
      sideTitle = 'המדינה שלך!'
      sideSub = 'השכירות תעלה ל-' + t.rents[hl] + ' ₪'
      actions = [btn('לבנות ' + nextBuildLabel(card.level) + ' · ' + cost + ' ₪', 'yes', '#2f73c9'), btn('לא עכשיו', 'no', '#fff', INK)]
    } else {
      hl = Math.max(0, t.rents.indexOf(card.amount))
      sideTitle = 'המדינה של ' + (ownerP?.name || '')
      sideSub = 'תשלום שכירות'
      actions = [btn('לשלם ' + card.amount + ' ₪', 'ok', '#d8402a')]
    }
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(28,28,28,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', padding: 16, boxSizing: 'border-box' }}>
        <div style={{ background: CREAM, border: `3px solid ${INK}`, borderRadius: 18, padding: '14px 18px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14, boxShadow: '0 18px 50px rgba(0,0,0,.4)', maxWidth: '100%', boxSizing: 'border-box' }}>
          <PropertyCard tile={t} level={hl} width={150} footer={card.kind === 'buy' ? <CardFooter color="#1c4e26">מחיר {card.price ?? t.price} ₪</CardFooter> : null} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 190, flex: 'none', textAlign: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: 21, color: INK, lineHeight: 1.1 }}>{sideTitle}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#3a3a3a', lineHeight: 1.3 }}>{sideSub}</div>
            {isMine ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>{actions}</div>
            ) : (
              <div style={{ fontSize: 15, color: '#666' }}>{actor?.name} משחק...</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // generic cards
  let title = t?.name || ''
  let sub = ''
  let buttons = null
  if (card.kind === 'pay') {
    sub = (t.sub || '') + ' · תשלום ' + Math.abs(card.amount) + ' ₪'
    buttons = isMine ? [btn('לשלם', 'ok', '#d8402a')] : null
  } else if (card.kind === 'birthday') {
    sub = 'מזל טוב! כל שחקן נותן לך ' + RULES.BIRTHDAY_GIFT + ' ₪ 🎂'
    buttons = isMine ? [btn('תודה רבה!', 'ok', '#2f9e3f')] : null
  } else if (card.kind === 'atzor') {
    sub = 'עוצרים ל-' + RULES.ATZOR_SKIP_TURNS + ' סיבובים'
    buttons = isMine ? [btn('בסדר...', 'ok', '#e8761f')] : null
  } else if (card.kind === 'odPaam') {
    sub = 'מגיע לך תור נוסף! 🎉'
    buttons = isMine ? [btn('יאללה!', 'ok', '#2f9e3f')] : null
  } else if (card.kind === 'info') {
    sub = card.text
    buttons = isMine ? [btn('אישור', 'ok', '#fff', INK)] : null
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(28,28,28,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', padding: 16, boxSizing: 'border-box' }}>
      <div style={{ background: CREAM, border: `3px solid ${INK}`, borderRadius: 18, width: 'min(86vw, 380px)', maxWidth: '100%', boxSizing: 'border-box', padding: '16px 20px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', boxShadow: '0 18px 50px rgba(0,0,0,.4)' }}>
        {grp && <div style={{ width: '100%', height: 9, background: grp.color, borderRadius: 5 }} />}
        {t && t.type === 'prop' && (
          <div style={{ width: 96, height: 64 }} dangerouslySetInnerHTML={{ __html: flagSVG(t.flag) }} />
        )}
        <div style={{ fontWeight: 900, fontSize: 26, color: INK, lineHeight: 1.05 }}>{title}</div>
        <div style={{ fontWeight: 700, fontSize: 17, color: '#3a3a3a', lineHeight: 1.35 }}>{sub}</div>
        {!isMine && <div style={{ fontSize: 15, color: '#666' }}>{actor?.name} משחק...</div>}
        {buttons && <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 6 }}>{buttons}</div>}
      </div>
    </div>
  )
}

// ── lotto/chance flip card (online) ──
function CardFlip({ card, isActor, onDone }) {
  const [stage, setStage] = useState('rise')
  const isLotto = card.kind === 'lotto'
  const accent = isLotto ? '#2f9e3f' : '#e8761f'
  const deckSide = isLotto ? { right: '14%' } : { left: '14%' }
  const amount = typeof card.amount === 'number' ? card.amount : null

  useEffect(() => {
    const t1 = setTimeout(() => setStage('reveal'), 620)
    return () => clearTimeout(t1)
  }, [])

  // הצופים (לא השחקן) — סוגרים אוטומטית; השחקן לוחץ אישור
  useEffect(() => {
    if (stage !== 'reveal' || isActor) return
    const t = setTimeout(() => setStage('return'), 1900)
    return () => clearTimeout(t)
  }, [stage, isActor])

  useEffect(() => {
    if (stage !== 'return') return
    const t = setTimeout(() => { if (isActor) onDone() }, 600)
    return () => clearTimeout(t)
  }, [stage, isActor, onDone])

  const lifted = stage === 'reveal'
  const gone = stage === 'return'

  const wrapStyle = {
    position: 'absolute', bottom: '8%', ...deckSide,
    width: 220, height: 300, zIndex: 2,
    transformStyle: 'preserve-3d',
    transition: 'transform .6s cubic-bezier(.34,1.2,.5,1)',
    transform: lifted ? 'translate(0,0) scale(1)' : 'translateY(40px) scale(.42)',
  }
  if (lifted) {
    wrapStyle.bottom = 'auto'; wrapStyle.top = '50%'; wrapStyle.left = '50%'; wrapStyle.right = 'auto'
    wrapStyle.transform = 'translate(-50%,-50%) scale(1)'
  }
  if (gone) {
    wrapStyle.transform = (deckSide.left ? 'translate(-50%,160%)' : 'translate(50%,160%)') + ' scale(.42)'
    wrapStyle.opacity = 0
  }

  const innerStyle = {
    position: 'relative', width: '100%', height: '100%',
    transformStyle: 'preserve-3d', transition: 'transform .55s ease',
    transform: lifted ? 'rotateY(0deg)' : 'rotateY(180deg)',
  }
  const face = {
    position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    borderRadius: 16, overflow: 'hidden', boxShadow: '0 18px 50px rgba(0,0,0,.5)',
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(28,28,28,.55)', direction: 'rtl', overflow: 'hidden' }}>
      <div style={wrapStyle}>
        <div style={innerStyle}>
          <div style={{ ...face, transform: 'rotateY(0deg)', background: CREAM, border: `4px solid ${accent}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '18px 16px', textAlign: 'center', gap: 12 }}>
            <div style={{ fontFamily: 'Rubik, Heebo, sans-serif', fontWeight: 900, fontSize: 23, color: accent }}>{isLotto ? 'מפעל הפיס' : 'הפתעה'}</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: INK, lineHeight: 1.35 }}>{card.text}</div>
            {amount != null && (
              <div style={{ fontWeight: 900, fontSize: 26, color: amount < 0 ? '#d8402a' : '#1c4e26' }}>
                {amount > 0 ? '+' : ''}{amount} ₪
              </div>
            )}
            {card.back && <div style={{ fontWeight: 800, fontSize: 16, color: '#a35a12' }}>חוזרים {card.back} צעדים</div>}
            {isActor && stage === 'reveal' && (
              <button onClick={() => setStage('return')} style={{ marginTop: 4, background: accent, color: '#fff', border: `2.5px solid ${INK}`, borderRadius: 12, padding: '10px 28px', fontSize: 17, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                אישור
              </button>
            )}
          </div>
          <div style={{ ...face, transform: 'rotateY(180deg)', display: 'flex' }}
            dangerouslySetInnerHTML={{ __html: cardBack(card.kind) }} />
        </div>
      </div>
    </div>
  )
}
