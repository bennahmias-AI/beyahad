// src/pages/AdminDashboardResponsive.jsx
// מתג תצוגה לבקרת הניהול: במסכים צרים (טלפון) מציג את AdminDashboard
// המקורי; במסכים רחבים (מחשב, ≥1024px) מציג את AdminDashboardDesktop.
// מאזין לשינויי רוחב כך שגם סיבוב/שינוי גודל חלון מתחלף חלק.
import { useState, useEffect } from 'react'
import AdminDashboard from './AdminDashboard.jsx'
import AdminDashboardDesktop from './AdminDashboardDesktop.jsx'

const DESKTOP_QUERY = '(min-width: 1024px)'

export default function AdminDashboardResponsive(props) {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches
  )

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY)
    const handler = e => setIsDesktop(e.matches)
    setIsDesktop(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isDesktop
    ? <AdminDashboardDesktop {...props} />
    : <AdminDashboard {...props} />
}
