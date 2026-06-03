// src/icons/radioIcons.jsx
// ─────────────────────────────────────────────────────────────
// אייקוני SVG נקיים לקטגוריות הרדיו — בסגנון קו אחיד (stroke),
// תואמים לשפה העיצובית של האפליקציה. כל אייקון מקבל size + color.
//
// שימוש: <RadioCatIcon id="jazz" size={28} color="#6B3A4F" />
// ─────────────────────────────────────────────────────────────

const DEFAULT_COLOR = '#6B3A4F'

// עוטף משותף — קו אחיד, פינות מעוגלות
function Svg({ size = 28, children, viewBox = '0 0 24 24' }) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

// ── מפת האייקונים לפי id ──
const ICONS = {
  // 🌍 לפי מדינה — גלובוס עם קווי אורך/רוחב
  country: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.4 3.9 5.6 4 9-.1 3.4-1.5 6.6-4 9-2.5-2.4-3.9-5.6-4-9 .1-3.4 1.5-6.6 4-9z" />
    </>
  ),
  // 🎙️ שנות ה-50 — מיקרופון רטרו (וינטג')
  '50s': (
    <>
      <rect x="8" y="2" width="8" height="13" rx="4" />
      <path d="M8 7h8M8 10h8" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3M9 21h6" />
    </>
  ),
  // 🎵 שנות ה-60 — תו בודד
  '60s': (
    <>
      <circle cx="8" cy="18" r="3" />
      <path d="M11 18V5l8-2v11" />
      <circle cx="16" cy="14" r="3" />
    </>
  ),
  // 🕺 שנות ה-70 — תקליט עם תווים (דיסקו)
  '70s': (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21" />
    </>
  ),
  // 📼 שנות ה-80 — קלטת
  '80s': (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="8.5" cy="12" r="2" />
      <circle cx="15.5" cy="12" r="2" />
      <path d="M10.5 12h3" />
    </>
  ),
  // 💿 שנות ה-90 — דיסק
  '90s': (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 3a9 9 0 0 1 6.4 2.6L12 12" opacity="0.55" />
    </>
  ),
  // 📀 שנות ה-2000 — דיסק כפול
  '2000s': (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.3" />
    </>
  ),
  // 🎶 נוסטלגיה — שני תווים מחוברים
  oldies: (
    <>
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17" cy="16" r="2.5" />
      <path d="M9.5 18V7l10-2v11" />
      <path d="M9.5 9l10-2" />
    </>
  ),
  // 🎻 קלאסי — כינור
  classical: (
    <>
      <path d="M12 2c1.5 0 2 1.3 2 2.5S13.2 7 12 8c-1.2 1-2 2-2 4 0 2.8 1.3 4 1.3 6.5A2.7 2.7 0 0 1 8.6 21a2.6 2.6 0 0 1-.6-5.1" />
      <path d="M14 6.5c2 .5 4 2 4 5.5 0 4-3 6.5-6 6.5" opacity="0.5" />
      <path d="M11 4.5l3 1" />
    </>
  ),
  // 🎷 ג'אז — סקסופון
  jazz: (
    <>
      <path d="M9 3v8a5 5 0 0 0 5 5h1a3 3 0 0 0 3-3v-1" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M9 3H7M11 7h-.01M11 10h-.01" />
    </>
  ),
  // 🎤 פופ — מיקרופון יד
  pop: (
    <>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M7 11a5 5 0 0 0 10 0" />
      <path d="M12 16v5M9 21h6" />
    </>
  ),
  // 🎸 רוק — גיטרה
  rock: (
    <>
      <path d="M19 3l-2 2" />
      <path d="M16.5 5.5l2 2" />
      <path d="M15 7l2 2-5.5 5.5a3.5 3.5 0 1 1-2-2L15 7z" />
      <circle cx="10" cy="14" r="1.5" />
    </>
  ),
  // 📰 חדשות — עיתון
  news: (
    <>
      <path d="M4 5h13v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z" />
      <path d="M17 8h3v10a2 2 0 0 1-2 2" />
      <path d="M7 8h7M7 11h7M7 14h4" />
    </>
  ),
  // 🗣️ דיבורים — בועת דיבור עם גלים
  talk: (
    <>
      <path d="M4 5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3a2 2 0 0 1-2-2V7" opacity="0" />
      <path d="M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8l-4 3v-3a2 2 0 0 1-1-1.7V7z" />
      <path d="M19 8a5 5 0 0 1 0 8" />
    </>
  ),
}

export function RadioCatIcon({ id, size = 28, color = DEFAULT_COLOR }) {
  const icon = ICONS[id]
  if (!icon) {
    // ברירת מחדל — תו מוזיקלי
    return (
      <span style={{ color }}>
        <Svg size={size}>
          <circle cx="8" cy="18" r="3" />
          <path d="M11 18V5l8-2v11" />
          <circle cx="16" cy="14" r="3" />
        </Svg>
      </span>
    )
  }
  return (
    <span style={{ color, display: 'inline-flex' }}>
      <Svg size={size}>{icon}</Svg>
    </span>
  )
}
