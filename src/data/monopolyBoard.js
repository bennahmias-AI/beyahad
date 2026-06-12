/*
  monopolyBoard.js
  Board data for the vintage Israeli "Around the World" Monopoly (1980s).
  Source of truth: Ben's restored board HTML.
  39 tiles total, ordered by PLAY ORDER starting at "HATCHALA" (index 0).
  Assumed direction (to verify visually in the board component):
  Start (BL) -> left edge upward -> "Ein Knisa" (TL) -> top edge -> "Atzor" (TR)
  -> right edge downward -> "Sachek Od Paam" (BR) -> bottom edge -> back to start.
*/

// 4 player token colors, taken from the 4 circles in the START corner square
export const TOKEN_COLORS = [
  { id: 'yellow', color: '#f4c20d', name: 'צהוב' },
  { id: 'green',  color: '#2f9e3f', name: 'ירוק' },
  { id: 'blue',   color: '#2f73c9', name: 'כחול' },
  { id: 'orange', color: '#e8761f', name: 'כתום' },
];

// Vintage board palette (matches the restored board CSS)
export const BOARD_COLORS = {
  ink: '#1c1c1c', cream: '#f6efdf', paper: '#efe6d2',
  blue: '#2f97d4', skygrid: '#bfdcec', red: '#d8402a',
  orange: '#e8761f', yellow: '#f4c20d', green: '#2f9e3f', gold: '#d98a2b',
};

// 8 continent groups (label + bar color, as printed on the board)
export const GROUPS = {
  me:   { label: 'אסיה · המזרח התיכון', color: '#e8761f' },
  ea:   { label: 'אסיה המזרחית',        color: '#d8402a' },
  afr1: { label: 'מרכז אפריקה',          color: '#e8761f' },
  nafr: { label: 'צפון אפריקה',          color: '#e8761f' },
  na:   { label: 'אמריקה הצפונית',       color: '#e8402a' },
  sa:   { label: 'אמריקה הדרומית',       color: '#2f73c9' },
  se:   { label: 'אירופה הדרומית',       color: '#f4c20d' },
  ee:   { label: 'אירופה המזרחית',       color: '#2f9e3f' },
};

// Game constants (approved simple rules)
export const RULES = {
  START_CASH: 1500,
  PASS_START_BONUS: 200,
  MAX_ROUNDS: 20,
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  HOTEL_RENT_MULTIPLIER: 2, // full continent + hotel => rent doubled
  EIN_KNISA_FINE: 100,
  ATZOR_SKIP_TURNS: 2,
  BIRTHDAY_GIFT: 50,
};

/* Tile factory helpers */
const prop = (id, name, cap, price, hotel, rent, flag, group) => ({
  id, type: 'prop', name, cap, price, hotel, rent, flag, group,
});
const special = (id, name, sub, amount, art) => ({
  id, type: 'special', name, sub, amount, art, // amount: negative = pay, 'birthday' handled in engine
});
const lotto  = (id) => ({ id, type: 'lotto',  name: 'לוטו' });
const chance = (id) => ({ id, type: 'chance', name: 'צ׳אנס' });
const corner = (id, key, name, sub) => ({ id, type: 'corner', key, name, sub });

/*
  TILES — play order. edge/pos fields are filled by the board component when
  rendering; here only game-logic data lives.
*/
export const TILES = [
  // 0 — start corner (BL)
  corner(0, 'start', 'התחלה', 'עוברים = מקבלים 200'),

  // 1-8 — left edge, bottom to top
  prop(1, 'ארגנטינה', 'בואנוס איירס', 250, 75, 150, 'AR', 'sa'),
  prop(2, 'צ׳ילה', 'סנטיאגו', 200, 75, 125, 'CL', 'sa'),
  prop(3, 'ברזיל', 'ריו דה ז׳נרו', 350, 100, 175, 'BR', 'sa'),
  chance(4),
  special(5, 'קרנבל', 'שלם 100', -100, 'circus'),
  prop(6, 'קנדה', 'אוטווה', 350, 100, 175, 'CA', 'na'),
  prop(7, 'ארה"ב', 'וושינגטון', 450, 125, 200, 'US', 'na'),
  lotto(8),

  // 9 — corner (TL)
  corner(9, 'einKnisa', 'אין כניסה', 'שלם 100 כדי לחזור על דרך המלך הראשית'),

  // 10-18 — top edge, right to left on screen (play order)
  chance(10),
  prop(11, 'ישראל', 'ירושלים', 250, 75, 150, 'IL', 'me'),
  prop(12, 'תורכיה', 'אנקרה', 250, 75, 150, 'TR', 'me'),
  prop(13, 'סוריה', 'דמשק', 150, 50, 100, 'SY', 'me'),
  special(14, 'טיול מסביב לעולם', 'שלם דמי נסיעה 50', -50, 'bus'),
  prop(15, 'יפן', 'טוקיו', 300, 100, 150, 'JP', 'ea'),
  prop(16, 'סין', 'פקינג', 400, 125, 175, 'CN', 'ea'),
  prop(17, 'מונגוליה', 'אולן בטור', 100, 50, 75, 'MN', 'ea'),
  lotto(18),

  // 19 — corner (TR)
  corner(19, 'atzor', 'עצור', '2 סבובים'),

  // 20-27 — right edge, top to bottom
  prop(20, 'דהומי', 'פורטו נובו', 100, 50, 75, 'BJ', 'afr1'),
  prop(21, 'גאנה', 'אקרה', 250, 75, 150, 'GH', 'afr1'),
  chance(22),
  special(23, 'טוס למקום אחר', 'שלם 50', -50, 'plane'),
  prop(24, 'מרוקו', 'רבאט', 150, 50, 100, 'MA', 'nafr'),
  prop(25, 'מצרים', 'קהיר', 250, 75, 150, 'EG', 'nafr'),
  prop(26, 'לוב', 'טריפולי', 100, 50, 75, 'LY', 'nafr'),
  lotto(27),

  // 28 — corner (BR)
  corner(28, 'odPaam', 'שחק עוד פעם', 'שמור על חוקי התנועה'),

  // 29-38 — bottom edge, toward start
  special(29, 'יום הולדת', 'כל משתתף נותן לך שי 50', 'birthday', 'gift'),
  prop(30, 'יוון', 'אתונה', 200, 75, 125, 'GR', 'se'),
  prop(31, 'איטליה', 'רומא', 250, 75, 150, 'IT', 'se'),
  prop(32, 'יוגוסלביה', 'בלגרד', 250, 75, 150, 'YU', 'se'),
  special(33, 'נסעת במהירות מפרזת', 'שלם קנס 100', -100, 'speed'),
  prop(34, 'צ׳כוסלובקיה', 'פרג', 250, 75, 150, 'CS', 'ee'),
  prop(35, 'פולין', 'ורשה', 250, 75, 150, 'PL', 'ee'),
  prop(36, 'ברית המועצות', 'מוסקבה', 450, 125, 200, 'SU', 'ee'),
  prop(37, 'רומניה', 'בוקרשט', 250, 75, 150, 'RO', 'ee'),
  lotto(38),
];

export const TILE_COUNT = TILES.length; // 39

// Quick lookups
export const tileById = (id) => TILES[id];
export const propsOfGroup = (group) => TILES.filter((t) => t.type === 'prop' && t.group === group);

// True if `ownerUid` owns every property of the tile's continent group
export function ownsFullGroup(tile, owners, ownerUid) {
  if (tile.type !== 'prop') return false;
  return propsOfGroup(tile.group).every((p) => owners[p.id] === ownerUid);
}

// Rent due when landing on an owned property
export function rentFor(tile, owners, hotels) {
  const base = tile.rent;
  const hasHotel = !!hotels[tile.id];
  return hasHotel ? base * RULES.HOTEL_RENT_MULTIPLIER : base;
}
