// src/components/AppLogo.jsx
// ─────────────────────────────────────────────────────────────
// הלוגו הרשמי של "ביחד" — שתי דמויות עם לב על רקע סגול-בורדו.
// זהה לאייקון האפליקציה (public/app-icon.svg) כדי לשמור על אחידות
// מלאה בכל מקום שבו הלוגו מופיע (מסך הרשמה, מסכי טעינה וכו').
//
// שימוש:  <AppLogo size={66} />
// ─────────────────────────────────────────────────────────────
export default function AppLogo({ size = 66, rounded = 20 }) {
  // יחס הפינות נשמר ביחס לגודל (115/512 ≈ 0.225 כמו באייקון המקורי)
  const radius = rounded != null ? rounded : Math.round(size * 0.225)
  return (
    <svg
      width={size} height={size} viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', borderRadius: radius }}
      role="img" aria-label="ביחד"
    >
      <defs>
        <linearGradient id="appLogoBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8A4D6A" />
          <stop offset="1" stopColor="#6B3A4F" />
        </linearGradient>
        <radialGradient id="appLogoGlow" cx="0.5" cy="0.38" r="0.62">
          <stop offset="0" stopColor="#E8C879" stopOpacity="0.32" />
          <stop offset="1" stopColor="#E8C879" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="512" height="512" rx="115" fill="url(#appLogoBg)" />
      <rect width="512" height="512" rx="115" fill="url(#appLogoGlow)" />

      {/* לב קטן למעלה */}
      <path d="M 256 120 C 238 96 202 99 202 132 C 202 159 256 188 256 188 C 256 188 310 159 310 132 C 310 99 274 96 256 120 Z" fill="#E8896A" />

      {/* שתי דמויות — "ביחד" */}
      <g transform="translate(256,288)">
        <circle cx="-56" cy="-42" r="44" fill="#E8C879" />
        <path d="M -56 12 C -112 12 -124 74 -120 116 L 8 116 C 4 64 -8 12 -56 12 Z" fill="#E8C879" />
        <circle cx="56" cy="-42" r="44" fill="#FBF7EE" />
        <path d="M 56 12 C 112 12 124 74 120 116 L -8 116 C -4 64 8 12 56 12 Z" fill="#FBF7EE" />
      </g>
    </svg>
  )
}
