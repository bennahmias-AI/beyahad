// scripts/gen-greetings.mjs
// ─────────────────────────────────────────────────────────────
// מחולל גרפיקות ברכה (עם טקסט עברי מובנה) דרך Gemini — Nano Banana Pro.
// כל אירוע: עד 20 נוסחים שונים. הפלט: public/ready/<אירוע>/<n>.jpg
//
// הרצה (Windows cmd):
//   cd C:\Users\User\Desktop\beyahad
//   node --env-file=scripts\.env scripts\gen-greetings.mjs            ← כל הקטגוריות
//   node --env-file=scripts\.env scripts\gen-greetings.mjs MAZAL_TOV  ← קטגוריה אחת
//   node --env-file=scripts\.env scripts\gen-greetings.mjs list       ← רשימת מודלים
//
// • מדלג על קבצים שכבר קיימים (אפשר לעצור ולהמשיך — לא משלמים פעמיים).
// • בסוף כל ריצה מעדכן את public/ready/manifest.json (הגלריה קוראת ממנו).
// ─────────────────────────────────────────────────────────────

import fs from 'node:fs'
import path from 'node:path'

const API_KEY = process.env.GEMINI_API_KEY
if (!API_KEY) {
  console.error('\n❌ חסר GEMINI_API_KEY. ודא שהוא בקובץ scripts\\.env והרץ עם --env-file=scripts\\.env\n')
  process.exit(1)
}

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview'
const BASE = 'https://generativelanguage.googleapis.com/v1beta'
const READY_ROOT = path.resolve('public/ready')

// וריאציות סגנון — מתחלפות כדי שכל התמונות באירוע ייראו שונה
const STYLE_VARIANTS = [
  'elegant gold ornaments on a warm rich background, luxurious greeting card',
  'soft watercolor flowers, gentle and delicate',
  'photorealistic scene with warm natural light',
  'colorful paper-cut art, layered and festive',
  'soft pastel gradient with a delicate floral border',
  'bright cheerful illustration with joyful colors',
  'classic ornate frame, refined and traditional',
  'modern clean design with subtle decorative accents',
  'dreamy bokeh lights with soft golden tones',
  'botanical illustration with leaves and blossoms',
]

// קטלוג: לכל אירוע — תווית, נושא ויזואלי (theme), ורשימת נוסחים (עד 20).
const CATALOG = {
  // ════════ ימים ════════
  SHABAT: {
    label: 'שבת שלום',
    theme: 'Shabbat candles, challah bread and wine, warm cozy Friday-evening atmosphere',
    phrases: [
      'שבת שלום ומבורכת', 'שבת של שלום ומנוחה', 'שבת שלום ומנוחה נעימה',
      'שבת מבורכת ומלאת אור', 'שבת שלום לכל המשפחה', 'שבת של שלווה ונחת',
      'שבת שלום ומבורך', 'שבת מנוחה ושמחה', 'שבת שלום ומלאת אהבה',
      'שבת קודש מבורכת', 'שבת שלום וברכה', 'שבת של אור ושמחה',
      'שבת שלום ומנוחה שלמה', 'שבת טובה ומבורכת', 'שבת של נחת ואהבה',
      'שבת שלום וברכה לכל הבית', 'שבת מבורכת ושלווה', 'שבת שלום ומבורכת מכל הלב',
      'שבת של שמחה ובריאות', 'שבת שלום ושבוע טוב',
    ],
  },
  SHAVUA_TOV: {
    label: 'שבוע טוב',
    theme: 'a hopeful calm Israeli morning, gentle sunrise, the start of a new week',
    phrases: [
      'שבוע טוב ומבורך', 'שבוע טוב ומלא הצלחה', 'יום ראשון מבורך ושבוע טוב',
      'שבוע של פרנסה בשפע', 'שבוע טוב ומאושר', 'שבוע טוב מלא בריאות ושמחה',
      'שבוע טוב ושמח', 'שבוע של אור, ברכה ונחת', 'שבוע טוב ומלא אנרגיות טובות',
      'שבוע מבורך ומוצלח', 'שבוע של בשורות טובות', 'שבוע טוב ומלא שמחה',
      'שבוע של שפע והצלחה', 'שבוע טוב ובריא', 'שבוע מבורך לכל המשפחה',
      'שבוע טוב ומלא אהבה', 'שבוע של נחת ואושר', 'שבוע טוב ופורה',
      'שבוע של אור וברכה', 'שבוע טוב ומבורך מכל הלב',
    ],
  },
  YOM_RISHON: {
    label: 'יום ראשון',
    theme: 'a fresh bright morning, soft sunrise, a calm hopeful start of the day',
    phrases: [
      'יום ראשון מבורך', 'יום ראשון טוב ומבורך', 'יום ראשון נעים ומוצלח',
      'בוקר טוב ויום ראשון מבורך', 'יום ראשון של אור ושמחה', 'פתיחת שבוע טובה ומבורכת',
      'יום ראשון מבורך ושבוע טוב', 'יום ראשון נפלא', 'ראשון של התחלות טובות',
      'יום ראשון מבורך ומלא מרץ', 'יום ראשון של שמחה ובריאות', 'יום ראשון טוב ומלא אנרגיה',
      'שבוע טוב — יום ראשון מבורך', 'יום ראשון של אור וברכה', 'יום ראשון מוצלח ופורה',
      'יום ראשון נעים לכל המשפחה', 'בוקר מבורך ויום ראשון טוב', 'יום ראשון של נחת',
      'יום ראשון מבורך ומאושר', 'יום ראשון של בשורות טובות',
    ],
  },
  YOM_SHENI: {
    label: 'יום שני',
    theme: 'a fresh bright morning, soft sunrise, a calm hopeful start of the day',
    phrases: [
      'יום שני שאין שני לו', 'יום שני מבורך', 'יום שני טוב ומבורך',
      'יום שני נעים ומוצלח', 'בוקר טוב ויום שני מבורך', 'יום שני של אור ושמחה',
      'יום שני נפלא', 'יום שני מבורך ומלא מרץ', 'יום שני שאין שני לו — יום נפלא',
      'יום שני של בריאות ושמחה', 'המשך שבוע טוב — יום שני מבורך', 'יום שני טוב ומלא אנרגיה',
      'יום שני של אור וברכה', 'יום שני מוצלח ופורה', 'יום שני נעים לכל המשפחה',
      'יום שני של נחת ואושר', 'יום שני מבורך ומאושר', 'יום שני של בשורות טובות',
      'יום שני יפה ומבורך', 'יום שני שכולו טוב',
    ],
  },
  YOM_SHLISHI: {
    label: 'יום שלישי',
    theme: 'a fresh bright morning, soft sunrise, a calm hopeful start of the day',
    phrases: [
      'יום שלישי פעמיים כי טוב', 'יום שלישי מבורך', 'יום שלישי טוב ומבורך',
      'יום שלישי נעים ומוצלח', 'בוקר טוב ויום שלישי מבורך', 'יום שלישי של אור ושמחה',
      'יום שלישי כי טוב פעמיים', 'יום שלישי נפלא', 'יום שלישי מבורך ומלא מרץ',
      'יום שלישי של בריאות ושמחה', 'יום שלישי — כי טוב, כי טוב', 'יום שלישי טוב ומלא אנרגיה',
      'יום שלישי של אור וברכה', 'יום שלישי מוצלח ופורה', 'יום שלישי נעים לכל המשפחה',
      'יום שלישי של נחת ואושר', 'יום שלישי מבורך ומאושר', 'יום שלישי של בשורות טובות',
      'יום שלישי שכולו טוב כפול', 'יום שלישי יפה ומבורך',
    ],
  },
  YOM_RVII: {
    label: 'יום רביעי',
    theme: 'a fresh bright morning, soft sunrise, a calm hopeful start of the day',
    phrases: [
      'יום רביעי מבורך', 'יום רביעי טוב ומבורך', 'יום רביעי נעים ומוצלח',
      'בוקר טוב ויום רביעי מבורך', 'יום רביעי של אור ושמחה', 'אמצע השבוע — יום רביעי מבורך',
      'יום רביעי נפלא', 'יום רביעי מבורך ומלא מרץ', 'יום רביעי של בריאות ושמחה',
      'המשך שבוע טוב — יום רביעי מבורך', 'יום רביעי טוב ומלא אנרגיה', 'יום רביעי של אור וברכה',
      'יום רביעי מוצלח ופורה', 'יום רביעי נעים לכל המשפחה', 'יום רביעי של נחת ואושר',
      'יום רביעי מבורך ומאושר', 'יום רביעי של בשורות טובות', 'יום רביעי יפה ומבורך',
      'יום רביעי שכולו טוב', 'חצי שבוע עבר — יום רביעי מבורך',
    ],
  },
  YOM_CHAMISHI: {
    label: 'יום חמישי',
    theme: 'a fresh bright morning, soft sunrise, a calm hopeful start of the day',
    phrases: [
      'יום חמישי מבורך', 'יום חמישי טוב ומבורך', 'יום חמישי נעים ומוצלח',
      'בוקר טוב ויום חמישי מבורך', 'יום חמישי של אור ושמחה', 'עוד מעט שבת — יום חמישי מבורך',
      'יום חמישי נפלא', 'יום חמישי מבורך ומלא מרץ', 'יום חמישי של בריאות ושמחה',
      'יום חמישי וכבר מריחים שבת', 'יום חמישי טוב ומלא אנרגיה', 'יום חמישי של אור וברכה',
      'יום חמישי מוצלח ופורה', 'יום חמישי נעים לכל המשפחה', 'יום חמישי של נחת ואושר',
      'יום חמישי מבורך ומאושר', 'יום חמישי של בשורות טובות', 'יום חמישי יפה ומבורך',
      'יום חמישי שכולו טוב', 'סוף השבוע מתקרב — יום חמישי מבורך',
    ],
  },

  // ════════ חגים ════════
  ROSH_HASHANA: {
    label: 'ראש השנה',
    theme: 'apples and honey, pomegranates, Rosh Hashana symbols, festive autumn',
    phrases: [
      'שנה טובה ומתוקה', 'שנה טובה ומבורכת', 'כתיבה וחתימה טובה',
      'שנה טובה ומלאת בריאות', 'שנה של אושר ונחת', 'לשנה טובה תכתבו ותחתמו',
      'שנה טובה לכל המשפחה', 'שנה מתוקה כדבש', 'שנה טובה ומאושרת',
      'שנה של שפע וברכה', 'שנה טובה ושקטה', 'שנה טובה ומלאת שמחה',
      'שתהא שנה של בריאות ואהבה', 'שנה טובה ופורייה', 'שנה של הגשמה ונחת',
      'שנה טובה ומתוקה לכל הבית', 'שנה של אור וברכה', 'שנה טובה ומבורכת מכל הלב',
      'שנה של בשורות טובות', 'שנה טובה ושלום',
    ],
  },
  YOM_KIPUR: {
    label: 'יום כיפור',
    theme: 'serene white and gold, doves, a pure and solemn atmosphere',
    phrases: [
      'גמר חתימה טובה', 'צום קל ומועיל', 'גמר חתימה טובה לכל המשפחה',
      'שתיכתבו לחיים טובים', 'צום מועיל וגמר חתימה טובה', 'חתימה טובה ושנה מבורכת',
      'גמר חתימה טובה ומבורכת', 'שנה טובה וגמר חתימה טובה', 'צום קל וגמר חתימה טובה',
      'שתיחתמו לשנה טובה', 'גמר חתימה טובה ומאושרת', 'יום כיפור — גמר חתימה טובה',
      'צום קל לכל המשפחה', 'גמר חתימה טובה ובריאות', 'שנה של סליחה וברכה',
      'גמר חתימה טובה ושלום', 'צום מועיל וקל', 'חתימה טובה לחיים טובים',
      'גמר חתימה טובה מכל הלב', 'שתזכו לשנה טובה',
    ],
  },
  SUKOT: {
    label: 'סוכות',
    theme: 'a decorated sukkah, the four species (lulav and etrog), autumn harvest',
    phrases: [
      'חג סוכות שמח', 'מועדים לשמחה', 'חג סוכות שמח ומבורך',
      'חג שמח לכל המשפחה', 'חג סוכות שמח ומאושר', 'מועדים לשמחה וחג שמח',
      'חג האסיף שמח', 'סוכות שמח ומבורך', 'חג סוכות שמח ושמח',
      'מועדים לשמחה ולנחת', 'חג סוכות שמח ובריא', 'זמן שמחתנו — חג שמח',
      'חג סוכות שמח ומלא אור', 'סוכות שמח לכל הבית', 'חג של שמחה וברכה',
      'מועדים לשמחה ואהבה', 'חג סוכות שמח ומתוק', 'חג שמח ומבורך',
      'סוכות של שמחה ונחת', 'חג סוכות שמח מכל הלב',
    ],
  },
  CHANUKA: {
    label: 'חנוכה',
    theme: 'a glowing menorah (hanukkiah), candles and sufganiyot, festival of lights',
    phrases: [
      'חנוכה שמח', 'חג אורים שמח', 'חנוכה שמח ומואר',
      'חג חנוכה שמח ומבורך', 'שיאיר לכם אור הנרות', 'חנוכה שמח לכל המשפחה',
      'חג אורים שמח ומאושר', 'חנוכה שמח ומלא אור', 'חג אורים שמח ומבורך',
      'נס גדול היה פה — חנוכה שמח', 'חנוכה שמח ומתוק', 'שמונה נרות של אור ושמחה',
      'חג החנוכה שמח ומואר', 'חנוכה שמח לכל הבית', 'חג של אור וברכה',
      'חנוכה שמח ומלא נסים', 'חג אורים שמח ונחת', 'חנוכה שמח ושמח',
      'אור גדול לכל המשפחה — חנוכה שמח', 'חנוכה שמח מכל הלב',
    ],
  },
  PURIM: {
    label: 'פורים',
    theme: 'colorful masks, hamantaschen, mishloach manot, a joyful carnival',
    phrases: [
      'פורים שמח', 'חג פורים שמח', 'פורים שמח ומבורך',
      'חג פורים שמח ומלא שמחה', 'פורים שמח לכל המשפחה', 'משלוח מנות שמח',
      'פורים שמח ומאושר', 'חג פורים שמח וצוהל', 'פורים שמח ומלא צחוק',
      'חג של שמחה ומשתה', 'פורים שמח ומתוק', 'ונהפוך הוא — פורים שמח',
      'פורים שמח ומלא משלוחי מנות', 'חג פורים שמח ושמח', 'פורים שמח לכל הבית',
      'חג של שמחה וברכה', 'פורים שמח ומלא תחפושות', 'משתה ושמחה — פורים שמח',
      'פורים שמח ומבורך מכל הלב', 'חג פורים צוהל ושמח',
    ],
  },
  PESACH: {
    label: 'פסח',
    theme: 'a Passover seder table, matzah, spring flowers, a freedom and spring theme',
    phrases: [
      'חג פסח כשר ושמח', 'פסח שמח', 'חג פסח כשר ושמח לכל המשפחה',
      'מועדים לשמחה — פסח שמח', 'חג האביב שמח', 'חג פסח שמח ומבורך',
      'פסח כשר ושמח', 'חג חירות שמח', 'חג פסח כשר ושמח ומאושר',
      'זמן חירותנו — חג שמח', 'פסח שמח ומלא אביב', 'חג פסח כשר ושמח ושמח',
      'חג של חירות ושמחה', 'פסח שמח לכל הבית', 'חג האביב שמח ומבורך',
      'מועדים לשמחה ולחירות', 'פסח כשר ושמח ומתוק', 'חג פסח שמח ובריא',
      'חג חירות שמח ומבורך', 'פסח שמח מכל הלב',
    ],
  },
  SHAVUOT: {
    label: 'שבועות',
    theme: 'dairy foods, wheat fields, flowers and a Torah scroll, late spring',
    phrases: [
      'חג שבועות שמח', 'חג מתן תורה שמח', 'שבועות שמח ומבורך',
      'חג שבועות שמח לכל המשפחה', 'חג הביכורים שמח', 'מועדים לשמחה — שבועות שמח',
      'שבועות שמח ומאושר', 'חג שבועות שמח ומתוק', 'זמן מתן תורתנו — חג שמח',
      'חג שבועות שמח ושמח', 'שבועות שמח ומלא אור', 'חג של תורה ושמחה',
      'שבועות שמח לכל הבית', 'חג הביכורים שמח ומבורך', 'חג של שמחה וברכה',
      'שבועות שמח ונחת', 'חג שבועות שמח ובריא', 'מועדים לשמחה ואהבה',
      'חג מתן תורה שמח ומבורך', 'שבועות שמח מכל הלב',
    ],
  },

  // ════════ איחולים ════════
  MAZAL_TOV: {
    label: 'מזל טוב',
    theme: 'celebration, confetti and flowers, festive joyful atmosphere',
    phrases: [
      'מזל טוב', 'מזל טוב ואיחולים', 'בשעה טובה ומוצלחת',
      'מזל טוב מכל הלב', 'מזל טוב ואושר רב', 'מזל טוב והרבה נחת',
      'מזל טוב ובהצלחה', 'איחולים חמים ומזל טוב', 'מזל טוב ושפע ברכות',
      'מזל טוב ובשורות טובות', 'מזל טוב ושמחה רבה', 'בשעה טובה ומבורכת',
      'מזל טוב ואיחולים חמים', 'מזל טוב מכל הלב והנשמה', 'מזל טוב והרבה אהבה',
      'מזל טוב ורוב נחת', 'מזל טוב לשמחה', 'מזל טוב ואושר אין סופי',
      'מזל טוב ובריאות איתנה', 'מזל טוב ויום מאושר',
    ],
  },
  YOM_HULEDET: {
    label: 'יום הולדת',
    theme: 'a birthday cake, balloons and candles, a festive celebration',
    phrases: [
      'יום הולדת שמח', 'מזל טוב ויום הולדת שמח', 'יום הולדת שמח ומאושר',
      'יום הולדת שמח ובריאות', 'שנת חיים טובה', 'יום הולדת שמח לאדם יקר',
      'חוגגים אותך — יום הולדת שמח', 'יום הולדת שמח ומלא אושר', 'יום הולדת שמח ומתוק',
      'מאחלים לך שנה נפלאה', 'יום הולדת שמח ושמח', 'הרבה בריאות ואושר ביום הולדתך',
      'יום הולדת שמח ומלא אהבה', 'שיהיה יום מיוחד — יום הולדת שמח', 'יום הולדת שמח ושנה טובה',
      'יום הולדת שמח ומלא הפתעות', 'מזל טוב ביום הולדתך', 'יום הולדת שמח ושנת אושר',
      'הרבה שמחה ביום הולדתך', 'יום הולדת שמח מכל הלב',
    ],
  },
  REFUA_SHLEMA: {
    label: 'רפואה שלמה',
    theme: 'gentle soothing flowers, soft calming colors, a warm get-well feeling',
    phrases: [
      'רפואה שלמה', 'רפואה שלמה ומהירה', 'החלמה מהירה ובריאות',
      'רפואה שלמה מכל הלב', 'בריאות איתנה ורפואה שלמה', 'רפואה שלמה והחלמה מהירה',
      'שתבריאו במהרה', 'רפואה שלמה ומלאה', 'מאחלים לך החלמה מהירה',
      'רפואה שלמה וחזרה לאיתנך', 'בריאות ואיתנות — רפואה שלמה', 'רפואה שלמה ומהירה מכל הלב',
      'שתרגישו טוב במהרה', 'רפואה שלמה ובריאות איתנה', 'החלמה מהירה ושלמה',
      'רפואה שלמה וכוח להחלים', 'מחשבות טובות ורפואה שלמה', 'רפואה שלמה ובשורות טובות',
      'שתשובו לבריאות במהרה', 'רפואה שלמה ונחת',
    ],
  },
  BEHATZLACHA: {
    label: 'בהצלחה',
    theme: 'an uplifting sunrise and a path forward, encouraging and hopeful',
    phrases: [
      'בהצלחה', 'בהצלחה רבה', 'הצלחה ושפע',
      'בהצלחה בכל הדרך', 'בהצלחה ובשורות טובות', 'שיהיה במזל ובהצלחה',
      'בהצלחה רבה ואיחולים', 'הצלחה וברכה', 'בהצלחה ובהרבה כוח',
      'שתצליחו בכל אשר תעשו', 'בהצלחה ובמזל טוב', 'בהצלחה רבה מכל הלב',
      'הצלחה ושמחה', 'בהצלחה והרבה אושר', 'בהצלחה בכל המשימות',
      'שתלך לכם הדרך בהצלחה', 'בהצלחה ובהגשמה', 'הצלחה גדולה ומבורכת',
      'בהצלחה ומלא אנרגיות טובות', 'בהצלחה ובכל הטוב',
    ],
  },
  BEAHAVA: {
    label: 'באהבה',
    theme: 'hearts and roses, warm affectionate tones',
    phrases: [
      'באהבה', 'באהבה רבה', 'מכל הלב באהבה',
      'חושבים עליך באהבה', 'אוהבים אותך', 'באהבה ובהוקרה',
      'שלוחה באהבה', 'באהבה גדולה', 'באהבה ובחיבוק חם',
      'מחשבות אוהבות אליך', 'באהבה אין סופית', 'באהבה ובהערכה רבה',
      'אוהבים אותך מאוד', 'באהבה ובנחת', 'שלוחה באהבה ובחום',
      'באהבה ובברכה', 'מכל הלב ובאהבה', 'באהבה ובחיוך',
      'חיבוק גדול באהבה', 'באהבה ובהרבה אושר',
    ],
  },
  TODA: {
    label: 'תודה רבה',
    theme: 'a bouquet of flowers, a warm thank-you gesture, gratitude',
    phrases: [
      'תודה רבה', 'תודה מכל הלב', 'תודה רבה ויקרה',
      'תודה על הכול', 'תודה רבה ומעריכים', 'תודה גדולה',
      'תודה ובהוקרה', 'תודה רבה לך', 'תודה מקרב לב',
      'תודה על האהבה והנתינה', 'תודה רבה ומלא הערכה', 'תודה ענקית מכל הלב',
      'תודה על הכול ובאהבה', 'תודה רבה ומבורכת', 'תודה ויישר כוח',
      'תודה רבה ונחת', 'תודה מעומק הלב', 'תודה רבה ומלא אהבה',
      'תודה על שאתם בחיי', 'תודה רבה ושפע ברכות',
    ],
  },
}

function buildPrompt(phrase, theme, variant) {
  return (
    `Create a beautiful, high-quality square Hebrew greeting card. ` +
    `The MAIN focus is the Hebrew text "${phrase}" — render it EXACTLY as written here, ` +
    `with perfectly correct Hebrew letters, right-to-left, large, elegant and clearly legible. ` +
    `Do NOT add any other words, letters, or gibberish — ONLY the exact phrase "${phrase}". ` +
    `Scene / subject: ${theme}. Visual style: ${variant}. ` +
    `Warm, festive, beautiful, suitable for Israeli seniors. Square 1:1 format, no watermark.`
  )
}

async function listModels() {
  try {
    const r = await fetch(`${BASE}/models?key=${API_KEY}`)
    const j = await r.json()
    console.log('\n📋 המודלים הזמינים למפתח שלך:')
    for (const m of (j.models || [])) {
      console.log(`   ${m.name}   [${(m.supportedGenerationMethods || []).join(', ')}]`)
    }
    console.log('')
  } catch (e) {
    console.error('כשל בקבלת רשימת המודלים:', e.message)
  }
}

async function genOne(phrase, theme, variant, file, i) {
  const body = { contents: [{ parts: [{ text: buildPrompt(phrase, theme, variant) }] }] }
  let r = await fetch(`${BASE}/models/${MODEL}:generateContent?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  if (!r.ok) {
    const errText = await r.text()
    if (/modal/i.test(errText)) {
      const body2 = { ...body, generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }
      r = await fetch(`${BASE}/models/${MODEL}:generateContent?key=${API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body2),
      })
    } else {
      console.error(`\n❌ שגיאה (${r.status}) במודל "${MODEL}":\n${errText.slice(0, 700)}`)
      if (r.status === 404) await listModels()
      // לא יוצאים — ממשיכים לנסות את הבא (כדי שתקלה בודדת לא תפיל הכל)
      return false
    }
  }
  if (!r.ok) {
    console.error(`   ⚠️ דילוג על "${phrase}" (${r.status})`)
    return false
  }

  const j = await r.json()
  const parts = j?.candidates?.[0]?.content?.parts || []
  const img = parts.find(p => p.inlineData)?.inlineData
  if (!img) {
    console.error(`   ⚠️ לא חזרה תמונה ל"${phrase}"`)
    return false
  }
  fs.writeFileSync(file, Buffer.from(img.data, 'base64'))
  console.log(`   ✓ [${i + 1}] "${phrase}"`)
  return true
}

// סורק את public/ready ובונה manifest { id: count } (סופר n.jpg רצופים מ-1)
function writeManifest() {
  const manifest = {}
  if (fs.existsSync(READY_ROOT)) {
    for (const id of fs.readdirSync(READY_ROOT)) {
      const dir = path.join(READY_ROOT, id)
      try { if (!fs.statSync(dir).isDirectory()) continue } catch { continue }
      let count = 0
      while (fs.existsSync(path.join(dir, `${count + 1}.jpg`))) count++
      if (count > 0) manifest[id] = count
    }
  }
  fs.writeFileSync(path.join(READY_ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log('\n📝 manifest.json עודכן:', JSON.stringify(manifest))
}

// ── ריצה ──
const arg = process.argv[2]
if (arg === 'list') { await listModels(); process.exit(0) }

const ids = arg ? [arg] : Object.keys(CATALOG)
for (const id of ids) {
  const occ = CATALOG[id]
  if (!occ) {
    console.error(`\n❌ אירוע לא מוכר: "${id}".\nאפשרויות:\n  ${Object.keys(CATALOG).join('  ')}\n`)
    process.exit(1)
  }
  const dir = path.join(READY_ROOT, id)
  fs.mkdirSync(dir, { recursive: true })
  console.log(`\n=== ${occ.label} (${id}) — מודל ${MODEL} ===`)
  for (let i = 0; i < occ.phrases.length; i++) {
    const file = path.join(dir, `${i + 1}.jpg`)
    if (fs.existsSync(file)) { console.log(`   ⏭️  כבר קיים: ${i + 1}.jpg`); continue }
    await genOne(occ.phrases[i], occ.theme, STYLE_VARIANTS[i % STYLE_VARIANTS.length], file, i)
    await new Promise(res => setTimeout(res, 2000))
  }
  writeManifest() // מעדכן אחרי כל קטגוריה (כדי שהגלריה תתעדכן גם אם נעצור באמצע)
}

console.log('\n✅ סיום!\n')
