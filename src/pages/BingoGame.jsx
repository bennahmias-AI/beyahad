// src/pages/BingoGame.jsx
// ─────────────────────────────────────────────────────────────
// משחק "בינגו 75" (אמריקאי) — כרטיס 5×5, עמודות B-I-N-G-O.
//
// 2 מצבים:
//   1. לבד — מקריא אוטומטי מוציא מספר כל כמה שניות, אתה מסמן,
//      וכשמשלימים שורה לוחצים "בינגו!".
//   2. אונליין — עד 10 שחקנים. המארח הוא ה"מקריא": לוחץ "מספר הבא"
//      וכולם מקבלים את אותו מספר. כל שחקן מסמן בכרטיס שלו, והראשון
//      שמשלים שורה ולוחץ "בינגו!" — מנצח.
//
// ניצחון: שורה אחת מלאה (אופקית / אנכית / אלכסונית).
//
// בנוי על תשתית bingoRooms ב-firebase.js (מודל רמיקוב/מלך-הזירה).
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { IconBackRTL } from '../icons/index.jsx'
import { GameIcon } from '../icons/gameIcons.jsx'
import { useUserStore } from '../stores/userStore.js'
import { playSound, isMuted, setMuted } from '../utils/gameSounds.js'
import Avatar from '../components/Avatar.jsx'
import { ChatPanel, ChatToast, ChatHeaderButton } from '../components/GameChat.jsx'
import {
  createCard, createDrawOrder, findBingo,
  letterForNumber, FREE_INDEX, ALL_LETTERS, allMarkedWereCalled,
} from '../utils/bingoEngine.js'
import {
  createBingoRoom, joinBingoRoom, startBingoGame, updateBingoState,
  watchBingoRoom, leaveBingoRoom, findOrCreateBingoMatch, watchFriendships,
  sendGameInvite, watchUser, sendBingoChat,
} from '../services/firebase.js'

// ── פלטה (בורגונדי — תואם לכרטיס בזירה) ──────────────────
const BG_DEEP = 'linear-gradient(180deg,#5A1D1E 0%,#3E1213 100%)'
const BURG = '#7E2C2E'
const BURG_DEEP = '#5A1D1E'
const GOLD = '#E8C879'
const GOLD_DEEP = '#C9A24A'
const CREAM = '#FBF7EE'
// צבע עמודה לפי האות
const COL_COLORS = ['#7E2C2E', '#B89048', '#4F6B4A', '#2C5566', '#6B3A4F']

// ════════════════════════════════════════════════════════
// רכיב ראשי — ניתוב בין מצבי המשחק
// ════════════════════════════════════════════════════════
export default function BingoGame({ onBack, initialRoomId }) {
  const [mode, setMode] = useState(initialRoomId ? 'online-friend' : null)
  const [roomId, setRoomId] = useState(initialRoomId || null)

  useEffect(() => {
    if (initialRoomId) { setMode('online-friend'); setRoomId(initialRoomId) }
  }, [initialRoomId])

  if (!mode) {
    return (
      <ModeSelectScreen
        onBack={onBack}
        onSelectSolo={() => setMode('solo')}
        onSelectOnlineRandom={() => setMode('online-random')}
        onSelectOnlineFriend={() => setMode('online-friend')}
      />
    )
  }

  if (mode === 'online-random' || mode === 'online-friend') {
    if (!roomId) {
      return <OnlineLobby mode={mode} onBack={() => setMode(null)} onReady={(id) => setRoomId(id)} />
    }
    return (
      <OnlineGameScreen
        roomId={roomId}
        onBack={() => { setRoomId(null); setMode(null) }}
        onExit={onBack}
      />
    )
  }

  return <SoloGameScreen onBack={() => setMode(null)} onExit={onBack} />
}

// ════════════════════════════════════════════════════════
// מסך בחירת מצב
// ════════════════════════════════════════════════════════
function ModeSelectScreen({ onBack, onSelectSolo, onSelectOnlineRandom, onSelectOnlineFriend }) {
  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <div className="screen-header__title">בינגו</div>
      </div>

      <div style={{ padding: '8px 20px 32px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #7E2C2E 0%, #5A1D1E 100%)',
          borderRadius: 20, padding: '20px 18px', color: '#FBF7EE', marginBottom: 24,
          boxShadow: '0 8px 20px -6px rgba(126,44,46,.4)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🎱</div>
          <div className="h-display" style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 6 }}>בינגו</div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'rgba(255,255,255,.92)' }}>
            סמנו את המספרים שיוצאים — מי שמשלים שורה ראשון, צועק בינגו!
          </div>
        </div>

        <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>בחרו איך לשחק:</h2>

        <ModeButton onClick={onSelectOnlineRandom} iconId="online-random"
          gradient="linear-gradient(135deg, #7E2C2E, #5A1D1E)"
          label="משחק רנדומלי" description="שחקו עם אנשים אחרים באפליקציה" badge="חדש" />
        <ModeButton onClick={onSelectOnlineFriend} iconId="online-friend"
          gradient="linear-gradient(135deg, #4F6B4A, #354D31)"
          label="שחק עם חברים" description="הזמינו חברים לשולחן (עד 10)" badge="חדש" />
        <ModeButton onClick={onSelectSolo} iconId="vs-ai"
          gradient="linear-gradient(135deg, #2C5566, #173846)"
          label="לבד" description="המספרים עולים אוטומטית — תרגול נחמד" />
      </div>
    </div>
  )
}

function ModeButton({ onClick, iconId, gradient, label, description, badge }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'right', background: 'var(--surface)',
      border: '1px solid var(--line)', borderRadius: 18, padding: '16px 16px',
      marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14,
      fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', position: 'relative',
    }}>
      {badge && (
        <div style={{
          position: 'absolute', top: -8, insetInlineStart: 12, background: 'var(--burgundy)',
          color: 'white', fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 999,
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

// ════════════════════════════════════════════════════════
// כרטיס הבינגו — 5×5 עם כותרת B-I-N-G-O
// ════════════════════════════════════════════════════════
function BingoCard({ card, markedSet, calledSet, winningLine, onCellTap, disabled }) {
  const winSet = new Set(winningLine || [])
  return (
    <div style={{
      background: 'linear-gradient(180deg,#FBF7EE,#F0E7D4)',
      borderRadius: 18, padding: 8, maxWidth: 380, margin: '0 auto',
      boxShadow: '0 10px 28px -8px rgba(0,0,0,.5), inset 0 2px 5px rgba(255,255,255,.6)',
      border: `3px solid ${GOLD_DEEP}`,
    }}>
      {/* כותרת B-I-N-G-O — נכפה LTR כדי שתיקרא משמאל לימין */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 5, marginBottom: 5, direction: 'ltr' }}>
        {ALL_LETTERS.map((L, c) => (
          <div key={L} style={{
            background: COL_COLORS[c], color: '#FBF7EE', borderRadius: 10,
            textAlign: 'center', padding: '7px 0', fontFamily: "'Suez One', serif",
            fontSize: 24, fontWeight: 800, letterSpacing: '1px',
            boxShadow: 'inset 0 -2px 4px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.2)',
          }}>{L}</div>
        ))}
      </div>

      {/* רשת 5×5 — גם כאן LTR כדי שהעמודות יתאימו לכותרת B-I-N-G-O */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 5, direction: 'ltr' }}>
        {card.map((cell, idx) => {
          const isFree = idx === FREE_INDEX
          const marked = isFree || markedSet.has(idx)
          const isWin = winSet.has(idx)
          // ניתן לסמן רק אם המספר כבר נקרא (או חופשי)
          const callable = !isFree && cell.n != null && calledSet.has(cell.n)
          return (
            <button
              key={idx}
              onClick={() => !disabled && callable && onCellTap(idx)}
              disabled={disabled || (!callable && !marked)}
              style={{
                aspectRatio: '1', borderRadius: 12, border: 'none',
                fontWeight: 800,
                fontSize: 'clamp(16px, 5.5vw, 24px)', cursor: (callable && !disabled) ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', fontFamily: "'Suez One', serif",
                background: isWin
                  ? 'linear-gradient(180deg,#7FBF7A,#4F6B4A)'
                  : marked
                  ? 'linear-gradient(180deg,#B83E40,#7E2C2E)'
                  : '#EAE0CA',
                color: (isWin || marked) ? '#FBF7EE' : '#7A6E54',
                boxShadow: marked || isWin
                  ? 'inset 0 -2px 5px rgba(0,0,0,.3), 0 2px 4px rgba(0,0,0,.25)'
                  : 'inset 0 1px 2px rgba(0,0,0,.06)',
                transition: 'all .15s',
              }}
            >
              {isFree ? (
                <span style={{ fontSize: 'clamp(11px,3.5vw,15px)', lineHeight: 1.1 }}>חופשי ⭐</span>
              ) : (
                cell.n
              )}
              {marked && !isFree && (
                <span style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '1.6em', color: 'rgba(255,255,255,.35)',
                  pointerEvents: 'none',
                }}>●</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// תצוגת המספר שיצא + לוח המספרים שנקראו
// ════════════════════════════════════════════════════════
function CurrentBall({ num }) {
  if (num == null) {
    return (
      <div style={{
        width: 92, height: 92, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(255,255,255,.08)', border: '2px dashed rgba(232,200,121,.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: GOLD_DEEP, fontSize: 13, fontWeight: 700, textAlign: 'center', lineHeight: 1.3,
      }}>טרם<br />יצא מספר</div>
    )
  }
  const letter = letterForNumber(num)
  return (
    <div style={{
      width: 92, height: 92, borderRadius: '50%', flexShrink: 0,
      background: 'radial-gradient(circle at 35% 30%, #FFFDF6, #ECE0C4 70%, #D8C9A4)',
      border: `3px solid ${GOLD}`,
      boxShadow: '0 4px 14px rgba(0,0,0,.5), inset 0 -3px 6px rgba(0,0,0,.15)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      animation: 'bingoBallPop .4s ease',
    }}>
      <div style={{ fontFamily: "'Suez One', serif", fontSize: 18, fontWeight: 800, color: BURG, lineHeight: 1 }}>{letter}</div>
      <div style={{ fontFamily: "'Suez One', serif", fontSize: 34, fontWeight: 800, color: '#1B2540', lineHeight: 1 }}>{num}</div>
      <style>{`@keyframes bingoBallPop { 0% { transform: scale(0.3); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  )
}

// רצועת המספרים האחרונים שנקראו
function CalledStrip({ called }) {
  const recent = called.slice(-8).reverse()
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: GOLD_DEEP, fontWeight: 700, marginBottom: 5 }}>
        מספרים שיצאו ({called.length}/75)
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {recent.length === 0 ? (
          <span style={{ fontSize: 13, color: 'rgba(243,226,190,.5)' }}>—</span>
        ) : recent.map((n, i) => (
          <span key={n} style={{
            minWidth: 30, height: 30, borderRadius: '50%', padding: '0 4px',
            background: i === 0 ? GOLD : 'rgba(255,255,255,.12)',
            color: i === 0 ? '#1B2540' : CREAM,
            border: i === 0 ? `2px solid ${CREAM}` : '1px solid rgba(201,162,74,.4)',
            fontSize: 13, fontWeight: 800, fontFamily: "'Suez One', serif",
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{n}</span>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מעטפת מסך משחק — כותרת כהה + רקע בורגונדי
// ════════════════════════════════════════════════════════
function BingoShell({ onBack, isOnline, chatNode, children }) {
  return (
    <div className="scroll-area" style={{ direction: 'rtl', background: BG_DEEP, minHeight: '100%' }}>
      <div className="screen-header" style={{ background: 'transparent' }}>
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה"
          style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)' }}>
          <IconBackRTL size={24} color="#E8C879" />
        </button>
        <div className="screen-header__title" style={{ color: '#FBF7EE' }}>בינגו {isOnline ? 'אונליין' : ''}</div>
        {chatNode}
      </div>
      <div style={{ padding: '4px 14px 28px' }}>
        {children}
      </div>
    </div>
  )
}

// כפתור פעולה גדול (בורגונדי / זהב / רפאים)
function BingoButton({ label, onClick, variant = 'gold', disabled, style }) {
  const styles = {
    gold: { background: 'linear-gradient(180deg,#F2CE6A,#C9A24A)', color: '#3E1213', border: '1px solid #F2CE6A' },
    burg: { background: 'linear-gradient(180deg,#B83E40,#7E2C2E)', color: '#FBF7EE', border: '1px solid #E8C879' },
    ghost: { background: 'rgba(255,255,255,.10)', color: '#FBF7EE', border: '1px solid rgba(255,255,255,.2)' },
  }
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      flex: 1, borderRadius: 14, padding: '15px 12px', fontSize: 17, fontWeight: 800,
      fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.2), 0 4px 10px rgba(0,0,0,.35)',
      ...styles[variant], ...style,
    }}>{label}</button>
  )
}

// ════════════════════════════════════════════════════════
// מצב לבד — מקריא אוטומטי
// ════════════════════════════════════════════════════════
function SoloGameScreen({ onBack, onExit }) {
  const [card] = useState(() => createCard())
  const [drawOrder] = useState(() => createDrawOrder())
  const [drawIdx, setDrawIdx] = useState(-1)        // אינדקס אחרון שנקרא בסדר ההגרלה
  const [marked, setMarked] = useState(() => new Set())
  const [won, setWon] = useState(false)
  const [winningLine, setWinningLine] = useState(null)
  const [missed, setMissed] = useState(false)       // לחצו בינגו בלי שורה מלאה
  const [paused, setPaused] = useState(false)
  const [muted, setMutedState] = useState(() => isMuted())

  const called = drawIdx >= 0 ? drawOrder.slice(0, drawIdx + 1) : []
  const calledSet = new Set(called)
  const currentNum = drawIdx >= 0 ? drawOrder[drawIdx] : null

  // המקריא האוטומטי — מספר חדש כל 3.5 שניות
  useEffect(() => {
    if (won || paused) return
    if (drawIdx >= drawOrder.length - 1) return
    const t = setTimeout(() => {
      setDrawIdx(i => i + 1)
      playSound('drop')
    }, drawIdx < 0 ? 800 : 3500)
    return () => clearTimeout(t)
  }, [drawIdx, won, paused, drawOrder.length])

  const toggleMark = (idx) => {
    if (won) return
    setMarked(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const callBingo = () => {
    const line = findBingo(marked)
    if (line) {
      setWinningLine(line)
      setWon(true)
      playSound('win')
    } else {
      setMissed(true)
      playSound('lose')
      setTimeout(() => setMissed(false), 2200)
    }
  }

  const toggleMute = () => { const n = !muted; setMutedState(n); setMuted(n) }

  const restart = () => {
    window.location.reload()  // פשוט ובטוח — כרטיס חדש לגמרי
  }

  return (
    <BingoShell onBack={onBack} isOnline={false}>
      {/* שורת המספר הנוכחי + לוח שנקרא + השתקה */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
        background: 'rgba(0,0,0,.18)', borderRadius: 16, padding: '12px 14px',
        border: '1px solid rgba(201,162,74,.25)',
      }}>
        <CurrentBall num={currentNum} />
        <CalledStrip called={called} />
        <button onClick={toggleMute} aria-label={muted ? 'הפעל סאונד' : 'השתק'} style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)',
          fontSize: 20, cursor: 'pointer', color: '#fff',
        }}>{muted ? '🔇' : '🔊'}</button>
      </div>

      {missed && (
        <div style={{
          background: 'rgba(232,72,79,.92)', color: '#fff', borderRadius: 12,
          padding: '10px 14px', textAlign: 'center', fontWeight: 800, fontSize: 15, marginBottom: 12,
        }}>עדיין אין שורה מלאה — תמשיכו לסמן! 🎯</div>
      )}

      <BingoCard
        card={card} markedSet={marked} calledSet={calledSet}
        winningLine={winningLine} onCellTap={toggleMark} disabled={won}
      />

      {/* כפתורים */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        {!won && (
          <>
            <BingoButton label="🎉 בינגו!" variant="gold" onClick={callBingo} />
            <BingoButton label={paused ? '▶ המשך' : '⏸ עצור'} variant="ghost"
              onClick={() => setPaused(p => !p)} style={{ flex: '0 0 36%' }} />
          </>
        )}
        {won && (
          <BingoButton label="🔄 משחק חדש" variant="gold" onClick={restart} />
        )}
      </div>

      {won && <WinModal title="בינגו! 🎉" subtitle="השלמת שורה — כל הכבוד!" onPlayAgain={restart} onExit={onExit} />}
    </BingoShell>
  )
}

// ════════════════════════════════════════════════════════
// Lobby אונליין — חיפוש רנדומלי / הזמנת חברים
// ════════════════════════════════════════════════════════
function OnlineLobby({ mode, onBack, onReady }) {
  const { profile, authUser } = useUserStore()
  const me = { uid: authUser?.uid, name: profile?.name || 'משתמש' }
  const [phase, setPhase] = useState(mode === 'online-random' ? 'searching' : 'friend-list')
  const [errorMsg, setErrorMsg] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [friends, setFriends] = useState([])
  const startedRef = useRef(false)

  useEffect(() => {
    if (mode !== 'online-friend' || !me.uid) return
    const unsub = watchFriendships(me.uid, ({ friends }) => setFriends(friends))
    return () => unsub && unsub()
  }, [mode, me.uid])

  useEffect(() => {
    if (mode !== 'online-random' || startedRef.current) return
    startedRef.current = true
    ;(async () => {
      if (!me.uid) { setErrorMsg('צריך להיות מחובר'); setPhase('error'); return }
      try {
        const { roomId } = await findOrCreateBingoMatch({ player: me, maxPlayers: 10 })
        onReady(roomId)
      } catch (e) {
        console.error('bingo match error:', e)
        setErrorMsg('לא הצלחנו למצוא משחק — נסו שוב')
        setPhase('error')
      }
    })()
  }, [mode]) // eslint-disable-line

  useEffect(() => {
    if (phase !== 'searching') return
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  const inviteFriend = async (friend) => {
    if (!me.uid) return
    setErrorMsg('')
    try {
      const { roomId } = await createBingoRoom({ host: me, roomType: 'private', maxPlayers: 10 })
      await sendGameInvite({
        from: me, to: { uid: friend.otherUid, name: friend.otherName },
        gameType: 'bingo', roomId,
      })
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
      <div style={{
        position: 'fixed', inset: 0, background: 'linear-gradient(180deg, #5A1D1E, #3E1213)',
        color: 'white', display: 'flex', flexDirection: 'column', padding: '32px 24px 28px',
        direction: 'rtl', zIndex: 100,
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={onBack} style={{
            width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.12)',
            color: 'white', border: 'none', fontSize: 22, cursor: 'pointer',
          }}>←</button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
          <div style={{ fontSize: 72 }}>🎱</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Suez One', serif" }}>מחפש לך שולחן...</div>
            <div style={{ fontSize: 16, opacity: 0.85, marginTop: 8 }}>⏱ {formatTime(elapsed)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.10)', borderRadius: 16, padding: '14px 18px', fontSize: 15, textAlign: 'center', lineHeight: 1.5, maxWidth: 320 }}>
            💡 כשעוד אנשים ילחצו על "בינגו"<br />תתחברו לאותו שולחן
          </div>
        </div>
        <button onClick={onBack} className="big-btn big-btn--danger" style={{ width: '100%' }}>✕ ביטול</button>
      </div>
    )
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <div className="screen-header__title">שחק עם חברים</div>
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
      })
    })
    return () => unsubs.forEach(u => u && u())
  }, [friends])

  if (!friends || friends.length === 0) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '36px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 14 }}>👥</div>
        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>אין לך עדיין חברים ברשימה</div>
        <div style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 20 }}>הוסיפו חברים בקפה או בפרלמנט — ואז תוכלו להזמין אותם למשחק.</div>
        <button onClick={onBack} className="big-btn big-btn--ghost" style={{ width: '100%' }}>חזרה</button>
      </div>
    )
  }

  const onlineFriends = friends.filter(f => onlineMap[f.otherUid])
  const offlineFriends = friends.filter(f => !onlineMap[f.otherUid])

  return (
    <>
      <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 6px', color: 'var(--ink)' }}>הזמינו חברים לשולחן</h2>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 14 }}>אפשר להזמין כמה חברים. כשהם יצטרפו — תתחילו לשחק.</div>
      {onlineFriends.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--success)', margin: '4px 2px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            מחוברים עכשיו ({onlineFriends.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {onlineFriends.map(f => <FriendRow key={f.docId} friend={f} online onInvite={() => onInvite(f)} />)}
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
            {offlineFriends.map(f => <FriendRow key={f.docId} friend={f} online={false} onInvite={() => onInvite(f)} />)}
          </div>
        </>
      )}
    </>
  )
}

function FriendRow({ friend, online, onInvite }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <Avatar name={friend.otherName} size={50} online={online} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="h-display" style={{ fontSize: 17, color: 'var(--ink)' }}>{friend.otherName}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: online ? 'var(--success)' : 'var(--ink-3)' }}>
          {online ? 'מחובר עכשיו' : 'לא מחובר'}
        </div>
      </div>
      <button onClick={onInvite} style={{
        background: online ? 'var(--success)' : 'var(--burgundy)', color: 'white', border: 'none',
        borderRadius: 12, padding: '11px 16px', fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}>🎮 הזמן</button>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מסך אונליין — חדר המתנה + משחק
// ════════════════════════════════════════════════════════
function OnlineGameScreen({ roomId, onBack, onExit }) {
  const { authUser, profile } = useUserStore()
  const me = { uid: authUser?.uid, name: profile?.name || 'משתמש' }
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const joinedRef = useRef(false)

  useEffect(() => {
    if (!joinedRef.current) {
      joinedRef.current = true
      joinBingoRoom(roomId, me).catch(() => {})
    }
    const unsub = watchBingoRoom(roomId, (data) => {
      if (!data) { setError('המשחק נסגר'); return }
      setRoom(data)
    })
    return () => unsub && unsub()
  }, [roomId])

  if (error) {
    return (
      <BingoShell onBack={onExit} isOnline>
        <div style={{ background: 'var(--surface)', borderRadius: 20, padding: '32px 24px', textAlign: 'center', marginTop: 20 }}>
          <div style={{ fontSize: 56, marginBottom: 14 }}>👋</div>
          <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>{error}</div>
          <button onClick={onExit} className="big-btn big-btn--primary" style={{ width: '100%', marginTop: 12 }}>חזרה לזירה</button>
        </div>
      </BingoShell>
    )
  }

  if (!room) {
    return (
      <BingoShell onBack={onBack} isOnline>
        <div style={{ padding: 24, textAlign: 'center', color: CREAM }}>טוען...</div>
      </BingoShell>
    )
  }

  if (room.status === 'waiting') {
    return <WaitingRoom room={room} roomId={roomId} me={me} onBack={onBack} />
  }
  return <OnlinePlay room={room} roomId={roomId} me={me} profile={profile} onBack={onBack} onExit={onExit} />
}

// חדר המתנה — רשימת שחקנים + כפתור התחלה למארח
function WaitingRoom({ room, roomId, me, onBack }) {
  const isHost = room.hostUid === me.uid
  const players = room.players || []
  const startedRef = useRef(false)

  const handleStart = async () => {
    if (startedRef.current) return
    startedRef.current = true
    // מצב התחלתי: כרטיס לכל שחקן, סדר הגרלה, אף מספר לא נקרא עדיין
    const cards = {}
    players.forEach(p => { cards[p.uid] = createCard() })
    const state = {
      drawOrder: createDrawOrder(),
      drawIdx: -1,                 // אינדקס אחרון שנקרא
      cards,                       // { uid: card[] }
      winner: null,                // { uid, name, line } כשמישהו ניצח
      players: players.map(p => ({ uid: p.uid, name: p.name })),
    }
    await startBingoGame(roomId, state)
  }

  const handleLeave = async () => {
    if (isHost) await leaveBingoRoom(roomId)
    onBack()
  }

  return (
    <BingoShell onBack={handleLeave} isOnline>
      <div style={{ textAlign: 'center', marginBottom: 20, marginTop: 6 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🎱</div>
        <div className="h-display" style={{ fontSize: 22, color: GOLD }}>
          {isHost ? 'מחכים לשחקנים' : 'הצטרפת לשולחן'}
        </div>
        <div style={{ marginTop: 8, fontSize: 14, color: CREAM, opacity: .85 }}>
          {isHost ? 'אפשר להתחיל מ-2 שחקנים' : 'מחכים שהמארח יתחיל'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {players.map((p) => (
          <div key={p.uid} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'rgba(255,255,255,.08)', border: `1px solid ${GOLD_DEEP}`,
            borderRadius: 14, padding: '12px 16px',
          }}>
            <Avatar name={p.name} size={42} />
            <div style={{ flex: 1, fontFamily: "'Suez One', serif", fontSize: 17, color: CREAM }}>
              {p.name}{p.uid === me.uid ? ' (אתה)' : ''}
            </div>
            {p.uid === room.hostUid && <span style={{ fontSize: 12, color: GOLD, fontWeight: 800 }}>👑 מקריא</span>}
          </div>
        ))}
      </div>

      {isHost ? (
        <BingoButton label={players.length >= 2 ? `▶ התחל משחק (${players.length})` : 'צריך לפחות 2 שחקנים'}
          variant="gold" disabled={players.length < 2} onClick={handleStart} />
      ) : (
        <div style={{ textAlign: 'center', color: CREAM, fontSize: 15, padding: '12px' }}>
          ⏳ מחכים שהמארח יתחיל את המשחק…
        </div>
      )}
    </BingoShell>
  )
}

// ── מסך המשחק האונליין עצמו ──
function OnlinePlay({ room, roomId, me, profile, onBack, onExit }) {
  const state = room.gameStateJson ? JSON.parse(room.gameStateJson) : null
  const [marked, setMarked] = useState(() => new Set())
  const [missed, setMissed] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [muted, setMutedState] = useState(() => isMuted())
  const lastDrawRef = useRef(-1)

  const isHost = room.hostUid === me.uid
  const myCard = state?.cards?.[me.uid] || null
  const drawOrder = state?.drawOrder || []
  const drawIdx = state?.drawIdx ?? -1
  const called = drawIdx >= 0 ? drawOrder.slice(0, drawIdx + 1) : []
  const calledSet = new Set(called)
  const currentNum = drawIdx >= 0 ? drawOrder[drawIdx] : null
  const winner = state?.winner || null
  const chat = room.chat || []

  // סאונד כשיוצא מספר חדש
  useEffect(() => {
    if (drawIdx > lastDrawRef.current) {
      lastDrawRef.current = drawIdx
      if (drawIdx >= 0) playSound('drop')
    }
  }, [drawIdx])

  // סאונד ניצחון/הפסד
  const finishedRef = useRef(false)
  useEffect(() => {
    if (winner && !finishedRef.current) {
      finishedRef.current = true
      playSound(winner.uid === me.uid ? 'win' : 'lose')
    }
  }, [winner, me.uid])

  // מקריא אוטומטי — רק המארח מריץ את זה. מוציא מספר חדש כל 5 שניות.
  // משתמש ב-timeout שמתאפס עם כל עדכון drawIdx (מה-watch), כך הקצב יציב
  // גם אם הכתיבה ל-Firestore לוקחת רגע. נעצר כשיש מנצח או שנגמרו המספרים.
  useEffect(() => {
    if (!isHost || winner) return
    if (drawIdx >= drawOrder.length - 1) return
    const delay = drawIdx < 0 ? 1500 : 5000   // המספר הראשון מעט מהר יותר
    const t = setTimeout(() => {
      updateBingoState(roomId, { ...state, drawIdx: drawIdx + 1 })
    }, delay)
    return () => clearTimeout(t)
  }, [isHost, winner, drawIdx, drawOrder.length, roomId]) // eslint-disable-line

  if (!state || !myCard) {
    return (
      <BingoShell onBack={onBack} isOnline>
        <div style={{ padding: 24, textAlign: 'center', color: CREAM }}>טוען את המשחק...</div>
      </BingoShell>
    )
  }

  const toggleMark = (idx) => {
    if (winner) return
    setMarked(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const callBingo = async () => {
    const line = findBingo(marked)
    // אימות: כל המסומנים אכן נקראו
    const markedNums = [...marked].map(i => myCard[i]?.n).filter(n => n != null)
    const valid = line && allMarkedWereCalled(markedNums, calledSet)
    if (valid) {
      await updateBingoState(roomId, {
        ...state,
        winner: { uid: me.uid, name: me.name, line },
      })
      playSound('win')
    } else {
      setMissed(true)
      playSound('lose')
      setTimeout(() => setMissed(false), 2200)
    }
  }

  const toggleMute = () => { const n = !muted; setMutedState(n); setMuted(n) }
  const handleLeave = async () => { if (isHost) await leaveBingoRoom(roomId); onBack() }

  const winningLine = winner && winner.uid === me.uid ? winner.line : null

  const chatNode = (
    <ChatHeaderButton chat={chat} open={chatOpen} onOpen={() => setChatOpen(true)}
      bg="rgba(255,255,255,.12)" border="rgba(255,255,255,.22)" color="#E8C879" />
  )

  return (
    <BingoShell onBack={handleLeave} isOnline chatNode={chatNode}>
      {/* המספר הנוכחי + מה שיצא */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
        background: 'rgba(0,0,0,.18)', borderRadius: 16, padding: '12px 14px',
        border: '1px solid rgba(201,162,74,.25)',
      }}>
        <CurrentBall num={currentNum} />
        <CalledStrip called={called} />
        <button onClick={toggleMute} aria-label={muted ? 'הפעל סאונד' : 'השתק'} style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)',
          fontSize: 20, cursor: 'pointer', color: '#fff',
        }}>{muted ? '🔇' : '🔊'}</button>
      </div>

      {/* פס שחקנים */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {(state.players || []).map(p => (
          <div key={p.uid} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,.08)', border: '1px solid rgba(201,162,74,.3)',
            borderRadius: 999, padding: '4px 10px 4px 4px',
          }}>
            <Avatar name={p.name} size={24} />
            <span style={{ fontSize: 12, fontWeight: 700, color: CREAM }}>
              {p.name}{p.uid === me.uid ? ' (אתה)' : ''}{p.uid === room.hostUid ? ' 👑' : ''}
            </span>
          </div>
        ))}
      </div>

      {missed && (
        <div style={{
          background: 'rgba(232,72,79,.92)', color: '#fff', borderRadius: 12,
          padding: '10px 14px', textAlign: 'center', fontWeight: 800, fontSize: 15, marginBottom: 12,
        }}>עדיין אין שורה מלאה — תמשיכו לסמן! 🎯</div>
      )}

      <BingoCard
        card={myCard} markedSet={marked} calledSet={calledSet}
        winningLine={winningLine} onCellTap={toggleMark} disabled={!!winner}
      />

      {/* כפתור בינגו — המספרים עולים אוטומטית, אז אין צורך ב-"מספר הבא" */}
      {!winner && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <BingoButton label="🎉 בינגו!" variant="gold" onClick={callBingo} />
        </div>
      )}
      {!winner && (
        <div style={{ textAlign: 'center', color: CREAM, fontSize: 13, marginTop: 10, opacity: .75 }}>
          המספרים עולים אוטומטית — סמנו ולחצו "בינגו!" כשתשלימו שורה
        </div>
      )}

      <ChatToast msgs={chat} meUid={me.uid} suppressed={chatOpen} onOpen={() => setChatOpen(true)} />
      {chatOpen && <ChatPanel roomId={roomId} me={me} msgs={chat} onClose={() => setChatOpen(false)} sendFn={sendBingoChat} />}

      {winner && (
        <WinModal
          title={winner.uid === me.uid ? 'בינגו! 🎉' : `${winner.name} ניצח/ה`}
          subtitle={winner.uid === me.uid ? 'השלמת שורה ראשון — כל הכבוד!' : 'משחק יפה — אפשר לשחק שוב'}
          onPlayAgain={null}
          onExit={onExit}
          exitLabel="חזרה לזירה"
        />
      )}
    </BingoShell>
  )
}

// ════════════════════════════════════════════════════════
// מודל ניצחון
// ════════════════════════════════════════════════════════
function WinModal({ title, subtitle, onPlayAgain, onExit, exitLabel = 'חזרה לזירה' }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(40,10,11,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24, direction: 'rtl',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24,
        padding: '32px 28px 24px', maxWidth: 360, width: '100%', textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🎉</div>
        <div className="h-display" style={{ fontSize: 28, color: BURG, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 16, color: 'var(--ink-2)', marginBottom: 24, fontWeight: 600, lineHeight: 1.4 }}>{subtitle}</div>
        {onPlayAgain && (
          <button onClick={onPlayAgain} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 10 }}>🔄 משחק חדש</button>
        )}
        <button onClick={onExit} className="big-btn big-btn--ghost" style={{ width: '100%' }}>{exitLabel}</button>
      </div>
    </div>
  )
}
