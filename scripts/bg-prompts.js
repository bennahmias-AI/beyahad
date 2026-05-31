// scripts/bg-prompts.js
// ─────────────────────────────────────────────────────────────
// הגדרת הקטגוריות והפרומפטים ליצירת רקעי ברכה אוטומטית.
//
// מבנה: כל קטגוריה = תיקייה אחת, עם רשימת "variants" (סצנות).
//   dir       — שם התיקייה תחת public/backgrounds/
//   label     — שם עברי (לתיעוד)
//   variants  — רשימת סצנות, כל אחת { prompt, count }
//   startFrom — אופציונלי: מספר הקובץ הראשון (ברירת מחדל: 1)
//
// גיוון: כל סצנה מקבלת מקום שונה מרשימת PLACES — כך כל תמונה
//        שונה מהותית מקודמתה, גם כשהנושא זהה.
//
// חשוב: SHAVUA TOV לא מופיעה כאן בכוונה — אסור לגעת בה.
// SHABAT — 10 התמונות הראשונות (1.png-10.png) נוצרו ידנית, אסור לגעת בהן.
//          הסקריפט מתחיל מ-11.png כדי לא לדרוס את הקיימות.
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
  // ═══════════ שבוע טוב — 10 פרחים ריאליסטיים (מתחיל מ-16.png, לא דורס את 1-15 הקיימות) ═══════════
  {
    dir: 'SHAVUA TOV',
    label: 'שבוע טוב',
    startFrom: 16,
    variants: [
      { prompt: realistic(
        'a beautiful real bouquet of fresh colorful spring flowers — roses, tulips and daisies in pink, peach, yellow and white — arranged along the bottom, soft natural light, professional floral photography.',
        'a bright soft-lit table with a fresh flower bouquet'
      ), count: 1 },
      { prompt: realistic(
        'a real field of blooming wildflowers and red poppies stretching across the lower area, soft golden morning sunlight, dreamy shallow depth of field, fresh and peaceful.',
        'a sunlit wildflower meadow at golden hour'
      ), count: 1 },
      { prompt: realistic(
        'a lush real arrangement of pink and white peonies and roses overflowing from the lower corners, delicate petals, soft romantic natural light, elegant and abundant.',
        'an elegant peony and rose arrangement close-up'
      ), count: 1 },
      { prompt: realistic(
        'a real purple lavender field at the bottom under a soft bright sky, gentle natural light, calm and serene, professional landscape photography.',
        'a blooming lavender field in soft daylight'
      ), count: 1 },
      { prompt: realistic(
        'a charming real wicker basket overflowing with fresh garden flowers — sunflowers, roses, daisies and greenery — placed at the bottom, warm sunny natural light, cheerful and full.',
        'a flower basket bursting with fresh blooms'
      ), count: 1 },
      { prompt: realistic(
        'fresh real cherry blossom and almond branches with soft pink and white petals arching from the lower edges, bright airy natural light, delicate spring feeling.',
        'blossoming spring branches against a soft bright sky'
      ), count: 1 },
      { prompt: realistic(
        'a vibrant real summer garden in bloom across the lower half — orange marigolds, pink dahlias and blue cornflowers — rich greenery, warm sunny light, joyful and colorful.',
        'a colorful blooming summer garden bed'
      ), count: 1 },
      { prompt: realistic(
        'a soft real bouquet of white and cream roses with eucalyptus greenery along the bottom, gentle elegant natural light, delicate and refined, professional photography.',
        'an elegant white rose bouquet in soft light'
      ), count: 1 },
      { prompt: realistic(
        'a bright real sunflower field at the bottom under a clear soft sky, warm golden sunlight, cheerful and uplifting, professional landscape photography.',
        'a sunflower field glowing in warm sunlight'
      ), count: 1 },
      { prompt: realistic(
        'a real spring garden path lined with abundant colorful flowers along the lower edges, soft morning light, fresh dewy petals, peaceful and inviting.',
        'a flower-lined garden path in gentle morning light'
      ), count: 1 },
    ],
  },

  // ═══════════ שבת — 20 תוספות (16 ריאליסטי + 4 מצויר) ═══════════
  // מתחיל מ-11.png — 10 הראשונות לא יידרסו
  {
    dir: 'SHABAT',
    label: 'שבת שלום',
    startFrom: 11,
    variants: [
      // ── שולחן שבת ואוכל (6 ריאליסטי) ──
      { prompt: realistic(
        'a traditional shabbat dinner table set beautifully, two challah breads covered with an embroidered white cloth, lit candles in silver candlesticks, a silver kiddush cup with red wine, warm soft candlelight.',
        'a cozy festive dining room with warm wooden tones'
      ), count: 1 },
      { prompt: realistic(
        'an elegant modern shabbat table, minimalist beautiful setting with white plates, fresh white flowers in a vase, two tall candles, soft natural light from a window.',
        'a bright modern dining room with clean lines'
      ), count: 1 },
      { prompt: realistic(
        'two freshly baked golden challah breads close-up, steam rising, sesame seeds on top, beautiful braided texture, warm golden crust.',
        'a rustic wooden kitchen surface with soft natural light'
      ), count: 1 },
      { prompt: realistic(
        'a winter shabbat dinner table, warm hearty soup, challah, candles glowing, intimate cozy atmosphere with deep warm tones.',
        'a warm dining room on a cold winter evening, soft lamp light'
      ), count: 1 },
      { prompt: realistic(
        'kiddush scene, a beautiful silver kiddush cup overflowing with red wine, covered challah breads beside it, soft elegant lighting.',
        'an elegant shabbat dinner table with white tablecloth'
      ), count: 1 },
      { prompt: realistic(
        'a shabbat morning lunch table, traditional cholent and kugel in beautiful serving dishes, salads, fresh challah, abundance of food, warm bright daylight.',
        'a sunny dining room mid-morning with white tablecloth'
      ), count: 1 },

      // ── בית כנסת (4 ריאליסטי) ──
      { prompt: realistic(
        'inside a beautiful traditional synagogue, ornate ark with torah scrolls behind a velvet curtain, wooden benches, warm soft light streaming through windows, peaceful sacred atmosphere.',
        'a classic ashkenazi synagogue interior'
      ), count: 1 },
      { prompt: realistic(
        'a beautiful jerusalem synagogue interior, jerusalem stone walls, oil menorah burning, soft spiritual light, ancient atmosphere with golden warm tones.',
        'an old jerusalem synagogue with stone walls'
      ), count: 1 },
      { prompt: realistic(
        'a synagogue at friday evening, view toward the bimah and ark, warm candles glowing, soft golden light, serene shabbat eve atmosphere.',
        'a synagogue interior at dusk just before kabbalat shabbat'
      ), count: 1 },
      { prompt: realistic(
        'a beautiful sephardic synagogue, oriental decorations in burgundy and gold, ornate tiles, hanging brass lamps, warm rich colors and atmosphere.',
        'a sephardic synagogue interior with traditional decor'
      ), count: 1 },

      // ── חופש ושלווה (4 ריאליסטי) ──
      { prompt: realistic(
        'a peaceful green valley landscape at the golden hour of friday afternoon, rolling hills, soft warm light, calm and inviting nature scene welcoming shabbat.',
        'a wide open israeli countryside valley at sunset'
      ), count: 1 },
      { prompt: realistic(
        'a quiet seaside promenade at sunset on friday afternoon, gentle waves, soft pink and gold sky, peaceful weekend mood.',
        'a tel aviv style mediterranean beach at golden hour'
      ), count: 1 },
      { prompt: realistic(
        'a serene mountain landscape with morning mist, soft light, restful natural beauty perfect for shabbat morning.',
        'the galilee mountains at dawn with golden mist'
      ), count: 1 },
      { prompt: realistic(
        'a peaceful path through an old olive grove, ancient olive trees, soft israeli countryside light, biblical pastoral atmosphere.',
        'an olive grove in the judean hills, late afternoon'
      ), count: 1 },

      // ── מסורת וסמלים (2 ריאליסטי) ──
      { prompt: realistic(
        'two shabbat candles burning peacefully in elegant silver candlesticks, a beautifully embroidered head covering nearby, soft intimate candlelight against a dark blurred background.',
        'a quiet corner with candles glowing in the evening'
      ), count: 1 },
      { prompt: realistic(
        'an open prayer book (siddur) on a wooden table, soft warm light from a side window, peaceful spiritual atmosphere with golden tones.',
        'a study room with wooden table and open siddur'
      ), count: 1 },

      // ── הדגמה (4 מצויר) ──
      { prompt: illustrated(
        'a warmly illustrated shabbat table from above, two braided challah breads, kiddush wine cup, lit candles, gentle pastel watercolor style, peaceful welcoming atmosphere.',
        'a soft watercolor flat-lay of a shabbat table'
      ), count: 1 },
      { prompt: illustrated(
        'a soft illustrated scene of two glowing shabbat candles with golden flames, decorative floral border in pastels, gentle dreamy mood.',
        'an illustrated candles scene with watercolor flowers'
      ), count: 1 },
      { prompt: illustrated(
        'an illustrated jerusalem cityscape at friday sunset, jerusalem stone houses, soft pink and gold sky, peaceful pastel watercolor style.',
        'a stylized illustration of the jerusalem old city skyline'
      ), count: 1 },
      { prompt: illustrated(
        'a gentle illustration of a covered braided challah on a beautiful tray with grape vines and wheat decorations, warm cream and gold pastel palette, elegant traditional style.',
        'a flat decorative composition of challah with wheat and grapes'
      ), count: 1 },
    ],
  },

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
