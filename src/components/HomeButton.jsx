// src/components/HomeButton.jsx
// ─────────────────────────────────────────────────────────────
// כפתור "חזרה למסך הבית" — מוצג ליד כפתור החזרה בכל מסך.
// מעוצב בדיוק כמו screen-header__back (אותו גודל, רקע, מסגרת).
// מקבל onClick שמחזיר את המשתמש למסך הבית (hub).
// ─────────────────────────────────────────────────────────────
import { IconHomeLine } from '../icons/index.jsx'

export default function HomeButton({ onClick, size = 24 }) {
  if (!onClick) return null
  return (
    <button
      className="screen-header__back"
      onClick={onClick}
      aria-label="חזרה למסך הבית"
    >
      <IconHomeLine size={size} color="#1B2540" />
    </button>
  )
}
