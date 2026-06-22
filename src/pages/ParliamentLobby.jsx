// src/pages/ParliamentLobby.jsx
// ─────────────────────────────────────────────────────────────
// כניסת הפרלמנט — מסך בחירה + חדרי המתנה (חברים / רנדומלי).
//
// זרימה:
//   1. ParliamentModeSelect — בחירה: "עם חברים" או "רנדומלי".
//   2a. חברים  → יוצר חדר פרטי (עד 10), חדר המתנה עם הזמנת חברים.
//   2b. רנדומלי → מצטרף/יוצר חדר ציבורי (עד 5), חדר המתנה עם מונה.
//   3. ParliamentWaitingRoom — מציג מי הצטרף; המארח לוחץ "התחל" (כשיש 3+).
//   4. כשהחדר עובר ל-active → כולם שולפים טוקן LiveKit ונכנסים ל-
//      ParliamentScreen הקיים (הדיון עצמו) דרך ה-sessionStore.
//
// התשתית: parliamentRooms (firebase.js) — תאומה למודל חדרי המשחקים.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { IconBackRTL, IconCheck, IconHourglass, IconGamepad, IconGroup, IconPodium } from '../icons/index.jsx'
import HomeButton from '../components/HomeButton.jsx'
import Avatar from '../components/Avatar.jsx'
import { useUserStore } from '../stores/userStore.js'
import { useSessionStore } from '../stores/sessionStore.js'
import { ProfilesProvider, usePlayerProfile } from '../components/GameVideo.jsx'
import {
  createParliamentRoom, joinParliamentRoom, watchParliamentRoom,
  startParliamentRoom, leaveParliamentRoom, findOrCreateParliamentMatch,
  watchFriendships, sendGameInvite, watchUser, fetchLiveKitToken,
} from '../services/firebase.js'

const MIN_START = 3       // מינימום משתתפים כדי להתחיל דיון
const MAX_RANDOM = 5      // מקסימום בפרלמנט רנדומלי
const MAX_FRIENDS = 10    // מקסימום בפרלמנט עם חברים

const NAVY = '#1B2540'
const NAVY_DEEP = '#0E1730'

// ════════════════════════════════════════════════════════
// רכיב ראשי — ניתוב בין בחירה / הכנה / חדר המתנה
// ════════════════════════════════════════════════════════
export default function ParliamentLobby({ initialRoomId = null, onBack, onHome }) {
  const { authUser, profile } = useUserStore()
  const me = { uid: authUser?.uid, name: profile?.name || 'משתמש', photoURL: profile?.photoURL || '' }
  const [mode, setMode] = useState(initialRoomId ? 'friends' : null)  // 'random' | 'friends' | null (בחירה)
  const [roomId, setRoomId] = useState(initialRoomId || null)
  useEffect(() => { if (initialRoomId) setRoomId(initialRoomId) }, [initialRoomId])

  if (roomId) {
    return (
      <ParliamentWaitingRoom
        roomId={roomId} me={me}
        onBack={() => { setRoomId(null); setMode(null); onBack?.() }}
        onHome={onHome}
      />
    )
  }
  if (!mode) {
    return (
      <ParliamentModeSelect
        onBack={onBack} onHome={onHome}
        onRandom={() => setMode('random')}
        onFriends={() => setMode('friends')}
      />
    )
  }
  return (
    <ParliamentSetup
      mode={mode} me={me}
      onBack={() => setMode(null)} onHome={onHome}
      onReady={(id) => setRoomId(id)}
    />
  )
}

// ════════════════════════════════════════════════════════
// מסך בחירה — עם חברים / רנדומלי
// ════════════════════════════════════════════════════════
function ParliamentModeSelect({ onBack, onHome, onRandom, onFriends }) {
  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">הפרלמנט</div>
      </div>
      <div style={{ padding: '8px 20px 32px' }}>
        <div style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DEEP})`, borderRadius: 20, padding: '22px 18px', color: '#FBF7EE', marginBottom: 24, boxShadow: '0 8px 20px -6px rgba(14,23,48,.5)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><IconPodium size={50} color="#f1c95c" /></div>
          <div className="h-display" style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 6 }}>הפרלמנט</div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'rgba(255,255,255,.92)' }}>דיון קבוצתי בווידאו — כל אחד מקבל תור לדבר</div>
        </div>
        <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>איך תרצו לפתוח דיון?</h2>

        <ParlModeButton
          onClick={onFriends}
          gradient="linear-gradient(135deg,#4F6B4A,#354D31)"
          icon={<IconGroup size={34} color="#fff" />}
          label="פרלמנט עם חברים"
          description="הזמינו עד 10 חברים מהרשימה שלכם"
        />
        <ParlModeButton
          onClick={onRandom}
          gradient="linear-gradient(135deg,#2B3A66,#141E36)"
          icon={<IconGamepad size={34} color="#fff" />}
          label="פרלמנט רנדומלי"
          description="הצטרפו לדיון עם אנשים אחרים באפליקציה"
        />
      </div>
    </div>
  )
}

function ParlModeButton({ onClick, icon, gradient, label, description }) {
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)', lineHeight: 1.15 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginTop: 2 }}>{description}</div>
      </div>
      <IconBackRTL size={20} color="#8389A4" />
    </button>
  )
}

// ════════════════════════════════════════════════════════
// הכנה — יוצר/מצטרף לחדר ואז עובר לחדר המתנה
// ════════════════════════════════════════════════════════
function ParliamentSetup({ mode, me, onBack, onHome, onReady }) {
  const [error, setError] = useState('')
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current || !me.uid) return
    startedRef.current = true
    ;(async () => {
      try {
        if (mode === 'random') {
          const { roomId } = await findOrCreateParliamentMatch({ player: me, maxPlayers: MAX_RANDOM })
          onReady(roomId)
        } else {
          const { roomId } = await createParliamentRoom({ host: me, roomType: 'private', maxPlayers: MAX_FRIENDS })
          onReady(roomId)
        }
      } catch (e) {
        console.error('parliament setup error:', e)
        setError('לא הצלחנו לפתוח חדר — נסו שוב')
      }
    })()
  }, [mode, me.uid]) // eslint-disable-line

  if (error) {
    return (
      <ParliamentShell onBack={onBack} onHome={onHome}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 54 }}>😕</div>
          <div className="h-display" style={{ fontSize: 22, color: '#FBF7EE' }}>{error}</div>
          <button onClick={onBack} className="big-btn" style={{ background: '#FBF7EE', color: NAVY, minWidth: 200 }}>חזרה</button>
        </div>
      </ParliamentShell>
    )
  }
  return (
    <ParliamentShell onBack={onBack} onHome={onHome}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        <IconPodium size={84} color="#f1c95c" />
        <div className="h-display" style={{ fontSize: 24, color: '#FBF7EE' }}>פותחים חדר דיון…</div>
      </div>
    </ParliamentShell>
  )
}

// ════════════════════════════════════════════════════════
// מעטפת מסך כהה (navy) משותפת לחדרי הפרלמנט
// ════════════════════════════════════════════════════════
function ParliamentShell({ children, onBack, onHome, title = 'הפרלמנט' }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)`, color: '#FBF7EE', display: 'flex', flexDirection: 'column', padding: '16px 20px calc(20px + env(safe-area-inset-bottom))', zIndex: 1000, direction: 'rtl', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <button onClick={onBack} aria-label="חזרה" style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,.12)', color: '#FBF7EE', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, cursor: 'pointer' }}>→</button>
        {onHome && <button onClick={onHome} aria-label="בית" style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,.12)', color: '#FBF7EE', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>
        </button>}
        <div className="h-display" style={{ fontSize: 20, flex: 1, textAlign: 'center', marginInlineEnd: 54 }}>{title}</div>
      </div>
      {children}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// חדר המתנה — מי הצטרף + המארח מתחיל
// ════════════════════════════════════════════════════════
// רדאר סורק סביב לוגו הפרלמנט — למצב רנדומלי (מחפשים משתתפים)
const PARL_RADAR_CSS = `
.parl-radar{position:relative;width:158px;height:158px;display:flex;align-items:center;justify-content:center;margin:0 auto}
.parl-radar .pr-ring{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(241,201,92,.35)}
.parl-radar .pr-ring.a{animation:parlPulse 2.1s ease-out infinite}
.parl-radar .pr-ring.b{animation:parlPulse 2.1s ease-out 1.05s infinite}
@keyframes parlPulse{0%{transform:scale(.5);opacity:.85}100%{transform:scale(1.18);opacity:0}}
.parl-radar .pr-sweep{position:absolute;inset:8px;border-radius:50%;background:conic-gradient(from 0deg,rgba(241,201,92,.6),rgba(241,201,92,0) 65%);animation:parlSweep 2.4s linear infinite;-webkit-mask:radial-gradient(circle,transparent 34%,#000 35%);mask:radial-gradient(circle,transparent 34%,#000 35%)}
@keyframes parlSweep{to{transform:rotate(360deg)}}
.parl-radar .pr-core{position:relative;z-index:2;width:86px;height:86px;border-radius:50%;background:rgba(255,255,255,.10);border:2px solid rgba(241,201,92,.5);display:flex;align-items:center;justify-content:center;box-shadow:0 0 22px rgba(241,201,92,.25)}
.parl-search-text{font-size:18px;font-weight:800;color:#f1c95c;animation:parlBlink 1.4s ease-in-out infinite}
@keyframes parlBlink{0%,100%{opacity:1}50%{opacity:.35}}
@media (prefers-reduced-motion:reduce){.parl-radar .pr-ring.a,.parl-radar .pr-ring.b,.parl-radar .pr-sweep,.parl-search-text{animation:none}}
`

function RadarSearching({ count, max }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div className="parl-radar">
        <span className="pr-ring a" />
        <span className="pr-ring b" />
        <span className="pr-sweep" />
        <span className="pr-core"><IconPodium size={42} color="#f1c95c" /></span>
      </div>
      <div className="parl-search-text">מחפשים משתתפים נוספים…</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#eaf6ef', opacity: .9 }}>{count}/{max} מחוברים</div>
    </div>
  )
}

function ParliamentWaitingRoom({ roomId, me, onBack, onHome }) {
  const { setParliamentSession, setParliamentLivekit } = useSessionStore()
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const joinedRef = useRef(false)
  const connectingRef = useRef(false)

  useEffect(() => {
    if (!joinedRef.current) { joinedRef.current = true; joinParliamentRoom(roomId, me).catch(() => {}) }
    const unsub = watchParliamentRoom(roomId, (data) => {
      if (!data) { setError('הדיון נסגר'); return }
      setRoom(data)
    })
    return () => unsub && unsub()
  }, [roomId]) // eslint-disable-line

  // כשהמארח מתחיל (status=active) — כולם מתחברים ל-LiveKit ועוברים ל-ParliamentScreen
  useEffect(() => {
    if (!room || room.status !== 'active' || connectingRef.current) return
    connectingRef.current = true
    ;(async () => {
      try {
        const token = await fetchLiveKitToken(room.livekitRoom, me.name, me.uid)
        setParliamentSession({ id: roomId })
        setParliamentLivekit({ token, room: room.livekitRoom })
        // App.jsx: ברגע ש-parliamentToken נקבע → setPage('parliament')
      } catch (e) {
        console.error('parliament connect error:', e)
        setError('לא הצלחנו להתחבר לדיון')
        connectingRef.current = false
      }
    })()
  }, [room?.status]) // eslint-disable-line

  const isHost = room?.hostUid === me.uid
  const players = room?.players || []
  const isPrivate = room?.roomType === 'private'
  const maxPlayers = room?.maxPlayers || (isPrivate ? MAX_FRIENDS : MAX_RANDOM)
  const canStart = players.length >= MIN_START
  const canInviteMore = isPrivate && players.length < maxPlayers

  const handleStart = async () => { if (canStart) await startParliamentRoom(roomId) }
  const handleLeave = async () => { await leaveParliamentRoom(roomId, me.uid); onBack?.() }
  const handleInvite = async (friend) => {
    try { await sendGameInvite({ from: me, to: { uid: friend.otherUid, name: friend.otherName }, gameType: 'parliament', roomId }) }
    catch (e) { console.error('parliament invite error:', e) }
  }

  if (error) {
    return (
      <ParliamentShell onBack={onBack} onHome={onHome}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 54 }}>👋</div>
          <div className="h-display" style={{ fontSize: 22, color: '#FBF7EE' }}>{error}</div>
          <button onClick={onBack} className="big-btn" style={{ background: '#FBF7EE', color: NAVY, minWidth: 200 }}>חזרה לבית</button>
        </div>
      </ParliamentShell>
    )
  }

  // מתחברים לדיון (אחרי שהמארח התחיל)
  if (room?.status === 'active') {
    return (
      <ParliamentShell onBack={handleLeave} onHome={onHome}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
          <IconPodium size={84} color="#f1c95c" />
          <div className="h-display" style={{ fontSize: 24, color: '#FBF7EE' }}>הדיון מתחיל…</div>
          <div style={{ fontSize: 16, opacity: .85 }}>מתחברים לווידאו</div>
        </div>
      </ParliamentShell>
    )
  }

  if (!room) {
    return (
      <ParliamentShell onBack={onBack} onHome={onHome}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: '#f4e3b2' }}>טוען…</div>
      </ParliamentShell>
    )
  }

  return (
    <ParliamentShell onBack={handleLeave} onHome={onHome} title="חדר המתנה">
      <style>{PARL_RADAR_CSS}</style>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        {isPrivate ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><IconPodium size={52} color="#f1c95c" /></div>
        ) : (
          <div style={{ marginBottom: 14 }}><RadarSearching count={players.length} max={maxPlayers} /></div>
        )}
        <div className="h-display" style={{ fontSize: 22, color: '#f1c95c' }}>
          {isPrivate ? 'חדר הדיון שלך' : 'ממתינים שיצטרפו עוד'}
        </div>
        <div style={{ marginTop: 8, fontSize: 14, color: '#eaf6ef', opacity: .85, lineHeight: 1.5 }}>
          {players.length < MIN_START
            ? `צריך לפחות ${MIN_START} משתתפים כדי להתחיל`
            : (isHost ? 'אפשר להתחיל בכל רגע' : 'מחכים שמנהל הדיון יתחיל')}
        </div>
      </div>

      <ProfilesProvider uids={players.map(p => p.uid)} myUid={me.uid}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {players.map(p => <WaitPlayer key={p.uid} p={p} meUid={me.uid} hostUid={room.hostUid} />)}
          {isPrivate && Array.from({ length: Math.max(0, maxPlayers - players.length) }).slice(0, 6).map((_, i) => {
            const isInviteSlot = canInviteMore && i === 0
            return (
              <div key={`empty-${i}`} onClick={isInviteSlot ? () => setShowInvite(true) : undefined} style={{ display: 'flex', alignItems: 'center', gap: 12, background: isInviteSlot ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.05)', border: isInviteSlot ? '1px solid #c9a24a' : '1px dashed rgba(255,255,255,.22)', borderRadius: 14, padding: '12px 16px', color: isInviteSlot ? '#eaf6ef' : 'rgba(234,246,239,.5)', cursor: isInviteSlot ? 'pointer' : 'default' }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: isInviteSlot ? '#f1c95c' : 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: isInviteSlot ? NAVY : 'inherit' }}>＋</div>
                <div style={{ fontSize: 15, fontWeight: isInviteSlot ? 800 : 400 }}>{isInviteSlot ? 'הזמן עוד חבר' : 'ממתינים למשתתפים…'}</div>
              </div>
            )
          })}
        </div>
      </ProfilesProvider>

      <div style={{ flex: 1 }} />

      {isHost ? (
        <button onClick={handleStart} disabled={!canStart} className="big-btn" style={{ width: '100%', background: canStart ? '#FBF7EE' : 'rgba(255,255,255,.18)', color: canStart ? NAVY : 'rgba(255,255,255,.6)', boxShadow: canStart ? '0 8px 20px -6px rgba(0,0,0,.4)' : 'none' }}>
          {canStart ? `התחל דיון (${players.length})` : `צריך לפחות ${MIN_START} משתתפים`}
        </button>
      ) : (
        <div style={{ width: '100%', padding: '16px', borderRadius: 18, background: 'rgba(255,255,255,.10)', textAlign: 'center', fontSize: 16, fontWeight: 600 }}>
          ⏳ ממתינים שמנהל הדיון יתחיל…
        </div>
      )}

      {showInvite && (
        <ParliamentInvitePicker me={me} players={players} onClose={() => setShowInvite(false)} onInvite={handleInvite} />
      )}
    </ParliamentShell>
  )
}

function WaitPlayer({ p, meUid, hostUid }) {
  const { name, photoURL } = usePlayerProfile(p.uid, p.name)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(201,162,74,.4)', borderRadius: 14, padding: '12px 16px' }}>
      <Avatar name={name} size={42} photoURL={photoURL} />
      <div style={{ flex: 1, fontFamily: "'Suez One', serif", fontSize: 17, color: '#eaf6ef' }}>{name}{p.uid === meUid ? ' (אתה)' : ''}</div>
      {p.uid === hostUid && <span style={{ fontSize: 12, color: '#f1c95c', fontWeight: 800 }}>מנהל</span>}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// בוחר חברים להזמנה (חדר פרטי) — bottom sheet
// ════════════════════════════════════════════════════════
function ParliamentInvitePicker({ me, players, onInvite, onClose }) {
  const [friends, setFriends] = useState([])
  const [invited, setInvited] = useState({})
  const [profileMap, setProfileMap] = useState({})
  useEffect(() => { if (!me.uid) return; const unsub = watchFriendships(me.uid, ({ friends }) => setFriends(friends)); return () => unsub && unsub() }, [me.uid])
  useEffect(() => {
    if (!friends || friends.length === 0) return
    const unsubs = friends.map((f) => { if (!f.otherUid) return null; return watchUser(f.otherUid, (u) => { const fullName = [u?.name, u?.lastName].filter(Boolean).join(' '); setProfileMap((prev) => ({ ...prev, [f.otherUid]: { name: fullName, photoURL: u?.photoURL || null } })) }) })
    return () => unsubs.forEach((u) => u && u())
  }, [friends])
  const inRoom = new Set(players.map((p) => p.uid))
  const available = friends.filter((f) => f.otherUid && !inRoom.has(f.otherUid))
  const pick = (f) => { setInvited((prev) => ({ ...prev, [f.otherUid]: true })); onInvite(f) }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(10,15,30,.72)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', direction: 'rtl' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, maxHeight: '72vh', overflowY: 'auto', padding: '20px 18px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="h-display" style={{ fontSize: 20, color: 'var(--ink)' }}>הזמן חבר לדיון</div>
          <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'var(--line)', color: 'var(--ink)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        {available.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-2)', padding: '26px 0', fontSize: 15 }}>אין חברים נוספים זמינים להזמנה</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {available.map((f) => {
              const prof = profileMap[f.otherUid]; const dispName = prof?.name || f.otherName
              return (
                <div key={f.docId} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar name={dispName} size={46} photoURL={prof?.photoURL} />
                  <div className="h-display" style={{ flex: 1, minWidth: 0, fontSize: 16, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dispName}</div>
                  <button disabled={!!invited[f.otherUid]} onClick={() => pick(f)} style={{ background: invited[f.otherUid] ? 'var(--success)' : 'var(--burgundy)', color: 'white', border: 'none', borderRadius: 12, padding: '10px 16px', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: invited[f.otherUid] ? 'default' : 'pointer', whiteSpace: 'nowrap' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{invited[f.otherUid] ? <><IconCheck size={16} color="white" /> נשלח</> : <><IconGamepad size={16} color="white" /> הזמן</>}</span></button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
