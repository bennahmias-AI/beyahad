// src/pages/RummikubGame.jsx
// ─────────────────────────────────────────────────────────────
// משחק "רמיקוב" — 2-4 שחקנים, נגד המחשב או אונליין.
//
// העיצוב: עץ אגוז יוקרתי + אריחי שנהב תלת-ממדיים (תואם שש-בש/דמקה).
// המנוע (חוקים, AI, סנכרון): ../utils/rummikubEngine.js
//
// מבנה: מסך בחירת מצב → משחק מקומי / אונליין (lobby + game).
// בשלב זה ממומש המשחק המקומי המלא; האונליין מתחבר על אותה תשתית.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { IconBackRTL } from '../icons/index.jsx'
import { GameIcon } from '../icons/gameIcons.jsx'
import { useUserStore } from '../stores/userStore.js'
import { playSound, isMuted, setMuted } from '../utils/gameSounds.js'
import Avatar from '../components/Avatar.jsx'
import LandscapeStage from '../components/LandscapeStage.jsx'
import {
  initGame, isValidSet, isBoardValid, sumSetsValue, rackValue,
  drawTile, commitTurn, aiTakeTurn, MELD_MIN,
  sortSetForDisplay, drawOrResolve, finalStandings, sortRack,
} from '../utils/rummikubEngine.js'
import RummikubOnline from './RummikubOnline.jsx'
import { RummiGameLayout, PoolCounter } from './RummikubShared.jsx'

// ── פלטת צבעים (תואמת לדמו שאושר) ──────────────────────
const WOOD_DEEP   = 'linear-gradient(155deg,#5c3c22 0%,#43290f 55%,#321d0b 100%)'
const WOOD_RACK   = 'linear-gradient(155deg,#7a5230 0%,#4d3017 100%)'
const GOLD        = '#E8C879'
const GOLD_DEEP   = '#C9A24A'
const CREAM       = '#F3E2BE'
const TILE_COLORS = { red: '#c0392b', blue: '#1c5fa8', orange: '#d4820e', green: '#1f7a44' }
const JOKER_COLOR = '#b8332f'

// ════════════════════════════════════════════════════════
// קומפוננטה ראשית — ניתוב בין מצבים
// ════════════════════════════════════════════════════════
export default function RummikubGame({ onBack, initialRoomId }) {
  const [mode, setMode] = useState(initialRoomId ? 'online-friend' : null)
  const [difficulty, setDifficulty] = useState('medium')
  const [numPlayers, setNumPlayers] = useState(2)
  const [roomId, setRoomId] = useState(initialRoomId || null)

  useEffect(() => { if (initialRoomId) { setMode('online-friend'); setRoomId(initialRoomId) } }, [initialRoomId])

  if (!mode) {
    return (
      <ModeSelectScreen
        onBack={onBack}
        onSelectAI={(diff, n) => { setDifficulty(diff); setNumPlayers(n); setMode('ai') }}
        onSelectLocal={(n) => { setNumPlayers(n); setMode('local') }}
        onSelectOnlineRandom={() => setMode('online-random')}
        onSelectOnlineFriend={() => setMode('online-friend')}
      />
    )
  }

  if (mode === 'ai' || mode === 'local') {
    return (
      <LocalGameScreen
        mode={mode} difficulty={difficulty} numPlayers={numPlayers}
        onBack={() => setMode(null)} onExit={onBack}
      />
    )
  }

  // אונליין — שחקן רנדומלי / שחק עם חברים
  return (
    <RummikubOnline
      mode={mode}
      initialRoomId={roomId}
      onBack={() => { setMode(null); setRoomId(null) }}
      onExit={onBack}
    />
  )
}

// ════════════════════════════════════════════════════════
// ראש מסך — מסגרת עץ זהב (תואם שש-בש)
// ════════════════════════════════════════════════════════
function RummiHeader({ title, onBack, onMenu, menuOpen, menuItems }) {
  return (
    <div style={{
      background: 'repeating-linear-gradient(91deg, rgba(0,0,0,.05) 0 1px, transparent 1px 5px), linear-gradient(155deg,#71492a 0%,#4d3017 55%,#3a2410 100%)',
      borderBottom: `2px solid ${GOLD_DEEP}`, padding: '14px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      boxShadow: '0 4px 12px rgba(0,0,0,.4)',
    }}>
      <button onClick={onBack} aria-label="חזרה" style={{ position: 'absolute', insetInlineStart: 14, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
        <IconBackRTL size={24} color={GOLD} />
      </button>
      <div style={{ fontFamily: "'Suez One', serif", fontSize: 22, fontWeight: 700, color: GOLD, textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>{title}</div>
      {onMenu && (
        <button onClick={onMenu} aria-label="תפריט" style={{ position: 'absolute', insetInlineEnd: 14, background: 'none', border: 'none', cursor: 'pointer', color: GOLD, padding: 4, fontSize: 24 }}>☰</button>
      )}
      {menuOpen && menuItems && (
        <div style={{ position: 'absolute', top: '100%', insetInlineEnd: 10, marginTop: 6, background: '#2a1a0c', border: `1px solid ${GOLD_DEEP}`, borderRadius: 12, padding: 6, zIndex: 50, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
          {menuItems}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מסך בחירת מצב
// ════════════════════════════════════════════════════════
function ModeSelectScreen({ onBack, onSelectAI, onSelectLocal, onSelectOnlineRandom, onSelectOnlineFriend }) {
  const [step, setStep] = useState('mode')   // 'mode' | 'ai-setup' | 'local-setup'
  const [diff, setDiff] = useState('medium')

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <div className="screen-header__title">רמיקוב</div>
      </div>

      <div style={{ padding: '8px 20px 32px' }}>
        <div style={{ background: 'linear-gradient(135deg, #6B4427 0%, #4A2E18 100%)', borderRadius: 20, padding: '20px 18px', color: '#FBF7EE', marginBottom: 24, boxShadow: '0 8px 20px -6px rgba(74,46,24,.5)', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🎴</div>
          <div className="h-display" style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 6 }}>רמיקוב</div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'rgba(255,255,255,.92)' }}>סדרו רצפים וקבוצות — והיפטרו מכל האריחים ראשונים</div>
        </div>

        {step === 'mode' && (
          <>
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>בחרו איך לשחק:</h2>
            <ModeButton onClick={onSelectOnlineRandom} iconId="online-random" gradient="linear-gradient(135deg, #7E2C2E, #5A1D1E)" label="שחקן רנדומלי" description="שחקו עם אנשים אחרים באפליקציה" badge="חדש" />
            <ModeButton onClick={onSelectOnlineFriend} iconId="online-friend" gradient="linear-gradient(135deg, #4F6B4A, #354D31)" label="שחק עם חברים" description="הזמינו חברים מהרשימה שלכם" badge="חדש" />
            <ModeButton onClick={() => setStep('ai-setup')} iconId="vs-ai" gradient="linear-gradient(135deg, #2C5566, #173846)" label="נגד המחשב" description="שחקו לבד מול יריבי מחשב" />
            <ModeButton onClick={() => setStep('local-setup')} iconId="local-2p" gradient="linear-gradient(135deg, #B89048, #8A6A2E)" label="כמה שחקנים" description="2-4 שחקנים על אותו מכשיר" />
          </>
        )}

        {step === 'ai-setup' && (
          <>
            <BackLink onClick={() => setStep('mode')} />
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>רמת קושי:</h2>
            <DifficultyButton label="קל" emoji="🌱" color="#4F6B4A" description="המחשב משחק בפשטות" onClick={() => setDiff('easy')} selected={diff === 'easy'} />
            <DifficultyButton label="בינוני" emoji="⚡" color="#B89048" description="המחשב מחפש מהלכים טובים" onClick={() => setDiff('medium')} selected={diff === 'medium'} />
            <DifficultyButton label="קשה" emoji="🔥" color="#7E2C2E" description="המחשב משחק חכם" onClick={() => setDiff('hard')} selected={diff === 'hard'} />
            <h2 className="h-display" style={{ fontSize: 18, margin: '20px 0 12px', color: 'var(--ink)' }}>כמה יריבי מחשב?</h2>
            <CountPicker options={[1, 2, 3]} labels={['יריב אחד', '2 יריבים', '3 יריבים']} onPick={(n) => onSelectAI(diff, n + 1)} />
          </>
        )}

        {step === 'local-setup' && (
          <>
            <BackLink onClick={() => setStep('mode')} />
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>כמה שחקנים על המכשיר?</h2>
            <CountPicker options={[2, 3, 4]} labels={['2 שחקנים', '3 שחקנים', '4 שחקנים']} onPick={(n) => onSelectLocal(n)} />
          </>
        )}
      </div>
    </div>
  )
}

function BackLink({ onClick }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ink-2)', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
      <IconBackRTL size={18} color="#8389A4" /> חזרה
    </button>
  )
}

function CountPicker({ options, labels, onPick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {options.map((n, i) => (
        <button key={n} onClick={() => onPick(n)} style={{
          width: '100%', textAlign: 'right', background: 'var(--surface)',
          border: '1px solid var(--line)', borderRadius: 16, padding: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
        }}>
          <span className="h-display" style={{ fontSize: 18, color: 'var(--ink)' }}>{labels[i]}</span>
          <span style={{ fontSize: 22 }}>{'🎴'.repeat(Math.min(n, 4))}</span>
        </button>
      ))}
    </div>
  )
}

function ModeButton({ onClick, iconId, gradient, label, description, badge }) {
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '16px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', position: 'relative' }}>
      {badge && <div style={{ position: 'absolute', top: -8, insetInlineStart: 12, background: 'var(--burgundy)', color: 'white', fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 999 }}>✨ {badge}</div>}
      <div style={{ width: 52, height: 52, borderRadius: 14, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><GameIcon id={iconId} size={36} /></div>
      <div style={{ flex: 1 }}>
        <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)', lineHeight: 1.15 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginTop: 2 }}>{description}</div>
      </div>
      <IconBackRTL size={20} color="#8389A4" />
    </button>
  )
}

function DifficultyButton({ label, emoji, color, description, onClick, selected }) {
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'right', background: selected ? color : 'var(--surface)', border: selected ? `2px solid ${color}` : '1px solid var(--line)', borderRadius: 16, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: selected ? 'rgba(255,255,255,.25)' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{emoji}</div>
      <div style={{ flex: 1 }}>
        <div className="h-display" style={{ fontSize: 17, color: selected ? '#fff' : 'var(--ink)', lineHeight: 1.15 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: selected ? 'rgba(255,255,255,.9)' : 'var(--ink-2)', marginTop: 2 }}>{description}</div>
      </div>
      {selected && <span style={{ color: '#fff', fontSize: 20 }}>✓</span>}
    </button>
  )
}

// ════════════════════════════════════════════════════════
// אריח תלת-ממדי — אבן הבניין הויזואלית
// ════════════════════════════════════════════════════════
// סמיילי קורץ — צורת הג'וקר (ציור מקורי, ללא זכויות יוצרים)
function JokerFace({ size = 24, color = JOKER_COLOR }) {
  const sw = size >= 24 ? 3 : 2.6
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block' }} aria-hidden="true">
      <circle cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth={sw} />
      <circle cx="23" cy="27" r="3.6" fill={color} />
      <path d="M38 26 Q42 27 46 26" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <path d="M21 40 Q32 51 43 40" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  )
}

function Tile({ tile, size = 'normal', selected, onClick, dim }) {
  const isBig = size === 'big'
  const w = isBig ? 40 : 34, h = isBig ? 56 : 48
  const color = tile.joker ? JOKER_COLOR : TILE_COLORS[tile.color]

  return (
    <span
      onClick={onClick}
      style={{
        width: w, height: h, borderRadius: isBig ? 7 : 6, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isBig ? 23 : 20, fontWeight: 700, fontFamily: "'Suez One', serif",
        color,
        background: 'linear-gradient(180deg,#fffdf6 0%,#f4ead2 60%,#e3d4b0 100%)',
        boxShadow: selected
          ? `inset 0 1px 0 rgba(255,255,255,.9), 0 0 0 3px ${GOLD}, 0 5px 0 #b09a72, 0 8px 10px rgba(0,0,0,.55)`
          : 'inset 0 1px 0 rgba(255,255,255,.9), inset 0 -3px 4px rgba(150,120,70,.35), inset -2px 0 3px rgba(150,120,70,.2), 0 4px 0 #b09a72, 0 6px 8px rgba(0,0,0,.5)',
        textShadow: '0 1px 0 rgba(255,255,255,.5)',
        cursor: onClick ? 'pointer' : 'default',
        opacity: dim ? 0.4 : 1,
        transform: selected ? 'translateY(-6px)' : 'none',
        transition: 'transform .12s, box-shadow .12s',
        userSelect: 'none',
      }}
    >
      {tile.joker ? <JokerFace size={isBig ? 30 : 26} /> : tile.num}
    </span>
  )
}

// אריח אחורי (גב) — להצגת יד של יריב
function TileBack({ size = 'normal' }) {
  const isBig = size === 'big'
  const w = isBig ? 40 : 26, h = isBig ? 56 : 38
  return (
    <span style={{
      width: w, height: h, borderRadius: 5, flexShrink: 0, display: 'inline-block',
      background: 'repeating-linear-gradient(45deg,#6b3a2a 0 4px,#5a3022 4px 8px)',
      border: '1px solid #2a1808',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.15), 0 2px 4px rgba(0,0,0,.4)',
    }} />
  )
}

// ════════════════════════════════════════════════════════
// מסך משחק מקומי (נגד מחשב / כמה שחקנים על מכשיר)
// ════════════════════════════════════════════════════════
function LocalGameScreen({ mode, difficulty, numPlayers, onBack, onExit }) {
  const { profile } = useUserStore()

  const playerDefs = (() => {
    if (mode === 'ai') {
      const defs = [{ id: 'you', name: profile?.name || 'אתה', isAI: false }]
      for (let i = 1; i < numPlayers; i++) defs.push({ id: `ai${i}`, name: `מחשב ${i}`, isAI: true })
      return defs
    }
    const defs = []
    for (let i = 0; i < numPlayers; i++) defs.push({ id: `p${i}`, name: `שחקן ${i + 1}`, isAI: false })
    return defs
  })()

  const [state, setState] = useState(() => initGame(playerDefs))
  const [draftBoard, setDraftBoard] = useState(state.board)
  const [draftRack, setDraftRack] = useState(state.players[0].rack)
  const [selectedTileId, setSelectedTileId] = useState(null)
  const [message, setMessage] = useState('')
  const [lastDrawn, setLastDrawn] = useState(null)  // האריח האחרון שהשחקן האנושי שלף
  const [muted, setMutedState] = useState(() => isMuted())
  const [menuOpen, setMenuOpen] = useState(false)

  const turnIdx = state.turn
  const player = state.players[turnIdx]
  const isAITurn = player.isAI && state.phase === 'play'
  const winner = state.phase === 'ended' ? state.players[state.winner] : null

  useEffect(() => {
    setDraftBoard(state.board)
    setDraftRack(state.players[turnIdx].rack)
    setSelectedTileId(null)
    setMessage('')
  }, [turnIdx, state.board, state.phase])

  useEffect(() => {
    if (!isAITurn || winner) return
    const t = setTimeout(() => {
      const result = aiTakeTurn(state, turnIdx)
      if (result) {
        playSound('drop')
        setState(commitTurn(state, turnIdx, result.board, result.rack, result.didMeld))
      } else {
        // ה-AI שולף — או מסיים אם הקופה ריקה
        playSound('drop')
        const { state: ns } = drawOrResolve(state)
        setState(ns)
      }
    }, 1100)
    return () => clearTimeout(t)
  }, [isAITurn, state, turnIdx, winner])

  const toggleMute = () => { const n = !muted; setMutedState(n); setMuted(n); setMenuOpen(false) }

  const boardOk = isBoardValid(draftBoard)
  const playedFromRack = draftRack.length < state.players[turnIdx].rack.length

  const selectTile = (tileId) => {
    if (isAITurn || winner) return
    playSound('tap')
    setSelectedTileId(prev => prev === tileId ? null : tileId)
  }

  const placeOnSet = (setIndex) => {
    if (selectedTileId == null || isAITurn) return
    const fromRack = draftRack.find(t => t.id === selectedTileId)
    if (!fromRack) { setSelectedTileId(null); return }
    const nb = draftBoard.map(s => [...s])
    if (setIndex === 'new') nb.push([fromRack])
    else nb[setIndex] = [...nb[setIndex], fromRack]
    setDraftBoard(nb)
    setDraftRack(draftRack.filter(t => t.id !== selectedTileId))
    setSelectedTileId(null)
    setLastDrawn(null)
    playSound('drop')
  }

  const returnTileToRack = (setIndex, tileId) => {
    if (isAITurn) return
    const original = state.players[turnIdx].rack
    if (!original.find(t => t.id === tileId)) {
      setMessage('אפשר להחזיר רק אריחים שהנחת בתור הזה')
      return
    }
    const nb = draftBoard.map(s => [...s])
    const tile = nb[setIndex].find(t => t.id === tileId)
    nb[setIndex] = nb[setIndex].filter(t => t.id !== tileId)
    const cleaned = nb.filter(s => s.length > 0)
    setDraftBoard(cleaned)
    setDraftRack([...draftRack, tile])
    playSound('tap')
  }

  const handleEndTurn = () => {
    if (isAITurn || winner) return
    if (!playedFromRack) { setMessage('לא הנחת אריחים — שלוף אריח מהקופה'); return }
    if (!boardOk) { setMessage('יש סט לא חוקי על השולחן — תקן לפני סיום'); return }
    const originalIds = new Set(state.board.flat().map(t => t.id))
    const newlyPlaced = []
    for (const set of draftBoard) {
      const fresh = set.filter(t => !originalIds.has(t.id))
      if (fresh.length) newlyPlaced.push(...fresh)
    }
    if (!player.hasMelded) {
      const freshValue = newlyPlaced.reduce((sum, t) => sum + (t.joker ? 0 : t.num), 0)
      if (freshValue < MELD_MIN) {
        setMessage(`לפריצה ראשונה צריך לפחות ${MELD_MIN} נקודות (הנחת ${freshValue})`)
        return
      }
    }
    playSound('drop')
    setState(commitTurn(state, turnIdx, draftBoard, draftRack, true))
    setLastDrawn(null)
  }

  const handleDraw = () => {
    if (isAITurn || winner) return
    // מזהים איזה אריח עומד להישלף (הראשון בקופה) כדי להציג לשחקן
    const drawn = state.pool.length > 0 ? state.pool[0] : null
    playSound('drop')
    // שליפה חכמה: אם הקופה ריקה — המשחק נגמר ומוכרע לפי נקודות
    const { state: ns, ended } = drawOrResolve(state)
    setState(ns)
    if (drawn && !ended) setLastDrawn({ tile: drawn, forIdx: turnIdx })
  }

  const handleResetDraft = () => {
    setDraftBoard(state.board)
    setDraftRack(state.players[turnIdx].rack)
    setSelectedTileId(null)
    setMessage('')
    playSound('tap')
  }

  // מיון היד — לפי מספר או לפי צבע (רק הטיוטה המקומית, לא משנה את המשחק)
  const handleSortRack = (mode) => {
    setDraftRack(prev => sortRack(prev, mode))
    playSound('tap')
  }

  const restart = () => { setState(initGame(playerDefs)); setMenuOpen(false) }

  const menuItems = (
    <>
      <MenuItem label="🔄 משחק חדש" onClick={restart} />
      <MenuItem label={muted ? '🔇 הפעל סאונד' : '🔊 השתק סאונד'} onClick={toggleMute} />
      <MenuItem label="↩ החלף מצב" onClick={() => { setMenuOpen(false); onBack() }} />
    </>
  )

  const statusText = winner
    ? (winner.isAI ? `${winner.name} ניצח` : (mode === 'ai' ? 'ניצחת! 🎉' : `${winner.name} ניצח! 🎉`))
    : isAITurn ? `${player.name} חושב…`
    : (mode === 'ai' ? 'תורך' : `תור ${player.name}`)

  // חלקי המשחק כמשתנים — כך אפשר לסדר אותם אחרת לאורך ולרוחב
  const playersStrip = state.players.map((p, i) => (
    <OpponentChip key={p.id} player={p} active={i === turnIdx && !winner} photoURL={p.id === 'you' ? profile?.photoURL : null} />
  ))
  const boardEl = (
    <BoardArea
      board={draftBoard}
      onSetClick={placeOnSet}
      onTileClick={returnTileToRack}
      selectedTileId={selectedTileId}
      placing={selectedTileId != null && draftRack.some(t => t.id === selectedTileId)}
    />
  )
  const statusEl = (
    <div style={{ textAlign: 'center', minHeight: 22, margin: '6px 0', fontFamily: "'Suez One', serif", fontSize: 17, fontWeight: 800, color: message ? '#ffb3a0' : GOLD }}>
      {message || statusText}
    </div>
  )
  const aiThinkingEl = isAITurn ? (
    <div style={{ textAlign: 'center', padding: '20px', color: CREAM, fontSize: 15 }}>{player.name} משחק… 🤔</div>
  ) : null
  const meldHintEl = (!isAITurn && !winner && !player.hasMelded) ? (
    <div style={{ textAlign: 'center', fontSize: 13, color: CREAM, marginTop: 8, opacity: .85 }}>
      💡 לירידה ראשונה צריך להניח לפחות {MELD_MIN} נקודות
    </div>
  ) : null

  const gameModals = winner ? (
    <EndModal
      mode={mode}
      state={state}
      winnerName={winner.name}
      youWon={mode === 'ai' && state.winner === 0}
      onPlayAgain={restart}
      onExit={onExit}
    />
  ) : null

  const header = (
    <>
      <RummiHeader title="רמיקוב" onBack={onBack} onMenu={() => setMenuOpen(o => !o)} menuOpen={menuOpen} menuItems={menuItems} />
      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />}
    </>
  )

  return (
    <LandscapeStage>
      <RummiGameLayout
        header={header}
        players={playersStrip}
        poolCount={state.pool.length}
        board={boardEl}
        status={statusEl}
        aiThinking={aiThinkingEl}
        meldHint={meldHintEl}
        rack={(!isAITurn && !winner) ? (
          <PlayerRack rack={draftRack} selectedTileId={selectedTileId} onTileClick={selectTile} />
        ) : null}
        newTile={(!isAITurn && !winner && lastDrawn && lastDrawn.forIdx === turnIdx) ? (
          <NewTileBanner tile={lastDrawn.tile} />
        ) : null}
        showActions={!isAITurn && !winner}
        onReset={handleResetDraft}
        onDraw={handleDraw}
        onEndTurn={handleEndTurn}
        onSort={handleSortRack}
        modals={gameModals}
      />
    </LandscapeStage>
  )
}

// ═════════════════════════════════════════════════════════
// (פריסת המשחק RummiGameLayout + PoolCounter עברו ל-RummikubShared.jsx
//  כדי שישמשו גם את המשחק המקומי וגם את האונליין)
// ═════════════════════════════════════════════════════════

function OpponentChip({ player, active, photoURL }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: active ? 'linear-gradient(180deg,#6e4a28,#4a2e16)' : 'rgba(74,48,22,.6)',
      border: active ? `2px solid ${GOLD}` : '1px solid rgba(201,162,74,.35)',
      borderRadius: 12, padding: '7px 12px',
      boxShadow: active ? '0 0 12px rgba(232,200,121,.35)' : 'none',
    }}>
      {player.isAI ? (
        <div style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: '#f4ead2', border: '1.5px solid #cbb98e',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <JokerFace size={24} />
        </div>
      ) : (
        <Avatar name={player.name} size={34} photoURL={photoURL} />
      )}
      <div>
        <div style={{ fontFamily: "'Suez One', serif", fontSize: 14, color: CREAM, lineHeight: 1.1 }}>{player.name}</div>
        <div style={{ fontSize: 11, color: GOLD_DEEP, fontWeight: 700 }}>{player.rack.length} אריחים</div>
      </div>
      {active && <span style={{ fontSize: 11, color: GOLD, fontWeight: 800 }}>● תור</span>}
    </div>
  )
}

// מונה האריחים שנותרו בקופה — עבר ל-RummikubShared.jsx

function BoardArea({ board, onSetClick, onTileClick, selectedTileId, placing }) {
  return (
    <div style={{
      background: WOOD_DEEP, borderRadius: 14, padding: 14, minHeight: 150,
      borderTop: `2px solid #d8b878`, borderInline: '2px solid #8a5e2e', borderBottom: '4px solid #2a1808',
      boxShadow: 'inset 0 2px 10px rgba(0,0,0,.6), inset 0 -3px 8px rgba(0,0,0,.5), 0 8px 20px -6px rgba(0,0,0,.7)',
      display: 'flex', flexWrap: 'wrap', gap: 12, alignContent: 'flex-start',
    }}>
      {board.length === 0 && (
        <div style={{ width: '100%', textAlign: 'center', color: 'rgba(243,226,190,.5)', fontSize: 14, padding: '40px 0' }}>
          השולחן ריק — הניחו את הסט הראשון
        </div>
      )}
      {board.map((set, i) => {
        const valid = isValidSet(set)
        const ordered = sortSetForDisplay(set)
        return (
          <div key={i} onClick={() => placing && onSetClick(i)} style={{
            display: 'flex', flexWrap: 'wrap', gap: 4, padding: 6, borderRadius: 8,
            direction: 'ltr',
            background: 'rgba(0,0,0,.18)',
            border: valid ? '1px solid rgba(232,200,121,.25)' : '2px solid #e0746a',
            cursor: placing ? 'pointer' : 'default',
            maxWidth: '100%',
          }}>
            {ordered.map(tile => (
              <Tile key={tile.id} tile={tile} onClick={() => onTileClick(i, tile.id)} />
            ))}
          </div>
        )
      })}
      {placing && (
        <div onClick={() => onSetClick('new')} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 60, minHeight: 54, padding: 6, borderRadius: 8,
          border: '2px dashed rgba(232,200,121,.6)', color: GOLD,
          cursor: 'pointer', fontSize: 13, fontWeight: 700,
        }}>+ סט חדש</div>
      )}
    </div>
  )
}

function PlayerRack({ rack, selectedTileId, onTileClick, onSort }) {
  return (
    <div>
      {onSort && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
          <button onClick={() => onSort('number')} style={rackSortBtn}>🔢 סדר לפי מספר</button>
          <button onClick={() => onSort('color')} style={rackSortBtn}>🎨 סדר לפי צבע</button>
        </div>
      )}
      <div style={{
        background: WOOD_RACK, borderRadius: 14, padding: '16px 12px 14px',
        borderTop: '2px solid #e0bd82', borderInline: '2px solid #8a5e2e', borderBottom: '6px solid #2a1808',
        boxShadow: 'inset 0 3px 8px rgba(0,0,0,.45), 0 6px 16px -4px rgba(0,0,0,.6)',
        display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center',
        direction: 'ltr',
      }}>
        {rack.map(tile => (
          <Tile key={tile.id} tile={tile} size="big" selected={selectedTileId === tile.id} onClick={() => onTileClick(tile.id)} />
        ))}
      </div>
    </div>
  )
}

const rackSortBtn = {
  background: 'linear-gradient(180deg,#5e3f22,#3a2410)', color: '#e6cd90',
  border: 'none', borderTop: '1px solid #a07d3e', borderBottom: '3px solid #1c1008',
  borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 800,
  fontFamily: 'inherit', cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12), 0 2px 5px rgba(0,0,0,.4)',
}

function RummiButton({ label, onClick, gold, ghost }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, borderRadius: 13, padding: '13px 8px', fontSize: 14, fontWeight: 800,
      fontFamily: 'inherit', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
      ...(gold ? {
        background: 'linear-gradient(180deg,#f2ce6a,#c9a24a)', color: '#3a2a08',
        borderTop: '1.5px solid #fce9b6', borderBottom: '4px solid #8a6a2e',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.6), 0 4px 10px rgba(201,162,74,.45)',
      } : {
        background: 'linear-gradient(180deg,#5e3f22,#3a2410)', color: '#e6cd90',
        borderTop: '1.5px solid #a07d3e', borderBottom: '4px solid #1c1008',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.15), 0 4px 8px rgba(0,0,0,.5)',
      }),
    }}>{label}</button>
  )
}

function MenuItem({ label, onClick }) {
  return <button onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'right', background: 'none', border: 'none', color: CREAM, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', padding: '11px 12px', borderRadius: 8, cursor: 'pointer' }}>{label}</button>
}

// הודעה המציגה את האריח החדש שהשחקן שלף בתור הקודם
function NewTileBanner({ tile }) {
  const label = tile.joker ? 'ג׳וקר 😉' : `${tile.num}`
  const colorName = tile.joker ? '' : ({ red: 'אדום', blue: 'כחול', orange: 'כתום', green: 'ירוק' }[tile.color] || '')
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      marginTop: 12, padding: '10px 14px',
      background: 'linear-gradient(180deg, rgba(232,200,121,.22), rgba(201,162,74,.12))',
      border: `1px solid ${GOLD_DEEP}`, borderRadius: 12,
    }}>
      <span style={{ fontSize: 14, fontWeight: 800, color: CREAM }}>האריח החדש שקיבלת:</span>
      <Tile tile={tile} />
      <span style={{ fontSize: 14, fontWeight: 800, color: GOLD }}>
        {colorName ? `${label} ${colorName}` : label}
      </span>
    </div>
  )
}

function EndModal({ mode, state, winnerName, youWon, onPlayAgain, onExit }) {
  const emoji = youWon ? '🎉' : (mode === 'ai' ? '🤖' : '🎉')
  const title = youWon ? 'ניצחת!' : `${winnerName} ניצח!`
  // אם המשחק הוכרע כי הקופה נגמרה — מציגים טבלת נקודות
  const standings = state ? finalStandings(state) : null
  const poolEnded = state && (!state.pool || state.pool.length === 0)
  const subtitle = youWon
    ? 'כל הכבוד — נפטרת מכל האריחים!'
    : (poolEnded ? 'הקופה נגמרה — המנצח הוא מי שנשארו לו הכי פחות נקודות' : 'משחק יפה — נסו שוב')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,8,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24, direction: 'rtl' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: '30px 26px 22px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>{emoji}</div>
        <div className="h-display" style={{ fontSize: 28, color: youWon ? '#4F6B4A' : '#B89048', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 16, color: 'var(--ink-2)', marginBottom: 18, fontWeight: 600, lineHeight: 1.4 }}>{subtitle}</div>

        {/* טבלת נקודות — רק כשהמשחק הוכרע לפי נקודות (קופה נגמרה) */}
        {poolEnded && standings && (
          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px', marginBottom: 18, textAlign: 'right' }}>
            <div className="h-display" style={{ fontSize: 15, color: 'var(--ink)', textAlign: 'center', marginBottom: 10 }}>טבלת נקודות (פחות = טוב)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {standings.map((row, i) => (
                <div key={row.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10,
                  background: row.isWinner ? 'rgba(79,107,74,.15)' : 'var(--surface)',
                  border: row.isWinner ? '1px solid #4F6B4A' : '1px solid var(--line)',
                }}>
                  <span style={{ fontSize: 15, minWidth: 24, textAlign: 'center' }}>{row.isWinner ? '🏆' : (i + 1)}</span>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{row.name}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#7E2C2E', fontFamily: "'Suez One', serif" }}>{row.points}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onPlayAgain} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 10 }}>🔄 שחק שוב</button>
        <button onClick={onExit} className="big-btn big-btn--ghost" style={{ width: '100%' }}>חזרה לזירה</button>
      </div>
    </div>
  )
}

export { Tile, TileBack, TILE_COLORS, JOKER_COLOR, GOLD, GOLD_DEEP, CREAM, WOOD_DEEP, WOOD_RACK }
