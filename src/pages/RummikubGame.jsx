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
import { IconBackRTL, IconHomeLine, IconSpeaker, IconSpeakerOff, IconMusicNote, IconCheck, IconTrophy, IconColor, IconEffects, IconHourglass } from '../icons/index.jsx'
import HomeButton from '../components/HomeButton.jsx'
import { GameIcon } from '../icons/gameIcons.jsx'
import { useUserStore } from '../stores/userStore.js'
import { playSound, isMuted, setMuted, MUSIC_TRACKS } from '../utils/gameSounds.js'
import Avatar from '../components/Avatar.jsx'
import {
  initGame, isValidSet, isBoardValid, sumSetsValue, rackValue,
  drawTile, commitTurn, aiTakeTurn, MELD_MIN,
  sortSetForDisplay, drawOrResolve, finalStandings, sortRack,
} from '../utils/rummikubEngine.js'
import RummikubOnline from './RummikubOnline.jsx'
import LeaveConfirmModal from '../components/LeaveConfirmModal.jsx'

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
export default function RummikubGame({ onBack, onHome, initialRoomId, autoInviteFriend = null, initialMode = null, registerBack }) {
  const [mode, setMode] = useState(initialRoomId ? 'online-friend' : (autoInviteFriend ? 'online-friend' : (initialMode || null)))
  const [difficulty, setDifficulty] = useState('medium')
  const [numPlayers, setNumPlayers] = useState(2)
  const [roomId, setRoomId] = useState(initialRoomId || null)
  // חלון אישור יציאה ממשחק + תת-מסך (הגדרות משחק) רושם צעד-חזרה משלו
  const [confirmLeave, setConfirmLeave] = useState(false)
  const childBackRef = useRef(null)
  const registerChildBack = useRef((fn) => { childBackRef.current = fn }).current
  const handleBackStep = () => {
    if (childBackRef.current && childBackRef.current()) return true
    if (confirmLeave) { setConfirmLeave(false); return true }
    if (mode) { setConfirmLeave(true); return true }
    return false
  }
  useEffect(() => {
    if (!registerBack) return
    registerBack(handleBackStep)
    return () => registerBack(null)
  }, [registerBack, mode, confirmLeave])
  const confirmLeaveNow = () => { setConfirmLeave(false); setRoomId(null); setMode(null) }

  useEffect(() => { if (initialRoomId) { setMode('online-friend'); setRoomId(initialRoomId) } }, [initialRoomId])

  if (!mode) {
    return (
      <ModeSelectScreen
        onBack={onBack}
        onHome={onHome}
        registerBack={registerChildBack}
        onSelectAI={(diff, n) => { setDifficulty(diff); setNumPlayers(n); setMode('ai') }}
        onSelectLocal={(n) => { setNumPlayers(n); setMode('local') }}
        onSelectOnlineRandom={(n) => { setNumPlayers(n); setMode('online-random') }}
        onSelectOnlineFriend={() => setMode('online-friend')}
      />
    )
  }

  if (mode === 'ai' || mode === 'local') {
    return (
      <>
        <LocalGameScreen
          mode={mode} difficulty={difficulty} numPlayers={numPlayers}
          onBack={() => setMode(null)} onHome={onHome} onExit={onBack}
        />
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

  // אונליין — שחקן רנדומלי / שחק עם חברים
  return (
    <>
      <RummikubOnline
        mode={mode}
        numPlayers={numPlayers}
        initialRoomId={roomId}
        autoInviteFriend={autoInviteFriend}
        onBack={autoInviteFriend ? onBack : () => { setMode(null); setRoomId(null) }}
        onHome={onHome}
        onExit={onBack}
      />
      {confirmLeave && (
        <LeaveConfirmModal
          title="לעזוב את המשחק?"
          subtitle="המשחק הנוכחי יסתיים והיריבים יקבלו הודעה"
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
// ראש מסך — מסגרת עץ זהב (תואם שש-בש)
// ════════════════════════════════════════════════════════
function RummiHeader({ title, onBack, onHome, onMenu, menuOpen, menuItems }) {
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
      {onHome && (
        <button onClick={onHome} aria-label="חזרה למסך הבית" style={{ position: 'absolute', insetInlineStart: 50, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <IconHomeLine size={24} color={GOLD} />
        </button>
      )}
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
function ModeSelectScreen({ onBack, onHome, registerBack, onSelectAI, onSelectLocal, onSelectOnlineRandom, onSelectOnlineFriend }) {
  const [step, setStep] = useState('mode')   // 'mode' | 'ai-setup' | 'local-setup'
  const [diff, setDiff] = useState('medium')

  // כפתור החזרה של אנדרואיד — ממסך ההגדרות חוזרים לבחירת המצב (צעד אחד)
  useEffect(() => {
    if (!registerBack) return
    if (step !== 'mode') registerBack(() => { setStep('mode'); return true })
    else registerBack(null)
    return () => registerBack(null)
  }, [registerBack, step])

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">רמיקוב</div>
      </div>

      <div style={{ padding: '8px 20px 32px' }}>
        <div style={{ background: 'linear-gradient(135deg, #6B4427 0%, #4A2E18 100%)', borderRadius: 20, padding: '20px 18px', color: '#FBF7EE', marginBottom: 24, boxShadow: '0 8px 20px -6px rgba(74,46,24,.5)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}><GameIcon id="rummikub" size={52} /></div>
          <div className="h-display" style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 6 }}>רמיקוב</div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'rgba(255,255,255,.92)' }}>סדרו רצפים וקבוצות — והיפטרו מכל האריחים ראשונים</div>
        </div>

        {step === 'mode' && (
          <>
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>בחרו איך לשחק:</h2>
            <ModeButton onClick={() => setStep('random-setup')} iconId="online-random" gradient="linear-gradient(135deg, #7E2C2E, #5A1D1E)" label="שחקן רנדומלי" description="שחקו עם אנשים אחרים באפליקציה" badge="חדש" />
            <ModeButton onClick={onSelectOnlineFriend} iconId="online-friend" gradient="linear-gradient(135deg, #4F6B4A, #354D31)" label="שחק עם חברים" description="הזמינו חברים מהרשימה שלכם" badge="חדש" />
            <ModeButton onClick={() => setStep('ai-setup')} iconId="vs-ai" gradient="linear-gradient(135deg, #2C5566, #173846)" label="נגד המחשב" description="שחקו לבד מול יריבי מחשב" />
            <ModeButton onClick={() => setStep('local-setup')} iconId="local-2p" gradient="linear-gradient(135deg, #B89048, #8A6A2E)" label="כמה שחקנים" description="2-4 שחקנים על אותו מכשיר" />
          </>
        )}

        {step === 'random-setup' && (
          <>
            <BackLink onClick={() => setStep('mode')} />
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 6px', color: 'var(--ink)' }}>עם כמה שחקנים תרצו לשחק?</h2>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 12 }}>נחכה עד שיצטרפו מספיק אנשים, ואז המשחק יתחיל אוטומטית.</div>
            <CountPicker options={[2, 3, 4]} labels={['2 שחקנים', '3 שחקנים', '4 שחקנים']} onPick={(n) => onSelectOnlineRandom(n)} />
          </>
        )}

        {step === 'ai-setup' && (
          <>
            <BackLink onClick={() => setStep('mode')} />
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>רמת קושי:</h2>
            <DifficultyButton label="קל" icon={<RmLeaf size={24} />} color="#4F6B4A" description="המחשב משחק בפשטות" onClick={() => setDiff('easy')} selected={diff === 'easy'} />
            <DifficultyButton label="בינוני" icon={<RmBolt size={24} />} color="#B89048" description="המחשב מחפש מהלכים טובים" onClick={() => setDiff('medium')} selected={diff === 'medium'} />
            <DifficultyButton label="קשה" icon={<RmFlame size={24} />} color="#7E2C2E" description="המחשב משחק חכם" onClick={() => setDiff('hard')} selected={diff === 'hard'} />
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
          <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', background: 'linear-gradient(135deg,#6B4427,#4A2E18)', borderRadius: 10, padding: '5px 9px' }}>
            {Array.from({ length: Math.min(n, 4) }).map((_, k) => <GameIcon key={k} id="rummikub" size={20} />)}
          </span>
        </button>
      ))}
    </div>
  )
}

function ModeButton({ onClick, iconId, gradient, label, description, badge }) {
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '16px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', position: 'relative' }}>
      {badge && <div style={{ position: 'absolute', top: -8, insetInlineStart: 12, background: 'var(--burgundy)', color: 'white', fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconEffects size={11} color="white" /> {badge}</div>}
      <div style={{ width: 52, height: 52, borderRadius: 14, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><GameIcon id={iconId} size={36} /></div>
      <div style={{ flex: 1 }}>
        <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)', lineHeight: 1.15 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginTop: 2 }}>{description}</div>
      </div>
      <IconBackRTL size={20} color="#8389A4" />
    </button>
  )
}

function DifficultyButton({ label, icon, color, description, onClick, selected }) {
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'right', background: selected ? color : 'var(--surface)', border: selected ? `2px solid ${color}` : '1px solid var(--line)', borderRadius: 16, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff' }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div className="h-display" style={{ fontSize: 17, color: selected ? '#fff' : 'var(--ink)', lineHeight: 1.15 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: selected ? 'rgba(255,255,255,.9)' : 'var(--ink-2)', marginTop: 2 }}>{description}</div>
      </div>
      {selected && <IconCheck size={20} color="#fff" />}
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

// איקוני קו מקוריים לרמיקוב (לא אימוג'י) — תואמים לסגנון איקוני האפליקציה
function Li({ size = 18, color = 'currentColor', children, vb = '0 0 24 24' }) {
  return <svg width={size} height={size} viewBox={vb} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>{children}</svg>
}
const RmTileIcon = (p) => (<Li {...p}><rect x="3.5" y="4" width="10" height="16" rx="2" /><path d="M16.5 6.6l3.1.9a1 1 0 0 1 .7 1.2l-3 11a1 1 0 0 1-1.2.7l-1.3-.4" /></Li>)
const RmSortNumIcon = (p) => (<Li {...p}><path d="M4 6h11M4 12h8M4 18h5" /><path d="M18 8V5M16.5 6.5 18 5l1.5 1.5" /></Li>)
const RmNextIcon = (p) => (<Li {...p}><path d="M5 4l9 8-9 8z" fill="currentColor" stroke="none" /><rect x="17" y="4" width="2.6" height="16" rx="1" fill="currentColor" stroke="none" /></Li>)
const RmRefreshIcon = (p) => (<Li {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><polyline points="20 5 20 11 14 11" /></Li>)
const RmUndoIcon = (p) => (<Li {...p}><path d="M9 7 4 12l5 5" /><path d="M4 12h11a5 5 0 0 1 0 10h-1" /></Li>)
const RmLeaf = (p) => (<Li {...p}><path d="M5 19C5 11 11 5 19 5c0 8-6 14-14 14Z" /><path d="M5 19c4-6 8-8 12-9" /></Li>)
const RmBolt = (p) => (<Li {...p}><path d="M13 3 5 13h5l-1 8 8-11h-5l1-7Z" /></Li>)
const RmFlame = (p) => (<Li {...p}><path d="M12 3c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .5 1.5 1.5 2 2.5 2 0-3-1-5 .5-8Z" /></Li>)

function Tile({ tile, size = 'normal', selected, onClick, dim, scale = 1, highlight }) {
  const isBig = size === 'big'
  const baseW = isBig ? 40 : 34, baseH = isBig ? 56 : 48
  const w = Math.round(baseW * scale), h = Math.round(baseH * scale)
  const baseFont = isBig ? 23 : 20
  const fontSize = Math.max(13, Math.round(baseFont * scale))
  const jokerSize = Math.round((isBig ? 30 : 26) * scale)
  const color = tile.joker ? JOKER_COLOR : TILE_COLORS[tile.color]

  return (
    <span
      onClick={onClick}
      style={{
        width: w, height: h, borderRadius: isBig ? 7 : 6, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize, fontWeight: 700, fontFamily: "'Suez One', serif",
        color,
        background: 'linear-gradient(180deg,#fffdf6 0%,#f4ead2 60%,#e3d4b0 100%)',
        boxShadow: selected
          ? `inset 0 1px 0 rgba(255,255,255,.9), 0 0 0 3px ${GOLD}, 0 5px 0 #b09a72, 0 8px 10px rgba(0,0,0,.55)`
          : highlight
          ? `inset 0 1px 0 rgba(255,255,255,.9), 0 0 0 3px ${GOLD}, 0 0 10px 3px rgba(232,200,121,.85), 0 4px 0 #b09a72, 0 6px 8px rgba(0,0,0,.5)`
          : 'inset 0 1px 0 rgba(255,255,255,.9), inset 0 -3px 4px rgba(150,120,70,.35), inset -2px 0 3px rgba(150,120,70,.2), 0 4px 0 #b09a72, 0 6px 8px rgba(0,0,0,.5)',
        textShadow: '0 1px 0 rgba(255,255,255,.5)',
        cursor: onClick ? 'pointer' : 'default',
        opacity: dim ? 0.4 : 1,
        transform: selected ? 'translateY(-6px)' : 'none',
        transition: 'transform .12s, box-shadow .12s, width .15s, height .15s, font-size .15s',
        userSelect: 'none',
      }}
    >
      {tile.joker ? <JokerFace size={jokerSize} /> : tile.num}
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
function LocalGameScreen({ mode, difficulty, numPlayers, onBack, onHome, onExit }) {
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

  // מוזיקת רקע (אותם קבצים כמו בשאר המשחקים)
  const musicRef = useRef(null)
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem('beyahad_rummikub_music') !== '0' } catch { return true } })
  const [trackIdx, setTrackIdx] = useState(() => Math.floor(Math.random() * MUSIC_TRACKS.length))
  const [musicVol, setMusicVol] = useState(0.10)
  const nextTrack = () => setTrackIdx(i => (i + 1) % MUSIC_TRACKS.length)
  const toggleMusic = () => setMusicOn(o => { const nv = !o; try { localStorage.setItem('beyahad_rummikub_music', nv ? '1' : '0') } catch {} return nv })
  const volBtnStyle = { width: 36, height: 36, borderRadius: 9, border: `1px solid ${GOLD_DEEP}`, background: 'linear-gradient(180deg,#5e3f22,#3a2410)', color: GOLD, fontSize: 20, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }
  useEffect(() => {
    const a = musicRef.current; if (!a) return
    if (musicOn) { a.volume = musicVol; const p = a.play(); if (p && p.catch) p.catch(() => {}) }
    else a.pause()
  }, [musicOn, trackIdx])
  useEffect(() => { const a = musicRef.current; if (a) a.volume = musicVol }, [musicVol])
  useEffect(() => {
    if (!musicOn) return
    const kick = () => { const a = musicRef.current; if (a && a.paused) { a.volume = musicVol; const p = a.play(); if (p && p.catch) p.catch(() => {}) } }
    window.addEventListener('pointerdown', kick); window.addEventListener('touchstart', kick)
    return () => { window.removeEventListener('pointerdown', kick); window.removeEventListener('touchstart', kick) }
  }, [musicOn, musicVol])

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
    // סט חדש נוסף בראש הלוח (unshift) כדי שיהיה תמיד גלוי למעלה בלי לגלול
    if (setIndex === 'new') nb.unshift([fromRack])
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
      {!isAITurn && !winner && <MenuItem label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><RmUndoIcon size={16} color={CREAM} /> אפס מהלך</span>} onClick={() => { handleResetDraft(); setMenuOpen(false) }} />}
      <MenuItem label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><RmRefreshIcon size={16} color={CREAM} /> משחק חדש</span>} onClick={restart} />
      <MenuItem label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{muted ? <IconSpeakerOff size={16} color={CREAM} /> : <IconSpeaker size={16} color={CREAM} />} {muted ? 'הפעל סאונד' : 'השתק סאונד'}</span>} onClick={toggleMute} />
      <MenuItem label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><RmUndoIcon size={16} color={CREAM} /> החלף מצב</span>} onClick={() => { setMenuOpen(false); onBack() }} />
    </>
  )

  const statusText = winner
    ? (winner.isAI ? `${winner.name} ניצח` : (mode === 'ai' ? 'ניצחת!' : `${winner.name} ניצח!`))
    : isAITurn ? `${player.name} חושב…`
    : (mode === 'ai' ? 'תורך' : `תור ${player.name}`)

  return (
    <div style={{ direction: 'rtl', background: 'linear-gradient(180deg,#2c1d10,#1c1108)', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <RummiHeader title="רמיקוב" onBack={onBack} onHome={onHome} onMenu={() => setMenuOpen(o => !o)} menuOpen={menuOpen} menuItems={menuItems} />
      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />}
      <audio ref={musicRef} src={MUSIC_TRACKS[trackIdx]} onEnded={nextTrack} onPlay={(e) => { e.currentTarget.volume = musicVol }} style={{ display: 'none' }} />

      {/* פס שחקנים — תמיד שורה אחת, מתחלקת שווה לפי מספר השחקנים */}
      <div style={{ display: 'flex', gap: 5, padding: '8px 8px 0', flexShrink: 0 }}>
        {state.players.map((p, i) => (
          <OpponentChip key={p.id} player={p} active={i === turnIdx && !winner} photoURL={p.id === 'you' ? profile?.photoURL : null} compact={state.players.length >= 4} />
        ))}
      </div>

      {/* שורה מאוחדת: השולחן (ימין) · תורך/סטטוס (אמצע) · קופה (שמאל) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px 4px', flexShrink: 0, gap: 8 }}>
        <span style={{ fontSize: 13, color: GOLD_DEEP, fontWeight: 700, flexShrink: 0 }}>השולחן</span>
        <span style={{ fontFamily: "'Suez One', serif", fontSize: 15, fontWeight: 800, color: message ? '#ffb3a0' : GOLD, textAlign: 'center', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {message || statusText}
        </span>
        <PoolCounter count={state.pool.length} />
      </div>

      {/* השולחן — גמיש, תופס את המרחב שנותר וגולל בפנים אם צריך */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 12px' }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <BoardArea
            board={draftBoard}
            onSetClick={placeOnSet}
            onTileClick={returnTileToRack}
            selectedTileId={selectedTileId}
            lastDrawnId={lastDrawn && lastDrawn.forIdx === turnIdx ? lastDrawn.tile.id : null}
            placing={selectedTileId != null && draftRack.some(t => t.id === selectedTileId)}
          />
        </div>
      </div>

      {/* אזור תחתון קבוע — היד והכפתורים תמיד גלויים */}
      <div style={{ flexShrink: 0, padding: '6px 12px 14px', borderTop: '1px solid rgba(201,162,74,.15)' }}>
        {!isAITurn && !winner && (
          <PlayerRack rack={draftRack} selectedTileId={selectedTileId} onTileClick={selectTile} onSort={handleSortRack} newTileId={lastDrawn && lastDrawn.forIdx === turnIdx ? lastDrawn.tile.id : null} controls={
            <>
              <RummiMusicButton musicOn={musicOn} onToggle={toggleMusic} onNext={nextTrack} onVolDown={() => setMusicVol(v => Math.max(0.02, +(v - 0.03).toFixed(2)))} onVolUp={() => { setMusicVol(v => Math.min(0.6, +(v + 0.03).toFixed(2))); setMusicOn(true) }} />
              <button onClick={() => { const n = !muted; setMutedState(n); setMuted(n) }} aria-label="סאונד" style={{ ...iconCtrlBtn, display: 'inline-flex', alignItems: 'center' }}>{muted ? <IconSpeakerOff size={18} color="#e6cd90" /> : <IconSpeaker size={18} color="#e6cd90" />}</button>
            </>
          } />
        )}
        {isAITurn && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px', color: CREAM, fontSize: 15 }}><IconHourglass size={18} color={GOLD} /> {player.name} משחק…</div>
        )}

        {!isAITurn && !winner && !player.hasMelded && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: CREAM, marginTop: 8, opacity: .85 }}>
            <IconEffects size={15} color={GOLD} /> לירידה ראשונה צריך להניח לפחות {MELD_MIN} נקודות
          </div>
        )}

        {!isAITurn && !winner && (
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <RummiButton ghost label={<span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><RmTileIcon size={18} color="#e6cd90" /> שלוף</span>} onClick={handleDraw} />
            <RummiButton gold label={<span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><IconCheck size={18} color="#3a2a08" /> סיים תור</span>} onClick={handleEndTurn} />
          </div>
        )}
      </div>

      {winner && (
        <EndModal
          mode={mode}
          state={state}
          winnerName={winner.name}
          youWon={mode === 'ai' && state.winner === 0}
          onPlayAgain={restart}
          onExit={onExit}
        />
      )}
    </div>
  )
}

function OpponentChip({ player, active, photoURL, compact }) {
  // 4 שחקנים → פריסה אנכית צרה (פרצוף מעל שם); 2-3 → מלבן אופקי רחב יותר.
  // בשני המקרים flex:1 + minWidth:0 — כך השורה לעולם לא בורחת.
  const avatarSize = compact ? 22 : 26
  return (
    <div style={{
      flex: 1, minWidth: 0,
      display: 'flex', flexDirection: compact ? 'column' : 'row',
      alignItems: 'center', justifyContent: 'center', gap: compact ? 1 : 7,
      background: active ? 'linear-gradient(180deg,#6e4a28,#4a2e16)' : 'rgba(74,48,22,.6)',
      border: active ? `1.5px solid ${GOLD}` : '1px solid rgba(201,162,74,.35)',
      borderRadius: 9, padding: compact ? '3px 4px' : '5px 8px',
      boxShadow: active ? '0 0 10px rgba(232,200,121,.35)' : 'none',
    }}>
      {player.isAI ? (
        <div style={{
          width: avatarSize, height: avatarSize, borderRadius: '50%', flexShrink: 0,
          background: '#f4ead2', border: '1px solid #cbb98e',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <JokerFace size={Math.round(avatarSize * 0.68)} />
        </div>
      ) : (
        <Avatar name={player.name} size={avatarSize} photoURL={photoURL} />
      )}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: compact ? 'center' : 'flex-start' }}>
        <div style={{ fontFamily: "'Suez One', serif", fontSize: 11, color: CREAM, lineHeight: 1.1, maxWidth: compact ? 56 : 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</div>
        <div style={{ fontSize: 10, color: active ? GOLD : GOLD_DEEP, fontWeight: 800, lineHeight: 1.1 }}>{player.rack.length}{compact ? '' : ' אריחים'}</div>
      </div>
    </div>
  )
}

// מונה האריחים שנותרו בקופה (כמה אפשר עוד לשלוף) — קומפקטי לשורה המאוחדת
function PoolCounter({ count }) {
  const low = count <= 5
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
      background: 'rgba(0,0,0,.25)', border: `1px solid ${low ? '#e0746a' : 'rgba(201,162,74,.4)'}`,
      borderRadius: 999, padding: '3px 10px',
    }}>
      <RmTileIcon size={14} color={GOLD} />
      <span style={{ fontSize: 11, fontWeight: 700, color: CREAM }}>בקופה:</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: low ? '#ffb3a0' : GOLD, fontFamily: "'Suez One', serif" }}>{count}</span>
    </div>
  )
}

function BoardArea({ board, onSetClick, onTileClick, selectedTileId, placing, lastDrawnId }) {
  // התכווצות אוטומטית — ככל שהלוח מתמלא, הקלפים מתכווצים
  // כדי שייכנסו בלי לגלול. מתחיל גדול (כמו תמיד) וקטן במדרגות.
  const tileCount = board.reduce((sum, set) => sum + set.length, 0)
  let scale = 1
  if (tileCount > 52) scale = 0.58
  else if (tileCount > 42) scale = 0.65
  else if (tileCount > 32) scale = 0.74
  else if (tileCount > 22) scale = 0.84
  else if (tileCount > 14) scale = 0.92

  const gap = Math.round(12 * scale)
  const setGap = Math.max(2, Math.round(4 * scale))
  const setPad = Math.max(3, Math.round(6 * scale))
  const boardPad = scale < 0.85 ? 8 : 14

  return (
    <div style={{
      background: WOOD_DEEP, borderRadius: 14, padding: boardPad, minHeight: 150,
      borderTop: `2px solid #d8b878`, borderInline: '2px solid #8a5e2e', borderBottom: '4px solid #2a1808',
      boxShadow: 'inset 0 2px 10px rgba(0,0,0,.6), inset 0 -3px 8px rgba(0,0,0,.5), 0 8px 20px -6px rgba(0,0,0,.7)',
      display: 'flex', flexWrap: 'wrap', gap, alignContent: 'flex-start',
      transition: 'gap .15s, padding .15s',
    }}>
      {board.length === 0 && (
        <div style={{ width: '100%', textAlign: 'center', color: 'rgba(243,226,190,.5)', fontSize: 14, padding: '40px 0' }}>
          השולחן ריק — הניחו את הסט הראשון
        </div>
      )}
      {/* כפתור "סט חדש" — בראש הלוח, כך תמיד גלוי למעלה בלי לגלול */}
      {placing && (
        <div onClick={() => onSetClick('new')} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 60, minHeight: 54, padding: 6, borderRadius: 8,
          border: '2px dashed rgba(232,200,121,.6)', color: GOLD,
          cursor: 'pointer', fontSize: 13, fontWeight: 700,
        }}>+ סט חדש</div>
      )}
      {board.map((set, i) => {
        const valid = isValidSet(set)
        const ordered = sortSetForDisplay(set)
        return (
          <div key={i} onClick={() => placing && onSetClick(i)} style={{
            display: 'flex', flexWrap: 'wrap', gap: setGap, padding: setPad, borderRadius: 8,
            direction: 'ltr',
            background: 'rgba(0,0,0,.18)',
            border: valid ? '1px solid rgba(232,200,121,.25)' : '2px solid #e0746a',
            cursor: placing ? 'pointer' : 'default',
            maxWidth: '100%',
            transition: 'gap .15s, padding .15s',
          }}>
            {ordered.map(tile => (
              <Tile key={tile.id} tile={tile} scale={scale} highlight={lastDrawnId === tile.id} onClick={() => onTileClick(i, tile.id)} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function PlayerRack({ rack, selectedTileId, onTileClick, onSort, newTileId, controls }) {
  return (
    <div>
      {onSort && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <button onClick={() => onSort('number')} style={{ ...rackSortBtn, display: 'inline-flex', alignItems: 'center', gap: 6 }}><RmSortNumIcon size={16} color="#e6cd90" /> סדר לפי מספר</button>
          <button onClick={() => onSort('color')} style={{ ...rackSortBtn, display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconColor size={16} color="#e6cd90" /> סדר לפי צבע</button>
          {controls}
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
          <Tile key={tile.id} tile={tile} size="big" selected={selectedTileId === tile.id} highlight={newTileId === tile.id} onClick={() => onTileClick(tile.id)} />
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

const iconCtrlBtn = {
  background: 'linear-gradient(180deg,#5e3f22,#3a2410)', color: '#e6cd90',
  border: 'none', borderTop: '1px solid #a07d3e', borderBottom: '3px solid #1c1008',
  borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 800,
  fontFamily: 'inherit', cursor: 'pointer', lineHeight: 1,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12), 0 2px 5px rgba(0,0,0,.4)',
}
const popItem = { display: 'block', width: '100%', textAlign: 'right', background: 'none', border: 'none', color: CREAM, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }
const popVolBtn = { width: 34, height: 34, borderRadius: 8, border: `1px solid ${GOLD_DEEP}`, background: 'linear-gradient(180deg,#5e3f22,#3a2410)', color: GOLD, fontSize: 18, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }

// כפתור מוזיקה עם תפריט קטן (הפעלה/כיבוי · שיר הבא · עוצמה)
function RummiMusicButton({ musicOn, onToggle, onNext, onVolDown, onVolUp }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'flex' }}>
      <button onClick={() => setOpen(o => !o)} aria-label="מוזיקה" style={{ ...iconCtrlBtn, display: 'inline-flex', alignItems: 'center', opacity: musicOn ? 1 : 0.55 }}><IconMusicNote size={18} color="#e6cd90" /></button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />
          <div style={{ position: 'absolute', bottom: '120%', insetInlineEnd: 0, background: '#2a1a0c', border: `1px solid ${GOLD_DEEP}`, borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 60, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
            <button onClick={onToggle} style={{ ...popItem, display: 'flex', alignItems: 'center', gap: 8 }}><IconMusicNote size={16} color={CREAM} /> {musicOn ? 'כבה מוזיקה' : 'הפעל מוזיקה'}</button>
            <button onClick={onNext} style={{ ...popItem, display: 'flex', alignItems: 'center', gap: 8 }}><RmNextIcon size={16} color={CREAM} /> שיר הבא</button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '2px 6px' }}>
              <span style={{ color: CREAM, fontSize: 14, fontWeight: 700 }}>עוצמה</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={onVolDown} style={popVolBtn} aria-label="החלש">−</button>
                <button onClick={onVolUp} style={popVolBtn} aria-label="הגבר">+</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
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
  const label = tile.joker ? 'ג׳וקר' : `${tile.num}`
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
  const aiRobot = !youWon && mode === 'ai'
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
        {aiRobot ? (
          <div style={{
            width: 88, height: 88, borderRadius: '50%', margin: '0 auto 12px',
            background: 'linear-gradient(135deg, #2C5566, #173846)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><GameIcon id="vs-ai" size={60} /></div>
        ) : (
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><IconTrophy size={64} color="#B89048" /></div>
        )}
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
                  <span style={{ fontSize: 15, minWidth: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{row.isWinner ? <IconTrophy size={17} color="#7E2C2E" /> : (i + 1)}</span>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{row.name}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#7E2C2E', fontFamily: "'Suez One', serif" }}>{row.points}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onPlayAgain} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><RmRefreshIcon size={18} /> שחק שוב</button>
        <button onClick={onExit} className="big-btn big-btn--ghost" style={{ width: '100%' }}>חזרה לזירה</button>
      </div>
    </div>
  )
}

export { Tile, TileBack, TILE_COLORS, JOKER_COLOR, GOLD, GOLD_DEEP, CREAM, WOOD_DEEP, WOOD_RACK }
