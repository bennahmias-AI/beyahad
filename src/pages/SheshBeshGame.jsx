// src/pages/SheshBeshGame.jsx
// ─────────────────────────────────────────────────────────────
// משחק "שש-בש" (Backgammon) — גרסה קלאסית מלאה, עיצוב יוקרתי (עץ אגוז).
//
// חוקים: לוח 24 נקודות, 15 כלים, בר (נאכלו), בית (יצאו). 2 קוביות, דאבל=4
// מהלכים, אכילה→בר, חסימה ב-2+, כניסה מהבר קודם, הוצאה כשכל הכלים בבית.
//
// 4 מצבים: מול המחשב / מקומי / רנדומלי / עם חבר. תשתית Firestore משותפת.
// קונבנציה: P1=בהיר/זהב, בית 1-6, נע 24→1. P2=כהה, בית 19-24, נע 1→24.
// ייצוג: points[0..23] חתום (+P1/-P2). bar/off={P1,P2}.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { IconBackRTL } from '../icons/index.jsx'
import { GameIcon } from '../icons/gameIcons.jsx'
import { useUserStore } from '../stores/userStore.js'
import {
  createGameRoom, watchGameRoom, updateGameState, updateGameRoom,
  leaveGameRoom, findOrCreateMatch, watchFriendships, sendGameInvite,
  watchInvite, deleteGameInvite, watchUser,
} from '../services/firebase.js'
import { playSound, isMuted, setMuted } from '../utils/gameSounds.js'
import Avatar from '../components/Avatar.jsx'
import { ChatPanel, AddFriendButton, ChatToast } from '../components/GameChat.jsx'

// ════════════════════════════════════════════════════════
// פלטת עץ ופליז (משותף לעיצוב)
// ════════════════════════════════════════════════════════
const WOOD_FRAME = 'repeating-linear-gradient(91deg, rgba(0,0,0,.05) 0 1px, transparent 1px 5px), linear-gradient(155deg,#71492a 0%,#4d3017 55%,#3a2410 100%)'
const WOOD_TABLE = 'repeating-linear-gradient(90deg, rgba(0,0,0,.045) 0 1px, transparent 1px 6px), linear-gradient(165deg,#5c3c22 0%,#3f2710 100%)'
const WOOD_DARK  = 'linear-gradient(160deg,#3e2712,#2a1a0b)'
const TRI_DARK   = 'repeating-linear-gradient(86deg, rgba(0,0,0,.05) 0 1px, transparent 1px 4px), linear-gradient(180deg,#823f24 0%,#5e2c15 55%,#46200f 100%)'
const TRI_LIGHT  = 'repeating-linear-gradient(86deg, rgba(120,80,30,.07) 0 1px, transparent 1px 4px), linear-gradient(180deg,#ecd3a2 0%,#d8b87c 55%,#c19c58 100%)'
const GOLD       = '#E8C879'
const GOLD_DEEP  = '#C9A24A'
const CREAM      = '#F3E2BE'

// ════════════════════════════════════════════════════════
// מנוע המשחק — פונקציות טהורות
// ════════════════════════════════════════════════════════
function initialState() {
  const points = Array(24).fill(0)
  points[23] = 2; points[12] = 5; points[7] = 3; points[5] = 5     // P1
  points[0] = -2; points[11] = -5; points[16] = -3; points[18] = -5 // P2
  return {
    points, bar: { P1: 0, P2: 0 }, off: { P1: 0, P2: 0 },
    turn: 'P1', dice: [], rolled: [], phase: 'roll', winner: null, lastAction: 0,
  }
}

function cloneState(s) {
  return {
    points: [...s.points], bar: { ...s.bar }, off: { ...s.off },
    turn: s.turn, dice: [...s.dice], rolled: [...(s.rolled || [])],
    phase: s.phase, winner: s.winner || null, lastAction: s.lastAction || 0,
  }
}

const sgnOf = (player) => (player === 'P1' ? 1 : -1)
const oppOf = (player) => (player === 'P1' ? 'P2' : 'P1')
const uniq = (arr) => [...new Set(arr)]

function allHome(s, player) {
  if (s.bar[player] > 0) return false
  if (player === 'P1') { for (let i = 6; i < 24; i++) if (s.points[i] > 0) return false }
  else { for (let i = 0; i < 18; i++) if (s.points[i] < 0) return false }
  return true
}

function canBearOff(s, player, from, d) {
  if (!allHome(s, player)) return false
  if (player === 'P1') {
    const pointNum = from + 1
    if (d === pointNum) return true
    if (d > pointNum) { for (let i = from + 1; i <= 5; i++) if (s.points[i] > 0) return false; return true }
    return false
  } else {
    const dist = 24 - from
    if (d === dist) return true
    if (d > dist) { for (let i = 18; i < from; i++) if (s.points[i] < 0) return false; return true }
    return false
  }
}

function movesFrom(s, player, from) {
  const sgn = sgnOf(player)
  const res = []
  const dice = uniq(s.dice)
  if (s.bar[player] > 0 && from !== 'bar') return res
  if (from === 'bar') {
    for (const d of dice) {
      const t = player === 'P1' ? 24 - d : d - 1
      if (t < 0 || t > 23) continue
      if (s.points[t] * sgn <= -2) continue
      res.push({ die: d, to: t })
    }
    return res
  }
  if (s.points[from] * sgn <= 0) return res
  for (const d of dice) {
    const target = player === 'P1' ? from - d : from + d
    const bearing = player === 'P1' ? target < 0 : target > 23
    if (bearing) { if (canBearOff(s, player, from, d)) res.push({ die: d, to: 'off' }) }
    else { if (s.points[target] * sgn <= -2) continue; res.push({ die: d, to: target }) }
  }
  return res
}

function allMoves(s, player) {
  const sgn = sgnOf(player)
  const list = []
  if (s.bar[player] > 0) { for (const m of movesFrom(s, player, 'bar')) list.push({ from: 'bar', ...m }); return list }
  for (let i = 0; i < 24; i++) if (s.points[i] * sgn > 0) for (const m of movesFrom(s, player, i)) list.push({ from: i, ...m })
  return list
}

function hasAnyMove(s, player) {
  if (s.dice.length === 0) return false
  return allMoves(s, player).length > 0
}

function performSingleMove(s, player, from, die, to) {
  const ns = cloneState(s)
  const sgn = sgnOf(player)
  const opp = oppOf(player)
  if (from === 'bar') ns.bar[player] -= 1
  else ns.points[from] -= sgn
  if (to === 'off') ns.off[player] += 1
  else {
    if (ns.points[to] === -sgn) { ns.points[to] = 0; ns.bar[opp] += 1 }
    ns.points[to] += sgn
  }
  const di = ns.dice.indexOf(die)
  if (di >= 0) ns.dice.splice(di, 1)
  if (ns.off[player] === 15) ns.winner = player
  ns.lastAction = Date.now()
  return ns
}

function performRoll(s, player) {
  const a = 1 + Math.floor(Math.random() * 6)
  const b = 1 + Math.floor(Math.random() * 6)
  const ns = cloneState(s)
  ns.rolled = [a, b]
  ns.dice = a === b ? [a, a, a, a] : [a, b]
  ns.phase = 'move'
  ns.lastAction = Date.now()
  return ns
}

function passTurn(s) {
  const ns = cloneState(s)
  ns.turn = oppOf(s.turn)
  ns.phase = 'roll'; ns.dice = []; ns.rolled = []
  ns.lastAction = Date.now()
  return ns
}

function pip(s, player) {
  const sgn = sgnOf(player)
  let p = 0
  for (let i = 0; i < 24; i++) { const c = s.points[i] * sgn; if (c > 0) { const dist = player === 'P1' ? i + 1 : 24 - i; p += c * dist } }
  return p + s.bar[player] * 25
}

function evalState(s, player) {
  const opp = oppOf(player), sgn = sgnOf(player)
  let score = 0
  score += s.off[player] * 60; score -= s.off[opp] * 60
  score -= pip(s, player); score += pip(s, opp) * 0.7
  for (let i = 0; i < 24; i++) { const c = s.points[i] * sgn; if (c === 1) score -= 6; else if (c >= 2) score += 2 }
  score -= s.bar[player] * 20
  return score
}

function bestAIMove(s, player, difficulty) {
  const moves = allMoves(s, player)
  if (!moves.length) return null
  if (difficulty === 'easy') return moves[Math.floor(Math.random() * moves.length)]
  let best = null, bestV = -1e9
  for (const m of moves) {
    const ns = performSingleMove(s, player, m.from, m.die, m.to)
    const v = evalState(ns, player) + Math.random() * (difficulty === 'hard' ? 0.3 : 1.5)
    if (v > bestV) { bestV = v; best = m }
  }
  return best
}

function afterMove(ns, player) {
  if (ns.winner) return ns
  if (ns.dice.length === 0 || !hasAnyMove(ns, player)) return passTurn(ns)
  return ns
}

// ════════════════════════════════════════════════════════
// קומפוננטה ראשית
// ════════════════════════════════════════════════════════
export default function SheshBeshGame({ onBack, initialRoomId }) {
  const [mode, setMode] = useState(initialRoomId ? 'online-friend' : null)
  const [difficulty, setDifficulty] = useState('medium')
  const [roomId, setRoomId] = useState(initialRoomId || null)

  useEffect(() => { if (initialRoomId) { setMode('online-friend'); setRoomId(initialRoomId) } }, [initialRoomId])

  if (!mode) {
    return (
      <ModeSelectScreen
        onBack={onBack}
        onSelectAI={(diff) => { setDifficulty(diff); setMode('ai') }}
        onSelectLocal={() => setMode('local')}
        onSelectOnlineRandom={() => setMode('online-random')}
        onSelectOnlineFriend={() => setMode('online-friend')}
      />
    )
  }
  if (mode === 'online-random' || mode === 'online-friend') {
    if (!roomId) return <OnlineLobby mode={mode} onBack={() => setMode(null)} onReady={(id) => setRoomId(id)} />
    return (
      <OnlineGameScreen
        roomId={roomId}
        onBack={() => { setRoomId(null); setMode(null) }}
        onExit={onBack}
        onFindOther={() => { setRoomId(null); setMode('online-random') }}
      />
    )
  }
  return <LocalGameScreen mode={mode} difficulty={difficulty} onBack={() => setMode(null)} onExit={onBack} />
}

// ════════════════════════════════════════════════════════
// מסך בחירת מצב
// ════════════════════════════════════════════════════════
function ModeSelectScreen({ onBack, onSelectAI, onSelectLocal, onSelectOnlineRandom, onSelectOnlineFriend }) {
  const [showDifficulty, setShowDifficulty] = useState(false)
  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <div className="screen-header__title">שש-בש</div>
      </div>
      <div style={{ padding: '8px 20px 32px' }}>
        <div style={{ background: 'linear-gradient(135deg, #6B4427 0%, #4A2E18 100%)', borderRadius: 20, padding: '20px 18px', color: '#FBF7EE', marginBottom: 24, boxShadow: '0 8px 20px -6px rgba(74,46,24,.5)', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🎲</div>
          <div className="h-display" style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 6 }}>שש-בש</div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'rgba(255,255,255,.92)' }}>גלגלו קוביות והוציאו את כל הכלים ראשונים</div>
        </div>
        {!showDifficulty ? (
          <>
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>בחרו איך לשחק:</h2>
            <ModeButton onClick={onSelectOnlineRandom} iconId="online-random" gradient="linear-gradient(135deg, #7E2C2E, #5A1D1E)" label="שחקן רנדומלי" description="שחקו עם מישהו אחר באפליקציה" badge="חדש" />
            <ModeButton onClick={onSelectOnlineFriend} iconId="online-friend" gradient="linear-gradient(135deg, #4F6B4A, #354D31)" label="שחק עם חבר" description="הזמינו חבר מרשימת החברים שלכם" badge="חדש" />
            <ModeButton onClick={() => setShowDifficulty(true)} iconId="vs-ai" gradient="linear-gradient(135deg, #2C5566, #173846)" label="נגד המחשב" description="משחק לבד בכל זמן" />
            <ModeButton onClick={onSelectLocal} iconId="local-2p" gradient="linear-gradient(135deg, #B89048, #8A6A2E)" label="שני שחקנים" description="על אותו מכשיר — אחד מול השני" />
          </>
        ) : (
          <>
            <button onClick={() => setShowDifficulty(false)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ink-2)', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconBackRTL size={18} color="#8389A4" /> חזרה
            </button>
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>בחרו רמת קושי:</h2>
            <DifficultyButton label="קל" emoji="🌱" color="#4F6B4A" description="המחשב משחק בפשטות" onClick={() => onSelectAI('easy')} />
            <DifficultyButton label="בינוני" emoji="⚡" color="#B89048" description="המחשב מחפש מהלכים טובים" onClick={() => onSelectAI('medium')} />
            <DifficultyButton label="קשה" emoji="🔥" color="#7E2C2E" description="המחשב משחק חכם ובטוח" onClick={() => onSelectAI('hard')} />
          </>
        )}
      </div>
    </div>
  )
}

function ModeButton({ onClick, iconId, gradient, label, description, badge }) {
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '16px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', position: 'relative' }}>
      {badge && <div style={{ position: 'absolute', top: -8, insetInlineStart: 12, background: 'var(--burgundy)', color: 'white', fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 999 }}>✨ {badge}</div>}
      <div style={{ width: 52, height: 52, borderRadius: 14, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><GameIcon id={iconId} size={36} /></div>
      <div style={{ flex: 1 }}>
        <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)', lineHeight: 1.15 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginTop: 2 }}>{description}</div>
      </div>
      <IconBackRTL size={20} color="#8389A4" />
    </button>
  )
}

function DifficultyButton({ label, emoji, color, description, onClick }) {
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{emoji}</div>
      <div style={{ flex: 1 }}>
        <div className="h-display" style={{ fontSize: 17, color: 'var(--ink)', lineHeight: 1.15 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginTop: 2 }}>{description}</div>
      </div>
      <IconBackRTL size={20} color="#8389A4" />
    </button>
  )
}

// ════════════════════════════════════════════════════════
// Lobby אונליין
// ════════════════════════════════════════════════════════
function OnlineLobby({ mode, onBack, onReady }) {
  const { profile, authUser } = useUserStore()
  const [phase, setPhase] = useState(mode === 'online-random' ? 'searching' : 'friend-list')
  const [errorMsg, setErrorMsg] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [createdRoomId, setCreatedRoomId] = useState(null)
  const [invitedFriend, setInvitedFriend] = useState(null)
  const [inviteId, setInviteId] = useState(null)
  const [friends, setFriends] = useState([])
  const watchUnsubRef = useRef(null)
  const inviteUnsubRef = useRef(null)
  const friendsUnsubRef = useRef(null)
  const startedRef = useRef(false)
  const successfulMatchRef = useRef(false)

  useEffect(() => {
    if (mode !== 'online-friend' || !authUser?.uid) return
    friendsUnsubRef.current = watchFriendships(authUser.uid, ({ friends }) => setFriends(friends))
    return () => { if (friendsUnsubRef.current) friendsUnsubRef.current() }
  }, [mode, authUser?.uid])

  useEffect(() => {
    if (mode !== 'online-random' || startedRef.current) return
    startedRef.current = true; startRandom()
  }, [mode]) // eslint-disable-line

  useEffect(() => {
    if (phase !== 'searching' && phase !== 'waiting') return
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  const createdRoomIdRef = useRef(null)
  useEffect(() => { createdRoomIdRef.current = createdRoomId }, [createdRoomId])
  useEffect(() => {
    return () => {
      if (watchUnsubRef.current) watchUnsubRef.current()
      const roomToClean = createdRoomIdRef.current
      if (roomToClean && !successfulMatchRef.current) leaveGameRoom(roomToClean).catch(() => {})
    }
  }, []) // eslint-disable-line

  const startRandom = async () => {
    if (!authUser?.uid) { setErrorMsg('צריך להיות מחובר כדי לשחק אונליין'); setPhase('error'); return }
    setErrorMsg('')
    try {
      const player = { uid: authUser.uid, name: profile?.name || 'משתמש' }
      const { roomId, isCreator } = await findOrCreateMatch({ gameType: 'sheshbesh', player })
      setCreatedRoomId(roomId)
      if (isCreator) {
        setPhase('waiting')
        watchUnsubRef.current = watchGameRoom(roomId, (data) => {
          if (data && (data.status === 'playing' || (data.players || []).length === 2)) {
            successfulMatchRef.current = true
            if (watchUnsubRef.current) { watchUnsubRef.current(); watchUnsubRef.current = null }
            onReady(roomId)
          }
        })
      } else { successfulMatchRef.current = true; onReady(roomId) }
    } catch (e) { console.error('Sheshbesh matchmaking error:', e); setErrorMsg('לא הצלחנו למצוא משחק — נסו שוב'); setPhase('error') }
  }

  const inviteFriend = async (friend) => {
    if (!authUser?.uid) return
    setErrorMsg('')
    try {
      const player = { uid: authUser.uid, name: profile?.name || 'משתמש' }
      const { roomId } = await createGameRoom({ gameType: 'sheshbesh', creator: player, roomType: 'private' })
      setCreatedRoomId(roomId)
      const newInviteId = await sendGameInvite({ from: player, to: { uid: friend.otherUid, name: friend.otherName }, gameType: 'sheshbesh', roomId })
      setInviteId(newInviteId); setInvitedFriend(friend); setPhase('waiting-for-friend')
      inviteUnsubRef.current = watchInvite(newInviteId, (data) => {
        if (!data) return
        if (data.status === 'declined') {
          setErrorMsg(`${friend.otherName} דחתה את ההזמנה`); setPhase('friend-declined')
          deleteGameInvite(newInviteId).catch(() => {}); leaveGameRoom(roomId).catch(() => {})
        }
      })
      watchUnsubRef.current = watchGameRoom(roomId, (data) => {
        if (data && (data.status === 'playing' || (data.players || []).length === 2)) {
          successfulMatchRef.current = true
          if (watchUnsubRef.current) { watchUnsubRef.current(); watchUnsubRef.current = null }
          if (inviteUnsubRef.current) { inviteUnsubRef.current(); inviteUnsubRef.current = null }
          deleteGameInvite(newInviteId).catch(() => {}); onReady(roomId)
        }
      })
    } catch (e) { console.error('inviteFriend error:', e); setErrorMsg('לא הצלחנו לשלוח הזמנה. ' + (e?.code || e?.message || '')); setPhase('error') }
  }

  const cancelInvite = () => {
    if (inviteId) deleteGameInvite(inviteId).catch(() => {})
    if (createdRoomId) leaveGameRoom(createdRoomId).catch(() => {})
    if (watchUnsubRef.current) { watchUnsubRef.current(); watchUnsubRef.current = null }
    if (inviteUnsubRef.current) { inviteUnsubRef.current(); inviteUnsubRef.current = null }
    setInviteId(null); setCreatedRoomId(null); setInvitedFriend(null); setPhase('friend-list')
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  if (phase === 'searching' || phase === 'waiting') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, #2A1C10 0%, #3A2818 100%)', color: 'white', display: 'flex', flexDirection: 'column', padding: '32px 24px 28px', direction: 'rtl', zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={onBack} style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.12)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: 'none', cursor: 'pointer' }}>←</button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
          <div style={{ fontSize: 72 }}>🎲</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Suez One', serif" }}>{phase === 'searching' ? 'מחפש לך יריב...' : 'מחכים ליריב...'}</div>
            <div style={{ fontSize: 16, opacity: 0.85, marginTop: 8 }}>⏱ {formatTime(elapsed)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.10)', borderRadius: 16, padding: '14px 18px', fontSize: 15, fontWeight: 500, textAlign: 'center', lineHeight: 1.5, maxWidth: 320 }}>💡 כשעוד מישהו ילחץ על "שש-בש"<br />תתחבר אליו אוטומטית</div>
        </div>
        <button onClick={onBack} className="big-btn big-btn--danger" style={{ width: '100%' }}>✕ ביטול</button>
      </div>
    )
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <div className="screen-header__title">{mode === 'online-random' ? 'שחקן רנדומלי' : 'שחק עם חבר'}</div>
      </div>
      <div style={{ padding: '20px 20px 32px' }}>
        {phase === 'friend-list' && <FriendListScreen friends={friends} onInvite={inviteFriend} onGoFriends={onBack} />}
        {phase === 'waiting-for-friend' && invitedFriend && <WaitingForFriendScreen friendName={invitedFriend.otherName} onCancel={cancelInvite} />}
        {phase === 'friend-declined' && <CenteredCard emoji="😕" title="ההזמנה נדחתה" description={errorMsg || 'החבר לא הצטרף'} actionLabel="חזרה לרשימת החברים" onAction={() => setPhase('friend-list')} />}
        {phase === 'error' && <CenteredCard emoji="😕" title="משהו השתבש" description={errorMsg || 'נסו שוב'} actionLabel="חזרה" onAction={onBack} />}
      </div>
    </div>
  )
}

function CenteredCard({ emoji, title, description, actionLabel, onAction }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '32px 24px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ fontSize: 56, marginBottom: 14 }}>{emoji}</div>
      <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.4, marginBottom: 18 }}>{description}</div>
      {actionLabel && <button onClick={onAction} className="big-btn big-btn--primary" style={{ width: '100%' }}>{actionLabel}</button>}
    </div>
  )
}

function FriendListScreen({ friends, onInvite, onGoFriends }) {
  if (!friends || friends.length === 0) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '36px 24px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ fontSize: 56, marginBottom: 14 }}>👥</div>
        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>אין לך עדיין חברים ברשימה</div>
        <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5, marginBottom: 20 }}>כשתדברו עם מישהו בקפה או בפרלמנט, תוכלו להוסיף אותו כחבר — ואז להזמין אותו למשחק.</div>
        <button onClick={onGoFriends} className="big-btn big-btn--ghost" style={{ width: '100%' }}>חזרה</button>
      </div>
    )
  }
  return (
    <>
      <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 6px', color: 'var(--ink)' }}>בחרו חבר להזמין</h2>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 14 }}>נשלח לו הזמנה — וכשהחבר יאשר, המשחק יתחיל</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{friends.map(f => <FriendInviteRow key={f.docId} friend={f} onInvite={() => onInvite(f)} />)}</div>
    </>
  )
}

function FriendInviteRow({ friend, onInvite }) {
  const [online, setOnline] = useState(false)
  useEffect(() => {
    if (!friend.otherUid) return
    const unsub = watchUser(friend.otherUid, u => {
      const seen = u?.lastSeenAt
      const seenMs = seen && typeof seen.toMillis === 'function' ? seen.toMillis() : 0
      const fresh = seenMs && (Date.now() - seenMs) < 2 * 60 * 1000
      setOnline(Boolean(fresh) && ['available', 'busy'].includes(u?.status))
    })
    return () => unsub && unsub()
  }, [friend.otherUid])
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <Avatar name={friend.otherName} size={50} online={online} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="h-display" style={{ fontSize: 17, color: 'var(--ink)' }}>{friend.otherName}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: online ? 'var(--success)' : 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          {online && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ADE80' }} />}{online ? 'מחובר עכשיו' : 'לא מחובר'}
        </div>
      </div>
      <button onClick={onInvite} style={{ background: online ? 'var(--burgundy)' : 'var(--surface)', color: online ? 'white' : 'var(--ink)', border: online ? 'none' : '1px solid var(--line-strong)', borderRadius: 12, padding: '11px 16px', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>🎮 הזמן</button>
    </div>
  )
}

function WaitingForFriendScreen({ friendName, onCancel }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '32px 24px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ fontSize: 56, marginBottom: 14 }}>📨</div>
      <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>שלחנו הזמנה ל{friendName}</div>
      <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.4, marginBottom: 22 }}>מחכים שיאשר ויצטרף למשחק...</div>
      <button onClick={onCancel} className="big-btn big-btn--ghost" style={{ width: '100%' }}>ביטול ההזמנה</button>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מסך מקומי (מול המחשב / שני שחקנים)
// ════════════════════════════════════════════════════════
function LocalGameScreen({ mode, difficulty, onBack, onExit }) {
  const { profile } = useUserStore()
  const [state, setState] = useState(initialState)
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const winner = state.winner
  const isAITurn = mode === 'ai' && state.turn === 'P2' && !winner
  const humanControllable = !winner && state.phase === 'move' && !isAITurn && (mode !== 'ai' || state.turn === 'P1')

  useEffect(() => {
    if (!isAITurn) return
    const t = setTimeout(() => {
      setState(s => {
        if (s.turn !== 'P2' || s.winner) return s
        if (s.phase === 'roll') { playSound('drop'); return performRoll(s, 'P2') }
        if (!hasAnyMove(s, 'P2')) return passTurn(s)
        const m = bestAIMove(s, 'P2', difficulty)
        if (!m) return passTurn(s)
        playSound('drop')
        return afterMove(performSingleMove(s, 'P2', m.from, m.die, m.to), 'P2')
      })
    }, 650)
    return () => clearTimeout(t)
  }, [isAITurn, state, difficulty])

  useEffect(() => {
    if (isAITurn || winner || state.phase !== 'move') return
    if (state.dice.length > 0 && hasAnyMove(state, state.turn)) return
    const t = setTimeout(() => { setState(s => (s.phase === 'move' && !s.winner && (s.dice.length === 0 || !hasAnyMove(s, s.turn))) ? passTurn(s) : s) }, 1000)
    return () => clearTimeout(t)
  }, [state, isAITurn, winner])

  // ניקוי היסטוריית ה-Undo בתחילת תור / גלגול
  useEffect(() => { if (state.phase === 'roll') setHistory([]) }, [state.turn, state.phase])

  useEffect(() => { if (winner) setTimeout(() => playSound(mode === 'ai' ? (winner === 'P1' ? 'win' : 'lose') : 'win'), 300) }, [winner, mode])

  const side = state.turn
  const effectiveSelected = (humanControllable && state.bar[side] > 0) ? 'bar' : selected
  const targets = (humanControllable && effectiveSelected != null) ? movesFrom(state, side, effectiveSelected) : []

  const applyHuman = (from, die, to) => {
    playSound('drop')
    setHistory(h => [...h, state])
    setState(s => performSingleMove(s, s.turn, from, die, to))
    setSelected(null)
  }
  const undo = () => {
    if (!history.length) return
    const prev = history[history.length - 1]
    setState(prev); setHistory(h => h.slice(0, -1)); setSelected(null)
  }
  const handlePointClick = (idx) => {
    if (!humanControllable) return
    const sgn = sgnOf(side)
    if (state.bar[side] > 0) { const m = movesFrom(state, side, 'bar').find(x => x.to === idx); if (m) applyHuman('bar', m.die, idx); return }
    if (selected === idx) { setSelected(null); return }
    if (selected != null) { const ms = movesFrom(state, side, selected).filter(x => x.to === idx); if (ms.length) { ms.sort((a, b) => a.die - b.die); applyHuman(selected, ms[0].die, idx); return } }
    if (state.points[idx] * sgn > 0) setSelected(idx); else setSelected(null)
  }
  const handleOffClick = () => {
    if (!humanControllable || effectiveSelected == null) return
    const ms = movesFrom(state, side, effectiveSelected).filter(x => x.to === 'off')
    if (ms.length) { ms.sort((a, b) => a.die - b.die); applyHuman(effectiveSelected, ms[0].die, 'off') }
  }
  const doRoll = () => { if (!winner && state.phase === 'roll' && !isAITurn) { playSound('drop'); setState(s => performRoll(s, s.turn)) } }
  const doPass = () => setState(s => (s.phase === 'move' && !s.winner) ? passTurn(s) : s)
  const reset = () => { setState(initialState()); setSelected(null); setHistory([]) }

  const myTurnForRoll = !isAITurn && !winner && (mode !== 'ai' || state.turn === 'P1')
  const stuck = humanControllable && !hasAnyMove(state, side)

  const meName = mode === 'ai' ? 'אתה' : 'שחקן 1'
  const oppName = mode === 'ai' ? 'מחשב' : 'שחקן 2'
  const centerLabel = winner ? (winner === 'P1' ? 'ניצחת!' : (mode === 'ai' ? 'המחשב ניצח' : 'שחקן 2 ניצח'))
    : isAITurn ? 'המחשב חושב…'
    : (mode === 'ai' ? 'תורך!' : `תור שחקן ${side === 'P1' ? '1' : '2'}`)

  return (
    <SheshLayout
      isOnline={false} me={{ name: meName, photoURL: mode === 'ai' ? profile?.photoURL : null }} opponent={{ name: oppName }}
      myColor="P1" topActive={side === 'P2' && !winner} topOff={state.off.P2} bottomActive={side === 'P1' && !winner} bottomOff={state.off.P1}
      state={state} selected={effectiveSelected} targets={targets} centerLabel={centerLabel}
      onPointClick={handlePointClick} onOffClick={handleOffClick} onBarClick={() => {}}
      canRoll={myTurnForRoll && state.phase === 'roll'} onRoll={doRoll} showPass={stuck} onPass={doPass}
      canUndo={humanControllable && history.length > 0} onUndo={undo}
      onReset={reset} onLeave={onBack}
    >
      {winner && <LocalEndModal mode={mode} winner={winner} onPlayAgain={reset} onExit={onExit} />}
    </SheshLayout>
  )
}

// ════════════════════════════════════════════════════════
// מסך אונליין
// ════════════════════════════════════════════════════════
function OnlineGameScreen({ roomId, onBack, onExit, onFindOther }) {
  const { authUser, profile } = useUserStore()
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [undoTick, setUndoTick] = useState(0)
  const actionRef = useRef(null)
  const finishedSoundRef = useRef(false)
  const histRef = useRef([])

  useEffect(() => {
    const unsub = watchGameRoom(roomId, (data) => {
      if (!data) { setError('היריב עזב את המשחק'); return }
      setRoom(data)
      const la = data.gameState?.lastAction
      if (la && actionRef.current !== la) { actionRef.current = la; playSound('drop') }
    })
    return () => unsub && unsub()
  }, [roomId])

  useEffect(() => { return () => { if (room && room.status === 'ended') leaveGameRoom(roomId).catch(() => {}) } }, [roomId, room?.status])

  const myUid = authUser?.uid
  const me = (room?.players || []).find(p => p.uid === myUid)
  const opponent = (room?.players || []).find(p => p.uid !== myUid)
  const myColor = me?.color || 'P1'
  const oppColor = myColor === 'P1' ? 'P2' : 'P1'
  const gs = room?.gameState || {}
  const hasState = Array.isArray(gs.points) && gs.points.length === 24
  const state = hasState ? {
    points: gs.points, bar: gs.bar || { P1: 0, P2: 0 }, off: gs.off || { P1: 0, P2: 0 },
    turn: gs.turn || 'P1', dice: gs.dice || [], rolled: gs.rolled || [], phase: gs.phase || 'roll', winner: gs.winner || null, lastAction: gs.lastAction || 0,
  } : initialState()
  const winner = state.winner
  const isMyTurn = state.turn === myColor && !winner

  useEffect(() => { if (room && myColor === 'P1' && !hasState) updateGameState(roomId, initialState()) }, [room, myColor, hasState, roomId])

  // ניקוי היסטוריית Undo כשזה לא תורי / בשלב גלגול
  useEffect(() => { if (!isMyTurn || state.phase === 'roll') { if (histRef.current.length) { histRef.current = []; setUndoTick(t => t + 1) } } }, [isMyTurn, state.phase])

  const rematch = room?.rematch || {}
  const iRequested = !!rematch[myColor]
  const oppRequested = !!rematch[oppColor]

  useEffect(() => { if (winner && !finishedSoundRef.current) { finishedSoundRef.current = true; setTimeout(() => playSound(winner === myColor ? 'win' : 'lose'), 300) } }, [winner, myColor])
  useEffect(() => { if (!winner) finishedSoundRef.current = false }, [winner])
  useEffect(() => {
    if (iRequested && oppRequested && myColor === 'P1') {
      finishedSoundRef.current = false; actionRef.current = null; histRef.current = []
      updateGameRoom(roomId, { gameState: initialState(), rematch: { P1: false, P2: false } })
    }
  }, [iRequested, oppRequested, myColor, roomId])

  useEffect(() => {
    if (!isMyTurn || winner || state.phase !== 'move' || !hasState) return
    if (state.dice.length > 0 && hasAnyMove(state, myColor)) return
    const t = setTimeout(() => { updateGameState(roomId, passTurn(state)) }, 1100)
    return () => clearTimeout(t)
  }, [room, isMyTurn, winner, myColor]) // eslint-disable-line

  if (error) return <OpponentLeftScreen onFindOther={onFindOther} onExit={onExit} />
  if (!room) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl' }}>
        <div className="screen-header"><button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button><div className="screen-header__title">שש-בש</div></div>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-2)' }}>טוען...</div>
      </div>
    )
  }

  const controllable = isMyTurn && state.phase === 'move'
  const effectiveSelected = (controllable && state.bar[myColor] > 0) ? 'bar' : selected
  const targets = (controllable && effectiveSelected != null) ? movesFrom(state, myColor, effectiveSelected) : []

  const applyMove = async (from, die, to) => {
    histRef.current.push(state); setUndoTick(t => t + 1); setSelected(null)
    await updateGameState(roomId, performSingleMove(state, myColor, from, die, to))
  }
  const undo = async () => {
    if (!histRef.current.length) return
    const prev = histRef.current.pop(); setUndoTick(t => t + 1); setSelected(null)
    await updateGameState(roomId, { ...prev, lastAction: Date.now() })
  }
  const handlePointClick = (idx) => {
    if (!controllable) return
    const sgn = sgnOf(myColor)
    if (state.bar[myColor] > 0) { const m = movesFrom(state, myColor, 'bar').find(x => x.to === idx); if (m) applyMove('bar', m.die, idx); return }
    if (selected === idx) { setSelected(null); return }
    if (selected != null) { const ms = movesFrom(state, myColor, selected).filter(x => x.to === idx); if (ms.length) { ms.sort((a, b) => a.die - b.die); applyMove(selected, ms[0].die, idx); return } }
    if (state.points[idx] * sgn > 0) setSelected(idx); else setSelected(null)
  }
  const handleOffClick = () => {
    if (!controllable || effectiveSelected == null) return
    const ms = movesFrom(state, myColor, effectiveSelected).filter(x => x.to === 'off')
    if (ms.length) { ms.sort((a, b) => a.die - b.die); applyMove(effectiveSelected, ms[0].die, 'off') }
  }
  const doRoll = () => { if (isMyTurn && state.phase === 'roll') updateGameState(roomId, performRoll(state, myColor)) }
  const doPass = () => { if (isMyTurn && state.phase === 'move') updateGameState(roomId, passTurn(state)) }
  const requestRematch = () => updateGameRoom(roomId, { [`rematch.${myColor}`]: true })
  const cancelRematch = () => updateGameRoom(roomId, { rematch: { P1: false, P2: false } })
  const handleFindOther = async () => { await leaveGameRoom(roomId).catch(() => {}); onFindOther && onFindOther() }
  const handleEnd = async () => { await leaveGameRoom(roomId).catch(() => {}); onExit && onExit() }
  const handleLeave = async () => { await leaveGameRoom(roomId).catch(() => {}); onBack && onBack() }

  const stuck = controllable && !hasAnyMove(state, myColor)
  const centerLabel = winner ? (winner === myColor ? 'ניצחת!' : 'הפסדת') : (isMyTurn ? 'תורך!' : 'תור היריב')

  return (
    <SheshLayout
      isOnline={true} roomId={roomId} me={me ? { ...me, photoURL: profile?.photoURL } : { name: 'אתה' }} opponent={opponent}
      myColor={myColor} topActive={state.turn === oppColor && !winner} topOff={state.off[oppColor]} bottomActive={isMyTurn} bottomOff={state.off[myColor]}
      state={state} selected={effectiveSelected} targets={targets} centerLabel={centerLabel}
      onPointClick={handlePointClick} onOffClick={handleOffClick} onBarClick={() => {}}
      canRoll={isMyTurn && state.phase === 'roll'} onRoll={doRoll} showPass={stuck} onPass={doPass}
      canUndo={controllable && histRef.current.length > 0} onUndo={undo}
      onReset={requestRematch} onLeave={handleLeave}
      chat={room.chat || []} addFriendNode={opponent?.uid ? <AddFriendButton me={me} opponent={opponent} compact /> : null}
    >
      {winner && <OnlineEndModal result={winner === myColor ? 'win' : 'lose'} opponentName={opponent?.name || 'היריב'} iRequested={iRequested} oppRequested={oppRequested} onRematch={requestRematch} onFindOther={handleFindOther} onEnd={handleEnd} />}
      {!winner && (iRequested || oppRequested) && <RematchPrompt opponentName={opponent?.name || 'היריב'} iRequested={iRequested} onConfirm={requestRematch} onCancel={cancelRematch} />}
    </SheshLayout>
  )
}

// ════════════════════════════════════════════════════════
// אייקונים (SVG בצבע זהב)
// ════════════════════════════════════════════════════════
const IcDice = (p) => <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.6" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>
const IcUndo = (p) => <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none"><path d="M9 13L4.5 9 9 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4.5 9H15a5 5 0 0 1 0 10H9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcChat = (p) => <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none"><path d="M20.5 11.5a7.5 7.5 0 0 1-10.8 6.7L4 19.5l1.3-4.4A7.5 7.5 0 1 1 20.5 11.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
const IcRefresh = (p) => <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20 4v4h-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 20v-4h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcMenu = (p) => <svg width={p.s||24} height={p.s||24} viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const IcCheck = (p) => <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none"><path d="M5 12.5l5 5 9-11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>

// ════════════════════════════════════════════════════════
// Layout משותף — חזות יוקרתית
// ════════════════════════════════════════════════════════
function SheshLayout({
  isOnline, roomId, me, opponent, myColor = 'P1',
  topActive, topOff, bottomActive, bottomOff,
  state, selected, targets, onPointClick, onOffClick, onBarClick, centerLabel,
  canRoll, onRoll, showPass, onPass, canUndo, onUndo, onReset, onLeave,
  chat = [], addFriendNode = null, children,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [muted, setMutedState] = useState(() => isMuted())
  const [seen, setSeen] = useState(chat.length)
  const oppColor = myColor === 'P1' ? 'P2' : 'P1'
  const unread = chatOpen ? 0 : Math.max(0, chat.length - seen)
  useEffect(() => { if (chatOpen) setSeen(chat.length) }, [chatOpen, chat.length])
  const toggleMute = () => { const n = !muted; setMutedState(n); setMuted(n); setMenuOpen(false) }

  return (
    <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg, #2c1d10 0%, #1c1108 100%)', minHeight: '100%' }}>
      {/* כותרת עץ */}
      <div style={{ background: WOOD_FRAME, borderBottom: `2px solid ${GOLD_DEEP}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,.4)' }}>
        <button onClick={onLeave} aria-label="חזרה" style={{ position: 'absolute', insetInlineStart: 14, background: 'none', border: 'none', cursor: 'pointer', color: GOLD, padding: 4 }}><IconBackRTL size={24} color={GOLD} /></button>
        <div style={{ fontFamily: "'Suez One', serif", fontSize: 22, fontWeight: 700, color: GOLD, textShadow: '0 1px 2px rgba(0,0,0,.6)', letterSpacing: '.5px' }}>שש-בש {isOnline ? 'אונליין' : ''}</div>
        <button onClick={() => setMenuOpen(o => !o)} aria-label="תפריט" style={{ position: 'absolute', insetInlineEnd: 14, background: 'none', border: 'none', cursor: 'pointer', color: GOLD, padding: 4 }}><IcMenu s={26} /></button>
        {menuOpen && (
          <div style={{ position: 'absolute', top: '100%', insetInlineEnd: 10, marginTop: 6, background: '#2a1a0c', border: `1px solid ${GOLD_DEEP}`, borderRadius: 12, padding: 6, zIndex: 50, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
            <MenuItem label={isOnline ? '🔄 משחק חדש' : '🔄 משחק חדש'} onClick={() => { setMenuOpen(false); onReset() }} />
            <MenuItem label={muted ? '🔇 הפעל סאונד' : '🔊 השתק סאונד'} onClick={toggleMute} />
            <MenuItem label={isOnline ? '🚪 עזוב משחק' : '↩ החלף מצב'} onClick={() => { setMenuOpen(false); onLeave() }} />
          </div>
        )}
      </div>
      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />}

      <div style={{ padding: '12px 12px 24px' }}>
        {/* כרטיס יריב */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {addFriendNode}
          <PlayerCard name={opponent?.name || 'יריב'} photoURL={opponent?.photoURL} active={topActive} color={oppColor} align="right" />
        </div>

        {/* הלוח */}
        <SheshBoard
          state={state} selected={selected} targets={targets} centerLabel={centerLabel}
          onPointClick={onPointClick} onOffClick={onOffClick} onBarClick={onBarClick}
          canRoll={canRoll} onRoll={onRoll} flip={myColor === 'P2'}
        />

        {isOnline && me?.uid && <ChatToast inline msgs={chat} meUid={me.uid} suppressed={chatOpen} onOpen={() => setChatOpen(true)} />}

        {/* שורה תחתונה: שחקן + כפתורי זהב */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginTop: 14 }}>
          <PlayerCard name={me?.name || 'אתה'} photoURL={me?.photoURL} active={bottomActive} color={myColor} align="left" grow />
          <GoldButton
            primary={canRoll || showPass} disabled={!canRoll && !showPass}
            icon={showPass ? <IcCheck /> : <IcDice />} label={showPass ? 'סיים תור' : 'גלגל'}
            onClick={showPass ? onPass : onRoll}
          />
          <GoldButton disabled={!canUndo} icon={<IcUndo />} label="בטל" onClick={onUndo} />
          {isOnline
            ? <GoldButton icon={<IcChat />} label="צ'אט" onClick={() => setChatOpen(true)} badge={unread} />
            : <GoldButton icon={<IcRefresh />} label="חדש" onClick={onReset} />}
        </div>
      </div>

      {chatOpen && isOnline && me?.uid && <ChatPanel roomId={roomId} me={me} msgs={chat} onClose={() => setChatOpen(false)} />}
      {children}
    </div>
  )
}

function MenuItem({ label, onClick }) {
  return <button onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'right', background: 'none', border: 'none', color: CREAM, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', padding: '11px 12px', borderRadius: 8, cursor: 'pointer' }}>{label}</button>
}

function GoldButton({ icon, label, onClick, primary, disabled, badge }) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      flex: '0 0 auto', minWidth: 64, position: 'relative',
      background: primary ? 'linear-gradient(180deg,#8a5e2e,#5e3a18)' : 'linear-gradient(180deg,#5e3f22,#412813)',
      border: `1.5px solid ${primary ? '#F2CE6A' : GOLD_DEEP}`, borderRadius: 14, padding: '9px 12px',
      color: primary ? '#FCE9B6' : '#E6CD90', cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, opacity: disabled ? 0.4 : 1,
      boxShadow: primary ? `0 0 14px rgba(242,206,106,.45), inset 0 1px 0 rgba(255,255,255,.25)` : 'inset 0 1px 0 rgba(255,255,255,.12), 0 2px 4px rgba(0,0,0,.4)',
    }}>
      {icon}
      <span style={{ fontSize: 12, fontWeight: 800 }}>{label}</span>
      {badge > 0 && <span style={{ position: 'absolute', top: -7, insetInlineEnd: -6, background: '#E8484F', color: 'white', fontSize: 11, fontWeight: 800, minWidth: 19, height: 19, borderRadius: 10, padding: '0 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #2c1d10' }}>{badge}</span>}
    </button>
  )
}

function PlayerCard({ name, photoURL, active, color, align, grow }) {
  const dark = color === 'P2'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9, flex: grow ? '1 1 auto' : '0 0 auto', minWidth: 0,
      background: active ? 'linear-gradient(180deg,#6e4a28,#4a2e16)' : 'linear-gradient(180deg,#4a3018,#352010)',
      border: active ? `2px solid ${GOLD}` : '1px solid rgba(201,162,74,.4)', borderRadius: 14, padding: '6px 12px 6px 8px',
      boxShadow: active ? '0 0 12px rgba(232,200,121,.35)' : 'inset 0 1px 0 rgba(255,255,255,.08)',
      flexDirection: align === 'left' ? 'row' : 'row-reverse',
    }}>
      <Avatar name={name} size={38} photoURL={photoURL} />
      <div style={{ minWidth: 0, textAlign: align === 'left' ? 'right' : 'left' }}>
        <div style={{ fontFamily: "'Suez One', serif", fontSize: 15, fontWeight: 700, color: CREAM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: align === 'left' ? 'flex-start' : 'flex-end' }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, background: dark ? 'radial-gradient(circle at 35% 30%,#55504f,#16161a)' : 'radial-gradient(circle at 35% 30%,#f0dca6,#bf9a4f)', border: '1px solid rgba(0,0,0,.3)' }} />
          {active && <span style={{ fontSize: 11, fontWeight: 800, color: GOLD }}>● תור</span>}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// הלוח — שני פאנלים, ציר פליז, מספרים, מגשי הוצאה
// ════════════════════════════════════════════════════════
function selectedIsP2(state, selected) {
  if (selected === 'bar') return state.turn === 'P2'
  if (typeof selected === 'number') return state.points[selected] < 0
  return state.turn === 'P2'
}

const LP_TOP = [12, 13, 14, 15, 16, 17], RP_TOP = [18, 19, 20, 21, 22, 23]
const LP_BOT = [11, 10, 9, 8, 7, 6], RP_BOT = [5, 4, 3, 2, 1, 0]

function SheshBoard({ state, selected, targets, onPointClick, onOffClick, onBarClick, centerLabel, canRoll, onRoll, flip }) {
  const targetSet = new Set(targets.filter(t => typeof t.to === 'number').map(t => t.to))
  const canBearOff = targets.some(t => t.to === 'off')
  const offP2 = selectedIsP2(state, selected)
  const showDice = state.phase === 'move' && state.dice.length > 0
  const cr = flip ? 'rotate(180deg)' : 'none'  // סיבוב הפוך לטקסט כדי שיישאר קריא

  return (
    <div style={{ background: WOOD_FRAME, borderRadius: 18, padding: 8, border: `2px solid ${GOLD_DEEP}`, boxShadow: '0 14px 32px -10px rgba(0,0,0,.7), inset 0 2px 6px rgba(255,255,255,.08)', maxWidth: 420, margin: '0 auto' }}>
      <div style={{ transform: flip ? 'rotate(180deg)' : 'none' }}>
      {/* פאנלים + ציר */}
      <div style={{ position: 'relative', display: 'flex', gap: 0, aspectRatio: '1 / 1.1' }}>
        <Panel side="left" topIdx={LP_TOP} botIdx={LP_BOT} state={state} selected={selected} targetSet={targetSet} onPointClick={onPointClick} flip={flip} />
        <CenterBar state={state} selected={selected} onBarClick={onBarClick} flip={flip} />
        <Panel side="right" topIdx={RP_TOP} botIdx={RP_BOT} state={state} selected={selected} targetSet={targetSet} onPointClick={onPointClick} flip={flip} />

        {/* שכבת על — טקסט תור + קוביות */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6%' }}>
          {centerLabel
            ? <div style={{ fontFamily: "'Suez One', serif", fontSize: 26, fontWeight: 700, color: GOLD, textShadow: '0 2px 4px rgba(0,0,0,.7)', transform: cr }}>{centerLabel}</div>
            : <div />}
          {showDice ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 120, justifyContent: 'center', transform: cr }}>{state.dice.map((d, i) => <Die key={i} value={d} glow />)}</div>
          ) : canRoll ? (
            <div onClick={onRoll} style={{ pointerEvents: 'auto', cursor: 'pointer', fontFamily: "'Suez One', serif", fontSize: 26, fontWeight: 700, color: GOLD, textShadow: '0 2px 4px rgba(0,0,0,.7)', transform: cr }}>הקש לזריקה</div>
          ) : <div />}
        </div>
      </div>

      {/* מגשי הוצאה (בית) */}
      <div style={{ display: 'flex', gap: 0, marginTop: 8 }}>
        <OffTray player="P1" count={state.off.P1} highlight={canBearOff && !offP2} onClick={onOffClick} flip={flip} />
        <div style={{ width: 22, flexShrink: 0 }} />
        <OffTray player="P2" count={state.off.P2} highlight={canBearOff && offP2} onClick={onOffClick} flip={flip} />
      </div>
      </div>
    </div>
  )
}

function Panel({ side, topIdx, botIdx, state, selected, targetSet, onPointClick, flip }) {
  const numTop = topIdx.map(i => i + 1)
  const numBot = botIdx.map(i => i + 1)
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: WOOD_FRAME, borderRadius: 8, padding: 5, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.45), inset 0 2px 3px rgba(255,255,255,.08)' }}>
      <NumStrip nums={numTop} flip={flip} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: WOOD_TABLE, borderRadius: 5, overflow: 'hidden', boxShadow: 'inset 0 0 16px rgba(0,0,0,.55)' }}>
        <div style={{ flex: 5, display: 'flex' }}>{topIdx.map((idx, pos) => <PointCol key={idx} idx={idx} pos={pos} top count={state.points[idx]} isTarget={targetSet.has(idx)} isSelected={selected === idx} onClick={() => onPointClick(idx)} />)}</div>
        <div style={{ flex: 2 }} />
        <div style={{ flex: 5, display: 'flex' }}>{botIdx.map((idx, pos) => <PointCol key={idx} idx={idx} pos={pos} top={false} count={state.points[idx]} isTarget={targetSet.has(idx)} isSelected={selected === idx} onClick={() => onPointClick(idx)} />)}</div>
      </div>
      <NumStrip nums={numBot} flip={flip} />
    </div>
  )
}

function NumStrip({ nums, flip }) {
  return (
    <div style={{ display: 'flex', padding: '2px 0' }}>
      {nums.map((n, i) => <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'rgba(243,226,190,.55)', transform: flip ? 'rotate(180deg)' : 'none' }}>{n}</div>)}
    </div>
  )
}

function PointCol({ idx, pos, top, count, isTarget, isSelected, onClick }) {
  const triColor = pos % 2 === 0 ? TRI_DARK : TRI_LIGHT
  const player = count > 0 ? 'P1' : count < 0 ? 'P2' : null
  const n = Math.abs(count)
  // חיילים אחד על השני — הפרדה ברורה עד 7, ונדחסים רק מעל 7
  const step = n <= 5 ? 8 : n <= 7 ? 20 : Math.min(54, 20 + (n - 7) * 8)
  const stones = []
  for (let i = 0; i < n; i++) {
    stones.push(
      <div key={i} style={{ width: '78%', aspectRatio: '1', flexShrink: 0, marginTop: i === 0 ? 0 : `-${step}%`, position: 'relative', zIndex: i }}>
        <Stone player={player} />
      </div>
    )
  }
  return (
    <div onClick={onClick} style={{ flex: 1, height: '100%', position: 'relative', cursor: 'pointer' }}>
      <div style={{ position: 'absolute', insetInlineStart: '7%', insetInlineEnd: '7%', [top ? 'top' : 'bottom']: 0, height: '94%', background: triColor, clipPath: top ? 'polygon(0 0,100% 0,50% 100%)' : 'polygon(50% 0,0 100%,100% 100%)', opacity: 0.97, boxShadow: isSelected ? `0 0 0 2px ${GOLD} inset` : 'none' }} />
      {isTarget && <div style={{ position: 'absolute', [top ? 'top' : 'bottom']: '28%', insetInlineStart: '50%', transform: 'translateX(50%)', width: '38%', aspectRatio: '1', borderRadius: '50%', background: 'rgba(120,200,120,.55)', boxShadow: '0 0 10px rgba(120,220,120,.9)', zIndex: 30 }} />}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: top ? 'flex-start' : 'flex-end', padding: '3px 0' }}>
        {top ? stones : stones.slice().reverse()}
      </div>
    </div>
  )
}

function CenterBar({ state, selected, onBarClick, flip }) {
  const selP2 = selected === 'bar' && state.turn === 'P2'
  const selP1 = selected === 'bar' && state.turn === 'P1'
  const renderBar = (player, sel) => {
    const n = state.bar[player]
    const stones = []
    for (let i = 0; i < Math.min(n, 4); i++) stones.push(
      <div key={i} style={{ width: '86%', aspectRatio: '1', flexShrink: 0, marginTop: i === 0 ? 0 : '-26%', position: 'relative' }}>
        <Stone player={player} />
        {i === Math.min(n, 4) - 1 && n > 4 && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: player === 'P2' ? '#F0E2C6' : '#3A2410', transform: flip ? 'rotate(180deg)' : 'none' }}>{n}</div>}
      </div>
    )
    return (
      <div onClick={() => n > 0 && onBarClick(player)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: player === 'P2' ? 'flex-start' : 'flex-end', padding: '6px 0', boxShadow: sel ? `0 0 0 2px ${GOLD} inset` : 'none', borderRadius: 4, cursor: n > 0 ? 'pointer' : 'default' }}>{stones}</div>
    )
  }
  return (
    <div style={{ width: 22, flexShrink: 0, margin: '0 1px', background: WOOD_DARK, borderRadius: 4, display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: 'inset 0 0 8px rgba(0,0,0,.6)' }}>
      {renderBar('P2', selP2)}
      {/* צירי פליז */}
      <div style={{ position: 'absolute', insetInlineStart: '50%', transform: 'translateX(50%)', top: '32%', width: 12, height: 22, borderRadius: 3, background: 'linear-gradient(180deg,#E7C879,#A07d2e)', boxShadow: '0 1px 2px rgba(0,0,0,.5)' }} />
      <div style={{ position: 'absolute', insetInlineStart: '50%', transform: 'translateX(50%)', bottom: '32%', width: 12, height: 22, borderRadius: 3, background: 'linear-gradient(180deg,#E7C879,#A07d2e)', boxShadow: '0 1px 2px rgba(0,0,0,.5)' }} />
      {renderBar('P1', selP1)}
    </div>
  )
}

function OffTray({ player, count, highlight, onClick, flip }) {
  const dark = player === 'P2'
  const discs = []
  for (let i = 0; i < Math.min(count, 7); i++) discs.push(
    <div key={i} style={{ width: 22, height: 11, borderRadius: 3, marginInlineStart: i === 0 ? 0 : -12, background: dark ? 'linear-gradient(180deg,#3d3d42,#16161a)' : 'linear-gradient(180deg,#ecd3a2,#bf9a4f)', border: '1px solid rgba(0,0,0,.35)', boxShadow: '0 1px 2px rgba(0,0,0,.4)', flexShrink: 0 }} />
  )
  return (
    <div onClick={onClick} style={{
      flex: 1, height: 40, background: highlight ? 'linear-gradient(180deg,rgba(120,200,120,.35),rgba(60,140,60,.25))' : WOOD_DARK,
      border: highlight ? '2px solid #6ECC6E' : '1px solid rgba(0,0,0,.5)', borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: dark ? 'flex-start' : 'flex-end',
      gap: 6, padding: '0 12px', cursor: highlight ? 'pointer' : 'default',
      boxShadow: highlight ? '0 0 12px rgba(120,220,120,.6)' : 'inset 0 2px 5px rgba(0,0,0,.5)',
      flexDirection: dark ? 'row' : 'row-reverse',
    }}>
      <span style={{ fontSize: 16, fontWeight: 900, color: CREAM, minWidth: 18, textAlign: 'center', display: 'inline-block', transform: flip ? 'rotate(180deg)' : 'none' }}>{count}</span>
      <div style={{ display: 'flex', flexDirection: dark ? 'row' : 'row-reverse' }}>{discs}</div>
    </div>
  )
}

function Stone({ player }) {
  if (!player) return null
  const dark = player === 'P2'
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', borderRadius: '50%',
      background: dark
        ? 'radial-gradient(circle at 38% 30%, rgba(255,255,255,.4), rgba(255,255,255,0) 34%), radial-gradient(circle at 50% 55%, #3f3f44, #232327 55%, #111113)'
        : 'radial-gradient(circle at 38% 30%, rgba(255,255,255,.8), rgba(255,255,255,0) 40%), radial-gradient(circle at 50% 52%, #f1dca6, #d9b878 40%, #bf9a4f 72%, #9c7a33)',
      boxShadow: dark
        ? 'inset 0 -3px 6px rgba(0,0,0,.75), inset 0 2px 4px rgba(255,255,255,.22), 0 3px 5px rgba(0,0,0,.5), 0 0 0 1.5px rgba(150,150,160,.45)'
        : 'inset 0 -3px 6px rgba(90,55,10,.6), inset 0 2px 4px rgba(255,255,255,.6), 0 3px 5px rgba(0,0,0,.5), 0 0 0 1.5px rgba(120,90,40,.5)',
    }}>
      <div style={{ position: 'absolute', inset: '22%', borderRadius: '50%', boxShadow: dark ? 'inset 0 0 0 1px rgba(0,0,0,.55), inset 0 0 0 2px rgba(255,255,255,.07)' : 'inset 0 0 0 1px rgba(90,60,20,.45), inset 0 0 0 2px rgba(255,255,255,.25)' }} />
    </div>
  )
}

function Die({ value, glow }) {
  const PIP = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
  const set = new Set(PIP[value] || [])
  return (
    <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(145deg,#FFFFFF,#ECE4D2)', boxShadow: (glow ? '0 0 16px 1px rgba(242,206,106,.7), ' : '') + '0 3px 5px rgba(0,0,0,.5), inset 0 1px 2px rgba(255,255,255,.9), inset 0 -2px 3px rgba(0,0,0,.12)', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,1fr)', padding: 5, gap: 1, flexShrink: 0 }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {set.has(i) && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%,#444,#1a1a1c)', boxShadow: 'inset 0 1px 1px rgba(0,0,0,.5)' }} />}
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מודלים
// ════════════════════════════════════════════════════════
function LocalEndModal({ mode, winner, onPlayAgain, onExit }) {
  let emoji, title, subtitle, color
  if (winner === 'P1') { emoji = '🎉'; title = mode === 'ai' ? 'ניצחת!' : 'שחקן 1 ניצח!'; subtitle = 'כל הכבוד'; color = '#4F6B4A' }
  else { emoji = mode === 'ai' ? '🤖' : '🎉'; title = mode === 'ai' ? 'המחשב ניצח' : 'שחקן 2 ניצח!'; subtitle = mode === 'ai' ? 'נסה שוב, אתה תצליח!' : 'כל הכבוד'; color = '#B89048' }
  return (
    <ModalShell>
      <div style={{ fontSize: 64, marginBottom: 12 }}>{emoji}</div>
      <div className="h-display" style={{ fontSize: 28, color, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 16, color: 'var(--ink-2)', marginBottom: 24, fontWeight: 600, lineHeight: 1.4 }}>{subtitle}</div>
      <button onClick={onPlayAgain} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 10 }}>🔄 שחק שוב</button>
      <button onClick={onExit} className="big-btn big-btn--ghost" style={{ width: '100%' }}>חזרה לזירה</button>
    </ModalShell>
  )
}

function OnlineEndModal({ result, opponentName, iRequested, oppRequested, onRematch, onFindOther, onEnd }) {
  let emoji, title, subtitle, color
  if (result === 'win') { emoji = '🎉'; title = 'ניצחת!'; subtitle = 'כל הכבוד'; color = '#4F6B4A' }
  else { emoji = '😕'; title = 'הפסדת'; subtitle = 'משחק יפה — אפשר לנסות שוב'; color = '#7E2C2E' }
  return (
    <ModalShell>
      <div style={{ fontSize: 64, marginBottom: 12 }}>{emoji}</div>
      <div className="h-display" style={{ fontSize: 28, color, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 16, color: 'var(--ink-2)', marginBottom: 22, fontWeight: 600, lineHeight: 1.4 }}>{subtitle}</div>
      {iRequested ? (
        <div style={{ background: 'var(--bg-app)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--ink-2)' }}>
          <span style={{ animation: 'ssPulse 1.4s infinite' }}>⏳</span>מחכים ש{opponentName} יאשר משחק חוזר...
        </div>
      ) : (
        <button onClick={onRematch} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 10 }}>🔄 שחק שוב{oppRequested && <span style={{ display: 'block', fontSize: 12, fontWeight: 700, marginTop: 2, opacity: 0.9 }}>{opponentName} כבר מחכה!</span>}</button>
      )}
      <button onClick={onFindOther} className="big-btn big-btn--ghost" style={{ width: '100%', marginBottom: 10 }}>🔎 חפש שחקן אחר</button>
      <button onClick={onEnd} className="big-btn big-btn--ghost" style={{ width: '100%' }}>סיים לשחק</button>
      <style>{`@keyframes ssPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </ModalShell>
  )
}

function RematchPrompt({ opponentName, iRequested, onConfirm, onCancel }) {
  return (
    <ModalShell maxWidth={340}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>🔄</div>
      {iRequested ? (
        <>
          <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>ביקשת משחק חדש</div>
          <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 20, lineHeight: 1.4 }}>מחכים ש{opponentName} יאשר...</div>
          <button onClick={onCancel} className="big-btn big-btn--ghost" style={{ width: '100%' }}>ביטול</button>
        </>
      ) : (
        <>
          <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>{opponentName} מבקש/ת משחק חדש</div>
          <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 20, lineHeight: 1.4 }}>להתחיל את המשחק מחדש?</div>
          <button onClick={onConfirm} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 10 }}>✅ כן, משחק חדש</button>
          <button onClick={onCancel} className="big-btn big-btn--ghost" style={{ width: '100%' }}>לא, נמשיך לשחק</button>
        </>
      )}
    </ModalShell>
  )
}

function ModalShell({ children, maxWidth = 360 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,8,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24, direction: 'rtl' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: '30px 26px 22px', maxWidth, width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>{children}</div>
    </div>
  )
}

function OpponentLeftScreen({ onFindOther, onExit }) {
  return (
    <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg, #2c1d10 0%, #1c1108 100%)' }}>
      <div style={{ background: WOOD_FRAME, borderBottom: `2px solid ${GOLD_DEEP}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <button onClick={onExit} aria-label="חזרה" style={{ position: 'absolute', insetInlineStart: 14, background: 'none', border: 'none', cursor: 'pointer' }}><IconBackRTL size={24} color={GOLD} /></button>
        <div style={{ fontFamily: "'Suez One', serif", fontSize: 22, fontWeight: 700, color: GOLD }}>שש-בש</div>
      </div>
      <div style={{ padding: 24 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '32px 24px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 56, marginBottom: 14 }}>👋</div>
          <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>היריב עזב את המשחק</div>
          <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.4, marginBottom: 20 }}>המשחק הופסק. אפשר לחפש יריב חדש או לצאת.</div>
          <button onClick={onFindOther} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 10 }}>🔎 חפש שחקן אחר</button>
          <button onClick={onExit} className="big-btn big-btn--ghost" style={{ width: '100%' }}>יציאה</button>
        </div>
      </div>
    </div>
  )
}
