// src/pages/DominoOnline.jsx
// ─────────────────────────────────────────────────────────────
// דומינו אונליין — שחקן רנדומלי + שחק עם חברים (2-4 שחקנים).
//
// זרימה (מראה את RummikubOnline):
//   1. Lobby — חיפוש רנדומלי או בחירת חברים להזמנה.
//   2. WaitingRoom — רשימת השחקנים שהצטרפו; המארח לוחץ "התחל".
//   3. OnlineGame — מסך המשחק המסונכרן; רק מי שבתורו פועל וכותב את המצב.
//
// הסנכרון: מצב המשחק המלא נשמר כ-JSON על מסמך החדר (dominoRooms),
// ומשודר בזמן אמת לכל המשתתפים דרך watchDominoRoom. המנוע (אבנים,
// לוח-נחש, משיכה/דילוג) זהה למשחק המקומי (DominoGame.jsx) — מותאם
// לריבוי שחקנים מונחה-Firestore.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { IconBackRTL, IconCheck, IconTrophy, IconHourglass, IconChatLine, IconGamepad, IconGroup } from '../icons/index.jsx'
import { GameIcon } from '../icons/gameIcons.jsx'
import HomeButton from '../components/HomeButton.jsx'
import Avatar from '../components/Avatar.jsx'
import { useUserStore } from '../stores/userStore.js'
import { playSound, isMuted, setMuted, MUSIC_TRACKS } from '../utils/gameSounds.js'
import { ChatPanel, ChatToast } from '../components/GameChat.jsx'
import { GameVideoProvider, PlayerVideo, VideoControls, RemoteVideoToggles, VideoConsentGate, ProfilesProvider, usePlayerProfile } from '../components/GameVideo.jsx'
import {
  createDominoRoom, joinDominoRoom, startDominoGame,
  updateDominoState, watchDominoRoom, leaveDominoRoom,
  findOrCreateDominoMatch, watchFriendships, sendGameInvite,
  watchUser, sendDominoChat,
} from '../services/firebase.js'

// ════════════════════════════════════════════════════════
// מנוע דומינו (זהה ל-DominoGame.jsx — מקור אמת אחד עתידי: DominoShared)
// ════════════════════════════════════════════════════════
const FACES = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
function makeSet() { const t = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) t.push({ a, b, id: a + '-' + b }); return t }
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }
const pipSum = (hand) => hand.reduce((s, t) => s + t.a + t.b, 0)
const fitsEnd = (t, v) => v != null && (t.a === v || t.b === v)
const playableTiles = (hand, l, r) => hand.filter((t) => fitsEnd(t, l) || fitsEnd(t, r))
const keyOf = (t) => Math.min(t.a, t.b) + '-' + Math.max(t.a, t.b)
const lineEnds = (line) => ({ l: line.length ? line[0].a : null, r: line.length ? line[line.length - 1].b : null })

function placeOnLine(prev, tile, side) {
  const { l, r } = lineEnds(prev)
  if (side === 'l') { const other = tile.a === l ? tile.b : tile.a; return [{ a: other, b: l }, ...prev] }
  const other = tile.a === r ? tile.b : tile.a; return [...prev, { a: r, b: other }]
}

// פריסת נחש מעוגנת על אבן הפתיחה (זהה ל-buildSnake2 המקומי).
function buildSnake2(line, perRow, oi) {
  const L = 62, S = 31, PITCH = S + L
  const placed = []
  if (!line.length) return { placed, w: 1, h: 1 }
  if (oi == null || oi < 0 || oi >= line.length) oi = 0
  placed.push({ t: line[oi], li: oi, x: 0, y: 0, w: L, h: S, dir: 'R' })
  let rcol = 1, rrow = 0, rRight = true
  for (let k = oi + 1; k < line.length; k++) {
    if (rRight && rcol > perRow - 1) { placed.push({ t: line[k], li: k, x: (perRow - 1) * L + (L - S), y: rrow * PITCH + S, w: S, h: L, dir: 'D' }); rrow++; rRight = false; rcol = perRow - 1; continue }
    if (!rRight && rcol < 0) { placed.push({ t: line[k], li: k, x: 0, y: rrow * PITCH + S, w: S, h: L, dir: 'D' }); rrow++; rRight = true; rcol = 0; continue }
    placed.push({ t: line[k], li: k, x: rcol * L, y: rrow * PITCH, w: L, h: S, dir: rRight ? 'R' : 'L' })
    rcol += rRight ? 1 : -1
  }
  let lcol = -1, lrow = 0, lLeft = true
  for (let k = oi - 1; k >= 0; k--) {
    if (lLeft && lcol < -(perRow - 1)) { placed.push({ t: line[k], li: k, x: -(perRow - 1) * L, y: lrow * PITCH - L, w: S, h: L, dir: 'D' }); lrow--; lLeft = false; lcol = -(perRow - 1); continue }
    if (!lLeft && lcol > 0) { placed.push({ t: line[k], li: k, x: 0, y: lrow * PITCH - L, w: S, h: L, dir: 'D' }); lrow--; lLeft = true; lcol = 0; continue }
    placed.push({ t: line[k], li: k, x: lcol * L, y: lrow * PITCH, w: L, h: S, dir: lLeft ? 'R' : 'L' })
    lcol += lLeft ? -1 : 1
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  placed.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x + p.w); maxY = Math.max(maxY, p.y + p.h) })
  placed.forEach((p) => { p.x -= minX; p.y -= minY })
  return { placed, w: maxX - minX, h: maxY - minY }
}

// ── מצב המשחק ההתחלתי (deal + קביעת פותח) ──
function initDomino(players) {
  const deck = shuffle(makeSet())
  const n = players.length
  const handSize = n <= 2 ? 7 : 5
  const hands = {}
  let idx = 0
  for (const p of players) { hands[p.id] = deck.slice(idx, idx + handSize); idx += handSize }
  const boneyard = deck.slice(idx)
  // פותח: הכפולה הגבוהה ביותר; אם אין — האבן הגבוהה ביותר
  let openerIdx = -1, openTile = null
  for (let v = 6; v >= 0 && !openTile; v--) {
    for (let pi = 0; pi < n; pi++) {
      const t = hands[players[pi].id].find((x) => x.a === v && x.b === v)
      if (t) { openerIdx = pi; openTile = t; break }
    }
  }
  if (!openTile) {
    let best = null, bestPi = -1
    for (let pi = 0; pi < n; pi++) for (const t of hands[players[pi].id]) {
      if (!best || (t.a + t.b > best.a + best.b) || (t.a + t.b === best.a + best.b && Math.max(t.a, t.b) > Math.max(best.a, best.b))) { best = t; bestPi = pi }
    }
    openTile = best; openerIdx = bestPi
  }
  hands[players[openerIdx].id] = hands[players[openerIdx].id].filter((t) => t.id !== openTile.id)
  const line = [{ a: openTile.a, b: openTile.b }]
  return {
    players: players.map((p) => ({ id: p.id, name: p.name })),
    hands, line, boneyard,
    turn: (openerIdx + 1) % n,
    openerKey: keyOf(openTile), lastSide: 'r',
    passCount: 0, phase: 'play', winner: null, reason: null,
    lastMsg: `${players[openerIdx].name} פתח עם ${openTile.a}־${openTile.b}`,
    seq: 1,
  }
}

const clone = (s) => JSON.parse(JSON.stringify(s))
const nextIdx = (s, i) => (i + 1) % s.players.length

function applyPlay(state, idx, tile, side) {
  const s = clone(state)
  const uid = s.players[idx].id
  s.line = placeOnLine(s.line, tile, side)
  s.hands[uid] = s.hands[uid].filter((t) => t.id !== tile.id)
  s.lastSide = side
  s.passCount = 0
  if (s.hands[uid].length === 0) {
    s.phase = 'ended'; s.winner = idx; s.reason = 'out'
    s.lastMsg = `${s.players[idx].name} ניצח!`
  } else {
    s.turn = nextIdx(s, idx)
    s.lastMsg = `תור ${s.players[s.turn].name}`
  }
  s.seq = (s.seq || 0) + 1
  return s
}
function applyDraw(state, idx) {
  const s = clone(state)
  if (!s.boneyard.length) return s
  const drawn = s.boneyard.shift()
  s.hands[s.players[idx].id] = [...s.hands[s.players[idx].id], drawn]
  s.seq = (s.seq || 0) + 1
  return s
}
function applyPass(state, idx) {
  const s = clone(state)
  s.passCount = (s.passCount || 0) + 1
  if (s.passCount >= s.players.length) {
    let best = -1, bestSum = Infinity
    s.players.forEach((p, i) => { const sum = pipSum(s.hands[p.id]); if (sum < bestSum) { bestSum = sum; best = i } })
    s.phase = 'ended'; s.winner = best; s.reason = 'blocked'
    s.lastMsg = `המשחק נחסם — ${s.players[best].name} מנצח (פחות נקודות)`
  } else {
    s.turn = nextIdx(s, idx)
    s.lastMsg = `תור ${s.players[s.turn].name}`
  }
  s.seq = (s.seq || 0) + 1
  return s
}

// ── אבן בודדת ──
function Face({ v }) {
  return <div className="dm-half">{Array.from({ length: 9 }).map((_, i) => <span key={i}>{FACES[v].includes(i) ? <i className="dm-pip" /> : null}</span>)}</div>
}
function DTile({ a, b, vertical, onClick, cls = '', style }) {
  return <div className={'dm-tile ' + (vertical ? 'v' : 'h') + ' ' + cls} onClick={onClick} style={style}><Face v={a} /><Face v={b} /></div>
}

// ── אייקוני מוזיקה (לבן) ──
const IcBase = ({ size = 18, color = '#fff', children }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>{children}</svg>)
const IcMusic = (p) => <IcBase {...p}><path d="M9 17V5l10-2v12" /><circle cx="6" cy="17" r="3" /><circle cx="16" cy="15" r="3" /></IcBase>
const IcMusicOff = (p) => <IcBase {...p}><path d="M9 17V5l10-2v6" /><circle cx="6" cy="17" r="3" /><path d="M3 3l18 18" /></IcBase>
const IcSound = (p) => <IcBase {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={p.color || '#fff'} stroke="none" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></IcBase>
const IcSoundOff = (p) => <IcBase {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={p.color || '#fff'} stroke="none" /><path d="M22 9l-6 6M16 9l6 6" /></IcBase>
const IcNext = (p) => <IcBase {...p}><path d="M5 4l10 8-10 8z" fill={p.color || '#fff'} stroke="none" /><rect x="16" y="4" width="2.6" height="16" rx="1" fill={p.color || '#fff'} stroke="none" /></IcBase>
const dmMenuItem = { display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', padding: '8px 10px', textAlign: 'right', borderRadius: 8 }
const dmVolBtn = { width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.12)', color: '#fff', fontSize: 18, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }

const DOMINO_CSS = `
.dol-scene{position:relative;height:100%;display:flex;flex-direction:column;direction:rtl;font-family:Heebo,Arial,sans-serif;overflow:hidden;
  background:radial-gradient(ellipse 80% 80% at 50% 38%,#3fa06f 0%,#218a59 42%,#136441 74%,#0e4a31 100%);box-shadow:inset 0 0 70px rgba(0,0,0,.6)}
.dol-top{display:flex;align-items:center;gap:8px;padding:8px 12px;color:#f4e3b2;flex-shrink:0}
.dol-iconbtn{width:36px;height:36px;border-radius:50%;border:2px solid #0f3f28;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;flex:none}
.dol-title{font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#f4e3b2;text-shadow:0 2px 4px rgba(0,0,0,.6)}
.dol-players{display:flex;gap:6px;padding:4px 8px 0;flex-shrink:0;align-items:stretch}
.dol-pcard{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;border-radius:11px;padding:6px 4px;background:rgba(8,46,30,.6);border:1px solid rgba(201,162,74,.35)}
.dol-pcard.on{background:linear-gradient(180deg,#2c7a52,#16623f);border:1.5px solid #f1c95c;box-shadow:0 0 12px rgba(241,201,92,.4)}
.dol-pname{font-size:12px;font-weight:800;color:#eaf6ef;max-width:84px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center}
.dol-pcount{font-size:10px;font-weight:800;color:#0e3a26;background:#f4e3b2;border-radius:999px;padding:1px 8px}
.dol-status{text-align:center;font-size:15px;font-weight:800;color:#f4e3b2;padding:7px 10px 3px;flex-shrink:0;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.dol-boardwrap{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:6px 10px}
.dol-chain{position:relative;direction:ltr;transform-origin:center center}
.dol-hand{display:flex;justify-content:center;align-items:flex-end;gap:8px;padding:6px 10px 12px;flex-shrink:0;flex-wrap:wrap}
.dol-actbtn{border:none;cursor:pointer;font-family:inherit;font-weight:bold;color:#3a2a08;padding:11px 20px;border-radius:13px;background:linear-gradient(#ecca7e,#c99f44);box-shadow:0 4px 0 #8a6a22,0 9px 13px rgba(0,0,0,.4);font-size:15px}
.dm-tile{position:relative;display:flex;border-radius:6px;background:linear-gradient(160deg,#fcf8ee,#f2ead7);border:1px solid #cdbf9f;overflow:hidden;box-sizing:border-box;flex:none}
.dm-tile.h{flex-direction:row}
.dm-tile.v{flex-direction:column}
.dol-chain .dm-tile{width:62px;height:31px;box-shadow:0 4px 0 #b0a586,0 9px 11px rgba(0,0,0,.45),inset 0 1px 2px rgba(255,255,255,.9),inset 0 -2px 3px rgba(0,0,0,.12)}
.dol-hand .dm-tile{width:42px;height:84px;box-shadow:0 6px 0 #b0a586,0 12px 15px rgba(0,0,0,.5),inset 0 1px 2px #fff,inset 0 -2px 4px rgba(0,0,0,.12);transition:transform .15s}
.dm-half{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr)}
.dm-tile.h .dm-half{width:50%;height:100%}
.dm-tile.v .dm-half{width:100%;height:50%}
.dm-tile.h .dm-half:first-child{border-right:1.4px solid rgba(50,40,25,.42)}
.dm-tile.v .dm-half:first-child{border-bottom:1.4px solid rgba(50,40,25,.42)}
.dm-half>span{display:flex;align-items:center;justify-content:center}
.dm-pip{flex:0 0 auto;border-radius:50%;background:radial-gradient(circle at 38% 32%,#636363,#0a0a0a 78%);box-shadow:inset 0 1px 1px rgba(0,0,0,.9),inset 0 -1px 1px rgba(255,255,255,.22)}
.dol-chain .dm-pip{width:6px;height:6px}
.dol-hand .dm-pip{width:9px;height:9px}
.dol-hand .dm-tile.play{cursor:pointer;transform:translateY(-9px);box-shadow:0 6px 0 #b0a586,0 14px 17px rgba(0,0,0,.5),0 0 0 2.5px #f1c95c,0 0 14px rgba(241,201,92,.6),inset 0 1px 2px #fff}
.dol-hand .dm-tile.dim{opacity:.5}
@keyframes dm-drop{0%{opacity:0;transform:translateY(-30px) scale(1.10)}65%{opacity:1}100%{opacity:1;transform:translateY(0) scale(1)}}
.dm-tile.drop{animation:dm-drop .34s cubic-bezier(.22,1.15,.36,1)}
.dm-tile.last{filter:drop-shadow(0 0 5px rgba(241,201,92,.95)) drop-shadow(0 0 2px rgba(241,201,92,.9));z-index:3}
.dol-back{position:relative;display:flex;align-items:center;justify-content:center;width:30px;height:18px;border-radius:4px;background:linear-gradient(152deg,#114730,#0a2c1d);border:1px solid #c9a24a;box-shadow:0 3px 0 #06231a}
.dol-back i{width:9px;height:9px;background:#c9a24a;opacity:.6;transform:rotate(45deg);border-radius:2px}
`

// ════════════════════════════════════════════════════════
// רכיב ראשי
// ════════════════════════════════════════════════════════
export default function DominoOnline({ mode, numPlayers = 4, initialRoomId, onBack, onHome, onExit, autoInviteFriend = null }) {
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
// Lobby
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
        const { roomId } = await findOrCreateDominoMatch({ player: me, maxPlayers: numPlayers })
        onReady(roomId)
      } catch (e) {
        console.error('domino match error:', e)
        setErrorMsg('לא הצלחנו למצוא משחק — נסו שוב')
        setPhase('error')
      }
    })()
  }, [mode]) // eslint-disable-line

  useEffect(() => {
    if (phase !== 'searching') return
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  const inviteFriend = async (friend) => {
    if (!me.uid) return
    setErrorMsg('')
    try {
      const { roomId } = await createDominoRoom({ host: me, roomType: 'private' })
      await sendGameInvite({ from: me, to: { uid: friend.otherUid, name: friend.otherName }, gameType: 'domino', roomId })
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
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg,#0e4a31,#0a3624)', color: 'white', display: 'flex', flexDirection: 'column', padding: '32px 24px 28px', direction: 'rtl', zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={onBack} style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.12)', color: 'white', border: 'none', fontSize: 22, cursor: 'pointer' }}>←</button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
          <GameIcon id="domino" size={84} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Suez One', serif" }}>מחפש לך יריבים...</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 16, opacity: 0.85, marginTop: 8 }}><IconHourglass size={16} color="white" /> {formatTime(elapsed)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.10)', borderRadius: 16, padding: '14px 18px', fontSize: 15, textAlign: 'center', lineHeight: 1.5, maxWidth: 320 }}>כשעוד שחקנים ילחצו על "דומינו"<br />תתחברו לאותו שולחן</div>
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
  const [onlineMap, setOnlineMap] = useState({})
  const [profileMap, setProfileMap] = useState({})
  useEffect(() => {
    if (!friends || friends.length === 0) return
    const unsubs = friends.map((f) => {
      if (!f.otherUid) return null
      return watchUser(f.otherUid, (u) => {
        const seen = u?.lastSeenAt
        const seenMs = seen && typeof seen.toMillis === 'function' ? seen.toMillis() : 0
        const fresh = seenMs && (Date.now() - seenMs) < 2 * 60 * 1000
        const isOnline = Boolean(fresh) && ['available', 'busy'].includes(u?.status)
        setOnlineMap((prev) => ({ ...prev, [f.otherUid]: isOnline }))
        const fullName = [u?.name, u?.lastName].filter(Boolean).join(' ')
        setProfileMap((prev) => ({ ...prev, [f.otherUid]: { name: fullName, photoURL: u?.photoURL || null } }))
      })
    })
    return () => unsubs.forEach((u) => u && u())
  }, [friends])

  if (!friends || friends.length === 0) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '36px 24px', textAlign: 'center' }}>
        <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}><IconGroup size={68} /></div>
        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>אין לך עדיין חברים ברשימה</div>
        <div style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 20 }}>הוסיפו חברים בקפה או בפרלמנט — ואז תוכלו להזמין אותם למשחק.</div>
        <button onClick={onBack} className="big-btn big-btn--ghost" style={{ width: '100%' }}>חזרה</button>
      </div>
    )
  }
  const onlineFriends = friends.filter((f) => onlineMap[f.otherUid])
  const offlineFriends = friends.filter((f) => !onlineMap[f.otherUid])
  return (
    <>
      <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 6px', color: 'var(--ink)' }}>הזמינו חברים לשולחן</h2>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 14 }}>אפשר להזמין עד 3 חברים. כשהם יצטרפו — תתחילו לשחק.</div>
      {onlineFriends.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--success)', margin: '4px 2px 8px', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} /> מחוברים עכשיו ({onlineFriends.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {onlineFriends.map((f) => <FriendRow key={f.docId} friend={f} profile={profileMap[f.otherUid]} online onInvite={() => onInvite(f)} />)}
          </div>
        </>
      )}
      {offlineFriends.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink-3)', margin: '4px 2px 8px', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--ink-3)', display: 'inline-block' }} /> לא מחוברים ({offlineFriends.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {offlineFriends.map((f) => <FriendRow key={f.docId} friend={f} profile={profileMap[f.otherUid]} online={false} onInvite={() => onInvite(f)} />)}
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
        <div style={{ fontSize: 13, fontWeight: 700, color: online ? 'var(--success)' : 'var(--ink-3)' }}>{online ? 'מחובר עכשיו' : 'לא מחובר'}</div>
      </div>
      <button onClick={onInvite} style={{ background: online ? 'var(--success)' : 'var(--burgundy)', color: 'white', border: 'none', borderRadius: 12, padding: '11px 16px', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconGamepad size={16} color="white" /> הזמן</span></button>
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
    if (!joinedRef.current) { joinedRef.current = true; joinDominoRoom(roomId, me).catch(() => {}) }
    const unsub = watchDominoRoom(roomId, (data) => { if (!data) { setError('המשחק נסגר'); return } setRoom(data) })
    return () => unsub && unsub()
  }, [roomId])

  if (error) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg,#0e4a31,#0a3624)', minHeight: '100%' }}>
        <div className="screen-header" style={{ background: 'transparent' }}><button className="screen-header__back" onClick={onExit}><IconBackRTL size={24} color="#fff" /></button><div className="screen-header__title" style={{ color: '#fff' }}>דומינו</div></div>
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
    return <div style={{ direction: 'rtl', background: 'linear-gradient(180deg,#0e4a31,#0a3624)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f4e3b2', fontSize: 17 }}>טוען...</div>
  }
  if (room.status === 'waiting') return <WaitingRoom room={room} roomId={roomId} me={me} onBack={onBack} onHome={onHome} />
  return <OnlineGame room={room} roomId={roomId} me={me} onBack={onBack} onHome={onHome} />
}

// ════════════════════════════════════════════════════════
// חדר המתנה
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
    try { await sendGameInvite({ from: me, to: { uid: friend.otherUid, name: friend.otherName }, gameType: 'domino', roomId }) }
    catch (e) { console.error('invite more error:', e) }
  }
  const handleStart = async () => {
    if (startedRef.current) return
    startedRef.current = true
    const state = initDomino(players.map((p) => ({ id: p.uid, name: p.name })))
    await startDominoGame(roomId, state)
  }
  useEffect(() => {
    if (isRandom && isHost && players.length >= maxPlayers && !startedRef.current) handleStart()
  }, [isRandom, isHost, players.length, maxPlayers]) // eslint-disable-line
  const handleLeave = async () => { if (isHost) await leaveDominoRoom(roomId); onBack() }

  return (
    <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg,#0e4a31,#0a3624)', minHeight: '100%' }}>
      <div className="screen-header" style={{ background: 'transparent' }}>
        <button className="screen-header__back" onClick={handleLeave}><IconBackRTL size={24} color="#fff" /></button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title" style={{ color: '#f4e3b2' }}>חדר המתנה</div>
      </div>
      <div style={{ padding: '20px 16px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><GameIcon id="domino" size={56} /></div>
          <div className="h-display" style={{ fontSize: 22, color: '#f1c95c' }}>
            {isRandom ? `ממתינים לשחקנים (${players.length}/${maxPlayers})` : (isHost ? 'מחכים לשחקנים' : 'הצטרפת לשולחן')}
          </div>
          {isRandom && <div style={{ marginTop: 8, fontSize: 14, color: '#eaf6ef', opacity: .85 }}>{players.length >= maxPlayers ? 'מתחילים… 🎉' : 'המשחק יתחיל אוטומטית כשיצטרפו מספיק אנשים'}</div>}
        </div>

        <ProfilesProvider uids={players.map((p) => p.uid)} myUid={me.uid}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {players.map((p) => <WaitPlayer key={p.uid} p={p} meUid={me.uid} hostUid={room.hostUid} />)}
            {Array.from({ length: maxPlayers - players.length }).map((_, i) => {
              const isInviteSlot = canInviteMore && i === 0
              return (
                <div key={`empty-${i}`} onClick={isInviteSlot ? () => setShowInvite(true) : undefined} style={{ display: 'flex', alignItems: 'center', gap: 12, background: isInviteSlot ? 'rgba(13,74,49,.6)' : 'rgba(13,74,49,.3)', border: isInviteSlot ? '1px solid #c9a24a' : '1px dashed rgba(201,162,74,.4)', borderRadius: 14, padding: '12px 16px', color: isInviteSlot ? '#eaf6ef' : 'rgba(234,246,239,.5)', cursor: isInviteSlot ? 'pointer' : 'default' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: isInviteSlot ? '#f1c95c' : 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: isInviteSlot ? '#0e3a26' : 'inherit' }}>＋</div>
                  <div style={{ fontSize: 15, fontWeight: isInviteSlot ? 800 : 400 }}>{isInviteSlot ? 'הזמן עוד חבר' : 'ממתין לשחקן…'}</div>
                </div>
              )
            })}
          </div>
        </ProfilesProvider>

        {isRandom ? (
          <div style={{ textAlign: 'center', color: '#eaf6ef', fontSize: 15, padding: '12px' }}>⏳ מחפשים עוד שחקנים…</div>
        ) : isHost ? (
          <>
            <button onClick={canStart ? handleStart : undefined} disabled={!canStart} className="dol-actbtn" style={{ width: '100%', opacity: canStart ? 1 : .5 }}>{canStart ? `✓ התחל משחק (${players.length})` : 'צריך לפחות 2 שחקנים'}</button>
            <div style={{ height: 10 }} />
            <div style={{ fontSize: 13, color: '#eaf6ef', textAlign: 'center', opacity: .8 }}>אפשר להתחיל מ-2 שחקנים, או לחכות לעוד (עד 4)</div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: '#eaf6ef', fontSize: 15, padding: '12px' }}>⏳ מחכים שהמארח יתחיל את המשחק…</div>
        )}
      </div>
      <style>{`.dol-actbtn{border:none;cursor:pointer;font-family:inherit;font-weight:bold;color:#3a2a08;padding:13px 20px;border-radius:13px;background:linear-gradient(#ecca7e,#c99f44);box-shadow:0 4px 0 #8a6a22;font-size:16px}`}</style>
      {showInvite && <InvitePicker me={me} players={players} onClose={() => setShowInvite(false)} onInvite={handleInviteMore} />}
    </div>
  )
}

function WaitPlayer({ p, meUid, hostUid }) {
  const { name, photoURL } = usePlayerProfile(p.uid, p.name)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(13,74,49,.6)', border: '1px solid #c9a24a', borderRadius: 14, padding: '12px 16px' }}>
      <Avatar name={name} size={42} photoURL={photoURL} />
      <div style={{ flex: 1, fontFamily: "'Suez One', serif", fontSize: 17, color: '#eaf6ef' }}>{name}{p.uid === meUid ? ' (אתה)' : ''}</div>
      {p.uid === hostUid && <span style={{ fontSize: 12, color: '#f1c95c', fontWeight: 800 }}>מארח</span>}
    </div>
  )
}

function InvitePicker({ me, players, onInvite, onClose }) {
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(10,20,14,.72)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', direction: 'rtl' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, maxHeight: '72vh', overflowY: 'auto', padding: '20px 18px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="h-display" style={{ fontSize: 20, color: 'var(--ink)' }}>הזמן חבר לשולחן</div>
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

// ════════════════════════════════════════════════════════
// כרטיס שחקן בפס (עם וידאו)
// ════════════════════════════════════════════════════════
function PlayerCard({ p, idx, state, meUid, compact }) {
  const { name } = usePlayerProfile(p.id, p.name)
  const isActive = idx === state.turn && state.phase === 'play'
  const count = (state.hands[p.id] || []).length
  const avatarSize = compact ? 30 : 36
  const ctrlSize = compact ? 24 : 26
  return (
    <div className={'dol-pcard' + (isActive ? ' on' : '')}>
      <PlayerVideo uid={p.id} name={name} size={avatarSize} />
      <div className="dol-pname">{name}{p.id === meUid ? ' (אתה)' : ''}</div>
      <div className="dol-pcount">{count} אבנים</div>
      <div style={{ marginTop: 1, paddingTop: 4, width: '100%', borderTop: '1px solid rgba(201,162,74,.18)', display: 'flex', justifyContent: 'center' }}>
        {p.id === meUid ? <VideoControls size={ctrlSize} /> : <RemoteVideoToggles uid={p.id} size={ctrlSize} />}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// המשחק המסונכרן
// ════════════════════════════════════════════════════════
function OnlineGame({ room, roomId, me, onBack, onHome }) {
  const state = room.gameStateJson ? JSON.parse(room.gameStateJson) : null
  const [pending, setPending] = useState(null)   // אבן שמתאימה לשני הקצוות → בחירת צד
  const [videoChoice, setVideoChoice] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [musicMenu, setMusicMenu] = useState(false)
  const [muted, setMutedState] = useState(isMuted())

  // ── מוזיקה ──
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem('beyahad_domino_music') !== 'off' } catch { return true } })
  const [trackIdx, setTrackIdx] = useState(() => Math.floor(Math.random() * MUSIC_TRACKS.length))
  const [musicVol, setMusicVol] = useState(0.10)
  const audioRef = useRef(null)
  const nextTrack = () => setTrackIdx((i) => { if (MUSIC_TRACKS.length <= 1) return i; let n = i; while (n === i) n = Math.floor(Math.random() * MUSIC_TRACKS.length); return n })
  const toggleMusic = () => setMusicOn((on) => { const n = !on; try { localStorage.setItem('beyahad_domino_music', n ? 'on' : 'off') } catch {} return n })
  useEffect(() => { const a = audioRef.current; if (!a) return; a.volume = musicVol; if (musicOn) a.play().catch(() => {}); else a.pause() }, [musicOn, trackIdx, musicVol])
  useEffect(() => { if (!musicOn) return; const kick = () => { const a = audioRef.current; if (a && a.paused && musicOn) a.play().catch(() => {}) }; window.addEventListener('pointerdown', kick); window.addEventListener('touchstart', kick); return () => { window.removeEventListener('pointerdown', kick); window.removeEventListener('touchstart', kick) } }, [musicOn])

  // ── התאמת זום ללוח ──
  const boardRef = useRef(null)
  const [fitScale, setFitScale] = useState(1)
  const snakeDimsRef = useRef({ w: 1, h: 1 })

  const myIndex = state ? state.players.findIndex((p) => p.id === me.uid) : -1
  const myHand = state && myIndex >= 0 ? (state.hands[me.uid] || []) : []
  const { l: leftEnd, r: rightEnd } = state ? lineEnds(state.line) : { l: null, r: null }
  const isMyTurn = state && state.turn === myIndex && state.phase === 'play'
  const winner = state && state.phase === 'ended' ? state.players[state.winner] : null

  const oi = state && state.openerKey ? Math.max(0, state.line.findIndex((t) => keyOf(t) === state.openerKey)) : 0
  const snake = state ? buildSnake2(state.line, 4, oi) : { placed: [], w: 1, h: 1 }
  snakeDimsRef.current = { w: snake.w, h: snake.h }
  const newestLi = state ? (state.lastSide === 'l' ? 0 : state.line.length - 1) : 0
  const newestKey = state && state.line.length ? keyOf(state.line[newestLi]) : ''

  useLayoutEffect(() => {
    const wrap = boardRef.current; if (!wrap) return
    const cw = wrap.clientWidth, ch = wrap.clientHeight
    const { w: iw, h: ih } = snakeDimsRef.current
    const s = Math.min(1, (cw - 12) / (iw || 1), (ch - 12) / (ih || 1))
    if (Math.abs(s - fitScale) > 0.015) setFitScale(s)
  }, [room.gameStateJson, videoChoice]) // eslint-disable-line

  if (!state || myIndex < 0) {
    return <div style={{ direction: 'rtl', background: 'linear-gradient(180deg,#0e4a31,#0a3624)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f4e3b2', fontSize: 17 }}>טוען את המשחק...</div>
  }

  if (videoChoice === null) {
    return (
      <div style={{ direction: 'rtl', background: 'linear-gradient(180deg,#0e4a31,#0a3624)', minHeight: '100%' }}>
        <div className="screen-header" style={{ background: 'transparent' }}><button className="screen-header__back" onClick={onBack}><IconBackRTL size={24} color="#fff" /></button><div className="screen-header__title" style={{ color: '#f4e3b2' }}>דומינו אונליין</div></div>
        <VideoConsentGate onDecide={(use) => setVideoChoice(use)} accent="#136441" accentDeep="#c9a24a" />
      </div>
    )
  }

  const playable = isMyTurn ? playableTiles(myHand, leftEnd, rightEnd) : []
  const playableIds = new Set(playable.map((t) => t.id))
  const mustDraw = isMyTurn && playable.length === 0
  const chatMsgs = room.chat || []

  const tapTile = (tile) => {
    if (!isMyTurn || winner) return
    const okL = fitsEnd(tile, leftEnd), okR = fitsEnd(tile, rightEnd)
    if (!okL && !okR) return
    if (okL && okR && leftEnd !== rightEnd) { setPending(tile); return }
    doPlay(tile, okR ? 'r' : 'l')
  }
  const doPlay = async (tile, side) => {
    setPending(null)
    playSound('step')
    await updateDominoState(roomId, applyPlay(state, myIndex, tile, side))
  }
  const doDraw = async () => { playSound('step'); await updateDominoState(roomId, applyDraw(state, myIndex)) }
  const doPass = async () => { await updateDominoState(roomId, applyPass(state, myIndex)) }
  const handleLeave = async () => { await leaveDominoRoom(roomId); onBack() }

  const statusText = winner ? (winner.id === me.uid ? 'ניצחת!' : `${winner.name} ניצח`) : (isMyTurn ? 'תורך' : (state.lastMsg || `תור ${state.players[state.turn].name}`))
  const compact = state.players.length >= 3

  return (
    <ProfilesProvider uids={state.players.map((p) => p.id)} myUid={me.uid}>
    <GameVideoProvider roomId={roomId} me={me} enabled={videoChoice !== null} startWithCam={videoChoice === true}>
    <div className="dol-scene">
      <style>{DOMINO_CSS}</style>
      <audio ref={audioRef} src={MUSIC_TRACKS[trackIdx]} onEnded={nextTrack} onCanPlay={() => { if (musicOn) audioRef.current?.play().catch(() => {}) }} style={{ display: 'none' }} />

      {/* סרגל עליון */}
      <div className="dol-top">
        <button className="dol-iconbtn" onClick={handleLeave} aria-label="יציאה"><span style={{ fontSize: 16, fontWeight: 900, color: '#1c1c1c' }}>✕</span></button>
        <div className="dol-title">דומינו</div>
        <div style={{ flex: 1 }} />
        {/* בריכה */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#eaf6ef', fontSize: 13, fontWeight: 700 }}>
          <div className="dol-back"><i /></div>{state.boneyard.length}
        </div>
        {/* צ'אט */}
        <button className="dol-iconbtn" onClick={() => setChatOpen(true)} aria-label="צ'אט" style={{ background: '#0f3f28', borderColor: '#0a2c1d', position: 'relative' }}>
          <IconChatLine size={18} color="#f4e3b2" />
          {chatMsgs.filter((m) => m.uid !== me.uid).length > 0 && !chatOpen && <span style={{ position: 'absolute', top: -4, insetInlineStart: -4, width: 10, height: 10, borderRadius: '50%', background: '#E8484F', border: '2px solid #0e4a31' }} />}
        </button>
        {/* מוזיקה */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMusicMenu((o) => !o)} className="dol-iconbtn" aria-label="מוזיקה" style={{ background: '#0f3f28', borderColor: '#0a2c1d' }}><IcMusic size={18} color="#f4e3b2" /></button>
          {musicMenu && (
            <>
              <div onClick={() => setMusicMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
              <div style={{ position: 'absolute', top: '112%', insetInlineEnd: 0, background: 'rgba(15,28,42,.97)', border: '1px solid rgba(255,255,255,.22)', borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', gap: 4, whiteSpace: 'nowrap', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,.45)', minWidth: 184 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 8px' }}>
                  <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>עוצמה</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setMusicVol((v) => Math.max(0.02, +(v - 0.03).toFixed(2)))} style={dmVolBtn}>−</button>
                    <button onClick={() => { setMusicVol((v) => Math.min(0.6, +(v + 0.03).toFixed(2))); setMusicOn(true) }} style={dmVolBtn}>+</button>
                  </div>
                </div>
                <button onClick={nextTrack} style={dmMenuItem}><IcNext size={16} color="#fff" /> השיר הבא</button>
                <button onClick={toggleMusic} style={dmMenuItem}>{musicOn ? <IcMusicOff size={16} color="#fff" /> : <IcMusic size={16} color="#fff" />} {musicOn ? 'השתקת מוזיקה' : 'הפעלת מוזיקה'}</button>
                <button onClick={() => { const m = !muted; setMuted(m); setMutedState(m) }} style={dmMenuItem}>{muted ? <IcSoundOff size={16} color="#fff" /> : <IcSound size={16} color="#fff" />} {muted ? 'הפעלת סאונד' : 'השתקת סאונד'}</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* פס שחקנים עם וידאו */}
      <div className="dol-players">
        {state.players.map((p, i) => <PlayerCard key={p.id} p={p} idx={i} state={state} meUid={me.uid} compact={compact} />)}
      </div>

      {/* סטטוס */}
      <div className="dol-status">{statusText}</div>

      {/* לוח-נחש */}
      <div className="dol-boardwrap" ref={boardRef}>
        <div className="dol-chain" style={{ width: snake.w, height: snake.h, transform: `scale(${fitScale})` }}>
          {snake.placed.map((p) => {
            const k = keyOf(p.t)
            return <DTile key={k} a={p.dir === 'L' ? p.t.b : p.t.a} b={p.dir === 'L' ? p.t.a : p.t.b} vertical={p.dir === 'D'} cls={k === newestKey ? 'drop last' : ''} style={{ position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h }} />
          })}
        </div>
      </div>

      {/* בחירת צד */}
      {pending && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }} onClick={() => setPending(null)}>
          <div style={{ background: '#f6efdf', border: '3px solid #1c1c1c', borderRadius: 16, padding: 20, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 12, color: '#1c1c1c' }}>לאיזה צד להניח?</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="dol-actbtn" onClick={() => doPlay(pending, 'r')}>צד ימין ({rightEnd})</button>
              <button className="dol-actbtn" onClick={() => doPlay(pending, 'l')}>צד שמאל ({leftEnd})</button>
            </div>
          </div>
        </div>
      )}

      {/* היד שלי */}
      <div className="dol-hand">
        {myHand.map((t) => {
          const isPlay = playableIds.has(t.id)
          return <DTile key={t.id} a={t.a} b={t.b} vertical onClick={() => tapTile(t)} cls={isMyTurn ? (isPlay ? 'play' : 'dim') : ''} />
        })}
      </div>

      {/* משיכה / דילוג */}
      {mustDraw && !winner && (
        <button className="dol-actbtn" style={{ position: 'absolute', bottom: 16, insetInlineStart: 16, zIndex: 9 }} onClick={state.boneyard.length > 0 ? doDraw : doPass}>
          {state.boneyard.length > 0 ? 'משיכה מהבריכה (' + state.boneyard.length + ')' : 'דילוג'}
        </button>
      )}
      {!isMyTurn && !winner && (
        <div style={{ position: 'absolute', bottom: 18, insetInlineStart: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#eaf6ef', fontSize: 14, opacity: .85, zIndex: 9 }}><IconHourglass size={17} color="#f1c95c" /> ממתין לתורך…</div>
      )}

      {/* צ'אט */}
      <ChatToast msgs={chatMsgs} meUid={me.uid} suppressed={chatOpen} onOpen={() => setChatOpen(true)} />
      {chatOpen && <ChatPanel roomId={roomId} me={me} msgs={chatMsgs} onClose={() => setChatOpen(false)} sendFn={sendDominoChat} />}

      {/* סיום */}
      {winner && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: 'rgba(10,30,20,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: '30px 26px 22px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><IconTrophy size={64} color="#B89048" /></div>
            <div className="h-display" style={{ fontSize: 28, color: winner.id === me.uid ? '#4F6B4A' : '#B89048', marginBottom: 6 }}>{winner.id === me.uid ? 'ניצחת!' : `${winner.name} ניצח!`}</div>
            <div style={{ fontSize: 15, color: 'var(--ink-2)', marginBottom: 24, fontWeight: 600 }}>{state.reason === 'blocked' ? 'המשחק נחסם — הוכרע לפי פחות נקודות' : 'נפטר מכל האבנים ראשון!'}</div>
            <button onClick={handleLeave} className="big-btn big-btn--primary" style={{ width: '100%' }}>חזרה לזירה</button>
          </div>
        </div>
      )}
    </div>
    </GameVideoProvider>
    </ProfilesProvider>
  )
}
