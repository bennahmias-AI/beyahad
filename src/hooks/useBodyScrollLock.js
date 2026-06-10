// src/hooks/useBodyScrollLock.js
// ─────────────────────────────────────────────────────────────
// נועל את גלילת הרקע כל עוד חלון (מודאל) פתוח.
//
// למה: חלונות הפרטים (מתכון/עצה) הם position:fixum מעל כל המסך. בלי
// נעילה, אם המשתמש גלל למטה ברשימה ואז פתח פריט — הרקע ממשיך להיות
// גלול והחלון "נראה" כאילו לא קרה כלום (במיוחד מבלבל למבוגרים).
//
// כשהחלון נפתח: שומרים את מיקום הגלילה, מקפיאים את ה-body (position:fixed)
// כך שהרקע לא זז וברור מיד שנפתח חלון. כשנסגר: משחזרים את הגלילה בדיוק
// למקום שהיה. עובד גם ב-iOS (שם overflow:hidden לבדו לא מספיק).
//
// שימוש:  useBodyScrollLock(isOpen)
// ─────────────────────────────────────────────────────────────
import { useEffect } from 'react'

export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return
    const scrollY = window.scrollY || window.pageYOffset || 0
    const body = document.body
    // שומרים את הסגנונות המקוריים כדי לשחזר בדיוק
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    // מקפיאים את ה-body במקום (כולל iOS)
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'

    return () => {
      // משחזרים את הסגנונות וקופצים חזרה למיקום הגלילה המקורי
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.left = prev.left
      body.style.right = prev.right
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      window.scrollTo(0, scrollY)
    }
  }, [locked])
}
