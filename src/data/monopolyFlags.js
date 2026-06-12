/*
  monopolyFlags.js
  Vintage-style mini flags for the Monopoly board, ported 1:1 from Ben's
  restored board HTML (original window.FLAGS). Each flag is an SVG string
  (viewBox 90x60) rendered via dangerouslySetInnerHTML.
*/

const C = {
  red: '#d8402a', orange: '#e8761f', yellow: '#f4c20d', green: '#2f9e3f',
  blue: '#2f73c9', navy: '#16356e', white: '#f7f2e6', black: '#1c1c1c',
  sky: '#5bb6e2', gold: '#e9b419',
};

const wrap = (inner) =>
  `<svg viewBox="0 0 90 60" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">${inner}<rect x="0" y="0" width="90" height="60" fill="none" stroke="#1c1c1c" stroke-width="2.4"/></svg>`;

function star(cx, cy, r, fill, rot = -90) {
  let pts = '';
  for (let i = 0; i < 5; i++) {
    const ao = (rot + i * 72) * Math.PI / 180;
    const ai = (rot + 36 + i * 72) * Math.PI / 180;
    pts += `${cx + r * Math.cos(ao)},${cy + r * Math.sin(ao)} `;
    pts += `${cx + r * 0.42 * Math.cos(ai)},${cy + r * 0.42 * Math.sin(ai)} `;
  }
  return `<polygon points="${pts}" fill="${fill}"/>`;
}

const F = {
  IL: () => wrap(`<rect width="90" height="60" fill="${C.white}"/>
    <rect y="8" width="90" height="8" fill="${C.blue}"/>
    <rect y="44" width="90" height="8" fill="${C.blue}"/>
    <g fill="none" stroke="${C.blue}" stroke-width="2.6" stroke-linejoin="round">
      <polygon points="45,19 54.5,35.5 35.5,35.5"/>
      <polygon points="45,41 54.5,24.5 35.5,24.5"/></g>`),
  TR: () => wrap(`<rect width="90" height="60" fill="${C.red}"/>
    <circle cx="40" cy="30" r="14" fill="${C.white}"/>
    <circle cx="45" cy="30" r="11" fill="${C.red}"/>${star(58, 30, 6, C.white)}`),
  SY: () => wrap(`<rect width="90" height="20" fill="${C.red}"/>
    <rect y="20" width="90" height="20" fill="${C.white}"/>
    <rect y="40" width="90" height="20" fill="${C.black}"/>
    ${star(36, 30, 6, C.green)}${star(54, 30, 6, C.green)}`),
  JP: () => wrap(`<rect width="90" height="60" fill="${C.white}"/>
    <circle cx="45" cy="30" r="15" fill="${C.red}"/>`),
  CN: () => wrap(`<rect width="90" height="60" fill="${C.red}"/>
    ${star(20, 18, 9, C.yellow)}${star(36, 9, 4, C.yellow)}${star(40, 18, 4, C.yellow)}
    ${star(40, 29, 4, C.yellow)}${star(35, 37, 4, C.yellow)}`),
  MN: () => wrap(`<rect width="90" height="60" fill="${C.red}"/>
    <rect x="30" width="30" height="60" fill="#3f6fb8"/>
    <g fill="${C.yellow}">
      <path d="M12 13 q3 -6 6 0 q-1 4 -3 4 q-2 0 -3 -4z"/>
      <circle cx="15" cy="21" r="2.4"/>
      <path d="M17 25 a3.4 3.4 0 1 0 0 6.4 a4.4 4.4 0 0 1 0 -6.4z"/>
      <polygon points="15,33 18.5,38 11.5,38"/>
      <polygon points="15,49 18.5,44 11.5,44"/>
      <rect x="9.5" y="39" width="11" height="1.8"/>
      <rect x="9.5" y="41.4" width="11" height="1.8"/></g>`),
  US: () => wrap(`<rect width="90" height="60" fill="${C.white}"/>
    ${[0, 2, 4, 6].map(i => `<rect y="${4 + i * 8.6}" width="90" height="4.3" fill="${C.red}"/>`).join('')}
    <rect width="44" height="34" fill="${C.navy}"/>
    <g fill="${C.white}">${[0, 1, 2].map(r => [0, 1, 2, 3].map(c => `<circle cx="${8 + c * 11}" cy="${8 + r * 10}" r="1.8"/>`).join('')).join('')}</g>`),
  CA: () => wrap(`<rect width="90" height="60" fill="${C.white}"/>
    <rect width="22" height="60" fill="${C.red}"/><rect x="68" width="22" height="60" fill="${C.red}"/>
    <path d="M45 14 l3 9 8-3 -5 8 9 2 -8 4 4 9 -8-4 -3 8 -3-8 -8 4 4-9 -8-4 9-2 -5-8 8 3z" fill="${C.red}"/>`),
  BR: () => wrap(`<rect width="90" height="60" fill="${C.green}"/>
    <polygon points="45,8 80,30 45,52 10,30" fill="${C.yellow}"/>
    <circle cx="45" cy="30" r="11" fill="${C.blue}"/>`),
  CL: () => wrap(`<rect width="90" height="60" fill="${C.white}"/>
    <rect y="30" width="90" height="30" fill="${C.red}"/>
    <rect width="34" height="30" fill="${C.navy}"/>${star(17, 15, 8, C.white)}`),
  AR: () => wrap(`<rect width="90" height="60" fill="#7cb8e0"/>
    <rect y="20" width="90" height="20" fill="${C.white}"/>
    <circle cx="45" cy="30" r="5" fill="${C.gold}"/>
    <g stroke="${C.gold}" stroke-width="1.3">${[...Array(12)].map((_, i) => { const a = i * 30 * Math.PI / 180; return `<line x1="${45 + 5.6 * Math.cos(a)}" y1="${30 + 5.6 * Math.sin(a)}" x2="${45 + 8.6 * Math.cos(a)}" y2="${30 + 8.6 * Math.sin(a)}"/>`; }).join('')}</g>`),
  GR: () => wrap(`<rect width="90" height="60" fill="${C.blue}"/>
    ${[1, 3, 5, 7].map(i => `<rect y="${i * 6.667}" width="90" height="6.667" fill="${C.white}"/>`).join('')}
    <rect width="33.3" height="33.3" fill="${C.blue}"/>
    <rect x="13.3" y="0" width="6.7" height="33.3" fill="${C.white}"/>
    <rect x="0" y="13.3" width="33.3" height="6.7" fill="${C.white}"/>`),
  IT: () => wrap(`<rect width="30" height="60" fill="${C.green}"/>
    <rect x="30" width="30" height="60" fill="${C.white}"/><rect x="60" width="30" height="60" fill="${C.red}"/>`),
  YU: () => wrap(`<rect width="90" height="20" fill="${C.blue}"/>
    <rect y="20" width="90" height="20" fill="${C.white}"/><rect y="40" width="90" height="20" fill="${C.red}"/>
    ${star(45, 30, 9, C.red)}<polygon points="${(() => { let p = ''; for (let i = 0; i < 5; i++) { const a = (-90 + i * 72) * Math.PI / 180, b = (-54 + i * 72) * Math.PI / 180; p += `${45 + 9 * Math.cos(a)},${30 + 9 * Math.sin(a)} ${45 + 3.8 * Math.cos(b)},${30 + 3.8 * Math.sin(b)} `; } return p; })()}" fill="none" stroke="${C.yellow}" stroke-width="1.4"/>`),
  CS: () => wrap(`<rect width="90" height="30" fill="${C.white}"/>
    <rect y="30" width="90" height="30" fill="${C.red}"/>
    <polygon points="0,0 40,30 0,60" fill="${C.blue}"/>`),
  PL: () => wrap(`<rect width="90" height="30" fill="${C.white}"/>
    <rect y="30" width="90" height="30" fill="${C.red}"/>`),
  SU: () => wrap(`<rect width="90" height="60" fill="${C.red}"/>
    <g transform="translate(10,9)">
      ${star(20, 6, 6, C.yellow)}
      <g fill="${C.yellow}" stroke="${C.gold}" stroke-width="0.6" stroke-linejoin="round">
        <path d="M11 36 C2 28 4 15 21 13 C13 17 13 27 18 32 C15 32 12 34 11 36 Z"/>
        <path d="M9 35 L25 19 L29 23 L13 39 Z"/>
        <path d="M23 14 L33 24 L29 28 L19 18 Z"/>
      </g>
    </g>`),
  RO: () => wrap(`<rect width="30" height="60" fill="${C.blue}"/>
    <rect x="30" width="30" height="60" fill="${C.yellow}"/><rect x="60" width="30" height="60" fill="${C.red}"/>`),
  MA: () => wrap(`<rect width="90" height="60" fill="${C.red}"/>
    <polygon points="${(() => { let p = ''; for (let i = 0; i < 5; i++) { const a = (-90 + i * 144) * Math.PI / 180; p += `${45 + 16 * Math.cos(a)},${30 + 16 * Math.sin(a)} `; } return p; })()}" fill="none" stroke="${C.green}" stroke-width="2.6"/>`),
  EG: () => wrap(`<rect width="90" height="20" fill="${C.red}"/>
    <rect y="20" width="90" height="20" fill="${C.white}"/><rect y="40" width="90" height="20" fill="${C.black}"/>
    <g fill="${C.gold}" stroke="${C.gold}" stroke-width="0.5">
      <ellipse cx="45" cy="31" rx="4" ry="6"/>
      <path d="M41 28 L31 25 L40 32 Z"/><path d="M49 28 L59 25 L50 32 Z"/>
      <circle cx="45" cy="24" r="2.2"/>
      <rect x="40" y="38" width="10" height="2.4"/></g>`),
  LY: () => wrap(`<rect width="90" height="60" fill="${C.green}"/>`),
  BJ: () => wrap(`<rect width="30" height="60" fill="${C.green}"/>
    <rect x="30" width="60" height="30" fill="${C.yellow}"/>
    <rect x="30" y="30" width="60" height="30" fill="${C.red}"/>`),
  GH: () => wrap(`<rect width="90" height="20" fill="${C.red}"/>
    <rect y="20" width="90" height="20" fill="${C.yellow}"/>
    <rect y="40" width="90" height="20" fill="${C.green}"/>
    ${star(45, 30, 8, C.black)}`),
};

// Pre-render every flag to a string once
export const FLAGS = Object.fromEntries(Object.entries(F).map(([k, fn]) => [k, fn()]));

export function flagSVG(code) {
  return FLAGS[code] || '';
}
