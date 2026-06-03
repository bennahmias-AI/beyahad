// src/pages/Connect4Game.jsx
// ─────────────────────────────────────────────────────────────
// משחק "4 בשורה" (Connect 4).
//
// 4 מצבי משחק:
//   1. נגד המחשב — 3 רמות קושי (קל / בינוני / קשה)
//   2. שני שחקנים על אותו מכשיר
//   3. שחקן רנדומלי אונליין (matchmaking דרך Firestore)
//   4. שחק עם חבר אונליין (הזמנה מתוך רשימת החברים)
//
// הלוח: 7 עמודות × 6 שורות. המטרה: לחבר 4 דיסקיות בשורה.
//
// מבנה הקובץ:
//   • לוגיקת המשחק (טהורה)
//   • AI (3 רמות)
//   • קומפוננטות UI (מסכי בחירה + מסך המשחק)
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { IconBackRTL } from '../icons/index.jsx'
import HomeButton from '../components/HomeButton.jsx'
import { GameIcon } from '../icons/gameIcons.jsx'
import { useUserStore } from '../stores/userStore.js'
import {
  createGameRoom, joinGameRoom, watchGameRoom,
  updateGameState, updateGameRoom, leaveGameRoom, findRoomByCode, findOrCreateMatch,
  watchFriendships, sendGameInvite, watchInvite, deleteGameInvite,
  watchUser,
} from '../services/firebase.js'
import { playSound, isMuted, setMuted } from '../utils/gameSounds.js'
import Avatar from '../components/Avatar.jsx'
import { AddFriendButton, ChatHeaderButton, ChatPanel, ChatToast } from '../components/GameChat.jsx'
import { GameVideoProvider, PlayerVideo, VideoControls, VideoConsentGate, RemoteVideoToggles, ProfilesProvider, usePlayerProfile } from '../components/GameVideo.jsx'

// ── קבועים ─────────────────────────────────────────────
const COLS = 7
const ROWS = 6
const EMPTY = null
const P1 = 1  // שחקן 1 — בורדו
const P2 = 2  // שחקן 2 (או מחשב) — מאסטרד

// המרה בין לוח 2D ללוח שטוח (לצורך Firestore שלא תומך ב-nested arrays)
function boardToFlat(board2D) {
  const flat = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      flat.push(board2D[r][c])
    }
  }
  return flat
}

function flatToBoard(flat) {
  if (!flat || flat.length !== ROWS * COLS) return createBoard()
  const board = []
  for (let r = 0; r < ROWS; r++) {
    const row = []
    for (let c = 0; c < COLS; c++) {
      row.push(flat[r * COLS + c])
    }
    board.push(row)
  }
  return board
}

// המרה בין מערך של זוגות למערך של מחרוזות (ולהפך)
function cellsToStrings(cells) {
  return cells.map(([r, c]) => `${r},${c}`)
}

function stringsToCells(strings) {
  return (strings || []).map(s => s.split(',').map(Number))
}

// ════════════════════════════════════════════════════════
// לוגיקת המשחק — פונקציות טהורות
// ════════════════════════════════════════════════════════

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY))
}

function getLowestEmptyRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === EMPTY) return r
  }
  return -1
}

function makeMove(board, col, player) {
  const row = getLowestEmptyRow(board, col)
  if (row === -1) return null
  const newBoard = board.map(r => [...r])
  newBoard[row][col] = player
  return { board: newBoard, row, col }
}

function checkWin(board, lastRow, lastCol, player) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]]
  for (const [dr, dc] of directions) {
    const cells = [[lastRow, lastCol]]
    for (let i = 1; i < 4; i++) {
      const r = lastRow + dr * i, c = lastCol + dc * i
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break
      if (board[r][c] !== player) break
      cells.push([r, c])
    }
    for (let i = 1; i < 4; i++) {
      const r = lastRow - dr * i, c = lastCol - dc * i
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break
      if (board[r][c] !== player) break
      cells.unshift([r, c])
    }
    if (cells.length >= 4) {
      for (let i = 0; i <= cells.length - 4; i++) {
        const segment = cells.slice(i, i + 4)
        if (segment.some(([r, c]) => r === lastRow && c === lastCol)) return segment
      }
    }
  }
  return null
}

function isBoardFull(board) {
  return board[0].every(cell => cell !== EMPTY)
}

function getValidColumns(board) {
  const cols = []
  for (let c = 0; c < COLS; c++) {
    if (board[0][c] === EMPTY) cols.push(c)
  }
  return cols
}

// ════════════════════════════════════════════════════════
// AI — 3 רמות קושי (זהה לגרסה הקודמת)
// ════════════════════════════════════════════════════════

function aiEasy(board) {
  const valid = getValidColumns(board)
  return valid[Math.floor(Math.random() * valid.length)]
}

function aiMedium(board, me, opponent) {
  const valid = getValidColumns(board)
  for (const col of valid) {
    const result = makeMove(board, col, me)
    if (result && checkWin(result.board, result.row, result.col, me)) return col
  }
  for (const col of valid) {
    const result = makeMove(board, col, opponent)
    if (result && checkWin(result.board, result.row, result.col, opponent)) return col
  }
  const centerCols = [3, 2, 4, 1, 5, 0, 6]
  for (const col of centerCols) {
    if (valid.includes(col)) return col
  }
  return valid[0]
}

function evaluatePosition(board, player) {
  const opponent = player === P1 ? P2 : P1
  let score = 0
  for (let r = 0; r < ROWS; r++) {
    if (board[r][3] === player) score += 3
  }
  const evalWindow = (window) => {
    const mineCount = window.filter(c => c === player).length
    const oppCount = window.filter(c => c === opponent).length
    const emptyCount = window.filter(c => c === EMPTY).length
    if (mineCount === 4) return 100
    if (mineCount === 3 && emptyCount === 1) return 5
    if (mineCount === 2 && emptyCount === 2) return 2
    if (oppCount === 3 && emptyCount === 1) return -4
    return 0
  }
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      score += evalWindow([board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]])
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r <= ROWS - 4; r++)
      score += evalWindow([board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]])
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c <= COLS - 4; c++)
      score += evalWindow([board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]])
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 3; c < COLS; c++)
      score += evalWindow([board[r][c], board[r+1][c-1], board[r+2][c-2], board[r+3][c-3]])
  return score
}

function minimax(board, depth, alpha, beta, maximizing, me, opponent) {
  const valid = getValidColumns(board)
  if (valid.length === 0) return { col: null, score: 0 }
  if (depth === 0) return { col: null, score: evaluatePosition(board, me) }
  if (maximizing) {
    let value = -Infinity
    let bestCol = valid[Math.floor(Math.random() * valid.length)]
    for (const col of valid) {
      const result = makeMove(board, col, me)
      if (!result) continue
      const win = checkWin(result.board, result.row, result.col, me)
      if (win) return { col, score: 1000000 + depth }
      const { score } = minimax(result.board, depth - 1, alpha, beta, false, me, opponent)
      if (score > value) { value = score; bestCol = col }
      alpha = Math.max(alpha, value)
      if (alpha >= beta) break
    }
    return { col: bestCol, score: value }
  } else {
    let value = Infinity
    let bestCol = valid[Math.floor(Math.random() * valid.length)]
    for (const col of valid) {
      const result = makeMove(board, col, opponent)
      if (!result) continue
      const win = checkWin(result.board, result.row, result.col, opponent)
      if (win) return { col, score: -1000000 - depth }
      const { score } = minimax(result.board, depth - 1, alpha, beta, true, me, opponent)
      if (score < value) { value = score; bestCol = col }
      beta = Math.min(beta, value)
      if (alpha >= beta) break
    }
    return { col: bestCol, score: value }
  }
}

function aiHard(board, me, opponent) {
  const { col } = minimax(board, 4, -Infinity, Infinity, true, me, opponent)
  if (col === null || col === undefined) return aiMedium(board, me, opponent)
  return col
}

function aiPickColumn(board, difficulty, me, opponent) {
  if (difficulty === 'easy') return aiEasy(board)
  if (difficulty === 'medium') return aiMedium(board, me, opponent)
  return aiHard(board, me, opponent)
}

// ════════════════════════════════════════════════════════
// קומפוננטה ראשית
// ════════════════════════════════════════════════════════
// mode: 'ai' | 'local' | 'online-random' | 'online-friend-host' | 'online-friend-join'
// ════════════════════════════════════════════════════════
export default function Connect4Game({ onBack, onHome, initialRoomId, autoInviteFriend = null }) {
  const [mode, setMode] = useState(initialRoomId ? 'online-friend' : (autoInviteFriend ? 'online-friend' : null))
  const [difficulty, setDifficulty] = useState('medium')
  const [roomId, setRoomId] = useState(initialRoomId || null)  // למצבי אונליין

  // אם הגענו לכאן דרך אישור הזמנה (initialRoomId) — נכנסים ישר לחדר
  useEffect(() => {
    if (initialRoomId) {
      setMode('online-friend')
      setRoomId(initialRoomId)
    }
  }, [initialRoomId])

  // אם לא בחרו מצב — מסך בחירה
  if (!mode) {
    return (
      <ModeSelectScreen
        onBack={onBack}
        onHome={onHome}
        onSelectAI={(diff) => { setDifficulty(diff); setMode('ai') }}
        onSelectLocal={() => setMode('local')}
        onSelectOnlineRandom={() => setMode('online-random')}
        onSelectOnlineFriend={() => setMode('online-friend')}
      />
    )
  }

  // מצבי אונליין דורשים lobby (חיבור לחדר) לפני שמתחילים
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
      <OnlineGameScreen
        roomId={roomId}
        onBack={() => { setRoomId(null); setMode(null) }}
        onHome={onHome}
        onExit={onBack}
        onFindOther={() => { setRoomId(null); setMode('online-random') }}
      />
    )
  }

  // מצב AI / שני שחקנים מקומי
  return (
    <LocalGameScreen
      mode={mode}
      difficulty={difficulty}
      onBack={() => setMode(null)}
      onHome={onHome}
      onExit={onBack}
    />
  )
}

// ════════════════════════════════════════════════════════
// מסך בחירת מצב משחק
// ════════════════════════════════════════════════════════
function ModeSelectScreen({ onBack, onHome, onSelectAI, onSelectLocal, onSelectOnlineRandom, onSelectOnlineFriend }) {
  const [showDifficulty, setShowDifficulty] = useState(false)

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">4 בשורה</div>
      </div>

      <div style={{ padding: '8px 20px 32px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #7E2C2E 0%, #5A1D1E 100%)',
          borderRadius: 20, padding: '20px 18px',
          color: '#FBF7EE', marginBottom: 24,
          boxShadow: '0 8px 20px -6px rgba(126,44,46,.4)',
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <GameIcon id="connect4" size={52} />
          </div>
          <div className="h-display" style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 6 }}>
            4 בשורה
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'rgba(255,255,255,.92)' }}>
            הפילו דיסקיות וחברו 4 ברצף ראשונים
          </div>
        </div>

        {!showDifficulty ? (
          <>
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>
              בחרו איך לשחק:
            </h2>

            {/* 🌐 שחקן רנדומלי אונליין */}
            <ModeButton
              onClick={onSelectOnlineRandom}
              iconId="online-random"
              gradient="linear-gradient(135deg, #7E2C2E, #5A1D1E)"
              label="שחקן רנדומלי"
              description="שחקו עם מישהו אחר באפליקציה"
              badge="חדש"
            />

            {/* 👫 שחק עם חבר */}
            <ModeButton
              onClick={onSelectOnlineFriend}
              iconId="online-friend"
              gradient="linear-gradient(135deg, #4F6B4A, #354D31)"
              label="שחק עם חבר"
              description="הזמינו חבר מרשימת החברים שלכם"
              badge="חדש"
            />

            {/* 🤖 נגד המחשב */}
            <ModeButton
              onClick={() => setShowDifficulty(true)}
              iconId="vs-ai"
              gradient="linear-gradient(135deg, #2C5566, #173846)"
              label="נגד המחשב"
              description="משחק לבד בכל זמן"
            />

            {/* 👥 שני שחקנים */}
            <ModeButton
              onClick={onSelectLocal}
              iconId="local-2p"
              gradient="linear-gradient(135deg, #B89048, #8A6A2E)"
              label="שני שחקנים"
              description="על אותו מכשיר — אחד מול השני"
            />
          </>
        ) : (
          <>
            <button
              onClick={() => setShowDifficulty(false)}
              style={{
                background: 'none', border: 'none', padding: 0,
                color: 'var(--ink-2)', fontSize: 14, fontWeight: 700,
                fontFamily: 'inherit', cursor: 'pointer',
                marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <IconBackRTL size={18} color="#8389A4" /> חזרה
            </button>
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>
              בחרו רמת קושי:
            </h2>
            <DifficultyButton label="קל" emoji="🌱" color="#4F6B4A"
              description="מתאים להתחלה — המחשב משחק לאט"
              onClick={() => onSelectAI('easy')} />
            <DifficultyButton label="בינוני" emoji="⚡" color="#B89048"
              description="המחשב חוסם ומנסה לנצח"
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
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'right',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: '16px 16px',
        marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 14,
        fontFamily: 'inherit',
        boxShadow: 'var(--shadow-sm)',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {badge && (
        <div style={{
          position: 'absolute', top: -8, insetInlineStart: 12,
          background: 'var(--burgundy)', color: 'white',
          fontSize: 11, fontWeight: 800,
          padding: '2px 10px', borderRadius: 999,
          letterSpacing: '0.04em',
        }}>
          ✨ {badge}
        </div>
      )}
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <GameIcon id={iconId} size={36} />
      </div>
      <div style={{ flex: 1 }}>
        <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)', lineHeight: 1.15 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginTop: 2 }}>
          {description}
        </div>
      </div>
      <IconBackRTL size={20} color="#8389A4" />
    </button>
  )
}

function DifficultyButton({ label, emoji, color, description, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'right',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 16,
      padding: '14px 16px',
      marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 12,
      fontFamily: 'inherit',
      boxShadow: 'var(--shadow-sm)',
      cursor: 'pointer',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: color,
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
// Lobby אונליין — חיבור לחדר משחק (רנדומלי / חבר)
// ════════════════════════════════════════════════════════
function OnlineLobby({ mode, onBack, onHome, onReady, autoInviteFriend = null }) {
  const { profile, authUser } = useUserStore()
  // phase: במצב 'online-random' מתחילים ישר ב-'searching' (כמו קפה בסלון).
  // במצב 'online-friend' מתחילים ב-'friend-list' (בחירת חבר מהרשימה).
  const [phase, setPhase] = useState(
    mode === 'online-random' ? 'searching' : 'friend-list'
  )
  const [errorMsg, setErrorMsg] = useState('')
  const [elapsed, setElapsed] = useState(0)  // טיימר התקדמות
  const [createdRoomId, setCreatedRoomId] = useState(null)
  const [invitedFriend, setInvitedFriend] = useState(null)  // החבר שהזמננו
  const [inviteId, setInviteId] = useState(null)  // ה-id של ההזמנה ששלחנו
  const [friends, setFriends] = useState([])  // רשימת החברים של המשתמש
  const watchUnsubRef = useRef(null)
  const inviteUnsubRef = useRef(null)
  const friendsUnsubRef = useRef(null)
  const startedRef = useRef(false)        // למניעת ריצה כפולה של startRandom
  const successfulMatchRef = useRef(false) // האם הצלחנו להתחבר — אם כן, לא למחוק חדר ב-cleanup
  const autoInvitedRef = useRef(false)

  // הזמנה אוטומטית — כשהגיעו מ"משחק עם חבר" בדף החברים
  useEffect(() => {
    if (!autoInviteFriend || autoInvitedRef.current || !authUser?.uid) return
    autoInvitedRef.current = true
    inviteFriend(autoInviteFriend)
    // eslint-disable-next-line
  }, [autoInviteFriend, authUser?.uid])

  // ── טעינת רשימת החברים במצב שחק עם חבר ──
  useEffect(() => {
    if (mode !== 'online-friend' || !authUser?.uid) return
    friendsUnsubRef.current = watchFriendships(authUser.uid, ({ friends }) => {
      setFriends(friends)
    })
    return () => {
      if (friendsUnsubRef.current) friendsUnsubRef.current()
    }
  }, [mode, authUser?.uid])

  // ── מתחילים matchmaking רנדומלי אוטומטית בכניסה (כמו KafeWaitingPage) ──
  useEffect(() => {
    if (mode !== 'online-random' || startedRef.current) return
    startedRef.current = true
    startRandom()
    // eslint-disable-next-line
  }, [mode])

  // ── טיימר התקדמות (מציג כמה זמן מחפשים/מחכים) ──
  useEffect(() => {
    if (phase !== 'searching' && phase !== 'waiting') return
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  // ── ניקוי כשעוזבים את ה-lobby ──
  // חשוב: ה-effect הזה ללא dependencies (מערך ריק) כך שהוא רץ פעם אחת בלבד.
  // ה-cleanup רץ רק כשהקומפוננטה נהרסת (לא כל פעם ש-createdRoomId משתנה).
  // משתמשים ב-ref כדי לקרוא את הערך העדכני של createdRoomId בזמן ה-cleanup.
  const createdRoomIdRef = useRef(null)
  useEffect(() => { createdRoomIdRef.current = createdRoomId }, [createdRoomId])

  useEffect(() => {
    return () => {
      if (watchUnsubRef.current) watchUnsubRef.current()
      // אם יצרנו חדר ולא הצלחנו להתחבר — מוחקים את הזבל
      const roomToClean = createdRoomIdRef.current
      if (roomToClean && !successfulMatchRef.current) {
        console.log('🧹 Cleaning up unmatched room:', roomToClean)
        leaveGameRoom(roomToClean).catch(() => {})
      }
    }
    // eslint-disable-next-line
  }, [])  // ← מערך ריק = רץ פעם אחת, cleanup רק בעת unmount

  // התחלת matchmaking רנדומלי
  const startRandom = async () => {
    if (!authUser?.uid) {
      setErrorMsg('צריך להיות מחובר כדי לשחק אונליין')
      setPhase('error')
      return
    }
    setErrorMsg('')
    try {
      console.log('🔍 Searching for Connect4 match...')
      const player = { uid: authUser.uid, name: profile?.name || 'משתמש' }
      const { roomId, isCreator } = await findOrCreateMatch({ gameType: 'connect4', player })
      setCreatedRoomId(roomId)
      console.log('🎮 Room obtained:', roomId, '| isCreator:', isCreator)

      if (isCreator) {
        // אנחנו יצרנו — מחכים לשחקן שני
        setPhase('waiting')
        console.log('👀 Starting listener on room:', roomId)
        watchUnsubRef.current = watchGameRoom(roomId, (data) => {
          console.log('📡 Room update received:', {
            exists: !!data,
            status: data?.status,
            playersCount: (data?.players || []).length,
          })
          // הצליח אם status==='playing' או אם יש 2 שחקנים
          if (data && (data.status === 'playing' || (data.players || []).length === 2)) {
            console.log('🎯 Match found! Opponent joined.')
            successfulMatchRef.current = true
            // ביטול ה-listener מיד כדי שלא יקרא שוב
            if (watchUnsubRef.current) {
              watchUnsubRef.current()
              watchUnsubRef.current = null
            }
            onReady(roomId)
          }
        })
      } else {
        // הצטרפנו לחדר קיים — מתחילים מיד
        console.log('🎯 Joined existing room!')
        successfulMatchRef.current = true
        onReady(roomId)
      }
    } catch (e) {
      console.error('❌ Matchmaking error:', e)
      console.error('Error code:', e.code, 'Message:', e.message)
      // הודעות שגיאה מפורטות לפי סוג השגיאה
      let msg = 'לא הצלחנו למצוא משחק — נסו שוב'
      if (e.code === 'permission-denied' || (e.message || '').includes('permission')) {
        msg = 'בעיה בהרשאות Firestore — נדרשת הגדרת security rules'
      } else if ((e.message || '').includes('network') || (e.message || '').includes('offline')) {
        msg = 'בעיית רשת — בדקו את החיבור לאינטרנט'
      }
      setErrorMsg(msg)
      setPhase('error')
    }
  }

  // הזמנת חבר למשחק — יוצר חדר פרטי ושולח הזמנה ל-Firestore
  const inviteFriend = async (friend) => {
    if (!authUser?.uid) return
    setErrorMsg('')
    try {
      const player = { uid: authUser.uid, name: profile?.name || 'משתמש' }
      // שלב 1: יוצרים חדר פרטי
      const { roomId } = await createGameRoom({
        gameType: 'connect4',
        creator: player,
        roomType: 'private',
      })
      setCreatedRoomId(roomId)

      // שלב 2: שולחים הזמנה לחבר
      const newInviteId = await sendGameInvite({
        from: player,
        to: { uid: friend.otherUid, name: friend.otherName },
        gameType: 'connect4',
        roomId,
      })
      setInviteId(newInviteId)
      setInvitedFriend(friend)
      setPhase('waiting-for-friend')

      // שלב 3: מאזינים לתגובת החבר — גם לההזמנה (accept/decline) וגם לחדר (הצטרפות בפועל)
      inviteUnsubRef.current = watchInvite(newInviteId, (data) => {
        if (!data) return
        if (data.status === 'declined') {
          setErrorMsg(`${friend.otherName} דחתה את ההזמנה`)
          setPhase('friend-declined')
          // מנקים את ההזמנה ואת החדר
          deleteGameInvite(newInviteId).catch(() => {})
          leaveGameRoom(roomId).catch(() => {})
        }
      })

      watchUnsubRef.current = watchGameRoom(roomId, (data) => {
        if (data && (data.status === 'playing' || (data.players || []).length === 2)) {
          // החבר הצטרף!
          console.log('🎯 Friend joined!')
          successfulMatchRef.current = true
          if (watchUnsubRef.current) {
            watchUnsubRef.current()
            watchUnsubRef.current = null
          }
          if (inviteUnsubRef.current) {
            inviteUnsubRef.current()
            inviteUnsubRef.current = null
          }
          // מוחקים את ההזמנה (היא מילאה את תפקידה)
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

  // ביטול הזמנה ממסך ההמתנה (אם המשתמש לוחץ חזרה)
  const cancelInvite = () => {
    if (inviteId) deleteGameInvite(inviteId).catch(() => {})
    if (createdRoomId) leaveGameRoom(createdRoomId).catch(() => {})
    if (watchUnsubRef.current) { watchUnsubRef.current(); watchUnsubRef.current = null }
    if (inviteUnsubRef.current) { inviteUnsubRef.current(); inviteUnsubRef.current = null }
    setInviteId(null)
    setCreatedRoomId(null)
    setInvitedFriend(null)
    setPhase('friend-list')
  }

  // ── פורמט זמן לטיימר ──
  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // ── מסך מלא למצב חיפוש/המתנה (בסגנון של קפה בסלון) ──
  if (phase === 'searching' || phase === 'waiting') {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'linear-gradient(180deg, #1A2547 0%, #2B2A45 100%)',
        color: 'white',
        display: 'flex', flexDirection: 'column',
        padding: '32px 24px 28px',
        direction: 'rtl', zIndex: 100,
      }}>
        {/* כפתור חזרה למעלה */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={onBack} style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'rgba(255,255,255,.12)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, border: 'none', cursor: 'pointer',
          }}>←</button>
        </div>

        {/* איזור מרכזי — איקון עם גלי פעימה */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 28,
        }}>
          <div style={{ position: 'relative', width: 200, height: 200 }}>
            {/* גלי פעימה ברקע */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '3px solid rgba(255,255,255,.15)',
              animation: 'gameLobbyPulse 1.5s ease-out infinite',
            }}/>
            <div style={{
              position: 'absolute', inset: 20, borderRadius: '50%',
              border: '3px solid rgba(255,255,255,.10)',
              animation: 'gameLobbyPulse 1.5s ease-out 0.5s infinite',
            }}/>
            {/* איקון מרכזי — דיסקית המשחק */}
            <div style={{
              position: 'absolute', inset: 40, borderRadius: '50%',
              background: '#7E2C2E',
              border: '4px solid #E8C879',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 56,
            }}>🔴</div>
          </div>

          {/* כותרת וסטטוס */}
          <div style={{ textAlign: 'center' }}>
            {phase === 'searching' && (
              <>
                <div style={{
                  fontSize: 28, fontWeight: 800,
                  fontFamily: "'Suez One', serif",
                }}>
                  מחפש לך יריב...
                </div>
                <div style={{ fontSize: 16, opacity: 0.85, marginTop: 8 }}>
                  ⏱ {formatTime(elapsed)}
                </div>
              </>
            )}
            {phase === 'waiting' && (
              <>
                <div style={{
                  fontSize: 28, fontWeight: 800,
                  fontFamily: "'Suez One', serif",
                }}>
                  מחכים ליריב...
                </div>
                <div style={{ fontSize: 16, opacity: 0.85, marginTop: 8 }}>
                  ⏱ {formatTime(elapsed)}
                </div>
              </>
            )}
          </div>

          {/* הסבר מעודד */}
          <div style={{
            background: 'rgba(255,255,255,.10)',
            borderRadius: 16, padding: '14px 18px',
            fontSize: 15, fontWeight: 500, textAlign: 'center', lineHeight: 1.5,
            maxWidth: 320,
          }}>
            💡 כשעוד מישהו ילחץ על "4 בשורה"<br/>
            תתחבר אליו אוטומטית
          </div>
        </div>

        {/* כפתור ביטול גדול */}
        <button
          onClick={onBack}
          className="big-btn big-btn--danger"
          style={{ width: '100%' }}
        >
          ✕ ביטול
        </button>

        <style>{`
          @keyframes gameLobbyPulse {
            0% { transform: scale(0.9); opacity: 1; }
            100% { transform: scale(1.6); opacity: 0; }
          }
        `}</style>
      </div>
    )
  }

  // ── רינדור לפי phase (שאר המסכים) ──
  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">
          {mode === 'online-random' ? 'שחקן רנדומלי' : 'שחק עם חבר'}
        </div>
      </div>

      <div style={{ padding: '20px 20px 32px' }}>
        {phase === 'friend-list' && (
          <FriendListScreen
            friends={friends}
            onInvite={inviteFriend}
            onGoFriends={onBack}
          />
        )}

        {phase === 'waiting-for-friend' && invitedFriend && (
          <WaitingForFriendScreen
            friendName={invitedFriend.otherName}
            onCancel={cancelInvite}
          />
        )}

        {phase === 'friend-declined' && (
          <CenteredCard
            emoji="😕"
            title="ההזמנה נדחתה"
            description={errorMsg || 'החבר לא הצטרף למשחק'}
            actionLabel="חזרה לרשימת החברים"
            onAction={() => setPhase('friend-list')}
          />
        )}

        {phase === 'error' && (
          <CenteredCard
            emoji="😕"
            title="משהו השתבש"
            description={errorMsg || 'נסו שוב'}
            actionLabel="חזרה"
            onAction={onBack}
          />
        )}
      </div>
    </div>
  )
}

// כרטיס מרוכז במרכז המסך — לשלבי המתנה / שגיאה
function CenteredCard({ emoji, title, description, actionLabel, onAction, spinner }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 20,
      padding: '32px 24px',
      textAlign: 'center',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        fontSize: 56, marginBottom: 14,
        animation: spinner ? 'pulse 1.8s ease-in-out infinite' : 'none',
      }}>{emoji}</div>
      <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.4, marginBottom: 18 }}>
        {description}
      </div>
      {actionLabel && (
        <button onClick={onAction} className="big-btn big-btn--primary" style={{ width: '100%' }}>
          {actionLabel}
        </button>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// מסך בחירת חבר להזמנה — מציג את רשימת החברים של המשתמש.
// לחיצה על חבר שולחת לו הזמנה למשחק. אם אין חברים — מציג מסך ריק.
// ═════════════════════════════════════════════════════════════
function FriendListScreen({ friends, onInvite, onGoFriends }) {
  // ── אין חברים עדיין — מסך ריק עם הסבר ──
  if (!friends || friends.length === 0) {
    return (
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 20,
        padding: '36px 24px',
        textAlign: 'center',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ fontSize: 56, marginBottom: 14 }}>👥</div>
        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
          אין לך עדיין חברים ברשימה
        </div>
        <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5, marginBottom: 20 }}>
          כשתדברו עם מישהו בקפה או בפרלמנט,
          תוכלו להוסיף אותו כחבר — ואז להזמין אותו למשחק.
        </div>
        <button onClick={onGoFriends} className="big-btn big-btn--ghost" style={{ width: '100%' }}>
          חזרה
        </button>
      </div>
    )
  }

  // ── יש חברים — מחלקים למחוברים (ירוק) / לא מחוברים (אדום) ──
  return <FriendListBody friends={friends} onInvite={onInvite} />
}

// גוף הרשימה — מרכז מעקב אחר חיבור כל החברים ומחלק לשתי קבוצות
function FriendListBody({ friends, onInvite }) {
  const [onlineMap, setOnlineMap] = useState({})
  // מפת פרופילים חיים — תמונה ושם מלא לכל חבר (חבר → תמיד שם מלא)
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
      <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 6px', color: 'var(--ink)' }}>
        בחרו חבר להזמין
      </h2>
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

// שורת חבר אחד — ירוק כשמחובר, אדום (בורדו) כשלא.
// מציג תמונה ושם מלא חיים (חבר → תמיד שם מלא) עם fallback לשם מהרשימה.
function FriendInviteRow({ friend, profile, online, onInvite }) {
  const displayName = profile?.name || friend.otherName
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 16, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <Avatar name={displayName} size={50} online={online} photoURL={profile?.photoURL} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="h-display" style={{ fontSize: 17, color: 'var(--ink)' }}>
          {displayName}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: online ? 'var(--success)' : 'var(--ink-3)',
        }}>
          {online ? 'מחובר עכשיו' : 'לא מחובר'}
        </div>
      </div>
      <button
        onClick={onInvite}
        style={{
          background: online ? 'var(--success)' : 'var(--burgundy)',
          color: 'white', border: 'none',
          borderRadius: 12, padding: '11px 16px',
          fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
          cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        הזמן
      </button>
    </div>
  )
}

// מסך המתנה לתגובת החבר שהזמנו
function WaitingForFriendScreen({ friendName, onCancel }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 20,
      padding: '32px 24px',
      textAlign: 'center',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ fontSize: 56, marginBottom: 14, animation: 'waitInvitePulse 1.6s ease-in-out infinite' }}>
        📨
      </div>
      <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>
        שלחנו הזמנה ל{friendName}
      </div>
      <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.4, marginBottom: 22 }}>
        מחכים שיאשר ויצטרף למשחק...
      </div>
      <button onClick={onCancel} className="big-btn big-btn--ghost" style={{ width: '100%' }}>
        ביטול ההזמנה
      </button>
      <style>{`
        @keyframes waitInvitePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
      `}</style>
    </div>
  )
}

// מסך הצגת קוד ההזמנה + העתקה / שיתוף
function InviteCodeScreen({ code }) {
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {}
  }

  const shareCode = async () => {
    const text = `בוא לשחק איתי 4 בשורה ב"ביחד"!\nהקוד שלי: ${code}`
    if (navigator.share) {
      try {
        await navigator.share({ text })
      } catch (e) {}
    } else {
      copyCode()
    }
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 20,
      padding: '28px 24px',
      textAlign: 'center',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>📨</div>
      <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
        הקוד שלך מוכן
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 20 }}>
        שלח את הקוד הזה לחבר שלך
      </div>

      {/* הקוד — בלוק גדול ומודגש */}
      <div style={{
        background: 'linear-gradient(135deg, #7E2C2E, #5A1D1E)',
        color: '#FBF7EE',
        borderRadius: 16,
        padding: '24px 18px',
        marginBottom: 18,
        fontFamily: 'monospace',
        fontSize: 38,
        fontWeight: 800,
        letterSpacing: '0.2em',
        boxShadow: '0 8px 20px -6px rgba(126,44,46,.5)',
      }}>
        {code}
      </div>

      {/* כפתורי פעולה */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button onClick={copyCode} style={{
          flex: 1, padding: '12px',
          background: copied ? '#4F6B4A' : 'var(--surface)',
          color: copied ? 'white' : 'var(--ink)',
          border: '1px solid var(--line)', borderRadius: 12,
          fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
          cursor: 'pointer', transition: 'all 0.2s',
        }}>
          {copied ? '✓ הועתק' : '📋 העתק'}
        </button>
        <button onClick={shareCode} style={{
          flex: 1, padding: '12px',
          background: 'var(--burgundy)', color: 'white',
          border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
          cursor: 'pointer',
        }}>
          📲 שתף
        </button>
      </div>

      {/* סטטוס המתנה */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        color: 'var(--ink-2)', fontSize: 14, fontWeight: 600,
      }}>
        <span style={{ animation: 'pulse 1.5s infinite' }}>⏳</span>
        מחכים שהחבר יצטרף...
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

// מסך הקלדת קוד
function EnterCodeScreen({ code, setCode, onJoin, errorMsg }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 20,
      padding: '28px 24px',
      textAlign: 'center',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>🔑</div>
      <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
        הקלד קוד הזמנה
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 20 }}>
        קוד של 6 תווים שקיבלת מחבר
      </div>

      <input
        type="text"
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
        placeholder="ABC123"
        autoFocus
        style={{
          width: '100%', textAlign: 'center',
          fontFamily: 'monospace',
          fontSize: 28, fontWeight: 800,
          letterSpacing: '0.2em',
          padding: '16px 12px',
          borderRadius: 14,
          border: '2px solid var(--line-strong)',
          background: 'var(--bg-app)',
          color: 'var(--ink)',
          marginBottom: 12,
          boxSizing: 'border-box',
        }}
      />

      {errorMsg && (
        <div style={{
          background: 'var(--burgundy-soft)', color: 'var(--burgundy)',
          padding: '10px', borderRadius: 10,
          fontSize: 14, fontWeight: 700, marginBottom: 12,
        }}>
          {errorMsg}
        </div>
      )}

      <button onClick={onJoin}
        disabled={code.length !== 6}
        className="big-btn big-btn--primary"
        style={{ width: '100%', opacity: code.length === 6 ? 1 : 0.5 }}
      >
        הצטרף למשחק
      </button>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מסך המשחק — מקומי (AI / 2 שחקנים על אותו מכשיר)
// ════════════════════════════════════════════════════════
function LocalGameScreen({ mode, difficulty, onBack, onHome, onExit }) {
  const [board, setBoard] = useState(createBoard())
  const [currentPlayer, setCurrentPlayer] = useState(P1)
  const [winner, setWinner] = useState(null)
  const [winningCells, setWinningCells] = useState([])
  const [busy, setBusy] = useState(false)
  const [lastDropped, setLastDropped] = useState(null)

  const isAITurn = mode === 'ai' && currentPlayer === P2 && !winner

  useEffect(() => {
    if (!isAITurn) return
    setBusy(true)
    const delay = difficulty === 'hard' ? 600 : 400
    const timer = setTimeout(() => {
      const col = aiPickColumn(board, difficulty, P2, P1)
      playMove(col, P2)
      setBusy(false)
    }, delay)
    return () => clearTimeout(timer)
  }, [isAITurn, board, difficulty])

  const playMove = (col, player) => {
    const result = makeMove(board, col, player)
    if (!result) return
    playSound('drop')  // 🔊 סאונד של דיסקית נופלת
    setBoard(result.board)
    setLastDropped({ row: result.row, col: result.col })
    const win = checkWin(result.board, result.row, result.col, player)
    if (win) {
      setWinner(player)
      setWinningCells(win)
      // סאונד ניצחון/הפסד עם השהייה קלה כדי לא לדרוס את סאונד ה-drop
      setTimeout(() => {
        if (mode === 'ai' && player === P2) {
          playSound('lose')  // המחשב הביסו את השחקן
        } else {
          playSound('win')   // השחקן ניצח (או במצב 2-שחקנים)
        }
      }, 300)
    } else if (isBoardFull(result.board)) {
      setWinner('draw')
    } else {
      setCurrentPlayer(player === P1 ? P2 : P1)
    }
  }

  const handleColumnClick = (col) => {
    if (busy || winner) return
    if (isAITurn) return
    playMove(col, currentPlayer)
  }

  const resetGame = () => {
    setBoard(createBoard())
    setCurrentPlayer(P1)
    setWinner(null)
    setWinningCells([])
    setLastDropped(null)
    setBusy(false)
  }

  const statusText = (() => {
    if (winner === 'draw') return 'תיקו! 🤝'
    if (winner === P1) return mode === 'ai' ? 'ניצחת! 🎉' : 'שחקן 1 ניצח! 🎉'
    if (winner === P2) return mode === 'ai' ? 'המחשב ניצח 🤖' : 'שחקן 2 ניצח! 🎉'
    if (isAITurn) return 'המחשב חושב...'
    return mode === 'ai' ? 'התור שלך' : `תור שחקן ${currentPlayer}`
  })()

  const statusColor = winner === 'draw' ? '#8389A4'
                    : winner === P1 ? '#7E2C2E'
                    : winner === P2 ? '#B89048'
                    : currentPlayer === P1 ? '#7E2C2E' : '#B89048'

  return (
    <GameScreenLayout
      onBack={onBack}
      onHome={onHome}
      statusText={statusText}
      statusColor={statusColor}
      p1Name={mode === 'ai' ? 'אתה' : 'שחקן 1'}
      p2Name={mode === 'ai' ? 'מחשב' : 'שחקן 2'}
      currentPlayer={currentPlayer}
      winner={winner}
      board={board}
      winningCells={winningCells}
      lastDropped={lastDropped}
      onColumnClick={handleColumnClick}
      disabled={busy || !!winner}
      onReset={resetGame}
      onChangeMode={onBack}
      isOnline={false}
    >
      {winner && (
        <WinModal mode={mode} winner={winner} youArePlayer={P1}
          onPlayAgain={resetGame} onExit={onExit} />
      )}
    </GameScreenLayout>
  )
}

// ════════════════════════════════════════════════════════
// מסך המשחק — אונליין (סנכרון דרך Firestore)
// ════════════════════════════════════════════════════════
function OnlineGameScreen({ roomId, onBack, onHome, onExit, onFindOther }) {
  const { authUser, profile } = useUserStore()
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const [lastDropped, setLastDropped] = useState(null)
  const [videoChoice, setVideoChoice] = useState(null)  // null=טרם נשאל, true/false=הבחירה
  // מעקב אחר מספר המהלכים האחרון — כדי להפעיל סאונד 'drop' רק כשיש מהלך חדש
  const lastMoveKeyRef = useRef(null)
  // מעקב האם כבר ניגנו סאונד סיום — כדי לא לנגן אותו פעמיים
  const finishedSoundPlayedRef = useRef(false)

  // מסתכל על החדר בזמן אמת
  useEffect(() => {
    const unsub = watchGameRoom(roomId, (data) => {
      if (!data) {
        setError('היריב עזב את המשחק')
        return
      }
      setRoom(data)
      // אם יש מהלך חדש (לא ראינו אותו קודם) — מציגים אנימציה + סאונד
      const lm = data.gameState?.lastMove
      if (lm) {
        const moveKey = `${lm.row}-${lm.col}-${lm.player}`
        if (lastMoveKeyRef.current !== moveKey) {
          lastMoveKeyRef.current = moveKey
          setLastDropped(lm)
          playSound('drop')  // 🔊 סאונד דיסקית נופלת (גם למהלך של היריב)
        }
      }
    })
    return () => unsub && unsub()
  }, [roomId])

  // ניקוי בעת יציאה — מוחקים את החדר אם המשחק נגמר או יצאנו
  useEffect(() => {
    return () => {
      // השאר את החדר אם עדיין משחקים, אחרת מחק
      if (room && room.status === 'ended') {
        leaveGameRoom(roomId).catch(() => {})
      }
    }
  }, [roomId, room?.status])

  // ── חישובים נגזרים — חייבים להיות לפני כל useEffect/early-return ──
  // אחרת React מתבלבל בסדר ה-hooks (Rules of Hooks)
  const myUid = authUser?.uid
  const me = (room?.players || []).find(p => p.uid === myUid)
  const opponent = (room?.players || []).find(p => p.uid !== myUid)
  const myColor = me?.color || 'P1'
  const myColorNum = myColor === 'P1' ? P1 : P2
  const gameState = room?.gameState || {}
  const board = flatToBoard(gameState.board)
  const currentTurn = gameState.currentTurn || 'P1'
  const winner = gameState.winner
  const winningCells = stringsToCells(gameState.winningCells)
  const isMyTurn = currentTurn === myColor && !winner

  // ── מצב "שחק שוב" (rematch) — נשמר ברמת החדר, דורש אישור שני הצדדים ──
  const oppColor = myColor === 'P1' ? 'P2' : 'P1'
  const rematch = room?.rematch || {}
  const iRequested = !!rematch[myColor]
  const oppRequested = !!rematch[oppColor]

  // סאונד סיום משחק — חייב להיות כאן לפני ה-early returns (חוקי Hooks)
  useEffect(() => {
    if (winner && !finishedSoundPlayedRef.current) {
      finishedSoundPlayedRef.current = true
      // השהייה קצרה כדי לתת לסאונד ה-drop להסתיים לפני
      setTimeout(() => {
        if (winner === 'draw') {
          playSound('lose')  // תיקו — צליל ניטראלי
        } else if (winner === myColor) {
          playSound('win')   // ניצחתי!
        } else {
          playSound('lose')  // הפסדת
        }
      }, 300)
    }
  }, [winner, myColor])

  // איפוס דגל סאונד הסיום כשמתחיל סיבוב חדש (winner חזר ל-null)
  useEffect(() => {
    if (!winner) finishedSoundPlayedRef.current = false
  }, [winner])

  // כששני השחקנים לחצו "שחק שוב" — ה-host (P1) מאפס את הלוח לשני הצדדים
  useEffect(() => {
    if (iRequested && oppRequested && myColor === 'P1') {
      finishedSoundPlayedRef.current = false
      lastMoveKeyRef.current = null
      updateGameRoom(roomId, {
        gameState: {
          board: boardToFlat(createBoard()),
          currentTurn: 'P1',
          winner: null,
          winningCells: [],
          lastMove: null,
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
          <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
            <IconBackRTL size={24} color="#1B2540" />
          </button>
          <HomeButton onClick={onHome} />
          <div className="screen-header__title">4 בשורה</div>
        </div>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-2)' }}>
          טוען...
        </div>
      </div>
    )
  }

  // אישור וידאו — לפני שמתחילים, כל שחקן בוחר אם להפעיל וידאו
  if (videoChoice === null) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl' }}>
        <div className="screen-header">
          <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
            <IconBackRTL size={24} color="#1B2540" />
          </button>
          <HomeButton onClick={onHome} />
          <div className="screen-header__title">4 בשורה</div>
        </div>
        <VideoConsentGate onDecide={(use) => setVideoChoice(use)} accent="#7E2C2E" accentDeep="#5A1D1E" />
      </div>
    )
  }

  // ביצוע מהלך — מעדכן את ה-doc ב-Firestore (ממיר את הלוח לפורמט שטוח)
  const handleColumnClick = async (col) => {
    if (!isMyTurn) return
    const result = makeMove(board, col, myColorNum)
    if (!result) return

    const win = checkWin(result.board, result.row, result.col, myColorNum)
    let newWinner = null
    let newWinningCells = []
    if (win) {
      newWinner = myColor
      newWinningCells = win
    } else if (isBoardFull(result.board)) {
      newWinner = 'draw'
    }

    const newState = {
      board: boardToFlat(result.board),  // שטוח לצורך Firestore
      currentTurn: newWinner ? currentTurn : (myColor === 'P1' ? 'P2' : 'P1'),
      winner: newWinner,
      winningCells: cellsToStrings(newWinningCells),  // מערך של מחרוזות
      lastMove: { row: result.row, col: result.col, player: myColorNum },
    }

    await updateGameState(roomId, newState)
  }

  // בקשת "שחק שוב" / "משחק חדש" — מסמנת את ההצבעה שלי.
  // משחק חדש יתחיל רק כששני הצדדים יאשרו.
  const requestRematch = () => {
    updateGameRoom(roomId, { [`rematch.${myColor}`]: true })
  }

  // ביטול/דחיית בקשת משחק חדש — מנקה את ההצבעות של שני הצדדים
  const cancelRematch = () => {
    updateGameRoom(roomId, { rematch: { P1: false, P2: false } })
  }

  // חפש שחקן אחר — עוזב את החדר הנוכחי ועובר לחיפוש יריב רנדומלי
  const handleFindOther = async () => {
    await leaveGameRoom(roomId).catch(() => {})
    onFindOther && onFindOther()
  }

  // סיים לשחק — עוזב את החדר וחוזר לזירת המשחקים
  const handleEnd = async () => {
    await leaveGameRoom(roomId).catch(() => {})
    onExit && onExit()
  }

  // עזיבה רגילה (חזרה / עזוב משחק) — מוחק את החדר כדי שהיריב יקבל התראה
  const handleLeave = async () => {
    await leaveGameRoom(roomId).catch(() => {})
    onBack && onBack()
  }

  // טקסט סטטוס
  const statusText = (() => {
    if (winner === 'draw') return 'תיקו! 🤝'
    if (winner) {
      const winnerIsMe = winner === myColor
      return winnerIsMe ? 'ניצחת! 🎉' : 'הפסדת 😕'
    }
    return isMyTurn ? 'התור שלך' : `${opponent?.name || 'היריב'} משחק...`
  })()

  const statusColor = winner === 'draw' ? '#8389A4'
                    : winner ? (winner === myColor ? '#4F6B4A' : '#7E2C2E')
                    : (isMyTurn ? '#7E2C2E' : '#8389A4')

  // המרת ה-board ממספרים לקודי P1/P2 (כי הלוגיקה השתמשה במספרים)
  const currentPlayerNum = currentTurn === 'P1' ? P1 : P2

  return (
    <ProfilesProvider uids={(room.players || []).map(p => p.uid)} myUid={myUid}>
    <GameVideoProvider roomId={roomId} me={{ uid: myUid, name: me?.name || 'שחקן' }} enabled={videoChoice !== null} startWithCam={videoChoice === true}>
    <GameScreenLayout
      onBack={handleLeave}
      onHome={onHome}
      statusText={statusText}
      statusColor={statusColor}
      p1Name={myColor === 'P1' ? (me?.name || 'אתה') : (opponent?.name || 'יריב')}
      p2Name={myColor === 'P2' ? (me?.name || 'אתה') : (opponent?.name || 'יריב')}
      currentPlayer={currentPlayerNum}
      winner={winner ? (winner === 'draw' ? 'draw' : (winner === 'P1' ? P1 : P2)) : null}
      board={board}
      winningCells={winningCells}
      lastDropped={lastDropped}
      onColumnClick={handleColumnClick}
      disabled={!isMyTurn || !!winner}
      onReset={requestRematch}
      onChangeMode={handleLeave}
      isOnline={true}
      withVideo={true}
      p1Uid={myColor === 'P1' ? myUid : opponent?.uid}
      p2Uid={myColor === 'P2' ? myUid : opponent?.uid}
      p1You={myColor === 'P1'}
      p2You={myColor === 'P2'}
      myPhoto={profile?.photoURL}
      roomId={roomId} meUid={myUid} meName={me?.name} chat={room.chat || []}
      addFriendNode={opponent?.uid ? <AddFriendButton me={me} opponent={opponent} compact /> : null}
    >
      {winner && (
        <OnlineEndModal
          result={winner === 'draw' ? 'draw' : (winner === myColor ? 'win' : 'lose')}
          opponentName={opponent?.name || 'היריב'}
          iRequested={iRequested}
          oppRequested={oppRequested}
          onRematch={requestRematch}
          onFindOther={handleFindOther}
          onEnd={handleEnd}
        />
      )}
      {!winner && (iRequested || oppRequested) && (
        <RematchPrompt
          opponentName={opponent?.name || 'היריב'}
          iRequested={iRequested}
          onConfirm={requestRematch}
          onCancel={cancelRematch}
        />
      )}
    </GameScreenLayout>
    </GameVideoProvider>
    </ProfilesProvider>
  )
}

// ════════════════════════════════════════════════════════
// Layout משותף למסך משחק (מקומי / אונליין)
// ════════════════════════════════════════════════════════
function GameScreenLayout({
  onBack, onHome, statusText, statusColor, p1Name, p2Name,
  currentPlayer, winner, board, winningCells, lastDropped,
  onColumnClick, disabled, onReset, onChangeMode, isOnline, children,
  withVideo, p1Uid, p2Uid, p1You, p2You, myPhoto,
  roomId, meUid, meName, chat = [], addFriendNode,
}) {
  // מצב השתקה (נקרא מ-localStorage בכל מונט כדי להתעדכן אם המשתמש שינה במקום אחר)
  const [muted, setMutedState] = useState(() => isMuted())
  const [chatOpen, setChatOpen] = useState(false)

  const toggleMute = () => {
    const next = !muted
    setMutedState(next)
    setMuted(next)
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">4 בשורה</div>
        {isOnline && meUid && (
          <ChatHeaderButton chat={chat} open={chatOpen} onOpen={() => setChatOpen(true)}
            bg="var(--surface)" border="var(--line)" color="#7E2C2E" />
        )}
      </div>

      <div style={{ padding: '8px 16px 32px' }}>
        {/* סטטוס + כפתור השתקה — באותה שורה */}
        <div style={{
          display: 'flex', gap: 10, alignItems: 'stretch', marginBottom: 16,
        }}>
          {/* תיבת הסטטוס הראשית — תופסת את רוב הרוחב */}
          <div style={{
            flex: 1,
            background: 'var(--surface)',
            border: `2px solid ${statusColor}`,
            borderRadius: 14, padding: '12px 18px',
            textAlign: 'center',
            fontFamily: 'var(--font-display)',
            fontSize: 18, fontWeight: 800, color: statusColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {statusText}
          </div>
          {/* כפתור השתקה — ליד הסטטוס */}
          <button
            onClick={toggleMute}
            aria-label={muted ? 'הפעל סאונד' : 'השתק סאונד'}
            title={muted ? 'הפעל סאונד' : 'השתק סאונד'}
            style={{
              width: 52,
              background: muted ? 'rgba(126,44,46,.08)' : 'var(--surface)',
              border: muted ? '2px solid rgba(126,44,46,.3)' : '1px solid var(--line)',
              borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>

        {/* שחקנים */}
        <PlayersBar
          p1Name={p1Name} p2Name={p2Name}
          currentPlayer={currentPlayer} winner={winner}
          withVideo={withVideo} p1Uid={p1Uid} p2Uid={p2Uid}
          p1You={p1You} p2You={p2You} myPhoto={myPhoto}
          addFriendNode={addFriendNode}
        />

        {/* הלוח */}
        <Board
          board={board}
          winningCells={winningCells}
          lastDropped={lastDropped}
          onColumnClick={onColumnClick}
          disabled={disabled}
        />

        {/* כפתורי שליטה */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onReset} style={{
            flex: 1, background: 'var(--burgundy)', color: 'white',
            border: 'none', borderRadius: 14, padding: '14px',
            fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
            cursor: 'pointer',
          }}>
            🔄 משחק חדש
          </button>
          <button onClick={onChangeMode} style={{
            flex: 1, background: 'var(--surface)', color: 'var(--ink)',
            border: '1px solid var(--line)', borderRadius: 14, padding: '14px',
            fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
            cursor: 'pointer',
          }}>
            {isOnline ? '🚪 עזוב משחק' : 'החלף מצב'}
          </button>
        </div>
      </div>

      {isOnline && meUid && <ChatToast msgs={chat} meUid={meUid} suppressed={chatOpen} onOpen={() => setChatOpen(true)} />}
      {chatOpen && isOnline && meUid && <ChatPanel roomId={roomId} me={{ uid: meUid, name: meName }} msgs={chat} onClose={() => setChatOpen(false)} />}

      {children}
    </div>
  )
}

function PlayersBar({ p1Name, p2Name, currentPlayer, winner, withVideo, p1Uid, p2Uid, p1You, p2You, myPhoto, addFriendNode }) {
  const p1Active = !winner && currentPlayer === P1
  const p2Active = !winner && currentPlayer === P2
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
      <PlayerCard name={p1Name} color="#7E2C2E" active={p1Active}
        withVideo={withVideo} uid={p1Uid} you={p1You} photoURL={p1You ? myPhoto : undefined}
        addFriendNode={!p1You ? addFriendNode : null} />
      <PlayerCard name={p2Name} color="#B89048" active={p2Active}
        withVideo={withVideo} uid={p2Uid} you={p2You} photoURL={p2You ? myPhoto : undefined}
        addFriendNode={!p2You ? addFriendNode : null} />
    </div>
  )
}

function PlayerCard({ name, color, active, withVideo, uid, you, photoURL, addFriendNode }) {
  // שם מלא חי (שם + שם משפחה) למצב האונליין — התמונה מטופלת ב-PlayerVideo
  const live = usePlayerProfile(uid, name)
  const displayName = withVideo ? live.name : name
  // מצב וידאו — כרטיס אנכי עם פרצוף גדול וכפתורי בקרה (כמו במלך הזירה)
  if (withVideo) {
    return (
      <div style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        background: active ? color : 'var(--surface)',
        border: active ? `2px solid ${color}` : '1px solid var(--line)',
        borderRadius: 14, padding: '10px 8px', transition: 'all 0.2s',
      }}>
        <PlayerVideo uid={uid} name={displayName} size={92} photoURL={photoURL} />
        {/* שורת שם — כפתורי שליטה משני הצדדים */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}>
          {you ? <VideoControls only="mic" size={30} /> : <RemoteVideoToggles uid={uid} only="audio" size={30} />}
          <div style={{
            fontSize: 14, fontWeight: 800,
            color: active ? '#FBF7EE' : 'var(--ink)',
            fontFamily: 'var(--font-display)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
          }}>{displayName}{you ? ' (אתה)' : ''}</div>
          {you ? <VideoControls only="cam" size={30} /> : <RemoteVideoToggles uid={uid} only="video" size={30} />}
        </div>
        {!you && addFriendNode}
      </div>
    )
  }

  // מצב רגיל (מקומי / AI) — עיגול צבעוני ושם בשורה
  return (
    <div style={{
      flex: 1,
      background: active ? color : 'var(--surface)',
      border: active ? `2px solid ${color}` : '1px solid var(--line)',
      borderRadius: 14, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      transition: 'all 0.2s', minWidth: 0,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', background: color,
        boxShadow: active ? `0 0 0 3px ${color}33` : 'none',
        flexShrink: 0,
        border: '2px solid rgba(255,255,255,.4)',
      }}/>
      <div style={{
        fontSize: 15, fontWeight: 800,
        color: active ? '#FBF7EE' : 'var(--ink)',
        fontFamily: 'var(--font-display)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {name}
      </div>
    </div>
  )
}

function Board({ board, winningCells, lastDropped, onColumnClick, disabled }) {
  const isWinning = (r, c) =>
    winningCells.some(([wr, wc]) => wr === r && wc === c)
  const isLastDropped = (r, c) =>
    lastDropped && lastDropped.row === r && lastDropped.col === c

  return (
    <div style={{
      background: 'linear-gradient(180deg, #1B2540 0%, #0E1730 100%)',
      borderRadius: 18, padding: 10,
      boxShadow: '0 8px 24px -6px rgba(20,23,42,.5), inset 0 2px 8px rgba(0,0,0,.3)',
      maxWidth: 500, margin: '0 auto',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 6,
      }}>
        {Array.from({ length: COLS }).map((_, c) => (
          <button key={c} onClick={() => onColumnClick(c)} disabled={disabled}
            aria-label={`עמודה ${c + 1}`}
            style={{
              padding: 0, border: 'none', background: 'transparent',
              cursor: disabled ? 'default' : 'pointer',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
            {Array.from({ length: ROWS }).map((_, r) => {
              const cell = board[r][c]
              const winning = isWinning(r, c)
              const dropped = isLastDropped(r, c)
              return (
                <div key={r} style={{
                  aspectRatio: '1',
                  background: 'rgba(255,255,255,.08)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {cell !== EMPTY && (
                    <div style={{
                      width: '88%', height: '88%', borderRadius: '50%',
                      background: cell === P1
                        ? 'radial-gradient(circle at 30% 30%, #B83E40, #7E2C2E 60%, #5A1D1E)'
                        : 'radial-gradient(circle at 30% 30%, #E3B560, #B89048 60%, #8A6A2E)',
                      boxShadow: winning
                        ? `0 0 0 3px #FBF7EE, 0 0 16px ${cell === P1 ? '#FF6B6B' : '#FFD93D'}`
                        : 'inset 0 -3px 6px rgba(0,0,0,.3), 0 2px 4px rgba(0,0,0,.4)',
                      animation: dropped ? 'connect4Drop 0.4s ease-out' : 'none',
                      transition: 'box-shadow 0.3s',
                    }}/>
                  )}
                </div>
              )
            })}
          </button>
        ))}
      </div>
      <style>{`
        @keyframes connect4Drop {
          from { transform: translateY(-400%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function WinModal({ mode, winner, youArePlayer, onPlayAgain, onExit }) {
  let emoji, title, subtitle, color
  if (winner === 'draw') {
    emoji = '🤝'; title = 'תיקו!'; subtitle = 'משחק יפה משני הצדדים'; color = '#8389A4'
  } else if (winner === youArePlayer) {
    emoji = '🎉'; title = mode === 'online' ? 'ניצחת!' : (mode === 'ai' ? 'ניצחת!' : 'שחקן 1 ניצח!')
    subtitle = 'כל הכבוד'; color = '#7E2C2E'
  } else {
    emoji = mode === 'ai' ? '🤖' : (mode === 'online' ? '😕' : '🎉')
    title = mode === 'ai' ? 'המחשב ניצח' : (mode === 'online' ? 'הפסדת' : 'שחקן 2 ניצח!')
    subtitle = mode === 'ai' ? 'נסה שוב, אתה תצליח!' : (mode === 'online' ? 'משחק יפה — נסה שוב' : 'כל הכבוד')
    color = '#B89048'
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(20,23,42,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24,
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 24, padding: '32px 28px 24px',
        maxWidth: 360, width: '100%', textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>{emoji}</div>
        <div className="h-display" style={{ fontSize: 28, color, marginBottom: 6 }}>
          {title}
        </div>
        <div style={{
          fontSize: 16, color: 'var(--ink-2)', marginBottom: 24,
          fontWeight: 600, lineHeight: 1.4,
        }}>
          {subtitle}
        </div>
        <button onClick={onPlayAgain} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 10 }}>
          🔄 שחק שוב
        </button>
        <button onClick={onExit} className="big-btn big-btn--ghost" style={{ width: '100%' }}>
          חזרה לזירה
        </button>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// מודאל סיום משחק אונליין — שלוש אפשרויות + אישור הדדי ל"שחק שוב"
// ═════════════════════════════════════════════════════════════
function OnlineEndModal({
  result, opponentName, iRequested, oppRequested,
  onRematch, onFindOther, onEnd,
}) {
  let emoji, title, subtitle, color
  if (result === 'draw') {
    emoji = '🤝'; title = 'תיקו!'; subtitle = 'משחק יפה משני הצדדים'; color = '#8389A4'
  } else if (result === 'win') {
    emoji = '🎉'; title = 'ניצחת!'; subtitle = 'כל הכבוד'; color = '#4F6B4A'
  } else {
    emoji = '😕'; title = 'הפסדת'; subtitle = 'משחק יפה — אפשר לנסות שוב'; color = '#7E2C2E'
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(20,23,42,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24, direction: 'rtl',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 24, padding: '32px 28px 24px',
        maxWidth: 360, width: '100%', textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>{emoji}</div>
        <div className="h-display" style={{ fontSize: 28, color, marginBottom: 6 }}>
          {title}
        </div>
        <div style={{
          fontSize: 16, color: 'var(--ink-2)', marginBottom: 22,
          fontWeight: 600, lineHeight: 1.4,
        }}>
          {subtitle}
        </div>

        {iRequested ? (
          // ביקשתי לשחק שוב — מחכה לאישור היריב
          <div style={{
            background: 'var(--bg-app)',
            border: '1px solid var(--line)',
            borderRadius: 14, padding: '14px', marginBottom: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 15, fontWeight: 700, color: 'var(--ink-2)',
          }}>
            <span style={{ animation: 'endModalPulse 1.4s infinite' }}>⏳</span>
            מחכים ש{opponentName} יאשר משחק חוזר...
          </div>
        ) : (
          <button onClick={onRematch} className="big-btn big-btn--primary"
            style={{ width: '100%', marginBottom: 10 }}>
            🔄 שחק שוב
            {oppRequested && (
              <span style={{ display: 'block', fontSize: 12, fontWeight: 700, marginTop: 2, opacity: 0.9 }}>
                {opponentName} כבר מחכה!
              </span>
            )}
          </button>
        )}

        <button onClick={onFindOther} className="big-btn big-btn--ghost"
          style={{ width: '100%', marginBottom: 10 }}>
          🔎 חפש שחקן אחר
        </button>
        <button onClick={onEnd} className="big-btn big-btn--ghost"
          style={{ width: '100%' }}>
          סיים לשחק
        </button>

        <style>{`
          @keyframes endModalPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// חלונית בקשת "משחק חדש" באמצע משחק — דורשת אישור מהיריב
// ═════════════════════════════════════════════════════════════
function RematchPrompt({ opponentName, iRequested, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(20,23,42,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1100, padding: 24, direction: 'rtl',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 24, padding: '28px 24px 22px',
        maxWidth: 340, width: '100%', textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🔄</div>
        {iRequested ? (
          <>
            <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>
              ביקשת משחק חדש
            </div>
            <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 20, lineHeight: 1.4 }}>
              מחכים ש{opponentName} יאשר...
            </div>
            <button onClick={onCancel} className="big-btn big-btn--ghost" style={{ width: '100%' }}>
              ביטול
            </button>
          </>
        ) : (
          <>
            <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>
              {opponentName} מבקש/ת משחק חדש
            </div>
            <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 20, lineHeight: 1.4 }}>
              להתחיל את הלוח מחדש?
            </div>
            <button onClick={onConfirm} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 10 }}>
              ✅ כן, משחק חדש
            </button>
            <button onClick={onCancel} className="big-btn big-btn--ghost" style={{ width: '100%' }}>
              לא, נמשיך לשחק
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// מסך "היריב עזב" — עם אפשרות לחפש יריב חדש או לצאת
function OpponentLeftScreen({ onFindOther, onExit }) {
  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onExit} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <div className="screen-header__title">4 בשורה</div>
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

// מסך שגיאה גנרי (יריב עזב וכו')
function ErrorScreen({ emoji, title, description, onBack }) {
  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <div className="screen-header__title">4 בשורה</div>
      </div>
      <div style={{ padding: 24 }}>
        <CenteredCard emoji={emoji} title={title} description={description}
          actionLabel="חזרה" onAction={onBack} />
      </div>
    </div>
  )
}
