// src/icons/index.jsx
// ─────────────────────────────────────────────────────────────
// אייקונים של "ביחד".
//  1) אייקוני קטגוריה — תג עיגול צבעוני מלא (CircleIcon).
//  2) אייקוני UI — קו פשוט חד-גוני (LineIcon).
// ─────────────────────────────────────────────────────────────

function LineIcon({ size = 28, color = 'currentColor', children, viewBox = '0 0 24 24' }) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill="none"
         stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

function CircleIcon({ size = 56, fill, ring, children }) {
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

// ══ אייקוני קטגוריה — תג עיגול ═══════════════════════════════

export const IconCoffee = ({ size }) => (
  <CircleIcon size={size} fill="#2C5566" ring="#173846">
    <path d="M26 34h24v12a12 12 0 0 1-12 12h0a12 12 0 0 1-12-12V34Z" fill={W} />
    <path d="M50 37h3a6 6 0 0 1 0 12h-2" stroke={W} strokeWidth="3.4" strokeLinecap="round" />
    <path d="M32 22c-1.6 2.6-1.6 4.4 0 7M40 21c-1.6 2.6-1.6 5 0 8M48 22c-1.6 2.6-1.6 4.4 0 7"
          stroke={W} strokeWidth="3" strokeLinecap="round" />
  </CircleIcon>
)

export const IconPodium = ({ size }) => (
  <CircleIcon size={size} fill="#7E2C2E" ring="#5A1D1E">
    <circle cx="40" cy="30" r="9" fill={W} />
    <path d="M25 56c0-9 6.7-15 15-15s15 6 15 15H25Z" fill={W} />
    <circle cx="22" cy="34" r="6" fill={W} opacity="0.55" />
    <circle cx="58" cy="34" r="6" fill={W} opacity="0.55" />
  </CircleIcon>
)

export const IconGreeting = ({ size }) => (
  <CircleIcon size={size} fill="#6B3A4F" ring="#482638">
    <rect x="24" y="22" width="32" height="38" rx="4" fill={W} />
    <path d="M40 33c-1.6-2.4-5.6-2-5.6 1.3 0 2.4 3.2 4.3 5.6 5.9 2.4-1.6 5.6-3.5 5.6-5.9 0-3.3-4-3.7-5.6-1.3Z" fill="#B89048" />
    <path d="M31 48h18M31 53h12" stroke="#6B3A4F" strokeWidth="2.6" strokeLinecap="round" />
  </CircleIcon>
)

export const IconBook = ({ size }) => (
  <CircleIcon size={size} fill="#4F6B4A" ring="#354D31">
    <path d="M40 26c-5-3.5-12-4.5-18-3.5v28c6-1 13 0 18 3.5 5-3.5 12-4.5 18-3.5v-28c-6-1-13 0-18 3.5Z" fill={W} />
    <path d="M40 26v28" stroke="#4F6B4A" strokeWidth="3" strokeLinecap="round" />
  </CircleIcon>
)

export const IconLightbulb = ({ size }) => (
  <CircleIcon size={size} fill="#B89048" ring="#8A6A2E">
    <path d="M40 18a14 14 0 0 0-9 24.5c1.6 1.4 2.6 3.3 2.6 5.5h12.8c0-2.2 1-4.1 2.6-5.5A14 14 0 0 0 40 18Z" fill={W} />
    <rect x="33" y="50" width="14" height="4.5" rx="2.25" fill={W} />
    <rect x="35" y="56" width="10" height="4" rx="2" fill={W} />
    <path d="M40 28v9M40 37l-4.5 4.5M40 37l4.5 4.5"
          stroke="#B89048" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
  </CircleIcon>
)

export const IconMusic = ({ size }) => (
  <CircleIcon size={size} fill="#7E2C2E" ring="#5A1D1E">
    <path d="M34 22 58 17v25" stroke={W} strokeWidth="4.2" strokeLinecap="round" />
    <path d="M34 22v24" stroke={W} strokeWidth="4.2" strokeLinecap="round" />
    <ellipse cx="28" cy="47" rx="7.5" ry="6" fill={W} transform="rotate(-20 28 47)" />
    <ellipse cx="52" cy="42" rx="7.5" ry="6" fill={W} transform="rotate(-20 52 42)" />
  </CircleIcon>
)

export const IconFriends = ({ size }) => (
  <CircleIcon size={size} fill="#2C5566" ring="#173846">
    <circle cx="31" cy="31" r="8" fill={W} />
    <circle cx="50" cy="34" r="6.5" fill={W} opacity="0.6" />
    <path d="M18 58c0-8 5.8-14 13-14s13 6 13 14H18Z" fill={W} />
    <path d="M43 58c0-6.5 1.6-11.5 5.5-14 6.5 0 11.5 6 11.5 14H43Z" fill={W} opacity="0.6" />
  </CircleIcon>
)
export const IconUsers = IconFriends

export const IconKitchen = ({ size }) => (
  <CircleIcon size={size} fill="#2C5566" ring="#173846">
    <rect x="24" y="34" width="32" height="20" rx="5" fill={W} />
    <rect x="21" y="30" width="38" height="6" rx="3" fill={W} />
    <rect x="18" y="31" width="6" height="4" rx="2" fill={W} />
    <rect x="56" y="31" width="6" height="4" rx="2" fill={W} />
    <path d="M34 26c-1.5-3-1.5-5 0-8M46 26c-1.5-3-1.5-5 0-8" stroke={W} strokeWidth="3" strokeLinecap="round" />
  </CircleIcon>
)

export const IconVideo = ({ size }) => (
  <CircleIcon size={size} fill="#7E2C2E" ring="#5A1D1E">
    <rect x="20" y="29" width="28" height="22" rx="6" fill={W} />
    <path d="M50 36l10-6.5v21L50 44v-8Z" fill={W} />
    <circle cx="30" cy="37" r="3.5" fill="#7E2C2E" />
  </CircleIcon>
)

export const IconHome = ({ size }) => (
  <CircleIcon size={size} fill="#4F6B4A" ring="#354D31">
    <path d="M40 20 22 36v18a3 3 0 0 0 3 3h9V44h12v13h9a3 3 0 0 0 3-3V36L40 20Z" fill={W} />
    <rect x="36" y="46" width="8" height="11" fill="#4F6B4A" />
  </CircleIcon>
)

export const IconBell = ({ size }) => (
  <CircleIcon size={size} fill="#B89048" ring="#8A6A2E">
    <path d="M40 20a3 3 0 0 1 3 3v1.4A11 11 0 0 1 51 35c0 6.5 2.2 8.8 3.5 10.4.7.9.1 2.1-1 2.1H26.5c-1.1 0-1.7-1.2-1-2.1C26.8 43.8 29 41.5 29 35a11 11 0 0 1 8-10.6V23a3 3 0 0 1 3-3Z" fill={W} />
    <path d="M35.5 49a4.5 4.5 0 0 0 9 0h-9Z" fill={W} />
  </CircleIcon>
)

// אייקון זירת המשחקים — בקר משחק (gamepad) בעיגול בורדו
export const IconGames = ({ size }) => (
  <CircleIcon size={size} fill="#7E2C2E" ring="#5A1D1E">
    {/* גוף הבקר */}
    <path d="M22 38c0-4.5 3.5-8 8-8h20c4.5 0 8 3.5 8 8v8c0 3.5-2.8 6-6 6-2 0-3.8-1-5-2.5l-2-2.5h-10l-2 2.5c-1.2 1.5-3 2.5-5 2.5-3.2 0-6-2.5-6-6v-8Z" fill={W} />
    {/* כפתורי כיוון (משמאל) */}
    <rect x="28" y="38" width="3" height="7" rx="1" fill="#7E2C2E" />
    <rect x="25.5" y="40.5" width="8" height="3" rx="1" fill="#7E2C2E" />
    {/* כפתורים עגולים (מימין) */}
    <circle cx="48" cy="40" r="1.8" fill="#7E2C2E" />
    <circle cx="52" cy="43" r="1.8" fill="#7E2C2E" />
    <circle cx="44" cy="43" r="1.8" fill="#7E2C2E" />
    <circle cx="48" cy="46" r="1.8" fill="#7E2C2E" />
  </CircleIcon>
)

// ══ אייקוני UI — קו פשוט חד-גוני ═════════════════════════════

export const IconPhone = (p) => (
  <LineIcon {...p}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92Z" />
  </LineIcon>
)

export const IconPhoneEnd = IconPhone

export const IconMic = (p) => (
  <LineIcon {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M19 10a7 7 0 0 1-14 0" />
    <line x1="12" y1="17" x2="12" y2="22" />
  </LineIcon>
)

export const IconMicOff = (p) => (
  <LineIcon {...p}>
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
    <path d="M5 10v2a7 7 0 0 0 12 5" />
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </LineIcon>
)

export const IconSpeaker = (p) => (
  <LineIcon {...p}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </LineIcon>
)

export const IconBack = (p) => (
  <LineIcon {...p}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </LineIcon>
)

export const IconBackRTL = (p) => (
  <LineIcon {...p}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </LineIcon>
)

export const IconPlay = (p) => (
  <LineIcon {...p}>
    <polygon points="5 3 19 12 5 21 5 3" />
  </LineIcon>
)

export const IconPause = (p) => (
  <LineIcon {...p}>
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </LineIcon>
)

export const IconCheck = (p) => (
  <LineIcon {...p}>
    <polyline points="20 6 9 17 4 12" />
  </LineIcon>
)

export const IconX = (p) => (
  <LineIcon {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </LineIcon>
)

export const IconClock = (p) => (
  <LineIcon {...p}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </LineIcon>
)

export const IconHeart = (p) => (
  <LineIcon {...p}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </LineIcon>
)

export const IconHourglass = (p) => (
  <LineIcon {...p}>
    <path d="M6 3h12" /><path d="M6 21h12" />
    <path d="M6 3v3c0 2 2 3 3 4l3 2 3-2c1-1 3-2 3-4V3" />
    <path d="M6 21v-3c0-2 2-3 3-4l3-2 3 2c1 1 3 2 3 4v3" />
  </LineIcon>
)

// שיתוף — שלושה עיגולים מחוברים (כמו ti-share)
export const IconShare = (p) => (
  <LineIcon {...p}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </LineIcon>
)

// הורדה/שמירה — חץ נכנס למגש (כמו ti-download)
export const IconDownload = (p) => (
  <LineIcon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </LineIcon>
)

// ══ אייקוני סרגל העריכה (מחולל הברכה) ═══════════════════════
// קו אחיד, נקי ומודרני — תואמים לשאר אייקוני ה-UI.

// תבניות — ריבועים בפריסת רשת
export const IconTemplates = (p) => (
  <LineIcon {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </LineIcon>
)

// רקע — תמונה עם שמש והרים
export const IconBackground = (p) => (
  <LineIcon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="8.5" cy="8.5" r="1.8" />
    <path d="M3 17l5-5 4 4 3-3 6 6" />
  </LineIcon>
)

// טקסט — סימן הקלדה "A" עם מחוון
export const IconText = (p) => (
  <LineIcon {...p}>
    <path d="M5 19 11 5l6 14" />
    <path d="M7.5 14h7" />
    <path d="M20 5v14" />
  </LineIcon>
)

// שם המאחל — אדם בעיגול
export const IconSender = (p) => (
  <LineIcon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
  </LineIcon>
)

// פונט — האות "א" העברית בקו
export const IconFont = (p) => (
  <LineIcon {...p}>
    <path d="M17 5 8.5 19" />
    <path d="M7 8c1.8 1.2 2.8 3 2.8 5.2 0 1.6-.6 3-1.6 4.2" />
    <path d="M14.5 11c-1.4 1.2-2 2.8-2 4.6 0 1.4.5 2.6 1.3 3.6" />
  </LineIcon>
)

// אפקטים — כוכב נצנוץ (ניצוצות)
export const IconEffects = (p) => (
  <LineIcon {...p}>
    <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
    <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
  </LineIcon>
)

// צבע — טיפת/לוח צבעים
export const IconColor = (p) => (
  <LineIcon {...p}>
    <path d="M12 3a9 9 0 0 0 0 18c1.7 0 2.5-1.3 2.5-2.5 0-.7-.3-1.2-.3-1.8 0-.8.6-1.4 1.5-1.4H18a3 3 0 0 0 3-3c0-5-4-9.3-9-9.3Z" />
    <circle cx="7.5" cy="11" r="1" fill={p.color || 'currentColor'} stroke="none" />
    <circle cx="11" cy="7.5" r="1" fill={p.color || 'currentColor'} stroke="none" />
    <circle cx="15" cy="8.5" r="1" fill={p.color || 'currentColor'} stroke="none" />
  </LineIcon>
)

// גודל — שתי אותיות בגדלים שונים + חצים
export const IconSize = (p) => (
  <LineIcon {...p}>
    <path d="M3 17 7 7l4 10" />
    <path d="M4.5 13.5h5" />
    <path d="M14 17 17 9l3 8" />
    <path d="M15 14.5h4" />
  </LineIcon>
)
