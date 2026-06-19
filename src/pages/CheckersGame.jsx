// src/pages/CheckersGame.jsx
// ─────────────────────────────────────────────────────────────
// משחק "דמקה" (Checkers) — חוקים ישראליים.
//
// חוקים:
//   • לוח 8×8, 12 כלים לכל צד על המשבצות הכהות.
//   • חייל זז באלכסון קדימה משבצת אחת.
//   • אכילה חובה — אם אפשר לאכול, חייבים.
//   • חייל אוכל קדימה; אכילה אחורה מותרת רק כהמשך רצף (אחרי שאכל אחד קדימה).
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
import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { IconBackRTL, IconSpeaker, IconSpeakerOff, IconHomeLine, IconMusicNote } from '../icons/index.jsx'
import HomeButton from '../components/HomeButton.jsx'
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
import { ChatToast, ChatHeaderButton, ChatPanel, AddFriendButton } from '../components/GameChat.jsx'
import { GameVideoProvider, PlayerVideo, VideoControls, VideoConsentGate, RemoteVideoToggles, ProfilesProvider, usePlayerProfile } from '../components/GameVideo.jsx'
import LeaveConfirmModal from '../components/LeaveConfirmModal.jsx'
import { MUSIC_TRACKS } from '../utils/gameSounds.js'

// ── קבועים ─────────────────────────────────────────────
const SIZE = 8
const P1 = 1   // שחקן 1 — כלים בהירים (זהב), למטה, זז כלפי מעלה (dr=-1)
const P2 = 2   // שחקן 2 — כלים כהים, למעלה, זז כלפי מטה (dr=+1)
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
const NO_PROGRESS_LIMIT = 50  // מהלכים ללא אכילה/הכתרה → תיקו

const idx = (r, c) => r * SIZE + c
const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE
const other = (p) => (p === P1 ? P2 : P1)

// מוזיקת רקע (אותם קבצים כמו במסביב לעולם)
const CK_MUSIC_VOLUME = 0.10

// יריב המחשב מוצג כדמות עם שם (אחת מ-3 דמויות) במקום "מחשב"
const CK_BOTS = ['רינת', 'דניאל', 'רומי']

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
      // חייל — אכילה ראשונה רק קדימה; אכילה אחורה מותרת רק כהמשך רצף
      // (אחרי שכבר נאכל לפחות אחד). כיוון "קדימה": P1 = מעלה (dr=-1), P2 = מטה (dr=+1).
      const fwd = pc.p === P1 ? -1 : 1
      const allowBackward = caps.length > 0   // אחורה רק אחרי אכילה ראשונה
      for (const [dr, dc] of DIAG) {
        if (dr !== fwd && !allowBackward) continue   // אסור לאכול אחורה כאכילה ראשונה
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

// כל מהלכי השחקן כולל פשוטים (אכילה לא חובה) — caps ∪ simples
function looseMoves(board, player) {
  const caps = [], simples = []
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const pc = board[r][c]
    if (pc && pc.p === player) {
      caps.push(...captureSequences(board, r, c, pc))
      simples.push(...simpleMoves(board, r, c, pc))
    }
  }
  return [...caps, ...simples]
}
// תאים של כלים שיש להם אפשרות אכילה (כדי "לשרוף" אותם אם השחקן בחר לא לאכול)
function piecesWithCapture(board, player) {
  const cells = []
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const pc = board[r][c]
    if (pc && pc.p === player && captureSequences(board, r, c, pc).length) cells.push([r, c])
  }
  return cells
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

// כמו applyMove אך משאיר את הכלים הנאכלים על הלוח (לאנימציית היעלמות צבעונית) — מסירים אותם בשלב שני
function applyMoveKeepCaptures(board, move) {
  const nb = cloneBoard(board)
  const [fr, fc] = move.path[0]
  const [tr, tc] = move.path[move.path.length - 1]
  const piece = nb[fr][fc]
  nb[fr][fc] = null
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
export default function CheckersGame({ onBack, onHome, initialRoomId, autoInviteFriend = null, initialMode = null, registerBack }) {
  const [mode, setMode] = useState(initialRoomId ? 'online-friend' : (autoInviteFriend ? 'online-friend' : (initialMode || null)))
  const [difficulty, setDifficulty] = useState('medium')
  const [roomId, setRoomId] = useState(initialRoomId || null)
  // חלון אישור יציאה ממשחק פעיל + תת-מסך רושם צעד-חזרה משלו
  const [confirmLeave, setConfirmLeave] = useState(false)
  const childBackRef = useRef(null)
  const registerChildBack = useRef((fn) => { childBackRef.current = fn }).current
  const inActiveGame = mode === 'ai' || mode === 'local' || ((mode === 'online-random' || mode === 'online-friend') && roomId)

  // צעד חזרה אחד עבור כפתור החזרה של אנדרואיד:
  // באמצע משחק — חלון אישור; בתת-מסך — צעד אחורה; במסך הבחירה — יציאה.
  const handleBackStep = () => {
    if (childBackRef.current && childBackRef.current()) return true
    if (confirmLeave) { setConfirmLeave(false); return true }
    if (inActiveGame) { setConfirmLeave(true); return true }
    if ((mode === 'online-random' || mode === 'online-friend') && !roomId) { setMode(null); return true }
    return false
  }
  useEffect(() => {
    if (!registerBack) return
    registerBack(handleBackStep)
    return () => registerBack(null)
  }, [registerBack, mode, roomId, confirmLeave])
  // אישור העזיבה — חזרה למסך בחירת המצב (צעד אחד)
  const confirmLeaveNow = () => { setConfirmLeave(false); setRoomId(null); setMode(null) }

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
        onHome={onHome}
        registerBack={registerChildBack}
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
          autoInviteFriend={autoInviteFriend}
          onBack={onBack}
          onHome={onHome}
          onReady={(id) => setRoomId(id)}
        />
      )
    }
    return (
      <>
        <OnlineGameScreen
          roomId={roomId}
          onBack={() => { setRoomId(null); setMode(null) }}
          onHome={onHome}
          onExit={onBack}
          onFindOther={() => { setRoomId(null); setMode('online-random') }}
        />
        {confirmLeave && (
          <LeaveConfirmModal
            title="לעזוב את המשחק?"
            subtitle="המשחק הנוכחי יסתיים והיריב יקבל הודעה"
            stayLabel="לא, להישאר במשחק"
            leaveLabel="כן, לעזוב"
            onStay={() => setConfirmLeave(false)}
            onLeave={confirmLeaveNow}
          />
        )}
      </>
    )
  }

  return (
    <>
      <LocalGameScreen
        mode={mode}
        difficulty={difficulty}
        onBack={() => setMode(null)}
        onHome={onHome}
        onExit={onBack}
      />
      {confirmLeave && (
        <LeaveConfirmModal
          title="לעזוב את המשחק?"
          subtitle="המשחק הנוכחי יסתיים"
          stayLabel="לא, להישאר במשחק"
          leaveLabel="כן, לעזוב"
          onStay={() => setConfirmLeave(false)}
          onLeave={confirmLeaveNow}
        />
      )}
    </>
  )
}

// ════════════════════════════════════════════════════════
// מסך בחירת מצב
// ════════════════════════════════════════════════════════
function ModeSelectScreen({ onBack, onHome, registerBack, onSelectAI, onSelectLocal, onSelectOnlineRandom, onSelectOnlineFriend }) {
  const [showDifficulty, setShowDifficulty] = useState(false)
  // כפתור החזרה של אנדרואיד — ממסך הקושי חוזרים לבחירת המצב (צעד אחד)
  useEffect(() => {
    if (!registerBack) return
    if (showDifficulty) registerBack(() => { setShowDifficulty(false); return true })
    else registerBack(null)
    return () => registerBack(null)
  }, [registerBack, showDifficulty])
  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
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
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <GameIcon id="checkers" size={52} />
          </div>
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
            <DifficultyButton label="קל" iconId="level-easy" color="#4F6B4A"
              description="מתאים להתחלה — המחשב משחק בפשטות"
              onClick={() => onSelectAI('easy')} />
            <DifficultyButton label="בינוני" iconId="level-medium" color="#B89048"
              description="המחשב מחפש אכילות טובות"
              onClick={() => onSelectAI('medium')} />
            <DifficultyButton label="קשה" iconId="level-hard" color="#7E2C2E"
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

function DifficultyButton({ label, iconId, color, description, onClick }) {
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
        flexShrink: 0,
      }}><GameIcon id={iconId} size={30} /></div>
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
function OnlineLobby({ mode, onBack, onHome, onReady, autoInviteFriend = null }) {
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
  const autoInvitedRef = useRef(false)

  // הזמנה אוטומטית — כשהגיעו מ"משחק עם חבר" בדף החברים
  useEffect(() => {
    if (!autoInviteFriend || autoInvitedRef.current || !authUser?.uid) return
    autoInvitedRef.current = true
    inviteFriend(autoInviteFriend)
    // eslint-disable-next-line
  }, [autoInviteFriend, authUser?.uid])

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
      const player = { uid: authUser.uid, name: profile?.name || 'משתמש', photoURL: profile?.photoURL || '' }
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
      const player = { uid: authUser.uid, name: profile?.name || 'משתמש', photoURL: profile?.photoURL || '' }
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
      setPhase('waiting')   // ממתין במסך ההמתנה הנקי (כמו במסביב לעולם) — בלי כרטיס "נשלחה הזמנה"

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

  // ביטול ממסך ההמתנה: אם זו הזמנת חבר — מנקה הזמנה+חדר; אחרת (רנדומלי) — יציאה
  const handleCancelWait = () => { if (inviteId) cancelInvite(); else onBack() }

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
          <button onClick={handleCancelWait} style={{
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
            }}><GameIcon id="checkers" size={84} /></div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Suez One', serif" }}>
              {invitedFriend ? `מחכים ל${invitedFriend.otherName}...` : (phase === 'searching' ? 'מחפש לך יריב...' : 'מחכים ליריב...')}
            </div>
            <div style={{ fontSize: 16, opacity: 0.85, marginTop: 8 }}>⏱ {formatTime(elapsed)}</div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,.10)', borderRadius: 16, padding: '14px 18px',
            fontSize: 15, fontWeight: 500, textAlign: 'center', lineHeight: 1.5, maxWidth: 320,
          }}>
            {invitedFriend ? 'שלחנו הזמנה — המשחק יתחיל ברגע שהחבר יצטרף 🎲' : <>💡 כשעוד מישהו ילחץ על "דמקה"<br />תתחבר אליו אוטומטית</>}
          </div>
        </div>
        <button onClick={handleCancelWait} className="big-btn big-btn--danger" style={{ width: '100%' }}>✕ ביטול</button>
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
        <HomeButton onClick={onHome} />
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
  return <FriendListBody friends={friends} onInvite={onInvite} />
}

function FriendListBody({ friends, onInvite }) {
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
  const onlineFriends = friends.filter(f => onlineMap[f.otherUid])
  const offlineFriends = friends.filter(f => !onlineMap[f.otherUid])
  return (
    <>
      <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 6px', color: 'var(--ink)' }}>בחרו חבר להזמין</h2>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 14 }}>
        נשלח לו הזמנה למשחק — וכשהחבר יאשר, המשחק יתחיל
      </div>
      {onlineFriends.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--success)', margin: '4px 2px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            מחוברים עכשיו ({onlineFriends.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {onlineFriends.map(f => <FriendInviteRow key={f.docId} friend={f} profile={profileMap[f.otherUid]} online onInvite={() => onInvite(f)} />)}
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
            {offlineFriends.map(f => <FriendInviteRow key={f.docId} friend={f} profile={profileMap[f.otherUid]} online={false} onInvite={() => onInvite(f)} />)}
          </div>
        </>
      )}
    </>
  )
}

function FriendInviteRow({ friend, profile, online, onInvite }) {
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
      <button onClick={onInvite} style={{ background: online ? 'var(--success)' : 'var(--burgundy)', color: 'white', border: 'none', borderRadius: 12, padding: '11px 16px', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>הזמן</button>
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
function LocalGameScreen({ mode, difficulty, onBack, onHome, onExit }) {
  const [board, setBoard] = useState(initialBoard)
  const [turn, setTurn] = useState(P1)
  const [winner, setWinner] = useState(null)
  const [selected, setSelected] = useState(null)   // [r,c]
  const [lastMove, setLastMove] = useState(null)    // {from:[r,c], to:[r,c], caps:[[r,c]...]}
  const [noProgress, setNoProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [burning, setBurning] = useState([])   // תאים של כלים שנשרפים (אנימציה ואז הסרה)
  const [aiName] = useState(() => CK_BOTS[Math.floor(Math.random() * CK_BOTS.length)])  // שם יריב המחשב (אחד מ-3)
  const aiActedRef = useRef(false)              // מונע מהמחשב לזוז פעמיים באותו תור (התור נשאר P2 בזמן אנימציית האכילה)
  const moveAnimRef = useRef(0)                 // משך אנימציית המהלך האחרון (ms) — כדי שהיריב/המחשב יחכה שתסתיים

  const isAITurn = mode === 'ai' && turn === P2 && !winner

  // אכילה אינה חובה — מציגים גם מהלכים פשוטים. מי שלא אוכל כשאפשר — הכלי(ם) שיכלו לאכול נשרפים.
  const legalMoves = looseMoves(board, turn)

  const doMove = (move) => {
    playSound('drop')
    const mover = turn
    const capCells = piecesWithCapture(board, mover)   // כלים שיכלו לאכול
    const isCap = move.captures.length > 0
    const newBoard = isCap ? applyMoveKeepCaptures(board, move) : applyMove(board, move)
    // משך האנימציה — צעד לכל אכילה ברצף; חייב להתאים לחישוב ב-CheckersBoard
    const [dKr, dKc] = move.path[move.path.length - 1]
    const movedKing = newBoard[dKr] && newBoard[dKr][dKc] && newBoard[dKr][dKc].k
    const animMs = !isCap ? 640 : (movedKing ? 640 : Math.max(640, (move.path.length - 1) * 520))
    moveAnimRef.current = animMs
    setBoard(newBoard)
    setLastMove({ from: move.path[0], to: move.path[move.path.length - 1], caps: move.captures, path: move.path })
    setSelected(null)

    const announceWin = (w) => {
      setWinner(w)
      setTimeout(() => {
        if (mode === 'ai') playSound(w === 'P1' ? 'win' : 'lose')
        else playSound('win')
      }, 300)
    }

    // היתה אפשרות לאכול והשחקן בחר לא — שורפים את הכלים שיכלו לאכול
    if (capCells.length && !isCap) {
      const [fr, fc] = move.path[0]
      const [tr, tc] = move.path[move.path.length - 1]
      const burnCells = capCells.map(([r, c]) => (r === fr && c === fc) ? [tr, tc] : [r, c])
      setBurning(burnCells.map(([r, c]) => ({ r, c, color: 'red', ms: 2000 })))
      setBusy(true)
      setTimeout(() => {
        const b2 = cloneBoard(newBoard)
        for (const [r, c] of burnCells) b2[r][c] = null
        setBoard(b2)
        setBurning([])
        setBusy(false)
        setNoProgress(0)
        const opp = other(mover)
        let w = null
        if (countPieces(b2, mover) === 0) w = (opp === P1 ? 'P1' : 'P2')
        else if (countPieces(b2, opp) === 0) w = (mover === P1 ? 'P1' : 'P2')
        else if (getAllMoves(b2, opp).length === 0) w = (mover === P1 ? 'P1' : 'P2')
        if (w) announceWin(w)
        else setTurn(opp)
      }, 2000)
      return
    }

    // מהלך אכילה — משאירים את הנאכלים, צובעים (ירוק=של היריב, אדום=שלי) ומעלימים, ואז מסירים
    if (isCap) {
      const viewer = P1   // מקומי: השחקן התחתון (אתה) הוא נקודת הייחוס
      const capMs = animMs + 260
      setBurning(move.captures.map(([r, c]) => ({
        r, c,
        color: (board[r][c] && board[r][c].p === viewer) ? 'red' : 'green',
        ms: capMs,
      })))
      setBusy(true)
      setTimeout(() => {
        setBoard(applyMove(board, move))
        setBurning([])
        moveAnimRef.current = 0
        const { winner: w, noProgress: np } = nextStateAfterMove(board, move, mover, noProgress)
        setNoProgress(np)
        if (w) announceWin(w)
        else setTurn(other(mover))
        setBusy(false)
      }, capMs)
      return
    }

    // מהלך רגיל — מחליפים תור מיד, אך חוסמים קלט עד שאנימציית התנועה מסתיימת
    const { winner: w, noProgress: np } = nextStateAfterMove(board, move, mover, noProgress)
    setNoProgress(np)
    setBusy(true)
    if (w) {
      setTimeout(() => announceWin(w), animMs)
    } else {
      setTurn(other(mover))
      setTimeout(() => setBusy(false), animMs)
    }
  }

  // תור המחשב — ממתינים שאנימציית מהלך השחקן תסתיים, ואז המחשב "חושב" וזז
  useEffect(() => {
    if (!isAITurn) { aiActedRef.current = false; return }
    if (aiActedRef.current) return
    setBusy(true)
    const wait = Math.max(650, moveAnimRef.current || 0)
    const t = setTimeout(() => {
      aiActedRef.current = true
      const m = chooseAIMove(board, P2, difficulty)
      if (m) doMove(m)
      else setBusy(false)
    }, wait)
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
    setTurn(P1); setWinner(null); setSelected(null); setLastMove(null); setNoProgress(0); setBusy(false); setBurning([])
  }

  const destinations = selected
    ? legalMoves.filter(m => m.path[0][0] === selected[0] && m.path[0][1] === selected[1])
        .map(m => m.path[m.path.length - 1])
    : []

  const statusText = (() => {
    if (winner === 'draw') return 'תיקו! 🤝'
    if (winner === 'P1') return mode === 'ai' ? 'ניצחת! 🎉' : 'שחקן 1 ניצח! 🎉'
    if (winner === 'P2') return mode === 'ai' ? `${aiName} ניצח! 🎉` : 'שחקן 2 ניצח! 🎉'
    if (isAITurn) return `${aiName} חושב...`
    return mode === 'ai' ? 'תורך — בצע מהלך' : `תור שחקן ${turn === P1 ? '1' : '2'}`
  })()

  return (
    <CheckersStage
      onBack={onBack}
      onHome={onHome}
      statusText={statusText}
      topName={mode === 'ai' ? aiName : 'שחקן 2'}
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
      burning={burning}
    >
      {winner && (
        <LocalEndModal mode={mode} winner={winner} aiName={aiName} onPlayAgain={reset} onExit={onExit} />
      )}
    </CheckersStage>
  )
}

// ════════════════════════════════════════════════════════
// מסך משחק אונליין (סנכרון דרך Firestore)
// ════════════════════════════════════════════════════════
function OnlineGameScreen({ roomId, onBack, onHome, onExit, onFindOther }) {
  const { authUser, profile } = useUserStore()
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [videoChoice, setVideoChoice] = useState(null)  // null=טרם נשאל, true/false=הבחירה
  const lastMoveKeyRef = useRef(null)
  const finishedSoundRef = useRef(false)
  const [isPortrait, setIsPortrait] = useState(() => typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const h = (e) => setIsPortrait(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

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
  const burnGs = (gs.burn || []).map(i => ({ r: Math.floor(i / SIZE), c: i % SIZE, color: 'red', ms: 2000 }))
  const capPathLen = (gs.lastMove?.path || []).length
  const capDestKing = (() => { const t = gs.lastMove?.to; if (t === null || t === undefined) return false; const cr = Math.floor(t / SIZE), cc = t % SIZE; return !!(board[cr] && board[cr][cc] && board[cr][cc].k) })()
  const capMsOnline = ((capDestKing ? 640 : Math.max(640, Math.max(1, capPathLen - 1) * 520)) + 260)
  const capFade = (gs.capFade || []).map(i => {
    const cr = Math.floor(i / SIZE), cc = i % SIZE
    const pc = board[cr] && board[cr][cc]
    return { r: cr, c: cc, color: (pc && pc.p === myNum) ? 'red' : 'green', ms: capMsOnline }
  })
  const burning = [...burnGs, ...capFade]   // כלים שנשרפים (אכילה לא חובה — סנכרון אונליין)
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
    path: (lm.path || []).map(i => [Math.floor(i / SIZE), i % SIZE]),
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
          burn: null,
          capFade: null,
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
          <HomeButton onClick={onHome} />
          <div className="screen-header__title">דמקה</div>
        </div>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-2)' }}>טוען...</div>
      </div>
    )
  }

  // אישור וידאו — לפני שמתחילים, כל שחקן בוחר אם להפעיל וידאו
  if (videoChoice === null) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg, #3A2818 0%, #2A1C10 100%)' }}>
        <div className="screen-header" style={{ background: 'transparent' }}>
          <button className="screen-header__back" onClick={onBack} aria-label="חזרה" style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)' }}><IconBackRTL size={24} color="#E8C879" /></button>
          <button className="screen-header__back" onClick={onHome} aria-label="חזרה למסך הבית" style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)' }}><IconHomeLine size={24} color="#E8C879" /></button>
          <div className="screen-header__title" style={{ color: '#FBF7EE' }}>דמקה אונליין</div>
        </div>
        <VideoConsentGate onDecide={(use) => setVideoChoice(use)} accent="#6B4427" accentDeep="#C9A85E" />
      </div>
    )
  }

  const legalMoves = isMyTurn ? looseMoves(board, myNum) : []

  const handleCellTap = async (r, c) => {
    if (!isMyTurn || burning.length) return
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
        const capCells = piecesWithCapture(board, myNum)
        const isCap = move.captures.length > 0
        const newBoard = applyMove(board, move)
        const lm = {
          from: idx(move.path[0][0], move.path[0][1]),
          to: idx(move.path[move.path.length - 1][0], move.path[move.path.length - 1][1]),
          caps: move.captures.map(([cr, cc]) => idx(cr, cc)),
          path: move.path.map(([pr, pc]) => idx(pr, pc)),
        }

        // אכילה אינה חובה — אם דילג על אכילה אפשרית: שלב 1 כותב את המהלך + סימון שריפה (התור נשאר אצלי),
        // שלב 2 (אחרי 2 שניות) מסיר את הנשרפים ומעביר תור — כך שני הצדדים רואים את אנימציית השריפה
        if (capCells.length && !isCap) {
          const [fr, fc] = move.path[0]
          const [tr, tc] = move.path[move.path.length - 1]
          const burnCells = capCells.map(([pr, pc]) => (pr === fr && pc === fc) ? [tr, tc] : [pr, pc])
          await updateGameState(roomId, {
            board: boardToFlat(newBoard),
            currentTurn: turnColor,
            winner: null,
            lastMove: lm,
            noProgress: 0,
            burn: burnCells.map(([pr, pc]) => idx(pr, pc)),
          })
          setTimeout(async () => {
            const b2 = cloneBoard(newBoard)
            for (const [pr, pc] of burnCells) b2[pr][pc] = null
            let w2 = null
            if (countPieces(b2, myNum) === 0) w2 = oppColor
            else if (countPieces(b2, other(myNum)) === 0) w2 = myColor
            else if (getAllMoves(b2, other(myNum)).length === 0) w2 = myColor
            await updateGameState(roomId, {
              board: boardToFlat(b2),
              currentTurn: w2 ? turnColor : oppColor,
              winner: w2,
              lastMove: lm,
              noProgress: 0,
              burn: null,
            })
          }, 2000)
          return
        }

        // מהלך אכילה — משאירים את הנאכלים + סימון capFade; כל לקוח צובע לפי נקודת מבטו (שלי=אדום, של היריב=ירוק); שלב 2 מסיר ומעביר תור
        if (isCap) {
          const keepBoard = applyMoveKeepCaptures(board, move)
          const dk = keepBoard[move.path[move.path.length - 1][0]][move.path[move.path.length - 1][1]]
          const capMs = ((dk && dk.k) ? 640 : Math.max(640, Math.max(1, move.path.length - 1) * 520)) + 260
          await updateGameState(roomId, {
            board: boardToFlat(keepBoard),
            currentTurn: turnColor,
            winner: null,
            lastMove: lm,
            noProgress: 0,
            capFade: move.captures.map(([cr, cc]) => idx(cr, cc)),
            burn: null,
          })
          setTimeout(async () => {
            const finalBoard = applyMove(board, move)
            const { winner: w, noProgress: np } = nextStateAfterMove(board, move, myNum, noProgress)
            await updateGameState(roomId, {
              board: boardToFlat(finalBoard),
              currentTurn: w ? turnColor : oppColor,
              winner: w,
              lastMove: lm,
              noProgress: np,
              capFade: null,
              burn: null,
            })
          }, capMs)
          return
        }

        // מהלך רגיל
        const { winner: w, noProgress: np } = nextStateAfterMove(board, move, myNum, noProgress)
        await updateGameState(roomId, {
          board: boardToFlat(newBoard),
          currentTurn: w ? turnColor : oppColor,
          winner: w,
          lastMove: lm,
          noProgress: np,
          burn: null,
          capFade: null,
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
    <ProfilesProvider uids={(room.players || []).map(p => p.uid)} myUid={myUid}>
    <GameVideoProvider roomId={roomId} me={{ uid: myUid, name: me?.name || 'שחקן' }} enabled={videoChoice !== null} startWithCam={videoChoice === true} isPortrait={isPortrait}>
    <CheckersStage
      onBack={handleLeave}
      onHome={onHome}
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
      disabled={!isMyTurn || !!winner || burning.length > 0}
      burning={burning}
      onReset={requestRematch}
      onChangeMode={handleLeave}
      isOnline={true}
      flip={myColor === 'P2'}
      chat={room.chat || []} meUid={myUid} meName={me?.name} roomId={roomId}
      withVideo={true}
      topUid={opponent?.uid}
      bottomUid={myUid}
      myPhoto={profile?.photoURL}
      addFriendNode={opponent?.uid ? <AddFriendButton me={me} opponent={opponent} compact /> : null}
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
    </CheckersStage>
    </GameVideoProvider>
    </ProfilesProvider>
  )
}

// ════════════════════════════════════════════════════════
// Layout משותף — כותרת, כרטיסי שחקנים, לוח, מגשים, כפתורים
// ════════════════════════════════════════════════════════
function GameLayout({
  onBack, onHome, statusText, topName, topActive, bottomName, bottomActive,
  board, selected, destinations, lastMove, onCellTap, disabled,
  onReset, onChangeMode, isOnline, children, chat = [], meUid, meName, roomId, flip,
  withVideo, topUid, bottomUid, myPhoto, addFriendNode, burning = [],
}) {
  const [muted, setMutedState] = useState(() => isMuted())
  const [chatOpen, setChatOpen] = useState(false)
  const toggleMute = () => { const n = !muted; setMutedState(n); setMuted(n) }

  // מונה כלים שנאכלו (12 מינוס מה שנשאר)
  const p1Left = countPieces(board, P1)
  const p2Left = countPieces(board, P2)
  const p1Captured = 12 - p2Left  // כמה כלים של P2 נאכלו (ע"י P1)
  const p2Captured = 12 - p1Left

  return (
    <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg, #3A2818 0%, #2A1C10 100%)' }}>
      <div className="screen-header" style={{ background: 'transparent' }}>
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה" style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)' }}>
          <IconBackRTL size={24} color="#E8C879" />
        </button>
        {onHome && (
          <button className="screen-header__back" onClick={onHome} aria-label="חזרה למסך הבית" style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)' }}>
            <IconHomeLine size={24} color="#E8C879" />
          </button>
        )}
        <div className="screen-header__title" style={{ color: '#FBF7EE' }}>דמקה {isOnline ? 'אונליין' : ''}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={toggleMute} aria-label={muted ? 'הפעל סאונד' : 'השתק סאונד'} style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}>{muted ? <IconSpeakerOff size={22} color="#E8C879" /> : <IconSpeaker size={22} color="#E8C879" />}</button>
          {isOnline && meUid && (
            <ChatHeaderButton chat={chat} open={chatOpen} onOpen={() => setChatOpen(true)}
              bg="rgba(255,255,255,.12)" border="rgba(255,255,255,.22)" color="#E8C879" />
          )}
        </div>
      </div>

      <div style={{ padding: '4px 16px 28px' }}>
        {/* כרטיסי השחקנים (למעלה) */}
        {withVideo ? (
          // מצב וידאו — שני כרטיסי וידאו גדולים זה ליד זה (כמו ב-4 בשורה/מלך הזירה)
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'stretch' }}>
            <CheckersVideoCard uid={bottomUid} name={bottomName} active={bottomActive} you photoURL={myPhoto} />
            <CheckersVideoCard uid={topUid} name={topName} active={topActive} addFriendNode={addFriendNode} />
          </div>
        ) : (
          // מצב רגיל — כרטיס יריב בודד למעלה
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
            <PlayerTag name={topName} active={topActive} dark />
          </div>
        )}

        {/* הלוח */}
        <CheckersBoard
          board={board}
          selected={selected}
          destinations={destinations}
          lastMove={lastMove}
          onCellTap={onCellTap}
          disabled={disabled}
          flip={flip}
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

        {/* כרטיס "אתה" (במצב וידאו השחקנים כבר למעלה, וכפתור ההשתקה עבר לכותרת) */}
        {!withVideo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <PlayerTag name={bottomName} active={bottomActive} />
          </div>
        )}

        {isOnline && meUid && <ChatToast msgs={chat} meUid={meUid} suppressed={chatOpen} onOpen={() => setChatOpen(true)} />}
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
      </div>

      {chatOpen && isOnline && meUid && <ChatPanel roomId={roomId} me={{ uid: meUid, name: meName }} msgs={chat} onClose={() => setChatOpen(false)} />}
      {confirmExit && (
        <LeaveConfirmModal
          title="לעזוב את המשחק?"
          subtitle={isOnline ? 'המשחק יסתיים והיריב יקבל הודעה' : 'המשחק הנוכחי יסתיים'}
          stayLabel="לא, להישאר במשחק"
          leaveLabel="כן, לצאת"
          onStay={() => setConfirmExit(false)}
          onLeave={() => { setConfirmExit(false); onBack && onBack() }}
        />
      )}
      {children}
    </div>
  )
}

// כרטיס וידאו לשחקן (סגנון דמקה — זהב/חום) — פרצוף גדול וכפתורי בקרה
function CheckersVideoCard({ uid, name, active, you, photoURL, addFriendNode }) {
  // שם מלא חי (שם + שם משפחה) — התמונה מטופלת ב-PlayerVideo
  const { name: fullName } = usePlayerProfile(uid, name)
  return (
    <div style={{
      flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      background: active ? 'rgba(201,168,94,.22)' : 'rgba(255,255,255,.07)',
      border: active ? '2px solid #C9A85E' : '1px solid rgba(255,255,255,.14)',
      borderRadius: 14, padding: '10px 8px', transition: 'all .2s',
    }}>
      <PlayerVideo uid={uid} name={fullName} size={92} photoURL={photoURL} />
      {/* שורת שם — כפתורי שליטה משני הצדדים */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}>
        {you ? <VideoControls only="mic" size={30} /> : <RemoteVideoToggles uid={uid} only="audio" size={30} />}
        <div style={{
          color: '#FBF7EE', fontWeight: 800, fontSize: 14, fontFamily: "'Suez One', serif",
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
        }}>{fullName}{you ? ' (אתה)' : ''}</div>
        {you ? <VideoControls only="cam" size={30} /> : <RemoteVideoToggles uid={uid} only="video" size={30} />}
      </div>
      {active && <span style={{ fontSize: 12, color: '#E8C879', fontWeight: 700 }}>● תור</span>}
      {!you && addFriendNode}
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
function CheckersBoard({ board, selected, destinations, lastMove, onCellTap, disabled, flip, burning = [] }) {
  const isSel = (r, c) => selected && selected[0] === r && selected[1] === c
  const isDest = (r, c) => destinations.some(([dr, dc]) => dr === r && dc === c)
  const isLastFrom = (r, c) => lastMove && lastMove.from[0] === r && lastMove.from[1] === c
  const isLastTo = (r, c) => lastMove && lastMove.to[0] === r && lastMove.to[1] === c

  // אנימציה: הכלי מורם במקום → נוסע באלכסון ליעד → מונח. נעשה דרך Web Animations API (אמין יותר מ-transition על mount). ה-translate ביחידות-תא (בטוח ל-RTL/flip).
  // anim נגזר תוך כדי render (לא ב-effect) כדי שלא יהיה render ביניים שבו הכלי כבר ביעד
  // והאנימציה עוד לא התחילה (זה גרם להבזק "קדימה ואז אחורה", בעיקר במהלכי המחשב).
  const overlayRef = useRef(null)
  const animRef = useRef(null)        // { path, tr, tc, piece, key }
  const prevKeyRef = useRef(null)
  const [, bumpAnim] = useState(0)    // לכפיית render כשהאנימציה נגמרת
  const moveKey = lastMove ? (lastMove.from.join(',') + '>' + lastMove.to.join(',')) : null
  if (moveKey && prevKeyRef.current !== moveKey) {
    prevKeyRef.current = moveKey
    const fullPath = (lastMove.path && lastMove.path.length >= 2) ? lastMove.path : [lastMove.from, lastMove.to]
    const [tr, tc] = fullPath[fullPath.length - 1]
    const piece = board[tr] && board[tr][tc]
    animRef.current = piece
      ? { path: piece.k ? [fullPath[0], fullPath[fullPath.length - 1]] : fullPath, tr, tc, piece, key: moveKey }
      : null
  }
  const anim = animRef.current
    // מלכה ("עפה") נוסעת ישר ליעד — מסלול האכילה המעופף נראה כמו הלוך-ושוב; חייל רגיל ממשיך צעד-צעד
  useLayoutEffect(() => {
    if (!anim) return
    const el = overlayRef.current
    if (!el) return
    const { path, tr, tc } = anim
    // צעד-צעד לאורך מסלול האכילה; translate ביחידות-תא (ימין/מטה = +), בטוח ל-RTL/flip
    const frames = path.map(([pr, pc]) => ({
      transform: `translate(${(tc - pc) * 100}%, ${(pr - tr) * 100}%)`,
      easing: 'cubic-bezier(.4,.05,.35,1)',
    }))
    const segs = Math.max(1, path.length - 1)
    const dur = Math.max(640, segs * 520)   // איטי יותר — תחושת משחק אמיתי; צעד לכל אכילה
    const a = el.animate(frames, { duration: dur, fill: 'both' })
    let cancelled = false
    a.onfinish = () => { if (!cancelled) { animRef.current = null; bumpAnim(n => n + 1) } }
    return () => { cancelled = true; try { if (a.playState !== 'finished') a.cancel() } catch { /* ignore */ } }
  }, [anim && anim.key]) // eslint-disable-line

  return (
    <div style={{
      background: 'linear-gradient(135deg, #5A3A22, #3E2814)',
      borderRadius: 16, padding: 10,
      boxShadow: '0 10px 28px -8px rgba(0,0,0,.6), inset 0 2px 6px rgba(255,255,255,.08)',
      maxWidth: 960, margin: '0 auto', width: '100%',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
        borderRadius: 8, overflow: 'hidden', position: 'relative',
        border: '2px solid #2E1C0E',
        transform: flip ? 'rotate(180deg)' : 'none',
      }}>
        {board.map((row, r) =>
          row.map((cell, c) => {
            const darkSq = (r + c) % 2 === 1
            const sel = isSel(r, c)
            const dest = isDest(r, c)
            const bv = cell ? burning.find(x => x.r === r && x.c === c) : null
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
                {/* כלי — מוסתר במשבצת היעד בזמן האנימציה (הכלי הצף מצייר אותו) */}
                {cell && !(anim && anim.tr === r && anim.tc === c) && <Piece piece={cell} selected={sel} dest={dest} flip={flip} burnColor={bv ? bv.color : null} burnMs={bv ? bv.ms : 2000} />}
              </div>
            )
          })
        )}
        {anim && (
          <div ref={overlayRef} style={{ position: 'absolute', right: `${anim.tc * (100 / SIZE)}%`, top: `${anim.tr * (100 / SIZE)}%`, width: `${100 / SIZE}%`, height: `${100 / SIZE}%`, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 6, willChange: 'transform' }}>
            <Piece piece={anim.piece} flip={flip} />
          </div>
        )}
        <style>{`@keyframes ckBurnFade{0%{opacity:1}62%{opacity:1}100%{opacity:0}}@keyframes ckBurnTint{0%{opacity:0}22%{opacity:.92}100%{opacity:.92}}`}</style>
      </div>
    </div>
  )
}

function Piece({ piece, selected, dest, flip, burnColor, burnMs = 2000 }) {
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
      transition: 'all .12s', position: 'relative',
      animation: burnColor ? `ckBurnFade ${burnMs}ms ease-out forwards` : undefined,
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
            display: 'inline-block',
            transform: flip ? 'rotate(180deg)' : 'none',
          }}>👑</span>
        )}
      </div>
      {burnColor && (
        <div style={{
          position: 'absolute', inset: -1, borderRadius: '50%',
          background: burnColor === 'green'
            ? 'radial-gradient(circle at 50% 38%, #74e88a, #1f9c3a 70%)'
            : 'radial-gradient(circle at 50% 38%, #ff6a3d, #c01d0c 70%)',
          boxShadow: burnColor === 'green' ? '0 0 14px 3px rgba(40,200,90,.85)' : '0 0 14px 3px rgba(230,40,20,.85)',
          animation: `ckBurnTint ${burnMs}ms ease-out forwards`, pointerEvents: 'none',
        }} />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מודלים
// ════════════════════════════════════════════════════════
function LocalEndModal({ mode, winner, aiName, onPlayAgain, onExit }) {
  let title, subtitle, color, icon = null, emoji = null
  if (winner === 'draw') { emoji = '🤝'; title = 'תיקו!'; subtitle = 'משחק יפה משני הצדדים'; color = '#8389A4' }
  else if (winner === 'P1') {
    icon = 'trophy'; title = mode === 'ai' ? 'ניצחת!' : 'שחקן 1 ניצח!'; subtitle = 'כל הכבוד'; color = '#4F6B4A'
  } else {
    if (mode === 'ai') { icon = 'ai-win'; title = `${aiName} ניצח`; subtitle = 'נסה שוב, אתה תצליח!'; color = '#2C5566' }
    else { icon = 'trophy'; title = 'שחקן 2 ניצח!'; subtitle = 'כל הכבוד'; color = '#B89048' }
  }
  return (
    <ModalShell>
      {icon ? (
        <div style={{
          width: 88, height: 88, borderRadius: '50%', margin: '0 auto 14px',
          background: icon === 'ai-win' ? 'linear-gradient(135deg, #2C5566, #173846)' : 'linear-gradient(135deg, #7E2C2E, #5A1D1E)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><GameIcon id={icon} size={58} /></div>
      ) : (
        <div style={{ fontSize: 64, marginBottom: 12 }}>{emoji}</div>
      )}
      <div className="h-display" style={{ fontSize: 28, color, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 16, color: 'var(--ink-2)', marginBottom: 24, fontWeight: 600, lineHeight: 1.4 }}>{subtitle}</div>
      <button onClick={onPlayAgain} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 10 }}>🔄 שחק שוב</button>
      <button onClick={onExit} className="big-btn big-btn--ghost" style={{ width: '100%' }}>חזרה לזירה</button>
    </ModalShell>
  )
}

function OnlineEndModal({ result, opponentName, iRequested, oppRequested, onRematch, onFindOther, onEnd }) {
  let emoji = null, title, subtitle, color, icon = null
  if (result === 'draw') { emoji = '🤝'; title = 'תיקו!'; subtitle = 'משחק יפה משני הצדדים'; color = '#8389A4' }
  else if (result === 'win') { icon = 'trophy'; title = 'ניצחת!'; subtitle = 'כל הכבוד'; color = '#4F6B4A' }
  else { emoji = '😕'; title = 'הפסדת'; subtitle = 'משחק יפה — אפשר לנסות שוב'; color = '#7E2C2E' }
  return (
    <ModalShell>
      {icon ? (
        <div style={{
          width: 88, height: 88, borderRadius: '50%', margin: '0 auto 14px',
          background: 'linear-gradient(135deg, #7E2C2E, #5A1D1E)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><GameIcon id={icon} size={58} /></div>
      ) : (
        <div style={{ fontSize: 64, marginBottom: 12 }}>{emoji}</div>
      )}
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
        <button className="screen-header__back" onClick={onExit} aria-label="חזרה" style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)' }}>
          <IconBackRTL size={24} color="#E8C879" />
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

// ════════════════════════════════════════════
// LANDSCAPE STAGE (like aroundworld): clean board center, players + controls on the sides
// ════════════════════════════════════════════
function CkMusicButton({ musicOn, onToggle, onNext, vol, onVolDown, onVolUp, btnStyle }) {
  const [open, setOpen] = useState(false)
  const item = { background: 'none', border: 'none', color: '#FBF7EE', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', padding: '8px 12px', textAlign: 'right', borderRadius: 8, whiteSpace: 'nowrap' }
  const vbtn = { width: 38, height: 34, borderRadius: 8, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.2)', color: '#E8C879', fontSize: 20, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }
  return (
    <div style={{ position: 'relative', display: 'flex', flex: 1 }}>
      <button onClick={() => setOpen(o => !o)} title="מוזיקה" aria-label="מוזיקה" style={{ ...btnStyle, opacity: musicOn ? 1 : 0.5 }}><IconMusicNote size={20} color="#E8C879" /></button>
      {open && (
        <div style={{ position: 'absolute', bottom: '115%', insetInlineStart: 0, background: 'rgba(20,15,8,.97)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 12, padding: 6, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,.5)', minWidth: 156 }}>
          <button onClick={() => { onToggle() }} style={item}>{musicOn ? '🔇 כיבוי מוזיקה' : '🎵 הפעלת מוזיקה'}</button>
          <button onClick={() => { onNext() }} style={item}>⏭️ השיר הבא</button>
          {onVolUp && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 6px' }}>
              <button onClick={onVolDown} aria-label="הנמך עוצמה" style={vbtn}>−</button>
              <span style={{ flex: 1, textAlign: 'center', color: '#E8C879', fontWeight: 800, fontSize: 13 }}>{Math.round((vol || 0) * 100)}%</span>
              <button onClick={onVolUp} aria-label="הגבר עוצמה" style={vbtn}>+</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CkSteam() {
  // אדים עולים מהתה שבתמונת הרקע — איטי ומתמשך. המיקום באחוזים (קל לכוונן).
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '73%', top: '49%', width: 60, height: 100, pointerEvents: 'none' }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          position: 'absolute', bottom: 0, left: 6 + i * 16,
          width: 18, height: 18, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,.55), rgba(255,255,255,0) 70%)',
          filter: 'blur(5px)',
          animation: `ckSteamRise ${5.5 + i * 1.6}s ease-in ${i * 1.8}s infinite`,
        }} />
      ))}
      <style>{`@keyframes ckSteamRise { 0% { opacity: 0; transform: translateY(0) scale(.7); } 22% { opacity: .6; } 65% { opacity: .3; } 100% { opacity: 0; transform: translateY(-54px) scale(1.9); } }`}</style>
    </div>
  )
}

function CkPlayerPanel({ name, active, captured, dark, withVideo, uid, you, photoURL, addFriendNode }) {
  const showVideo = withVideo && uid
  return (
    <div style={{ background: active ? 'rgba(74,54,26,.92)' : 'rgba(26,17,9,.85)', border: active ? '2px solid #E8C879' : '1px solid rgba(255,255,255,.22)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: active ? '0 6px 20px rgba(0,0,0,.5), 0 0 0 1px rgba(232,200,121,.35)' : '0 6px 18px rgba(0,0,0,.5)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>
      {showVideo && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <PlayerVideo uid={uid} name={name} width={108} height={108} photoURL={photoURL} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {showVideo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 'none' }}>
            {you ? <VideoControls only="mic" size={26} /> : <RemoteVideoToggles uid={uid} only="audio" size={26} />}
            {you ? <VideoControls only="cam" size={26} /> : <RemoteVideoToggles uid={uid} only="video" size={26} />}
          </div>
        ) : (
          <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: dark ? 'radial-gradient(circle at 35% 30%, #4A3525, #1C120A)' : 'radial-gradient(circle at 35% 30%, #F0DCA8, #C9A85E)', border: '2px solid rgba(255,255,255,.35)' }} />
        )}
        <div style={{ color: '#FBF7EE', fontWeight: 800, fontSize: 14, fontFamily: "'Suez One', serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{name}{you ? ' (אתה)' : ''}</div>
        {active && <span style={{ fontSize: 11, color: '#E8C879', fontWeight: 700, flex: 'none', whiteSpace: 'nowrap' }}>● תור</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,.25)', borderRadius: 10, padding: '5px 10px', border: '1px solid rgba(255,255,255,.10)', alignSelf: 'flex-start' }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: dark ? 'radial-gradient(circle at 35% 30%, #F0DCA8, #C9A85E)' : 'radial-gradient(circle at 35% 30%, #4A3525, #1C120A)', border: '1.5px solid rgba(255,255,255,.3)' }} />
        <span style={{ color: '#F0E2C6', fontWeight: 800, fontSize: 15 }}>{captured}</span>
      </div>
      {!you && addFriendNode}
    </div>
  )
}

function CheckersStage({
  onBack, onHome, statusText, topName, topActive, bottomName, bottomActive,
  board, selected, destinations, lastMove, onCellTap, disabled,
  onReset, onChangeMode, isOnline, children, chat = [], meUid, meName, roomId, flip,
  withVideo, topUid, bottomUid, myPhoto, addFriendNode, burning = [],
}) {
  const [muted, setMutedState] = useState(() => isMuted())
  const toggleMute = () => { const n = !muted; setMutedState(n); setMuted(n) }
  const [chatOpen, setChatOpen] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)

  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem('beyahad_checkers_music') !== 'off' } catch { return true } })
  const [trackIdx, setTrackIdx] = useState(() => Math.floor(Math.random() * MUSIC_TRACKS.length))
  const [musicVol, setMusicVol] = useState(isOnline ? 0.07 : 0.10)
  const audioRef = useRef(null)
  const nextTrack = () => setTrackIdx(i => (i + 1) % MUSIC_TRACKS.length)
  const toggleMusic = () => setMusicOn(o => { const n = !o; try { localStorage.setItem('beyahad_checkers_music', n ? 'on' : 'off') } catch { /* ignore */ } return n })
  const volDown = () => setMusicVol(v => Math.max(0.01, Math.round((v - 0.03) * 100) / 100))
  const volUp = () => { setMusicVol(v => Math.min(0.60, Math.round((v + 0.03) * 100) / 100)); setMusicOn(o => { if (o) return o; try { localStorage.setItem('beyahad_checkers_music', 'on') } catch {} return true }) }
  useEffect(() => {
    const a = audioRef.current; if (!a) return
    if (musicOn) { a.volume = musicVol; a.play().catch(() => {}) } else { a.pause() }
  }, [musicOn, trackIdx, musicVol])
  useEffect(() => {
    const kick = () => { const a = audioRef.current; if (a && musicOn && a.paused) a.play().catch(() => {}) }
    window.addEventListener('pointerdown', kick); window.addEventListener('touchstart', kick)
    return () => { window.removeEventListener('pointerdown', kick); window.removeEventListener('touchstart', kick) }
  }, [musicOn])

  const [isPortrait, setIsPortrait] = useState(() => typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const h = (e) => setIsPortrait(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

  const p1Left = countPieces(board, P1)
  const p2Left = countPieces(board, P2)
  const p1Captured = 12 - p2Left
  const p2Captured = 12 - p1Left
  const youCap = flip ? p2Captured : p1Captured
  const oppCap = flip ? p1Captured : p2Captured

  const ctlBtn = { height: 44, width: '100%', borderRadius: 12, background: 'rgba(26,17,9,.88)', border: '1px solid rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: '#E8C879', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(0,0,0,.45)' }
  const exitBtn = { ...ctlBtn, background: 'rgba(150,52,46,.92)', border: '1px solid rgba(216,120,108,.65)', color: '#ffd9d2' }

  const gameInner = (
    <div style={{ position: isPortrait ? 'absolute' : 'fixed', inset: 0, zIndex: 1000, background: 'url(/checkers-bg.jpg) center/cover no-repeat #2A1C10', direction: 'rtl', fontFamily: 'Heebo, sans-serif', overflow: 'hidden', display: 'flex', gap: 10, padding: 12, boxSizing: 'border-box' }}>
      <CkSteam />
      <div style={{ width: 172, flex: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CkPlayerPanel name={bottomName} active={bottomActive} captured={youCap} dark={false} withVideo={withVideo} uid={bottomUid} you photoURL={myPhoto} />
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ textAlign: 'center', color: '#F6E8C8', fontFamily: "'Suez One', serif", fontSize: 15, fontWeight: 800, lineHeight: 1.2, minHeight: 20, background: 'rgba(26,17,9,.85)', borderRadius: 10, padding: '6px 8px', boxShadow: '0 3px 10px rgba(0,0,0,.45)' }}>{statusText}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isOnline && meUid && <button onClick={() => setChatOpen(true)} title="צ'אט" aria-label="צ'אט" style={{ ...ctlBtn, flex: 1 }}>💬</button>}
            <button onClick={toggleMute} title="צלילים" aria-label="צלילים" style={{ ...ctlBtn, flex: 1, opacity: muted ? 0.5 : 1 }}>{muted ? <IconSpeakerOff size={20} color="#E8C879" /> : <IconSpeaker size={20} color="#E8C879" />}</button>
            <CkMusicButton musicOn={musicOn} onToggle={toggleMusic} onNext={nextTrack} vol={musicVol} onVolDown={volDown} onVolUp={volUp} btnStyle={ctlBtn} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{ height: '100%', maxHeight: '100%', aspectRatio: '1 / 1', maxWidth: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%' }}>
            <CheckersBoard board={board} selected={selected} destinations={destinations} lastMove={lastMove} onCellTap={onCellTap} disabled={disabled} flip={flip} burning={burning} />
          </div>
        </div>
      </div>

      <div style={{ width: 172, flex: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
        <CkPlayerPanel name={topName} active={topActive} captured={oppCap} dark={true} withVideo={withVideo} uid={topUid} addFriendNode={addFriendNode} />
        <button onClick={() => setConfirmExit(true)} aria-label="יציאה" title="יציאה" style={{ ...exitBtn, marginTop: 'auto', gap: 8, fontSize: 15, fontWeight: 800 }}>✕ יציאה</button>
      </div>

      <audio ref={audioRef} src={MUSIC_TRACKS[trackIdx]} onEnded={nextTrack} onPlay={(e) => { e.currentTarget.volume = musicVol }} style={{ display: 'none' }} />
      {chatOpen && isOnline && meUid && <ChatPanel roomId={roomId} me={{ uid: meUid, name: meName }} msgs={chat} onClose={() => setChatOpen(false)} />}
      {confirmExit && (
        <LeaveConfirmModal
          title="לעזוב את המשחק?"
          subtitle={isOnline ? 'המשחק יסתיים והיריב יקבל הודעה' : 'המשחק הנוכחי יסתיים'}
          stayLabel="לא, להישאר במשחק"
          leaveLabel="כן, לצאת"
          onStay={() => setConfirmExit(false)}
          onLeave={() => { setConfirmExit(false); onBack && onBack() }}
        />
      )}
      {children}
    </div>
  )

  if (isPortrait) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '100vh', height: '100vw', transform: 'translate(-50%, -50%) rotate(90deg)', transformOrigin: 'center center' }}>
          {gameInner}
        </div>
      </div>
    )
  }
  return gameInner
}
