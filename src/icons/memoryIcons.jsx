// src/icons/memoryIcons.jsx
// ─────────────────────────────────────────────────────────────
// 16 אייקונים יפים למשחק הזיכרון.
// כל אייקון = עיגול צבעוני עם איור לבן במרכז, בסגנון "ביחד".
// ─────────────────────────────────────────────────────────────

function CircleIcon({ size = 80, fill, ring, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none"
         xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="38" fill={fill} />
      <circle cx="40" cy="40" r="38" stroke={ring} strokeWidth="3" />
      {children}
    </svg>
  )
}

const W = '#FBF7EE'

// ── 1. ספל קפה (טורקיז) ─────────────────────────────────
const IconMemCoffee = ({ size }) => (
  <CircleIcon size={size} fill="#2C5566" ring="#173846">
    <path d="M26 34h24v12a12 12 0 0 1-12 12h0a12 12 0 0 1-12-12V34Z" fill={W} />
    <path d="M50 37h3a6 6 0 0 1 0 12h-2" stroke={W} strokeWidth="3.4" strokeLinecap="round" />
    <path d="M32 22c-1.6 2.6-1.6 4.4 0 7M40 21c-1.6 2.6-1.6 5 0 8M48 22c-1.6 2.6-1.6 4.4 0 7"
          stroke={W} strokeWidth="3" strokeLinecap="round" />
  </CircleIcon>
)

// ── 2. ורד (בורדו) ───────────────────────────────────────
const IconMemRose = ({ size }) => (
  <CircleIcon size={size} fill="#7E2C2E" ring="#5A1D1E">
    <circle cx="40" cy="36" r="14" fill={W} />
    <circle cx="40" cy="36" r="9" fill="#7E2C2E" />
    <circle cx="40" cy="36" r="5" fill={W} />
    <path d="M28 50c0 6 5 12 12 12s12-6 12-12" stroke={W} strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M40 50v12" stroke={W} strokeWidth="3" strokeLinecap="round" />
  </CircleIcon>
)

// ── 3. לימון (מאסטרד) ────────────────────────────────────
const IconMemLemon = ({ size }) => (
  <CircleIcon size={size} fill="#B89048" ring="#8A6A2E">
    <ellipse cx="40" cy="40" rx="16" ry="20" fill={W} transform="rotate(-25 40 40)" />
    <path d="M30 28l-4-4M50 52l4 4" stroke={W} strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="34" cy="34" rx="3" ry="2" fill="#B89048" transform="rotate(-25 34 34)" opacity="0.4" />
  </CircleIcon>
)

// ── 4. כוכב (נייבי) ───────────────────────────────────────
const IconMemStar = ({ size }) => (
  <CircleIcon size={size} fill="#1B2540" ring="#0E1730">
    <path d="M40 20 L45 33 L59 34 L48 43 L52 57 L40 49 L28 57 L32 43 L21 34 L35 33 Z" fill={W} />
  </CircleIcon>
)

// ── 5. עלה (ירוק) ─────────────────────────────────────────
const IconMemLeaf = ({ size }) => (
  <CircleIcon size={size} fill="#4F6B4A" ring="#354D31">
    <path d="M22 58c0-20 14-36 36-36-2 20-16 36-36 36Z" fill={W} />
    <path d="M28 52L48 32" stroke="#4F6B4A" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M34 50l-3-3M40 46l-5-5M44 42l-5-5M48 38l-3-3" stroke="#4F6B4A" strokeWidth="2" strokeLinecap="round" />
  </CircleIcon>
)

// ── 6. תו מוזיקלי (יין) ───────────────────────────────────
const IconMemNote = ({ size }) => (
  <CircleIcon size={size} fill="#6B3A4F" ring="#482638">
    <path d="M36 22 56 17v25" stroke={W} strokeWidth="4.2" strokeLinecap="round" />
    <path d="M36 22v26" stroke={W} strokeWidth="4.2" strokeLinecap="round" />
    <ellipse cx="30" cy="49" rx="7.5" ry="6" fill={W} transform="rotate(-20 30 49)" />
    <ellipse cx="50" cy="44" rx="7.5" ry="6" fill={W} transform="rotate(-20 50 44)" />
  </CircleIcon>
)

// ── 7. שמש (מאסטרד) ──────────────────────────────────────
const IconMemSun = ({ size }) => (
  <CircleIcon size={size} fill="#B89048" ring="#8A6A2E">
    <circle cx="40" cy="40" r="11" fill={W} />
    <g stroke={W} strokeWidth="3.5" strokeLinecap="round">
      <line x1="40" y1="18" x2="40" y2="24" />
      <line x1="40" y1="56" x2="40" y2="62" />
      <line x1="18" y1="40" x2="24" y2="40" />
      <line x1="56" y1="40" x2="62" y2="40" />
      <line x1="24.5" y1="24.5" x2="28.5" y2="28.5" />
      <line x1="51.5" y1="51.5" x2="55.5" y2="55.5" />
      <line x1="55.5" y1="24.5" x2="51.5" y2="28.5" />
      <line x1="28.5" y1="51.5" x2="24.5" y2="55.5" />
    </g>
  </CircleIcon>
)

// ── 8. ירח (נייבי) ────────────────────────────────────────
const IconMemMoon = ({ size }) => (
  <CircleIcon size={size} fill="#1B2540" ring="#0E1730">
    <path d="M48 22a18 18 0 1 0 0 36 14 14 0 0 1 0-36Z" fill={W} />
    <circle cx="56" cy="32" r="1.8" fill={W} />
    <circle cx="60" cy="42" r="1.4" fill={W} />
    <circle cx="58" cy="52" r="1.6" fill={W} />
  </CircleIcon>
)

// ── 9. לב (בורדו) ─────────────────────────────────────────
const IconMemHeart = ({ size }) => (
  <CircleIcon size={size} fill="#7E2C2E" ring="#5A1D1E">
    <path d="M40 60 C18 46, 18 26, 30 24 C36 23, 40 28, 40 30 C40 28, 44 23, 50 24 C62 26, 62 46, 40 60 Z" fill={W} />
  </CircleIcon>
)

// ── 10. פרפר (טורקיז) ─────────────────────────────────────
const IconMemButterfly = ({ size }) => (
  <CircleIcon size={size} fill="#2C5566" ring="#173846">
    <ellipse cx="28" cy="32" rx="10" ry="12" fill={W} transform="rotate(-20 28 32)" />
    <ellipse cx="52" cy="32" rx="10" ry="12" fill={W} transform="rotate(20 52 32)" />
    <ellipse cx="30" cy="50" rx="8" ry="9" fill={W} transform="rotate(-15 30 50)" />
    <ellipse cx="50" cy="50" rx="8" ry="9" fill={W} transform="rotate(15 50 50)" />
    <ellipse cx="40" cy="40" rx="3" ry="14" fill="#173846" />
    <path d="M40 26l-3-4M40 26l3-4" stroke="#173846" strokeWidth="2" strokeLinecap="round" />
  </CircleIcon>
)

// ── 11. תפוח (ירוק) ───────────────────────────────────────
const IconMemApple = ({ size }) => (
  <CircleIcon size={size} fill="#4F6B4A" ring="#354D31">
    <path d="M40 24c-2-3-6-3-9-1-4 3-6 8-6 13 0 12 9 24 15 24s15-12 15-24c0-5-2-10-6-13-3-2-7-2-9 1Z" fill={W} />
    <path d="M40 24c0-4 2-7 5-8" stroke="#354D31" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <ellipse cx="46" cy="18" rx="5" ry="3" fill={W} transform="rotate(-30 46 18)" />
  </CircleIcon>
)

// ── 12. ענבים (יין) ───────────────────────────────────────
const IconMemGrapes = ({ size }) => (
  <CircleIcon size={size} fill="#6B3A4F" ring="#482638">
    <circle cx="32" cy="36" r="5" fill={W} />
    <circle cx="40" cy="36" r="5" fill={W} />
    <circle cx="48" cy="36" r="5" fill={W} />
    <circle cx="36" cy="44" r="5" fill={W} />
    <circle cx="44" cy="44" r="5" fill={W} />
    <circle cx="40" cy="52" r="5" fill={W} />
    <path d="M40 26c0-4 2-6 5-7" stroke={W} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M44 22c2-2 4-2 7-1" stroke={W} strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </CircleIcon>
)

// ── 13. מטרייה (בורדו) ────────────────────────────────────
const IconMemUmbrella = ({ size }) => (
  <CircleIcon size={size} fill="#7E2C2E" ring="#5A1D1E">
    <path d="M40 20c-12 0-22 8-22 20h44c0-12-10-20-22-20Z" fill={W} />
    <path d="M40 20v0M28 40c0-8 4-16 12-20M52 40c0-8-4-16-12-20" stroke="#7E2C2E" strokeWidth="2" />
    <path d="M40 40v18a4 4 0 0 0 8 0v-2" stroke={W} strokeWidth="3.5" strokeLinecap="round" fill="none" />
  </CircleIcon>
)

// ── 14. עוגה (יין) ────────────────────────────────────────
const IconMemCake = ({ size }) => (
  <CircleIcon size={size} fill="#6B3A4F" ring="#482638">
    <rect x="22" y="42" width="36" height="18" rx="2" fill={W} />
    <path d="M22 42c2-3 5-3 7 0s5 3 7 0 5-3 7 0 5 3 7 0 5-3 7 0" stroke="#6B3A4F" strokeWidth="2" fill="none" />
    <rect x="28" y="28" width="3" height="14" fill={W} />
    <rect x="39" y="26" width="3" height="16" fill={W} />
    <rect x="50" y="28" width="3" height="14" fill={W} />
    <ellipse cx="29.5" cy="26" rx="2" ry="3" fill="#E8C879" />
    <ellipse cx="40.5" cy="24" rx="2" ry="3" fill="#E8C879" />
    <ellipse cx="51.5" cy="26" rx="2" ry="3" fill="#E8C879" />
  </CircleIcon>
)

// ── 15. פרח (טורקיז) ──────────────────────────────────────
const IconMemFlower = ({ size }) => (
  <CircleIcon size={size} fill="#2C5566" ring="#173846">
    <circle cx="40" cy="24" r="7" fill={W} />
    <circle cx="40" cy="56" r="7" fill={W} />
    <circle cx="24" cy="40" r="7" fill={W} />
    <circle cx="56" cy="40" r="7" fill={W} />
    <circle cx="40" cy="40" r="6" fill="#E8C879" />
  </CircleIcon>
)

// ── 16. דג (טורקיז) ───────────────────────────────────────
const IconMemFish = ({ size }) => (
  <CircleIcon size={size} fill="#2C5566" ring="#173846">
    <path d="M22 40c0-8 8-14 18-14s18 6 18 14-8 14-18 14-18-6-18-14Z" fill={W} />
    <path d="M58 40l8-8v16l-8-8Z" fill={W} />
    <circle cx="50" cy="36" r="2" fill="#173846" />
    <path d="M30 40c4 0 6-2 6-2M30 40c4 0 6 2 6 2" stroke="#173846" strokeWidth="1.5" strokeLinecap="round" fill="none" />
  </CircleIcon>
)

// ── רשימה מסודרת של כל האייקונים ─────────────────────────
// כל פריט: { id, Icon } — id ייחודי לזיהוי בלוגיקת המשחק.
export const MEMORY_ICONS = [
  { id: 'coffee',    Icon: IconMemCoffee },
  { id: 'rose',      Icon: IconMemRose },
  { id: 'lemon',     Icon: IconMemLemon },
  { id: 'star',      Icon: IconMemStar },
  { id: 'leaf',      Icon: IconMemLeaf },
  { id: 'note',      Icon: IconMemNote },
  { id: 'sun',       Icon: IconMemSun },
  { id: 'moon',      Icon: IconMemMoon },
  { id: 'heart',     Icon: IconMemHeart },
  { id: 'butterfly', Icon: IconMemButterfly },
  { id: 'apple',     Icon: IconMemApple },
  { id: 'grapes',    Icon: IconMemGrapes },
  { id: 'umbrella',  Icon: IconMemUmbrella },
  { id: 'cake',      Icon: IconMemCake },
  { id: 'flower',    Icon: IconMemFlower },
  { id: 'fish',      Icon: IconMemFish },
]
