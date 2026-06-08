// api/notify-test.js
// ─────────────────────────────────────────────────────────────
// ⚠️ כלי אבחון זמני להתראות Push. למחוק אחרי שמסיימים!
//
// שימוש (פותחים בדפדפן):
//   /api/notify-test?t=beyahad-diag-7731
//       → בודק משתני סביבה + Admin SDK + Firestore
//   /api/notify-test?t=beyahad-diag-7731&uid=UID
//       → גם מצב ה-tokens (כמה, סיומת כל אחד, והאם מופעל)
//   /api/notify-test?t=beyahad-diag-7731&uid=UID&send=1
//       → שולח התראת בדיקה (data-only — כמו ההתראות הרגילות היום)
//   /api/notify-test?t=beyahad-diag-7731&uid=UID&send=1&notif=1
//       → שולח התראה שאנדרואיד מציג בעצמו (notification payload)
// ─────────────────────────────────────────────────────────────
import admin from 'firebase-admin'

const DIAG_TOKEN = 'beyahad-diag-7731'

function getAdminApp() {
  if (admin.apps.length) return admin.app()
  const projectId   = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  let   privateKey  = process.env.FIREBASE_PRIVATE_KEY
  if (privateKey && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n')
  }
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  })
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if ((req.query.t || '') !== DIAG_TOKEN) {
    return res.status(403).send(JSON.stringify({ ok: false, error: 'forbidden — add ?t=beyahad-diag-7731' }, null, 2))
  }

  const out = { ok: false, steps: {} }

  const pk = process.env.FIREBASE_PRIVATE_KEY || ''
  out.steps['1_env'] = {
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '(MISSING)',
    FIREBASE_CLIENT_EMAIL_present: !!process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY_present: !!pk,
    FIREBASE_PRIVATE_KEY_length: pk.length,
  }

  let app
  try {
    app = getAdminApp()
    out.steps['2_adminInit'] = 'OK'
  } catch (e) {
    out.steps['2_adminInit'] = 'FAILED: ' + (e && e.message)
    return res.status(200).send(JSON.stringify(out, null, 2))
  }

  try {
    await admin.firestore(app).collection('users').limit(1).get()
    out.steps['3_firestoreAuth'] = 'OK'
  } catch (e) {
    out.steps['3_firestoreAuth'] = 'FAILED: ' + (e && e.message)
    return res.status(200).send(JSON.stringify(out, null, 2))
  }

  const uid = req.query.uid ? String(req.query.uid) : ''
  if (uid) {
    try {
      const snap = await admin.firestore(app).collection('users').doc(uid).get()
      if (!snap.exists) {
        out.steps['4_user'] = 'no-such-user'
      } else {
        const u = snap.data() || {}
        const tokens = Array.isArray(u.fcmTokens) ? u.fcmTokens : []
        out.steps['4_user'] = {
          notificationsEnabled: u.notificationsEnabled,
          tokenCount: tokens.length,
          // סיומת של כל token — כדי לראות אם מכשיר חדש (טלפון) נוסף לרשימה
          tokensTail: tokens.map(t => '...' + String(t).slice(-12)),
        }

        if (req.query.send === '1') {
          if (!tokens.length) {
            out.steps['5_send'] = 'SKIPPED — no tokens for this user'
          } else {
            const useNotif = req.query.notif === '1'
            const title = useNotif ? 'בדיקה (תצוגת מערכת) ✓' : 'בדיקה (data) ✓'
            const body  = 'אם קיבלת את ההתראה הזו — זה עובד!'

            const message = {
              tokens,
              data: {
                type: 'system', title, body, url: '/', tag: 'diag', silent: '0',
              },
              android: { priority: 'high' },
              webpush: {
                headers: { Urgency: 'high', TTL: '600' },
                // notif=1 → אנדרואיד/הדפדפן מציגים את ההתראה בעצמם, בלי תלות בקוד הרקע
                ...(useNotif ? {
                  notification: {
                    title, body,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    lang: 'he', dir: 'rtl',
                  },
                  fcm_options: { link: '/' },
                } : {}),
              },
            }
            const resp = await admin.messaging(app).sendEachForMulticast(message)
            out.steps['5_send'] = {
              method: useNotif ? 'notification-payload (system-displayed)' : 'data-only (app-displayed)',
              successCount: resp.successCount,
              failureCount: resp.failureCount,
              errorCodes: resp.responses.filter(r => !r.success).map(r => (r.error && r.error.code) || 'unknown'),
            }
          }
        }
      }
    } catch (e) {
      out.steps['4_user'] = 'FAILED: ' + (e && e.message)
    }
  }

  out.ok = true
  return res.status(200).send(JSON.stringify(out, null, 2))
}
