/*
  monopolyBoardArt.js
  Faithful 1:1 port of Ben's restored vintage board HTML (the original
  template + center builder + strip renderer). Produces the full board
  as an HTML string + scoped CSS, rendered inside MonopolyBoard.jsx via
  dangerouslySetInnerHTML. Visual layer only - game logic stays in
  monopolyBoard.js.
*/

import { TILES, GROUPS } from './monopolyBoard';
import { flagSVG } from './monopolyFlags';

/* ----- print-order mapping (play-order ids -> physical strip order) -----
   TOP strip is rendered reversed+rotated 180 (original buildStrip(TOP,true)),
   sides are rotated +-90. Here we assemble each strip in its FINAL on-screen
   order and use plain rows/columns - identical pixels, simpler math, and the
   token/zoom geometry in MonopolyBoard.jsx maps 1:1. Original tile rotations
   (top upside down, sides sideways) are applied per-strip exactly like the
   source board. */
export const PRINT = {
  top:    [10, 11, 12, 13, 14, 15, 16, 17, 18],       // left -> right on screen
  bottom: [38, 37, 36, 35, 34, 33, 32, 31, 30, 29],   // left -> right on screen
  left:   [8, 7, 6, 5, 4, 3, 2, 1],                   // top -> bottom on screen
  right:  [20, 21, 22, 23, 24, 25, 26, 27],           // top -> bottom on screen
};

/* ----- special-tile icons (verbatim from the original) ----- */
const ICON = {
  bus: `<svg viewBox="0 0 100 70"><g fill="#f4c20d" stroke="#1c1c1c" stroke-width="2.4">
    <rect x="14" y="20" width="70" height="34" rx="5"/></g>
    <g fill="#bfe3f2" stroke="#1c1c1c" stroke-width="2"><rect x="20" y="26" width="13" height="12"/><rect x="36" y="26" width="13" height="12"/><rect x="52" y="26" width="13" height="12"/><rect x="68" y="26" width="11" height="12"/></g>
    <rect x="14" y="40" width="70" height="6" fill="#e8761f"/>
    <circle cx="30" cy="56" r="7" fill="#1c1c1c"/><circle cx="68" cy="56" r="7" fill="#1c1c1c"/>
    <circle cx="30" cy="56" r="3" fill="#f7f2e6"/><circle cx="68" cy="56" r="3" fill="#f7f2e6"/></svg>`,
  plane: `<svg viewBox="0 0 100 70"><g fill="#f4c20d" stroke="#1c1c1c" stroke-width="2.4">
    <path d="M10 38 L70 32 L88 30 q6 0 6 4 q0 4 -6 5 L70 42 L40 56 L33 55 L46 41 L24 42 L16 50 L10 49 L14 40 Z"/>
    <path d="M52 34 L60 16 L66 16 L62 33"/></g></svg>`,
  gift: `<svg viewBox="0 0 100 70"><g fill="#f4c20d" stroke="#1c1c1c" stroke-width="2.4">
    <rect x="22" y="30" width="56" height="30" rx="3"/><rect x="20" y="22" width="60" height="10" rx="2"/></g>
    <rect x="46" y="22" width="8" height="38" fill="#e8761f"/>
    <path d="M50 22 q-14 -16 -20 -4 q-2 8 20 4" fill="none" stroke="#e8402a" stroke-width="3"/>
    <path d="M50 22 q14 -16 20 -4 q2 8 -20 4" fill="none" stroke="#e8402a" stroke-width="3"/></svg>`,
  speed: `<svg viewBox="0 0 100 70">
    <g stroke="#1c1c1c" stroke-width="2" fill="none"><path d="M6 30 h12 M4 38 h10 M8 46 h10"/></g>
    <circle cx="28" cy="52" r="11.5" fill="#1c1c1c" stroke="#1c1c1c" stroke-width="2"/>
    <circle cx="28" cy="52" r="4.5" fill="#f7f2e6"/>
    <circle cx="79" cy="52" r="11.5" fill="#1c1c1c" stroke="#1c1c1c" stroke-width="2"/>
    <circle cx="79" cy="52" r="4.5" fill="#f7f2e6"/>
    <path d="M79 52 L73 27" stroke="#1c1c1c" stroke-width="3"/>
    <path d="M66 23 L82 23 M73 23 L73 29" stroke="#1c1c1c" stroke-width="3" stroke-linecap="round"/>
    <path d="M28 52 L41 36 L65 36 L79 52 L61 52 Q50 41 39 52 Z" fill="#2f73c9" stroke="#1c1c1c" stroke-width="2.4" stroke-linejoin="round"/>
    <rect x="43" y="28" width="20" height="11" rx="5.5" fill="#2f73c9" stroke="#1c1c1c" stroke-width="2.4"/>
    <rect x="29" y="30" width="13" height="6" rx="3" fill="#1c1c1c"/>
  </svg>`,
  circus: `<svg viewBox="0 0 100 70">
    <polygon points="50,3 93,30 7,30" fill="#f4c20d" stroke="#1c1c1c" stroke-width="2.2"/>
    <rect x="9" y="30" width="82" height="9" fill="#1c1c1c"/>
    <g fill="#d8402a">${[0, 1, 2, 3, 4, 5, 6].map(i => `<polygon points="${13 + i * 11},31 ${23 + i * 11},31 ${18 + i * 11},38"/>`).join('')}</g>
    <rect x="9" y="39" width="82" height="28" fill="#2f97d4" stroke="#1c1c1c" stroke-width="2.2"/>
    <g stroke="#1c1c1c" stroke-width="1.6" stroke-linejoin="round">
      <path d="M37 50 l16 -5 3 4 -16 6z" fill="#f4c20d"/>
      <circle cx="33" cy="50" r="5" fill="#e9c39a"/>
      <path d="M28 48 q5 -7 10 -1z" fill="#2f9e3f"/>
      <path d="M29 55 q4 -3 8 0 l2 12 -12 0z" fill="#d8402a"/>
      <circle cx="66" cy="54" r="5" fill="#e9c39a"/>
      <path d="M61 52 q5 -6 10 -1z" fill="#2f73c9"/>
      <path d="M62 59 q4 -3 8 0 l2 8 -12 0z" fill="#f4c20d"/></g></svg>`,
};

const PAIS = `<svg viewBox="0 0 60 64"><path d="M30 3 L56 22 L48 60 L12 60 L4 22 Z" fill="#6cb33f" stroke="#1c1c1c" stroke-width="2.4"/>
  <rect x="12" y="52" width="36" height="9" fill="#f4c20d" stroke="#1c1c1c" stroke-width="1.6"/>
  <path d="M20 30 a12 12 0 1 0 12 -12" fill="none" stroke="#1c4a1c" stroke-width="3.2"/>
  <polygon points="30,16 33,23 26,23" fill="#1c4a1c"/></svg>`;

/* ----- cell builders (verbatim structure) ----- */
function propCell(t) {
  const grp = GROUPS[t.group];
  return `<div class="cell prop" style="--grp:${grp.color}">
    <div class="grpband"></div>
    <div class="flagbox"><div class="flagsvg">${flagSVG(t.flag)}</div></div>
    <div class="price">${t.price}</div>
    <div class="pname">${t.name}</div>
    <div class="pcap">${t.cap}</div>
    <div class="pinfo"><span>מחיר המלון <b>${t.hotel}</b></span><span>עיר הבירה <b>${t.capCost}</b></span></div>
  </div>`;
}

function specialCell(t) {
  const accent = t.art === 'speed' ? '#e8761f' : '#f4c20d';
  return `<div class="cell special" style="--acc:${accent}">
    <div class="s-title">${t.name}</div>
    <div class="s-art">${ICON[t.art] || ''}</div>
    <div class="s-sub">${t.sub}</div>
  </div>`;
}

const lottoCell = () => `<div class="cell lotto"><div class="badge">${PAIS}<span>מפעל הפיס</span></div></div>`;
const chanceCell = () => `<div class="cell chance">
  <div class="qmark">
    <svg viewBox="0 0 70 56"><polygon points="6,8 64,8 64,48 6,48" fill="#f4c20d" stroke="#1c1c1c" stroke-width="2.4"/>
    <polyline points="6,8 35,30 64,8" fill="none" stroke="#1c1c1c" stroke-width="2.4"/></svg>
    <span class="qm">?</span>
  </div>
  <div class="chance-label">הפתעה</div>
</div>`;

function cellFor(t) {
  if (t.type === 'prop') return propCell(t);
  if (t.type === 'special') return specialCell(t);
  if (t.type === 'lotto') return lottoCell();
  return chanceCell();
}

/* Build a strip in final on-screen order, grouping consecutive same-group
   props under one group bar (identical to the original print). `rot` applies
   the original per-tile rotation (180 for top, 90/-90 for sides). */
function buildStrip(ids, rot) {
  /* Whole-strip rotation flips child order too (exactly like the original
     board): rot180 and rot-90 strips must be laid out reversed so the final
     on-screen order matches PRINT. */
  const laid = (rot === 'rot180' || rot === 'rot-90') ? ids.slice().reverse() : ids;
  let html = '';
  let i = 0;
  while (i < laid.length) {
    const t = TILES[laid[i]];
    if (t.type === 'prop') {
      const grp = t.group;
      const run = [];
      while (i < laid.length && TILES[laid[i]].type === 'prop' && TILES[laid[i]].group === grp) {
        run.push(TILES[laid[i]]); i++;
      }
      html += `<div class="group" style="flex:${run.length};--grp:${GROUPS[grp].color}">
        <div class="group-bar"><span>${GROUPS[grp].label}</span></div>
        <div class="group-cells">${run.map(propCell).join('')}</div>
      </div>`;
    } else {
      html += `<div class="slot" style="flex:1">${cellFor(t)}</div>`;
      i++;
    }
  }
  return `<div class="strip ${rot}">${html}</div>`;
}

/* ----- center landmarks: vintage illustrated style (redrawn to match the
   reference art Ben approved - soft shading, dark-brown ink outlines) ----- */
const G = '#d98a2b', GF = '#e9b94d', GD = '#9a6a16';
const INKB = '#5a4326'; // warm dark-brown outline used across all landmarks

const LM = {
  // Egyptian pyramids - three sand-gold pyramids with lit/shaded faces
  pyramid: `<svg viewBox="0 0 100 100">
    <ellipse cx="50" cy="90" rx="42" ry="5" fill="#00000018"/>
    <polygon points="22,40 38,86 6,86" fill="#d9b066" stroke="${INKB}" stroke-width="2" stroke-linejoin="round"/>
    <polygon points="22,40 38,86 22,86" fill="#c2914a"/>
    <polygon points="78,46 92,86 64,86" fill="#d9b066" stroke="${INKB}" stroke-width="2" stroke-linejoin="round"/>
    <polygon points="78,46 92,86 78,86" fill="#c2914a"/>
    <polygon points="50,20 80,86 20,86" fill="#eccd86" stroke="${INKB}" stroke-width="2.4" stroke-linejoin="round"/>
    <polygon points="50,20 80,86 50,86" fill="#d9b066"/>
    <line x1="50" y1="20" x2="50" y2="86" stroke="${INKB}" stroke-width="1.5" opacity=".5"/>
    <path d="M38 60 L62 60 M32 72 L68 72" stroke="#b3853f" stroke-width="1.2" opacity=".55"/>
    <rect x="4" y="86" width="92" height="5" fill="#e7cf94" stroke="${INKB}" stroke-width="1.4"/></svg>`,

  // Arc de Triomphe - stone arch with shading
  arch: `<svg viewBox="0 0 100 100">
    <ellipse cx="50" cy="92" rx="36" ry="4" fill="#00000018"/>
    <rect x="18" y="22" width="64" height="12" rx="2" fill="#cfc7b4" stroke="${INKB}" stroke-width="2"/>
    <rect x="23" y="34" width="54" height="56" fill="#ded7c4" stroke="${INKB}" stroke-width="2.4"/>
    <rect x="23" y="34" width="12" height="56" fill="#c7bfa8"/>
    <path d="M40 90 V58 a10 10 0 0 1 20 0 V90" fill="#9c8f72" stroke="${INKB}" stroke-width="2.2"/>
    <path d="M40 90 V58 a10 10 0 0 1 10 -10" fill="#8a7d61" opacity=".5"/>
    <g stroke="${INKB}" stroke-width="1.2" opacity=".5"><line x1="23" y1="46" x2="77" y2="46"/><line x1="30" y1="34" x2="30" y2="90"/><line x1="70" y1="34" x2="70" y2="90"/></g>
    <rect x="27" y="38" width="7" height="6" fill="#b3a98e"/><rect x="66" y="38" width="7" height="6" fill="#b3a98e"/></svg>`,

  // Statue of Liberty - verdigris copper with torch
  liberty: `<svg viewBox="0 0 100 100">
    <ellipse cx="50" cy="93" rx="26" ry="4" fill="#00000018"/>
    <rect x="38" y="86" width="26" height="8" fill="#8a7f72" stroke="${INKB}" stroke-width="2"/>
    <rect x="42" y="77" width="18" height="9" fill="#9c9184" stroke="${INKB}" stroke-width="2"/>
    <path d="M46 77 L44 50 Q44 41 51 39 L55 39 Q62 41 61 50 L59 77 Z" fill="#74b6a0" stroke="#3d7a64" stroke-width="2" stroke-linejoin="round"/>
    <path d="M51 39 L46 77 L51 77 Z" fill="#5a9c86" opacity=".6"/>
    <path d="M46 52 L33 59 L32 68" fill="none" stroke="#3d7a64" stroke-width="3" stroke-linecap="round"/>
    <rect x="28" y="55" width="8" height="11" rx="1" fill="#cdb87f" stroke="${INKB}" stroke-width="1.2" transform="rotate(-18 32 60)"/>
    <path d="M58 47 L66 25" stroke="#3d7a64" stroke-width="3.2" stroke-linecap="round"/>
    <circle cx="51" cy="31" r="6" fill="#7fbfa8" stroke="#3d7a64" stroke-width="1.8"/>
    <g stroke="#3d7a64" stroke-width="1.7" stroke-linecap="round">
      <line x1="51" y1="25" x2="51" y2="19"/><line x1="45" y1="27" x2="42" y2="22"/>
      <line x1="57" y1="27" x2="60" y2="22"/><line x1="45" y1="31" x2="39" y2="30"/><line x1="57" y1="31" x2="63" y2="30"/></g>
    <circle cx="67" cy="21" r="4.4" fill="#f4c20d" stroke="#b88a00" stroke-width="1"/>
    <g stroke="#f4c20d" stroke-width="1.5" stroke-linecap="round"><line x1="67" y1="15" x2="67" y2="11"/><line x1="62" y1="18" x2="59" y2="15"/><line x1="72" y1="18" x2="75" y2="15"/></g></svg>`,

  // Sandcastle (bottom, matches the reference) - golden sand with red flag
  towerDavid: `<svg viewBox="0 0 100 100">
    <ellipse cx="50" cy="92" rx="40" ry="5" fill="#00000018"/>
    <rect x="16" y="60" width="68" height="30" fill="#e0b873" stroke="${INKB}" stroke-width="2.2"/>
    <rect x="16" y="60" width="22" height="30" fill="#cd9f55" opacity=".5"/>
    <g fill="#e0b873" stroke="${INKB}" stroke-width="2.2">
      <rect x="14" y="48" width="16" height="42"/><rect x="70" y="48" width="16" height="42"/>
      <rect x="38" y="34" width="24" height="56"/></g>
    <g fill="${INKB}">
      <rect x="14" y="44" width="4" height="6"/><rect x="22" y="44" width="4" height="6"/>
      <rect x="70" y="44" width="4" height="6"/><rect x="78" y="44" width="4" height="6"/>
      <rect x="38" y="30" width="5" height="6"/><rect x="47" y="30" width="5" height="6"/><rect x="56" y="30" width="5" height="6"/></g>
    <path d="M44 60 Q50 50 56 60 Z" fill="${INKB}"/>
    <rect x="45" y="68" width="10" height="22" rx="4" fill="#c79a52"/>
    <line x1="50" y1="34" x2="50" y2="14" stroke="${INKB}" stroke-width="2"/>
    <path d="M50 14 L66 19 L50 24 Z" fill="#d8402a" stroke="${INKB}" stroke-width="1.4"/>
    <g stroke="#b3853f" stroke-width="1" opacity=".5"><line x1="16" y1="72" x2="84" y2="72"/></g></svg>`,

  // Eiffel Tower - bronze lattice
  eiffel: `<svg viewBox="0 0 100 100">
    <ellipse cx="50" cy="93" rx="30" ry="4" fill="#00000018"/>
    <g fill="#7a5a36" stroke="#4a3622" stroke-width="1.8" stroke-linejoin="round">
      <path d="M50 9 L53 27 L57 46 Q61 68 78 91 L65 91 Q58 70 50 63 Q42 70 35 91 L22 91 Q39 68 43 46 L47 27 Z"/>
    </g>
    <path d="M50 9 L50 63" stroke="#4a3622" stroke-width="1" opacity=".5"/>
    <g fill="none" stroke="#4a3622" stroke-width="2"><path d="M41 46 H59"/><path d="M34 70 H66"/><path d="M39 80 Q50 72 61 80"/></g>
    <g stroke="#4a3622" stroke-width="1" opacity=".5"><path d="M44 30 H56"/><path d="M43 38 L57 38"/></g>
    <polygon points="50,9 53,18 47,18" fill="#2f9e3f" stroke="#4a3622" stroke-width="1"/></svg>`,

  // Greek temple (Parthenon) - white stone with columns
  temple: `<svg viewBox="0 0 100 100">
    <ellipse cx="50" cy="92" rx="40" ry="4" fill="#00000018"/>
    <polygon points="14,40 86,40 50,18" fill="#ece9e2" stroke="${INKB}" stroke-width="2.2"/>
    <polygon points="14,40 50,18 50,40" fill="#d6d2c8"/>
    <rect x="16" y="40" width="68" height="7" fill="#ddd9cf" stroke="${INKB}" stroke-width="1.8"/>
    <g fill="#ece9e2" stroke="${INKB}" stroke-width="1.8">${[20, 32, 44, 56, 68].map(x => `<rect x="${x}" y="47" width="8" height="36"/>`).join('')}</g>
    <g fill="#cdc8bc">${[20, 32, 44, 56, 68].map(x => `<rect x="${x}" y="47" width="3" height="36"/>`).join('')}</g>
    <rect x="14" y="83" width="72" height="8" fill="#ddd9cf" stroke="${INKB}" stroke-width="1.8"/></svg>`,
};

function spokes() {
  const c = 370, r0 = 124, r1 = 366;
  let l = '';
  for (let i = 0; i < 6; i++) {
    const a = (i * 60) * Math.PI / 180;
    l += `<line x1="${c + r0 * Math.cos(a)}" y1="${c + r0 * Math.sin(a)}" x2="${c + r1 * Math.cos(a)}" y2="${c + r1 * Math.sin(a)}" stroke="#1c1c1c" stroke-width="1.4" opacity=".32"/>`;
  }
  return `<svg class="spokes" viewBox="0 0 740 740">${l}</svg>`;
}

function globeSVG() {
  const land = '#e8c074', landEdge = '#9a6a16';
  return `<svg viewBox="0 0 100 100">
    <defs><clipPath id="globeClip"><circle cx="50" cy="50" r="49"/></clipPath>
    <radialGradient id="oceanGrad" cx="38%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#4fb3d9"/><stop offset="55%" stop-color="#2a7fb8"/><stop offset="100%" stop-color="#15466f"/>
    </radialGradient></defs>
    <g clip-path="url(#globeClip)">
      <circle cx="50" cy="50" r="49" fill="url(#oceanGrad)"/>
      <g stroke="#bfe0ef" stroke-width="0.5" opacity=".3" fill="none">
        ${[12, 24, 37, 50, 63, 76, 88].map(y => `<line x1="1" y1="${y}" x2="99" y2="${y}"/>`).join('')}
        ${[18, 34, 50, 66, 82].map(x => `<path d="M${x} 2 Q${50 + (x - 50) * 1.55} 50 ${x} 98"/>`).join('')}
      </g>
      <g fill="${land}" stroke="${landEdge}" stroke-width="0.8" stroke-linejoin="round">
        <path d="M14 18 Q9 24 12 30 Q10 36 17 39 Q15 45 22 46 L27 41 Q33 42 33 36 Q39 33 36 27 Q40 22 33 19 Q26 13 20 16 Q16 14 14 18 Z"/>
        <path d="M24 47 Q27 51 31 53 Q33 57 30 58 Q27 53 23 50 Z"/>
        <path d="M33 60 Q29 64 31 71 Q33 80 39 86 Q44 88 43 80 Q47 74 44 67 Q45 60 38 58 Q35 57 33 60 Z"/>
        <path d="M40 9 Q37 13 41 16 Q45 15 45 11 Q43 8 40 9 Z"/>
        <path d="M55 23 Q52 27 56 29 Q54 33 59 33 L63 29 Q67 30 66 25 Q61 21 55 23 Z"/>
        <path d="M57 37 Q53 41 56 48 Q58 57 64 62 Q69 60 68 52 Q73 47 70 40 Q66 34 60 35 Q57 35 57 37 Z"/>
        <path d="M70 20 Q66 25 72 28 Q78 32 86 30 Q92 26 88 20 Q80 15 74 17 Q71 17 70 20 Z"/>
        <path d="M83 66 Q79 69 83 73 Q89 74 90 69 Q88 65 83 66 Z"/>
      </g>
      <ellipse cx="34" cy="28" rx="20" ry="14" fill="#ffffff" opacity=".12"/>
    </g>
    <circle cx="50" cy="50" r="49" fill="none" stroke="#8a5e12" stroke-width="1.6"/>
  </svg>`;
}

function priceTable(index) {
  const pct = ['−50%', '−40%', '−30%', '−20%', '−10%', '0', '+10%', '+20%', '+30%', '+40%', '+50%'];
  const regs = [
    { label: 'כל הארצות', key: null },
    { label: 'אירופה', key: 'europe' },
    { label: 'אמריקה', key: 'america' },
    { label: 'אסיה', key: 'asia' },
    { label: 'אפריקה', key: 'africa' },
  ];
  const colOf = (v) => 5 + Math.round(v / 10); // -50 -> col 0 ... +50 -> col 10
  let html = '';
  pct.forEach(p => html += `<div class="hd${p === '0' ? ' zero' : ''}">${p}</div>`);
  html += '<div class="hd corner0">מדד&nbsp;/&nbsp;אזור</div>';
  regs.forEach(r => {
    const markCol = index && r.key != null && typeof index[r.key] === 'number' ? colOf(index[r.key]) : -1;
    for (let i = 0; i < 11; i++) {
      html += `<div class="cellc${i === 5 ? ' zero' : ''}${i === markCol ? ' mark' : ''}"></div>`;
    }
    html += `<div class="reg">${r.label}</div>`;
  });
  return `<div class="panel"><div class="ptitle">לוח המחירים · מתחלף כל סיבוב</div><div class="pi-table">${html}</div></div>`;
}

/* face-down card back, shared by the in-board decks and the flip animation.
   RECTANGULAR (card-shaped), showing the ORIGINAL emblem of each deck:
   chance = yellow envelope with '?', lotto = green Pais hill+star badge. */
export function cardBack(kind) {
  // viewBox 0 0 72 100 = card aspect. Emblem sits centered in a fixed box
  // (cx 36, top ~30) at the SAME size for both decks; name printed below it.
  const emblem = kind === 'lotto'
    // Pais hill+star badge, centered at (36,46), ~30px tall
    ? `<g transform="translate(21,28) scale(0.5)"><path d="M30 3 L56 22 L48 60 L12 60 L4 22 Z" fill="#6cb33f" stroke="#1c1c1c" stroke-width="2.4"/>
        <rect x="12" y="52" width="36" height="9" fill="#f4c20d" stroke="#1c1c1c" stroke-width="1.6"/>
        <path d="M20 30 a12 12 0 1 0 12 -12" fill="none" stroke="#1c4a1c" stroke-width="3.2"/>
        <polygon points="30,16 33,23 26,23" fill="#1c4a1c"/></g>`
    // envelope with '?', centered at (36,46), ~26px tall - same footprint
    : `<g transform="translate(20,33)"><rect x="0" y="0" width="32" height="24" rx="1.5" fill="#f4c20d" stroke="#1c1c1c" stroke-width="2"/>
        <polyline points="0,0 16,13 32,0" fill="none" stroke="#1c1c1c" stroke-width="2"/>
        <text x="16" y="20" font-size="11" text-anchor="middle" font-family="Rubik,Heebo,sans-serif" font-weight="900" fill="#1c1c1c">?</text></g>`;
  return `<svg class="cardback" viewBox="0 0 72 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <rect x="3" y="3" width="66" height="94" rx="8" fill="#f6efdf" stroke="#1c1c1c" stroke-width="3"/>
    <rect x="8" y="8" width="56" height="84" rx="5" fill="none" stroke="#1c1c1c" stroke-width="1.2" opacity=".4"/>
    ${emblem}
    <text x="36" y="82" font-size="10" text-anchor="middle" font-family="Heebo,sans-serif" font-weight="800" fill="#1c1c1c">${kind === 'lotto' ? 'מפעל הפיס' : 'הפתעה'}</text></svg>`;
}

function centerHTML(priceIndex) {
  const CX = 588, CY = 690, R = 256, SZ = 182;
  const ring = [['pyramid', -90], ['arch', -30], ['liberty', 30], ['towerDavid', 90], ['eiffel', 150], ['temple', 210]];
  let html = `<div class="topstrip">
    <div class="titlebox"><div class="big">מדד</div><div class="sub">המחירים</div></div>
    ${priceTable(priceIndex)}
  </div>`;
  html += `<div class="wheel" style="left:${CX}px;top:${CY}px;width:740px;height:740px;">${spokes()}</div>`;
  ring.forEach(([k, deg]) => {
    const a = deg * Math.PI / 180;
    const x = CX + R * Math.cos(a) - SZ / 2, y = CY + R * Math.sin(a) - SZ / 2;
    html += `<div class="landmark" style="left:${x}px;top:${y}px;width:${SZ}px;height:${SZ}px;">${LM[k]}</div>`;
  });
  html += `<div class="globe" style="left:${CX}px;top:${CY}px;">${globeSVG()}</div>`;
  // two face-down card decks sitting in the center, like a real Monopoly board.
  // ids let the React layer find them as the animation's start position.
  html += `<div class="c-deck chance-deck" id="deck-chance">${cardBack('chance')}</div>`;
  html += `<div class="c-deck lotto-deck" id="deck-lotto">${cardBack('lotto')}</div>`;
  return html;
}

/* ----- corner markup (verbatim from the template) ----- */
const CORNERS = {
  tl: `<div class="corner tl">
    <svg width="74" height="74" viewBox="0 0 74 74"><circle cx="37" cy="37" r="32" fill="#d8402a" stroke="#1c1c1c" stroke-width="3"></circle><rect x="16" y="30" width="42" height="14" rx="2" fill="#f7f2e6" stroke="#1c1c1c" stroke-width="2"></rect></svg>
    <div class="c-title">אין כניסה</div>
    <div class="c-sub">שלם 100 כדי לחזור על דרך המלך הראשית</div>
  </div>`,
  tr: `<div class="corner tr">
    <svg width="78" height="74" viewBox="0 0 78 74">
      <polygon points="69.5,49.6 51.6,67.5 26.4,67.5 8.5,49.6 8.5,24.4 26.4,6.5 51.6,6.5 69.5,24.4" fill="#d8402a" stroke="#1c1c1c" stroke-width="3"></polygon>
      <polygon points="63.9,47.3 49.3,61.9 28.7,61.9 14.1,47.3 14.1,26.7 28.7,12.1 49.3,12.1 63.9,26.7" fill="none" stroke="#f7f2e6" stroke-width="2.6"></polygon>
      <text x="39" y="45" text-anchor="middle" font-family="Heebo, Arial, sans-serif" font-weight="900" font-size="21" fill="#f7f2e6">עצור</text>
    </svg>
    <div class="c-title">עצור</div>
    <div class="c-sub">2 סבובים</div>
  </div>`,
  bl: `<div class="corner bl">
    <svg viewBox="0 0 200 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <g stroke="#1c1c1c" stroke-width="3.4">
        <circle cx="38" cy="38" r="26" fill="#f4c20d"></circle>
        <circle cx="162" cy="38" r="26" fill="#2f9e3f"></circle>
        <circle cx="38" cy="162" r="26" fill="#2f73c9"></circle>
        <circle cx="162" cy="162" r="26" fill="#e8761f"></circle>
      </g>
      <text x="100" y="76" text-anchor="middle" font-family="Heebo,sans-serif" font-weight="900" font-size="29" fill="#1c1c1c">התחלה</text>
      <path d="M100 180 V94 M74 118 L100 92 L126 118" fill="none" stroke="#1c1c1c" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"></path>
    </svg>
  </div>`,
  br: `<div class="corner br">
    <svg width="74" height="74" viewBox="0 0 74 74"><rect x="6" y="6" width="62" height="62" rx="4" fill="#2f73c9" stroke="#1c1c1c" stroke-width="2"></rect><polygon points="20,54 54,54 37,21" fill="#f7f2e6" stroke="#1c1c1c" stroke-width="2.4"></polygon><rect x="25" y="47" width="24" height="7" fill="#2f9e3f"></rect><circle cx="37" cy="33" r="3.4" fill="#1c1c1c"></circle><path d="M37 36 l-4 9 M37 36 l4 9 M37 38 l-5 -2 M37 38 l5 -2" stroke="#1c1c1c" stroke-width="2.2"></path></svg>
    <div class="c-title">שחק עוד פעם</div>
    <div class="c-sub">שמור על חוקי התנועה</div>
  </div>`,
};

/* ----- full board HTML ----- */
export function buildBoardHTML(priceIndex = null) {
  return `
    ${CORNERS.tl}
    <div class="edge top">${buildStrip(PRINT.top, 'rot180')}</div>
    ${CORNERS.tr}
    <div class="edge left">${buildStrip(PRINT.left, 'rot90')}</div>
    <div class="center">${centerHTML(priceIndex)}</div>
    <div class="edge right">${buildStrip(PRINT.right, 'rot-90')}</div>
    ${CORNERS.bl}
    ${CORNERS.br}
    <div class="edge bottom">${buildStrip(PRINT.bottom, 'rot0')}</div>
  `;
}

/* ----- scoped CSS (the original board style, prefixed .mono-stage) ----- */
export const BOARD_CSS = `
.mono-stage{
  --ink:#1c1c1c; --cream:#f6efdf; --paper:#efe6d2;
  --blue:#2f97d4; --skygrid:#bfdcec; --red:#d8402a; --orange:#e8761f;
  --yellow:#f4c20d; --green:#2f9e3f; --gold:#d98a2b;
  position:relative; width:1600px; height:1600px;
  background:var(--cream);
  direction:ltr;
  display:grid;
  grid-template-columns:212px 1fr 212px;
  grid-template-rows:212px 1fr 212px;
  box-shadow:0 24px 70px rgba(0,0,0,.32), 0 2px 0 #fff inset;
  border:3px solid var(--ink);
  background-image:
    radial-gradient(circle at 20% 80%, rgba(0,0,0,.015), transparent 40%),
    radial-gradient(circle at 85% 15%, rgba(0,0,0,.015), transparent 40%);
  font-family:'Heebo', sans-serif; color:var(--ink);
  box-sizing:border-box;
}
.mono-stage *{box-sizing:border-box; margin:0; padding:0;}

.mono-stage .edge{position:relative; overflow:visible;}
.mono-stage .edge.top{grid-column:2;grid-row:1;}
.mono-stage .edge.bottom{grid-column:2;grid-row:3;}
.mono-stage .edge.left{grid-column:1;grid-row:2;}
.mono-stage .edge.right{grid-column:3;grid-row:2;}
/* divider lines between a corner and the first tile of each side strip */
.mono-stage .edge.right{border-top:2px solid var(--ink);}
.mono-stage .strip{position:absolute; display:flex; align-items:stretch; background:var(--cream);}
.mono-stage .edge.top .strip, .mono-stage .edge.bottom .strip{top:0;left:0;width:100%;height:100%;}
.mono-stage .strip.rot180{transform:rotate(180deg);}
.mono-stage .edge.left .strip, .mono-stage .edge.right .strip{
  top:50%; left:50%; width:1176px; height:212px;
}
.mono-stage .strip.rot90{transform:translate(-50%,-50%) rotate(90deg);}
.mono-stage .strip.rot-90{transform:translate(-50%,-50%) rotate(-90deg);}

.mono-stage .group{display:flex;flex-direction:column; min-width:0;}
.mono-stage .strip > *{border-inline-start:2px solid var(--ink);}
.mono-stage .strip > *:first-child{border-inline-start:none;}
.mono-stage .group-bar{
  height:26px; background:var(--grp); color:#fff; display:flex; align-items:center; justify-content:center;
  font-weight:800; font-size:14.5px; letter-spacing:.2px; border-bottom:2px solid var(--ink);
  white-space:nowrap; overflow:hidden;
}
.mono-stage .group-cells{display:flex; flex:1; min-height:0;}
.mono-stage .slot{display:flex;}

.mono-stage .cell{flex:1; min-width:0; border-inline-start:2px solid var(--ink); position:relative; background:var(--cream);
  display:flex; flex-direction:column; align-items:stretch; text-align:center;}
.mono-stage .group .cell:first-child{border-inline-start:none;}

.mono-stage .prop .grpband{height:8px; background:var(--grp); border-bottom:1.5px solid var(--ink);}
.mono-stage .prop .flagbox{height:50px; display:flex;align-items:center;justify-content:center; padding:5px 6px 2px;}
.mono-stage .prop .flagbox .flagsvg{width:64px;height:40px; filter:drop-shadow(0 1px 0 rgba(0,0,0,.12));}
.mono-stage .prop .price{font-family:'Rubik','Heebo',sans-serif;font-weight:700;font-size:21px; line-height:1; padding:3px 0 2px; border-top:1.5px solid var(--ink); border-bottom:1.5px solid var(--ink); margin:0 0 3px;}
.mono-stage .prop .pname{font-weight:900;font-size:18px;line-height:1.02; padding:1px 3px 0; word-break:break-word;}
.mono-stage .prop .pcap{font-weight:500;font-size:12.5px; color:#3a3a3a; margin-top:1px;}
.mono-stage .prop .pinfo{margin-top:auto; padding:3px 4px 6px; display:flex;flex-direction:column;gap:1px; font-size:10.5px; color:#222;}
.mono-stage .prop .pinfo b{font-family:'Rubik','Heebo',sans-serif;font-weight:700;}

.mono-stage .special{justify-content:space-between; padding:7px 6px; background:var(--cream);}
.mono-stage .special .s-title{font-weight:800;font-size:13px;line-height:1.05;}
.mono-stage .special .s-art{flex:1; display:flex;align-items:center;justify-content:center; padding:2px;}
.mono-stage .special .s-art svg{width:84%;max-height:92px;}
.mono-stage .special .s-sub{font-weight:700;font-size:12px; color:#222;}
.mono-stage .special::after{content:"";position:absolute;inset:4px;border:2px solid var(--acc);border-radius:4px;pointer-events:none;opacity:.55;}

.mono-stage .lotto{align-items:center;justify-content:center;}
.mono-stage .lotto .badge{display:flex;flex-direction:column;align-items:center;gap:4px;}
.mono-stage .lotto .badge svg{width:64px;height:68px;}
.mono-stage .lotto .badge span{font-weight:800;font-size:12.5px;}
.mono-stage .chance{align-items:center;justify-content:center;gap:6px;}
.mono-stage .chance .qmark{position:relative;width:74px;height:58px;display:flex;align-items:center;justify-content:center;}
.mono-stage .chance .qmark svg{position:absolute;inset:0;width:100%;height:100%;}
.mono-stage .chance .qm{position:relative;font-family:'Rubik','Heebo',sans-serif;font-weight:900;font-size:28px;color:var(--ink);}
.mono-stage .chance .chance-label{font-weight:800;font-size:13px;}

.mono-stage .corner{position:relative; display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center; padding:12px; border:0;}
.mono-stage .corner.tl{grid-column:1;grid-row:1; background:#f3d9d2;}
.mono-stage .corner.tr{grid-column:3;grid-row:1; background:#f3d9d2;}
.mono-stage .corner.bl{grid-column:1;grid-row:3; background:#bfe0ef; padding:0;}
.mono-stage .corner.br{grid-column:3;grid-row:3; background:var(--yellow);}
.mono-stage .corner.tl{border-top:2px solid var(--ink); border-left:2px solid var(--ink);}
.mono-stage .corner.tr{border-top:2px solid var(--ink); border-right:2px solid var(--ink);}
.mono-stage .corner.bl{border-top:2px solid var(--ink); border-right:2px solid var(--ink);}
.mono-stage .corner.br{border-top:2px solid var(--ink); border-left:2px solid var(--ink);}
.mono-stage .corner .c-title{font-weight:900;font-size:20px;line-height:1.04;}
.mono-stage .corner .c-sub{font-weight:700;font-size:12.5px;margin-top:5px;max-width:170px;}
.mono-stage .corner svg{display:block;}
.mono-stage .corner.tl{transform:rotate(180deg);}
.mono-stage .corner.tr{transform:rotate(180deg);}

.mono-stage .center{grid-column:2;grid-row:2; position:relative;
  border:4px solid var(--ink); overflow:hidden;
  /* art-deco gold: faint sun-rays behind the wheel + deep blue radial */
  background:
    repeating-conic-gradient(from 0deg at 50% 57%, rgba(255,255,255,.05) 0deg 6deg, transparent 6deg 12deg),
    radial-gradient(circle at 50% 50%, #2a7fb8 0%, #1d5e92 55%, #123c61 100%);}
.mono-stage .center::before{content:""; position:absolute; inset:22px; pointer-events:none; z-index:1;
  border:3px solid var(--gold); outline:8px double rgba(217,138,43,.45); outline-offset:9px;}
.mono-stage .center::after{content:""; position:absolute; inset:34px; pointer-events:none; z-index:1;
  background:
    linear-gradient(var(--gold),var(--gold)) left top / 54px 4px no-repeat,
    linear-gradient(var(--gold),var(--gold)) left top / 4px 54px no-repeat,
    linear-gradient(var(--gold),var(--gold)) right top / 54px 4px no-repeat,
    linear-gradient(var(--gold),var(--gold)) right top / 4px 54px no-repeat,
    linear-gradient(var(--gold),var(--gold)) left bottom / 54px 4px no-repeat,
    linear-gradient(var(--gold),var(--gold)) left bottom / 4px 54px no-repeat,
    linear-gradient(var(--gold),var(--gold)) right bottom / 54px 4px no-repeat,
    linear-gradient(var(--gold),var(--gold)) right bottom / 4px 54px no-repeat;}
.mono-stage .wheel{position:absolute; transform:translate(-50%,-50%); z-index:2;
  border-radius:50%;
  background:var(--cream); border:6px solid var(--red);
  box-shadow:0 0 0 10px rgba(0,0,0,.06) inset;}
.mono-stage .wheel svg.spokes{position:absolute;inset:0;width:100%;height:100%;}
.mono-stage .globe{position:absolute;transform:translate(-50%,-50%); z-index:2;
  width:280px;height:280px;border-radius:50%; overflow:hidden;
  border:5px solid var(--gold); box-shadow:0 0 0 3px #1c1c1c, 0 8px 22px rgba(0,0,0,.3);}
.mono-stage .globe svg{position:absolute;inset:0;width:100%;height:100%;}
.mono-stage .landmark{position:absolute; display:flex;align-items:center;justify-content:center; z-index:2;}
.mono-stage .landmark svg{width:100%;height:100%;}

.mono-stage .topstrip{position:absolute; left:26px; right:26px; top:24px; height:192px; display:flex; gap:14px; align-items:stretch; z-index:3;}
.mono-stage .topstrip .titlebox{position:relative; width:212px; flex:none; padding:6px;
  display:flex;flex-direction:column;align-items:center;justify-content:center; gap:2px;
  background:var(--red); color:#fff; border:4px solid var(--ink); box-shadow:5px 5px 0 rgba(0,0,0,.18);}
.mono-stage .topstrip .titlebox .big{font-family:'Rubik','Heebo',sans-serif;font-weight:900;font-size:44px;line-height:.95;letter-spacing:1px;}
.mono-stage .topstrip .titlebox .sub{font-weight:800;font-size:22px;}
.mono-stage .panel{position:relative; flex:1; display:flex; flex-direction:column;}
.mono-stage .panel .ptitle{font-weight:700;font-size:15px;color:#fff;margin-bottom:6px;text-shadow:0 1px 0 rgba(0,0,0,.25);}
.mono-stage .pi-table{flex:1; display:grid; grid-template-columns:repeat(11,1fr) 120px;
  grid-auto-rows:1fr; border:3px solid var(--ink); background:#fff;}
.mono-stage .pi-table>div{border-inline-start:1px solid #2b4a5c; border-top:1px solid #2b4a5c;
  display:flex;align-items:center;justify-content:center; font-size:13px;}
.mono-stage .pi-table .hd{background:var(--skygrid); font-family:'Rubik','Heebo',sans-serif;font-weight:500; font-size:13px;}
.mono-stage .pi-table .reg{background:var(--green); color:#fff; font-weight:800; font-size:15px; border-inline-start:0;}
.mono-stage .pi-table .corner0{background:var(--skygrid);border-inline-start:0; font-size:12px; font-weight:700;}
.mono-stage .pi-table .cellc{background:#eef6fb;}
.mono-stage .pi-table .zero{background:#dfeef7;font-weight:700;}
.mono-stage .pi-table .cellc.mark{background:var(--red); box-shadow:0 0 0 2.5px var(--ink) inset;}

.mono-stage .c-deck{position:absolute; top:880px; width:120px; height:166px; z-index:3;}
.mono-stage .c-deck .cardback{width:120px;height:166px;
  filter:drop-shadow(3px 4px 0 rgba(0,0,0,.28));}
.mono-stage .c-deck::before{content:""; position:absolute; top:5px; left:5px;
  width:120px; height:166px; border-radius:8px; background:#0000002e; z-index:-1;}
.mono-stage .chance-deck{left:46px;}
.mono-stage .lotto-deck{right:46px;}
`;
