// scripts/bg-prompts.js
// ─────────────────────────────────────────────────────────────
// הגדרת הקטגוריות והפרומפטים ליצירת רקעי ברכה אוטומטית.
//
// מבנה: כל קטגוריה = תיקייה אחת, עם רשימת "variants" (סצנות).
//   dir      — שם התיקייה תחת public/backgrounds/
//   label    — שם עברי (לתיעוד)
//   variants — רשימת סצנות, כל אחת { prompt, count }
//
// גיוון: כל סצנה מקבלת מקום שונה מרשימת PLACES — כך כל תמונה
//        שונה מהותית מקודמתה, גם כשהנושא זהה.
//
// חשוב: SHABAT ו-SHAVUA TOV לא מופיעות כאן בכוונה — אסור לגעת בהן.
// ─────────────────────────────────────────────────────────────

// ── תבנית סגנון מצויר ──
const illustrated = (theme, place) =>
  'Soft illustrated greeting card background, warm pastel colors, ' +
  'gentle flat vector style, cozy and elegant. ' +
  'Large clean empty space in the upper-center area reserved for text. ' +
  'Decorative elements only along the bottom and edges. ' +
  'Square 1:1 composition. ' +
  `Theme: ${theme} ` +
  `Setting: ${place} ` +
  'IMPORTANT: no text, no letters, no words, no people, no hands.'

// ── תבנית סגנון ריאליסטי (צילומי) ──
const realistic = (theme, place) =>
  'Beautiful realistic photograph, soft natural lighting, shallow depth of field, ' +
  'warm and inviting atmosphere, high quality professional photography. ' +
  'The upper-center area is soft, bright and uncluttered, leaving clean empty space for text. ' +
  'Main subjects positioned along the bottom and edges. ' +
  'Square 1:1 composition. ' +
  `Theme: ${theme} ` +
  `Setting: ${place} ` +
  'IMPORTANT: no text, no letters, no words, no people, no hands.'

// ── רשימת מקומות גנרית — משותפת לכל הקטגוריות ──
const PLACES = [
  'an open green field with rolling hills and wildflowers',
  'a calm desert landscape at soft dawn, golden sand dunes',
  'a peaceful sea shore with gentle waves and soft sky',
  'inside a beautiful synagogue with warm light through windows',
  'an old Jerusalem stone city street at sunrise',
  'a blooming spring garden full of flowers',
  'green mountains with morning mist and soft light',
  'a cozy room with a sunlit window and plants',
  'a quiet park with trees and a winding path',
  'a rural countryside path among olive trees',
]

// עוזר: בונה קטגוריה עם גיוון מקומות בסגנון נתון.
// styleFn = illustrated או realistic.
const makeVariedCategory = (dir, label, theme, styleFn = realistic, places = PLACES) => ({
  dir,
  label,
  variants: places.map(place => ({
    prompt: styleFn(theme, place),
    count: 1,
  })),
})

export const CATEGORIES = [
  // ═══════════ ימים ═══════════
  makeVariedCategory('YOM_RISHON', 'יום ראשון',
    'a hopeful fresh start of a new week, gentle morning light, optimistic and peaceful mood.'),

  makeVariedCategory('YOM_SHENI', 'יום שני',
    'a calm and productive day, gentle natural light, peaceful encouraging mood.'),

  makeVariedCategory('YOM_SHLISHI', 'יום שלישי',
    'a pleasant mid-week day, soft daylight, calm and uplifting mood.'),

  makeVariedCategory('YOM_RVII', 'יום רביעי',
    'a bright midweek day, warm sunlight, cozy and motivating mood.'),

  makeVariedCategory('YOM_CHAMISHI', 'יום חמישי',
    'an almost-weekend day, warm golden light, pleasant anticipation and joy.'),

  // ═══════════ חגים ═══════════
  makeVariedCategory('ROSH_HASHANA', 'ראש השנה',
    'jewish new year, pomegranates apples and honey, autumn warm festive sweet mood.'),

  makeVariedCategory('YOM_KIPUR', 'יום כיפור',
    'yom kippur, white and gold, serene spiritual and calm respectful atmosphere.'),

  makeVariedCategory('SUKOT', 'סוכות',
    'sukkot holiday, decorated sukkah, the four species, autumn fruits, warm festive mood.'),

  makeVariedCategory('CHANUKA', 'חנוכה',
    'hanukkah, a glowing menorah with candles, blue and gold, cozy winter warmth.'),

  makeVariedCategory('PURIM', 'פורים',
    'purim celebration, colorful masks and hamantaschen, confetti, joyful playful mood.'),

  makeVariedCategory('PESACH', 'פסח',
    'passover, matzah and spring flowers, a seder plate, fresh renewal warm holiday mood.'),

  makeVariedCategory('SHAVUOT', 'שבועות',
    'shavuot, dairy foods and cheesecake, wheat fields and fresh flowers, green spring abundance.'),

  // ═══════════ איחולים ═══════════
  makeVariedCategory('MAZAL_TOV', 'מזל טוב',
    'congratulations celebration, confetti and balloons, festive sparkle, joyful warm mood.'),

  makeVariedCategory('YOM_HULEDET', 'יום הולדת',
    'happy birthday, a decorated cake with candles, balloons and gifts, cheerful festive colorful mood.'),

  makeVariedCategory('REFUA_SHLEMA', 'רפואה שלמה',
    'get well soon, gentle flowers, soft soothing colors, caring warm comforting atmosphere.'),

  makeVariedCategory('BEHATZLACHA', 'בהצלחה',
    'good luck and success, a sunrise over a path, uplifting bright encouraging hopeful mood.'),

  makeVariedCategory('BEAHAVA', 'באהבה',
    'with love, soft hearts and roses, warm romantic pastel tones, tender affectionate mood.'),

  makeVariedCategory('TODA', 'תודה רבה',
    'thank you, a warm bouquet of flowers, soft grateful tones, heartfelt appreciative atmosphere.'),
]
