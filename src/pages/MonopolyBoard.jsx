/*
  MonopolyBoard.jsx
  Visual board for the vintage Israeli Monopoly. Renders all 39 tiles on a
  1600x1600 logical stage, auto-scales to its container, and supports a
  cinematic "camera": pass focusTiles=[ids] to zoom into that region,
  focusTiles=null to fit the whole board.

  Props:
    focusTiles : array of tile ids to zoom to, or null (fit all)
    tokens     : [{ uid, color, tileId }] player tokens
    owners     : { [tileId]: uid }  (tints owned tiles with the owner color ring)
    hotels     : { [tileId]: true }
    tokenColors: { [uid]: '#hex' }
    onTileClick: (tile) => void   (optional)
*/

import { useEffect, useRef, useState } from 'react';
import { TILES, GROUPS, BOARD_COLORS } from '../data/monopolyBoard';
import { flagSVG } from '../data/monopolyFlags';

const B = 1600;            // stage size
const CORNER = 212;        // corner square
const SPAN = B - 2 * CORNER; // 1176
const TOP_W = SPAN / 9;    // 9 tiles on top edge
const BOT_W = SPAN / 10;   // 10 tiles on bottom edge
const SIDE_H = SPAN / 8;   // 8 tiles on each side

// ---- geometry: play-order id -> {x,y,w,h,edge} --------------------------
function tileGeom(id) {
  if (id === 0)  return { x: 0,          y: B - CORNER, w: CORNER, h: CORNER, edge: 'corner' };
  if (id <= 8)   return { x: 0,          y: CORNER + (8 - id) * SIDE_H, w: CORNER, h: SIDE_H, edge: 'left' };
  if (id === 9)  return { x: 0,          y: 0,          w: CORNER, h: CORNER, edge: 'corner' };
  if (id <= 18)  return { x: CORNER + (id - 10) * TOP_W, y: 0, w: TOP_W, h: CORNER, edge: 'top' };
  if (id === 19) return { x: B - CORNER, y: 0,          w: CORNER, h: CORNER, edge: 'corner' };
  if (id <= 27)  return { x: B - CORNER, y: CORNER + (id - 20) * SIDE_H, w: CORNER, h: SIDE_H, edge: 'right' };
  if (id === 28) return { x: B - CORNER, y: B - CORNER, w: CORNER, h: CORNER, edge: 'corner' };
  return { x: CORNER + SPAN - (id - 28) * BOT_W, y: B - CORNER, w: BOT_W, h: CORNER, edge: 'bottom' };
}

export const TILE_GEOMS = TILES.map((t) => ({ ...tileGeom(t.id), id: t.id }));

export function tileCenter(id) {
  const g = TILE_GEOMS[id];
  return { cx: g.x + g.w / 2, cy: g.y + g.h / 2 };
}

// ---- tile renderers ------------------------------------------------------
const ink = BOARD_COLORS.ink;
const cream = BOARD_COLORS.cream;

function PropTile({ tile, geom, owner, ownerColor, hotel }) {
  const grp = GROUPS[tile.group];
  const vertical = geom.edge === 'top' || geom.edge === 'bottom';
  return (
    <div style={{
      width: '100%', height: '100%', background: cream, position: 'relative',
      display: 'flex', flexDirection: vertical ? 'column' : 'row',
      alignItems: 'stretch', textAlign: 'center', overflow: 'hidden',
    }}>
      <div style={{
        background: grp.color, flex: 'none',
        height: vertical ? 14 : '100%', width: vertical ? '100%' : 14,
        borderBottom: vertical ? `2px solid ${ink}` : 'none',
        borderInlineEnd: vertical ? 'none' : `2px solid ${ink}`,
      }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 6, minWidth: 0 }}>
        <div style={{ width: vertical ? 84 : 96, height: vertical ? 56 : 64, flex: 'none', filter: 'drop-shadow(0 1px 0 rgba(0,0,0,.12))' }}
          dangerouslySetInnerHTML={{ __html: flagSVG(tile.flag) }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 26, lineHeight: 1.02, color: ink }}>{tile.name}</div>
          <div style={{ fontWeight: 700, fontSize: 22, fontFamily: 'Rubik, Heebo, sans-serif', color: ink, marginTop: 2 }}>{tile.price}</div>
        </div>
      </div>
      {owner && (
        <div style={{ position: 'absolute', inset: 4, border: `5px solid ${ownerColor}`, borderRadius: 6, pointerEvents: 'none' }} />
      )}
      {hotel && (
        <div style={{ position: 'absolute', top: vertical ? 18 : 4, insetInlineEnd: 4, background: BOARD_COLORS.red, color: '#fff', fontSize: 18, fontWeight: 800, borderRadius: 6, padding: '2px 8px', border: `2px solid ${ink}` }}>
          מלון
        </div>
      )}
    </div>
  );
}

function SpecialTile({ tile }) {
  return (
    <div style={{ width: '100%', height: '100%', background: cream, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8, position: 'relative', textAlign: 'center' }}>
      <div style={{ position: 'absolute', inset: 6, border: `3px solid ${BOARD_COLORS.gold}`, borderRadius: 6, opacity: 0.55, pointerEvents: 'none' }} />
      <div style={{ fontWeight: 800, fontSize: 21, lineHeight: 1.05, color: ink }}>{tile.name}</div>
      <div style={{ fontWeight: 700, fontSize: 17, color: '#222' }}>{tile.sub}</div>
    </div>
  );
}

function LottoTile() {
  return (
    <div style={{ width: '100%', height: '100%', background: cream, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: BOARD_COLORS.yellow, border: `3px solid ${ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22, color: ink }}>
        לוטו
      </div>
    </div>
  );
}

function ChanceTile() {
  return (
    <div style={{ width: '100%', height: '100%', background: cream, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <div style={{ fontFamily: 'Rubik, Heebo, sans-serif', fontWeight: 900, fontSize: 52, color: ink }}>?</div>
      <div style={{ fontWeight: 800, fontSize: 19, color: ink }}>צ׳אנס</div>
    </div>
  );
}

const CORNER_BG = { start: '#bfe0ef', einKnisa: '#f3d9d2', atzor: '#f3d9d2', odPaam: BOARD_COLORS.yellow };

function CornerTile({ tile }) {
  if (tile.key === 'start') {
    return (
      <div style={{ width: '100%', height: '100%', background: CORNER_BG.start }}>
        <svg viewBox="0 0 200 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <g stroke={ink} strokeWidth="3.4">
            <circle cx="38" cy="38" r="26" fill="#f4c20d" />
            <circle cx="162" cy="38" r="26" fill="#2f9e3f" />
            <circle cx="38" cy="162" r="26" fill="#2f73c9" />
            <circle cx="162" cy="162" r="26" fill="#e8761f" />
          </g>
          <text x="100" y="76" textAnchor="middle" fontFamily="Heebo, sans-serif" fontWeight="900" fontSize="29" fill={ink}>התחלה</text>
          <path d="M100 180 V94 M74 118 L100 92 L126 118" fill="none" stroke={ink} strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: '100%', background: CORNER_BG[tile.key] || cream, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, textAlign: 'center' }}>
      <div style={{ fontWeight: 900, fontSize: 30, lineHeight: 1.04, color: ink }}>{tile.name}</div>
      <div style={{ fontWeight: 700, fontSize: 18, maxWidth: 180, color: ink }}>{tile.sub}</div>
    </div>
  );
}

function TileView({ tile, geom, owners, hotels, tokenColors, onTileClick }) {
  const owner = owners?.[tile.id];
  let inner = null;
  if (tile.type === 'prop') inner = <PropTile tile={tile} geom={geom} owner={owner} ownerColor={tokenColors?.[owner]} hotel={hotels?.[tile.id]} />;
  else if (tile.type === 'special') inner = <SpecialTile tile={tile} />;
  else if (tile.type === 'lotto') inner = <LottoTile />;
  else if (tile.type === 'chance') inner = <ChanceTile />;
  else inner = <CornerTile tile={tile} />;
  return (
    <div
      onClick={onTileClick ? () => onTileClick(tile) : undefined}
      style={{
        position: 'absolute', left: geom.x, top: geom.y, width: geom.w, height: geom.h,
        border: `2px solid ${ink}`, boxSizing: 'border-box', cursor: onTileClick ? 'pointer' : 'default',
      }}>
      {inner}
    </div>
  );
}

// ---- center artwork (simplified from the original) -----------------------
function CenterArt() {
  return (
    <div style={{ position: 'absolute', left: CORNER, top: CORNER, width: SPAN, height: SPAN, background: BOARD_COLORS.blue, border: `4px solid ${ink}`, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: '50%', top: '52%', transform: 'translate(-50%,-50%)', width: 760, height: 760, borderRadius: '50%', background: cream, border: `6px solid ${BOARD_COLORS.red}`, boxShadow: '0 0 0 10px rgba(0,0,0,.06) inset' }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 220, height: 220, borderRadius: '50%', background: BOARD_COLORS.blue, border: `5px solid ${BOARD_COLORS.gold}`, boxShadow: '0 0 0 3px #1c1c1c' }} />
      </div>
      <div style={{ position: 'absolute', right: 30, top: 28, background: BOARD_COLORS.red, color: '#fff', border: `4px solid ${ink}`, boxShadow: '5px 5px 0 rgba(0,0,0,.18)', padding: '10px 22px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Rubik, Heebo, sans-serif', fontWeight: 900, fontSize: 52, lineHeight: 0.95, letterSpacing: 1 }}>מונופול</div>
        <div style={{ fontWeight: 800, fontSize: 24 }}>מסביב לעולם</div>
      </div>
    </div>
  );
}

// ---- tokens ---------------------------------------------------------------
const TOKEN_OFFSETS = [ [-34, -34], [34, -34], [-34, 34], [34, 34] ];

function Tokens({ tokens }) {
  return tokens.map((tk, i) => {
    const { cx, cy } = tileCenter(tk.tileId);
    const [dx, dy] = TOKEN_OFFSETS[i % 4];
    return (
      <div key={tk.uid} style={{
        position: 'absolute', left: cx + dx - 28, top: cy + dy - 28, width: 56, height: 56,
        borderRadius: '50%', background: tk.color, border: `4px solid ${ink}`,
        boxShadow: '0 4px 10px rgba(0,0,0,.35)', zIndex: 5,
        transition: 'left .42s ease, top .42s ease',
      }} />
    );
  });
}

// ---- camera math ----------------------------------------------------------
function cameraTransform(focusTiles, cw, ch) {
  let bx = 0, by = 0, bw = B, bh = B;
  if (focusTiles && focusTiles.length) {
    const gs = focusTiles.map((id) => TILE_GEOMS[id]);
    const x1 = Math.min(...gs.map((g) => g.x));
    const y1 = Math.min(...gs.map((g) => g.y));
    const x2 = Math.max(...gs.map((g) => g.x + g.w));
    const y2 = Math.max(...gs.map((g) => g.y + g.h));
    const pad = 70;
    bx = x1 - pad; by = y1 - pad; bw = x2 - x1 + pad * 2; bh = y2 - y1 + pad * 2;
  }
  const s = Math.min(cw / bw, ch / bh);
  const tx = (cw - s * bw) / 2 - s * bx;
  const ty = (ch - s * bh) / 2 - s * by;
  return `translate(${tx}px, ${ty}px) scale(${s})`;
}

// ---- main component --------------------------------------------------------
export default function MonopolyBoard({ focusTiles = null, tokens = [], owners = {}, hotels = {}, tokenColors = {}, onTileClick }) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const transform = size.w ? cameraTransform(focusTiles, size.w, size.h) : 'scale(0)';

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, width: B, height: B,
        transformOrigin: '0 0', transform,
        transition: 'transform .8s cubic-bezier(.4,.1,.2,1)',
        background: cream, border: `3px solid ${ink}`, boxSizing: 'border-box',
        boxShadow: '0 24px 70px rgba(0,0,0,.32)',
        direction: 'ltr',
      }}>
        <CenterArt />
        {TILES.map((t) => (
          <TileView key={t.id} tile={t} geom={TILE_GEOMS[t.id]} owners={owners} hotels={hotels} tokenColors={tokenColors} onTileClick={onTileClick} />
        ))}
        <Tokens tokens={tokens} />
      </div>
    </div>
  );
}
