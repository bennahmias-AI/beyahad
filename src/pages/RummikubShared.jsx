// src/pages/RummikubShared.jsx
// ─────────────────────────────────────────────────────────────
// רכיבים ויזואליים משותפים לרמיקוב — בשימוש גם במשחק המקומי
// (RummikubGame.jsx) וגם באונליין (RummikubOnline.jsx).
//
// כאן מרוכזים: פלטת הצבעים, האריח התלת-ממדי, אזור השולחן, מדף
// האריחים, הכפתור, ראש המסך, וה-banner של "האריח החדש".
// כך שני המסכים נראים זהים לחלוטין ואין כפילות קוד.
// ─────────────────────────────────────────────────────────────
import { IconBackRTL } from '../icons/index.jsx'
import { isValidSet } from '../utils/rummikubEngine.js'

// ── פלטת צבעים (תואמת לדמו שאושר) ──────────────────────
export const WOOD_DEEP   = 'linear-gradient(155deg,#5c3c22 0%,#43290f 55%,#321d0b 100%)'
export const WOOD_RACK   = 'linear-gradient(155deg,#7a5230 0%,#4d3017 100%)'
export const GOLD        = '#E8C879'
export const GOLD_DEEP   = '#C9A24A'
export const CREAM       = '#F3E2BE'
export const TILE_COLORS = { red: '#c0392b', blue: '#1c5fa8', orange: '#d4820e', green: '#1f7a44' }
export const JOKER_COLOR = '#b8332f'

// ════════════════════════════════════════════════════════
// אריח תלת-ממדי — אבן הבניין הויזואלית
// ════════════════════════════════════════════════════════
export function Tile({ tile, size = 'normal', selected, onClick, dim }) {
  const isBig = size === 'big'
  const w = isBig ? 40 : 34, h = isBig ? 56 : 48
  const color = tile.joker ? JOKER_COLOR : TILE_COLORS[tile.color]
  const label = tile.joker ? 'J' : tile.num

  return (
    <span
      onClick={onClick}
      style={{
        width: w, height: h, borderRadius: isBig ? 7 : 6, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isBig ? 23 : 20, fontWeight: 700, fontFamily: "'Suez One', serif",
        color, fontStyle: tile.joker ? 'italic' : 'normal',
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
      {label}
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
export function RummiHeaderShared({ title, onBack, onMenu, menuOpen, menuItems }) {
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
// אזור השולחן (הסטים המונחים)
// ════════════════════════════════════════════════════════
export function BoardArea({ board, onSetClick, onTileClick, placing }) {
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
        return (
          <div key={i} onClick={() => placing && onSetClick(i)} style={{
            display: 'flex', gap: 4, padding: 6, borderRadius: 8,
            background: 'rgba(0,0,0,.18)',
            border: valid ? '1px solid rgba(232,200,121,.25)' : '2px solid #e0746a',
            cursor: placing ? 'pointer' : 'default',
          }}>
            {set.map(tile => (
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

// ════════════════════════════════════════════════════════
// מדף האריחים של השחקן
// ════════════════════════════════════════════════════════
export function PlayerRack({ rack, selectedTileId, onTileClick }) {
  return (
    <div style={{
      background: WOOD_RACK, borderRadius: 14, padding: '16px 12px 14px',
      borderTop: '2px solid #e0bd82', borderInline: '2px solid #8a5e2e', borderBottom: '6px solid #2a1808',
      boxShadow: 'inset 0 3px 8px rgba(0,0,0,.45), 0 6px 16px -4px rgba(0,0,0,.6)',
      display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center',
    }}>
      {rack.map(tile => (
        <Tile key={tile.id} tile={tile} size="big" selected={selectedTileId === tile.id} onClick={() => onTileClick(tile.id)} />
      ))}
    </div>
  )
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
  const label = tile.joker ? 'גוקר (J)' : `${tile.num}`
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
