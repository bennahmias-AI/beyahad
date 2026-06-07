// api/notify-test.js
// ─────────────────────────────────────────────────────────────
// ⚠️ כלי אבחון זמני להתראות Push. למחוק אחרי שמסיימים!
//
// בודק את כל שרשרת השליחה ומחזיר תשובה קריאה בדפדפן (JSON), בלי
// לחשוף סודות. השליחה האמיתית עוברת באותו מנגנון כמו api/notify.js.
//
// שימוש (פותחים בדפדפן):
//   /api/notify-test?t=beyahad-diag-7731
//       → בודק נוכחות משתני סביבה + אתחול Admin SDK + אימות מול Firestore
//   /api/notify-test?t=beyahad-diag-7731&uid=UID
//       → גם מצב ה-tokens של משתמש מסוים (כמה, והאם ההתראות מופעלות)
//   /api/notify-test?t=beyahad-diag-7731&uid=UID&send=1
//       → שולח התראת בדיקה אמיתית למשתמש הזה, ומחזיר מה הצליח/נכשל
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

  // שמירה קלה — בלי הטוקן הזה לא רצים (כדי שלא כל אחד יוכל לשלוח התראות)
  if ((req.query.t || '') !== DIAG_TOKEN) {
    return res.status(403).send(JSON.stringify({ ok: false, error: 'forbidden — add ?t=beyahad-diag-7731' }, null, 2))
  }

  const out = { ok: false, steps: {} }

  // ── שלב 1: נוכחות + מבנה משתני הסביבה (בלי לחשוף את הערכים עצמם) ──
  const pk = process.env.FIREBASE_PRIVATE_KEY || ''
  out.steps['1_env'] = {
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '(MISSING)',
    FIREBASE_CLIENT_EMAIL_present: !!process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY_present: !!pk,
    FIREBASE_PRIVATE_KEY_length: pk.length,
    // אמור להתחיל ב "-----BEGIN PRIVATE KEY-----" אם המבנה תקין
    FIREBASE_PRIVATE_KEY_startsWith: pk.slice(0, 27),
    FIREBASE_PRIVATE_KEY_endsWith: pk.slice(-30),
    has_escaped_newlines_backslash_n: pk.includes('\\n'),
    has_real_newlines: pk.includes('\n'),
  }

  // ── שלב 2: אתחול ה-Admin SDK ──
  let app
  try {
    app = getAdminApp()
    out.steps['2_adminInit'] = 'OK'
  } catch (e) {
    out.steps['2_adminInit'] = 'FAILED: ' + (e && e.message)
    return res.status(200).send(JSON.stringify(out, null, 2))
  }

  // ── שלב 3: קריאה אמיתית מ-Firestore (מאמת את חשבון השירות מול גוגל) ──
  try {
    await admin.firestore(app).collection('users').limit(1).get()
    out.steps['3_firestoreAuth'] = 'OK'
  } catch (e) {
    out.steps['3_firestoreAuth'] = 'FAILED: ' + (e && e.message)
    return res.status(200).send(JSON.stringify(out, null, 2))
  }

  // ── שלב 4 (אם הועבר uid): מצב ה-tokens של המשתמש ──
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
        }

        // ── שלב 5 (אם הועבר send=1): שליחת התראת בדיקה אמיתית ──
        if (req.query.send === '1') {
          if (!tokens.length) {
            out.steps['5_send'] = 'SKIPPED — no tokens for this user'
          } else {
            const message = {
              tokens,
              data: {
                type: 'system',
                title: 'בדיקת התראות ✓',
                body: 'אם קיבלת את ההתראה הזו — השליחה עובדת!',
                url: '/',
                tag: 'diag',
                silent: '0',
              },
              android: { priority: 'high' },
              webpush: { headers: { Urgency: 'high', TTL: '600' } },
            }
            const resp = await admin.messaging(app).sendEachForMulticast(message)
            out.steps['5_send'] = {
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
