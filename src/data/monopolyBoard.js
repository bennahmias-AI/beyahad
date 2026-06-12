/*
  monopolyBoard.js
  Board data for the vintage Israeli "Around the World" Monopoly (1980s).

  Money model (all real numbers from the physical game):
  - price   = purchase price, printed big on the board tile
  - hotel   = cost to build ONE hotel (board: "מחיר המלון")
  - capCost = cost to build the capital city (board: "עיר הבירה")
  - rents   = 5 rent tiers from the property cards (Ben's Excel):
              [visit fee, 1 hotel, 2 hotels, 3 hotels, capital city]
  (Surprise/Pais card data intentionally NOT integrated yet - per Ben.)

  39 tiles in PLAY ORDER from "HATCHALA" (0): start (BL, arrow up) ->
  left edge up -> Ein Knisa (TL) -> top -> Atzor (TR) -> right edge down ->
  Sachek Od Paam (BR) -> bottom right-to-left -> back to start.
*/

// 4 player token colors, from the 4 circles in the START corner square
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

// Building levels: 0 = none, 1-3 = hotels, 4 = capital city
export const MAX_LEVEL = 4;
export const LEVEL_NAMES = ['', 'מלון', '2 מלונות', '3 מלונות', 'עיר בירה'];

// Game constants (approved simple rules)
export const RULES = {
  START_CASH: 1500,
  PASS_START_BONUS: 200,
  MAX_ROUNDS: 20,
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  EIN_KNISA_FINE: 100,
  ATZOR_SKIP_TURNS: 2,
  BIRTHDAY_GIFT: 50,
};

/* Tile factory helpers */
const prop = (id, name, cap, price, hotel, capCost, rents, flag, group) => ({
  id, type: 'prop', name, cap, price, hotel, capCost, rents, flag, group,
});
const special = (id, name, sub, amount, art) => ({
  id, type: 'special', name, sub, amount, art,
});
const lotto  = (id) => ({ id, type: 'lotto',  name: 'מפעל הפיס' });
const chance = (id) => ({ id, type: 'chance', name: 'הפתעה' });
const corner = (id, key, name, sub) => ({ id, type: 'corner', key, name, sub });

export const TILES = [
  // 0 - start corner (BL)
  corner(0, 'start', 'התחלה', 'עוברים = מקבלים 200'),

  // 1-8 - left edge, bottom to top
  prop(1, 'ארגנטינה', 'בואנוס איירס', 250, 75, 150, [50, 150, 300, 475, 625], 'AR', 'sa'),
  prop(2, 'צ׳ילה', 'סנטיאגו', 200, 75, 125, [40, 125, 250, 400, 525], 'CL', 'sa'),
  prop(3, 'ברזיל', 'ריו דה ז׳נרו', 350, 100, 175, [75, 200, 400, 625, 900], 'BR', 'sa'),
  chance(4),
  special(5, 'קרנבל', 'שלם 100', -100, 'circus'),
  prop(6, 'קנדה', 'אוטווה', 350, 100, 175, [75, 200, 400, 625, 900], 'CA', 'na'),
  prop(7, 'ארה"ב', 'וושינגטון', 450, 125, 200, [100, 250, 500, 800, 1200], 'US', 'na'),
  lotto(8),

  // 9 - corner (TL)
  corner(9, 'einKnisa', 'אין כניסה', 'שלם 100 כדי לחזור על דרך המלך הראשית'),

  // 10-18 - top edge (play order, left to right on screen)
  chance(10),
  prop(11, 'ישראל', 'ירושלים', 250, 75, 150, [50, 150, 300, 475, 625], 'IL', 'me'),
  prop(12, 'תורכיה', 'אנקרה', 250, 75, 150, [50, 150, 300, 475, 625], 'TR', 'me'),
  prop(13, 'סוריה', 'דמשק', 150, 50, 100, [40, 125, 250, 400, 525], 'SY', 'me'),
  special(14, 'טיול מסביב לעולם', 'שלם דמי נסיעה 50', -50, 'bus'),
  prop(15, 'יפן', 'טוקיו', 300, 100, 150, [60, 175, 350, 550, 700], 'JP', 'ea'),
  prop(16, 'סין', 'בייג׳ין', 400, 125, 175, [80, 225, 450, 700, 1050], 'CN', 'ea'),
  prop(17, 'מונגוליה', 'אולן בטור', 100, 50, 75, [20, 75, 150, 250, 400], 'MN', 'ea'),
  lotto(18),

  // 19 - corner (TR)
  corner(19, 'atzor', 'עצור', '2 סבובים'),

  // 20-27 - right edge, top to bottom
  prop(20, 'דהומי', 'פורטו נובו', 100, 50, 75, [20, 75, 150, 250, 400], 'BJ', 'afr1'),
  prop(21, 'גאנה', 'אקרה', 250, 75, 150, [50, 150, 300, 475, 625], 'GH', 'afr1'),
  chance(22),
  special(23, 'טוס למקום אחר', 'שלם 50', -50, 'plane'),
  prop(24, 'מרוקו', 'רבאט', 150, 50, 100, [30, 100, 200, 325, 475], 'MA', 'nafr'),
  prop(25, 'מצרים', 'קהיר', 250, 75, 150, [50, 150, 300, 475, 625], 'EG', 'nafr'),
  prop(26, 'לוב', 'טריפולי', 100, 50, 75, [20, 75, 150, 250, 400], 'LY', 'nafr'),
  lotto(27),

  // 28 - corner (BR)
  corner(28, 'odPaam', 'שחק עוד פעם', 'שמור על חוקי התנועה'),

  // 29-38 - bottom edge, walking right-to-left (start-corner arrow points UP)
  lotto(29),
  prop(30, 'רומניה', 'בוקרשט', 250, 75, 150, [50, 150, 300, 475, 625], 'RO', 'ee'),
  prop(31, 'ברית המועצות', 'מוסקבה', 450, 125, 200, [100, 250, 500, 800, 1200], 'SU', 'ee'),
  prop(32, 'פולין', 'ורשה', 250, 75, 150, [50, 150, 300, 475, 625], 'PL', 'ee'),
  prop(33, 'צ׳כוסלובקיה', 'פרג', 250, 75, 150, [50, 150, 300, 475, 625], 'CS', 'ee'),
  special(34, 'נסעת במהירות מפרזת', 'שלם קנס 100', -100, 'speed'),
  prop(35, 'יוגוסלביה', 'בלגרד', 250, 75, 150, [50, 150, 300, 475, 625], 'YU', 'se'),
  prop(36, 'איטליה', 'רומא', 250, 75, 150, [50, 150, 300, 475, 625], 'IT', 'se'),
  prop(37, 'יוון', 'אתונה', 200, 75, 125, [40, 125, 250, 400, 525], 'GR', 'se'),
  special(38, 'יום הולדת', 'כל משתתף נותן לך שי 50', 'birthday', 'gift'),
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

// Rent due when landing on an owned property. `levels` maps tileId -> 0..4.
export function rentFor(tile, owners, levels) {
  const lvl = Math.min(levels?.[tile.id] || 0, MAX_LEVEL);
  return tile.rents[lvl];
}

/* ---- price index (מדד המחירים) ----
   Every round each REGION gets a random percentage from the board's index
   table (-50%..+50% in steps of 10). A country's payments scale by its
   region's percentage. */
export const GROUP_REGION = {
  se: 'europe', ee: 'europe',
  na: 'america', sa: 'america',
  me: 'asia', ea: 'asia',
  afr1: 'africa', nafr: 'africa',
};
export const REGION_LABELS = { europe: 'אירופה', america: 'אמריקה', asia: 'אסיה', africa: 'אפריקה' };
export const INDEX_STEPS = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];

export function randomPriceIndex() {
  const pick = () => INDEX_STEPS[Math.floor(Math.random() * INDEX_STEPS.length)];
  return { europe: pick(), america: pick(), asia: pick(), africa: pick() };
}

export function regionOf(tile) {
  return GROUP_REGION[tile.group];
}

// Scale an amount by the tile's region index; rounded to the nearest 5.
export function applyIndex(amount, priceIndex, tile) {
  if (!priceIndex || !tile || tile.type !== 'prop') return amount;
  const pct = priceIndex[regionOf(tile)] || 0;
  if (!pct) return amount;
  return Math.max(5, Math.round((amount * (1 + pct / 100)) / 5) * 5);
}

// Cost to build the NEXT level (current -> current+1), straight off the board:
// hotels 1-3 cost "מחיר המלון"; the capital city costs "עיר הבירה".
export function buildCost(tile, currentLevel) {
  return currentLevel < 3 ? tile.hotel : tile.capCost;
}

// Label of the NEXT build step ('מלון' / 'עיר בירה')
export function nextBuildLabel(currentLevel) {
  return currentLevel < 3 ? 'מלון' : 'עיר בירה';
}
