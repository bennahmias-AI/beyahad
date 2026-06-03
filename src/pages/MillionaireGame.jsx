// src/pages/MillionaireGame.jsx
// ─────────────────────────────────────────────────────────────
// "מי רוצה להיות מיליונר" — משחק טריוויה בסגנון השעשועון הקלאסי.
//
// הכללים:
//   • 15 שאלות, כל אחת עם 4 תשובות (א/ב/ג/ד)
//   • סולם נקודות עולה — מ-100 ועד 1,000,000 נקודות
//   • שתי תחנות מובטחות (1,000 ו-32,000) — אם טועים, לא יורדים מתחתן
//   • שתי עזרות: 50:50 (מסיר 2 תשובות שגויות) ושאל את הקהל
//   • אפשר "לקחת את הנקודות" ולפרוש בכל שלב לפני נעילת תשובה
//   • טיימר רגוע של 30 שניות לכל שאלה (כדי שלא יחפשו בגוגל)
//   • בסוף — טבלת המובילים של היום (מי צבר הכי הרבה נקודות)
//
//   המאגר עצמו נמצא בקובץ נפרד: ../utils/triviaQuestions.js
//   הצלילים בקובץ: ../utils/triviaSounds.js (כיבוי משותף עם gameSounds)
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { IconBackRTL } from '../icons/index.jsx'
import { saveMillionaireScore, getMillionaireLeaderboard } from '../services/firebase.js'
import { isMuted, setMuted } from '../utils/gameSounds.js'
import { playTriviaSound, warmTriviaAudio } from '../utils/triviaSounds.js'
import { BANK } from '../utils/triviaQuestions.js'
import HomeButton from '../components/HomeButton.jsx'

// ── סולם הנקודות (15 שלבים) ────────────────────────────
const LADDER = [
  { level: 1,  amount: 100 },
  { level: 2,  amount: 200 },
  { level: 3,  amount: 300 },
  { level: 4,  amount: 500 },
  { level: 5,  amount: 1000,    safe: true },
  { level: 6,  amount: 2000 },
  { level: 7,  amount: 4000 },
  { level: 8,  amount: 8000 },
  { level: 9,  amount: 16000 },
  { level: 10, amount: 32000,   safe: true },
  { level: 11, amount: 64000 },
  { level: 12, amount: 125000 },
  { level: 13, amount: 250000 },
  { level: 14, amount: 500000 },
  { level: 15, amount: 1000000 },
]

// איזו רמת קושי לכל שלב בסולם (אינדקס 0..14)
const RUNG_DIFFICULTY = [1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5]

// זמן מענה לכל שאלה (שניות)
const TIME_LIMIT = 30

// ── עזר: ערבוב מערך (Fisher-Yates) ──────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── עזר: מערבב את 4 התשובות ומחשב מחדש את אינדקס הנכונה ──
function shuffleOptions(question) {
  const correctText = question.options[question.correct]
  const shuffled = shuffle(question.options)
  return { q: question.q, options: shuffled, correct: shuffled.indexOf(correctText) }
}

// ── בונה 15 שאלות — אחת לכל שלב, לפי רמת הקושי ──────────
function buildQuestions() {
  const usedPerDiff = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  return RUNG_DIFFICULTY.map(diff => {
    const pool = BANK[diff]
    let available = pool.filter((_, i) => !usedPerDiff[diff].includes(i))
    if (available.length === 0) { usedPerDiff[diff] = []; available = pool }
    const pickIdxInPool = pool.indexOf(available[Math.floor(Math.random() * available.length)])
    usedPerDiff[diff].push(pickIdxInPool)
    return shuffleOptions(pool[pickIdxInPool])
  })
}

function fmtPoints(n) {
  return n.toLocaleString('he-IL') + ' נק׳'
}

// הניקוד המובטח שצברו עד עכשיו (התחנה המובטחת האחרונה)
function guaranteedAt(answeredCount) {
  let g = 0
  for (let i = 0; i < answeredCount; i++) {
    if (LADDER[i].safe) g = LADDER[i].amount
  }
  return g
}

const LETTERS = ['א', 'ב', 'ג', 'ד']

export default function MillionaireGame({ onBack, onHome, uid, userName }) {
  const [questions, setQuestions] = useState(() => buildQuestions())
  const [level, setLevel] = useState(0)
  const [selected, setSelected] = useState(null)
  const [locked, setLocked] = useState(false)
  const [removed, setRemoved] = useState([])
  const [usedFifty, setUsedFifty] = useState(false)
  const [usedAudience, setUsedAudience] = useState(false)
  const [audienceData, setAudienceData] = useState(null)
  const [showLadder, setShowLadder] = useState(false)
  const [ending, setEnding] = useState(null)
  const [muted, setMutedState] = useState(isMuted())
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)

  const endedRef = useRef(false)  // מבטיח שהמשחק יסתיים רק פעם אחת

  const current = questions[level]
  const currentPrize = LADDER[level].amount
  const walkAmount = level > 0 ? LADDER[level - 1].amount : 0

  // סיום משחק — מקור אמת יחיד (מונע סיום כפול בין טיימר לנעילה)
  function finishGame(result, amount) {
    if (endedRef.current) return
    endedRef.current = true
    setEnding({ result, amount })
  }

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    setMutedState(next)
    if (!next) warmTriviaAudio()
  }

  // ── איפוס הטיימר בכל שאלה חדשה ─────────────────────────
  useEffect(() => { setTimeLeft(TIME_LIMIT) }, [level])

  // ── ספירה לאחור — רגועה, שנייה בכל פעם ─────────────────
  useEffect(() => {
    if (locked || ending) return            // קופא בזמן חשיפת תשובה / סיום
    if (timeLeft <= 0) {
      // הזמן אזל — מתייחסים כמו לטעות (נשארים עם המובטח)
      setLocked(true)
      playTriviaSound('wrong')
      setTimeout(() => finishGame('timeout', guaranteedAt(level)), 1500)
      return
    }
    if (timeLeft <= 5) playTriviaSound('tick')  // 5 שניות אחרונות — פעמון בכל שנייה
    const id = setTimeout(() => setTimeLeft(v => v - 1), 1000)
    return () => clearTimeout(id)
  }, [timeLeft, locked, ending, level])

  // ── בחירת תשובה (שלב 1) ───────────────────────────────
  const handleSelect = (idx) => {
    if (locked || removed.includes(idx)) return
    setSelected(idx)
    playTriviaSound('select')
  }

  // ── נעילת תשובה סופית (שלב 2) — חושף נכון/שגוי ─────────
  const handleLock = () => {
    if (selected === null || locked) return
    setLocked(true)
    const isCorrect = selected === current.correct
    const isLast = level === LADDER.length - 1
    playTriviaSound('lock')
    setTimeout(() => playTriviaSound(isCorrect ? (isLast ? 'win' : 'correct') : 'wrong'), 650)
    setTimeout(() => {
      if (isCorrect) {
        if (isLast) {
          finishGame('win', LADDER[level].amount)
        } else {
          setLevel(l => l + 1)
          setSelected(null)
          setLocked(false)
          setRemoved([])
          setAudienceData(null)
        }
      } else {
        finishGame('lose', guaranteedAt(level))
      }
    }, 1800)
  }

  // ── עזרה: 50:50 — מסיר 2 תשובות שגויות ────────────────
  const useFifty = () => {
    if (usedFifty || locked) return
    setUsedFifty(true)
    playTriviaSound('lifeline')
    const wrongs = [0, 1, 2, 3].filter(i => i !== current.correct)
    const toRemove = shuffle(wrongs).slice(0, 2)
    setRemoved(toRemove)
    if (toRemove.includes(selected)) setSelected(null)
  }

  // ── עזרה: שאל את הקהל ─────────────────────────────────
  const useAudience = () => {
    if (usedAudience || locked) return
    setUsedAudience(true)
    playTriviaSound('lifeline')
    const visible = [0, 1, 2, 3].filter(i => !removed.includes(i))
    const correctPct = 55 + Math.floor(Math.random() * 25)
    let remaining = 100 - correctPct
    const others = visible.filter(i => i !== current.correct)
    const data = [{ idx: current.correct, pct: correctPct }]
    others.forEach((idx, k) => {
      const isLast = k === others.length - 1
      const pct = isLast ? remaining : Math.floor(Math.random() * (remaining + 1))
      remaining -= pct
      data.push({ idx, pct })
    })
    setAudienceData(data.sort((a, b) => a.idx - b.idx))
  }

  // ── קח את הנקודות ופרוש ───────────────────────────────
  const walkAway = () => {
    if (locked) return
    finishGame('walk', walkAmount)
  }

  // ── התחל משחק חדש ─────────────────────────────────────
  const restart = () => {
    endedRef.current = false
    setQuestions(buildQuestions())
    setLevel(0)
    setSelected(null)
    setLocked(false)
    setRemoved([])
    setUsedFifty(false)
    setUsedAudience(false)
    setAudienceData(null)
    setShowLadder(false)
    setEnding(null)
    setTimeLeft(TIME_LIMIT)
  }

  const timeLow = timeLeft <= 10

  return (
    <div className="scroll-area" style={{ direction: 'rtl', background: 'var(--bg-app)' }}>
      {/* ── Header ─────────────────────────────────── */}
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">מי רוצה להיות מיליונר</div>
      </div>

      <div style={{ padding: '8px 16px 32px' }}>
        {/* ── פס ניקוד נוכחי ────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #1B2540 0%, #2A1438 100%)',
          borderRadius: 20,
          padding: '18px 20px',
          color: '#FBF7EE',
          boxShadow: '0 8px 22px -8px rgba(27,37,64,.5)',
          marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, opacity: .8, marginBottom: 4 }}>
              שאלה {level + 1} מתוך {LADDER.length}
            </div>
            <div className="h-display" style={{ fontSize: 28, lineHeight: 1, color: '#E8C879' }}>
              {fmtPoints(currentPrize)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={toggleMute}
              aria-label={muted ? 'הפעל צליל' : 'השתק'}
              style={{
                background: 'rgba(232,200,121,.15)',
                border: '1px solid rgba(232,200,121,.4)',
                color: '#E8C879', borderRadius: 12,
                padding: '10px 12px', fontSize: 16, fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              onClick={() => setShowLadder(true)}
              style={{
                background: 'rgba(232,200,121,.15)',
                border: '1px solid rgba(232,200,121,.4)',
                color: '#E8C879', borderRadius: 12,
                padding: '10px 14px', fontSize: 14, fontWeight: 800,
                fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              🏆 סולם הנקודות
            </button>
          </div>
        </div>

        {/* ── טיימר רגוע ────────────────────────────── */}
        {!ending && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>
                זמן לתשובה
              </span>
              <span className="h-display" style={{
                fontSize: 18, color: timeLow ? '#C0392B' : 'var(--ink)',
              }}>
                {Math.max(0, timeLeft)} שׁנ׳
              </span>
            </div>
            <div style={{
              height: 8, background: 'var(--surface)', borderRadius: 99,
              overflow: 'hidden', border: '1px solid var(--line)',
            }}>
              <div style={{
                height: '100%',
                width: `${(Math.max(0, timeLeft) / TIME_LIMIT) * 100}%`,
                background: timeLow ? '#C0392B' : '#E8C879',
                borderRadius: 99,
                transition: 'width 1s linear, background .3s',
              }} />
            </div>
          </div>
        )}

        {/* ── כרטיס השאלה ───────────────────────────── */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 18,
          padding: '22px 20px',
          marginBottom: 16,
          boxShadow: 'var(--shadow-sm)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.4 }}>
            {current.q}
          </div>
        </div>

        {/* ── 4 התשובות ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {current.options.map((opt, idx) => (
            <AnswerButton
              key={idx}
              letter={LETTERS[idx]}
              text={opt}
              state={getAnswerState({ idx, selected, locked, correct: current.correct, removed })}
              audiencePct={audienceData?.find(d => d.idx === idx)?.pct}
              onClick={() => handleSelect(idx)}
            />
          ))}
        </div>

        {/* ── עזרות ─────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <LifelineButton label="50:50" hint="הסר 2 שגויות" used={usedFifty} disabled={locked} onClick={useFifty} />
          <LifelineButton label="👥 הקהל" hint="שאל את הקהל" used={usedAudience} disabled={locked} onClick={useAudience} />
        </div>

        {/* ── כפתורי פעולה ──────────────────────────── */}
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleLock}
            disabled={selected === null || locked}
            className="big-btn big-btn--primary"
            style={{ width: '100%', opacity: (selected === null || locked) ? .5 : 1 }}
          >
            🔒 נעל תשובה סופית
          </button>
          <button
            onClick={walkAway}
            disabled={locked}
            className="big-btn big-btn--ghost"
            style={{ width: '100%', opacity: locked ? .5 : 1 }}
          >
            קח את הנקודות — {fmtPoints(walkAmount)}
          </button>
        </div>
      </div>

      {showLadder && <LadderModal level={level} onClose={() => setShowLadder(false)} />}

      {ending && (
        <EndModal ending={ending} uid={uid} userName={userName} onPlayAgain={restart} onBack={onBack} />
      )}
    </div>
  )
}

// ── עזר: מצב כפתור תשובה ────────────────────────────────
function getAnswerState({ idx, selected, locked, correct, removed }) {
  if (removed.includes(idx)) return 'removed'
  if (locked) {
    if (idx === correct) return 'correct'
    if (idx === selected) return 'wrong'
    return 'idle'
  }
  if (idx === selected) return 'selected'
  return 'idle'
}

// ═══════════════════════════════════════════════════════════
// כפתור תשובה
// ═══════════════════════════════════════════════════════════
function AnswerButton({ letter, text, state, audiencePct, onClick }) {
  const styles = {
    idle:     { bg: 'var(--surface)', border: 'var(--line)',   ink: 'var(--ink)',   badge: '#1B2540', badgeInk: '#E8C879' },
    selected: { bg: '#FBEFD3',        border: '#E8C879',       ink: '#5A1D1E',      badge: '#E8C879', badgeInk: '#1B2540' },
    correct:  { bg: '#DFF3E4',        border: '#4ADE80',       ink: '#14532D',      badge: '#22A65A', badgeInk: '#fff' },
    wrong:    { bg: '#FBE3E3',        border: '#E06464',       ink: '#7E2C2E',      badge: '#C0392B', badgeInk: '#fff' },
    removed:  { bg: 'var(--bg-app)',  border: 'var(--line)',   ink: 'var(--ink-3)', badge: 'var(--line)', badgeInk: 'var(--ink-3)' },
  }
  const s = styles[state]
  const isRemoved = state === 'removed'

  return (
    <button
      onClick={onClick}
      disabled={isRemoved}
      style={{
        position: 'relative',
        background: s.bg,
        border: `2px solid ${s.border}`,
        borderRadius: 16,
        padding: '16px 16px',
        display: 'flex', alignItems: 'center', gap: 14,
        textAlign: 'right',
        cursor: isRemoved ? 'default' : 'pointer',
        fontFamily: 'inherit',
        opacity: isRemoved ? .35 : 1,
        transition: 'all .2s',
        overflow: 'hidden',
        minHeight: 60,
      }}
    >
      {audiencePct != null && !isRemoved && (
        <div style={{
          position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0,
          width: `${audiencePct}%`, background: 'rgba(232,200,121,.28)', zIndex: 0,
        }} />
      )}
      <div style={{
        position: 'relative', zIndex: 1,
        width: 40, height: 40, borderRadius: '50%',
        background: s.badge, color: s.badgeInk,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-display)', flexShrink: 0,
      }}>
        {letter}
      </div>
      <div style={{
        position: 'relative', zIndex: 1,
        flex: 1, fontSize: 19, fontWeight: 700, color: s.ink, lineHeight: 1.3,
      }}>
        {isRemoved ? '' : text}
      </div>
      {audiencePct != null && !isRemoved && (
        <div style={{
          position: 'relative', zIndex: 1,
          fontSize: 15, fontWeight: 800, color: 'var(--ink-2)', flexShrink: 0,
        }}>
          {audiencePct}%
        </div>
      )}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════
// כפתור עזרה (Lifeline)
// ═══════════════════════════════════════════════════════════
function LifelineButton({ label, hint, used, disabled, onClick }) {
  const off = used || disabled
  return (
    <button
      onClick={onClick}
      disabled={off}
      style={{
        flex: 1,
        background: used ? 'var(--bg-app)' : 'var(--surface)',
        border: `2px solid ${used ? 'var(--line)' : 'var(--line-strong)'}`,
        borderRadius: 14,
        padding: '12px 8px',
        cursor: off ? 'default' : 'pointer',
        fontFamily: 'inherit',
        opacity: used ? .45 : (disabled ? .6 : 1),
        textDecoration: used ? 'line-through' : 'none',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
        {label}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginTop: 2 }}>
        {used ? 'נוצלה' : hint}
      </div>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════
// מודל סולם הנקודות
// ═══════════════════════════════════════════════════════════
function LadderModal({ level, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,23,42,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: 22, padding: '20px 18px',
          maxWidth: 320, width: '100%', maxHeight: '80vh', overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', textAlign: 'center', marginBottom: 14 }}>
          🏆 סולם הנקודות
        </div>
        <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 5 }}>
          {LADDER.map((rung, i) => {
            const isCurrent = i === level
            const isPassed = i < level
            return (
              <div key={rung.level} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 14px', borderRadius: 10,
                background: isCurrent ? '#E8C879' : (rung.safe ? 'rgba(232,200,121,.12)' : 'transparent'),
                border: rung.safe ? '1px solid rgba(232,200,121,.5)' : '1px solid transparent',
              }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: isCurrent ? '#1B2540' : (isPassed ? 'var(--ink-3)' : 'var(--ink)') }}>
                  {rung.level}
                </span>
                <span style={{
                  fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-display)',
                  color: isCurrent ? '#1B2540' : (isPassed ? 'var(--ink-3)' : 'var(--ink)'),
                }}>
                  {fmtPoints(rung.amount)}
                  {rung.safe && <span style={{ fontSize: 11, marginInlineStart: 6 }}>🔒</span>}
                </span>
              </div>
            )
          })}
        </div>
        <button onClick={onClose} className="big-btn big-btn--primary" style={{ width: '100%', marginTop: 16 }}>
          סגור
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// מסך סיום + טבלת מובילים יומית
// ═══════════════════════════════════════════════════════════
function EndModal({ ending, uid, userName, onPlayAgain, onBack }) {
  const { result, amount } = ending
  const [board, setBoard] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      await saveMillionaireScore(uid, userName, amount)
      const top = await getMillionaireLeaderboard(10)
      if (alive) setBoard(top)
    })()
    return () => { alive = false }
  }, [])

  const config = {
    win:     { emoji: '🎉👑🎉', title: 'מיליונר!',       msg: 'ענית נכון על כל השאלות!' },
    lose:    { emoji: '💡',      title: 'נגמר המשחק',      msg: amount > 0 ? 'טעית — אבל הנקודות המובטחות נשארות שלך!' : 'טעית הפעם. נסה שוב!' },
    walk:    { emoji: '💰',      title: 'לקחת את הנקודות',  msg: 'החלטה חכמה! הנקודות מובטחות.' },
    timeout: { emoji: '⏱️',     title: 'נגמר הזמן!',       msg: amount > 0 ? 'הזמן אזל — אבל הנקודות המובטחות נשארות שלך!' : 'הזמן אזל. נסה שוב!' },
  }[result]

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(20,23,42,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1100, padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 24, padding: '28px 24px 22px',
        maxWidth: 380, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        textAlign: 'center', boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ fontSize: 46, marginBottom: 8 }}>{config.emoji}</div>
        <div className="h-display" style={{ fontSize: 26, color: 'var(--ink)', marginBottom: 6 }}>
          {config.title}
        </div>
        <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 16, lineHeight: 1.4 }}>
          {config.msg}
        </div>

        <div style={{ background: 'linear-gradient(135deg, #1B2540 0%, #2A1438 100%)', borderRadius: 16, padding: '14px', marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.7)', marginBottom: 4 }}>
            צברת
          </div>
          <div className="h-display" style={{ fontSize: 32, color: '#E8C879', lineHeight: 1 }}>
            {fmtPoints(amount)}
          </div>
        </div>

        <Leaderboard board={board} myUid={uid} />

        <button onClick={onPlayAgain} className="big-btn big-btn--primary" style={{ width: '100%', marginTop: 18, marginBottom: 10 }}>
          🔄 שחק שוב
        </button>
        <button onClick={onBack} className="big-btn big-btn--ghost" style={{ width: '100%' }}>
          חזרה לזירה
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// טבלת מובילים — מי צבר הכי הרבה נקודות היום
// ═══════════════════════════════════════════════════════════
function Leaderboard({ board, myUid }) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div style={{
      background: 'var(--bg-app)', border: '1px solid var(--line)',
      borderRadius: 16, padding: '14px 14px 10px', textAlign: 'right',
    }}>
      <div className="h-display" style={{ fontSize: 17, color: 'var(--ink)', textAlign: 'center', marginBottom: 10 }}>
        🏆 המובילים היום
      </div>

      {board === null ? (
        <div style={{ fontSize: 14, color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0', fontWeight: 600 }}>
          טוען תוצאות...
        </div>
      ) : board.length === 0 ? (
        <div style={{ fontSize: 14, color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0', fontWeight: 600 }}>
          אתה הראשון היום! 🎉
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {board.map((row, i) => {
            const isMe = myUid && row.uid === myUid
            return (
              <div key={row.uid || i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 10,
                background: isMe ? 'rgba(232,200,121,.22)' : 'var(--surface)',
                border: isMe ? '1px solid #E8C879' : '1px solid var(--line)',
              }}>
                <span style={{ fontSize: 16, fontWeight: 900, minWidth: 26, textAlign: 'center', color: 'var(--ink-2)' }}>
                  {medals[i] || (i + 1)}
                </span>
                <span style={{
                  flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {row.name || 'משתמש'}{isMe ? ' (אתה)' : ''}
                </span>
                <span style={{
                  fontSize: 15, fontWeight: 800, color: '#7E2C2E',
                  fontFamily: 'var(--font-display)', flexShrink: 0,
                }}>
                  {(row.points || 0).toLocaleString('he-IL')}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
