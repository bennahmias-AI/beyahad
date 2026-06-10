// src/components/ModalPortal.jsx
// ─────────────────────────────────────────────────────────────
// עוטף תוכן חלון (modal) ומרנדר אותו ישירות אל document.body דרך Portal.
//
// למה זה חיוני:
//   חלונות הפרטים (מתכון/עצה) הם position:fixed שאמורים לכסות את כל המסך.
//   אבל הם נמצאים בתוך <div class="scroll-area rise-in"> — ול-.rise-in יש
//   animation עם transform, ול-.scroll-area יש לפעמים zoom (הגדלת טקסט).
//   גם transform וגם zoom יוצרים "containing block" חדש, ואז position:fixed
//   ממוקם יחסית לאזור הגלילה ולא למסך — כך שאם גללת לתחתית הרשימה, החלון
//   נפתח הרחק למטה ונראה כאילו "לא קרה כלום".
//
//   רינדור דרך Portal אל document.body מוציא את החלון מה-containing block
//   הזה — הוא תמיד מכסה את המסך האמיתי, בלי לגעת במיקום הגלילה של הרקע.
// ─────────────────────────────────────────────────────────────
import { createPortal } from 'react-dom'

export default function ModalPortal({ children }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
