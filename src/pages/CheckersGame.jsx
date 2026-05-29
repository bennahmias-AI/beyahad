// src/pages/CheckersGame.jsx
// ─────────────────────────────────────────────────────────────
// משחק "דמקה" (Checkers) — חוקים ישראליים.
//
// חוקים:
//   • לוח 8×8, 12 כלים לכל צד על המשבצות הכהות.
//   • חייל זז באלכסון קדימה משבצת אחת.
//   • אכילה חובה — אם אפשר לאכול, חייבים.
//   • חייל אוכל לכל הכיוונים (קדימה ואחורה).
//   • רצף אכילות — אם אחרי אכילה אפשר לאכול שוב, ממשיכים.
//   • מלכה ("עפה") זזה ואוכלת לאורך כל האלכסון.
//   • הכתרה: חייל שמגיע לשורה האחרונה הופך למלכה.
//   • ניצחון: ליריב אין כלים או אין מהלך חוקי.
//
// 4 מצבי משחק (כמו 4 בשורה):
//   נגד המחשב (3 רמות) / שני שחקנים מקומי / רנדומלי אונליין / עם חבר.
//
// בנוי על אותה תשתית Firestore של gameRooms — לכן הזמנות חברים,
// matchmaking רנדומלי, חלונית ההזמנה ו"שחק שוב" ההדדי עובדים מיד.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { IconBackRTL } from '../icons/index.jsx'
import { GameIcon } from '../icons/gameIcons.jsx'
import { useUserStore } from '../stores/userStore.js'
import {
  createGameRoom, joinGameRoom, watchGameRoom,
  updateGameState, updateGameRoom, leaveGameRoom, findOrCreateMatch,
  watchFriendships, sendGameInvite, watchInvite, deleteGameInvite,
  watchUser,
} from '../services/firebase.js'
import { playSound, isMuted, setMuted } from '../utils/gameSounds.js'
import Avatar from '../components/Avatar.jsx'
import GameSocialBar from '../components/GameChat.jsx'

// ── קבועים ─────────────────────────────────────────────
const SIZE = 8
const P1 = 1   // שחקן 1 — כלים בהירים (זהב), למטה, זז כלפי מעלה (dr=-1)
const P2 = 2   // שחקן 2 — כלים כהים, למעלה, זז כלפי מטה (dr=+1)
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
const NO_PROGRESS_LIMIT = 50  // מהלכים ללא אכילה/הכתרה → תיקו

const idx = (r, c) => r * SIZE + c
const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE
const other = (p) => (p === P1 ? P2 : P1)

// ════════════════════════════════════════════════════════
// מנוע המשחק — פונקציות טהורות
// ════════════════════════════════════════════════════════

// לוח 2D: כל תא null או { p: 1|2, k: boolean }
function initialBoard() {
  const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 !== 1) continue           // כלים רק על משבצות כהות
      if (r < 3) b[r][c] = { p: P2, k: false }   // שלוש שורות עליונות — שחקן 2
      else if (r > 4) b[r][c] = { p: P1, k: false } // שלוש שורות תחתונות — שחקן 1
    }
  }
  return b
}

function cloneBoard(b) {
  return b.map(row => row.map(cell => (cell ? { p: cell.p, k: cell.k } : null)))
}

// Firestore לא תומך במערכים מקוננים — לכן הלוח נשמר כמערך שטוח של 64 תאים
// (כל תא null או { p, k }), והמהלך האחרון כאינדקסים (לא זוגות מקוננים).
function boardToFlat(b) {
  const f = []
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) f.push(b[r][c] || null)
  return f
}
function flatToBoard(f) {
  if (!f || f.length !== SIZE * SIZE) return initialBoard()
  const b = []
  for (let r = 0; r < SIZE; r++) {
    const row = []
    for (let c = 0; c < SIZE; c++) {
      const cell = f[r * SIZE + c]
      row.push(cell ? { p: cell.p, k: cell.k } : null)
    }
    b.push(row)
  }
  return b
}

const wasCaptured = (caps, r, c) => caps.some(([cr, cc]) => cr === r && cc === c)

// כל מהלכי האכילה (רצפים מקסימליים) מתא נתון.
// כל רצף: { path: [[r,c],...], captures: [[r,c],...] }
function captureSequences(board, sr, sc, piece) {
  const results = []
  const enemy = other(piece.p)

  function recurse(b, r, c, pc, path, caps) {
    let extended = false

    if (pc.k) {
      // מלכה עפה — סורקת לאורך כל אלכסון
      for (const [dr, dc] of DIAG) {
        let i = 1
        while (inBounds(r + dr * i, c + dc * i) && b[r + dr * i][c + dc * i] === null) i++
        const er = r + dr * i, ec = c + dc * i
        if (!inBounds(er, ec)) continue
        const target = b[er][ec]
        if (target && target.p === enemy && !wasCaptured(caps, er, ec)) {
          let j = 1
          while (inBounds(er + dr * j, ec + dc * j) && b[er + dr * j][ec + dc * j] === null) {
            const lr = er + dr * j, lc = ec + dc * j
            extended = true
            const nb = cloneBoard(b)
            nb[r][c] = null
            nb[er][ec] = null
            nb[lr][lc] = pc
            recurse(nb, lr, lc, pc, [...path, [lr, lc]], [...caps, [er, ec]])
            j++
          }
        }
      }
    } else {
      // חייל — אוכל לכל ארבעת הכיוונים (סגנון ישראלי)
      for (const [dr, dc] of DIAG) {
        const mr = r + dr, mc = c + dc       // הכלי הנאכל
        const lr = r + dr * 2, lc = c + dc * 2 // נחיתה
        if (!inBounds(lr, lc)) continue
        const mid = inBounds(mr, mc) ? b[mr][mc] : null
        if (mid && mid.p === enemy && !wasCaptured(caps, mr, mc) && b[lr][lc] === null) {
          extended = true
          // הכתרה תוך כדי רצף — ממשיך לאכול כמלכה
          let np = pc
          if (!pc.k && ((pc.p === P1 && lr === 0) || (pc.p === P2 && lr === SIZE - 1))) {
            np = { p: pc.p, k: true }
          }
          const nb = cloneBoard(b)
          nb[r][c] = null
          nb[mr][mc] = null
          nb[lr][lc] = np
          recurse(nb, lr, lc, np, [...path, [lr, lc]], [...caps, [mr, mc]])
        }
      }
    }

    if (!extended && caps.length > 0) {
      results.push({ path, captures: caps })
    }
  }

  recurse(board, sr, sc, piece, [[sr, sc]], [])
  return results
}

// מהלכים פשוטים (ללא אכילה) מתא נתון
function simpleMoves(board, r, c, pc) {
  const moves = []
  if (pc.k) {
    for (const [dr, dc] of DIAG) {
      let i = 1
      while (inBounds(r + dr * i, c + dc * i) && board[r + dr * i][c + dc * i] === null) {
        moves.push({ path: [[r, c], [r + dr * i, c + dc * i]], captures: [] })
        i++
      }
    }
  } else {
    const dirs = pc.p === P1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc
      if (inBounds(nr, nc) && board[nr][nc] === null) {
        moves.push({ path: [[r, c], [nr, nc]], captures: [] })
      }
    }
  }
  return moves
}

// כל המהלכים החוקיים לשחקן. אכילה חובה: אם קיימת אכילה — רק אכילות חוקיות.
function getAllMoves(board, player) {
  const captures = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const pc = board[r][c]
      if (pc && pc.p === player) captures.push(...captureSequences(board, r, c, pc))
    }
  }
  if (captures.length) return captures

  const simples = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const pc = board[r][c]
      if (pc && pc.p === player) simples.push(...simpleMoves(board, r, c, pc))
    }
  }
  return simples
}

// מחיל מהלך נבחר ומחזיר לוח חדש (כולל הסרת נאכלים והכתרה)
function applyMove(board, move) {
  const nb = cloneBoard(board)
  const [fr, fc] = move.path[0]
  const [tr, tc] = move.path[move.path.length - 1]
  const piece = nb[fr][fc]
  nb[fr][fc] = null
  for (const [cr, cc] of move.captures) nb[cr][cc] = null
  // הכתרה אם הכלי נגע בשורה האחורית במהלך התנועה
  const touchedBack = move.path.some(([r], i) =>
    i > 0 && ((piece.p === P1 && r === 0) || (piece.p === P2 && r === SIZE - 1)))
  const np = (!piece.k && touchedBack) ? { p: piece.p, k: true } : piece
  nb[tr][tc] = np
  return nb
}

function countPieces(board, player) {
  let n = 0
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (board[r][c] && board[r][c].p === player) n++
  }
  return n
}

// מחשב את המצב אחרי מהלך: לוח, מנצח, מונה חוסר-התקדמות
function nextStateAfterMove(board, move, player, noProgress) {
  const newBoard = applyMove(board, move)
  const opp = other(player)
  // האם המהלך "התקדמותי" (אכילה או הכתרה)?
  const [fr, fc] = move.path[0]
  const movedWasMan = board[fr][fc] && !board[fr][fc].k
  const becameKing = movedWasMan && (newBoard[move.path[move.path.length - 1][0]][move.path[move.path.length - 1][1]]?.k)
  const progressed = move.captures.length > 0 || becameKing
  const np = progressed ? 0 : noProgress + 1

  let winner = null
  if (countPieces(newBoard, opp) === 0) winner = (player === P1 ? 'P1' : 'P2')
  else if (getAllMoves(newBoard, opp).length === 0) winner = (player === P1 ? 'P1' : 'P2')
  else if (np >= NO_PROGRESS_LIMIT) winner = 'draw'

  return { newBoard, winner, noProgress: np }
}

// ════════════════════════════════════════════════════════
// AI — 3 רמות קושי
// ════════════════════════════════════════════════════════

function evalBoard(board, forPlayer) {
  // חיובי = טוב ל-forPlayer
  let score = 0
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const pc = board[r][c]
      if (!pc) continue
      let v = pc.k ? 200 : 100
      // בונוס התקדמות לחיילים (קרוב להכתרה)
      if (!pc.k) {
        const adv = pc.p === P1 ? (SIZE - 1 - r) : r  // כמה התקדם
        v += adv * 4
      }
      // בונוס שמירה על שורה אחורית
      if (!pc.k) {
        if ((pc.p === P1 && r === SIZE - 1) || (pc.p === P2 && r === 0)) v += 6
      }
      // בונוס מרכז קטן
      if (c >= 2 && c <= 5) v += 2
      score += pc.p === forPlayer ? v : -v
    }
  }
  return score
}

function minimax(board, turn, depth, alpha, beta, aiPlayer) {
  const moves = getAllMoves(board, turn)
  if (depth === 0 || moves.length === 0) {
    // אם אין מהלך — תבוסה לצד שתורו
    if (moves.length === 0) {
      return turn === aiPlayer ? -100000 - depth : 100000 + depth
    }
    return evalBoard(board, aiPlayer)
  }
  if (turn === aiPlayer) {
    let best = -Infinity
    for (const m of moves) {
      const nb = applyMove(board, m)
      const val = minimax(nb, other(turn), depth - 1, alpha, beta, aiPlayer)
      if (val > best) best = val
      alpha = Math.max(alpha, best)
      if (alpha >= beta) break
    }
    return best
  } else {
    let best = Infinity
    for (const m of moves) {
      const nb = applyMove(board, m)
      const val = minimax(nb, other(turn), depth - 1, alpha, beta, aiPlayer)
      if (val < best) best = val
      beta = Math.min(beta, best)
      if (alpha >= beta) break
    }
    return best
  }
}

function chooseAIMove(board, aiPlayer, difficulty) {
  const moves = getAllMoves(board, aiPlayer)
  if (moves.length === 0) return null
  if (moves.length === 1) return moves[0]

  if (difficulty === 'easy') {
    return moves[Math.floor(Math.random() * moves.length)]
  }

  const depth = difficulty === 'hard' ? 5 : 1
  let best = null, bestVal = -Infinity
  // ערבוב קל כדי שלא ישחק זהה כל פעם
  const shuffled = [...moves].sort(() => Math.random() - 0.5)
  for (const m of shuffled) {
    const nb = applyMove(board, m)
    const val = difficulty === 'hard'
      ? minimax(nb, other(aiPlayer), depth - 1, -Infinity, Infinity, aiPlayer)
      : evalBoard(nb, aiPlayer)
    if (val > bestVal) { bestVal = val; best = m }
  }
  return best || moves[0]
}

// ════════════════════════════════════════════════════════
// קומפוננטה ראשית
// ════════════════════════════════════════════════════════
export default function CheckersGame({ onBack, initialRoomId }) {
  const [mode, setMode] = useState(initialRoomId ? 'online-friend' : null)
  const [difficulty, setDifficulty] = useState('medium')
  const [roomId, setRoomId] = useState(initialRoomId || null)

  // הגענו דרך אישור הזמנה — נכנסים ישר לחדר
  useEffect(() => {
    if (initialRoomId) {
      setMode('online-friend')
      setRoomId(initialRoomId)
    }
  }, [initialRoomId])

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
    if (!roomId) {
      return (
        <OnlineLobby
          mode={mode}
          onBack={() => setMode(null)}
          onReady={(id) => setRoomId(id)}
        />
      )
    }
    return (
      <OnlineGameScreen
        roomId={roomId}
        onBack={() => { setRoomId(null); setMode(null) }}
        onExit={onBack}
        onFindOther={() => { setRoomId(null); setMode('online-random') }}
      />
    )
  }

  return (
    <LocalGameScreen
      mode={mode}
      difficulty={difficulty}
      onBack={() => setMode(null)}
      onExit={onBack}
    />
  )
}

// ════════════════════════════════════════════════════════
// מסך בחירת מצב
// ════════════════════════════════════════════════════════
function ModeSelectScreen({ onBack, onSelectAI, onSelectLocal, onSelectOnlineRandom, onSelectOnlineFriend }) {
  const [showDifficulty, setShowDifficulty] = useState(false)
  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <div className="screen-header__title">דמקה</div>
      </div>

      <div style={{ padding: '8px 20px 32px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #6B4427 0%, #4A2E18 100%)',
          borderRadius: 20, padding: '20px 18px',
          color: '#FBF7EE', marginBottom: 24,
          boxShadow: '0 8px 20px -6px rgba(74,46,24,.5)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>⚫ 🟡</div>
          <div className="h-display" style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 6 }}>
            דמקה
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'rgba(255,255,255,.92)' }}>
            אכלו את הכלים של היריב — מי שנתקע מפסיד
          </div>
        </div>

        {!showDifficulty ? (
          <>
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>
              בחרו איך לשחק:
            </h2>
            <ModeButton onClick={onSelectOnlineRandom} iconId="online-random"
              gradient="linear-gradient(135deg, #7E2C2E, #5A1D1E)"
              label="שחקן רנדומלי" description="שחקו עם מישהו אחר באפליקציה" badge="חדש" />
            <ModeButton onClick={onSelectOnlineFriend} iconId="online-friend"
              gradient="linear-gradient(135deg, #4F6B4A, #354D31)"
              label="שחק עם חבר" description="הזמינו חבר מרשימת החברים שלכם" badge="חדש" />
            <ModeButton onClick={() => setShowDifficulty(true)} iconId="vs-ai"
              gradient="linear-gradient(135deg, #2C5566, #173846)"
              label="נגד המחשב" description="משחק לבד בכל זמן" />
            <ModeButton onClick={onSelectLocal} iconId="local-2p"
              gradient="linear-gradient(135deg, #B89048, #8A6A2E)"
              label="שני שחקנים" description="על אותו מכשיר — אחד מול השני" />
          </>
        ) : (
          <>
            <button onClick={() => setShowDifficulty(false)} style={{
              background: 'none', border: 'none', padding: 0,
              color: 'var(--ink-2)', fontSize: 14, fontWeight: 700,
              fontFamily: 'inherit', cursor: 'pointer',
              marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <IconBackRTL size={18} color="#8389A4" /> חזרה
            </button>
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>
              בחרו רמת קושי:
            </h2>
            <DifficultyButton label="קל" emoji="🌱" color="#4F6B4A"
              description="מתאים להתחלה — המחשב משחק בפשטות"
              onClick={() => onSelectAI('easy')} />
            <DifficultyButton label="בינוני" emoji="⚡" color="#B89048"
              description="המחשב מחפש אכילות טובות"
              onClick={() => onSelectAI('medium')} />
            <DifficultyButton label="קשה" emoji="🔥" color="#7E2C2E"
              description="המחשב חושב כמה צעדים קדימה"
              onClick={() => onSelectAI('hard')} />
          </>
        )}
      </div>
    </div>
  )
}

function ModeButton({ onClick, iconId, gradient, label, description, badge }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'right',
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 18, padding: '16px 16px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 14,
      fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)',
      cursor: 'pointer', position: 'relative',
    }}>
      {badge && (
        <div style={{
          position: 'absolute', top: -8, insetInlineStart: 12,
          background: 'var(--burgundy)', color: 'white',
          fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 999,
        }}>✨ {badge}</div>
      )}
      <div style={{
        width: 52, height: 52, borderRadius: 14, background: gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <GameIcon id={iconId} size={36} />
      </div>
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
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'right',
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 16, padding: '14px 16px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 12,
      fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14, background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, flexShrink: 0,
      }}>{emoji}</div>
      <div style={{ flex: 1 }}>
        <div className="h-display" style={{ fontSize: 17, color: 'var(--ink)', lineHeight: 1.15 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginTop: 2 }}>{description}</div>
      </div>
      <IconBackRTL size={20} color="#8389A4" />
    </button>
  )
}

// ════════════════════════════════════════════════════════
// Lobby אונליין — חיבור לחדר (רנדומלי / חבר)
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
    startedRef.current = true
    startRandom()
    // eslint-disable-next-line
  }, [mode])

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
      if (roomToClean && !successfulMatchRef.current) {
        leaveGameRoom(roomToClean).catch(() => {})
      }
    }
    // eslint-disable-next-line
  }, [])

  const startRandom = async () => {
    if (!authUser?.uid) { setErrorMsg('צריך להיות מחובר כדי לשחק אונליין'); setPhase('error'); return }
    setErrorMsg('')
    try {
      const player = { uid: authUser.uid, name: profile?.name || 'משתמש' }
      const { roomId, isCreator } = await findOrCreateMatch({ gameType: 'checkers', player })
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
      } else {
        successfulMatchRef.current = true
        onReady(roomId)
      }
    } catch (e) {
      console.error('Checkers matchmaking error:', e)
      let msg = 'לא הצלחנו למצוא משחק — נסו שוב'
      if (e.code === 'permission-denied' || (e.message || '').includes('permission')) {
        msg = 'בעיה בהרשאות Firestore'
      }
      setErrorMsg(msg); setPhase('error')
    }
  }

  const inviteFriend = async (friend) => {
    if (!authUser?.uid) return
    setErrorMsg('')
    try {
      const player = { uid: authUser.uid, name: profile?.name || 'משתמש' }
      const { roomId } = await createGameRoom({ gameType: 'checkers', creator: player, roomType: 'private' })
      setCreatedRoomId(roomId)
      const newInviteId = await sendGameInvite({
        from: player,
        to: { uid: friend.otherUid, name: friend.otherName },
        gameType: 'checkers',
        roomId,
      })
      setInviteId(newInviteId)
      setInvitedFriend(friend)
      setPhase('waiting-for-friend')

      inviteUnsubRef.current = watchInvite(newInviteId, (data) => {
        if (!data) return
        if (data.status === 'declined') {
          setErrorMsg(`${friend.otherName} דחתה את ההזמנה`)
          setPhase('friend-declined')
          deleteGameInvite(newInviteId).catch(() => {})
          leaveGameRoom(roomId).catch(() => {})
        }
      })

      watchUnsubRef.current = watchGameRoom(roomId, (data) => {
        if (data && (data.status === 'playing' || (data.players || []).length === 2)) {
          successfulMatchRef.current = true
          if (watchUnsubRef.current) { watchUnsubRef.current(); watchUnsubRef.current = null }
          if (inviteUnsubRef.current) { inviteUnsubRef.current(); inviteUnsubRef.current = null }
          deleteGameInvite(newInviteId).catch(() => {})
          onReady(roomId)
        }
      })
    } catch (e) {
      console.error('inviteFriend error:', e)
      const detail = e?.code || e?.message || 'שגיאה לא ידועה'
      setErrorMsg('לא הצלחנו לשלוח הזמנה. פרטי השגיאה: ' + detail)
      setPhase('error')
    }
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
      <div style={{
        position: 'fixed', inset: 0,
        background: 'linear-gradient(180deg, #2A1C10 0%, #3A2818 100%)',
        color: 'white', display: 'flex', flexDirection: 'column',
        padding: '32px 24px 28px', direction: 'rtl', zIndex: 100,
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={onBack} style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'rgba(255,255,255,.12)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, border: 'none', cursor: 'pointer',
          }}>←</button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
          <div style={{ position: 'relative', width: 200, height: 200 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(255,255,255,.15)', animation: 'ckLobbyPulse 1.5s ease-out infinite' }} />
            <div style={{ position: 'absolute', inset: 20, borderRadius: '50%', border: '3px solid rgba(255,255,255,.10)', animation: 'ckLobbyPulse 1.5s ease-out 0.5s infinite' }} />
            <div style={{
              position: 'absolute', inset: 40, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #3A2A1E, #1C120A)',
              border: '4px solid #C9A85E',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56,
            }}>⚫</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Suez One', serif" }}>
              {phase === 'searching' ? 'מחפש לך יריב...' : 'מחכים ליריב...'}
            </div>
            <div style={{ fontSize: 16, opacity: 0.85, marginTop: 8 }}>⏱ {formatTime(elapsed)}</div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,.10)', borderRadius: 16, padding: '14px 18px',
            fontSize: 15, fontWeight: 500, textAlign: 'center', lineHeight: 1.5, maxWidth: 320,
          }}>
            💡 כשעוד מישהו ילחץ על "דמקה"<br />תתחבר אליו אוטומטית
          </div>
        </div>
        <button onClick={onBack} className="big-btn big-btn--danger" style={{ width: '100%' }}>✕ ביטול</button>
        <style>{`@keyframes ckLobbyPulse { 0% { transform: scale(0.9); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }`}</style>
      </div>
    )
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <div className="screen-header__title">{mode === 'online-random' ? 'שחקן רנדומלי' : 'שחק עם חבר'}</div>
      </div>
      <div style={{ padding: '20px 20px 32px' }}>
        {phase === 'friend-list' && (
          <FriendListScreen friends={friends} onInvite={inviteFriend} onGoFriends={onBack} />
        )}
        {phase === 'waiting-for-friend' && invitedFriend && (
          <WaitingForFriendScreen friendName={invitedFriend.otherName} onCancel={cancelInvite} />
        )}
        {phase === 'friend-declined' && (
          <CenteredCard emoji="😕" title="ההזמנה נדחתה" description={errorMsg || 'החבר לא הצטרף למשחק'}
            actionLabel="חזרה לרשימת החברים" onAction={() => setPhase('friend-list')} />
        )}
        {phase === 'error' && (
          <CenteredCard emoji="😕" title="משהו השתבש" description={errorMsg || 'נסו שוב'}
            actionLabel="חזרה" onAction={onBack} />
        )}
      </div>
    </div>
  )
}

function CenteredCard({ emoji, title, description, actionLabel, onAction }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20,
      padding: '32px 24px', textAlign: 'center', boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ fontSize: 56, marginBottom: 14 }}>{emoji}</div>
      <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.4, marginBottom: 18 }}>{description}</div>
      {actionLabel && (
        <button onClick={onAction} className="big-btn big-btn--primary" style={{ width: '100%' }}>{actionLabel}</button>
      )}
    </div>
  )
}

function FriendListScreen({ friends, onInvite, onGoFriends }) {
  if (!friends || friends.length === 0) {
    return (
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20,
        padding: '36px 24px', textAlign: 'center', boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ fontSize: 56, marginBottom: 14 }}>👥</div>
        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>אין לך עדיין חברים ברשימה</div>
        <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5, marginBottom: 20 }}>
          כשתדברו עם מישהו בקפה או בפרלמנט, תוכלו להוסיף אותו כחבר — ואז להזמין אותו למשחק.
        </div>
        <button onClick={onGoFriends} className="big-btn big-btn--ghost" style={{ width: '100%' }}>חזרה</button>
      </div>
    )
  }
  return (
    <>
      <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 6px', color: 'var(--ink)' }}>בחרו חבר להזמין</h2>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 14 }}>
        נשלח לו הזמנה למשחק — וכשהחבר יאשר, המשחק יתחיל
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {friends.map(f => <FriendInviteRow key={f.docId} friend={f} onInvite={() => onInvite(f)} />)}
      </div>
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
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16,
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <Avatar name={friend.otherName} size={50} online={online} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="h-display" style={{ fontSize: 17, color: 'var(--ink)' }}>{friend.otherName}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: online ? 'var(--success)' : 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          {online && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ADE80' }} />}
          {online ? 'מחובר עכשיו' : 'לא מחובר'}
        </div>
      </div>
      <button onClick={onInvite} style={{
        background: online ? 'var(--burgundy)' : 'var(--surface)',
        color: online ? 'white' : 'var(--ink)',
        border: online ? 'none' : '1px solid var(--line-strong)',
        borderRadius: 12, padding: '11px 16px', fontSize: 15, fontWeight: 800,
        fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
      }}>🎮 הזמן</button>
    </div>
  )
}

function WaitingForFriendScreen({ friendName, onCancel }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20,
      padding: '32px 24px', textAlign: 'center', boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ fontSize: 56, marginBottom: 14, animation: 'ckWaitPulse 1.6s ease-in-out infinite' }}>📨</div>
      <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>שלחנו הזמנה ל{friendName}</div>
      <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.4, marginBottom: 22 }}>מחכים שיאשר ויצטרף למשחק...</div>
      <button onClick={onCancel} className="big-btn big-btn--ghost" style={{ width: '100%' }}>ביטול ההזמנה</button>
      <style>{`@keyframes ckWaitPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }`}</style>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מסך משחק מקומי (מול המחשב / שני שחקנים)
// ════════════════════════════════════════════════════════
function LocalGameScreen({ mode, difficulty, onBack, onExit }) {
  const [board, setBoard] = useState(initialBoard)
  const [turn, setTurn] = useState(P1)
  const [winner, setWinner] = useState(null)
  const [selected, setSelected] = useState(null)   // [r,c]
  const [lastMove, setLastMove] = useState(null)    // {from:[r,c], to:[r,c], caps:[[r,c]...]}
  const [noProgress, setNoProgress] = useState(0)
  const [busy, setBusy] = useState(false)

  const isAITurn = mode === 'ai' && turn === P2 && !winner

  const legalMoves = getAllMoves(board, turn)

  const doMove = (move) => {
    playSound('drop')
    const { newBoard, winner: w, noProgress: np } = nextStateAfterMove(board, move, turn, noProgress)
    setBoard(newBoard)
    setLastMove({
      from: move.path[0],
      to: move.path[move.path.length - 1],
      caps: move.captures,
    })
    setNoProgress(np)
    setSelected(null)
    if (w) {
      setWinner(w)
      setTimeout(() => {
        if (mode === 'ai') playSound(w === 'P1' ? 'win' : 'lose')
        else playSound('win')
      }, 300)
    } else {
      setTurn(other(turn))
    }
  }

  // תור המחשב
  useEffect(() => {
    if (!isAITurn) return
    setBusy(true)
    const t = setTimeout(() => {
      const m = chooseAIMove(board, P2, difficulty)
      if (m) doMove(m)
      setBusy(false)
    }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line
  }, [isAITurn, board])

  const handleCellTap = (r, c) => {
    if (winner || busy || isAITurn) return
    const cell = board[r][c]
    // בחירת כלי משלי שיש לו מהלך
    const startsHere = legalMoves.filter(m => m.path[0][0] === r && m.path[0][1] === c)
    if (cell && cell.p === turn && startsHere.length) {
      setSelected([r, c])
      return
    }
    // לחיצה על יעד
    if (selected) {
      const opts = legalMoves.filter(m => m.path[0][0] === selected[0] && m.path[0][1] === selected[1]
        && m.path[m.path.length - 1][0] === r && m.path[m.path.length - 1][1] === c)
      if (opts.length) {
        // אם יש כמה רצפים לאותו יעד — בוחרים את זה שאוכל הכי הרבה
        opts.sort((a, b) => b.captures.length - a.captures.length)
        doMove(opts[0])
        return
      }
    }
    setSelected(null)
  }

  const reset = () => {
    setBoard(initialBoard())
    setTurn(P1); setWinner(null); setSelected(null); setLastMove(null); setNoProgress(0); setBusy(false)
  }

  const destinations = selected
    ? legalMoves.filter(m => m.path[0][0] === selected[0] && m.path[0][1] === selected[1])
        .map(m => m.path[m.path.length - 1])
    : []

  const statusText = (() => {
    if (winner === 'draw') return 'תיקו! 🤝'
    if (winner === 'P1') return mode === 'ai' ? 'ניצחת! 🎉' : 'שחקן 1 ניצח! 🎉'
    if (winner === 'P2') return mode === 'ai' ? 'המחשב ניצח 🤖' : 'שחקן 2 ניצח! 🎉'
    if (isAITurn) return 'המחשב חושב...'
    return mode === 'ai' ? 'תורך — בצע מהלך' : `תור שחקן ${turn === P1 ? '1' : '2'}`
  })()

  return (
    <GameLayout
      onBack={onBack}
      statusText={statusText}
      topName={mode === 'ai' ? 'מחשב' : 'שחקן 2'}
      topActive={turn === P2 && !winner}
      bottomName={mode === 'ai' ? 'אתה' : 'שחקן 1'}
      bottomActive={turn === P1 && !winner}
      board={board}
      selected={selected}
      destinations={destinations}
      lastMove={lastMove}
      onCellTap={handleCellTap}
      disabled={!!winner || busy}
      onReset={reset}
      onChangeMode={onBack}
      isOnline={false}
    >
      {winner && (
        <LocalEndModal mode={mode} winner={winner} onPlayAgain={reset} onExit={onExit} />
      )}
    </GameLayout>
  )
}

// ════════════════════════════════════════════════════════
// מסך משחק אונליין (סנכרון דרך Firestore)
// ════════════════════════════════════════════════════════
function OnlineGameScreen({ roomId, onBack, onExit, onFindOther }) {
  const { authUser, profile } = useUserStore()
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const lastMoveKeyRef = useRef(null)
  const finishedSoundRef = useRef(false)

  useEffect(() => {
    const unsub = watchGameRoom(roomId, (data) => {
      if (!data) { setError('היריב עזב את המשחק'); return }
      setRoom(data)
      const lm = data.gameState?.lastMove
      if (lm) {
        const key = `${lm.from}-${lm.to}-${(lm.caps || []).join(',')}`
        if (lastMoveKeyRef.current !== key) {
          lastMoveKeyRef.current = key
          playSound('drop')
        }
      }
    })
    return () => unsub && unsub()
  }, [roomId])

  useEffect(() => {
    return () => { if (room && room.status === 'ended') leaveGameRoom(roomId).catch(() => {}) }
  }, [roomId, room?.status])

  // ── נגזרים (לפני early returns) ──
  const myUid = authUser?.uid
  const me = (room?.players || []).find(p => p.uid === myUid)
  const opponent = (room?.players || []).find(p => p.uid !== myUid)
  const myColor = me?.color || 'P1'
  const myNum = myColor === 'P1' ? P1 : P2
  const gs = room?.gameState || {}
  const board = flatToBoard(gs.board)
  const turnColor = gs.currentTurn || 'P1'
  const turnNum = turnColor === 'P1' ? P1 : P2
  const winner = gs.winner
  const isMyTurn = turnColor === myColor && !winner
  const noProgress = gs.noProgress || 0

  const lm = gs.lastMove
  const lastMove = lm ? {
    from: [Math.floor(lm.from / SIZE), lm.from % SIZE],
    to: [Math.floor(lm.to / SIZE), lm.to % SIZE],
    caps: (lm.caps || []).map(i => [Math.floor(i / SIZE), i % SIZE]),
  } : null

  // rematch
  const oppColor = myColor === 'P1' ? 'P2' : 'P1'
  const rematch = room?.rematch || {}
  const iRequested = !!rematch[myColor]
  const oppRequested = !!rematch[oppColor]

  // סאונד סיום
  useEffect(() => {
    if (winner && !finishedSoundRef.current) {
      finishedSoundRef.current = true
      setTimeout(() => {
        if (winner === 'draw') playSound('lose')
        else playSound(winner === myColor ? 'win' : 'lose')
      }, 300)
    }
  }, [winner, myColor])

  useEffect(() => { if (!winner) finishedSoundRef.current = false }, [winner])

  // שני הצדדים אישרו "שחק שוב" — ה-host (P1) מאפס
  useEffect(() => {
    if (iRequested && oppRequested && myColor === 'P1') {
      finishedSoundRef.current = false
      lastMoveKeyRef.current = null
      updateGameRoom(roomId, {
        gameState: {
          board: boardToFlat(initialBoard()),
          currentTurn: 'P1',
          winner: null,
          lastMove: null,
          noProgress: 0,
        },
        rematch: { P1: false, P2: false },
      })
    }
  }, [iRequested, oppRequested, myColor, roomId])

  if (error) {
    return <OpponentLeftScreen onFindOther={onFindOther} onExit={onExit} />
  }
  if (!room) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl' }}>
        <div className="screen-header">
          <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
          <div className="screen-header__title">דמקה</div>
        </div>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-2)' }}>טוען...</div>
      </div>
    )
  }

  const legalMoves = isMyTurn ? getAllMoves(board, myNum) : []

  const handleCellTap = async (r, c) => {
    if (!isMyTurn) return
    const cell = board[r][c]
    const startsHere = legalMoves.filter(m => m.path[0][0] === r && m.path[0][1] === c)
    if (cell && cell.p === myNum && startsHere.length) { setSelected([r, c]); return }
    if (selected) {
      const opts = legalMoves.filter(m => m.path[0][0] === selected[0] && m.path[0][1] === selected[1]
        && m.path[m.path.length - 1][0] === r && m.path[m.path.length - 1][1] === c)
      if (opts.length) {
        opts.sort((a, b) => b.captures.length - a.captures.length)
        const move = opts[0]
        setSelected(null)
        const { newBoard, winner: w, noProgress: np } = nextStateAfterMove(board, move, myNum, noProgress)
        await updateGameState(roomId, {
          board: boardToFlat(newBoard),
          currentTurn: w ? turnColor : oppColor,
          winner: w,
          lastMove: {
            from: idx(move.path[0][0], move.path[0][1]),
            to: idx(move.path[move.path.length - 1][0], move.path[move.path.length - 1][1]),
            caps: move.captures.map(([cr, cc]) => idx(cr, cc)),
          },
          noProgress: np,
        })
        return
      }
    }
    setSelected(null)
  }

  const requestRematch = () => updateGameRoom(roomId, { [`rematch.${myColor}`]: true })
  const cancelRematch = () => updateGameRoom(roomId, { rematch: { P1: false, P2: false } })
  const handleFindOther = async () => { await leaveGameRoom(roomId).catch(() => {}); onFindOther && onFindOther() }
  const handleEnd = async () => { await leaveGameRoom(roomId).catch(() => {}); onExit && onExit() }
  // עזיבה רגילה (חזרה / עזוב משחק) — מוחק את החדר כדי שהיריב יקבל התראה
  const handleLeave = async () => { await leaveGameRoom(roomId).catch(() => {}); onBack && onBack() }

  const destinations = selected
    ? legalMoves.filter(m => m.path[0][0] === selected[0] && m.path[0][1] === selected[1])
        .map(m => m.path[m.path.length - 1])
    : []

  const statusText = (() => {
    if (winner === 'draw') return 'תיקו! 🤝'
    if (winner) return winner === myColor ? 'ניצחת! 🎉' : 'הפסדת 😕'
    return isMyTurn ? 'תורך — בצע מהלך' : `${opponent?.name || 'היריב'} משחק...`
  })()

  return (
    <GameLayout
      onBack={handleLeave}
      statusText={statusText}
      topName={opponent?.name || 'היריב'}
      topActive={turnColor === oppColor && !winner}
      bottomName={me?.name || 'אתה'}
      bottomActive={isMyTurn}
      board={board}
      selected={selected}
      destinations={destinations}
      lastMove={lastMove}
      onCellTap={handleCellTap}
      disabled={!isMyTurn || !!winner}
      onReset={requestRematch}
      onChangeMode={handleLeave}
      isOnline={true}
      socialBar={<GameSocialBar roomId={roomId} me={me} opponent={opponent} chat={room.chat || []} dark />}
    >
      {winner && (
        <OnlineEndModal
          result={winner === 'draw' ? 'draw' : (winner === myColor ? 'win' : 'lose')}
          opponentName={opponent?.name || 'היריב'}
          iRequested={iRequested} oppRequested={oppRequested}
          onRematch={requestRematch} onFindOther={handleFindOther} onEnd={handleEnd}
        />
      )}
      {!winner && (iRequested || oppRequested) && (
        <RematchPrompt opponentName={opponent?.name || 'היריב'} iRequested={iRequested}
          onConfirm={requestRematch} onCancel={cancelRematch} />
      )}
    </GameLayout>
  )
}

// ════════════════════════════════════════════════════════
// Layout משותף — כותרת, כרטיסי שחקנים, לוח, מגשים, כפתורים
// ════════════════════════════════════════════════════════
function GameLayout({
  onBack, statusText, topName, topActive, bottomName, bottomActive,
  board, selected, destinations, lastMove, onCellTap, disabled,
  onReset, onChangeMode, isOnline, socialBar, children,
}) {
  const [muted, setMutedState] = useState(() => isMuted())
  const toggleMute = () => { const n = !muted; setMutedState(n); setMuted(n) }

  // מונה כלים שנאכלו (12 מינוס מה שנשאר)
  const p1Left = countPieces(board, P1)
  const p2Left = countPieces(board, P2)
  const p1Captured = 12 - p2Left  // כמה כלים של P2 נאכלו (ע"י P1)
  const p2Captured = 12 - p1Left

  return (
    <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg, #3A2818 0%, #2A1C10 100%)' }}>
      <div className="screen-header" style={{ background: 'transparent' }}>
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#FBF7EE" />
        </button>
        <div className="screen-header__title" style={{ color: '#FBF7EE' }}>דמקה {isOnline ? 'אונליין' : ''}</div>
      </div>

      <div style={{ padding: '4px 16px 28px' }}>
        {/* כרטיס יריב (למעלה) */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
          <PlayerTag name={topName} active={topActive} dark />
        </div>

        {/* הלוח */}
        <CheckersBoard
          board={board}
          selected={selected}
          destinations={destinations}
          lastMove={lastMove}
          onCellTap={onCellTap}
          disabled={disabled}
        />

        {/* מגשי כלים שנאכלו */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, margin: '12px 2px',
        }}>
          <CapturedTray count={p1Captured} pieceColor="dark" label="אכלת" />
          <div style={{
            flex: 1, textAlign: 'center', color: '#F0E2C6',
            fontFamily: "'Suez One', serif", fontSize: 18, fontWeight: 800,
          }}>{statusText}</div>
          <CapturedTray count={p2Captured} pieceColor="light" label="נאכלו" />
        </div>

        {/* כרטיס "אתה" + כפתורים */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <PlayerTag name={bottomName} active={bottomActive} />
          <button onClick={toggleMute} aria-label={muted ? 'הפעל סאונד' : 'השתק סאונד'} style={{
            width: 46, height: 46, borderRadius: 12,
            background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, cursor: 'pointer', flexShrink: 0,
          }}>{muted ? '🔇' : '🔊'}</button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={onReset} style={{
            flex: 1, background: '#C9A85E', color: '#2A1C10',
            border: 'none', borderRadius: 14, padding: '14px',
            fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
          }}>🔄 משחק חדש</button>
          <button onClick={onChangeMode} style={{
            flex: 1, background: 'rgba(255,255,255,.10)', color: '#FBF7EE',
            border: '1px solid rgba(255,255,255,.18)', borderRadius: 14, padding: '14px',
            fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
          }}>{isOnline ? '🚪 עזוב משחק' : 'החלף מצב'}</button>
        </div>

        {socialBar}
      </div>

      {children}
    </div>
  )
}

function PlayerTag({ name, active, dark }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: active ? 'rgba(201,168,94,.22)' : 'rgba(255,255,255,.07)',
      border: active ? '2px solid #C9A85E' : '1px solid rgba(255,255,255,.14)',
      borderRadius: 14, padding: '8px 14px 8px 10px', transition: 'all .2s',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: dark
          ? 'radial-gradient(circle at 35% 30%, #4A3525, #1C120A)'
          : 'radial-gradient(circle at 35% 30%, #F0DCA8, #C9A85E)',
        border: '2px solid rgba(255,255,255,.35)',
      }} />
      <div style={{ color: '#FBF7EE', fontWeight: 800, fontSize: 16, fontFamily: "'Suez One', serif" }}>{name}</div>
      {active && <span style={{ fontSize: 12, color: '#E8C879', fontWeight: 700 }}>● תור</span>}
    </div>
  )
}

function CapturedTray({ count, pieceColor, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'rgba(0,0,0,.25)', borderRadius: 12, padding: '6px 10px',
      border: '1px solid rgba(255,255,255,.10)',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: pieceColor === 'dark'
          ? 'radial-gradient(circle at 35% 30%, #4A3525, #1C120A)'
          : 'radial-gradient(circle at 35% 30%, #F0DCA8, #C9A85E)',
        border: '1.5px solid rgba(255,255,255,.3)',
      }} />
      <div style={{ color: '#F0E2C6', fontWeight: 800, fontSize: 16 }}>{count}</div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// לוח הדמקה
// ════════════════════════════════════════════════════════
function CheckersBoard({ board, selected, destinations, lastMove, onCellTap, disabled }) {
  const isSel = (r, c) => selected && selected[0] === r && selected[1] === c
  const isDest = (r, c) => destinations.some(([dr, dc]) => dr === r && dc === c)
  const isLastFrom = (r, c) => lastMove && lastMove.from[0] === r && lastMove.from[1] === c
  const isLastTo = (r, c) => lastMove && lastMove.to[0] === r && lastMove.to[1] === c

  return (
    <div style={{
      background: 'linear-gradient(135deg, #5A3A22, #3E2814)',
      borderRadius: 16, padding: 10,
      boxShadow: '0 10px 28px -8px rgba(0,0,0,.6), inset 0 2px 6px rgba(255,255,255,.08)',
      maxWidth: 460, margin: '0 auto',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
        borderRadius: 8, overflow: 'hidden',
        border: '2px solid #2E1C0E',
      }}>
        {board.map((row, r) =>
          row.map((cell, c) => {
            const darkSq = (r + c) % 2 === 1
            const sel = isSel(r, c)
            const dest = isDest(r, c)
            return (
              <div key={`${r}-${c}`}
                onClick={() => !disabled && onCellTap(r, c)}
                style={{
                  aspectRatio: '1',
                  background: darkSq
                    ? 'linear-gradient(135deg, #9A6B3F, #7E5230)'
                    : 'linear-gradient(135deg, #E8D2A8, #D8C094)',
                  position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: disabled ? 'default' : 'pointer',
                  boxShadow: (isLastFrom(r, c) || isLastTo(r, c))
                    ? 'inset 0 0 0 3px rgba(232,200,121,.55)' : 'none',
                }}>
                {/* סימון משבצת יעד אפשרית */}
                {dest && !cell && (
                  <div style={{
                    width: '34%', height: '34%', borderRadius: '50%',
                    background: 'rgba(79,107,74,.55)',
                    boxShadow: '0 0 8px rgba(79,107,74,.6)',
                  }} />
                )}
                {/* כלי */}
                {cell && <Piece piece={cell} selected={sel} dest={dest} />}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function Piece({ piece, selected, dest }) {
  const dark = piece.p === P2
  return (
    <div style={{
      width: '80%', height: '80%', borderRadius: '50%',
      background: dark
        ? 'radial-gradient(circle at 34% 28%, #5A4230, #2A1B0F 62%, #160D06)'
        : 'radial-gradient(circle at 34% 28%, #F3E1B0, #CDA755 60%, #A6822F)',
      border: selected ? '3px solid #E8C879' : (dest ? '3px solid #4F6B4A' : '2px solid rgba(0,0,0,.35)'),
      boxShadow: selected
        ? '0 0 14px rgba(232,200,121,.8), inset 0 -3px 6px rgba(0,0,0,.4)'
        : 'inset 0 -4px 7px rgba(0,0,0,.4), inset 0 3px 5px rgba(255,255,255,.25), 0 3px 5px rgba(0,0,0,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all .12s',
    }}>
      {/* טבעת פנימית מגולפת */}
      <div style={{
        width: '64%', height: '64%', borderRadius: '50%',
        border: dark ? '2px solid rgba(255,255,255,.12)' : '2px solid rgba(120,80,30,.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {piece.k && (
          <span style={{
            fontSize: '0.9em', lineHeight: 1,
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.5))',
          }}>👑</span>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מודלים
// ════════════════════════════════════════════════════════
function LocalEndModal({ mode, winner, onPlayAgain, onExit }) {
  let emoji, title, subtitle, color
  if (winner === 'draw') { emoji = '🤝'; title = 'תיקו!'; subtitle = 'משחק יפה משני הצדדים'; color = '#8389A4' }
  else if (winner === 'P1') {
    emoji = '🎉'; title = mode === 'ai' ? 'ניצחת!' : 'שחקן 1 ניצח!'; subtitle = 'כל הכבוד'; color = '#4F6B4A'
  } else {
    emoji = mode === 'ai' ? '🤖' : '🎉'
    title = mode === 'ai' ? 'המחשב ניצח' : 'שחקן 2 ניצח!'
    subtitle = mode === 'ai' ? 'נסה שוב, אתה תצליח!' : 'כל הכבוד'
    color = '#B89048'
  }
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
  if (result === 'draw') { emoji = '🤝'; title = 'תיקו!'; subtitle = 'משחק יפה משני הצדדים'; color = '#8389A4' }
  else if (result === 'win') { emoji = '🎉'; title = 'ניצחת!'; subtitle = 'כל הכבוד'; color = '#4F6B4A' }
  else { emoji = '😕'; title = 'הפסדת'; subtitle = 'משחק יפה — אפשר לנסות שוב'; color = '#7E2C2E' }
  return (
    <ModalShell>
      <div style={{ fontSize: 64, marginBottom: 12 }}>{emoji}</div>
      <div className="h-display" style={{ fontSize: 28, color, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 16, color: 'var(--ink-2)', marginBottom: 22, fontWeight: 600, lineHeight: 1.4 }}>{subtitle}</div>
      {iRequested ? (
        <div style={{
          background: 'var(--bg-app)', border: '1px solid var(--line)', borderRadius: 14,
          padding: '14px', marginBottom: 10, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--ink-2)',
        }}>
          <span style={{ animation: 'ckPulse 1.4s infinite' }}>⏳</span>
          מחכים ש{opponentName} יאשר משחק חוזר...
        </div>
      ) : (
        <button onClick={onRematch} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 10 }}>
          🔄 שחק שוב
          {oppRequested && <span style={{ display: 'block', fontSize: 12, fontWeight: 700, marginTop: 2, opacity: 0.9 }}>{opponentName} כבר מחכה!</span>}
        </button>
      )}
      <button onClick={onFindOther} className="big-btn big-btn--ghost" style={{ width: '100%', marginBottom: 10 }}>🔎 חפש שחקן אחר</button>
      <button onClick={onEnd} className="big-btn big-btn--ghost" style={{ width: '100%' }}>סיים לשחק</button>
      <style>{`@keyframes ckPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
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
          <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 20, lineHeight: 1.4 }}>להתחיל את הלוח מחדש?</div>
          <button onClick={onConfirm} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 10 }}>✅ כן, משחק חדש</button>
          <button onClick={onCancel} className="big-btn big-btn--ghost" style={{ width: '100%' }}>לא, נמשיך לשחק</button>
        </>
      )}
    </ModalShell>
  )
}

function ModalShell({ children, maxWidth = 360 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(20,15,8,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24, direction: 'rtl',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24,
        padding: '30px 26px 22px', maxWidth, width: '100%', textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
      }}>{children}</div>
    </div>
  )
}

// מסך "היריב עזב" — עם אפשרות לחפש יריב חדש או לצאת
function OpponentLeftScreen({ onFindOther, onExit }) {
  return (
    <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg, #3A2818 0%, #2A1C10 100%)' }}>
      <div className="screen-header" style={{ background: 'transparent' }}>
        <button className="screen-header__back" onClick={onExit} aria-label="חזרה">
          <IconBackRTL size={24} color="#FBF7EE" />
        </button>
        <div className="screen-header__title" style={{ color: '#FBF7EE' }}>דמקה</div>
      </div>
      <div style={{ padding: 24 }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 20, padding: '32px 24px', textAlign: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ fontSize: 56, marginBottom: 14 }}>👋</div>
          <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>
            היריב עזב את המשחק
          </div>
          <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.4, marginBottom: 20 }}>
            המשחק הופסק. אפשר לחפש יריב חדש או לצאת.
          </div>
          <button onClick={onFindOther} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 10 }}>
            🔎 חפש שחקן אחר
          </button>
          <button onClick={onExit} className="big-btn big-btn--ghost" style={{ width: '100%' }}>
            יציאה
          </button>
        </div>
      </div>
    </div>
  )
}

function ErrorScreen({ emoji, title, description, onBack }) {
  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <div className="screen-header__title">דמקה</div>
      </div>
      <div style={{ padding: 24 }}>
        <CenteredCard emoji={emoji} title={title} description={description} actionLabel="חזרה" onAction={onBack} />
      </div>
    </div>
  )
}
