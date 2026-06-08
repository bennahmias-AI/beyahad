// api/notify.js
// ─────────────────────────────────────────────────────────────
// שולח התראות Push (FCM) — Vercel serverless function.
//
// הלקוח קורא ל-POST /api/notify אחרי אירוע (שיחה / הודעה / הזמנה למשחק),
// והשרת שולח push לכל המכשירים השמורים של הנמען.
//
// שני סוגי מכשירים, כל אחד עם פורמט שונה:
//   • דפדפן (PWA)   — users/{uid}.fcmTokens       → data-only; ה-Service
//                     Worker (firebase-messaging-sw.js) מציג את ההתראה.
//   • אפליקציה נייטיב — users/{uid}.fcmTokensNative → notification + ערוץ;
//                     שיחה => ערוץ "calls" עם צלצול (ringtone.ogg).
//
// סוג ההתראה + הגדרות הצליל של הנמען קובעים אם תהיה עם צליל (בדפדפן):
//   call   -> לפי soundCalls    (ברירת מחדל: עם צליל)
//   chat   -> לפי soundMessages (ברירת מחדל: עם צליל)
//   invite -> לפי soundGames    (ברירת מחדל: עם צליל)
//   אחר    -> שקט (רק בפעמון)
// בנייטיב הצליל נקבע ע"י הערוץ (וכן ע"י הגדרות המערכת של המשתמש).
//
// משתני סביבה נדרשים (ב-Vercel וב-.env):
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// ─────────────────────────────────────────────────────────────
import admin from 'firebase-admin'

// אתחול חד-פעמי של firebase-admin (serverless יכול לעשות reuse למופע)
function getAdminApp() {
  if (admin.apps.length) return admin.app()

  const projectId   = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  let   privateKey  = process.env.FIREBASE_PRIVATE_KEY

  // ב-.env / Vercel המפתח לרוב נשמר עם \n כתווים — מחזירים לשורות אמיתיות
  if (privateKey && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n')
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const app = getAdminApp()
    const db = admin.firestore(app)

    const { toUid, type, title, body, url, tag } = req.body || {}
    if (!toUid || !type) {
      return res.status(400).json({ error: 'toUid and type required' })
    }

    const snap = await db.collection('users').doc(toUid).get()
    if (!snap.exists) return res.status(200).json({ ok: false, reason: 'no-user' })

    const user = snap.data() || {}
    const webTokens    = Array.isArray(user.fcmTokens)       ? user.fcmTokens       : []
    const nativeTokens = Array.isArray(user.fcmTokensNative) ? user.fcmTokensNative : []
    if (user.notificationsEnabled === false || (webTokens.length === 0 && nativeTokens.length === 0)) {
      return res.status(200).json({ ok: false, reason: 'no-tokens-or-disabled' })
    }

    // האם ההתראה תהיה עם צליל — לפי סוג + הגדרות המשתמש (ברירת מחדל: עם צליל)
    const soundCalls    = user.soundCalls    !== false
    const soundMessages = user.soundMessages !== false
    const soundGames    = user.soundGames    !== false
    let sound = false
    if (type === 'call')        sound = soundCalls
    else if (type === 'chat')   sound = soundMessages
    else if (type === 'invite') sound = soundGames
    const silent = sound ? '0' : '1'

    const messaging = admin.messaging(app)

    // עוזר: ניקוי טוקנים שכבר לא תקפים (מכשיר שהוסר / הרשאה בוטלה) ממערך נתון
    const cleanupInvalid = async (responses, tokensArr, field) => {
      const invalid = []
      responses.forEach((r, i) => {
        if (!r.success) {
          const code = (r.error && r.error.code) || ''
          if (code.includes('registration-token-not-registered') ||
              code.includes('invalid-registration-token') ||
              code.includes('invalid-argument')) {
            invalid.push(tokensArr[i])
          }
        }
      })
      if (invalid.length) {
        try {
          await db.collection('users').doc(toUid).update({
            [field]: admin.firestore.FieldValue.arrayRemove(...invalid),
          })
        } catch (e) { console.error('token cleanup failed:', field, e) }
      }
    }

    let sent = 0, failed = 0

    // ───── דפדפן (PWA) — data-only; ה-Service Worker מציג את ההתראה ─────
    if (webTokens.length) {
      const webMessage = {
        tokens: webTokens,
        data: {
          type:  String(type),
          title: String(title || 'ביחד'),
          body:  String(body || ''),
          url:   String(url || '/'),
          tag:   String(tag || type),
          silent,
        },
        android: { priority: 'high' },
        webpush: { headers: { Urgency: 'high', TTL: '600' } },
      }
      const resp = await messaging.sendEachForMulticast(webMessage)
      sent += resp.successCount; failed += resp.failureCount
      await cleanupInvalid(resp.responses, webTokens, 'fcmTokens')
    }

    // ───── אפליקציה נייטיב — notification + ערוץ; שיחה => "calls" עם צלצול ─────
    if (nativeTokens.length) {
      const channelId = type === 'call' ? 'calls' : 'messages'
      const nativeMessage = {
        tokens: nativeTokens,
        notification: {
          title: String(title || 'ביחד'),
          body:  String(body || ''),
        },
        data: {
          type: String(type),
          url:  String(url || '/'),
          tag:  String(tag || type),
        },
        android: {
          priority: 'high',
          notification: {
            channelId,            // הערוץ קובע את הצליל (ringtone.ogg לערוץ calls)
            tag: String(tag || type),
          },
        },
      }
      const resp = await messaging.sendEachForMulticast(nativeMessage)
      sent += resp.successCount; failed += resp.failureCount
      await cleanupInvalid(resp.responses, nativeTokens, 'fcmTokensNative')
    }

    return res.status(200).json({ ok: true, sent, failed })
  } catch (e) {
    console.error('notify error:', e)
    return res.status(500).json({ error: e.message })
  }
}
