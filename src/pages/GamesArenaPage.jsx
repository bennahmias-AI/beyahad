// src/pages/GamesArenaPage.jsx
// ─────────────────────────────────────────────────────────────
// זירת המשחקים — מסך בחירת משחק.
//
// כל משחק מוצג ככרטיס יפה עם:
//   • אייקון/אמוג'י גדול
//   • שם המשחק
//   • תיאור קצר
//   • כמה שחקנים נדרשים
//   • סטטוס: זמין / בקרוב
//
// בעתיד כל משחק יהיה כפתור שמוביל למסך המשחק עצמו.
// בינתיים — כולם מציגים "בקרוב" עד שנבנה אותם.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useUserStore } from '../stores/userStore.js'
import { submitGameSuggestion } from '../services/firebase.js'
import { IconBackRTL, IconLightbulb } from '../icons/index.jsx'
import { GameIcon } from '../icons/gameIcons.jsx'
import HomeButton from '../components/HomeButton.jsx'

// ── רשימת המשחקים ─────────────────────────────────────────
// status: 'available' / 'coming-soon' / 'live'
// players: '2' / '2-4' / '10' וכו'
// emoji זמני — אחר כך נחליף באייקוני SVG מותאמים.
const GAMES = [
  {
    id: 'aroundworld',
    name: 'מסביב לעולם',
    description: 'מטיילים, קונים וזוכים',
    emoji: '🌍',
    players: '2-4 שחקנים',
    color: '#2f73c9',
    status: 'available',
  },
  // ── פעילים — משחקים שבנינו ועובדים ───────────────────────
  {
    id: 'connect4',
    name: '4 בשורה',
    description: 'חברו 4 ברצף ראשונים',
    emoji: '🔴',
    players: '2 שחקנים',
    color: '#B89048', // mustard
    status: 'available',
  },
  {
    id: 'checkers',
    name: 'דמקה',
    description: 'פשוט וכייפי',
    emoji: '⚫',
    players: '2 שחקנים',
    color: '#2C5566', // teal
    status: 'available',
  },
  {
    id: 'sheshbesh',
    name: 'שש-בש',
    description: 'הקלאסי האהוב',
    emoji: '🎲',
    players: '2 שחקנים',
    color: '#6B3A4F', // wine
    status: 'available',
  },
  {
    id: 'chess',
    name: 'שחמט',
    description: 'משחק האסטרטגיה',
    emoji: '♟️',
    players: '2 שחקנים',
    color: '#5e3e22', // עץ אגוז
    status: 'available',
  },
  {
    id: 'trivia',
    name: 'כל הקופה',
    description: 'משחק טריוויה מאתגר',
    emoji: '💰',
    players: 'לבד',
    color: '#2A1438', // אוברגין עמוק — אווירת שעשועון
    status: 'available',
  },
  {
    id: 'rummikub',
    name: 'רמי מלבנים',
    description: 'סדרו רצפים וקבוצות',
    emoji: '🎴',
    players: '2-4 שחקנים',
    color: '#6B4427', // עץ אגוז
    status: 'available',
  },
  {
    id: 'domino',
    name: 'דומינו',
    description: 'התאימו ופרקו ראשונים',
    emoji: '🁫',
    players: '2-4 שחקנים',
    color: '#1f6a45', // ירוק לבד
    status: 'available',
  },
  {
    id: 'arena',
    name: 'מלך הזירה',
    description: 'דו-קרב טריוויה',
    emoji: '👑',
    players: '2-3 שחקנים',
    color: '#4A2A66', // אוברגין מלכותי
    status: 'available',
  },
  // ── בקרוב — משחקים שעוד לא בנינו ─────────────────────────
  {
    id: 'bingo',
    name: 'הבינגו של אמי',
    description: 'משחק קלאסי בקבוצה',
    emoji: '🎱',
    players: 'לבד / עד 10 שחקנים',
    color: '#7E2C2E', // burgundy
    status: 'available',
  },
  {
    id: 'memory',
    name: 'משחק הזיכרון של מילי',
    description: 'מצאו זוגות תואמים',
    emoji: '🃏',
    players: 'לבד',
    color: '#5A1D1E', // burgundy deep
    status: 'available',
  },
]

// מזהי המשחקים שאפשר לשחק עם חבר (רב-משתתפים). memory/trivia הם "לבד" ולכן לא כלולים.
const FRIEND_PLAYABLE = ['connect4', 'checkers', 'sheshbesh', 'rummikub', 'arena', 'bingo', 'chess', 'aroundworld', 'domino']
// משחקים שתומכים ביותר מ-2 שחקנים (אפשר להוסיף עוד חבר)
const MULTI_PLAYER = ['rummikub', 'arena', 'bingo', 'aroundworld', 'domino']

export default function GamesArenaPage({ onBack, onHome, onGoMemory, onGoConnect4, onGoCheckers, onGoSheshbesh, onGoTrivia, onGoRummikub, onGoArena, onGoBingo, onGoChess, onGoAroundWorld, onGoDomino, inviteFriend = null }) {
  const [comingSoon, setComingSoon] = useState(null)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const { authUser, profile } = useUserStore()

  // מחלקים לשתי קבוצות — פעילים למעלה, "בקרוב" למטה
  // במצב "הזמנת חבר" — מציגים רק משחקים שאפשר לשחק עם חבר
  const friendMode = !!inviteFriend
  const availableGames = GAMES
    .filter(g => g.status === 'available' || g.status === 'live')
    .filter(g => !friendMode || FRIEND_PLAYABLE.includes(g.id))
  const comingSoonGames = friendMode ? [] : GAMES.filter(g => g.status === 'coming-soon')

  const handleGameClick = (game) => {
    // משחקים זמינים — ניווט למסך המשחק
    if (game.id === 'memory' && onGoMemory) {
      onGoMemory()
      return
    }
    if (game.id === 'connect4' && onGoConnect4) {
      onGoConnect4()
      return
    }
    if (game.id === 'checkers' && onGoCheckers) {
      onGoCheckers()
      return
    }
    if (game.id === 'sheshbesh' && onGoSheshbesh) {
      onGoSheshbesh()
      return
    }
    if (game.id === 'trivia' && onGoTrivia) {
      onGoTrivia()
      return
    }
    if (game.id === 'rummikub' && onGoRummikub) {
      onGoRummikub()
      return
    }
    if (game.id === 'arena' && onGoArena) {
      onGoArena()
      return
    }
    if (game.id === 'bingo' && onGoBingo) {
      onGoBingo()
      return
    }
    if (game.id === 'chess' && onGoChess) {
      onGoChess()
      return
    }
    if (game.id === 'aroundworld' && onGoAroundWorld) {
      onGoAroundWorld()
      return
    }
    if (game.id === 'domino' && onGoDomino) {
      onGoDomino()
      return
    }
    // משחקים שעדיין לא בנויים — מודל "בקרוב"
    setComingSoon(game.name)
  }

  return (
    <div className="scroll-area rise-in" style={{ direction: 'rtl' }}>
      {/* ── Header ─────────────────────────────────── */}
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">{friendMode ? 'בחרו משחק' : 'זירת המשחקים'}</div>
      </div>

      <div style={{ padding: '8px 20px 32px' }}>
        {/* ── אינטרו ──────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #7E2C2E 0%, #5A1D1E 100%)',
          borderRadius: 20,
          padding: '20px 18px',
          color: '#FBF7EE',
          boxShadow: '0 8px 20px -6px rgba(126,44,46,.4)',
          marginBottom: 22,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', insetInlineEnd: -40, top: -40,
            width: 140, height: 140, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(232,200,121,.25), transparent 70%)',
          }}/>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{friendMode ? '🤝' : '🎮'}</div>
            <div className="h-display" style={{
              fontSize: 24, lineHeight: 1.1, marginBottom: 6, color: '#FBF7EE',
            }}>
              {friendMode ? `משחק עם ${inviteFriend.otherName}` : 'בואו לשחק יחד'}
            </div>
            <div style={{
              fontSize: 14, fontWeight: 600, lineHeight: 1.4,
              color: 'rgba(255,255,255,.92)',
            }}>
              {friendMode
                ? 'בחרו משחק — ונשלח הזמנה ישירות לחבר'
                : 'שחקו עם חברים, הכירו אנשים חדשים, והעבירו זמן בכיף'}
            </div>
          </div>
        </div>

        {/* ── קבוצה 1: המשחקים הפעילים ───────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <h2 className="h-display" style={{
            fontSize: 20, margin: 0, color: 'var(--ink)',
          }}>
            המשחקים שלנו
          </h2>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: 'var(--ink-3)',
          }}>
            {availableGames.length} זמינים
          </span>
        </div>

        {/* רשת המשחקים הפעילים — 2 בכל שורה */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}>
          {availableGames.map(game => (
            <GameCard
              key={game.id}
              game={game}
              onClick={() => handleGameClick(game)}
            />
          ))}
        </div>

        {/* ── קבוצה 2: בקרוב ──────────────────────────── */}
        {comingSoonGames.length > 0 && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: 28, marginBottom: 12,
            }}>
              <h2 className="h-display" style={{
                fontSize: 20, margin: 0, color: 'var(--ink-2)',
              }}>
                בקרוב
              </h2>
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: 'var(--ink-3)',
              }}>
                {comingSoonGames.length} בדרך
              </span>
            </div>

            {/* רשת המשחקים שעוד לא בנויים */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}>
              {comingSoonGames.map(game => (
                <GameCard
                  key={game.id}
                  game={game}
                  onClick={() => handleGameClick(game)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── הצעה — שלחו לנו משחק רעיון ──────────── */}
        <button onClick={() => setSuggestOpen(true)} style={{
          marginTop: 24,
          width: '100%',
          background: 'var(--surface)',
          border: '1px dashed var(--line-strong)',
          borderRadius: 16,
          padding: '18px',
          textAlign: 'center',
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(184,146,74,.14)', display: 'grid', placeItems: 'center' }}>
            <IconLightbulb size={30} />
          </span>
          <span className="h-display" style={{ fontSize: 16, color: 'var(--ink)' }}>
            יש לכם רעיון למשחק?
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
            שלחו לנו הודעה ונשמח להוסיף
          </span>
        </button>
      </div>

      {/* ── מודל "בקרוב" ───────────────────────────── */}
      {comingSoon && (
        <ComingSoonModal name={comingSoon} onClose={() => setComingSoon(null)} />
      )}

      {suggestOpen && (
        <SuggestGameModal
          onClose={() => setSuggestOpen(false)}
          onSubmit={(text) => submitGameSuggestion({ uid: authUser?.uid, name: profile?.name, text })}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// כרטיס משחק יחיד
// ═══════════════════════════════════════════════════════════
function GameCard({ game, onClick }) {
  const isAvailable = game.status === 'available'
  const isLive = game.status === 'live'

  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: '18px 14px 14px',
        boxShadow: 'var(--shadow-sm)',
        minHeight: 170,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'space-between',
        textAlign: 'center',
        cursor: 'pointer',
        fontFamily: 'inherit',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* תג סטטוס (פינה ימנית עליונה) */}
      {isLive && (
        <div style={{
          position: 'absolute', top: 8, insetInlineEnd: 8,
          background: 'var(--burgundy-soft)',
          color: 'var(--burgundy)',
          fontSize: 10, fontWeight: 800,
          padding: '3px 8px', borderRadius: 999,
          display: 'flex', alignItems: 'center', gap: 4,
          letterSpacing: '0.02em',
        }}>
          <span className="live-dot" style={{ width: 5, height: 5 }}/>
          חי
        </div>
      )}
      {!isAvailable && !isLive && (
        <div style={{
          position: 'absolute', top: 8, insetInlineEnd: 8,
          background: 'var(--bg-app)',
          color: 'var(--ink-3)',
          fontSize: 10, fontWeight: 700,
          padding: '3px 8px', borderRadius: 999,
          border: '1px solid var(--line)',
          letterSpacing: '0.02em',
        }}>
          בקרוב
        </div>
      )}

      {/* אייקון בעיגול צבעוני — מצייר את המשחק הספציפי שלו */}
      <div style={{
        width: 64, height: 64, borderRadius: 20,
        background: `linear-gradient(135deg, ${game.color}, ${game.color}DD)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 8,
        boxShadow: `0 6px 14px -4px ${game.color}66`,
      }}>
        <GameIcon id={game.id} size={44} />
      </div>

      {/* שם ותיאור */}
      <div style={{ width: '100%' }}>
        <div className="h-display" style={{
          fontSize: 18, color: 'var(--ink)', lineHeight: 1.1, marginBottom: 4,
        }}>
          {game.name}
        </div>
        <div style={{
          fontSize: 12, color: 'var(--ink-2)', fontWeight: 600,
          lineHeight: 1.3, marginBottom: 6,
        }}>
          {game.description}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--ink-3)', fontWeight: 700,
          letterSpacing: '0.01em',
        }}>
          {game.players}
        </div>
      </div>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════
// מודל "בקרוב"
// ═══════════════════════════════════════════════════════════
function ComingSoonModal({ name, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(20,23,42,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 24,
          padding: '28px 24px 22px',
          maxWidth: 340, width: '100%',
          textAlign: 'center',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ fontSize: 52, marginBottom: 12 }}>🎮</div>
        <div className="h-display" style={{ fontSize: 24, color: 'var(--ink)', marginBottom: 8 }}>
          {name}
        </div>
        <div style={{ fontSize: 16, color: 'var(--ink-2)', marginBottom: 20, lineHeight: 1.4, fontWeight: 500 }}>
          המשחק בבנייה ויהיה זמין בקרוב!
        </div>
        <button onClick={onClose} className="big-btn big-btn--primary" style={{ width: '100%' }}>
          הבנתי
        </button>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// מודל הצעת משחק — המשתמש כותב רעיון, נשמר ל-Firestore (פאנל ניהול)
// ═════════════════════════════════════════════════════════════
function SuggestGameModal({ onClose, onSubmit }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [state, setState] = useState('form') // form | done | error

  const submit = async () => {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    const res = await onSubmit(t)
    setSending(false)
    setState(res && res.ok ? 'done' : 'error')
  }

  return createPortal((
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24, direction: 'rtl' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: '24px 22px', maxWidth: 380, width: '100%', boxShadow: 'var(--shadow-lg)', textAlign: 'center' }}>
        {state === 'done' ? (
          <>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><IconLightbulb size={48} /></div>
            <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>תודה רבה!</div>
            <div style={{ fontSize: 15, color: 'var(--ink-2)', marginBottom: 18, lineHeight: 1.4 }}>קיבלנו את ההצעה שלכם ונשמח לבדוק אותה 🙏</div>
            <button onClick={onClose} className="big-btn big-btn--primary" style={{ width: '100%' }}>סגירה</button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><IconLightbulb size={44} /></div>
            <div className="h-display" style={{ fontSize: 20, color: 'var(--ink)', marginBottom: 6 }}>יש לכם רעיון למשחק?</div>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 14, lineHeight: 1.4 }}>ספרו לנו איזה משחק תרצו שנוסיף ונשמח לשקול!</div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="לדוגמה: דומינו, יאצי, טריוויה על שירים..."
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', fontSize: 15, fontFamily: 'inherit', resize: 'none', direction: 'rtl', marginBottom: 8 }}
            />
            {state === 'error' && <div style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>השליחה נכשלה, נסו שוב.</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={submit} disabled={!text.trim() || sending} className="big-btn big-btn--primary" style={{ flex: 1, opacity: (!text.trim() || sending) ? 0.6 : 1 }}>{sending ? 'שולח...' : 'שליחה'}</button>
              <button onClick={onClose} className="big-btn big-btn--ghost" style={{ flex: 1 }}>ביטול</button>
            </div>
          </>
        )}
      </div>
    </div>
  ), document.body)
}
