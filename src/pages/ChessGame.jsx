// src/pages/ChessGame.jsx
// ─────────────────────────────────────────────────────────────
// משחק "שחמט" (Chess) — חוקים מלאים.
//
// חוקים נתמכים:
//   • תנועת כל הכלים (חייל, צריח, פרש, רץ, מלכה, מלך).
//   • אכילה, שח, מט, פט (תיקו).
//   • הכתרת חייל (למלכה כברירת מחדל — הבחירה הנפוצה).
//   • הצרחה (קצרה וארוכה) עם כל התנאים.
//   • הכאה דרך הילוכו (en passant).
//   • זיהוי תיקו: פט, חוסר חומר, 50 מהלכים ללא התקדמות.
//
// 4 מצבי משחק (כמו דמקה):
//   נגד המחשב (3 רמות) / שני שחקנים מקומי / רנדומלי אונליין / עם חבר.
//
// עיצוב: עץ אגוז בהיר ושנהב מלוטש (וריאציה שנבחרה).
// בנוי על אותה תשתית Firestore של gameRooms.
//
// ── ייצוג הלוח ──
// לוח = מערך שטוח של 64 תאים (אינדקס 0..63, שורה 0 למעלה).
// כל תא: null, או מחרוזת בת 2 תווים: צבע ('w'/'b') + סוג ('p','n','b','r','q','k').
// דוגמה: 'wp' = חייל לבן, 'bk' = מלך שחור.
// קונבנציה: לבן (w) = P1, למטה, מתחיל. שחור (b) = P2, למעלה.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { IconBackRTL, IconHomeLine, IconSpeaker, IconSpeakerOff, IconMusicNote } from '../icons/index.jsx'
import HomeButton from '../components/HomeButton.jsx'
import { GameIcon } from '../icons/gameIcons.jsx'
import { useUserStore } from '../stores/userStore.js'
import {
  createGameRoom, watchGameRoom, updateGameState, updateGameRoom,
  leaveGameRoom, findOrCreateMatch, watchFriendships, sendGameInvite,
  watchInvite, deleteGameInvite, watchUser,
} from '../services/firebase.js'
import { playSound, isMuted, setMuted, MUSIC_TRACKS } from '../utils/gameSounds.js'
import Avatar from '../components/Avatar.jsx'
import { ChatToast, ChatHeaderButton, ChatPanel, AddFriendButton } from '../components/GameChat.jsx'
import { GameVideoProvider, PlayerVideo, VideoControls, VideoConsentGate, RemoteVideoToggles, ProfilesProvider, usePlayerProfile } from '../components/GameVideo.jsx'
import LeaveConfirmModal from '../components/LeaveConfirmModal.jsx'

// ════════════════════════════════════════════════════════
// קבועים וכלים בסיסיים
// ════════════════════════════════════════════════════════
const rc = (sq) => [Math.floor(sq / 8), sq % 8]   // index → [row, col]
const sq = (r, c) => r * 8 + c                      // [row, col] → index
const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8
const colorOf = (p) => (p ? p[0] : null)
const typeOf = (p) => (p ? p[1] : null)
const enemy = (col) => (col === 'w' ? 'b' : 'w')

// יריב המחשב מוצג כדמות עם שם (אחת מ-3) במקום "מחשב"
const CH_BOTS = ['רינת', 'דניאל', 'רומי']

// ── עמדת פתיחה ──
function initialBoard() {
  const b = Array(64).fill(null)
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
  for (let c = 0; c < 8; c++) {
    b[sq(0, c)] = 'b' + back[c]   // שורה 0 — שחור (למעלה)
    b[sq(1, c)] = 'bp'
    b[sq(6, c)] = 'wp'
    b[sq(7, c)] = 'w' + back[c]   // שורה 7 — לבן (למטה)
  }
  return b
}

// מצב מלא של המשחק (state) — כולל מידע לזכויות הצרחה ואן-פסאן
function initialGame() {
  return {
    board: initialBoard(),
    turn: 'w',
    // זכויות הצרחה: האם המלך/צריחים עוד לא זזו
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    // משבצת אן-פסאן זמינה (אינדקס) או null
    enPassant: null,
    // מונה חצי-מהלכים ללא אכילה/הזזת חייל (לכלל 50 מהלכים)
    halfmove: 0,
  }
}

// ════════════════════════════════════════════════════════
// יצירת מהלכים (תנועה גולמית לכל כלי)
// ════════════════════════════════════════════════════════

// כיוונים
const DIR_B = [[-1, -1], [-1, 1], [1, -1], [1, 1]]               // רץ
const DIR_R = [[-1, 0], [1, 0], [0, -1], [0, 1]]                 // צריח
const DIR_Q = [...DIR_B, ...DIR_R]                               // מלכה
const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
const KING = DIR_Q

// מהלך = { from, to, piece, capture?, promo?, enPassant?, castle? ('K'|'Q'), epSquare? }
// epSquare = המשבצת שהופכת זמינה לאן-פסאן אחרי קפיצת חייל כפולה

// מהלכים "פסאודו-חוקיים" (בלי בדיקת שח) לכלי בודד
function pieceMoves(game, fromSq) {
  const { board } = game
  const p = board[fromSq]
  if (!p) return []
  const col = colorOf(p), t = typeOf(p)
  const [r, c] = rc(fromSq)
  const moves = []
  const add = (tr, tc, extra = {}) => {
    const to = sq(tr, tc)
    moves.push({ from: fromSq, to, piece: p, capture: board[to] || null, ...extra })
  }

  if (t === 'p') {
    const dir = col === 'w' ? -1 : 1           // לבן עולה (שורה קטֵנה), שחור יורד
    const startRow = col === 'w' ? 6 : 1
    const promoRow = col === 'w' ? 0 : 7
    // קדימה צעד
    if (inB(r + dir, c) && !board[sq(r + dir, c)]) {
      if (r + dir === promoRow) add(r + dir, c, { promo: 'q' })
      else add(r + dir, c)
      // קדימה שני צעדים מעמדת פתיחה
      if (r === startRow && !board[sq(r + 2 * dir, c)]) {
        add(r + 2 * dir, c, { epSquare: sq(r + dir, c) })
      }
    }
    // אכילות אלכסוניות
    for (const dc of [-1, 1]) {
      const tr = r + dir, tc = c + dc
      if (!inB(tr, tc)) continue
      const target = board[sq(tr, tc)]
      if (target && colorOf(target) === enemy(col)) {
        if (tr === promoRow) add(tr, tc, { promo: 'q' })
        else add(tr, tc)
      }
      // אן-פסאן
      if (game.enPassant === sq(tr, tc) && !target) {
        add(tr, tc, { enPassant: true, capture: board[sq(r, tc)] })
      }
    }
  } else if (t === 'n') {
    for (const [dr, dc] of KNIGHT) {
      const tr = r + dr, tc = c + dc
      if (!inB(tr, tc)) continue
      const target = board[sq(tr, tc)]
      if (!target || colorOf(target) === enemy(col)) add(tr, tc)
    }
  } else if (t === 'k') {
    for (const [dr, dc] of KING) {
      const tr = r + dr, tc = c + dc
      if (!inB(tr, tc)) continue
      const target = board[sq(tr, tc)]
      if (!target || colorOf(target) === enemy(col)) add(tr, tc)
    }
    // הצרחה — נוסיף בנפרד (צריך בדיקת שח על משבצות הביניים)
    addCastlingMoves(game, fromSq, col, moves)
  } else {
    // כלים מחליקים: רץ/צריח/מלכה
    const dirs = t === 'b' ? DIR_B : t === 'r' ? DIR_R : DIR_Q
    for (const [dr, dc] of dirs) {
      let tr = r + dr, tc = c + dc
      while (inB(tr, tc)) {
        const target = board[sq(tr, tc)]
        if (!target) { add(tr, tc); }
        else { if (colorOf(target) === enemy(col)) add(tr, tc); break }
        tr += dr; tc += dc
      }
    }
  }
  return moves
}

function addCastlingMoves(game, fromSq, col, moves) {
  const { board, castling } = game
  const row = col === 'w' ? 7 : 0
  if (fromSq !== sq(row, 4)) return            // המלך לא בעמדת התחלה
  if (isSquareAttacked(board, sq(row, 4), enemy(col))) return  // אסור להצריח משח
  // צד מלך (קצרה) — משבצות f,g ריקות, צריח ב-h
  const kSide = col === 'w' ? castling.wK : castling.bK
  if (kSide && !board[sq(row, 5)] && !board[sq(row, 6)] && board[sq(row, 7)] === col + 'r') {
    if (!isSquareAttacked(board, sq(row, 5), enemy(col)) && !isSquareAttacked(board, sq(row, 6), enemy(col))) {
      moves.push({ from: fromSq, to: sq(row, 6), piece: col + 'k', capture: null, castle: 'K' })
    }
  }
  // צד מלכה (ארוכה) — משבצות b,c,d ריקות, צריח ב-a
  const qSide = col === 'w' ? castling.wQ : castling.bQ
  if (qSide && !board[sq(row, 1)] && !board[sq(row, 2)] && !board[sq(row, 3)] && board[sq(row, 0)] === col + 'r') {
    if (!isSquareAttacked(board, sq(row, 3), enemy(col)) && !isSquareAttacked(board, sq(row, 2), enemy(col))) {
      moves.push({ from: fromSq, to: sq(row, 2), piece: col + 'k', capture: null, castle: 'Q' })
    }
  }
}

// האם משבצת מותקפת ע"י צבע נתון (לצורך זיהוי שח)
function isSquareAttacked(board, target, byColor) {
  const [tr, tc] = rc(target)
  // חיילים
  const pdir = byColor === 'w' ? 1 : -1   // מאיזה כיוון חייל אוכל את המשבצת
  for (const dc of [-1, 1]) {
    const r = tr + pdir, c = tc + dc
    if (inB(r, c) && board[sq(r, c)] === byColor + 'p') return true
  }
  // פרשים
  for (const [dr, dc] of KNIGHT) {
    const r = tr + dr, c = tc + dc
    if (inB(r, c) && board[sq(r, c)] === byColor + 'n') return true
  }
  // מלך
  for (const [dr, dc] of KING) {
    const r = tr + dr, c = tc + dc
    if (inB(r, c) && board[sq(r, c)] === byColor + 'k') return true
  }
  // רץ/מלכה (אלכסון)
  for (const [dr, dc] of DIR_B) {
    let r = tr + dr, c = tc + dc
    while (inB(r, c)) {
      const p = board[sq(r, c)]
      if (p) { if (colorOf(p) === byColor && (typeOf(p) === 'b' || typeOf(p) === 'q')) return true; break }
      r += dr; c += dc
    }
  }
  // צריח/מלכה (ישר)
  for (const [dr, dc] of DIR_R) {
    let r = tr + dr, c = tc + dc
    while (inB(r, c)) {
      const p = board[sq(r, c)]
      if (p) { if (colorOf(p) === byColor && (typeOf(p) === 'r' || typeOf(p) === 'q')) return true; break }
      r += dr; c += dc
    }
  }
  return false
}

// מאתר את המלך של צבע נתון
function findKing(board, col) {
  for (let i = 0; i < 64; i++) if (board[i] === col + 'k') return i
  return -1
}

function inCheck(board, col) {
  const k = findKing(board, col)
  return k >= 0 && isSquareAttacked(board, k, enemy(col))
}

// מחיל מהלך על game ומחזיר game חדש (כולל עדכון זכויות הצרחה/אן-פסאן/מונה)
function applyMove(game, move) {
  const board = game.board.slice()
  const castling = { ...game.castling }
  const col = colorOf(move.piece)
  const t = typeOf(move.piece)
  let enPassant = null

  // אכילת אן-פסאן — מסירים את החייל שמאחור
  if (move.enPassant) {
    const [fr] = rc(move.from)
    const [, tc] = rc(move.to)
    board[sq(fr, tc)] = null
  }

  board[move.from] = null
  board[move.to] = move.promo ? (col + move.promo) : move.piece

  // הצרחה — מזיזים גם את הצריח
  if (move.castle) {
    const [row] = rc(move.to)
    if (move.castle === 'K') { board[sq(row, 5)] = col + 'r'; board[sq(row, 7)] = null }
    else { board[sq(row, 3)] = col + 'r'; board[sq(row, 0)] = null }
  }

  // עדכון זכויות הצרחה
  if (t === 'k') { if (col === 'w') { castling.wK = false; castling.wQ = false } else { castling.bK = false; castling.bQ = false } }
  if (t === 'r') {
    if (move.from === sq(7, 7)) castling.wK = false
    if (move.from === sq(7, 0)) castling.wQ = false
    if (move.from === sq(0, 7)) castling.bK = false
    if (move.from === sq(0, 0)) castling.bQ = false
  }
  // אם נאכל צריח בפינה — מבטל זכות הצרחה ליריב
  if (move.to === sq(7, 7)) castling.wK = false
  if (move.to === sq(7, 0)) castling.wQ = false
  if (move.to === sq(0, 7)) castling.bK = false
  if (move.to === sq(0, 0)) castling.bQ = false

  // אן-פסאן חדש
  if (move.epSquare != null) enPassant = move.epSquare

  // מונה 50 מהלכים
  const halfmove = (t === 'p' || move.capture) ? 0 : game.halfmove + 1

  return { board, turn: enemy(col), castling, enPassant, halfmove }
}

// כל המהלכים החוקיים (מסננים מהלכים שמשאירים את המלך בשח)
function legalMoves(game, fromSq = null) {
  const { board, turn } = game
  const pseudo = []
  if (fromSq != null) {
    if (board[fromSq] && colorOf(board[fromSq]) === turn) pseudo.push(...pieceMoves(game, fromSq))
  } else {
    for (let i = 0; i < 64; i++) {
      if (board[i] && colorOf(board[i]) === turn) pseudo.push(...pieceMoves(game, i))
    }
  }
  // סינון: המהלך לא חוקי אם אחריו המלך שלי בשח
  return pseudo.filter(m => {
    const ng = applyMove(game, m)
    return !inCheck(ng.board, turn)
  })
}

// מצב המשחק: 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw'
function gameStatus(game) {
  const moves = legalMoves(game)
  const checked = inCheck(game.board, game.turn)
  if (moves.length === 0) return checked ? 'checkmate' : 'stalemate'
  if (game.halfmove >= 100) return 'draw'          // 50 מהלכים מלאים (100 חצאים)
  if (insufficientMaterial(game.board)) return 'draw'
  return checked ? 'check' : 'playing'
}

// חוסר חומר למט (מלך מול מלך, מלך+רץ/פרש מול מלך)
function insufficientMaterial(board) {
  const pieces = board.filter(Boolean).map(typeOf).filter(t => t !== 'k')
  if (pieces.length === 0) return true
  if (pieces.length === 1 && (pieces[0] === 'n' || pieces[0] === 'b')) return true
  if (pieces.length === 2 && pieces.every(t => t === 'b')) return true   // הקלה: שני רצים
  return false
}

// ════════════════════════════════════════════════════════
// AI — מינימקס עם גיזום אלפא-ביתא
// ════════════════════════════════════════════════════════
const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 }

// טבלאות מיקום (פשוטות) — מעודדות פיתוח ומרכז
const PST_P = [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0]
const PST_N = [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50]
const PST_B = [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20]
const PST = { p: PST_P, n: PST_N, b: PST_B }

function evaluate(board, forCol) {
  let score = 0
  for (let i = 0; i < 64; i++) {
    const p = board[i]
    if (!p) continue
    const col = colorOf(p), t = typeOf(p)
    let v = VAL[t]
    // בונוס מיקום — לפי הטבלה (משוקפת לשחור)
    if (PST[t]) {
      const idx = col === 'w' ? i : (63 - i)
      v += PST[t][idx]
    }
    score += col === forCol ? v : -v
  }
  return score
}

function orderMoves(moves) {
  // אכילות קודם (לשיפור הגיזום)
  return moves.slice().sort((a, b) => {
    const av = a.capture ? VAL[typeOf(a.capture)] - VAL[typeOf(a.piece)] / 10 : -1
    const bv = b.capture ? VAL[typeOf(b.capture)] - VAL[typeOf(b.piece)] / 10 : -1
    return bv - av
  })
}

function negamax(game, depth, alpha, beta, aiCol) {
  const status = gameStatus(game)
  if (status === 'checkmate') {
    // אם תורו של aiCol והוא במט — רע מאוד; אחרת טוב מאוד
    return game.turn === aiCol ? -100000 - depth : 100000 + depth
  }
  if (status === 'stalemate' || status === 'draw') return 0
  if (depth === 0) {
    return game.turn === aiCol ? evaluate(game.board, aiCol) : -evaluate(game.board, aiCol)
  }
  const moves = orderMoves(legalMoves(game))
  let best = -Infinity
  for (const m of moves) {
    const ng = applyMove(game, m)
    const val = -negamax(ng, depth - 1, -beta, -alpha, aiCol)
    if (val > best) best = val
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

function chooseAIMove(game, difficulty) {
  const aiCol = game.turn
  const moves = legalMoves(game)
  if (moves.length === 0) return null
  if (moves.length === 1) return moves[0]

  if (difficulty === 'easy') {
    // קל — בעיקר אקראי, אבל לא מפספס אכילה גדולה חינם לגמרי
    if (Math.random() < 0.6) return moves[Math.floor(Math.random() * moves.length)]
  }

  const depth = difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1
  const ordered = orderMoves(moves).sort(() => Math.random() - 0.5)  // ערבוב קל לגיוון
  let best = null, bestVal = -Infinity
  let alpha = -Infinity
  for (const m of ordered) {
    const ng = applyMove(game, m)
    const val = -negamax(ng, depth - 1, -Infinity, Infinity, aiCol)
    if (val > bestVal) { bestVal = val; best = m }
    if (bestVal > alpha) alpha = bestVal
  }
  return best || moves[0]
}

// ════════════════════════════════════════════════════════
// סנכרון Firestore — game נשמר כאובייקט שטוח
// ════════════════════════════════════════════════════════
function gameToFS(game) {
  return {
    board: game.board.map(c => c || null),
    turn: game.turn,
    castling: game.castling,
    enPassant: game.enPassant == null ? -1 : game.enPassant,
    halfmove: game.halfmove,
  }
}
function gameFromFS(fs) {
  if (!fs || !Array.isArray(fs.board) || fs.board.length !== 64) return initialGame()
  return {
    board: fs.board.map(c => c || null),
    turn: fs.turn || 'w',
    castling: fs.castling || { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: (fs.enPassant == null || fs.enPassant < 0) ? null : fs.enPassant,
    halfmove: fs.halfmove || 0,
  }
}

export { initialGame, initialBoard, legalMoves, applyMove, gameStatus, chooseAIMove, rc, sq, colorOf, typeOf, inCheck, findKing }

// ════════════════════════════════════════════════════════
// סמלי הכלים (יוניקוד) + צבעים לסגנון "עץ אגוז בהיר ושנהב"
// ════════════════════════════════════════════════════════
// סמלים מלאים (filled) לכל הכלים — הבדל הלבן/שחור נקבע על ידי צבע הדיסקית והסמל.
// (שימוש בסמלים מלאים אחידים מונע את התחושה ההפוכה שנגרמת מסמל חלול.)
const GLYPH = { k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F' }

// פלטת העיצוב שנבחרה (וריאציה א')
const C = {
  pageBg: 'linear-gradient(180deg, #4a3320 0%, #2f2012 100%)',
  frameOuter: 'linear-gradient(155deg,#a9794a 0%,#7d5430 55%,#5e3e22 100%)',
  frameBrass: 'linear-gradient(160deg,#e4c478,#a87f3e)',
  sqLight: 'linear-gradient(180deg,#f6e9ce,#e3cfa3)',
  sqDark: 'linear-gradient(180deg,#a36b3e,#7d4d28)',
  ivory: 'radial-gradient(circle at 35% 26%, #fffdf8, #f3e9d2 50%, #e0cda4 82%, #c8b083)',
  onyx: 'radial-gradient(circle at 35% 26%, #6b4a2e, #4a3019 55%, #2e1d0e)',
  glyphLight: '#5e3b1c',
  glyphDark: '#f3e9d2',
  gold: '#E8C879',
  goldDeep: '#C9A85E',
}

// ════════════════════════════════════════════════════════
// קומפוננטה ראשית
// ════════════════════════════════════════════════════════
export default function ChessGame({ onBack, onHome, initialRoomId, autoInviteFriend = null, initialMode = null, registerBack }) {
  const [mode, setMode] = useState(initialRoomId ? 'online-friend' : (autoInviteFriend ? 'online-friend' : (initialMode || null)))
  const [difficulty, setDifficulty] = useState('medium')
  const [roomId, setRoomId] = useState(initialRoomId || null)
  // חלון אישור יציאה ממשחק פעיל + תת-מסך רושם צעד-חזרה משלו
  const [confirmLeave, setConfirmLeave] = useState(false)
  const childBackRef = useRef(null)
  const registerChildBack = useRef((fn) => { childBackRef.current = fn }).current
  const inActiveGame = mode === 'ai' || mode === 'local' || ((mode === 'online-random' || mode === 'online-friend') && roomId)
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
  const confirmLeaveNow = () => { setConfirmLeave(false); setRoomId(null); setMode(null) }

  useEffect(() => {
    if (initialRoomId) { setMode('online-friend'); setRoomId(initialRoomId) }
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
        <OnlineLobby mode={mode} autoInviteFriend={autoInviteFriend} onBack={onBack} onHome={onHome} onReady={(id) => setRoomId(id)} />
      )
    }
    return (
      <>
        <OnlineGameScreen roomId={roomId}
          onBack={() => { setRoomId(null); setMode(null) }}
          onHome={onHome}
          onExit={onBack}
          onFindOther={() => { setRoomId(null); setMode('online-random') }} />
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
      <LocalGameScreen mode={mode} difficulty={difficulty} onBack={() => setMode(null)} onHome={onHome} onExit={onBack} />
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
        <div className="screen-header__title">שחמט</div>
      </div>
      <div style={{ padding: '8px 20px 32px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #7d5430 0%, #4d3017 100%)',
          borderRadius: 20, padding: '20px 18px', color: '#FBF7EE', marginBottom: 24,
          boxShadow: '0 8px 20px -6px rgba(74,46,24,.5)', textAlign: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <GameIcon id="chess" size={52} />
          </div>
          <div className="h-display" style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 6 }}>שחמט</div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'rgba(255,255,255,.92)' }}>
            משחק האסטרטגיה הקלאסי — העמידו את מלך היריב במט
          </div>
        </div>

        {!showDifficulty ? (
          <>
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>בחרו איך לשחק:</h2>
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
              background: 'none', border: 'none', padding: 0, color: 'var(--ink-2)', fontSize: 14,
              fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <IconBackRTL size={18} color="#8389A4" /> חזרה
            </button>
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>בחרו רמת קושי:</h2>
            <DifficultyButton label="קל" iconId="level-easy" color="#4F6B4A" description="מתאים להתחלה — המחשב משחק בפשטות" onClick={() => onSelectAI('easy')} />
            <DifficultyButton label="בינוני" iconId="level-medium" color="#B89048" description="המחשב חושב צעד-שניים קדימה" onClick={() => onSelectAI('medium')} />
            <DifficultyButton label="קשה" iconId="level-hard" color="#7E2C2E" description="המחשב חושב כמה צעדים קדימה" onClick={() => onSelectAI('hard')} />
          </>
        )}
      </div>
    </div>
  )
}

function ModeButton({ onClick, iconId, gradient, label, description, badge }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 18, padding: '16px 16px', marginBottom: 10, display: 'flex', alignItems: 'center',
      gap: 14, fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', position: 'relative',
    }}>
      {badge && (
        <div style={{
          position: 'absolute', top: -8, insetInlineStart: 12, background: 'var(--burgundy)', color: 'white',
          fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 999,
        }}>✨ {badge}</div>
      )}
      <div style={{
        width: 52, height: 52, borderRadius: 14, background: gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
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
      width: '100%', textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 16, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center',
      gap: 12, fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14, background: color, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
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
// כלי שחמט בודד — דיסקית מוצללת עם סמל
// ════════════════════════════════════════════════════════
function ChessPiece({ piece }) {
  const dark = colorOf(piece) === 'b'
  const t = typeOf(piece)
  // הכלים לעולם לא מסתובבים — סמלי שחמט חייבים להישאר זקופים תמיד,
  // גם כשהלוח מתהפך (בניגוד לכליי הדמקה העגולים הסימטריים).
  return (
    <div style={{
      width: '84%', height: '84%', borderRadius: '50%',
      background: dark ? C.onyx : C.ivory,
      border: dark ? '2px solid rgba(255,255,255,.1)' : '2px solid rgba(120,80,30,.28)',
      boxShadow: 'inset 0 -3px 6px rgba(0,0,0,.35), inset 0 3px 5px rgba(255,255,255,.25), 0 3px 6px rgba(0,0,0,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        fontSize: '1.6em', lineHeight: 1,
        color: dark ? '#1a1008' : '#fffdf8',
        textShadow: dark
          ? '0 1px 1px rgba(0,0,0,.5)'
          : '0 0 1px rgba(94,59,28,.9), 0 1px 2px rgba(94,59,28,.55)',
        WebkitTextStroke: dark ? '0' : '0.5px rgba(94,59,28,.55)',
        marginTop: '-2px',
      }}>{GLYPH[t]}</span>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// לוח השחמט — עץ אגוז בהיר, מסגרת פליז, קואורדינטות
// ════════════════════════════════════════════════════════
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

function ChessBoard({ board, selected, legalDests, lastMove, checkSq, capture, onCellTap, disabled, flip }) {
  // ביחידת התצוגה — אם flip, השחור למטה (שחקן שחור)
  const order = flip
    ? [...Array(64).keys()].reverse()
    : [...Array(64).keys()]

  const isDest = (s) => legalDests.includes(s)
  const isSel = (s) => selected === s
  const isLast = (s) => lastMove && (lastMove.from === s || lastMove.to === s)

  // מיקום חזותי של משבצת (מתחשב ב-flip שמסדר מחדש את התאים)
  const visOf = (s) => { const p = flip ? 63 - s : s; return [Math.floor(p / 8), p % 8] }

  // אנימציית החלקה מ-from ל-to (WAAPI), נגזרת תוך render כדי שלא יהיה הבזק
  const overlayRef = useRef(null)
  const animRef = useRef(null)   // { from, to, piece, key }
  const prevKeyRef = useRef(null)
  const [, bumpAnim] = useState(0)
  const moveKey = lastMove ? (lastMove.from + '>' + lastMove.to) : null
  if (moveKey && prevKeyRef.current !== moveKey) {
    prevKeyRef.current = moveKey
    const mp = board[lastMove.to]
    animRef.current = mp ? { from: lastMove.from, to: lastMove.to, piece: mp, key: moveKey } : null
  }
  const anim = animRef.current
  useLayoutEffect(() => {
    if (!anim) return
    const el = overlayRef.current
    if (!el) return
    const [vrF, vcF] = visOf(anim.from)
    const [vrT, vcT] = visOf(anim.to)
    const frames = [
      { transform: `translate(${(vcF - vcT) * 100}%, ${(vrF - vrT) * 100}%)`, easing: 'cubic-bezier(.4,.05,.35,1)' },
      { transform: 'translate(0,0)' },
    ]
    const a = el.animate(frames, { duration: 320, fill: 'both' })
    let cancelled = false
    a.onfinish = () => { if (!cancelled) { animRef.current = null; bumpAnim(n => n + 1) } }
    return () => { cancelled = true; try { if (a.playState !== 'finished') a.cancel() } catch { /* ignore */ } }
  }, [anim && anim.key]) // eslint-disable-line

  return (
    <div style={{
      background: C.frameOuter, padding: 10, borderRadius: 16,
      boxShadow: '0 16px 36px -10px rgba(0,0,0,.55)',
      maxWidth: 460, margin: '0 auto',
    }}>
      <div style={{
        background: C.frameBrass, borderRadius: 9, padding: 6,
        boxShadow: 'inset 0 2px 3px rgba(255,245,210,.6), inset 0 -3px 6px rgba(0,0,0,.4)',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
          borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(0,0,0,.3)',
          direction: 'ltr', position: 'relative',
        }}>
          {order.map(s => {
            const [r, c] = rc(s)
            const darkSq = (r + c) % 2 === 1
            const piece = board[s]
            const dest = isDest(s)
            const showCoordFile = flip ? r === 0 : r === 7
            const showCoordRank = flip ? c === 7 : c === 0
            return (
              <div key={s} onClick={() => !disabled && onCellTap(s)}
                style={{
                  aspectRatio: '1', position: 'relative',
                  background: darkSq ? C.sqDark : C.sqLight,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: disabled ? 'default' : 'pointer',
                  boxShadow: isSel(s)
                    ? 'inset 0 0 0 4px rgba(232,200,121,.85)'
                    : isLast(s) ? 'inset 0 0 0 3px rgba(232,200,121,.45)'
                    : (checkSq === s ? 'inset 0 0 0 4px rgba(200,40,40,.7)' : 'none'),
                }}>
                {/* קואורדינטות קטנות בפינות */}
                {showCoordFile && (
                  <span style={{
                    position: 'absolute', bottom: 1, insetInlineEnd: 3, fontSize: 9, fontWeight: 800,
                    color: darkSq ? 'rgba(246,233,206,.8)' : 'rgba(125,77,40,.7)',
                  }}>{FILES[c]}</span>
                )}
                {showCoordRank && (
                  <span style={{
                    position: 'absolute', top: 1, insetInlineStart: 3, fontSize: 9, fontWeight: 800,
                    color: darkSq ? 'rgba(246,233,206,.8)' : 'rgba(125,77,40,.7)',
                  }}>{8 - r}</span>
                )}
                {/* סימון יעד אפשרי */}
                {dest && !piece && (
                  <div style={{
                    width: '32%', height: '32%', borderRadius: '50%',
                    background: 'rgba(79,107,74,.5)', boxShadow: '0 0 8px rgba(79,107,74,.5)',
                  }} />
                )}
                {dest && piece && (
                  <div style={{
                    position: 'absolute', inset: 4, borderRadius: '50%',
                    border: '3px solid rgba(79,107,74,.7)',
                  }} />
                )}
                {piece && !(anim && anim.to === s) && <ChessPiece piece={piece} />}
              </div>
            )
          })}
          {anim && (
            <div ref={overlayRef} style={{ position: 'absolute', left: `${visOf(anim.to)[1] * 12.5}%`, top: `${visOf(anim.to)[0] * 12.5}%`, width: '12.5%', height: '12.5%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 6, willChange: 'transform' }}>
              <ChessPiece piece={anim.piece} />
            </div>
          )}
          {capture && (
            <div key={'cap' + (lastMove ? lastMove.from + '>' + lastMove.to : '')} style={{ position: 'absolute', left: `${visOf(capture.sq)[1] * 12.5}%`, top: `${visOf(capture.sq)[0] * 12.5}%`, width: '12.5%', height: '12.5%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 5, animation: 'chCapFade 760ms ease-out forwards' }}>
              <ChessPiece piece={capture.piece} />
              <div style={{ position: 'absolute', inset: '8%', borderRadius: '50%', background: capture.color === 'green' ? 'radial-gradient(circle at 50% 38%, #74e88a, #1f9c3a 70%)' : 'radial-gradient(circle at 50% 38%, #ff6a3d, #c01d0c 70%)', boxShadow: capture.color === 'green' ? '0 0 14px 3px rgba(40,200,90,.85)' : '0 0 14px 3px rgba(230,40,20,.85)', animation: 'chCapTint 760ms ease-out forwards', pointerEvents: 'none' }} />
            </div>
          )}
          <style>{`@keyframes chCapFade{0%{opacity:1}55%{opacity:1}100%{opacity:0}}@keyframes chCapTint{0%{opacity:0}20%{opacity:.9}100%{opacity:.9}}`}</style>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// עזרי תצוגה — סטטוס, כלים שנאכלו
// ════════════════════════════════════════════════════════
// סופר כלים שנאכלו (לפי ההפרש מעמדת הפתיחה) — למגש הכלים
const START_COUNT = { p: 8, n: 2, b: 2, r: 2, q: 1 }
function capturedBy(board, col) {
  // כמה מכלי היריב (צבע enemy) נאכלו = התחלתי פחות נוכחי
  const opp = enemy(col)
  const present = {}
  for (const s of board) {
    if (s && colorOf(s) === opp) { const t = typeOf(s); present[t] = (present[t] || 0) + 1 }
  }
  const caps = []
  for (const t of ['q', 'r', 'b', 'n', 'p']) {
    const missing = (START_COUNT[t] || 0) - (present[t] || 0)
    for (let i = 0; i < missing; i++) caps.push(t)
  }
  return caps
}

function CapturedTray({ pieces, dark, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2, minHeight: 28,
      background: 'rgba(0,0,0,.22)', borderRadius: 10, padding: '4px 8px',
      border: '1px solid rgba(255,255,255,.1)', flexWrap: 'wrap', maxWidth: '42%',
    }}>
      {pieces.length === 0
        ? <span style={{ color: 'rgba(240,226,198,.5)', fontSize: 12, fontWeight: 700 }}>{label}</span>
        : pieces.map((t, i) => (
          <span key={i} style={{ fontSize: 18, lineHeight: 1, color: dark ? '#2e1d0e' : '#f3e9d2' }}>{GLYPH[t]}</span>
        ))}
    </div>
  )
}

function PlayerTag({ name, active, dark }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: active ? 'rgba(232,200,121,.22)' : 'rgba(255,255,255,.07)',
      border: active ? '2px solid #C9A85E' : '1px solid rgba(255,255,255,.14)',
      borderRadius: 14, padding: '8px 14px 8px 10px', transition: 'all .2s',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: dark ? C.onyx : C.ivory, border: '2px solid rgba(255,255,255,.35)',
      }} />
      <div style={{ color: '#FBF7EE', fontWeight: 800, fontSize: 16, fontFamily: "'Suez One', serif" }}>{name}</div>
      {active && <span style={{ fontSize: 12, color: '#E8C879', fontWeight: 700 }}>● תור</span>}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מסך משחק מקומי (מול מחשב / שני שחקנים)
// ════════════════════════════════════════════════════════
function LocalGameScreen({ mode, difficulty, onBack, onHome, onExit }) {
  const [game, setGame] = useState(initialGame)
  const [aiName] = useState(() => CH_BOTS[Math.floor(Math.random() * CH_BOTS.length)])
  const [selected, setSelected] = useState(null)
  const [lastMove, setLastMove] = useState(null)
  const [capture, setCapture] = useState(null)
  const [status, setStatus] = useState('playing')
  const [busy, setBusy] = useState(false)

  const isAITurn = mode === 'ai' && game.turn === 'b' && (status === 'playing' || status === 'check')
  const myMoves = (status === 'playing' || status === 'check') ? legalMoves(game) : []

  const finished = status === 'checkmate' || status === 'stalemate' || status === 'draw'

  const doMove = (move) => {
    const ng = applyMove(game, move)
    const st = gameStatus(ng)
    playSound(move.capture ? 'capture' : 'drop')
    setGame(ng)
    setLastMove({ from: move.from, to: move.to })
    if (move.capture) {
      const capColor = colorOf(move.capture)
      const capSq = move.enPassant ? sq(rc(move.from)[0], rc(move.to)[1]) : move.to
      setCapture({ sq: capSq, piece: move.capture, color: capColor === 'w' ? 'red' : 'green' })
    } else setCapture(null)
    setSelected(null)
    setStatus(st)
    if (st === 'checkmate') setTimeout(() => playSound(ng.turn === 'b' ? 'win' : 'lose'), 300)
    else if (st === 'check') setTimeout(() => playSound('drop'), 60)
  }

  // תור המחשב
  useEffect(() => {
    if (!isAITurn) return
    setBusy(true)
    const t = setTimeout(() => {
      const m = chooseAIMove(game, difficulty)
      if (m) doMove(m)
      setBusy(false)
    }, 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line
  }, [isAITurn, game])

  const handleCellTap = (s) => {
    if (finished || busy || isAITurn) return
    const piece = game.board[s]
    const startsHere = myMoves.filter(m => m.from === s)
    if (piece && colorOf(piece) === game.turn && startsHere.length) { setSelected(s); return }
    if (selected != null) {
      const opts = myMoves.filter(m => m.from === selected && m.to === s)
      if (opts.length) { doMove(opts[0]); return }
    }
    setSelected(null)
  }

  const reset = () => {
    setGame(initialGame()); setSelected(null); setLastMove(null); setCapture(null); setStatus('playing'); setBusy(false)
  }

  const dests = selected != null ? myMoves.filter(m => m.from === selected).map(m => m.to) : []
  const checkSq = (status === 'check' || status === 'checkmate') ? findKing(game.board, game.turn) : null

  const statusText = (() => {
    if (status === 'checkmate') {
      const loser = game.turn
      if (mode === 'ai') return loser === 'b' ? 'מט! ניצחת 🎉' : 'מט — המחשב ניצח 🤖'
      return `מט! ${loser === 'w' ? 'השחור' : 'הלבן'} ניצח 🎉`
    }
    if (status === 'stalemate') return 'פט — תיקו 🤝'
    if (status === 'draw') return 'תיקו 🤝'
    if (isAITurn) return `${aiName} חושב...`
    const who = mode === 'ai' ? 'תורך' : (game.turn === 'w' ? 'תור הלבן' : 'תור השחור')
    return status === 'check' ? `שח! ${who}` : who
  })()

  return (
    <ChessLayout
      onBack={onBack}
      onHome={onHome}
      statusText={statusText}
      topName={mode === 'ai' ? aiName : 'שחור'}
      topActive={game.turn === 'b' && !finished}
      topDark
      bottomName={mode === 'ai' ? 'אתה' : 'לבן'}
      bottomActive={game.turn === 'w' && !finished}
      board={game.board}
      selected={selected}
      legalDests={dests}
      lastMove={lastMove}
      checkSq={checkSq}
      capture={capture}
      capturedTop={capturedBy(game.board, 'b')}
      capturedBottom={capturedBy(game.board, 'w')}
      onCellTap={handleCellTap}
      disabled={finished || busy}
      onReset={reset}
      onChangeMode={onBack}
      isOnline={false}
    >
      {finished && (
        <LocalEndModal mode={mode} status={status} loserColor={game.turn} aiName={aiName} onPlayAgain={reset} onExit={onExit} />
      )}
    </ChessLayout>
  )
}

// ════════════════════════════════════════════════════════
// מסך משחק אונליין
// ════════════════════════════════════════════════════════
function OnlineGameScreen({ roomId, onBack, onHome, onExit, onFindOther }) {
  const { authUser, profile } = useUserStore()
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [videoChoice, setVideoChoice] = useState(null)
  const lastMoveKeyRef = useRef(null)
  const finishedSoundRef = useRef(false)

  useEffect(() => {
    const unsub = watchGameRoom(roomId, (data) => {
      if (!data) { setError('היריב עזב את המשחק'); return }
      setRoom(data)
      const lm = data.gameState?.lastMove
      if (lm) {
        const key = `${lm.from}-${lm.to}`
        if (lastMoveKeyRef.current !== key) {
          lastMoveKeyRef.current = key
          playSound(lm.capture ? 'capture' : 'drop')
        }
      }
    })
    return () => unsub && unsub()
  }, [roomId])

  useEffect(() => {
    return () => { if (room && room.status === 'ended') leaveGameRoom(roomId).catch(() => {}) }
  }, [roomId, room?.status])

  const myUid = authUser?.uid
  const me = (room?.players || []).find(p => p.uid === myUid)
  const opponent = (room?.players || []).find(p => p.uid !== myUid)
  const myColor = me?.color === 'P2' ? 'b' : 'w'   // P1=לבן, P2=שחור
  const gs = room?.gameState || {}
  const game = gameFromFS(gs.chess)
  const status = gs.status || 'playing'
  const finished = status === 'checkmate' || status === 'stalemate' || status === 'draw'
  const isMyTurn = game.turn === myColor && !finished

  const lm = gs.lastMove
  const lastMove = lm ? { from: lm.from, to: lm.to } : null
  const capture = (lm && lm.cap) ? { sq: lm.capSq, piece: lm.cap, color: game.turn === myColor ? 'red' : 'green' } : null

  const oppColorKey = myColor === 'w' ? 'P2' : 'P1'
  const myColorKey = myColor === 'w' ? 'P1' : 'P2'
  const rematch = room?.rematch || {}
  const iRequested = !!rematch[myColorKey]
  const oppRequested = !!rematch[oppColorKey]

  // סאונד סיום
  useEffect(() => {
    if (finished && !finishedSoundRef.current) {
      finishedSoundRef.current = true
      setTimeout(() => {
        if (status === 'checkmate') {
          const iWon = game.turn !== myColor   // מי שתורו הפסיד
          playSound(iWon ? 'win' : 'lose')
        } else playSound('lose')
      }, 300)
    }
  }, [finished, status, game.turn, myColor])
  useEffect(() => { if (!finished) finishedSoundRef.current = false }, [finished])

  // שני הצדדים אישרו משחק חוזר — ה-host (לבן) מאפס
  useEffect(() => {
    if (iRequested && oppRequested && myColor === 'w') {
      finishedSoundRef.current = false
      lastMoveKeyRef.current = null
      updateGameRoom(roomId, {
        gameState: { chess: gameToFS(initialGame()), status: 'playing', lastMove: null },
        rematch: { P1: false, P2: false },
      })
    }
  }, [iRequested, oppRequested, myColor, roomId])

  if (error) return <OpponentLeftScreen onFindOther={onFindOther} onExit={onExit} />
  if (!room) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl' }}>
        <div className="screen-header">
          <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
          <HomeButton onClick={onHome} />
          <div className="screen-header__title">שחמט</div>
        </div>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-2)' }}>טוען...</div>
      </div>
    )
  }

  if (videoChoice === null) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl', background: C.pageBg }}>
        <div className="screen-header" style={{ background: 'transparent' }}>
          <button className="screen-header__back" onClick={onBack} aria-label="חזרה" style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)' }}><IconBackRTL size={24} color="#E8C879" /></button>
          <button className="screen-header__back" onClick={onHome} aria-label="חזרה למסך הבית" style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)' }}><IconHomeLine size={24} color="#E8C879" /></button>
          <div className="screen-header__title" style={{ color: '#FBF7EE' }}>שחמט אונליין</div>
        </div>
        <VideoConsentGate onDecide={(use) => setVideoChoice(use)} accent="#7d5430" accentDeep="#C9A85E" />
      </div>
    )
  }

  const myMoves = isMyTurn ? legalMoves(game) : []

  const handleCellTap = async (s) => {
    if (!isMyTurn) return
    const piece = game.board[s]
    const startsHere = myMoves.filter(m => m.from === s)
    if (piece && colorOf(piece) === myColor && startsHere.length) { setSelected(s); return }
    if (selected != null) {
      const opts = myMoves.filter(m => m.from === selected && m.to === s)
      if (opts.length) {
        const move = opts[0]
        setSelected(null)
        const ng = applyMove(game, move)
        const st = gameStatus(ng)
        await updateGameState(roomId, {
          chess: gameToFS(ng), status: st,
          lastMove: { from: move.from, to: move.to, capture: move.capture ? 1 : 0, cap: move.capture || null, capSq: move.capture ? (move.enPassant ? sq(rc(move.from)[0], rc(move.to)[1]) : move.to) : -1 },
        })
        return
      }
    }
    setSelected(null)
  }

  const requestRematch = () => updateGameRoom(roomId, { [`rematch.${myColorKey}`]: true })
  const cancelRematch = () => updateGameRoom(roomId, { rematch: { P1: false, P2: false } })
  const handleFindOther = async () => { await leaveGameRoom(roomId).catch(() => {}); onFindOther && onFindOther() }
  const handleEnd = async () => { await leaveGameRoom(roomId).catch(() => {}); onExit && onExit() }
  const handleLeave = async () => { await leaveGameRoom(roomId).catch(() => {}); onBack && onBack() }

  const dests = selected != null ? myMoves.filter(m => m.from === selected).map(m => m.to) : []
  const checkSq = (status === 'check' || status === 'checkmate') ? findKing(game.board, game.turn) : null

  const resultForMe = (() => {
    if (status === 'checkmate') return game.turn !== myColor ? 'win' : 'lose'
    if (status === 'stalemate' || status === 'draw') return 'draw'
    return null
  })()

  const statusText = (() => {
    if (status === 'checkmate') return resultForMe === 'win' ? 'מט! ניצחת 🎉' : 'מט — הפסדת 😕'
    if (status === 'stalemate') return 'פט — תיקו 🤝'
    if (status === 'draw') return 'תיקו 🤝'
    if (status === 'check') return isMyTurn ? 'שח! תורך' : `שח! ${opponent?.name || 'היריב'} בתור`
    return isMyTurn ? 'תורך — בצע מהלך' : `${opponent?.name || 'היריב'} משחק...`
  })()

  const flip = myColor === 'b'

  return (
    <ProfilesProvider uids={(room.players || []).map(p => p.uid)} myUid={myUid}>
    <GameVideoProvider roomId={roomId} me={{ uid: myUid, name: me?.name || 'שחקן' }} enabled={videoChoice !== null} startWithCam={videoChoice === true}>
    <ChessLayout
      onBack={handleLeave}
      onHome={onHome}
      statusText={statusText}
      topName={opponent?.name || 'היריב'}
      topActive={game.turn !== myColor && !finished}
      topDark={myColor === 'w'}
      bottomName={me?.name || 'אתה'}
      bottomActive={isMyTurn}
      board={game.board}
      selected={selected}
      legalDests={dests}
      lastMove={lastMove}
      checkSq={checkSq}
      capture={capture}
      capturedTop={capturedBy(game.board, myColor === 'w' ? 'b' : 'w')}
      capturedBottom={capturedBy(game.board, myColor)}
      onCellTap={handleCellTap}
      disabled={!isMyTurn || finished}
      onReset={requestRematch}
      onChangeMode={handleLeave}
      isOnline={true}
      flip={flip}
      chat={room.chat || []} meUid={myUid} meName={me?.name} roomId={roomId}
      withVideo={true}
      topUid={opponent?.uid}
      bottomUid={myUid}
      myPhoto={profile?.photoURL}
      addFriendNode={opponent?.uid ? <AddFriendButton me={me} opponent={opponent} compact /> : null}
    >
      {finished && (
        <OnlineEndModal
          result={resultForMe}
          opponentName={opponent?.name || 'היריב'}
          iRequested={iRequested} oppRequested={oppRequested}
          onRematch={requestRematch} onFindOther={handleFindOther} onEnd={handleEnd}
        />
      )}
      {!finished && (iRequested || oppRequested) && (
        <RematchPrompt opponentName={opponent?.name || 'היריב'} iRequested={iRequested}
          onConfirm={requestRematch} onCancel={cancelRematch} />
      )}
    </ChessLayout>
    </GameVideoProvider>
    </ProfilesProvider>
  )
}

// ════════════════════════════════════════════════════════
// Layout משותף
// ════════════════════════════════════════════════════════
function ChessLayoutPortraitOld({
  onBack, onHome, statusText, topName, topActive, topDark, bottomName, bottomActive,
  board, selected, legalDests, lastMove, checkSq, capturedTop, capturedBottom,
  onCellTap, disabled, onReset, onChangeMode, isOnline, children, flip,
  chat = [], meUid, meName, roomId, withVideo, topUid, bottomUid, myPhoto, addFriendNode,
}) {
  const [muted, setMutedState] = useState(() => isMuted())
  const [chatOpen, setChatOpen] = useState(false)
  const toggleMute = () => { const n = !muted; setMutedState(n); setMuted(n) }

  return (
    <div className="scroll-area" style={{ direction: 'rtl', background: C.pageBg }}>
      <div className="screen-header" style={{ background: 'transparent' }}>
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה" style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)' }}>
          <IconBackRTL size={24} color="#E8C879" />
        </button>
        {onHome && (
          <button className="screen-header__back" onClick={onHome} aria-label="חזרה למסך הבית" style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)' }}>
            <IconHomeLine size={24} color="#E8C879" />
          </button>
        )}
        <div className="screen-header__title" style={{ color: '#FBF7EE' }}>שחמט {isOnline ? 'אונליין' : ''}</div>
        {isOnline && meUid && (
          <ChatHeaderButton chat={chat} open={chatOpen} onOpen={() => setChatOpen(true)}
            bg="rgba(255,255,255,.12)" border="rgba(255,255,255,.22)" color="#E8C879" />
        )}
      </div>

      <div style={{ padding: '4px 16px 28px' }}>
        {withVideo ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'stretch' }}>
            <ChessVideoCard uid={bottomUid} name={bottomName} active={bottomActive} you photoURL={myPhoto} />
            <ChessVideoCard uid={topUid} name={topName} active={topActive} addFriendNode={addFriendNode} />
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
            <PlayerTag name={topName} active={topActive} dark={topDark} />
          </div>
        )}

        {/* מגש כלים שהיריב אכל (למעלה) */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', margin: '0 2px 6px' }}>
          <CapturedTray pieces={capturedTop} dark={!topDark} label="—" />
        </div>

        <ChessBoard
          board={board} selected={selected} legalDests={legalDests}
          lastMove={lastMove} checkSq={checkSq} onCellTap={onCellTap}
          disabled={disabled} flip={flip}
        />

        {/* סטטוס + מגש כלים שאני אכלתי */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '12px 2px' }}>
          <CapturedTray pieces={capturedBottom} dark={!!topDark} label="—" />
          <div style={{ flex: 1, textAlign: 'center', color: '#F0E2C6', fontFamily: "'Suez One', serif", fontSize: 18, fontWeight: 800 }}>{statusText}</div>
          <button onClick={toggleMute} aria-label={muted ? 'הפעל סאונד' : 'השתק סאונד'} style={{
            width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,.10)',
            border: '1px solid rgba(255,255,255,.18)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 18, cursor: 'pointer', flexShrink: 0,
          }}>{muted ? '🔇' : '🔊'}</button>
        </div>

        {!withVideo && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 2 }}>
            <PlayerTag name={bottomName} active={bottomActive} dark={!topDark ? false : false} />
          </div>
        )}

        {isOnline && meUid && <ChatToast msgs={chat} meUid={meUid} suppressed={chatOpen} onOpen={() => setChatOpen(true)} />}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={onReset} style={{
            flex: 1, background: '#C9A85E', color: '#2A1C10', border: 'none', borderRadius: 14,
            padding: '14px', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
          }}>🔄 משחק חדש</button>
          <button onClick={onChangeMode} style={{
            flex: 1, background: 'rgba(255,255,255,.10)', color: '#FBF7EE', border: '1px solid rgba(255,255,255,.18)',
            borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
          }}>{isOnline ? '🚪 עזוב משחק' : 'החלף מצב'}</button>
        </div>
      </div>

      {chatOpen && isOnline && meUid && <ChatPanel roomId={roomId} me={{ uid: meUid, name: meName }} msgs={chat} onClose={() => setChatOpen(false)} />}
      {children}
    </div>
  )
}

// אייקון יציאה (דלת עם חץ, בסגנון הקווי של המאגר)
function IcExitDoor({ size = 18, color = '#ffd9d2' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
  )
}

// אייקון צ'אט (קו, לא אמוג'י)
function IcChatLine({ size = 20, color = '#E8C879' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.7L3 21l1.8-5.4A8.4 8.4 0 0 1 4 11.5a8.5 8.5 0 0 1 17 0Z" /></svg>
  )
}

// כפתור מוזיקה עם תפריט (כיבוי/הפעלה, שיר הבא, עוצמה) — אייקון מהמאגר
function ChMusicButton({ musicOn, onToggle, onNext, vol, onVolDown, onVolUp, btnStyle }) {
  const [open, setOpen] = useState(false)
  // התפריט נסגר לבד אחרי 3 שניות
  useEffect(() => { if (!open) return; const t = setTimeout(() => setOpen(false), 3000); return () => clearTimeout(t) }, [open])
  const item = { background: 'none', border: 'none', color: '#FBF7EE', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', padding: '8px 12px', textAlign: 'right', borderRadius: 8, whiteSpace: 'nowrap' }
  const vbtn = { width: 38, height: 34, borderRadius: 8, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.2)', color: '#E8C879', fontSize: 20, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }
  return (
    <div style={{ position: 'relative', display: 'flex', flex: 1 }}>
      <button onClick={() => setOpen(o => !o)} title="מוזיקה" aria-label="מוזיקה" style={{ ...btnStyle, opacity: musicOn ? 1 : 0.5 }}><IconMusicNote size={20} color="#E8C879" /></button>
      {open && (
        <div style={{ position: 'absolute', bottom: '115%', insetInlineStart: 0, background: 'rgba(20,15,8,.97)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 12, padding: 6, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,.5)', minWidth: 156 }}>
          <button onClick={() => { onToggle() }} style={item}>{musicOn ? 'כיבוי מוזיקה' : 'הפעלת מוזיקה'}</button>
          <button onClick={() => { onNext() }} style={item}>השיר הבא</button>
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

// תצוגת רוחב (כמו שש-בש/דמקה): לוח במרכז, שחקנים + שליטה במסילות הצד.
function ChPlayerPanel({ name, active, captured, discDark, capDark, withVideo, uid, you, photoURL, addFriendNode }) {
  const showVideo = withVideo && uid
  return (
    <div style={{ background: active ? 'rgba(74,54,26,.92)' : 'rgba(26,17,9,.85)', border: active ? '2px solid #E8C879' : '1px solid rgba(255,255,255,.22)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: active ? '0 6px 20px rgba(0,0,0,.5), 0 0 0 1px rgba(232,200,121,.35)' : '0 6px 18px rgba(0,0,0,.5)' }}>
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
          <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: discDark ? 'radial-gradient(circle at 35% 30%, #4A3525, #1C120A)' : 'radial-gradient(circle at 35% 30%, #F0DCA8, #C9A85E)', border: '2px solid rgba(255,255,255,.35)' }} />
        )}
        <div style={{ color: '#FBF7EE', fontWeight: 800, fontSize: 14, fontFamily: "'Suez One', serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{name}{you ? ' (אתה)' : ''}</div>
        {active && <span style={{ fontSize: 11, color: '#E8C879', fontWeight: 700, flex: 'none', whiteSpace: 'nowrap' }}>● תור</span>}
      </div>
      <div style={{ maxWidth: '100%', overflow: 'hidden' }}>
        <CapturedTray pieces={captured} dark={capDark} label="" />
      </div>
      {!you && addFriendNode}
    </div>
  )
}

function ChessLayout({
  onBack, onHome, statusText, topName, topActive, topDark, bottomName, bottomActive,
  board, selected, legalDests, lastMove, checkSq, capture, capturedTop, capturedBottom,
  onCellTap, disabled, onReset, onChangeMode, isOnline, children, flip,
  chat = [], meUid, meName, roomId, withVideo, topUid, bottomUid, myPhoto, addFriendNode,
}) {
  const [muted, setMutedState] = useState(() => isMuted())
  const toggleMute = () => { const n = !muted; setMutedState(n); setMuted(n) }
  const [chatOpen, setChatOpen] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)

  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem('beyahad_chess_music') !== 'off' } catch { return true } })
  const [trackIdx, setTrackIdx] = useState(() => Math.floor(Math.random() * MUSIC_TRACKS.length))
  const [musicVol, setMusicVol] = useState(isOnline ? 0.07 : 0.10)
  const audioRef = useRef(null)
  const nextTrack = () => setTrackIdx(i => (i + 1) % MUSIC_TRACKS.length)
  const toggleMusic = () => setMusicOn(o => { const n = !o; try { localStorage.setItem('beyahad_chess_music', n ? 'on' : 'off') } catch {} return n })
  const volDown = () => setMusicVol(v => Math.max(0.01, Math.round((v - 0.03) * 100) / 100))
  const volUp = () => { setMusicVol(v => Math.min(0.60, Math.round((v + 0.03) * 100) / 100)); setMusicOn(o => { if (o) return o; try { localStorage.setItem('beyahad_chess_music', 'on') } catch {} return true }) }
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

  const ctlBtn = { height: 44, flex: 1, borderRadius: 12, background: 'rgba(26,17,9,.88)', border: '1px solid rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: '#E8C879', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(0,0,0,.45)' }
  const exitBtn = { height: 44, width: '100%', borderRadius: 12, background: 'rgba(150,52,46,.92)', border: '1px solid rgba(216,120,108,.65)', color: '#ffd9d2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(0,0,0,.45)', gap: 8 }

  const gameInner = (
    <div style={{ position: isPortrait ? 'absolute' : 'fixed', inset: 0, zIndex: 1000, background: 'linear-gradient(rgba(20,14,7,.20), rgba(20,14,7,.42)), url(/chech.png) center/cover no-repeat #2A1C10', direction: 'rtl', fontFamily: 'Heebo, sans-serif', overflow: 'hidden', display: 'flex', gap: 10, padding: 12, boxSizing: 'border-box' }}>
      <div style={{ width: 176, flex: 'none', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <ChPlayerPanel name={bottomName} active={bottomActive} captured={capturedBottom} discDark={!topDark} capDark={topDark} withVideo={withVideo} uid={bottomUid} you photoURL={myPhoto} />
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ textAlign: 'center', color: '#F6E8C8', fontFamily: "'Suez One', serif", fontSize: 15, fontWeight: 800, lineHeight: 1.2, minHeight: 20, background: 'rgba(26,17,9,.85)', borderRadius: 10, padding: '6px 8px', boxShadow: '0 3px 10px rgba(0,0,0,.45)' }}>{statusText}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isOnline && meUid && <button onClick={() => setChatOpen(true)} title="צ'אט" aria-label="צ'אט" style={ctlBtn}><IcChatLine size={20} /></button>}
            <button onClick={toggleMute} title="צלילים" aria-label="צלילים" style={{ ...ctlBtn, opacity: muted ? 0.5 : 1 }}>{muted ? <IconSpeakerOff size={20} color="#E8C879" /> : <IconSpeaker size={20} color="#E8C879" />}</button>
            <ChMusicButton musicOn={musicOn} onToggle={toggleMusic} onNext={nextTrack} vol={musicVol} onVolDown={volDown} onVolUp={volUp} btnStyle={ctlBtn} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{ height: '100%', maxHeight: '100%', aspectRatio: '1 / 1', maxWidth: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%' }}>
            <ChessBoard board={board} selected={selected} legalDests={legalDests} lastMove={lastMove} checkSq={checkSq} capture={capture} onCellTap={onCellTap} disabled={disabled} flip={flip} />
          </div>
        </div>
      </div>

      <div style={{ width: 176, flex: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', minHeight: 0 }}>
        <ChPlayerPanel name={topName} active={topActive} captured={capturedTop} discDark={topDark} capDark={!topDark} withVideo={withVideo} uid={topUid} addFriendNode={addFriendNode} />
        <button onClick={() => setConfirmExit(true)} aria-label="יציאה" title="יציאה" style={{ ...exitBtn, marginTop: 'auto' }}><IcExitDoor size={18} /><span>יציאה</span></button>
      </div>

      {isOnline && meUid && <ChatToast msgs={chat} meUid={meUid} suppressed={chatOpen} onOpen={() => setChatOpen(true)} />}
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
      <audio ref={audioRef} src={MUSIC_TRACKS[trackIdx]} onEnded={nextTrack} onPlay={(e) => { e.currentTarget.volume = musicVol }} style={{ display: 'none' }} />
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

function ChessVideoCard({ uid, name, active, you, photoURL, addFriendNode }) {
  const { name: fullName } = usePlayerProfile(uid, name)
  return (
    <div style={{
      flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      background: active ? 'rgba(201,168,94,.22)' : 'rgba(255,255,255,.07)',
      border: active ? '2px solid #C9A85E' : '1px solid rgba(255,255,255,.14)',
      borderRadius: 14, padding: '10px 8px', transition: 'all .2s',
    }}>
      <PlayerVideo uid={uid} name={fullName} size={92} photoURL={photoURL} />
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

// ════════════════════════════════════════════════════════
// Lobby אונליין
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
      if (roomToClean && !successfulMatchRef.current) leaveGameRoom(roomToClean).catch(() => {})
    }
    // eslint-disable-next-line
  }, [])

  const startRandom = async () => {
    if (!authUser?.uid) { setErrorMsg('צריך להיות מחובר כדי לשחק אונליין'); setPhase('error'); return }
    setErrorMsg('')
    try {
      const player = { uid: authUser.uid, name: profile?.name || 'משתמש' }
      const { roomId, isCreator } = await findOrCreateMatch({ gameType: 'chess', player })
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
      console.error('Chess matchmaking error:', e)
      let msg = 'לא הצלחנו למצוא משחק — נסו שוב'
      if (e.code === 'permission-denied' || (e.message || '').includes('permission')) msg = 'בעיה בהרשאות Firestore'
      setErrorMsg(msg); setPhase('error')
    }
  }

  const inviteFriend = async (friend) => {
    if (!authUser?.uid) return
    setErrorMsg('')
    try {
      const player = { uid: authUser.uid, name: profile?.name || 'משתמש' }
      const { roomId } = await createGameRoom({ gameType: 'chess', creator: player, roomType: 'private' })
      setCreatedRoomId(roomId)
      const newInviteId = await sendGameInvite({
        from: player, to: { uid: friend.otherUid, name: friend.otherName }, gameType: 'chess', roomId,
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
      setErrorMsg('לא הצלחנו לשלוח הזמנה. ' + (e?.code || e?.message || ''))
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
        position: 'fixed', inset: 0, background: C.pageBg, color: 'white',
        display: 'flex', flexDirection: 'column', padding: '32px 24px 28px', direction: 'rtl', zIndex: 100,
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={onBack} style={{
            width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.12)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: 'none', cursor: 'pointer',
          }}>←</button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
          <div style={{ position: 'relative', width: 200, height: 200 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(255,255,255,.15)', animation: 'chPulse 1.5s ease-out infinite' }} />
            <div style={{ position: 'absolute', inset: 20, borderRadius: '50%', border: '3px solid rgba(255,255,255,.10)', animation: 'chPulse 1.5s ease-out 0.5s infinite' }} />
            <div style={{
              position: 'absolute', inset: 40, borderRadius: '50%', background: C.onyx,
              border: '4px solid #C9A85E', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><GameIcon id="chess" size={84} /></div>
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
          }}>💡 כשעוד מישהו ילחץ על "שחמט"<br />תתחבר אליו אוטומטית</div>
        </div>
        <button onClick={onBack} className="big-btn big-btn--danger" style={{ width: '100%' }}>✕ ביטול</button>
        <style>{`@keyframes chPulse { 0% { transform: scale(0.9); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }`}</style>
      </div>
    )
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">{mode === 'online-random' ? 'שחקן רנדומלי' : 'שחק עם חבר'}</div>
      </div>
      <div style={{ padding: '20px 20px 32px' }}>
        {phase === 'friend-list' && <FriendListScreen friends={friends} onInvite={inviteFriend} onGoFriends={onBack} />}
        {phase === 'waiting-for-friend' && invitedFriend && <WaitingForFriendScreen friendName={invitedFriend.otherName} onCancel={cancelInvite} />}
        {phase === 'friend-declined' && <CenteredCard emoji="😕" title="ההזמנה נדחתה" description={errorMsg || 'החבר לא הצטרף למשחק'} actionLabel="חזרה לרשימת החברים" onAction={() => setPhase('friend-list')} />}
        {phase === 'error' && <CenteredCard emoji="😕" title="משהו השתבש" description={errorMsg || 'נסו שוב'} actionLabel="חזרה" onAction={onBack} />}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// רשימת חברים + מסכים נלווים
// ════════════════════════════════════════════════════════
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
      <div style={{ fontSize: 56, marginBottom: 14, animation: 'chWaitPulse 1.6s ease-in-out infinite' }}>📨</div>
      <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>שלחנו הזמנה ל{friendName}</div>
      <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.4, marginBottom: 22 }}>מחכים שיאשר ויצטרף למשחק...</div>
      <button onClick={onCancel} className="big-btn big-btn--ghost" style={{ width: '100%' }}>ביטול ההזמנה</button>
      <style>{`@keyframes chWaitPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }`}</style>
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
      {actionLabel && <button onClick={onAction} className="big-btn big-btn--primary" style={{ width: '100%' }}>{actionLabel}</button>}
    </div>
  )
}

function OpponentLeftScreen({ onFindOther, onExit }) {
  return (
    <div className="scroll-area" style={{ direction: 'rtl', background: C.pageBg }}>
      <div className="screen-header" style={{ background: 'transparent' }}>
        <button className="screen-header__back" onClick={onExit} aria-label="חזרה" style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)' }}>
          <IconBackRTL size={24} color="#E8C879" />
        </button>
        <div className="screen-header__title" style={{ color: '#FBF7EE' }}>שחמט</div>
      </div>
      <div style={{ padding: 24 }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20,
          padding: '32px 24px', textAlign: 'center', boxShadow: 'var(--shadow-sm)',
        }}>
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

// ════════════════════════════════════════════════════════
// מודלים
// ════════════════════════════════════════════════════════
function LocalEndModal({ mode, status, loserColor, aiName, onPlayAgain, onExit }) {
  let emoji, title, subtitle, color, aiRobot = false
  if (status === 'stalemate' || status === 'draw') {
    emoji = '🤝'; title = status === 'stalemate' ? 'פט — תיקו!' : 'תיקו!'; subtitle = 'משחק יפה משני הצדדים'; color = '#8389A4'
  } else {
    // מט — loserColor הוא הצבע שתורו ואין לו מהלך (המפסיד)
    const whiteWon = loserColor === 'b'
    if (mode === 'ai') {
      if (whiteWon) { emoji = '🎉'; title = 'ניצחת!'; subtitle = 'כל הכבוד — מט!'; color = '#4F6B4A' }
      else { aiRobot = true; title = `${aiName} ניצח`; subtitle = 'נסה שוב, אתה תצליח!'; color = '#2C5566' }
    } else {
      emoji = '🎉'; title = `${whiteWon ? 'הלבן' : 'השחור'} ניצח!`; subtitle = 'כל הכבוד — מט!'; color = '#4F6B4A'
    }
  }
  return (
    <ModalShell>
      {aiRobot ? (
        <div style={{
          width: 88, height: 88, borderRadius: '50%', margin: '0 auto 14px',
          background: 'linear-gradient(135deg, #2C5566, #173846)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><GameIcon id="vs-ai" size={60} /></div>
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
          <span style={{ animation: 'chPulse2 1.4s infinite' }}>⏳</span>
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
      <style>{`@keyframes chPulse2 { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
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
