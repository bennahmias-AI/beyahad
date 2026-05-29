// src/utils/rummikubEngine.js
// ─────────────────────────────────────────────────────────────
// מנוע המשחק "רמיקוב" — פונקציות טהורות בלבד (בלי UI, בלי Firestore).
//
// המשחק: 106 אריחים — 104 ממוספרים (1-13) ב-4 צבעים, 2 עותקים כל אחד,
//         + 2 ג'וקרים (J). 2-4 שחקנים. כל אחד מתחיל עם 14 אריחים.
//
// המטרה: להיפטר מכל האריחים שביד ע"י הנחתם על השולחן ב"סטים":
//   • רצף (run): 3+ אריחים באותו צבע במספרים עוקבים (4-5-6 אדום)
//   • קבוצה (group): 3-4 אריחים באותו מספר בצבעים שונים (7 אדום/כחול/שחור)
//
// חוקים מרכזיים:
//   • "פריצה" ראשונה: כדי לרדת בפעם הראשונה, סכום האריחים שמניחים
//     חייב להיות ≥ 30 נקודות (רק מהיד שלך, בלי לערב אריחים מהשולחן).
//   • אחרי שפרצת — אפשר לסדר מחדש את כל השולחן כרצונך (לפרק ולחבר),
//     כל עוד בסיום התור כל הסטים על השולחן חוקיים.
//   • ג'וקר מחליף כל אריח. ערכו = האריח שהוא מחליף.
//   • אם אי אפשר/לא רוצים לשחק — שולפים אריח מהקופה והתור עובר.
//   • מנצח: הראשון שנפטר מכל האריחים (אמר "רמיקוב!").
//   • נגמרה הקופה ואין מהלך — מסתיים; המנצח = מי שנותרו לו הכי מעט נקודות.
//
// ── ייצוג נתונים ─────────────────────────────────────────────
// אריח: { id, color: 'red'|'blue'|'orange'|'green', num: 1..13, joker: false }
//        ג'וקר: { id, joker: true, color: null, num: null }
//   id ייחודי (למשל 'r7a') — חיוני ל-React keys ולגרירה.
// state: {
//   players: [{ id, name, isAI, rack: [tile...], hasMelded: bool }],
//   board: [ [tile...], ... ],   // מערך של סטים (כל סט = מערך אריחים)
//   pool: [tile...],             // הקופה (ערבוב)
//   turn: number,                // אינדקס השחקן בתורו
//   phase: 'play'|'ended',
//   winner: number|null,
//   lastAction: number,          // חותמת זמן לסנכרון
// }
// ─────────────────────────────────────────────────────────────

export const COLORS = ['red', 'blue', 'orange', 'green']
export const MELD_MIN = 30          // מינימום נקודות לפריצה ראשונה
export const START_TILES = 14       // אריחים בתחילת המשחק
export const JOKER_PENALTY = 30     // ערך ג'וקר שנותר ביד (לחישוב הפסד)

// ── עזר: ערבוב (Fisher-Yates) ──────────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── בניית חפיסה מלאה (106 אריחים) ──────────────────────
export function buildDeck() {
  const tiles = []
  for (const color of COLORS) {
    for (let num = 1; num <= 13; num++) {
      // שני עותקים של כל אריח
      tiles.push({ id: `${color[0]}${num}a`, color, num, joker: false })
      tiles.push({ id: `${color[0]}${num}b`, color, num, joker: false })
    }
  }
  tiles.push({ id: 'jokerA', color: null, num: null, joker: true })
  tiles.push({ id: 'jokerB', color: null, num: null, joker: true })
  return tiles
}

// ── אתחול משחק חדש ─────────────────────────────────────
export function initGame(playerDefs) {
  // playerDefs: [{ id, name, isAI }]
  const deck = shuffle(buildDeck())
  const players = playerDefs.map(p => ({
    id: p.id, name: p.name, isAI: !!p.isAI,
    rack: deck.splice(0, START_TILES),
    hasMelded: false,
  }))
  return {
    players,
    board: [],
    pool: deck,
    turn: 0,
    phase: 'play',
    winner: null,
    lastAction: Date.now(),
  }
}

// ════════════════════════════════════════════════════════
// בדיקת תקינות סטים
// ════════════════════════════════════════════════════════

// האם מערך אריחים מהווה "קבוצה" חוקית (אותו מספר, צבעים שונים, 3-4)?
function isValidGroup(tiles) {
  if (tiles.length < 3 || tiles.length > 4) return false
  const reals = tiles.filter(t => !t.joker)
  const jokers = tiles.length - reals.length
  if (reals.length === 0) return false
  // כל האריחים האמיתיים באותו מספר
  const num = reals[0].num
  if (!reals.every(t => t.num === num)) return false
  // צבעים ייחודיים (ג'וקר משלים צבע חסר — לכן בודקים שאין כפילות צבע אמיתי)
  const colors = reals.map(t => t.color)
  if (new Set(colors).size !== colors.length) return false
  // עם הג'וקרים, סך הצבעים השונים האפשריים ≤ 4
  return reals.length + jokers <= 4
}

// האם מערך אריחים מהווה "רצף" חוקי (אותו צבע, מספרים עוקבים, 3+)?
function isValidRun(tiles) {
  if (tiles.length < 3) return false
  const reals = tiles.filter(t => !t.joker)
  if (reals.length === 0) return false
  // צבע אחיד לכל האמיתיים
  const color = reals[0].color
  if (!reals.every(t => t.color === color)) return false

  // מנסים לשבץ את האריחים (כולל ג'וקרים) לרצף עוקב.
  // עוברים על האריחים לפי הסדר הנתון ובודקים שהם יוצרים רצף,
  // כאשר ג'וקר ממלא כל פער של 1.
  let jokers = tiles.filter(t => t.joker).length
  // ממיינים את האמיתיים לפי מספר
  const nums = reals.map(t => t.num).sort((a, b) => a - b)
  // אסור כפילות מספר באותו רצף
  for (let i = 1; i < nums.length; i++) if (nums[i] === nums[i - 1]) return false

  // הטווח שהרצף צריך לכסות = אורך הסט כולו
  const span = tiles.length
  const minNum = nums[0]
  // הרצף חייב להתחיל איפשהו כך שכל האמיתיים ייכנסו והג'וקרים ימלאו פערים.
  // ננסה כל נקודת התחלה אפשרית (מ-1 עד 13-span+1) שמכילה את כל ה-nums.
  for (let start = Math.max(1, minNum - jokers); start <= minNum; start++) {
    const end = start + span - 1
    if (end > 13) continue
    if (minNum < start || nums[nums.length - 1] > end) continue
    // סופרים כמה מקומות בטווח אינם מכוסים ע"י אמיתי → צריך ג'וקר
    const realSet = new Set(nums)
    let need = 0
    for (let n = start; n <= end; n++) if (!realSet.has(n)) need++
    if (need === jokers) return true
  }
  return false
}

// האם סט בודד חוקי (קבוצה או רצף)?
export function isValidSet(tiles) {
  if (!Array.isArray(tiles) || tiles.length < 3) return false
  return isValidGroup(tiles) || isValidRun(tiles)
}

// האם כל הלוח חוקי (כל הסטים בו תקינים)?
export function isBoardValid(board) {
  return board.every(set => isValidSet(set))
}

// ════════════════════════════════════════════════════════
// חישוב ערכי נקודות
// ════════════════════════════════════════════════════════

// ערך אריח לצורך פריצה: ג'וקר = הערך שהוא מחליף בתוך הסט.
// נחשב את ערך הג'וקר לפי ההקשר בסט.
function tileValueInSet(tile, set) {
  if (!tile.joker) return tile.num
  // ג'וקר — מצא איזה מספר הוא ממלא
  const reals = set.filter(t => !t.joker)
  if (reals.length === 0) return 0
  if (isValidGroup(set)) {
    // בקבוצה — ערכו = המספר המשותף
    return reals[0].num
  }
  // ברצף — נשחזר את הטווח וניקח את המספר החסר הראשון
  const color = reals[0].color
  const nums = reals.map(t => t.num).sort((a, b) => a - b)
  const span = set.length
  for (let start = 1; start + span - 1 <= 13; start++) {
    const end = start + span - 1
    if (nums[0] < start || nums[nums.length - 1] > end) continue
    const realSet = new Set(nums)
    const missing = []
    for (let n = start; n <= end; n++) if (!realSet.has(n)) missing.push(n)
    if (missing.length === set.filter(t => t.joker).length) {
      return missing[0] || reals[0].num
    }
  }
  return reals[0].num
}

// סכום נקודות של אוסף סטים (לבדיקת פריצה ≥ 30)
export function sumSetsValue(sets) {
  let total = 0
  for (const set of sets) {
    for (const tile of set) total += tileValueInSet(tile, set)
  }
  return total
}

// ערך אריחים שנותרו ביד (לחישוב מפסיד/מנצח בסוף)
export function rackValue(rack) {
  let total = 0
  for (const t of rack) total += t.joker ? JOKER_PENALTY : t.num
  return total
}

// ════════════════════════════════════════════════════════
// פעולות תור
// ════════════════════════════════════════════════════════

const cloneTiles = (arr) => arr.map(t => ({ ...t }))
function cloneState(s) {
  return {
    players: s.players.map(p => ({ ...p, rack: cloneTiles(p.rack) })),
    board: s.board.map(set => cloneTiles(set)),
    pool: cloneTiles(s.pool),
    turn: s.turn, phase: s.phase, winner: s.winner, lastAction: s.lastAction,
  }
}

// שליפת אריח מהקופה + מעבר תור. אם הקופה ריקה — רק מעבר תור.
export function drawTile(state) {
  const ns = cloneState(state)
  const player = ns.players[ns.turn]
  if (ns.pool.length > 0) {
    const tile = ns.pool.shift()
    player.rack.push(tile)
  }
  return endTurn(ns)
}

// מעבר לשחקן הבא (מדלג על מי שכבר ניצח אינו רלוונטי — אין כזה ברמיקוב)
export function endTurn(state) {
  const ns = cloneState(state)
  ns.turn = (ns.turn + 1) % ns.players.length
  ns.lastAction = Date.now()
  return ns
}

// בדיקה: האם השחקן רשאי לסיים תור עם הלוח והיד הנוכחיים?
// (כל הסטים על הלוח חוקיים; ואם זו פריצה ראשונה — עמד ב-30)
// committedValue = סכום הערך שהונח מהיד בתור הזה (לפריצה ראשונה)
export function canEndTurn(state, playerIndex, meldedThisTurn, committedValue) {
  if (!isBoardValid(state.board)) return false
  const player = state.players[playerIndex]
  if (!player.hasMelded && meldedThisTurn) {
    // פריצה ראשונה — חייב ≥ 30 מהיד בלבד
    if (committedValue < MELD_MIN) return false
  }
  return true
}

// סיום תור עם לוח חדש (אחרי שהשחקן סידר). מעדכן hasMelded ובודק ניצחון.
export function commitTurn(state, playerIndex, newBoard, newRack, didMeld) {
  const ns = cloneState(state)
  const player = ns.players[playerIndex]
  ns.board = newBoard.map(set => cloneTiles(set))
  player.rack = cloneTiles(newRack)
  if (didMeld) player.hasMelded = true
  // ניצחון — נגמרו האריחים
  if (player.rack.length === 0) {
    ns.phase = 'ended'
    ns.winner = playerIndex
    ns.lastAction = Date.now()
    return ns
  }
  return endTurn(ns)
}

// סיום משחק כשנגמרה הקופה (אם רוצים לאכוף) — המנצח לפי הכי מעט נקודות
export function resolveByPoints(state) {
  let best = 0, bestVal = Infinity
  state.players.forEach((p, i) => {
    const v = rackValue(p.rack)
    if (v < bestVal) { bestVal = v; best = i }
  })
  return { ...cloneState(state), phase: 'ended', winner: best, lastAction: Date.now() }
}

// ════════════════════════════════════════════════════════
// AI — שחקן מחשב (אסטרטגיה חמדנית פשוטה אך תקפה)
// ════════════════════════════════════════════════════════

// מנסה למצוא את כל הסטים החוקיים שאפשר להרכיב מתוך מערך אריחים נתון.
// מחזיר רשימת סטים (לא חופפים) שמקסמת את מספר האריחים שמונחים.
function findMelds(tiles) {
  // גישה חמדנית: מנסה לבנות רצפים וקבוצות מהאריחים הזמינים.
  const melds = []
  let available = [...tiles]

  // ── קבוצות (אותו מספר, צבעים שונים) ──
  for (let num = 1; num <= 13; num++) {
    const sameNum = available.filter(t => !t.joker && t.num === num)
    const byColor = {}
    for (const t of sameNum) if (!byColor[t.color]) byColor[t.color] = t
    const distinct = Object.values(byColor)
    if (distinct.length >= 3) {
      const group = distinct.slice(0, 4)
      melds.push(group)
      available = available.filter(t => !group.includes(t))
    }
  }

  // ── רצפים (אותו צבע, עוקבים) ──
  for (const color of COLORS) {
    let sameColor = available
      .filter(t => !t.joker && t.color === color)
      .sort((a, b) => a.num - b.num)
    // הסרת כפילויות מספר (נשאיר עותק אחד לרצף)
    const seen = new Set()
    sameColor = sameColor.filter(t => { if (seen.has(t.num)) return false; seen.add(t.num); return true })

    let i = 0
    while (i < sameColor.length) {
      const run = [sameColor[i]]
      let j = i + 1
      while (j < sameColor.length && sameColor[j].num === run[run.length - 1].num + 1) {
        run.push(sameColor[j]); j++
      }
      if (run.length >= 3) {
        melds.push(run)
        available = available.filter(t => !run.includes(t))
        i = j
      } else {
        i++
      }
    }
  }

  return melds
}

// מהלך ה-AI: מחזיר { board, rack, didMeld } או null אם רק שולף.
export function aiTakeTurn(state, playerIndex) {
  const player = state.players[playerIndex]
  const melds = findMelds(player.rack)

  if (melds.length > 0) {
    const value = sumSetsValue(melds)
    // אם עוד לא פרץ — צריך ≥ 30
    if (!player.hasMelded && value < MELD_MIN) {
      return null  // לא מספיק — ישלוף אריח
    }
    const usedIds = new Set(melds.flat().map(t => t.id))
    const newRack = player.rack.filter(t => !usedIds.has(t.id))
    const newBoard = [...state.board.map(s => [...s]), ...melds]
    return { board: newBoard, rack: newRack, didMeld: true }
  }

  return null  // אין מה להניח — שולף
}

// ════════════════════════════════════════════════════════
// סנכרון Firestore — שיטוח/שחזור
// (Firestore לא אוהב מערכים מקוננים עמוקים — נשמור את board כ-JSON)
// ════════════════════════════════════════════════════════
export function stateToFirestore(state) {
  return {
    players: state.players.map(p => ({
      id: p.id, name: p.name, isAI: p.isAI,
      rackCount: p.rack.length,           // לכל השחקנים — רק כמה אריחים (סודי)
      rack: p.rack,                        // נשמר; הצגה מסוננת בצד הלקוח
      hasMelded: p.hasMelded,
    })),
    boardJson: JSON.stringify(state.board),
    poolCount: state.pool.length,
    pool: state.pool,
    turn: state.turn,
    phase: state.phase,
    winner: state.winner,
    lastAction: state.lastAction,
  }
}

export function stateFromFirestore(data) {
  return {
    players: (data.players || []).map(p => ({
      id: p.id, name: p.name, isAI: p.isAI,
      rack: p.rack || [],
      hasMelded: p.hasMelded,
    })),
    board: data.boardJson ? JSON.parse(data.boardJson) : [],
    pool: data.pool || [],
    turn: data.turn || 0,
    phase: data.phase || 'play',
    winner: data.winner ?? null,
    lastAction: data.lastAction || 0,
  }
}
