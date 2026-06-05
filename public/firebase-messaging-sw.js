/* public/firebase-messaging-sw.js */
/* ─────────────────────────────────────────────────────────────
 * Service Worker עבור התראות Push (Firebase Cloud Messaging).
 *
 * רץ ברקע ומציג התראות גם כשהאפליקציה סגורה לגמרי.
 * נפרד מ-SW ה-PWA (sw.js / Workbox) — לכל אחד תפקיד משלו.
 *
 * הערה: SW לא יכול לקרוא משתני env (import.meta.env), לכן הקונפיג
 * כתוב כאן ישירות. אלה ערכים ציבוריים (client config) — לא סוד.
 * ───────────────────────────────────────────────────────────── */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyBDktFMpuQki9R50k-gHyc0W6jTqgMt4Bc',
  authDomain: 'bennah-960eb.firebaseapp.com',
  projectId: 'bennah-960eb',
  storageBucket: 'bennah-960eb.firebasestorage.app',
  messagingSenderId: '705995824315',
  appId: '1:705995824315:web:cd4701b327ba6c15da1d9e',
})

const messaging = firebase.messaging()

// QUIET HOURS: 19:00 -> 08:00. non-urgent stays silent; calls always ring.
const QUIET_START = 19
const QUIET_END = 8
function isQuietHours() {
  const h = new Date().getHours()
  return h >= QUIET_START || h < QUIET_END
}

// מתי שמגיעה התראת רקע (האפליקציה סגורה / ברקע) — מציגים אותה.
// ה-payload מגיע מה-Cloud Function. אנו תומכים גם ב-data וגם ב-notification.
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {}
  const notif = payload.notification || {}

  const title = notif.title || data.title || 'ביחד'
  const body  = notif.body  || data.body  || ''

  // סוג ההתראה קובע אם יש צליל ואיך היא מתנהגת
  // type: 'call' | 'chat' | 'invite' | 'like' | 'friend' | ...
  const type = data.type || 'general'

  // שיחה תמיד דחופה (גם בלילה). צ'אט/הזמנה דחופים רק מחוץ לשעות שקט
  const isCall = type === 'call'
  // השרת קובע אם ההתראה שקטה (לפי הגדרות הצליל של המשתמש); שיחה תמיד מצלצלת
  const silent = data.silent === '1' && !isCall
  const urgent = !silent

  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl',
    lang: 'he',
    tag: data.tag || type,
    renotify: urgent,
    requireInteraction: isCall,
    silent,
    vibrate: urgent ? [200, 100, 200] : undefined,
    data: {
      ...data,
      url: data.url || '/',
    },
  }

  return self.registration.showNotification(title, options)
})

// לחיצה על ההתראה — פותחת/ממקדת את האפליקציה ומנווטת ליעד הרלוונטי.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // אם האפליקציה כבר פתוחה — ממקדים אותה
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'notification-click', data: event.notification.data })
          return client.focus()
        }
      }
      // אחרת — פותחים חלון חדש
      if (clients.openWindow) return clients.openWindow(targetUrl)
    })
  )
})
