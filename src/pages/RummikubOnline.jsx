// src/pages/RummikubOnline.jsx
// ─────────────────────────────────────────────────────────────
// רמיקוב אונליין — שחקן רנדומלי + שחק עם חברים (2-4 שחקנים).
//
// זרימה:
//   1. Lobby — חיפוש רנדומלי או בחירת חברים להזמנה.
//   2. WaitingRoom — רשימת השחקנים שהצטרפו; המארח לוחץ "התחל".
//   3. OnlineGame — מסך המשחק המסונכרן; רק מי שבתורו פועל.
//
// הסנכרון: מצב המשחק המלא נשמר כ-JSON על מסמך החדר (rummikubRooms).
// כל שינוי משודר בזמן אמת לכל המשתתפים דרך watchRummikubRoom.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { IconBackRTL } from '../icons/index.jsx'
import { GameIcon } from '../icons/gameIcons.jsx'
import HomeButton from '../components/HomeButton.jsx'
import { useUserStore } from '../stores/userStore.js'
import { playSound } from '../utils/gameSounds.js'
import Avatar from '../components/Avatar.jsx'
import { ChatPanel, ChatToast, ChatFab } from '../components/GameChat.jsx'
import { GameVideoProvider, PlayerVideo, VideoControls, RemoteVideoToggles, VideoConsentGate, ProfilesProvider, usePlayerProfile } from '../components/GameVideo.jsx'
import {
  createRummikubRoom, joinRummikubRoom, startRummikubGame,
  updateRummikubState, watchRummikubRoom, leaveRummikubRoom,
  findOrCreateRummikubMatch, watchFriendships, sendGameInvite,
  watchUser, sendRummikubChat,
} from '../services/firebase.js'
import {
  initGame, isBoardValid, drawTile, commitTurn, MELD_MIN,
  drawOrResolve, sortRack,
} from '../utils/rummikubEngine.js'
import {
  RummiHeaderShared, BoardArea, PlayerRack, RummiButton,
  NewTileBanner, PoolCounter, GOLD, GOLD_DEEP, CREAM,
} from './RummikubShared.jsx'

// ════════════════════════════════════════════════════════
// רכיב ראשי — מנהל את שלבי האונליין
// ════════════════════════════════════════════════════════
export default function RummikubOnline({ mode, numPlayers = 4, initialRoomId, onBack, onHome, onExit, autoInviteFriend = null }) {
  const { authUser, profile } = useUserStore()
  const [roomId, setRoomId] = useState(initialRoomId || null)

  useEffect(() => { if (initialRoomId) setRoomId(initialRoomId) }, [initialRoomId])

  const me = { uid: authUser?.uid, name: profile?.name || 'משתמש' }

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
  const startedRef = useRef(false)
  const autoInvitedRef = useRef(false)

  useEffect(() => {
    if (mode !== 'online-friend' || !me.uid) return
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
    if (mode !== 'online-random' || startedRef.current) return
    startedRef.current = true
    ;(async () => {
      if (!me.uid) { setErrorMsg('צריך להיות מחובר'); setPhase('error'); return }
      try {
        const { roomId } = await findOrCreateRummikubMatch({ player: me, maxPlayers: numPlayers })
        onReady(roomId)
      } catch (e) {
        console.error('rummikub match error:', e)
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
    if (!me.uid) return
    setErrorMsg('')
    try {
      const { roomId } = await createRummikubRoom({ host: me, roomType: 'private' })
      await sendGameInvite({
        from: me, to: { uid: friend.otherUid, name: friend.otherName },
        gameType: 'rummikub', roomId,
      })
      onReady(roomId)  // המארח נכנס לחדר ההמתנה
    } catch (e) {
      console.error('inviteFriend error:', e)
      setErrorMsg('לא הצלחנו לשלוח הזמנה')
      setPhase('error')
    }
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  if (phase === 'searching') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, #2A1C10, #3A2818)', color: 'white', display: 'flex', flexDirection: 'column', padding: '32px 24px 28px', direction: 'rtl', zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={onBack} style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.12)', color: 'white', border: 'none', fontSize: 22, cursor: 'pointer' }}>←</button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><GameIcon id="rummikub" size={84} /></div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Suez One', serif" }}>מחפש לך יריבים...</div>
            <div style={{ fontSize: 16, opacity: 0.85, marginTop: 8 }}>⏱ {formatTime(elapsed)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.10)', borderRadius: 16, padding: '14px 18px', fontSize: 15, textAlign: 'center', lineHeight: 1.5, maxWidth: 320 }}>💡 כשעוד שחקנים ילחצו על "רמיקוב"<br />תתחברו לאותו שולחן</div>
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
  // מעקב חי אחרי מי מחובר — מרוכז כאן כדי לחלק לקטגוריות.
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

  // מיינים: מחוברים קודם, אחר כך לא-מחוברים
  const onlineFriends = friends.filter(f => onlineMap[f.otherUid])
  const offlineFriends = friends.filter(f => !onlineMap[f.otherUid])

  return (
    <>
      <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 6px', color: 'var(--ink)' }}>הזמינו חברים לשולחן</h2>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 14 }}>אפשר להזמין עד 3 חברים. כשהם יצטרפו — תתחילו לשחק.</div>

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
      }}>🎮 הזמן</button>
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
      joinRummikubRoom(roomId, me).catch(() => {})
    }
    const unsub = watchRummikubRoom(roomId, (data) => {
      if (!data) { setError('המשחק נסגר'); return }
      setRoom(data)
    })
    return () => unsub && unsub()
  }, [roomId])

  if (error) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg,#2c1d10,#1c1108)', minHeight: '100%' }}>
        <RummiHeaderShared title="רמיקוב" onBack={onExit} />
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
      <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg,#2c1d10,#1c1108)', minHeight: '100%' }}>
        <RummiHeaderShared title="רמיקוב" onBack={onBack} />
        <div style={{ padding: 24, textAlign: 'center', color: CREAM }}>טוען...</div>
      </div>
    )
  }

  if (room.status === 'waiting') {
    return <WaitingRoom room={room} roomId={roomId} me={me} onBack={onBack} onHome={onHome} />
  }
  return <OnlineGame room={room} roomId={roomId} me={me} onBack={onBack} onHome={onHome} />
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

  // כל מי שכבר בחדר יכול להזמין עוד חברים (לא רק המארח)
  const handleInviteMore = async (friend) => {
    try {
      await sendGameInvite({
        from: me, to: { uid: friend.otherUid, name: friend.otherName },
        gameType: 'rummikub', roomId,
      })
    } catch (e) { console.error('invite more error:', e) }
  }

  const handleStart = async () => {
    if (startedRef.current) return
    startedRef.current = true
    const defs = players.map(p => ({ id: p.uid, name: p.name, isAI: false }))
    const state = initGame(defs)
    await startRummikubGame(roomId, state)
  }

  // במשחק רנדומלי — כשהחדר מתמלא למספר המבוקש, המארח מתחיל אוטומטית.
  useEffect(() => {
    if (isRandom && isHost && players.length >= maxPlayers && !startedRef.current) {
      handleStart()
    }
  }, [isRandom, isHost, players.length, maxPlayers]) // eslint-disable-line

  const handleLeave = async () => {
    if (isHost) await leaveRummikubRoom(roomId)
    onBack()
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg,#2c1d10,#1c1108)', minHeight: '100%' }}>
      <RummiHeaderShared title="חדר המתנה" onBack={handleLeave} onHome={onHome} />
      <div style={{ padding: '20px 16px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><GameIcon id="rummikub" size={56} /></div>
          <div className="h-display" style={{ fontSize: 22, color: GOLD }}>
            {isRandom
              ? `ממתינים לשחקנים (${players.length}/${maxPlayers})`
              : (isHost ? 'מחכים לשחקנים' : 'הצטרפת לשולחן')}
          </div>
          {isRandom && (
            <div style={{ marginTop: 8, fontSize: 14, color: CREAM, opacity: .85 }}>
              {players.length >= maxPlayers ? 'מתחילים… 🎉' : 'המשחק יתחיל אוטומטית כשיצטרפו מספיק אנשים'}
            </div>
          )}
        </div>

        <ProfilesProvider uids={players.map(p => p.uid)} myUid={me.uid}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {players.map((p) => (
            <RummiWaitPlayer key={p.uid} p={p} meUid={me.uid} hostUid={room.hostUid} />
          ))}
          {Array.from({ length: maxPlayers - players.length }).map((_, i) => {
            const isInviteSlot = canInviteMore && i === 0
            return (
              <div key={`empty-${i}`}
                onClick={isInviteSlot ? () => setShowInvite(true) : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: isInviteSlot ? 'rgba(74,48,22,.55)' : 'rgba(74,48,22,.25)',
                  border: isInviteSlot ? `1px solid ${GOLD_DEEP}` : '1px dashed rgba(201,162,74,.4)',
                  borderRadius: 14, padding: '12px 16px',
                  color: isInviteSlot ? CREAM : 'rgba(243,226,190,.5)',
                  cursor: isInviteSlot ? 'pointer' : 'default',
                }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: isInviteSlot ? GOLD : 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: isInviteSlot ? '#2c1d10' : 'inherit' }}>＋</div>
                <div style={{ fontSize: 15, fontWeight: isInviteSlot ? 800 : 400 }}>{isInviteSlot ? 'הזמן עוד חבר' : 'ממתין לשחקן…'}</div>
              </div>
            )
          })}
        </div>
        </ProfilesProvider>

        {/* במשחק רנדומלי אין כפתור התחלה — הכל אוטומטי. רק בחברים המארח מתחיל ידנית. */}
        {isRandom ? (
          <div style={{ textAlign: 'center', color: CREAM, fontSize: 15, padding: '12px' }}>
            ⏳ מחפשים עוד שחקנים…
          </div>
        ) : isHost ? (
          <>
            <RummiButton gold label={canStart ? `✓ התחל משחק (${players.length})` : 'צריך לפחות 2 שחקנים'} onClick={canStart ? handleStart : () => {}} />
            <div style={{ height: 10 }} />
            <div style={{ fontSize: 13, color: CREAM, textAlign: 'center', opacity: .8 }}>
              אפשר להתחיל מ-2 שחקנים, או לחכות לעוד (עד 4)
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: CREAM, fontSize: 15, padding: '12px' }}>
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

function InvitePicker({ me, players, onInvite, onClose }) {
  const [friends, setFriends] = useState([])
  const [invited, setInvited] = useState({})
  const [profileMap, setProfileMap] = useState({})

  useEffect(() => {
    if (!me.uid) return
    const unsub = watchFriendships(me.uid, ({ friends }) => setFriends(friends))
    return () => unsub && unsub()
  }, [me.uid])

  // משיכים תמונה ושם מלא חיים לכל חבר ברשימה
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
          <div className="h-display" style={{ fontSize: 20, color: 'var(--ink)' }}>הזמן חבר לשולחן</div>
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
                  background: invited[f.otherUid] ? 'var(--success)' : 'var(--burgundy)',
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
// שורת שחקן בחדר ההמתנה — תמונה + שם (שם משפחה רק לחברים)
function RummiWaitPlayer({ p, meUid, hostUid }) {
  const { name, photoURL } = usePlayerProfile(p.uid, p.name)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'rgba(74,48,22,.6)', border: `1px solid ${GOLD_DEEP}`,
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

// כרטיס שחקן בפס — שולף תמונה ושם מלא חיים
function RummiPlayerCard({ p, i, turnIdx, winner, me, players }) {
  const { name } = usePlayerProfile(p.id, p.name)
  const isActive = i === turnIdx && !winner
  const compact = players.length >= 4
  const avatarSize = compact ? 28 : 34
  const ctrlSize = compact ? 24 : 26
  return (
    <div style={{
      flex: 1, minWidth: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-start', gap: 4,
      background: isActive ? 'linear-gradient(180deg,#6e4a28,#4a2e16)' : 'rgba(74,48,22,.6)',
      border: isActive ? `1.5px solid ${GOLD}` : '1px solid rgba(201,162,74,.35)',
      borderRadius: 11, padding: '7px 5px 6px',
    }}>
      <PlayerVideo uid={p.id} name={name} size={avatarSize} />
      <div style={{ minWidth: 0, textAlign: 'center', lineHeight: 1.15 }}>
        <div style={{ fontFamily: "'Suez One', serif", fontSize: compact ? 11 : 12, color: CREAM, maxWidth: compact ? 70 : 92, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}{p.id === me.uid ? ' (אתה)' : ''}</div>
        <div style={{ fontSize: 10, color: isActive ? GOLD : GOLD_DEEP, fontWeight: 800 }}>{p.rack.length} אריחים</div>
      </div>
      {/* כפתורי וידאו בשורה נפרדת מתחת לשם */}
      <div style={{ marginTop: 1, paddingTop: 5, width: '100%', borderTop: '1px solid rgba(201,162,74,.18)', display: 'flex', justifyContent: 'center' }}>
        {p.id === me.uid
          ? <VideoControls size={ctrlSize} />
          : <RemoteVideoToggles uid={p.id} size={ctrlSize} />}
      </div>
    </div>
  )
}

function OnlineGame({ room, roomId, me, onBack, onHome }) {
  const { profile } = useUserStore()
  const state = room.gameStateJson ? JSON.parse(room.gameStateJson) : null
  const [draftBoard, setDraftBoard] = useState([])
  const [draftRack, setDraftRack] = useState([])
  const [selectedTileId, setSelectedTileId] = useState(null)
  const [message, setMessage] = useState('')
  const [lastDrawn, setLastDrawn] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [videoChoice, setVideoChoice] = useState(null)  // null=טרם נשאל, true/false=הבחירה
  const [chatOpen, setChatOpen] = useState(false)

  const myIndex = state ? state.players.findIndex(p => p.id === me.uid) : -1
  const turnIdx = state?.turn ?? 0
  const isMyTurn = state && state.turn === myIndex && state.phase === 'play'
  const winner = state?.phase === 'ended' ? state.players[state.winner] : null

  useEffect(() => {
    if (!state) return
    setDraftBoard(state.board)
    setDraftRack(myIndex >= 0 ? state.players[myIndex].rack : [])
    setSelectedTileId(null)
    setMessage('')
  }, [state?.turn, room.gameStateJson]) // eslint-disable-line

  if (!state || myIndex < 0) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg,#2c1d10,#1c1108)', minHeight: '100%' }}>
        <RummiHeaderShared title="רמיקוב" onBack={onBack} />
        <div style={{ padding: 24, textAlign: 'center', color: CREAM }}>טוען את המשחק...</div>
      </div>
    )
  }

  // אישור וידאו — לפני שמתחילים, כל שחקן בוחר אם להפעיל וידאו
  if (videoChoice === null) {
    return (
      <div style={{ direction: 'rtl', background: 'linear-gradient(180deg,#2c1d10,#1c1108)', minHeight: '100%' }}>
        <RummiHeaderShared title="רמיקוב אונליין" onBack={onBack} onHome={onHome} />
        <VideoConsentGate onDecide={(use) => setVideoChoice(use)} accent="#6B4427" accentDeep="#C9A24A" />
      </div>
    )
  }

  const boardOk = isBoardValid(draftBoard)
  const myRackOriginal = state.players[myIndex].rack
  const playedFromRack = draftRack.length < myRackOriginal.length

  const selectTile = (tileId) => {
    if (!isMyTurn || winner) return
    playSound('tap')
    setSelectedTileId(prev => prev === tileId ? null : tileId)
  }

  const placeOnSet = (setIndex) => {
    if (selectedTileId == null || !isMyTurn) return
    const fromRack = draftRack.find(t => t.id === selectedTileId)
    if (!fromRack) { setSelectedTileId(null); return }
    const nb = draftBoard.map(s => [...s])
    // סט חדש נוסף בראש הלוח (unshift) כדי שיהיה תמיד גלוי למעלה בלי לגלול
    if (setIndex === 'new') nb.unshift([fromRack])
    else nb[setIndex] = [...nb[setIndex], fromRack]
    setDraftBoard(nb)
    setDraftRack(draftRack.filter(t => t.id !== selectedTileId))
    setSelectedTileId(null)
    setLastDrawn(null)
    playSound('drop')
  }

  const returnTileToRack = (setIndex, tileId) => {
    if (!isMyTurn) return
    if (!myRackOriginal.find(t => t.id === tileId)) {
      setMessage('אפשר להחזיר רק אריחים שהנחת בתור הזה')
      return
    }
    const nb = draftBoard.map(s => [...s])
    const tile = nb[setIndex].find(t => t.id === tileId)
    nb[setIndex] = nb[setIndex].filter(t => t.id !== tileId)
    setDraftBoard(nb.filter(s => s.length > 0))
    setDraftRack([...draftRack, tile])
    playSound('tap')
  }

  const handleEndTurn = async () => {
    if (!isMyTurn || winner) return
    if (!playedFromRack) { setMessage('לא הנחת אריחים — שלוף אריח'); return }
    if (!boardOk) { setMessage('יש סט לא חוקי על השולחן'); return }
    const originalIds = new Set(state.board.flat().map(t => t.id))
    const newlyPlaced = []
    for (const set of draftBoard) {
      const fresh = set.filter(t => !originalIds.has(t.id))
      if (fresh.length) newlyPlaced.push(...fresh)
    }
    if (!state.players[myIndex].hasMelded) {
      const freshValue = newlyPlaced.reduce((sum, t) => sum + (t.joker ? 0 : t.num), 0)
      if (freshValue < MELD_MIN) {
        setMessage(`לפריצה ראשונה צריך לפחות ${MELD_MIN} נקודות (הנחת ${freshValue})`)
        return
      }
    }
    playSound('drop')
    const ns = commitTurn(state, myIndex, draftBoard, draftRack, true)
    await updateRummikubState(roomId, ns)
    setLastDrawn(null)
  }

  const handleDraw = async () => {
    if (!isMyTurn || winner) return
    const drawn = state.pool.length > 0 ? state.pool[0] : null
    playSound('drop')
    // שליפה חכמה: אם הקופה ריקה — המשחק נגמר ומוכרע לפי נקודות
    const { state: ns, ended } = drawOrResolve(state)
    await updateRummikubState(roomId, ns)
    if (drawn && !ended) setLastDrawn({ tile: drawn, forIdx: myIndex })
  }

  const handleResetDraft = () => {
    setDraftBoard(state.board)
    setDraftRack(myRackOriginal)
    setSelectedTileId(null)
    setMessage('')
    playSound('tap')
  }

  const handleSortRack = (mode) => {
    setDraftRack(prev => sortRack(prev, mode))
    playSound('tap')
  }

  const handleLeave = async () => { await leaveRummikubRoom(roomId); onBack() }

  const statusText = winner
    ? (winner.id === me.uid ? 'ניצחת! 🎉' : `${winner.name} ניצח`)
    : isMyTurn ? 'תורך' : `תור ${state.players[turnIdx].name}`

  // צ'אט האונליין — היריב לצורך ההתראות
  const opponent = state.players.find(p => p.id !== me.uid)
  const chatMsgs = room.chat || []
  const newTileId = lastDrawn && lastDrawn.forIdx === myIndex ? lastDrawn.tile.id : null

  // תפריט (☰) — אפס מהלך + יציאה
  const menuItems = (
    <>
      {isMyTurn && !winner && <RummiMenuItem label="↩ אפס מהלך" onClick={() => { handleResetDraft(); setMenuOpen(false) }} />}
      <RummiMenuItem label="↩ יציאה מהמשחק" onClick={() => { setMenuOpen(false); handleLeave() }} />
    </>
  )

  return (
    <ProfilesProvider uids={state.players.map(p => p.id)} myUid={me.uid}>
    <GameVideoProvider roomId={roomId} me={me} enabled={videoChoice !== null} startWithCam={videoChoice === true}>
    <div style={{ direction: 'rtl', background: 'linear-gradient(180deg,#2c1d10,#1c1108)', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <RummiHeaderShared title="רמיקוב אונליין" onBack={handleLeave} onHome={onHome} onMenu={() => setMenuOpen(o => !o)} menuOpen={menuOpen} menuItems={menuItems} />
      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />}

      {/* פס שחקנים — כל כרטיס: אווטאר+שם למעלה, כפתורי וידאו בשורה נפרדת למטה (לא על השם) */}
      <div style={{ display: 'flex', gap: 5, padding: '8px 8px 0', flexShrink: 0, alignItems: 'stretch' }}>
        {state.players.map((p, i) => (
          <RummiPlayerCard key={p.id} p={p} i={i} turnIdx={turnIdx} winner={winner} me={me} players={state.players} />
        ))}
      </div>

      {/* שורה מאוחדת: השולחן · תורך/סטטוס · קופה */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px 4px', flexShrink: 0, gap: 8 }}>
        <span style={{ fontSize: 13, color: GOLD_DEEP, fontWeight: 700, flexShrink: 0 }}>השולחן</span>
        <span style={{ fontFamily: "'Suez One', serif", fontSize: 15, fontWeight: 800, color: message ? '#ffb3a0' : GOLD, textAlign: 'center', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {message || statusText}
        </span>
        <PoolCounter count={state.pool.length} />
      </div>

      {/* השולחן — גמיש, גולל בפנים אם צריך */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 12px' }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <BoardArea
            board={draftBoard}
            onSetClick={placeOnSet}
            onTileClick={returnTileToRack}
            lastDrawnId={newTileId}
            placing={selectedTileId != null && draftRack.some(t => t.id === selectedTileId)}
          />
        </div>
      </div>

      {/* אזור תחתון קבוע */}
      <div style={{ flexShrink: 0, padding: '6px 12px 14px', borderTop: '1px solid rgba(201,162,74,.15)' }}>
        <PlayerRack rack={draftRack} selectedTileId={selectedTileId} onTileClick={selectTile} onSort={handleSortRack} newTileId={newTileId} />

        {!isMyTurn && !winner && (
          <div style={{ textAlign: 'center', color: CREAM, fontSize: 14, marginTop: 12, opacity: .8 }}>⏳ ממתין לתורך…</div>
        )}

        {isMyTurn && !winner && !state.players[myIndex].hasMelded && (
          <div style={{ textAlign: 'center', fontSize: 13, color: CREAM, marginTop: 8, opacity: .85 }}>
            💡 לירידה ראשונה צריך להניח לפחות {MELD_MIN} נקודות
          </div>
        )}

        {isMyTurn && !winner && (
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <RummiButton ghost label="🎴 שלוף" onClick={handleDraw} />
            <RummiButton gold label="✓ סיים תור" onClick={handleEndTurn} />
          </div>
        )}
      </div>

      {/* כפתור צ'אט צף + התראה (כמו ב"מלך הזירה") */}
      <ChatFab chat={chatMsgs} open={chatOpen} onOpen={() => setChatOpen(true)} bg="linear-gradient(180deg,#6b4528,#4a2e16)" border="#C9A24A" color="#F0D9A0" ringColor="#1c1108" />
      <ChatToast msgs={chatMsgs} meUid={me.uid} suppressed={chatOpen} onOpen={() => setChatOpen(true)} />
      {chatOpen && <ChatPanel roomId={roomId} me={me} msgs={chatMsgs} onClose={() => setChatOpen(false)} sendFn={sendRummikubChat} />}

      {winner && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,8,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24, direction: 'rtl' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: '30px 26px 22px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>{winner.id === me.uid ? '🎉' : '🎴'}</div>
            <div className="h-display" style={{ fontSize: 28, color: winner.id === me.uid ? '#4F6B4A' : '#B89048', marginBottom: 6 }}>
              {winner.id === me.uid ? 'ניצחת!' : `${winner.name} ניצח!`}
            </div>
            <div style={{ fontSize: 16, color: 'var(--ink-2)', marginBottom: 24, fontWeight: 600 }}>
              {winner.id === me.uid ? 'כל הכבוד — נפטרת מכל האריחים!' : 'משחק יפה — אפשר לשחק שוב'}
            </div>
            <button onClick={handleLeave} className="big-btn big-btn--primary" style={{ width: '100%' }}>חזרה לזירה</button>
          </div>
        </div>
      )}
    </div>
    </GameVideoProvider>
    </ProfilesProvider>
  )
}

// כפתור צ'אט למשחק האונליין — עם מונה הודעות שלא נקראו, פותח את ChatPanel
function RummiChatButton({ roomId, me, chatMsgs, wide }) {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(chatMsgs.length)
  const unread = open ? 0 : Math.max(0, chatMsgs.length - seen)
  useEffect(() => { if (open) setSeen(chatMsgs.length) }, [open, chatMsgs.length])

  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        flex: wide ? 1 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        background: 'linear-gradient(180deg,#6b4528,#4a2e16)', color: '#F0D9A0',
        border: '1px solid #C9A24A', borderRadius: 13, padding: '13px 8px',
        fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
        position: 'relative', whiteSpace: 'nowrap',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12), 0 4px 8px rgba(0,0,0,.5)',
      }}>
        💬 צ'אט
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -7, insetInlineStart: -7,
            background: '#E8484F', color: 'white', fontSize: 12, fontWeight: 800,
            minWidth: 20, height: 20, borderRadius: 10, padding: '0 5px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #1c1108',
          }}>{unread}</span>
        )}
      </button>
      {open && <ChatPanel roomId={roomId} me={me} msgs={chatMsgs} onClose={() => setOpen(false)} sendFn={sendRummikubChat} />}
    </>
  )
}

// פריט בתפריט ה☰ של המשחק האונליין
function RummiMenuItem({ label, onClick }) {
  return <button onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'right', background: 'none', border: 'none', color: CREAM, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', padding: '11px 12px', borderRadius: 8, cursor: 'pointer' }}>{label}</button>
}
