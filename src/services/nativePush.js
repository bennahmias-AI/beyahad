// אתחול התראות Push לאפליקציה הנייטיב (Capacitor / Android).
// רץ אך ורק כשהקוד רץ בתוך האפליקציה הנייטיב — בדפדפן רגיל (PWA)
// לא נוגעים בכלום, וממשיכים להשתמש במסלול ה-web הקיים (firebase.js).
//
// מה הוא עושה:
//   1. יוצר ערוץ התראות "calls" עם צלצול (res/raw/ringtone.ogg) בחשיבות מקסימלית —
//      כך שיחה נכנסת מצלצלת ומקפיצה באנר גם כשהאפליקציה סגורה.
//   2. יוצר ערוץ "messages" להודעות צ׳אט/כלליות (צליל ברירת מחדל).
//   3. מבקש הרשאת התראות, נרשם ל-FCM, ושומר את ה-token תחת המשתמש
//      (בשדה fcmTokensNative — נפרד מטוקני הדפדפן).
//   4. הקשה על התראה פותחת את האפליקציה; ה-listeners הקיימים
//      (VideoCallListener / פעמון ההתראות) כבר יציגו את התוכן הנכון.

import { Capacitor } from '@capacitor/core'
import { saveNativeFcmToken } from './firebase.js'

// האם רצים בתוך האפליקציה הנייטיב (ולא בדפדפן רגיל)?
export function isNativeApp() {
  try { return Capacitor?.isNativePlatform?.() === true } catch { return false }
}

let _inited = false

export async function initNativePush(uid) {
  if (!isNativeApp() || !uid || _inited) return
  _inited = true

  // טוענים את התוסף רק בנייטיב (import דינמי — לא נטען בבילד ה-web)
  const { PushNotifications } = await import('@capacitor/push-notifications')

  // ── 1. ערוצי התראות ──
  try {
    await PushNotifications.createChannel({
      id: 'calls',
      name: 'שיחות',
      description: 'שיחות וידאו וקול נכנסות',
      sound: 'ringtone.ogg',   // הקובץ שב-android/app/src/main/res/raw/ringtone.ogg
      importance: 5,           // MAX — באנר קופץ + צלצול
      visibility: 1,           // מוצג על מסך הנעילה
      vibration: true,
      lights: true,
    })
    await PushNotifications.createChannel({
      id: 'messages',
      name: 'הודעות',
      description: 'הודעות צ׳אט והתראות כלליות',
      importance: 4,           // HIGH — צליל ברירת מחדל
      visibility: 1,
      vibration: true,
    })
  } catch (e) {
    console.warn('createChannel error:', e)
  }

  // ── 2. מאזינים (נרשמים לפני register כדי לא לפספס את אירוע הרישום) ──
  try {
    PushNotifications.addListener('registration', (token) => {
      saveNativeFcmToken(uid, token.value)
    })
    PushNotifications.addListener('registrationError', (err) => {
      console.warn('native push registrationError:', err)
    })
    // הקשה על התראה — די בפתיחת האפליקציה: ה-VideoCallListener יזהה שיחה
    // "מצלצלת" ויציג את מסך המענה; הפעמון יציג הודעות.
    PushNotifications.addListener('pushNotificationActionPerformed', () => {})
  } catch (e) {
    console.warn('native push listeners error:', e)
  }

  // ── 3. הרשאה + רישום ל-FCM ──
  try {
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') return
    await PushNotifications.register()
  } catch (e) {
    console.warn('native push register error:', e)
  }
}

// אתחול מראה נייטיב: דוחף את התוכן אל מתחת לשורת הסטטוס של הטלפון
// (אחרת התוכן נדבק לשעה/סוללה שבראש המסך). נייטיב בלבד — הווב לא מושפע.
let _uiInited = false
export async function initNativeUI() {
  if (!isNativeApp() || _uiInited) return
  _uiInited = true
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setOverlaysWebView({ overlay: false }) // ה-WebView מתחיל מתחת לשורת הסטטוס
    await StatusBar.setStyle({ style: Style.Light })        // אייקונים כהים (מתאים לרקע בהיר)
    await StatusBar.setBackgroundColor({ color: '#F6F0E3' })// קרם — תואם את רקע האפליקציה
  } catch (e) {
    console.warn('initNativeUI error:', e)
  }
}
