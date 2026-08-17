// src/pages/BridgeOnline.jsx
// ─────────────────────────────────────────────────────────────
// ברידג' אונליין — שולחן של 4 מושבים עם וידאו וצ'אט.
//
// זרימה:
//   1. חדר המתנה — נכנסים לשולחן, רואים מי הצטרף.
//   2. המארח לוחץ "התחל משחק"; מושבים ריקים מתמלאים בבוטים.
//   3. משחק מסונכרן — מצב המשחק המלא נשמר כ-JSON על מסמך החדר,
//      ורק מי שבתורו כותב אותו. את הבוטים מריץ המארח בלבד.
//
// המנוע כאן משוכפל מ-BridgeGame.jsx במכוון (אותו דפוס כמו
// DominoOnline מול DominoGame) — כדי להימנע מייבוא מעגלי.
//
// Props: mode ('online-random'), initialRoomId, onBack, onHome, profile
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { watchFriendships, sendGameInvite, watchUser } from '../services/firebase.js'
import { playSound } from '../utils/gameSounds'
import { useGameMusic, GameMusicButton } from '../hooks/useGameMusic.jsx'
import { IconBackRTL, IconChatLine } from '../icons/index.jsx'
import HomeButton from '../components/HomeButton.jsx'
import Avatar from '../components/Avatar.jsx'
import LeaveConfirmModal from '../components/LeaveConfirmModal.jsx'
import { GameIcon } from '../icons/gameIcons.jsx'
import {
  GameVideoProvider, PlayerVideo, VideoControls, VideoConsentGate, ProfilesProvider,
} from '../components/GameVideo.jsx'
import {
  createBridgeRoom, joinBridgeRoom, watchBridgeRoom, startBridgeGame,
  updateBridgeState, leaveBridgeRoom, findOrCreateBridgeMatch,
  sendBridgeChat, watchBridgeChat,
} from '../services/bridgeRooms.js'

// ════════════════════════════════════════════════════════
// מנוע (זהה ל-BridgeGame.jsx)
// ════════════════════════════════════════════════════════
const SUIT_CHAR = ['♣', '♦', '♥', '♠']
const SUIT_NAME = ['תלתן', 'יהלום', 'לב', 'עלה']
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
const NT = 4
const rankLabel = (r) => RANK_LABEL[r] || String(r)
const isRed = (s) => s === 1 || s === 2
const cardKey = (c) => `${c.s}-${c.r}`
const nextSeat = (i) => (i + 1) % 4
const partnerOf = (i) => (i + 2) % 4
const sameSide = (a, b) => a % 2 === b % 2
const HCP_VALUE = { 14: 4, 13: 3, 12: 2, 11: 1 }
const handHcp = (h) => h.reduce((s, c) => s + (HCP_VALUE[c.r] || 0), 0)
const BOT_NAMES = ['רותי', 'משה', 'שרה', 'דוד', 'מרים', 'יעקב']

function sortHand(hand) { return [...hand].sort((a, b) => (b.s - a.s) || (b.r - a.r)) }

function freshDeal() {
  const deck = []
  for (let s = 0; s < 4; s++) for (const r of RANKS) deck.push({ s, r })
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[deck[i], deck[j]] = [deck[j], deck[i]] }
  const hands = [[], [], [], []]
  deck.forEach((c, i) => hands[i % 4].push(c))
  return hands.map(sortHand)
}

function legalCards(hand, trick) {
  if (!trick.length) return hand
  const led = trick[0].card.s
  const inSuit = hand.filter(c => c.s === led)
  return inSuit.length ? inSuit : hand
}

function trickLeader(trick, trump) {
  let best = trick[0]
  for (const p of trick.slice(1)) {
    const c = p.card, b = best.card
    if (trump !== NT && c.s === trump && b.s !== trump) best = p
    else if (c.s === b.s && c.r > b.r) best = p
  }
  return best
}

function beats(a, b, trump, led) {
  if (trump !== NT) {
    if (a.s === trump && b.s !== trump) return true
    if (b.s === trump && a.s !== trump) return false
  }
  if (a.s !== b.s) return a.s === led
  return a.r > b.r
}

function targetTricks(hcp, trump) {
  if (hcp < 26) return 7
  if (trump === NT) return 9
  if (trump === 3 || trump === 2) return 10
  return 11
}
const contractLabel = (trump, target) => `${target - 6}${trump === NT ? ' ללא שליט' : SUIT_CHAR[trump]}`

function aiChooseCard(hand, trick, trump, seat) {
  const legal = legalCards(hand, trick)
  if (legal.length === 1) return legal[0]
  const lowest = (arr) => arr.reduce((m, c) => (c.r < m.r ? c : m), arr[0])
  if (!trick.length) {
    const aces = legal.filter(c => c.r === 14 && c.s !== trump)
    if (aces.length) return aces[0]
    const bySuit = {}
    legal.forEach(c => { (bySuit[c.s] = bySuit[c.s] || []).push(c) })
    return lowest(Object.values(bySuit).sort((a, b) => b.length - a.length)[0])
  }
  const led = trick[0].card.s
  const leader = trickLeader(trick, trump)
  if (sameSide(leader.seat, seat)) return lowest(legal)
  const winners = legal.filter(c => beats(c, leader.card, trump, led))
  if (winners.length) return lowest(winners)
  const nonTrump = legal.filter(c => c.s !== trump)
  return lowest(nonTrump.length ? nonTrump : legal)
}

function aiChooseTrump(a, b) {
  const counts = [0, 0, 0, 0]
  ;[...a, ...b].forEach(c => { counts[c.s]++ })
  let best = 0
  for (let s = 1; s < 4; s++) if (counts[s] > counts[best]) best = s
  return counts[best] >= 8 ? best : NT
}

// ── מצב התחלתי לחלוקה חדשה ──
// seats: מערך של 4 — { id, name, bot }
function initDeal(seats) {
  const hands = freshDeal()
  const hcp = hands.map(handHcp)
  const ns = hcp[0] + hcp[2], ew = hcp[1] + hcp[3]
  const side = ns >= ew ? [0, 2] : [1, 3]
  // כברירת מחדל הכרוז הוא בעל הנקודות הרבות בצד המוביל (כמו בברידג' אמיתי),
  // אבל אם אחד מהשניים הוא בוט — מעדיפים את האדם, כדי שלא ישב כדומם
  // ויצפה במחשב משחק לבד את כל החלוקה.
  const [a, b] = side
  let declarer
  if (seats[a].bot !== seats[b].bot) {
    declarer = seats[a].bot ? b : a          // האנושי מקבל את הכרוז
  } else {
    declarer = hcp[a] >= hcp[b] ? a : b      // שניהם אנושיים (או שניהם בוטים) — החוק הרגיל
  }
  return {
    seats,
    hands, hcp,
    combined: ns >= ew ? ns : ew,
    declarer, dummy: partnerOf(declarer),
    trump: null, target: null,
    trick: [], turn: null,
    tricksWon: [0, 0, 0, 0], trickNo: 0,
    phase: 'contract', result: null,
    seq: 1,
    lastMsg: `${seats[declarer].name} מוביל/ה את החלוקה`,
  }
}

const clone = (s) => JSON.parse(JSON.stringify(s))

function applySetTrump(state, trump) {
  const s = clone(state)
  s.trump = trump
  s.target = targetTricks(s.combined, trump)
  s.phase = 'play'
  s.turn = nextSeat(s.declarer)
  s.lastMsg = `החוזה: ${contractLabel(trump, s.target)}`
  s.seq = (s.seq || 0) + 1
  return s
}

function applyPlay(state, seat, card) {
  const s = clone(state)
  s.hands[seat] = s.hands[seat].filter(c => cardKey(c) !== cardKey(card))
  s.trick = [...s.trick, { seat, card }]
  if (s.trick.length < 4) {
    s.turn = nextSeat(seat)
  } else {
    const winner = trickLeader(s.trick, s.trump).seat
    s.tricksWon[winner]++
    s.trickNo++
    s.turn = null
    s.pendingWinner = winner
  }
  s.seq = (s.seq || 0) + 1
  return s
}

function applyCloseTrick(state) {
  const s = clone(state)
  const winner = s.pendingWinner
  const declTricks = s.tricksWon[s.declarer] + s.tricksWon[s.dummy]
  s.trick = []
  s.pendingWinner = null
  if (s.trickNo >= 13) {
    const made = declTricks >= s.target
    s.phase = 'done'
    s.turn = null
    s.result = { made, declTricks, declarer: s.declarer }
    s.lastMsg = made ? 'החוזה בוצע!' : 'החוזה נכשל'
  } else {
    s.turn = winner
    s.lastMsg = `תור ${s.seats[winner].name}`
  }
  s.seq = (s.seq || 0) + 1
  return s
}

// ════════════════════════════════════════════════════════
// הרכיב הראשי
// ════════════════════════════════════════════════════════
export default function BridgeOnline({ initialRoomId = null, friendsMode = false, autoInviteFriend = null, onBack, onHome }) {
  const { authUser, profile } = useUserStore()
  const myUid = authUser?.uid
  const me = { id: myUid, name: profile?.name || 'שחקן', photoURL: profile?.photoURL || null }

  const [roomId, setRoomId] = useState(initialRoomId)
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const [useVideo, setUseVideo] = useState(null)   // null = טרם הוחלט
  const music = useGameMusic('beyahad-bridge-music')
  const joinedRef = useRef(false)

  // ── כניסה לחדר (שידוך אקראי / חדר נתון / שולחן חברים) ──
  // הגנה מפני ריצה כפולה נעשית ב-joinedRef בלבד.
  // חשוב: אסור לבטל את עדכון ה-state ב-cleanup — במצב פיתוח React
  // מרכיב ומפרק את הרכיב פעמיים, ואז מזהה החדר לא נשמר והמסך נתקע.
  useEffect(() => {
    if (!myUid || joinedRef.current) return
    joinedRef.current = true
    ;(async () => {
      try {
        if (initialRoomId) {
          const res = await joinBridgeRoom(initialRoomId, me)
          if (!res.ok && res.reason !== 'already-in') {
            const msgs = { full: 'השולחן מלא', started: 'המשחק כבר התחיל', 'not-found': 'החדר לא נמצא', ended: 'המשחק הסתיים' }
            setError(msgs[res.reason] || 'לא הצלחנו להצטרף')
            return
          }
          setRoomId(initialRoomId)
        } else if (friendsMode) {
          // שולחן פרטי — לא משודך אקראית; מזמינים אליו חברים מהרשימה
          const rid = await createBridgeRoom(me, { isPrivate: true })
          setRoomId(rid)
          // הגענו מ"שחק עם" של חבר/ה ספציפי/ת — שולחים הזמנה מיד
          if (autoInviteFriend && autoInviteFriend.otherUid) {
            try {
              await sendGameInvite({
                from: { uid: me.id, name: me.name, photoURL: me.photoURL || '' },
                to: { uid: autoInviteFriend.otherUid, name: autoInviteFriend.otherName },
                gameType: 'bridge', roomId: rid,
              })
            } catch (e) { console.error('bridge invite error:', e) }
          }
        } else {
          const { roomId: rid } = await findOrCreateBridgeMatch(me)
          setRoomId(rid)
        }
      } catch (e) {
        console.error('bridge join error:', e)
        setError('לא הצלחנו להתחבר לשולחן')
      }
    })()
  }, [myUid, initialRoomId, friendsMode])

  // ── מעקב אחרי החדר ──
  useEffect(() => {
    if (!roomId) return
    return watchBridgeRoom(roomId, (r) => setRoom(r))
  }, [roomId])

  // ── עזיבה ביציאה ──
  const leave = async () => {
    if (roomId && myUid) await leaveBridgeRoom(roomId, myUid)
    onBack()
  }

  if (error) {
    return (
      <CenterMsg title={error} onBack={onBack}>
        <button onClick={onBack} className="big-btn big-btn--primary" style={{ width: '100%' }}>חזרה</button>
      </CenterMsg>
    )
  }
  if (!roomId || !room) return <CenterMsg title={friendsMode ? 'פותחים שולחן...' : 'מחפשים שולחן פנוי...'} onBack={onBack} />

  // מסך אישור הווידאו — פעם אחת, לפני הכל
  if (useVideo === null) {
    return <VideoConsentGate onDecide={setUseVideo} accent="#1d4a2e" accentDeep="#2E6B45" />
  }

  const uids = (room.players || []).map(p => p.id)

  return (
    <ProfilesProvider uids={uids} myUid={myUid}>
      <GameVideoProvider roomId={`bridge-${roomId}`} me={{ uid: myUid, name: me.name }} enabled={useVideo} startWithCam={useVideo}>
        <div onPointerDown={music.kick} style={{ height: '100%' }}>
          {room.status === 'playing' && room.state
            ? <OnlineTable roomId={roomId} room={room} me={me} music={music} onLeave={leave} onHome={onHome} />
            : <WaitingRoom roomId={roomId} room={room} me={me} music={music}
                autoOpenInvite={friendsMode && !autoInviteFriend}
                onLeave={leave} onHome={onHome} />}
        </div>
      </GameVideoProvider>
    </ProfilesProvider>
  )
}

// ── מסך הודעה מרכזי ───────────────────────────────────────
function CenterMsg({ title, children, onBack }) {
  return (
    <div style={{ height: '100%', direction: 'rtl', background: 'linear-gradient(180deg,#3b2a1c,#241a11)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 12px' }}>
        <button onClick={onBack} aria-label="חזרה" style={roundBtn}><IconBackRTL size={20} color="#F6F0E3" /></button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <div style={{ fontSize: 40, letterSpacing: 2 }}>
          <span style={{ color: '#FBF7EE' }}>♠</span><span style={{ color: '#E8884F' }}>♥</span>
          <span style={{ color: '#E8884F' }}>♦</span><span style={{ color: '#FBF7EE' }}>♣</span>
        </div>
        <div className="h-display" style={{ fontSize: 22, color: '#F6F0E3', textAlign: 'center' }}>{title}</div>
        <div style={{ width: '100%', maxWidth: 300 }}>{children}</div>
      </div>
    </div>
  )
}

const roundBtn = {
  width: 36, height: 36, borderRadius: '50%', border: 'none', padding: 0, minHeight: 'unset',
  background: 'rgba(255,255,255,.14)', color: '#F6F0E3', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}

// ════════════════════════════════════════════════════════
// חדר המתנה
// ════════════════════════════════════════════════════════
function WaitingRoom({ roomId, room, me, music, autoOpenInvite = false, onLeave, onHome }) {
  const players = room.players || []
  const isHost = room.hostUid === me.id
  const [starting, setStarting] = useState(false)
  // במצב "שחק עם חברים" פותחים מיד את רשימת החברים — כמו בשאר המשחקים
  const [inviteOpen, setInviteOpen] = useState(autoOpenInvite)

  const start = async () => {
    if (starting) return
    setStarting(true)
    try {
      // מסדרים את השחקנים במושבים, וממלאים את החסרים בבוטים
      const usedNames = new Set(players.map(p => p.name))
      const botPool = BOT_NAMES.filter(n => !usedNames.has(n))
      const seats = []
      for (let i = 0; i < 4; i++) {
        if (players[i]) seats.push({ id: players[i].id, name: players[i].name, bot: false })
        else seats.push({ id: `bot-${i}`, name: botPool[i % botPool.length] || `שחקן ${i + 1}`, bot: true })
      }
      await startBridgeGame(roomId, initDeal(seats))
    } catch (e) {
      console.error('start bridge error:', e)
      setStarting(false)
    }
  }

  return (
    <div style={{ height: '100%', direction: 'rtl', background: 'linear-gradient(180deg,#3b2a1c,#241a11)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
        <button onClick={onLeave} aria-label="יציאה" style={roundBtn}><IconBackRTL size={20} color="#F6F0E3" /></button>
        <HomeButton onClick={onHome} />
        <div style={{ flex: 1, color: '#F6F0E3', fontSize: 17, fontWeight: 800 }}>השולחן של קלרה</div>
        {music && <GameMusicButton {...music} />}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px 24px' }}>
        <div style={{ background: 'linear-gradient(135deg,#2E6B45,#1d4a2e)', borderRadius: 18, padding: '16px 16px', color: '#EAF3DE', marginBottom: 18, textAlign: 'center' }}>
          <div className="h-display" style={{ fontSize: 20, marginBottom: 4 }}>מחכים לשחקנים</div>
          <div style={{ fontSize: 14, fontWeight: 600, opacity: .9 }}>
            הצטרפו {players.length} מתוך 4. אפשר להתחיל בכל רגע — המושבים החסרים יתמלאו בשחקני מחשב.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {[0, 1, 2, 3].map(i => {
            const p = players[i]
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: p ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.04)',
                border: `1px solid ${p ? '#6ba883' : 'rgba(255,255,255,.12)'}`,
                borderRadius: 14, padding: '10px 14px',
              }}>
                {p
                  ? <Avatar name={p.name} photoURL={p.photoURL} size={40} />
                  : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ec7a8', fontSize: 18 }}>?</div>}
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#F6F0E3', fontSize: 16, fontWeight: 700 }}>{p ? p.name : 'מושב פנוי'}</div>
                  <div style={{ color: '#9ec7a8', fontSize: 12.5, fontWeight: 600 }}>
                    {p ? (p.id === room.hostUid ? 'מארח/ת' : 'מוכן/ה') : 'ימולא בשחקן מחשב'}
                  </div>
                </div>
                {p && p.id === me.id && <span style={{ color: '#E8C879', fontSize: 12.5, fontWeight: 800 }}>אתם</span>}
              </div>
            )
          })}
        </div>

        {isHost ? (
          <button onClick={start} disabled={starting} className="big-btn big-btn--primary" style={{ width: '100%', opacity: starting ? .7 : 1 }}>
            {starting ? 'מתחילים...' : 'התחל משחק'}
          </button>
        ) : (
          <div style={{ textAlign: 'center', color: '#C0DD97', fontSize: 15, fontWeight: 700, padding: '14px 0' }}>
            ממתינים שהמארח/ת יתחיל/תתחיל...
          </div>
        )}

        <VideoControls style={{ justifyContent: 'center', marginTop: 18 }} size={44} />

        {players.length < 4 && (
          <button onClick={() => setInviteOpen(true)} style={{
            width: '100%', marginTop: 16, background: 'rgba(255,255,255,.12)', color: '#EAF3DE',
            border: '1px solid rgba(255,255,255,.24)', borderRadius: 16, padding: '14px 0',
            fontSize: 16.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
          }}>הזמנת חברים לשולחן</button>
        )}
      </div>

      {inviteOpen && (
        <BridgeInvitePicker roomId={roomId} me={me} players={players} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  )
}

// ── בוחר חברים להזמנה ─────────────────────────
// אותו דפוס כמו בשאר המשחקים: רשימת החברים שלי,
// לחיצה על "הזמן" שולחת הזמנה שקופצת אצל החבר/ה באפליקציה.
function BridgeInvitePicker({ roomId, me, players, onClose }) {
  const [friends, setFriends] = useState([])
  const [invited, setInvited] = useState({})
  const [profileMap, setProfileMap] = useState({})

  useEffect(() => {
    if (!me.id) return
    const unsub = watchFriendships(me.id, ({ friends }) => setFriends(friends || []))
    return () => unsub && unsub()
  }, [me.id])

  useEffect(() => {
    if (!friends || !friends.length) return
    const unsubs = friends.map(f => {
      if (!f.otherUid) return null
      return watchUser(f.otherUid, (u) => {
        const fullName = [u && u.name, u && u.lastName].filter(Boolean).join(' ')
        setProfileMap(prev => ({ ...prev, [f.otherUid]: { name: fullName, photoURL: (u && u.photoURL) || null } }))
      })
    })
    return () => unsubs.forEach(u => u && u())
  }, [friends])

  const inRoom = new Set(players.map(p => p.id))
  const available = friends.filter(f => f.otherUid && !inRoom.has(f.otherUid))

  const invite = async (f) => {
    setInvited(prev => ({ ...prev, [f.otherUid]: true }))
    try {
      await sendGameInvite({
        from: { uid: me.id, name: me.name, photoURL: me.photoURL || '' },
        to: { uid: f.otherUid, name: f.otherName },
        gameType: 'bridge', roomId,
      })
    } catch (e) { console.error('bridge invite error:', e) }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 2600, background: 'rgba(10,15,10,.72)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', direction: 'rtl',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: '24px 24px 0 0', width: '100%',
        maxWidth: 480, maxHeight: '72vh', overflowY: 'auto', padding: '20px 18px 28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="h-display" style={{ fontSize: 20, color: 'var(--ink)' }}>הזמנת חבר/ה לשולחן</div>
          <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'var(--line)', color: 'var(--ink)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        {available.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-2)', padding: '26px 0', fontSize: 15 }}>אין חברים נוספים זמינים להזמנה</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {available.map(f => {
              const prof = profileMap[f.otherUid]
              const dispName = (prof && prof.name) || f.otherName
              return (
                <div key={f.docId || f.otherUid} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar name={dispName} size={46} photoURL={prof && prof.photoURL} />
                  <div className="h-display" style={{ flex: 1, minWidth: 0, fontSize: 16, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dispName}</div>
                  <button disabled={!!invited[f.otherUid]} onClick={() => invite(f)} style={{
                    background: invited[f.otherUid] ? 'var(--success, #4F6B4A)' : '#2E6B45', color: 'white',
                    border: 'none', borderRadius: 12, padding: '10px 16px', fontSize: 15, fontWeight: 800,
                    fontFamily: 'inherit', cursor: invited[f.otherUid] ? 'default' : 'pointer', whiteSpace: 'nowrap',
                  }}>{invited[f.otherUid] ? 'נשלח ✓' : 'הזמן'}</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// קוד השולחן — שמור לעתיד (אינו בשימוש — ההזמנה נעשית דרך רשימת החברים)
// eslint-disable-next-line no-unused-vars
function TableCode({ roomId }) {
  const [copied, setCopied] = useState(false)
  const code = String(roomId || '').replace(/^br-/, '')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { setCopied(false) }
  }

  const share = async () => {
    const text = `בואו לשחק איתי בהברידג' של קלרה באפליקציית ביחד!\nקוד השולחן: ${code}`
    try {
      if (navigator.share) await navigator.share({ text })
      else await copy()
    } catch { /* המשתמש ביטל */ }
  }

  return (
    <div style={{ marginTop: 18, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 14, padding: '14px 14px' }}>
      <div style={{ color: '#EAF3DE', fontSize: 14.5, fontWeight: 800, marginBottom: 4 }}>להזמין חבר/ה לשולחן</div>
      <div style={{ color: '#9ec7a8', fontSize: 13, fontWeight: 600, marginBottom: 10, lineHeight: 1.45 }}>
        שלחו את הקוד הזה, והם יזינו אותו בכפתור "הצטרפות עם קוד" במסך המשחק.
      </div>
      <div style={{ background: '#FFFDF8', color: '#1B1B1E', borderRadius: 10, padding: '10px 12px', fontSize: 19, fontWeight: 800, textAlign: 'center', letterSpacing: '.06em', marginBottom: 10, direction: 'ltr', userSelect: 'all' }}>{code}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={share} className="big-btn big-btn--primary" style={{ flex: 1 }}>שלחו הזמנה</button>
        <button onClick={copy} style={{
          flex: 1, background: 'rgba(255,255,255,.12)', color: '#EAF3DE', border: '1px solid rgba(255,255,255,.2)',
          borderRadius: 14, fontSize: 15.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', padding: '13px 0',
        }}>{copied ? 'הועתק! ✓' : 'העתקת קוד'}</button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// שולחן המשחק המסונכרן
// ════════════════════════════════════════════════════════
function OnlineTable({ roomId, room, me, music, onLeave, onHome }) {
  const st = room.state
  const seats = st.seats || []
  const mySeat = Math.max(0, seats.findIndex(s => s.id === me.id))
  const isHost = room.hostUid === me.id
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chat, setChat] = useState([])
  const writingRef = useRef(false)
  const seqRef = useRef(0)

  useEffect(() => watchBridgeChat(roomId, setChat), [roomId])

  // מיפוי מושב מוחלט לתצוגה: אני תמיד למטה
  const rel = (abs) => (abs - mySeat + 4) % 4
  const abs = (relIdx) => (relIdx + mySeat) % 4
  const BOTTOM = abs(0), LEFT = abs(1), TOP = abs(2), RIGHT = abs(3)

  // כתיבת מצב — עם הגנה מפני כתיבה כפולה
  const push = async (next) => {
    if (writingRef.current) return
    if (next.seq <= seqRef.current) return
    writingRef.current = true
    seqRef.current = next.seq
    try { await updateBridgeState(roomId, next) } catch (e) { console.error(e) }
    writingRef.current = false
  }

  // הכרוז בוחר שליט
  const iAmDeclarer = st.declarer === mySeat
  const declarerIsBot = seats[st.declarer] && seats[st.declarer].bot

  // הכרוז שולט גם בקלפי הדומם (כמו בברידג' אמיתי)
  const iControl = (seat) => seat === mySeat || (iAmDeclarer && seat === st.dummy)

  // ── בחירת שליט אוטומטית ע"י המארח כשהכרוז הוא בוט ──
  useEffect(() => {
    if (!isHost || st.phase !== 'contract' || !declarerIsBot) return
    const t = setTimeout(() => {
      push(applySetTrump(st, aiChooseTrump(st.hands[st.declarer], st.hands[st.dummy])))
    }, 1200)
    return () => clearTimeout(t)
  }, [st.phase, st.seq, isHost, declarerIsBot])

  // ── סגירת לקיחה (מבצע מי שמושבו ראשון, כדי שרק אחד יכתוב) ──
  useEffect(() => {
    if (st.phase !== 'play' || st.trick.length !== 4 || st.pendingWinner == null) return
    // הכותב: המנצח בלקיחה אם הוא אנושי, אחרת המארח
    const winnerSeat = st.pendingWinner
    const winnerIsBot = seats[winnerSeat] && seats[winnerSeat].bot
    const iShouldWrite = winnerIsBot ? isHost : seats[winnerSeat].id === me.id
    if (!iShouldWrite) return
    const t = setTimeout(() => { push(applyCloseTrick(st)) }, 1500)
    return () => clearTimeout(t)
  }, [st.seq, st.trick.length, st.pendingWinner])

  // ── תור בוט — מריץ רק המארח ──
  useEffect(() => {
    if (!isHost || st.phase !== 'play' || st.turn == null) return
    const seat = st.turn
    // הכרוז-בוט משחק גם את הדומם
    const controllerSeat = seat === st.dummy ? st.declarer : seat
    if (!seats[controllerSeat] || !seats[controllerSeat].bot) return
    const t = setTimeout(() => {
      const card = aiChooseCard(st.hands[seat], st.trick, st.trump, seat)
      push(applyPlay(st, seat, card))
    }, 950)
    return () => clearTimeout(t)
  }, [st.turn, st.seq, st.phase, isHost])

  // ── פעולות שלי ──
  const playCard = (seat, card) => {
    if (st.phase !== 'play' || st.turn !== seat || !iControl(seat)) return
    try { playSound('drop') } catch { /* לא קריטי */ }
    push(applyPlay(st, seat, card))
  }
  const chooseTrump = (trump) => {
    if (st.phase !== 'contract' || !iAmDeclarer) return
    push(applySetTrump(st, trump))
  }
  const newDeal = () => {
    if (!isHost) return
    push({ ...initDeal(seats), seq: (st.seq || 0) + 1 })
  }

  const myTurnSeat = st.phase === 'play' && st.turn != null && iControl(st.turn) ? st.turn : null
  const legalKeys = new Set(myTurnSeat != null ? legalCards(st.hands[myTurnSeat], st.trick).map(cardKey) : [])
  const dummyVisible = st.phase !== 'contract' || true
  const playedBy = (seat) => { const p = st.trick.find(x => x.seat === seat); return p ? p.card : null }
  const ourTricks = st.tricksWon[mySeat] + st.tricksWon[partnerOf(mySeat)]
  const theirTricks = st.tricksWon[nextSeat(mySeat)] + st.tricksWon[nextSeat(partnerOf(mySeat))]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', direction: 'rtl', background: 'linear-gradient(180deg,#3b2a1c 0%,#241a11 100%)', overflow: 'hidden' }}>
      {/* סרגל עליון */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 8px', flexShrink: 0 }}>
        <button onClick={() => setLeaveOpen(true)} aria-label="יציאה" style={roundBtn}><IconBackRTL size={20} color="#F6F0E3" /></button>
        <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {st.phase === 'contract'
            ? <Chip bg="#96742E" fg="#fff">בחירת שליט</Chip>
            : (
              <>
                <Chip bg="#2E6B45" fg="#EAF3DE">חוזה {contractLabel(st.trump, st.target)}</Chip>
                <Chip bg="rgba(255,255,255,.14)" fg="#F6F0E3">אנחנו {ourTricks} · הם {theirTricks}</Chip>
              </>
            )}
        </div>
        <button onClick={() => setChatOpen(o => !o)} aria-label="צ'אט" style={roundBtn}><IconChatLine size={19} color="#F6F0E3" /></button>
        {music && <GameMusicButton {...music} />}
      </div>

      {/* השולחן */}
      <div style={{ flex: 1, minHeight: 0, padding: '0 10px', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          flex: 1, minHeight: 0, borderRadius: 20, padding: '10px 8px',
          background: 'radial-gradient(ellipse at 50% 40%, #3a8358 0%, #2E6B45 45%, #1d4a2e 100%)',
          border: '5px solid #5e3e22',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,.35), 0 10px 24px -8px rgba(0,0,0,.6)',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden',
        }}>
          {/* שותף (למעלה) */}
          <SeatBox
            seat={TOP} st={st} label={seats[TOP].name} uid={seats[TOP].bot ? null : seats[TOP].id}
            exposed={dummyVisible && st.dummy === TOP}
            clickable={st.phase === 'play' && st.turn === TOP && iControl(TOP)}
            legalKeys={legalKeys} onPlay={(c) => playCard(TOP, c)}
          />

          {/* מרכז */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '4px 2px' }}>
            <SideBox seat={LEFT} st={st} label={seats[LEFT].name} uid={seats[LEFT].bot ? null : seats[LEFT].id} exposed={dummyVisible && st.dummy === LEFT} />
            <TrickCenter st={st} rel={rel} playedBy={playedBy} />
            <SideBox seat={RIGHT} st={st} label={seats[RIGHT].name} uid={seats[RIGHT].bot ? null : seats[RIGHT].id} exposed={dummyVisible && st.dummy === RIGHT} />
          </div>

          <div style={{ textAlign: 'center', color: '#C0DD97', fontSize: 12.5, fontWeight: 700, minHeight: 18 }}>
            {st.phase === 'play' && st.turn != null && (
              iControl(st.turn)
                ? (st.turn === mySeat ? 'התור שלכם — בחרו קלף' : `שחקו מהדומם (${seats[st.dummy].name})`)
                : `תור ${seats[st.turn].name}`
            )}
            {st.phase === 'play' && st.turn == null && st.trick.length === 4 && 'לקיחה!'}
            {st.phase === 'contract' && !iAmDeclarer && `${seats[st.declarer].name} בוחר/ת שליט...`}
          </div>
        </div>
      </div>

      {/* היד שלי */}
      <div style={{ flexShrink: 0, padding: '8px 6px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 5px', color: '#E8D9C2', fontSize: 12.5, fontWeight: 700 }}>
          <span>{seats[BOTTOM].name}{st.declarer === BOTTOM ? ' · הכרוז' : (st.dummy === BOTTOM ? ' · הדומם' : '')}</span>
          <span style={{ opacity: .8 }}>{handHcp(st.hands[BOTTOM])} נקודות</span>
        </div>
        <HandFan
          hand={st.hands[BOTTOM]}
          clickable={st.phase === 'play' && st.turn === BOTTOM && iControl(BOTTOM)}
          legalKeys={st.turn === BOTTOM ? legalKeys : null}
          onPlay={(c) => playCard(BOTTOM, c)}
        />
      </div>

      <VideoControls style={{ position: 'fixed', insetInlineStart: 12, bottom: 96 }} size={42} />

      {/* בחירת שליט */}
      {st.phase === 'contract' && iAmDeclarer && (
        <TrumpChooser combined={st.combined} hand={st.hands[mySeat]} dummyHand={st.hands[st.dummy]}
          partnerName={seats[st.dummy].name} onChoose={chooseTrump} />
      )}

      {/* סיום */}
      {st.phase === 'done' && st.result && (
        <ResultModal st={st} mySeat={mySeat} isHost={isHost} onNewDeal={newDeal} onExit={onLeave} />
      )}

      {chatOpen && <ChatBox roomId={roomId} me={me} chat={chat} onClose={() => setChatOpen(false)} />}

      {leaveOpen && (
        <LeaveConfirmModal onStay={() => setLeaveOpen(false)} onLeave={() => { setLeaveOpen(false); onLeave() }} />
      )}
    </div>
  )
}

// ── רכיבי שולחן ───────────────────────────────────────────
function Chip({ children, bg, fg }) {
  return <span style={{ background: bg, color: fg, fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>{children}</span>
}

function SeatLabel({ st, seat, name, uid }) {
  const active = st.turn === seat
  const role = st.declarer === seat ? 'הכרוז' : (st.dummy === seat ? 'הדומם' : null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {uid
        ? <PlayerVideo uid={uid} name={name} size={38} />
        : <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#5e3e22', color: '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800 }}>{name[0]}</div>}
      <div style={{ fontSize: 11.5, fontWeight: 800, color: active ? '#E8C879' : '#C0DD97', display: 'flex', alignItems: 'center', gap: 4 }}>
        {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E8C879' }} />}
        {name}
      </div>
      {role && <div style={{ fontSize: 9.5, fontWeight: 700, color: '#9ec7a8' }}>{role}</div>}
    </div>
  )
}

function SeatBox({ seat, st, label, uid, exposed, clickable, legalKeys, onPlay }) {
  const hand = st.hands[seat]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <SeatLabel st={st} seat={seat} name={label} uid={uid} />
      {exposed ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
          {[3, 2, 1, 0].map(s => {
            const cards = hand.filter(c => c.s === s)
            if (!cards.length) return null
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 13, width: 14, textAlign: 'center', color: isRed(s) ? '#FFC2C2' : '#FFFDF8' }}>{SUIT_CHAR[s]}</span>
                {cards.map(c => {
                  const legal = !!(clickable && legalKeys && legalKeys.has(cardKey(c)))
                  return (
                    <button key={cardKey(c)} onClick={legal ? () => onPlay(c) : undefined} disabled={!legal} style={{
                      width: 21, height: 28, borderRadius: 4, padding: 0, minHeight: 'unset',
                      background: '#FFFDF8', color: isRed(c.s) ? '#C41E1E' : '#1B1B1E',
                      fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit',
                      border: legal ? '2px solid #E8C879' : '1px solid rgba(0,0,0,.2)',
                      opacity: clickable && !legal ? .42 : 1, cursor: legal ? 'pointer' : 'default', flexShrink: 0,
                    }}>{rankLabel(c.r)}</button>
                  )
                })}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 1 }}>
          {Array.from({ length: Math.min(hand.length, 13) }).map((_, i) => <CardBack key={i} />)}
        </div>
      )}
    </div>
  )
}

function SideBox({ seat, st, label, uid, exposed }) {
  const hand = st.hands[seat]
  return (
    <div style={{ width: 80, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <SeatLabel st={st} seat={seat} name={label} uid={uid} />
      {exposed ? (
        <div style={{ background: 'rgba(255,253,248,.94)', borderRadius: 7, padding: '4px 5px', width: '100%', boxSizing: 'border-box' }}>
          {[3, 2, 1, 0].map(s => {
            const cards = hand.filter(c => c.s === s)
            return (
              <div key={s} style={{ fontSize: 10.5, fontWeight: 800, lineHeight: 1.25, color: isRed(s) ? '#C41E1E' : '#1B1B1E', wordBreak: 'break-all' }}>
                {SUIT_CHAR[s]} {cards.length ? cards.map(c => rankLabel(c.r)).join(' ') : '-'}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', paddingInline: 2 }}>
          {/* ערימה חופפת — נשארת צרה ולא נוגעת במרכז השולחן */}
          {Array.from({ length: Math.min(hand.length, 5) }).map((_, i) => (
            <div key={i} style={{ marginInlineStart: i === 0 ? 0 : -15 }}><CardBack /></div>
          ))}
        </div>
      )}
    </div>
  )
}

function TrickCenter({ st, rel, playedBy }) {
  const slotFor = (relIdx) => {
    const seat = [0, 1, 2, 3].find(s => rel(s) === relIdx)
    const c = playedBy(seat)
    return c ? <Card card={c} size="md" highlight={st.pendingWinner === seat} /> : <div style={{ width: 34, height: 48 }} />
  }
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'rgba(0,0,0,.16)', borderRadius: 14, padding: '6px 4px', minHeight: 128, justifyContent: 'center' }}>
      {slotFor(2)}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {slotFor(3)}
        {slotFor(1)}
      </div>
      {slotFor(0)}
    </div>
  )
}

function Card({ card, size = 'md', dim = false, highlight = false, onClick = null }) {
  const [w, h, fs] = { sm: [26, 36, 12], md: [34, 48, 15], lg: [40, 56, 18] }[size]
  return (
    <div onClick={onClick || undefined} role={onClick ? 'button' : undefined} style={{
      width: w, height: h, borderRadius: Math.round(w / 6), background: '#FFFDF8',
      color: isRed(card.s) ? '#C41E1E' : '#1B1B1E',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontSize: fs, fontWeight: 800, lineHeight: 1,
      border: highlight ? '2.5px solid #E8C879' : '1px solid rgba(0,0,0,.22)',
      boxShadow: highlight ? '0 0 10px rgba(232,200,121,.65)' : '0 2px 5px rgba(0,0,0,.3)',
      opacity: dim ? .42 : 1, cursor: onClick ? 'pointer' : 'default',
      transform: highlight ? 'translateY(-5px)' : 'none', transition: 'transform .15s, opacity .15s',
      flexShrink: 0, userSelect: 'none',
    }}>
      <span>{rankLabel(card.r)}</span>
      <span style={{ fontSize: fs * 0.9 }}>{SUIT_CHAR[card.s]}</span>
    </div>
  )
}

function CardBack() {
  return <div style={{ width: 22, height: 31, borderRadius: 4, flexShrink: 0, background: 'repeating-linear-gradient(45deg,#1e4b7a,#1e4b7a 3px,#2b6099 3px,#2b6099 6px)', border: '1.5px solid #FFFDF8' }} />
}

function HandFan({ hand, clickable, legalKeys, onPlay }) {
  return (
    <div style={{ display: 'flex', gap: 7, justifyContent: 'center', flexWrap: 'wrap', padding: '0 4px' }}>
      {[3, 2, 1, 0].map(s => {
        const cards = hand.filter(c => c.s === s)
        if (!cards.length) return null
        return (
          <div key={s} style={{ display: 'flex', gap: 2 }}>
            {cards.map(c => {
              const legal = !legalKeys || legalKeys.has(cardKey(c))
              return <Card key={cardKey(c)} card={c} size="lg" dim={clickable && !legal} highlight={clickable && legal}
                onClick={clickable && legal ? () => onPlay(c) : null} />
            })}
          </div>
        )
      })}
    </div>
  )
}

function TrumpChooser({ combined, hand, dummyHand, partnerName, onChoose }) {
  const counts = [0, 0, 0, 0]
  ;[...hand, ...dummyHand].forEach(c => { counts[c.s]++ })
  const btn = (color) => ({
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: '#FFFDF8',
    border: '2px solid #E4DECE', borderRadius: 14, padding: '11px 14px', color,
    fontSize: 18, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', minHeight: 'unset', textAlign: 'right',
  })
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, direction: 'rtl' }}>
      <div style={{ background: '#F6F0E3', borderRadius: 22, padding: '20px 18px', maxWidth: 420, width: '100%', maxHeight: '86vh', overflowY: 'auto' }}>
        <div className="h-display" style={{ fontSize: 21, color: '#2E6B45', marginBottom: 4 }}>אתם מובילים את החלוקה!</div>
        <div style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 14 }}>
          לכם ול{partnerName} יש יחד <strong>{combined} נקודות</strong>. בחרו את השליט.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[3, 2, 1, 0].map(s => (
            <button key={s} onClick={() => onChoose(s)} style={btn(isRed(s) ? '#C41E1E' : '#1B1B1E')}>
              <span style={{ fontSize: 26 }}>{SUIT_CHAR[s]}</span>
              <span style={{ flex: 1, textAlign: 'right' }}>{SUIT_NAME[s]}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5F5E5A' }}>{counts[s]} קלפים · יעד {targetTricks(combined, s)}</span>
            </button>
          ))}
          <button onClick={() => onChoose(NT)} style={btn('#2C5566')}>
            <span style={{ fontSize: 20, fontWeight: 800 }}>NT</span>
            <span style={{ flex: 1, textAlign: 'right' }}>בלי שליט</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5F5E5A' }}>יעד {targetTricks(combined, NT)}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function ResultModal({ st, mySeat, isHost, onNewDeal, onExit }) {
  const { made, declTricks } = st.result
  const iDeclared = sameSide(st.declarer, mySeat)
  const weWon = iDeclared ? made : !made
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, direction: 'rtl' }}>
      <div style={{ background: '#F6F0E3', borderRadius: 22, padding: '24px 20px', maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <GameIcon id={weWon ? 'trophy' : 'ai-win'} size={62} />
        </div>
        <div className="h-display" style={{ fontSize: 24, color: weWon ? '#2E6B45' : '#7E2C2E', marginBottom: 8 }}>
          {weWon ? 'כל הכבוד, ניצחתם!' : 'הפעם לא הסתדר'}
        </div>
        <div style={{ fontSize: 15.5, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 18 }}>
          החוזה היה <strong>{contractLabel(st.trump, st.target)}</strong> - צריך היה {st.target} לקיחות.<br />
          הצד המוביל לקח <strong>{declTricks}</strong> לקיחות, {made ? 'החוזה בוצע' : 'החוזה נכשל'}.
        </div>
        {isHost
          ? <button onClick={onNewDeal} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 10 }}>חלוקה חדשה</button>
          : <div style={{ fontSize: 14.5, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 10 }}>ממתינים למארח/ת לחלוקה חדשה...</div>}
        <button onClick={onExit} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--ink-3)', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', padding: 8 }}>
          יציאה מהשולחן
        </button>
      </div>
    </div>
  )
}

// ── צ'אט ─────────────────────────────────────────────────
function ChatBox({ roomId, me, chat, onClose }) {
  const [text, setText] = useState('')
  const endRef = useRef(null)
  useEffect(() => { try { endRef.current?.scrollIntoView({ behavior: 'smooth' }) } catch {} }, [chat.length])

  const send = async () => {
    const t = text.trim()
    if (!t) return
    setText('')
    try { await sendBridgeChat(roomId, { uid: me.id, name: me.name, text: t }) } catch (e) { console.error(e) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2500, display: 'flex', alignItems: 'flex-end', direction: 'rtl' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#F6F0E3', width: '100%', maxHeight: '70vh', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', padding: '14px 14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)', flex: 1 }}>צ'אט השולחן</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 120, marginBottom: 10 }}>
          {chat.length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 14, textAlign: 'center', padding: 20 }}>עוד אין הודעות</div>}
          {chat.map(m => (
            <div key={m.id} style={{ marginBottom: 8, textAlign: m.uid === me.id ? 'left' : 'right' }}>
              <div style={{ display: 'inline-block', background: m.uid === me.id ? '#2E6B45' : 'var(--surface-2)', color: m.uid === me.id ? '#EAF3DE' : 'var(--ink)', borderRadius: 12, padding: '7px 11px', maxWidth: '80%' }}>
                {m.uid !== me.id && <div style={{ fontSize: 11.5, fontWeight: 800, opacity: .7, marginBottom: 2 }}>{m.name}</div>}
                <div style={{ fontSize: 15, fontWeight: 600 }}>{m.text}</div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send() }}
            placeholder="כתבו הודעה..." dir="rtl"
            style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 12, padding: '11px 13px', fontSize: 15, fontFamily: 'inherit' }} />
          <button onClick={send} className="big-btn big-btn--primary" style={{ minWidth: 80, padding: '0 16px' }}>שלח</button>
        </div>
      </div>
    </div>
  )
}
