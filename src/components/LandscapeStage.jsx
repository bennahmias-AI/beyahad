// src/components/LandscapeStage.jsx
// ─────────────────────────────────────────────────────────────
// עטיפה שמכריחה תצוגת רוחב (landscape) למשחק שבתוכה — בנייד.
//
// גישה: סיבוב-בתוכנה בלבד (ללא נעילת-כיוון של המערכת, שמתנהגת
// שונה בין מכשירים וגרמה לפריסת-רוחב דחוסה על מסך צר).
//
//   • במחשב — לא נוגעים בכלום. מציגים את התוכן כמו שהוא,
//     ו-RummiGameLayout בוחר פריסה לפי מידות החלון.
//   • בנייד המוחזק לאורך (portrait) — מסובבים את כל המשחק 90°
//     עם CSS, ונותנים לו מידות = (גובה-המסך רוחב) × (רוחב-המסך גובה),
//     כך שהוא ממלא בדיוק את כל המסך אבל מוצג לרוחב.
//   • בנייד שכבר מוחזק לרוחב — מציגים כרגיל (אין צורך לסובב).
//
// כך המשחק תמיד מוצג לרוחב בנייד, באופן זהה בכל מכשיר ודפדפן,
// בלי תלות בנעילת-כיוון שלא נתמכת בכל מקום (למשל אייפון).
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'

// האם זה מכשיר מגע אמיתי (טלפון/טאבלט)?
function isTouchDevice() {
  if (typeof window === 'undefined') return false
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)
}

export default function LandscapeStage({ children }) {
  const [dims, setDims] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 0,
    h: typeof window !== 'undefined' ? window.innerHeight : 0,
  }))

  useEffect(() => {
    const update = () => setDims({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  const touch = isTouchDevice()
  const isPortrait = dims.h > dims.w

  // מחשב, או נייד שכבר לרוחב — מציגים כרגיל.
  if (!touch || !isPortrait) {
    return <div style={{ height: '100%', width: '100%' }}>{children}</div>
  }

  // נייד מאונך — מסובבים את כל המשחק 90° כך שייראה לרוחב וימלא את המסך.
  // המסגרת הפנימית מקבלת רוחב=גובה-המסך, גובה=רוחב-המסך, מסובבת 90°
  // סביב הפינה השמאלית-עליונה, ומוזזת חזרה כך שתכסה בדיוק את המסך.
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#1c1108', zIndex: 1 }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: dims.w,                       // מתחילים מהקצה הימני
        width: dims.h,                      // רוחב התוכן = גובה המסך
        height: dims.w,                     // גובה התוכן = רוחב המסך
        transform: 'rotate(90deg)',
        transformOrigin: 'top left',
      }}>
        {children}
      </div>
    </div>
  )
}
