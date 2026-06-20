// src/pages/MillionaireGame.jsx
// "כל הקופה" - משחק טריוויה בסגנון השעשועון הקלאסי.
// פריסת מסך-אחד (בלי גלילה): פס ניקוד + "קח נקודות" למעלה, נעילת תשובה inline בשורת התשובה.
//   המאגר: ../utils/triviaQuestions.js | הצלילים: ../utils/triviaSounds.js
import { useState, useEffect, useRef } from 'react'
import { IconBackRTL, IconTrophy, IconMusicNote, IconSpeaker, IconSpeakerOff, IconClock, IconLightbulb } from '../icons/index.jsx'
import { saveMillionaireScore, getMillionaireLeaderboard } from '../services/firebase.js'
import { isMuted, setMuted, MUSIC_TRACKS } from '../utils/gameSounds.js'
import { playTriviaSound, warmTriviaAudio } from '../utils/triviaSounds.js'
import { BANK } from '../utils/triviaQuestions.js'
import HomeButton from '../components/HomeButton.jsx'

// סולם הנקודות (17 שלבים)
const LADDER = [
  { level: 1,  amount: 100 },
  { level: 2,  amount: 200 },
  { level: 3,  amount: 300 },
  { level: 4,  amount: 500 },
  { level: 5,  amount: 1000,    safe: true },
  { level: 6,  amount: 2000 },
  { level: 7,  amount: 3000 },
  { level: 8,  amount: 5000 },
  { level: 9,  amount: 8000 },
  { level: 10, amount: 16000,   safe: true },
  { level: 11, amount: 32000 },
  { level: 12, amount: 64000 },
  { level: 13, amount: 125000 },
  { level: 14, amount: 250000 },
  { level: 15, amount: 500000 },
  { level: 16, amount: 750000 },
  { level: 17, amount: 1000000 },
]

// איזו רמת קושי לכל שלב בסולם
const RUNG_DIFFICULTY = [1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5]

// זמן מענה לכל שאלה (שניות)
const TIME_LIMIT = 30

// עזר: ערבוב מערך (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// עזר: מערבב את 4 התשובות ומחשב מחדש את אינדקס הנכונה
function shuffleOptions(question) {
  const correctText = question.options[question.correct]
  const shuffled = shuffle(question.options)
  return { q: question.q, options: shuffled, correct: shuffled.indexOf(correctText) }
}

// בונה שאלה לכל שלב, לפי רמת הקושי
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
const MUSIC_VOL = 0.08

// אייקונים קוויים מקומיים (משלימים את המאגר, בלי אמוג'י)
function IcRefresh({ size = 18, color = 'currentColor' }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>)
}
function IcLock({ size = 16, color = '#E8C879' }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>)
}
function IcCrown({ size = 56, color = '#E8C879' }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.2" strokeLinejoin="round"><path d="M2.5 7.5l4.2 3.8L12 4l5.3 7.3 4.2-3.8-1.9 11H4.4L2.5 7.5Z" /><rect x="4.4" y="19.2" width="15.2" height="2.4" rx="1" /></svg>)
}
function IcCoin({ size = 52, color = '#C9A24A' }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" opacity="0.5" /></svg>)
}
function IcMinus({ size = 18, color = 'currentColor' }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><line x1="8" y1="12" x2="16" y2="12" /></svg>)
}

export default function MillionaireGame({ onBack, onHome, uid, userName }) {
  const [questions, setQuestions] = useState(() => buildQuestions())
  const [level, setLevel] = useState(0)
  const [selected, setSelected] = useState(null)
  const [locked, setLocked] = useState(false)
  const [removed, setRemoved] = useState([])
  const [usedFifty, setUsedFifty] = useState(false)
  const [usedHint, setUsedHint] = useState(false)
  const [hint, setHint] = useState(null)
  const [showLadder, setShowLadder] = useState(false)
  const [ending, setEnding] = useState(null)
  const [muted, setMutedState] = useState(isMuted())
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)

  // מוזיקת רקע
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem('beyahad_millionaire_music') !== 'off' } catch { return true } })
  const [trackIdx, setTrackIdx] = useState(() => Math.floor(Math.random() * MUSIC_TRACKS.length))
  const audioRef = useRef(null)

  const endedRef = useRef(false)  // מבטיח שהמשחק יסתיים רק פעם אחת

  const current = questions[level]
  const currentPrize = LADDER[level].amount
  const walkAmount = level > 0 ? LADDER[level - 1].amount : 0

  // סיום משחק - מקור אמת יחיד (מונע סיום כפול בין טיימר לנעילה)
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

  const toggleMusic = () => setMusicOn(o => {
    const n = !o
    try { localStorage.setItem('beyahad_millionaire_music', n ? 'on' : 'off') } catch { /* ignore */ }
    return n
  })

  // ניגון/עצירה של מוזיקת הרקע
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (musicOn && !ending) { a.volume = MUSIC_VOL; a.play().catch(() => {}) } else { a.pause() }
  }, [musicOn, trackIdx, ending])

  // הפעלה ראשונה אחרי מגע (חוסם autoplay בדפדפנים)
  useEffect(() => {
    const kick = () => { const a = audioRef.current; if (a && musicOn && !ending && a.paused) a.play().catch(() => {}) }
    window.addEventListener('pointerdown', kick)
    window.addEventListener('touchstart', kick)
    return () => { window.removeEventListener('pointerdown', kick); window.removeEventListener('touchstart', kick) }
  }, [musicOn, ending])

  // איפוס הטיימר בכל שאלה חדשה
  useEffect(() => { setTimeLeft(TIME_LIMIT) }, [level])

  // ספירה לאחור - רגועה, שנייה בכל פעם
  useEffect(() => {
    if (locked || ending) return            // קופא בזמן חשיפת תשובה / סיום
    if (timeLeft <= 0) {
      // הזמן אזל - מתייחסים כמו לטעות (נשארים עם המובטח)
      setLocked(true)
      playTriviaSound('wrong')
      setTimeout(() => finishGame('timeout', guaranteedAt(level)), 1500)
      return
    }
    if (timeLeft <= 5) playTriviaSound('tick')  // 5 שניות אחרונות - פעמון בכל שנייה
    const id = setTimeout(() => setTimeLeft(v => v - 1), 1000)
    return () => clearTimeout(id)
  }, [timeLeft, locked, ending, level])

  // בחירת תשובה (שלב 1)
  const handleSelect = (idx) => {
    if (locked || removed.includes(idx)) return
    setSelected(idx)
    playTriviaSound('select')
  }

  // נעילת תשובה סופית (שלב 2) - חושף נכון/שגוי
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
          setHint(null)
        }
      } else {
        finishGame('lose', guaranteedAt(level))
      }
    }, 1800)
  }

  // עזרה: הורד תשובה - מסיר תשובה שגויה
  const useFifty = () => {
    if (usedFifty || locked) return
    setUsedFifty(true)
    playTriviaSound('lifeline')
    const wrongs = [0, 1, 2, 3].filter(i => i !== current.correct && !removed.includes(i))
    const toRemove = shuffle(wrongs).slice(0, 1)
    setRemoved(prev => [...prev, ...toRemove])
    if (toRemove.includes(selected)) setSelected(null)
  }

  // עזרה: רמז
  const useHint = () => {
    if (usedHint || locked) return
    setUsedHint(true)
    playTriviaSound('lifeline')
    const correctText = String(current.options[current.correct] ?? '')
    const firstChar = correctText.trim().charAt(0) || '?'
    setHint('התשובה הנכונה מתחילה באות: ' + firstChar)
  }

  // קח את הנקודות ופרוש
  const walkAway = () => {
    if (locked || walkAmount === 0) return
    finishGame('walk', walkAmount)
  }

  // התחל משחק חדש
  const restart = () => {
    endedRef.current = false
    setQuestions(buildQuestions())
    setLevel(0)
    setSelected(null)
    setLocked(false)
    setRemoved([])
    setUsedFifty(false)
    setUsedHint(false)
    setHint(null)
    setShowLadder(false)
    setEnding(null)
    setTimeLeft(TIME_LIMIT)
  }

  const timeLow = timeLeft <= 10
  const iconBtn = {
    background: 'rgba(232,200,121,.15)', border: '1px solid rgba(232,200,121,.4)',
    color: '#E8C879', borderRadius: 12, width: 42, height: 42,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', direction: 'rtl', background: 'var(--bg-app)' }}>
      {/* Header */}
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">כל הקופה</div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 9, padding: '8px 14px 12px', overflow: 'hidden' }}>
        {/* פס ניקוד + שליטה + קח נקודות (למעלה) */}
        <div style={{
          background: 'linear-gradient(135deg, #1B2540 0%, #2A1438 100%)',
          borderRadius: 18, padding: '12px 16px', color: '#FBF7EE',
          boxShadow: '0 8px 22px -8px rgba(27,37,64,.5)',
          display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: .8, marginBottom: 3 }}>
                שאלה {level + 1} מתוך {LADDER.length}
              </div>
              <div className="h-display" style={{ fontSize: 26, lineHeight: 1, color: '#E8C879' }}>
                {fmtPoints(currentPrize)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={toggleMusic} aria-label={musicOn ? 'כבה מוזיקה' : 'הפעל מוזיקה'} style={{ ...iconBtn, opacity: musicOn ? 1 : .5 }}>
                <IconMusicNote size={20} color="#E8C879" />
              </button>
              <button onClick={toggleMute} aria-label={muted ? 'הפעל צליל' : 'השתק'} style={{ ...iconBtn, opacity: muted ? .5 : 1 }}>
                {muted ? <IconSpeakerOff size={20} color="#E8C879" /> : <IconSpeaker size={20} color="#E8C879" />}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={walkAway}
              disabled={locked || walkAmount === 0}
              style={{
                flex: 1, background: 'rgba(232,200,121,.15)', border: '1px solid rgba(232,200,121,.4)',
                color: '#E8C879', borderRadius: 12, padding: '11px 12px', fontSize: 14, fontWeight: 800,
                fontFamily: 'inherit', cursor: (locked || walkAmount === 0) ? 'default' : 'pointer',
                opacity: (locked || walkAmount === 0) ? .45 : 1, whiteSpace: 'nowrap',
              }}
            >
              קח את הנקודות · {fmtPoints(walkAmount)}
            </button>
            <button
              onClick={() => setShowLadder(true)}
              style={{
                background: 'rgba(232,200,121,.15)', border: '1px solid rgba(232,200,121,.4)',
                color: '#E8C879', borderRadius: 12, padding: '11px 14px', fontSize: 14, fontWeight: 800,
                fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              }}
            >
              <IconTrophy size={17} color="#E8C879" /> סולם
            </button>
          </div>
        </div>

        {/* טיימר רגוע */}
        {!ending && (
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>זמן לתשובה</span>
              <span className="h-display" style={{ fontSize: 17, color: timeLow ? '#C0392B' : 'var(--ink)' }}>
                {Math.max(0, timeLeft)} שׁנ׳
              </span>
            </div>
            <div style={{ height: 8, background: 'var(--surface)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <div style={{
                height: '100%', width: `${(Math.max(0, timeLeft) / TIME_LIMIT) * 100}%`,
                background: timeLow ? '#C0392B' : '#E8C879', borderRadius: 99,
                transition: 'width 1s linear, background .3s',
              }} />
            </div>
          </div>
        )}

        {/* כרטיס השאלה */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16,
          padding: '16px 18px', boxShadow: 'var(--shadow-sm)', textAlign: 'center', flexShrink: 0,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.35 }}>
            {current.q}
          </div>
        </div>

        {hint && (
          <div style={{ background: 'rgba(232,200,121,.18)', border: '1px solid #E8C879', borderRadius: 12, padding: '9px 14px', fontSize: 15, fontWeight: 700, color: 'var(--ink)', textAlign: 'center', flexShrink: 0 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><IconLightbulb size={20} /> {hint}</span>
          </div>
        )}

        {/* 4 התשובות - ממלאות את שאר המסך. נעילה inline בשורה שנבחרה */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', overflowY: 'auto' }}>
          {current.options.map((opt, idx) => (
            <AnswerButton
              key={idx}
              letter={LETTERS[idx]}
              text={opt}
              state={getAnswerState({ idx, selected, locked, correct: current.correct, removed })}
              onClick={() => handleSelect(idx)}
              onLock={handleLock}
            />
          ))}
        </div>

        {/* עזרות */}
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <LifelineButton icon={<IcMinus size={18} />} label="הורד תשובה" hint="הסר תשובה שגויה" used={usedFifty} disabled={locked} onClick={useFifty} />
          <LifelineButton icon={<IconLightbulb size={18} />} label="רמז" hint="קבל רמז לתשובה" used={usedHint} disabled={locked} onClick={useHint} />
        </div>
      </div>

      <audio ref={audioRef} src={MUSIC_TRACKS[trackIdx]} onEnded={() => setTrackIdx(i => (i + 1) % MUSIC_TRACKS.length)} onPlay={(e) => { e.currentTarget.volume = MUSIC_VOL }} style={{ display: 'none' }} />

      {showLadder && <LadderModal level={level} onClose={() => setShowLadder(false)} />}

      {ending && (
        <EndModal ending={ending} uid={uid} userName={userName} onPlayAgain={restart} onBack={onBack} />
      )}
    </div>
  )
}

// עזר: מצב כפתור תשובה
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
// כפתור תשובה - עם נעילה inline כשנבחר
// ═══════════════════════════════════════════════════════════
function AnswerButton({ letter, text, state, onClick, onLock }) {
  const styles = {
    idle:     { bg: 'var(--surface)', border: 'var(--line)',   ink: 'var(--ink)',   badge: '#1B2540', badgeInk: '#E8C879' },
    selected: { bg: '#FBEFD3',        border: '#E8C879',       ink: '#5A1D1E',      badge: '#E8C879', badgeInk: '#1B2540' },
    correct:  { bg: '#DFF3E4',        border: '#4ADE80',       ink: '#14532D',      badge: '#22A65A', badgeInk: '#fff' },
    wrong:    { bg: '#FBE3E3',        border: '#E06464',       ink: '#7E2C2E',      badge: '#C0392B', badgeInk: '#fff' },
    removed:  { bg: 'var(--bg-app)',  border: 'var(--line)',   ink: 'var(--ink-3)', badge: 'var(--line)', badgeInk: 'var(--ink-3)' },
  }
  const s = styles[state]
  const isRemoved = state === 'removed'
  const showLock = state === 'selected'

  return (
    <div
      role="button"
      tabIndex={isRemoved ? -1 : 0}
      onClick={isRemoved ? undefined : onClick}
      style={{
        background: s.bg,
        border: `2px solid ${s.border}`,
        borderRadius: 16,
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        textAlign: 'right',
        cursor: isRemoved ? 'default' : 'pointer',
        fontFamily: 'inherit',
        opacity: isRemoved ? .35 : 1,
        transition: 'all .2s',
        minHeight: 54,
        boxShadow: showLock ? '0 4px 14px -4px rgba(232,200,121,.6)' : 'none',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: '50%',
        background: s.badge, color: s.badgeInk,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 19, fontWeight: 900, fontFamily: 'var(--font-display)', flexShrink: 0,
      }}>
        {letter}
      </div>
      <div style={{ flex: 1, fontSize: 18, fontWeight: 700, color: s.ink, lineHeight: 1.3 }}>
        {isRemoved ? '' : text}
      </div>
      {showLock && (
        <button
          onClick={(e) => { e.stopPropagation(); onLock() }}
          aria-label="נעל תשובה סופית"
          style={{
            flexShrink: 0, background: '#1B2540', color: '#E8C879',
            border: '1px solid #E8C879', borderRadius: 12, padding: '9px 14px',
            fontSize: 15, fontWeight: 900, fontFamily: 'inherit', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}
        >
          <IcLock size={16} color="#E8C879" /> נעל
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// כפתור עזרה (Lifeline)
// ═══════════════════════════════════════════════════════════
function LifelineButton({ icon, label, hint, used, disabled, onClick }) {
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
        padding: '10px 8px',
        cursor: off ? 'default' : 'pointer',
        fontFamily: 'inherit',
        opacity: used ? .45 : (disabled ? .6 : 1),
        textDecoration: used ? 'line-through' : 'none',
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginTop: 1 }}>
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
        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', textAlign: 'center', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <IconTrophy size={22} color="#C9A24A" /> סולם הנקודות
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
    win:     { emoji: '🎉👑🎉', title: 'כל הקופה!',       msg: 'ענית נכון על כל השאלות!' },
    lose:    { emoji: '💡',      title: 'נגמר המשחק',      msg: amount > 0 ? 'טעית אבל הנקודות המובטחות נשארות שלך!' : 'טעית הפעם. נסה שוב!' },
    walk:    { emoji: '💰',      title: 'לקחת את הנקודות',  msg: 'החלטה חכמה! הנקודות מובטחות.' },
    timeout: { emoji: '⏱️',     title: 'נגמר הזמן!',       msg: amount > 0 ? 'הזמן אזל אבל הנקודות המובטחות נשארות שלך!' : 'הזמן אזל. נסה שוב!' },
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
        <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
          {result === 'win' ? <IcCrown size={58} color="#E8C879" />
            : result === 'walk' ? <IcCoin size={52} color="#C9A24A" />
            : result === 'timeout' ? <IconClock size={52} color="#7E2C2E" />
            : <IconLightbulb size={58} />}
        </div>
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
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><IcRefresh size={18} color="currentColor" /> שחק שוב</span>
        </button>
        <button onClick={onBack} className="big-btn big-btn--ghost" style={{ width: '100%' }}>
          חזרה לזירה
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// טבלת מובילים - מי צבר הכי הרבה נקודות היום
// ═══════════════════════════════════════════════════════════
function Leaderboard({ board, myUid }) {
  const rankBg = ['#E8C879', '#CBD0DA', '#D8A36A']
  return (
    <div style={{
      background: 'var(--bg-app)', border: '1px solid var(--line)',
      borderRadius: 16, padding: '14px 14px 10px', textAlign: 'right',
    }}>
      <div className="h-display" style={{ fontSize: 17, color: 'var(--ink)', textAlign: 'center', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
        <IconTrophy size={18} color="#C9A24A" /> המובילים היום
      </div>

      {board === null ? (
        <div style={{ fontSize: 14, color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0', fontWeight: 600 }}>
          טוען תוצאות...
        </div>
      ) : board.length === 0 ? (
        <div style={{ fontSize: 14, color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0', fontWeight: 600 }}>
          אתה הראשון היום!
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
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: rankBg[i] || 'var(--line)', color: '#1B2540', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {i + 1}
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
