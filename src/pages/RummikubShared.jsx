// src/pages/RummikubShared.jsx
// ─────────────────────────────────────────────────────────────
// רכיבים ויזואליים משותפים לרמיקוב — בשימוש גם במשחק המקומי
// (RummikubGame.jsx) וגם באונליין (RummikubOnline.jsx).
//
// כאן מרוכזים: פלטת הצבעים, האריח התלת-ממדי, אזור השולחן, מדף
// האריחים, הכפתור, ראש המסך, וה-banner של "האריח החדש".
// כך שני המסכים נראים זהים לחלוטין ואין כפילות קוד.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { IconBackRTL, IconHomeLine } from '../icons/index.jsx'
import { isValidSet, sortSetForDisplay, sortRack } from '../utils/rummikubEngine.js'

// ── פלטת צבעים (תואמת לדמו שאושר) ──────────────────────
export const WOOD_DEEP   = 'linear-gradient(155deg,#5c3c22 0%,#43290f 55%,#321d0b 100%)'
export const WOOD_RACK   = 'linear-gradient(155deg,#7a5230 0%,#4d3017 100%)'
export const GOLD        = '#E8C879'
export const GOLD_DEEP   = '#C9A24A'
export const CREAM       = '#F3E2BE'
export const TILE_COLORS = { red: '#c0392b', blue: '#1c5fa8', orange: '#d4820e', green: '#1f7a44' }
export const JOKER_COLOR = '#b8332f'

// עטיפת סיבוב לרוחב: כשהמכשיר אנכי מסובבים 90° כך שהמשחק מוצג לרוחב.
export function LandscapeRotate({ children, bg = '#1c1108' }) {
  const [isPortrait, setIsPortrait] = useState(() => { try { return window.matchMedia('(orientation: portrait)').matches } catch { return false } })
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const fn = (e) => setIsPortrait(e.matches)
    mq.addEventListener('change', fn)
    try { const so = window.screen && window.screen.orientation; if (so && so.lock) so.lock('landscape').catch(() => {}) } catch {}
    return () => { mq.removeEventListener('change', fn); try { const so = window.screen && window.screen.orientation; if (so && so.unlock) so.unlock() } catch {} }
  }, [])
  if (!isPortrait) return <>{children}</>
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: bg, zIndex: 1 }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: '100vh', height: '100vw', transform: 'translate(-50%,-50%) rotate(90deg)', transformOrigin: 'center', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// אריח תלת-ממדי — אבן הבניין הויזואלית
// ════════════════════════════════════════════════════════
// סמיילי קורץ — צורת הג'וקר (ציור מקורי, ללא זכויות יוצרים)
export function JokerFace({ size = 24, color = JOKER_COLOR }) {
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

export function Tile({ tile, size = 'normal', selected, onClick, dim, scale = 1, highlight }) {
  const isBig = size === 'big'
  // גדל בסיסי, מוכפל ב-scale (רק אריחי הלוח מתכווצים; היד תמיד scale=1)
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
export function TileBack({ size = 'normal' }) {
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
// ראש מסך — מסגרת עץ זהב (תואם שש-בש)
// ════════════════════════════════════════════════════════
export function RummiHeaderShared({ title, onBack, onHome, onMenu, menuOpen, menuItems }) {
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
// אזור השולחן (הסטים המונחים)
// ════════════════════════════════════════════════════════
export function BoardArea({ board, onSetClick, onTileClick, placing, lastDrawnId }) {
  // התכווצות אוטומטית — ככל שהלוח מתמלא, הקלפים מתכווצים
  // כדי שייכנסו בלי לגלול. מתחיל גדול (כמו תמיד) וקטן במדרגות.
  const tileCount = board.reduce((sum, set) => sum + set.length, 0)
  let scale = 1
  if (tileCount > 52) scale = 0.58
  else if (tileCount > 42) scale = 0.65
  else if (tileCount > 32) scale = 0.74
  else if (tileCount > 22) scale = 0.84
  else if (tileCount > 14) scale = 0.92
  // עד 14 אריחים — גודל מלא (scale=1)

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
        // מסדרים את הסט לתצוגה (רצף — לפי מספר; קבוצה — כרגיל)
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

// ════════════════════════════════════════════════════════
// מדף האריחים של השחקן
// ════════════════════════════════════════════════════════
export function PlayerRack({ rack, selectedTileId, onTileClick, onSort, newTileId }) {
  return (
    <div>
      {onSort && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
          <button onClick={() => onSort('number')} style={sortBtnStyle}>🔢 סדר לפי מספר</button>
          <button onClick={() => onSort('color')} style={sortBtnStyle}>🎨 סדר לפי צבע</button>
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

const sortBtnStyle = {
  background: 'linear-gradient(180deg,#5e3f22,#3a2410)', color: '#e6cd90',
  border: 'none', borderTop: '1px solid #a07d3e', borderBottom: '3px solid #1c1008',
  borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 800,
  fontFamily: 'inherit', cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12), 0 2px 5px rgba(0,0,0,.4)',
}

// ════════════════════════════════════════════════════════
// כפתור בסגנון המשחק
// ════════════════════════════════════════════════════════
export function RummiButton({ label, onClick, gold, ghost }) {
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

// ════════════════════════════════════════════════════════
// banner — האריח החדש שהשחקן שלף בתור הקודם
// ════════════════════════════════════════════════════════
export function NewTileBanner({ tile }) {
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

// מונה האריחים שנותרו בקופה — קומפקטי לשורה המאוחדת
export function PoolCounter({ count }) {
  const low = count <= 5
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
      background: 'rgba(0,0,0,.25)', border: `1px solid ${low ? '#e0746a' : 'rgba(201,162,74,.4)'}`,
      borderRadius: 999, padding: '3px 10px',
    }}>
      <span style={{ fontSize: 12 }}>🎴</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: CREAM }}>בקופה:</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: low ? '#ffb3a0' : GOLD, fontFamily: "'Suez One', serif" }}>{count}</span>
    </div>
  )
}
