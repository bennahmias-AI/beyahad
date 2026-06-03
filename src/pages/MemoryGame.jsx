// src/pages/MemoryGame.jsx
// ─────────────────────────────────────────────────────────────
// משחק הזיכרון.
//
// הכללים:
//   • הלוח מכיל זוגות של אייקונים (4×4 = 8 זוגות / 6×6 = 18 / 8×8 = 32)
//   • הקלפים הפוכים בהתחלה
//   • השחקן הופך 2 בכל פעם
//   • אם תואמים — נשארים גלויים
//   • אם לא — נסגרים אחרי שניה
//   • סיום: כל הזוגות נמצאו
//
// מציג: זמן + מספר ניסיונות, ובסיום — מסך ניצחון.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react'
import { IconBackRTL } from '../icons/index.jsx'
import { MEMORY_ICONS } from '../icons/memoryIcons.jsx'
import HomeButton from '../components/HomeButton.jsx'

// ── רמות קושי ───────────────────────────────────────────
const DIFFICULTIES = [
  { id: 'easy',   label: 'קל',    cols: 4, pairs: 8 },   // 4×4 = 16 קלפים
  { id: 'medium', label: 'בינוני', cols: 4, pairs: 8 },   // 4×4 (זהה לקל בינתיים, נוסיף 6×6 אחר כך)
  { id: 'hard',   label: 'קשה',   cols: 4, pairs: 8 },
]

// פונקציית עזר: מערבב מערך (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// בונה את לוח המשחק: לוקח N אייקונים, מכפיל ל-2, מערבב.
function buildBoard(pairCount) {
  const chosen = shuffle(MEMORY_ICONS).slice(0, pairCount)
  const deck = []
  chosen.forEach((icon, idx) => {
    // כל אייקון מופיע פעמיים, כל קלף עם id ייחודי
    deck.push({ cardId: `${icon.id}-a-${idx}`, iconId: icon.id, Icon: icon.Icon })
    deck.push({ cardId: `${icon.id}-b-${idx}`, iconId: icon.id, Icon: icon.Icon })
  })
  return shuffle(deck)
}

// פורמט זמן: שניות → "MM:SS"
function fmtTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function MemoryGame({ onBack, onHome }) {
  const pairCount = 8 // בינתיים תמיד 4×4
  const cols = 4

  // ── מצב המשחק ────────────────────────────────────────
  const [board, setBoard] = useState(() => buildBoard(pairCount))
  const [flipped, setFlipped] = useState([])      // cardIds של קלפים הפוכים כעת
  const [matched, setMatched] = useState([])      // cardIds של קלפים שנמצאו תאומים
  const [moves, setMoves] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [gameStarted, setGameStarted] = useState(false)
  const [showWin, setShowWin] = useState(false)
  const [busy, setBusy] = useState(false)         // נעילה בזמן בדיקת זוג

  // ── טיימר ─────────────────────────────────────────────
  // מתחיל בלחיצה ראשונה, נעצר כשמסיימים.
  useEffect(() => {
    if (!gameStarted || showWin) return
    const interval = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [gameStarted, showWin])

  // ── זיהוי ניצחון ──────────────────────────────────────
  useEffect(() => {
    if (matched.length === pairCount * 2 && gameStarted) {
      // עיכוב קל כדי להראות את הזוג האחרון לפני מסך הניצחון
      const t = setTimeout(() => setShowWin(true), 600)
      return () => clearTimeout(t)
    }
  }, [matched, pairCount, gameStarted])

  // ── לחיצה על קלף ─────────────────────────────────────
  const handleCardClick = (card) => {
    if (busy) return                                  // בודקים זוג כעת — לא מאפשרים
    if (flipped.includes(card.cardId)) return         // קלף כבר הפוך
    if (matched.includes(card.cardId)) return         // קלף כבר נמצא תאום

    if (!gameStarted) setGameStarted(true)

    const newFlipped = [...flipped, card.cardId]
    setFlipped(newFlipped)

    // אם זה הקלף השני — בודקים התאמה
    if (newFlipped.length === 2) {
      setMoves(m => m + 1)
      const [firstId, secondId] = newFlipped
      const firstCard = board.find(c => c.cardId === firstId)
      const secondCard = board.find(c => c.cardId === secondId)

      if (firstCard.iconId === secondCard.iconId) {
        // ✓ זוג! מוסיפים ל-matched ומאפסים מיד
        setMatched(m => [...m, firstId, secondId])
        setFlipped([])
      } else {
        // ✗ לא תואם — נועלים שניה ואז הופכים בחזרה
        setBusy(true)
        setTimeout(() => {
          setFlipped([])
          setBusy(false)
        }, 1000)
      }
    }
  }

  // ── התחלה מחדש ────────────────────────────────────────
  const resetGame = () => {
    setBoard(buildBoard(pairCount))
    setFlipped([])
    setMatched([])
    setMoves(0)
    setSeconds(0)
    setGameStarted(false)
    setShowWin(false)
    setBusy(false)
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      {/* ── Header ─────────────────────────────────── */}
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">משחק הזיכרון של מילי</div>
      </div>

      <div style={{ padding: '8px 16px 32px' }}>
        {/* ── סטטיסטיקות — זמן + ניסיונות + איפוס ────── */}
        <div style={{
          display: 'flex', gap: 10, alignItems: 'stretch',
          marginBottom: 16,
        }}>
          <StatBox label="זמן" value={fmtTime(seconds)} color="#2C5566" />
          <StatBox label="ניסיונות" value={moves} color="#7E2C2E" />
          <button onClick={resetGame} style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            padding: '0 16px',
            fontSize: 14, fontWeight: 700,
            fontFamily: 'inherit',
            color: 'var(--ink)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            🔄 התחל מחדש
          </button>
        </div>

        {/* ── לוח הקלפים ───────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 10,
          maxWidth: 500,
          margin: '0 auto',
        }}>
          {board.map(card => {
            const isFlipped = flipped.includes(card.cardId) || matched.includes(card.cardId)
            const isMatched = matched.includes(card.cardId)
            return (
              <Card
                key={card.cardId}
                card={card}
                isFlipped={isFlipped}
                isMatched={isMatched}
                onClick={() => handleCardClick(card)}
              />
            )
          })}
        </div>

        {/* ── הוראות (מוצג רק לפני שהמשתמש התחיל) ── */}
        {!gameStarted && (
          <div style={{
            marginTop: 20, padding: '14px 18px',
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5 }}>
              💡 הפכו 2 קלפים בכל פעם וחפשו זוגות תואמים
            </div>
          </div>
        )}
      </div>

      {/* ── מסך ניצחון ──────────────────────────────── */}
      {showWin && (
        <WinModal
          seconds={seconds}
          moves={moves}
          onPlayAgain={resetGame}
          onBack={onBack}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// קלף בודד — עם אנימציית הפיכה
// ═══════════════════════════════════════════════════════════
function Card({ card, isFlipped, isMatched, onClick }) {
  const { Icon } = card

  return (
    <button
      onClick={onClick}
      disabled={isMatched}
      style={{
        aspectRatio: '1',
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: isMatched ? 'default' : 'pointer',
        perspective: '1000px',
        fontFamily: 'inherit',
      }}
      aria-label={isFlipped ? 'קלף גלוי' : 'הפוך קלף'}
    >
      <div style={{
        width: '100%', height: '100%',
        position: 'relative',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.5s ease',
        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0)',
      }}>
        {/* גב הקלף — מוצג כשהקלף סגור */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #7E2C2E 0%, #5A1D1E 100%)',
          borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backfaceVisibility: 'hidden',
          boxShadow: '0 4px 12px -2px rgba(126,44,46,.3)',
          border: '2px solid #5A1D1E',
        }}>
          <div style={{
            color: '#E8C879',
            fontSize: 28, fontWeight: 800,
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.05em',
          }}>
            🤝
          </div>
        </div>

        {/* פנים הקלף — האייקון, מוצג כשהקלף הפוך */}
        <div style={{
          position: 'absolute', inset: 0,
          background: isMatched ? 'rgba(155, 232, 155, 0.15)' : 'var(--surface)',
          borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          boxShadow: 'var(--shadow-sm)',
          border: isMatched ? '2px solid #4ADE80' : '1px solid var(--line)',
          transition: 'all 0.3s',
        }}>
          <Icon size={64} />
        </div>
      </div>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════
// תיבת סטטיסטיקה (זמן/ניסיונות)
// ═══════════════════════════════════════════════════════════
function StatBox({ label, value, color }) {
  return (
    <div style={{
      flex: 1,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 14,
      padding: '10px 14px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 800, color,
        fontFamily: 'var(--font-display)', lineHeight: 1,
      }}>
        {value}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// מסך ניצחון
// ═══════════════════════════════════════════════════════════
function WinModal({ seconds, moves, onPlayAgain, onBack }) {
  // הערכה: כמה כוכבים מגיע למשתמש לפי מספר הניסיונות
  // 8 זוגות = מינימום 8 ניסיונות (מושלם), 16+ = רע
  const stars = moves <= 12 ? 3 : moves <= 18 ? 2 : 1
  const message = moves <= 12 ? 'מצוין! זיכרון מדהים!'
                : moves <= 18 ? 'יפה מאוד!'
                : 'כל הכבוד שסיימת!'

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(20,23,42,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24,
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 24,
        padding: '32px 28px 24px',
        maxWidth: 360, width: '100%',
        textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* כוכבים */}
        <div style={{ fontSize: 48, marginBottom: 10, letterSpacing: '0.05em' }}>
          {'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}
        </div>

        <div className="h-display" style={{
          fontSize: 26, color: 'var(--ink)', marginBottom: 6,
        }}>
          ניצחת! 🎉
        </div>
        <div style={{
          fontSize: 16, color: 'var(--ink-2)', marginBottom: 20,
          fontWeight: 600, lineHeight: 1.4,
        }}>
          {message}
        </div>

        {/* סטטיסטיקות סיום */}
        <div style={{
          display: 'flex', gap: 12, marginBottom: 24,
        }}>
          <div style={{
            flex: 1, background: 'var(--bg-app)', borderRadius: 12,
            padding: '14px 8px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase' }}>
              זמן
            </div>
            <div style={{
              fontSize: 22, fontWeight: 800, color: '#2C5566',
              fontFamily: 'var(--font-display)', marginTop: 2,
            }}>
              {fmtTime(seconds)}
            </div>
          </div>
          <div style={{
            flex: 1, background: 'var(--bg-app)', borderRadius: 12,
            padding: '14px 8px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase' }}>
              ניסיונות
            </div>
            <div style={{
              fontSize: 22, fontWeight: 800, color: '#7E2C2E',
              fontFamily: 'var(--font-display)', marginTop: 2,
            }}>
              {moves}
            </div>
          </div>
        </div>

        {/* כפתורים */}
        <button onClick={onPlayAgain} className="big-btn big-btn--primary" style={{
          width: '100%', marginBottom: 10,
        }}>
          🔄 שחק שוב
        </button>
        <button onClick={onBack} className="big-btn big-btn--ghost" style={{
          width: '100%',
        }}>
          חזרה לזירה
        </button>
      </div>
    </div>
  )
}
