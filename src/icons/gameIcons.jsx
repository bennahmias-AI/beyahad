// src/icons/gameIcons.jsx
// ─────────────────────────────────────────────────────────────
// אייקונים מותאמים אישית למשחקים בזירת המשחקים.
//
// כל אייקון מצויר ב-SVG ידנית — לא מהמאגר הסטנדרטי שלנו, כדי
// שכל משחק יקבל את החזות המאפיינת אותו (כדור ביליארד לבינגו,
// קוביה לשש-בש, סידור מרובע לוורדל, וכו').
//
// שימוש:
//   <GameIcon id="bingo" size={64} />
//
// המעטפת לבנה (W) קבועה — מותאמת לרקעי הצבע הצבעוניים של הכרטיסים.
// ─────────────────────────────────────────────────────────────

const W = '#FBF7EE'  // הצבע הלבן הקרמי של ביחד
const DARK = '#1B2540'

// ── עוטף משותף: מצייר את כל ה-SVG בתוך viewBox של 64×64 ──
function IconWrap({ size = 64, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none"
         xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  )
}

// ── 🎱 בינגו — כדור עם הכיתוב BINGO ──
// כדור גדול לבן (כמו כדורי לוטו) עם הסרט הלבן המאופיין במרכז עליו כתוב BINGO.
function BingoIcon({ size }) {
  return (
    <IconWrap size={size}>
      {/* הכדור הראשי — לבן עם הילה כדורית */}
      <circle cx="32" cy="32" r="22" fill={W} />
      {/* הילת אור עליונה (נותנת תחושה תלת-ממדית) */}
      <ellipse cx="26" cy="22" rx="8" ry="5" fill="rgba(255,255,255,0.6)" />
      {/* צל תחתון (נותן עומק) */}
      <ellipse cx="36" cy="44" rx="10" ry="5" fill={DARK} fillOpacity="0.08" />
      {/* הסרט המרכזי שעליו כתוב BINGO */}
      <path d="M11 30 A 22 22 0 0 0 53 30 L 53 34 A 22 22 0 0 1 11 34 Z"
            fill={DARK} />
      {/* הטקסט BINGO על הסרט */}
      <text x="32" y="35.5" textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontSize="7" fontWeight="900" fill={W} letterSpacing="0.5">BINGO</text>
    </IconWrap>
  )
}

// ── 🎲 שש-בש — 2 קוביות (כמו במשחק האמיתי) ──
// שתי קוביות צמודות, אחת קצת מסובבת — מציין את שני הקוביות שזורקים בשש-בש.
function SheshbeshIcon({ size }) {
  return (
    <IconWrap size={size}>
      {/* ── קוביה שמאלית (מסובבת מעט ימינה, ב-3 נקודות) ── */}
      <g transform="rotate(-8, 22, 36)">
        <rect x="12" y="26" width="20" height="20" rx="3" fill={W} />
        {/* קו עליון להבהרה */}
        <rect x="12" y="26" width="20" height="3" rx="1" fill="rgba(255,255,255,0.6)" />
        {/* 3 נקודות אלכסוניות */}
        <circle cx="17" cy="31" r="1.7" fill={DARK} />
        <circle cx="22" cy="36" r="1.7" fill={DARK} />
        <circle cx="27" cy="41" r="1.7" fill={DARK} />
      </g>
      {/* ── קוביה ימנית (מסובבת מעט שמאלה, 5 נקודות) ── */}
      <g transform="rotate(8, 42, 28)">
        <rect x="32" y="18" width="20" height="20" rx="3" fill={W} />
        {/* קו עליון להבהרה */}
        <rect x="32" y="18" width="20" height="3" rx="1" fill="rgba(255,255,255,0.6)" />
        {/* 5 נקודות (X) */}
        <circle cx="37" cy="23" r="1.7" fill={DARK} />
        <circle cx="47" cy="23" r="1.7" fill={DARK} />
        <circle cx="42" cy="28" r="1.7" fill={DARK} />
        <circle cx="37" cy="33" r="1.7" fill={DARK} />
        <circle cx="47" cy="33" r="1.7" fill={DARK} />
      </g>
    </IconWrap>
  )
}

// ── ♟️ שחמט — כלי שחמט (חייל) מסוגנן ──
// צורה קלאסית של חייל שחמט: ראש עגול, צוואר, גוף, ובסיס.
function ChessIcon({ size }) {
  return (
    <IconWrap size={size}>
      {/* הראש — עיגול למעלה */}
      <circle cx="32" cy="18" r="7" fill={W} />
      {/* טבעת מתחת לראש (הצוואר) */}
      <path d="M24 27 L40 27 L38 31 L26 31 Z" fill={W} />
      {/* הגוף — מתרחב מטה */}
      <path d="M26 31 L38 31 L41 44 L23 44 Z" fill={W} />
      {/* הבסיס התחתון — רחב */}
      <path d="M21 44 L43 44 L46 52 L18 52 Z" fill={W} />
      {/* קו תחתון מודגש (הבסיס) */}
      <rect x="17" y="51" width="30" height="3" rx="1.5" fill={W} />
    </IconWrap>
  )
}

// ── ⚫ דמקה — דיסקית דמקה עם דוגמת חריצים ──
// דיסקית עגולה עם טבעת פנימית — מוטיב קלאסי של דמקה.
function CheckersIcon({ size }) {
  return (
    <IconWrap size={size}>
      {/* הדיסקית החיצונית */}
      <circle cx="32" cy="32" r="22" fill={W} />
      {/* טבעת פנימית (החריץ הכפול הקלאסי) */}
      <circle cx="32" cy="32" r="16" fill="none"
              stroke={DARK} strokeWidth="2" strokeOpacity="0.25" />
      <circle cx="32" cy="32" r="12" fill="none"
              stroke={DARK} strokeWidth="1.5" strokeOpacity="0.2" />
      {/* כתר קטן באמצע — סימון של "מלך" */}
      <path d="M27 30 L29 27 L32 29 L35 27 L37 30 L37 35 L27 35 Z"
            fill={DARK} fillOpacity="0.7" />
      <circle cx="29" cy="27" r="1.2" fill={DARK} fillOpacity="0.7" />
      <circle cx="32" cy="28.5" r="1.2" fill={DARK} fillOpacity="0.7" />
      <circle cx="35" cy="27" r="1.2" fill={DARK} fillOpacity="0.7" />
    </IconWrap>
  )
}

// ── 🔴 4 בשורה — 2 שורות של דיסקיות (עליונה ריקה, תחתונה מלאה) ──
// מדמה לוח Connect 4 — שורה עליונה עם 4 חורים ריקים, שורה תחתונה עם 4 דיסקיות מלאות.
function Connect4Icon({ size }) {
  return (
    <IconWrap size={size}>
      {/* רקע לוח — מסגרת מעוגלת חצי-שקופה */}
      <rect x="8" y="16" width="48" height="32" rx="4" fill={W} fillOpacity="0.2" />

      {/* ── שורה עליונה — 4 חורים ריקים (רק קווי מתאר) ── */}
      <circle cx="16" cy="26" r="4.5" fill="none" stroke={W} strokeWidth="1.8" strokeOpacity="0.7" />
      <circle cx="27" cy="26" r="4.5" fill="none" stroke={W} strokeWidth="1.8" strokeOpacity="0.7" />
      <circle cx="38" cy="26" r="4.5" fill="none" stroke={W} strokeWidth="1.8" strokeOpacity="0.7" />
      <circle cx="49" cy="26" r="4.5" fill="none" stroke={W} strokeWidth="1.8" strokeOpacity="0.7" />

      {/* ── שורה תחתונה — 4 דיסקיות מלאות ── */}
      <circle cx="16" cy="38" r="4.5" fill={W} />
      <circle cx="27" cy="38" r="4.5" fill={W} />
      <circle cx="38" cy="38" r="4.5" fill={W} />
      <circle cx="49" cy="38" r="4.5" fill={W} />
    </IconWrap>
  )
}

// ── 💡 טריוויה — בועת שאלה עם סימן שאלה ──
// בועת דיבור מעוגלת עם סימן שאלה גדול ובולט.
function TriviaIcon({ size }) {
  return (
    <IconWrap size={size}>
      {/* בועת הדיבור */}
      <path d="M14 18 Q14 12 20 12 L44 12 Q50 12 50 18 L50 38 Q50 44 44 44 L30 44 L22 52 L24 44 L20 44 Q14 44 14 38 Z"
            fill={W} />
      {/* סימן שאלה — הראש העליון */}
      <path d="M27 24 Q27 19 32 19 Q37 19 37 24 Q37 27 34.5 28.5 Q32 30 32 33"
            stroke={DARK} strokeWidth="3.2" strokeLinecap="round" fill="none" />
      {/* הנקודה התחתונה של סימן השאלה */}
      <circle cx="32" cy="38" r="1.8" fill={DARK} />
    </IconWrap>
  )
}

// ── 🃏 זיכרון — 2 קלפים מוטים (אחד הפוך, אחד חשוף) ──
// קלף הפוך מאחורה + קלף חשוף עם לב בחזית — מוטיב של "מצא זוג".
function MemoryIcon({ size }) {
  return (
    <IconWrap size={size}>
      {/* קלף אחורי (הפוך) — מוטה ימינה */}
      <g transform="translate(0,0) rotate(-12, 26, 32)">
        <rect x="14" y="18" width="22" height="30" rx="3" fill={W} fillOpacity="0.7" />
        {/* דוגמת רשת על הקלף ההפוך */}
        <path d="M18 22 L32 22 M18 26 L32 26 M18 30 L32 30 M18 34 L32 34 M18 38 L32 38 M18 42 L32 42"
              stroke={DARK} strokeWidth="0.8" strokeOpacity="0.3" />
      </g>
      {/* קלף קדמי (חשוף) — מוטה שמאלה, עם לב */}
      <g transform="rotate(12, 38, 32)">
        <rect x="26" y="18" width="22" height="30" rx="3" fill={W} />
        {/* לב במרכז הקלף */}
        <path d="M37 28 C35 26 31 26 31 29.5 C31 33 37 38 37 38 C37 38 43 33 43 29.5 C43 26 39 26 37 28 Z"
              fill={DARK} fillOpacity="0.85" />
      </g>
    </IconWrap>
  )
}

// ── 🟩 מילים ירוקות — שורה של 5 ריבועים בסגנון Wordle ──
// 5 ריבועים בשורה — חלקם "ירוקים" (נמצאו), חלקם "צהובים" (קרוב), חלקם ריקים.
// מציג מילה: 2 ירוקים + 1 צהוב + 2 ריקים — דוגמת ניחוש טיפוסית.
function WordsIcon({ size }) {
  return (
    <IconWrap size={size}>
      {/* 5 ריבועים בשורה */}
      {/* ריבוע 1 — "ירוק" (לבן מלא = "נמצא") */}
      <rect x="8" y="26" width="10" height="12" rx="1.5" fill={W} />
      {/* ריבוע 2 — "ירוק" */}
      <rect x="20" y="26" width="10" height="12" rx="1.5" fill={W} />
      {/* ריבוע 3 — "צהוב/קרוב" (קווי מתאר עם רקע חצי-שקוף) */}
      <rect x="32" y="26" width="10" height="12" rx="1.5"
            fill={W} fillOpacity="0.4" stroke={W} strokeWidth="1.5" />
      {/* ריבוע 4 — ריק (רק קווי מתאר) */}
      <rect x="44" y="26" width="10" height="12" rx="1.5"
            fill="none" stroke={W} strokeWidth="1.5" strokeOpacity="0.6" />
      {/* אותיות קטנטנות בתוך הריבועים הראשונים (לתחושה של מילה) */}
      <text x="13" y="35" textAnchor="middle" fontFamily="Arial, sans-serif"
            fontSize="6.5" fontWeight="900" fill={DARK} fillOpacity="0.7">א</text>
      <text x="25" y="35" textAnchor="middle" fontFamily="Arial, sans-serif"
            fontSize="6.5" fontWeight="900" fill={DARK} fillOpacity="0.7">ב</text>
      <text x="37" y="35" textAnchor="middle" fontFamily="Arial, sans-serif"
            fontSize="6.5" fontWeight="900" fill={DARK} fillOpacity="0.4">ג</text>
    </IconWrap>
  )
}

// ═════════════════════════════════════════════════════════════
// אייקונים למצבי משחק (במסך בחירת מצב של 4 בשורה)
// ═════════════════════════════════════════════════════════════

// ── 🌐 שחקן רנדומלי — גלובוס עם רשת מצוירת ──
// סמל של חיבור עולמי / רשת אנשים אקראיים
function OnlineRandomIcon({ size }) {
  return (
    <IconWrap size={size}>
      {/* הכדור הראשי */}
      <circle cx="32" cy="32" r="20" fill={W} />
      {/* קווי אורך (verticals) */}
      <ellipse cx="32" cy="32" rx="7" ry="20" fill="none" stroke={DARK} strokeWidth="1.5" strokeOpacity="0.5" />
      <ellipse cx="32" cy="32" rx="14" ry="20" fill="none" stroke={DARK} strokeWidth="1.5" strokeOpacity="0.5" />
      {/* קו אמצע אנכי */}
      <line x1="32" y1="12" x2="32" y2="52" stroke={DARK} strokeWidth="1.5" strokeOpacity="0.5" />
      {/* קווי רוחב (horizontals) */}
      <line x1="12" y1="32" x2="52" y2="32" stroke={DARK} strokeWidth="1.5" strokeOpacity="0.5" />
      <ellipse cx="32" cy="32" rx="20" ry="8" fill="none" stroke={DARK} strokeWidth="1.5" strokeOpacity="0.4" />
      {/* 3 נקודות צבעוניות = שחקנים אקראיים בעולם */}
      <circle cx="22" cy="24" r="2.5" fill="#7E2C2E" />
      <circle cx="42" cy="28" r="2.5" fill="#B89048" />
      <circle cx="36" cy="42" r="2.5" fill="#4F6B4A" />
    </IconWrap>
  )
}

// ── 👫 שחק עם חבר — 2 דמויות עם לב באמצע ──
// 2 ראשים זה ליד זה, ולב מעליהם — סימן של חברות
function FriendsIcon({ size }) {
  return (
    <IconWrap size={size}>
      {/* לב באמצע למעלה */}
      <path d="M32 16 C29 13 24 14 24 18 C24 22 32 27 32 27 C32 27 40 22 40 18 C40 14 35 13 32 16 Z"
            fill={W} />
      {/* דמות שמאלית — ראש + גוף */}
      <circle cx="22" cy="34" r="6" fill={W} />
      <path d="M14 52 Q14 42 22 42 Q30 42 30 52 Z" fill={W} />
      {/* דמות ימנית — ראש + גוף */}
      <circle cx="42" cy="34" r="6" fill={W} />
      <path d="M34 52 Q34 42 42 42 Q50 42 50 52 Z" fill={W} />
    </IconWrap>
  )
}

// ── 🤖 נגד המחשב — ראש רובוט ──
// ראש מרובע עם 2 עיניים, אנטנה למעלה ופה עם משבצות
function AIIcon({ size }) {
  return (
    <IconWrap size={size}>
      {/* אנטנה */}
      <line x1="32" y1="12" x2="32" y2="18" stroke={W} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="11" r="2" fill={W} />
      {/* ראש מרובע מעוגל */}
      <rect x="14" y="20" width="36" height="30" rx="6" fill={W} />
      {/* עין שמאלית */}
      <circle cx="23" cy="32" r="3.5" fill={DARK} />
      <circle cx="24" cy="31" r="1" fill={W} />
      {/* עין ימנית */}
      <circle cx="41" cy="32" r="3.5" fill={DARK} />
      <circle cx="42" cy="31" r="1" fill={W} />
      {/* פה — קו עם משבצות */}
      <rect x="22" y="40" width="20" height="4" rx="1" fill={DARK} fillOpacity="0.85" />
      <line x1="27" y1="40" x2="27" y2="44" stroke={W} strokeWidth="1" />
      <line x1="32" y1="40" x2="32" y2="44" stroke={W} strokeWidth="1" />
      <line x1="37" y1="40" x2="37" y2="44" stroke={W} strokeWidth="1" />
    </IconWrap>
  )
}

// ── 👥 שני שחקנים על אותו מכשיר — 2 ראשים פונים זה לזה ──
// פרופיל של שני אנשים זה מול זה (מסמל "פנים אל פנים" על אותו מכשיר)
function LocalIcon({ size }) {
  return (
    <IconWrap size={size}>
      {/* פרופיל שמאלי (פונה ימינה) */}
      <circle cx="21" cy="22" r="6" fill={W} />
      <path d="M11 50 Q11 36 21 36 Q31 36 31 50 Z" fill={W} />
      {/* פרופיל ימני (פונה שמאלה) */}
      <circle cx="43" cy="22" r="6" fill={W} />
      <path d="M33 50 Q33 36 43 36 Q53 36 53 50 Z" fill={W} />
      {/* קו אמצעי דק שמפריד ביניהם (סמל "אותו מכשיר") */}
      <line x1="32" y1="18" x2="32" y2="50" stroke={W} strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="2,2" />
    </IconWrap>
  )
}

// ─────────────────────────────────────────────────────────────
// קומפוננטה ראשית: בוחרת אייקון לפי id המשחק
// ─────────────────────────────────────────────────────────────
export function GameIcon({ id, size = 64 }) {
  switch (id) {
    case 'bingo':     return <BingoIcon size={size} />
    case 'sheshbesh': return <SheshbeshIcon size={size} />
    case 'chess':     return <ChessIcon size={size} />
    case 'checkers':  return <CheckersIcon size={size} />
    case 'connect4':  return <Connect4Icon size={size} />
    case 'trivia':    return <TriviaIcon size={size} />
    case 'memory':    return <MemoryIcon size={size} />
    case 'words':     return <WordsIcon size={size} />
    // ── מצבי משחק של 4 בשורה ──
    case 'online-random':  return <OnlineRandomIcon size={size} />
    case 'online-friend':  return <FriendsIcon size={size} />
    case 'vs-ai':          return <AIIcon size={size} />
    case 'local-2p':       return <LocalIcon size={size} />
    default:
      // ברירת מחדל — נקודה לבנה (במקרה של id לא מוכר)
      return (
        <IconWrap size={size}>
          <circle cx="32" cy="32" r="8" fill={W} />
        </IconWrap>
      )
  }
}
