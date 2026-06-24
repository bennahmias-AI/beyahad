/*
  AroundWorldBoard.jsx
  Renders Ben's ORIGINAL restored vintage board (1:1 art via aroundWorldBoardArt)
  on a 1600x1600 stage, auto-scaled to its container, with React overlays on
  top: player tokens (walk animation), owner rings, hotel badges, and a
  cinematic camera (focusTiles -> smooth zoom).

  Props:
    focusTiles : array of tile ids to zoom to, or null (fit all)
    tokens     : [{ uid, color, tileId }]
    owners     : { [tileId]: uid }
    hotels     : { [tileId]: true }
    tokenColors: { [uid]: '#hex' }
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { TILES } from '../data/aroundWorldBoard';
import { buildBoardHTML, BOARD_CSS } from '../data/aroundWorldBoardArt';

const B = 1600;
const CORNER = 212;
const SPAN = B - 2 * CORNER;      // 1176
const TOP_W = SPAN / 9;
const BOT_W = SPAN / 10;
const SIDE_H = SPAN / 8;          // 147
const INK = '#1c1c1c';

// ---- geometry: play-order id -> on-screen rect ---------------------------
function tileGeom(id) {
  if (id === 0)  return { x: 0,          y: B - CORNER, w: CORNER, h: CORNER };
  if (id <= 8)   return { x: 0,          y: CORNER + (8 - id) * SIDE_H, w: CORNER, h: SIDE_H };
  if (id === 9)  return { x: 0,          y: 0,          w: CORNER, h: CORNER };
  if (id <= 18)  return { x: CORNER + (id - 10) * TOP_W, y: 0, w: TOP_W, h: CORNER };
  if (id === 19) return { x: B - CORNER, y: 0,          w: CORNER, h: CORNER };
  if (id <= 27)  return { x: B - CORNER, y: CORNER + (id - 20) * SIDE_H, w: CORNER, h: SIDE_H };
  if (id === 28) return { x: B - CORNER, y: B - CORNER, w: CORNER, h: CORNER };
  return { x: CORNER + SPAN - (id - 28) * BOT_W, y: B - CORNER, w: BOT_W, h: CORNER };
}

export const TILE_GEOMS = TILES.map((t) => tileGeom(t.id));

export function tileCenter(id) {
  const g = TILE_GEOMS[id];
  return { cx: g.x + g.w / 2, cy: g.y + g.h / 2 };
}

// ---- camera math ----------------------------------------------------------
function cameraBox(focusTiles) {
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
  return { bx, by, bw, bh };
}
function cameraTransform(focusTiles, cw, ch) {
  const { bx, by, bw, bh } = cameraBox(focusTiles);
  const s = Math.min(cw / bw, ch / bh);
  const tx = (cw - s * bw) / 2 - s * bx;
  const ty = (ch - s * bh) / 2 - s * by;
  return `translate(${tx}px, ${ty}px) scale(${s})`;
}

// ---- token layer ------------------------------------------------------------
const TOKEN_OFFSETS = [[-34, -34], [34, -34], [-34, 34], [34, 34]];

// On the START square (id 0) each token sits inside its OWN colored circle.
// The start SVG is a 200x200 viewBox scaled to the 212px corner (x1.06):
// yellow (38,38) green (162,38) blue (38,162) orange (162,162).
const START_SLOTS = {
  '#f4c20d': [38, 38],   // yellow - top-left
  '#2f9e3f': [162, 38],  // green  - top-right
  '#2f73c9': [38, 162],  // blue   - bottom-left
  '#e8761f': [162, 162], // orange - bottom-right
};

function Tokens({ tokens }) {
  return tokens.map((tk, i) => {
    const g = TILE_GEOMS[tk.tileId];
    const slot = tk.tileId === 0 ? START_SLOTS[tk.color] : null;
    let left, top, sz;
    if (slot) {
      const sc = g.w / 200; // 212/200
      left = g.x + slot[0] * sc - 26;
      top = g.y + slot[1] * sc - 26;
      sz = 52;
    } else {
      const { cx, cy } = tileCenter(tk.tileId);
      const [dx, dy] = TOKEN_OFFSETS[i % 4];
      left = cx + dx - 30;
      top = cy + dy - 30;
      sz = 60;
    }
    return (
      <div key={tk.uid} style={{
        position: 'absolute', left, top, width: sz, height: sz,
        zIndex: 5, transition: 'left .42s ease, top .42s ease', pointerEvents: 'none',
      }}>
        <svg viewBox="0 0 44 44" width={sz} height={sz}>
          <circle cx="22" cy="24.5" r="17" fill="rgba(0,0,0,.28)" />
          <circle cx="22" cy="21" r="17" fill={tk.color} stroke={INK} strokeWidth="3" />
          <circle cx="22" cy="21" r="10.5" fill="none" stroke={INK} strokeWidth="1.6" opacity=".5" />
          <ellipse cx="16" cy="14" rx="5" ry="3" fill="#fff" opacity=".55" transform="rotate(-30 16 14)" />
        </svg>
      </div>
    );
  });
}

// ---- ownership / hotel overlays ----------------------------------------------
function Overlays({ owners, hotels, tokenColors }) {
  const items = [];
  for (const idStr in owners) {
    const id = Number(idStr);
    const g = TILE_GEOMS[id];
    if (!g) continue;
    const color = tokenColors[owners[id]] || '#000';
    items.push(
      <div key={'own' + id} style={{
        position: 'absolute', left: g.x, top: g.y, width: g.w, height: g.h,
        background: color + '38', pointerEvents: 'none', zIndex: 3,
      }} />
    );
    items.push(
      <div key={'chip' + id} style={{
        position: 'absolute', left: g.x + 7, top: g.y + g.h - 31, width: 24, height: 24,
        borderRadius: '50%', background: color, border: `2.5px solid ${INK}`,
        pointerEvents: 'none', zIndex: 4, boxShadow: '0 1px 4px rgba(0,0,0,.3)',
      }} />
    );
    const lvl = hotels[id] || 0;
    if (lvl > 0) {
      const label = lvl === 4 ? 'עיר בירה' : lvl === 1 ? 'מלון' : 'מלון ×' + lvl;
      items.push(
        <div key={'hot' + id} style={{
          position: 'absolute', left: g.x + g.w / 2 - 50, top: g.y + g.h - 40, width: 100,
          background: lvl === 4 ? '#2f73c9' : '#d8402a', color: '#fff', fontSize: 19, fontWeight: 800, textAlign: 'center',
          borderRadius: 8, padding: '2px 0', border: `2.5px solid ${INK}`, zIndex: 4,
          fontFamily: 'Heebo, sans-serif',
        }}>{label}</div>
      );
    }
  }
  return items;
}

// ---- main component -----------------------------------------------------------
// קוביות זרוקות בתוך שכבת הלוח (מודבקות ללוח, זזות עם המצלמה, נשארות איפה שנחתו)
const DIE_PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function BoardDie({ value, size }) {
  const on = new Set(DIE_PIPS[value] || []);
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.2, background: 'linear-gradient(145deg,#fff,#efe7d6)', border: `${Math.max(2, size * 0.05)}px solid ${INK}`, boxShadow: '0 8px 18px rgba(0,0,0,.4), inset 0 -3px 6px rgba(0,0,0,.12)', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,1fr)', padding: size * 0.12, boxSizing: 'border-box' }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {on.has(i) && <span style={{ width: size * 0.17, height: size * 0.17, borderRadius: '50%', background: INK }} />}
        </span>
      ))}
    </div>
  );
}
function BoardDice({ toss, cx, cy, dieSize, boxMin }) {
  const [stage, setStage] = useState('tumble');
  const [faces, setFaces] = useState([toss.d1, toss.d2]);
  const seedRef = useRef(null);
  if (!seedRef.current) {
    const ang = Math.random() * Math.PI * 2;
    const r = boxMin * (0.22 + Math.random() * 0.05);
    seedRef.current = { dx: Math.cos(ang) * r, dy: Math.sin(ang) * r };
  }
  useEffect(() => {
    const start = Date.now();
    const TUMBLE = 650;
    let timer;
    const tick = () => {
      if (Date.now() - start < TUMBLE) {
        setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
        timer = setTimeout(tick, 75);
      } else {
        setFaces([toss.d1, toss.d2]);
        setStage('settle');
      }
    };
    tick();
    return () => clearTimeout(timer);
    // eslint-disable-next-line
  }, []);
  const left = cx + seedRef.current.dx;
  const top = cy + seedRef.current.dy;
  return (
    <div style={{ position: 'absolute', left, top, transform: 'translate(-50%,-50%)', zIndex: 6, pointerEvents: 'none', display: 'flex', gap: Math.round(dieSize * 0.18) }}>
      <div style={{ ['--d']: `-${Math.round(dieSize * 4)}px`, animation: stage === 'tumble' ? 'awBDie1 .62s cubic-bezier(.4,.05,.55,1) forwards' : 'awBLand .3s ease-out forwards' }}><BoardDie value={faces[0]} size={dieSize} /></div>
      <div style={{ ['--d']: `-${Math.round(dieSize * 4.6)}px`, animation: stage === 'tumble' ? 'awBDie2 .62s cubic-bezier(.4,.05,.55,1) forwards' : 'awBLand .3s ease-out forwards' }}><BoardDie value={faces[1]} size={dieSize} /></div>
    </div>
  );
}

export default function AroundWorldBoard({ focusTiles = null, tokens = [], owners = {}, hotels = {}, tokenColors = {}, priceIndex = null, diceToss = null }) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // rebuilt when the price index changes (once per round)
  const boardHTML = useMemo(() => buildBoardHTML(priceIndex), [priceIndex]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const transform = size.w ? cameraTransform(focusTiles, size.w, size.h) : 'scale(0)';

  // הקוביות נזרקות תמיד למרכז הלוח (בלתי תלוי במצב המצלמה) כך הנחיתה זהה לכל השחקנים גם באונליין
  const diceLandRef = useRef({ id: null });
  if (diceToss && diceLandRef.current.id !== diceToss.id) {
    diceLandRef.current = { id: diceToss.id, cx: B / 2, cy: B / 2, boxMin: B, dieSize: B * 0.072 };
  }
  const dl = diceLandRef.current;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <style>{BOARD_CSS}</style>
      <div style={{
        position: 'absolute', left: 0, top: 0, width: B, height: B,
        transformOrigin: '0 0', transform,
        transition: 'transform .8s cubic-bezier(.4,.1,.2,1)',
      }}>
        <div className="aw-stage" dangerouslySetInnerHTML={{ __html: boardHTML }} />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <Overlays owners={owners} hotels={hotels} tokenColors={tokenColors} />
          <Tokens tokens={tokens} />
          {diceToss && dl.id === diceToss.id && (
            <BoardDice key={diceToss.id} toss={diceToss} cx={dl.cx} cy={dl.cy} dieSize={dl.dieSize} boxMin={dl.boxMin} />
          )}
        </div>
      </div>
    </div>
  );
}
