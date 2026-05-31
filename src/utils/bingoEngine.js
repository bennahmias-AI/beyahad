// src/utils/bingoEngine.js
// ─────────────────────────────────────────────────────────────
// מנוע משחק "בינגו 75" (אמריקאי) — פונקציות טהורות.
//
// לוח 5×5, חמש עמודות: B(1-15) I(16-30) N(31-45) G(46-60) O(61-75).
// המשבצת המרכזית (שורה 2, עמודה 2) היא "חופשי" — מסומנת מראש.
//
// ניצחון: שורה אחת מלאה — אופקית, אנכית או אלכסונית (5 משבצות ברצף).
//
// ייצוג כרטיס: מערך שטוח של 25 תאים (Firestore לא תומך במערכים
// מקוננים). התא בשורה r ועמודה c נמצא באינדקס r*5+c.
//   • כל תא: { n: number|null }  (null = משבצת חופשי במרכז)
// הסימונים נשמרים בנפרד כמערך אינדקסים (marked) כדי שכל שחקן
// יסמן באופן עצמאי.
// ─────────────────────────────────────────────────────────────

export const SIZE = 5
export const FREE_INDEX = 12  // שורה 2, עמודה 2 (אמצע) — 2*5+2

// טווח כל עמודה: B,I,N,G,O
export const COLUMN_RANGES = [
  { letter: 'B', min: 1, max: 15 },
  { letter: 'I', min: 16, max: 30 },
  { letter: 'N', min: 31, max: 45 },
  { letter: 'G', min: 46, max: 60 },
  { letter: 'O', min: 61, max: 75 },
]

export const ALL_LETTERS = ['B', 'I', 'N', 'G', 'O']

// מחזיר את האות (B/I/N/G/O) של מספר נתון לפי הטווח שלו.
export function letterForNumber(num) {
  const idx = Math.floor((num - 1) / 15)
  return ALL_LETTERS[Math.min(idx, 4)]
}

// בוחר k מספרים אקראיים ושונים מטווח [min..max].
function pickUnique(min, max, k) {
  const pool = []
  for (let i = min; i <= max; i++) pool.push(i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, k)
}

// יוצר כרטיס בינגו אקראי — מערך שטוח של 25 תאים.
// כל עמודה מקבלת 5 מספרים אקראיים מהטווח שלה; האמצע חופשי (null).
export function createCard() {
  const cells = Array(25).fill(null).map(() => ({ n: null }))
  for (let c = 0; c < SIZE; c++) {
    const { min, max } = COLUMN_RANGES[c]
    const nums = pickUnique(min, max, SIZE)
    for (let r = 0; r < SIZE; r++) {
      const idx = r * SIZE + c
      if (idx === FREE_INDEX) { cells[idx] = { n: null }; continue }  // אמצע חופשי
      cells[idx] = { n: nums[r] }
    }
  }
  return cells
}

// יוצר מערך מעורבב של כל 75 הכדורים — סדר ההקראה.
export function createDrawOrder() {
  const balls = []
  for (let i = 1; i <= 75; i++) balls.push(i)
  for (let i = balls.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[balls[i], balls[j]] = [balls[j], balls[i]]
  }
  return balls
}

// כל קווי הניצחון האפשריים — שורות, עמודות, ושני אלכסונים.
// מוחזרים כאינדקסים שטוחים (0..24).
export function winningLines() {
  const lines = []
  for (let r = 0; r < SIZE; r++) {
    lines.push([0, 1, 2, 3, 4].map(c => r * SIZE + c))
  }
  for (let c = 0; c < SIZE; c++) {
    lines.push([0, 1, 2, 3, 4].map(r => r * SIZE + c))
  }
  lines.push([0, 6, 12, 18, 24])   // אלכסון ראשי
  lines.push([4, 8, 12, 16, 20])   // אלכסון משני
  return lines
}

// בודק אם יש בינגו (קו מלא) בהינתן הסימונים.
// markedSet: Set של אינדקסים שסומנו. המשבצת החופשית (12) תמיד מסומנת.
// מחזיר את הקו המנצח (מערך אינדקסים) או null.
export function findBingo(markedSet) {
  const isMarked = (idx) => idx === FREE_INDEX || markedSet.has(idx)
  for (const line of winningLines()) {
    if (line.every(isMarked)) return line
  }
  return null
}

// האם מספר נתון מופיע בכרטיס — מחזיר את האינדקס שלו, או -1.
export function indexOfNumber(card, num) {
  for (let i = 0; i < card.length; i++) {
    if (card[i] && card[i].n === num) return i
  }
  return -1
}

// בודק שכל המספרים שסומנו אכן נקראו (אימות לאונליין).
export function allMarkedWereCalled(markedNumbers, calledSet) {
  return markedNumbers.every(n => calledSet.has(n))
}
