// src/utils/pauseMusicOnBackground.js
// ─────────────────────────────────────────────────────────────
// עצירת מוזיקת הרקע של המשחקים כשהאפליקציה עוברת לרקע / המסך נכבה.
//
// הבעיה: באפליקציה המותקנת (Capacitor), כשמכבים מסך או יוצאים מהאפליקציה
// בלי לסגור אותה לגמרי — מוזיקת המשחק ממשיכה לנגן.
//
// הפתרון: מאזין גלובלי יחיד. כשהדף עובר ל-hidden (מסך כבוי / רקע),
// עוצרים כל אלמנט <audio> שמנגן קובץ מתוך התיקייה /music/ (אלו רצועות
// מוזיקת המשחקים מ-MUSIC_TRACKS). מה שלא עוצרים בכוונה:
//   • הרדיו — מנגן כתובת סטרים (לא /music/), וצריך להמשיך ברקע.
//   • שיחות וידאו (LiveKit) — משתמשות ב-MediaStream (בלי src של /music/).
//
// כשחוזרים לאפליקציה המוזיקה נשארת מושהית עד שהמשתמש נוגע במסך שוב
// (ה-kick של המשחק) — וזו בדיוק ההתנהגות הרצויה: שקט כשיוצאים.
// ─────────────────────────────────────────────────────────────

let installed = false

function pauseGameMusic() {
  try {
    const audios = document.querySelectorAll('audio')
    audios.forEach((a) => {
      try {
        const src = a.currentSrc || a.src || ''
        // רק רצועות מוזיקת המשחקים (קבצים מ-/music/) — לא הרדיו ולא שיחות וידאו
        if (src.includes('/music/') && !a.paused) {
          a.pause()
        }
      } catch (e) { /* ignore single element */ }
    })
  } catch (e) { /* ignore */ }
}

export function installMusicAutoPause() {
  if (installed || typeof document === 'undefined') return
  installed = true

  // מסך כבוי / מעבר לרקע — ה-WebView מסמן את הדף כ-hidden
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pauseGameMusic()
  })

  // יציאה / פריקה של הדף — רשת ביטחון נוספת
  window.addEventListener('pagehide', pauseGameMusic)
}

// התקנה אוטומטית עם הטעינה
installMusicAutoPause()
