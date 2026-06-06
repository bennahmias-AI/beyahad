// api/set-phone.js
// ─────────────────────────────────────────────────────────────
// מצמיד מספר טלפון לחשבון Auth קיים של משתמש — Vercel serverless.
//
// למה: המשתמשים הוותיקים נוצרו עם מייל+סיסמה (uid מסוים). כשהם
// יתחברו עם טלפון+SMS, Firebase מזהה את המספר ומכניס אותם לאותו
// חשבון קיים — רק אם המספר *מוצמד* לחשבון. כאן האדמין מצמיד אותו.
//
// כך ההגירה שומרת על ה-uid, המידע וההרשאות (כולל האדמין עצמו).
//
// אבטחה: רק משתמש עם role==='admin' (לפי מסמך users שלו ב-Firestore)
// יכול לקרוא ל-endpoint הזה. הקורא שולח את ה-ID token שלו ב-Authorization.
//
// משתני סביבה (כבר מוגדרים ב-Vercel עבור notify.js):
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// ─────────────────────────────────────────────────────────────
import admin from 'firebase-admin'

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

// נרמול מספר ישראלי ל-E.164 (+972...). מחזיר null אם לא תקין.
function normalizeIL(input) {
  if (!input) return null
  let s = String(input).replace(/[\s-]/g, '')
  if (s.startsWith('+')) {
    // כבר בפורמט בינלאומי
  } else if (s.startsWith('0')) {
    s = '+972' + s.slice(1)
  } else if (s.startsWith('972')) {
    s = '+' + s
  } else {
    s = '+972' + s
  }
  return /^\+972\d{8,9}$/.test(s) ? s : null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const app = getAdminApp()
    const auth = admin.auth(app)
    const db = admin.firestore(app)

    // 1) אימות הקורא — חייב ID token תקף
    const authHeader = req.headers.authorization || ''
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!idToken) return res.status(401).json({ ok: false, reason: 'no-token' })

    let caller
    try {
      caller = await auth.verifyIdToken(idToken)
    } catch (e) {
      return res.status(401).json({ ok: false, reason: 'bad-token' })
    }

    // 2) הקורא חייב להיות אדמין (לפי מסמך users שלו)
    const callerSnap = await db.collection('users').doc(caller.uid).get()
    if (!callerSnap.exists || callerSnap.data().role !== 'admin') {
      return res.status(403).json({ ok: false, reason: 'not-admin' })
    }

    // 3) קלט
    const { uid, phone } = req.body || {}
    if (!uid || !phone) return res.status(400).json({ ok: false, reason: 'missing' })

    const e164 = normalizeIL(phone)
    if (!e164) return res.status(400).json({ ok: false, reason: 'bad-phone' })

    // 4) מצמידים את הטלפון לחשבון ה-Auth הקיים
    try {
      await auth.updateUser(uid, { phoneNumber: e164 })
    } catch (e) {
      const code = e?.code || ''
      if (code === 'auth/phone-number-already-exists') {
        // המספר כבר שייך לחשבון Auth אחר (למשל חשבון בדיקה) — צריך לפנות אותו קודם
        return res.status(409).json({ ok: false, reason: 'phone-taken' })
      }
      if (code === 'auth/user-not-found') {
        return res.status(404).json({ ok: false, reason: 'user-not-found' })
      }
      if (code === 'auth/invalid-phone-number') {
        return res.status(400).json({ ok: false, reason: 'bad-phone' })
      }
      throw e
    }

    // 5) מעדכנים גם את מסמך המשתמש (לתצוגה/עקביות)
    try {
      await db.collection('users').doc(uid).set(
        { phone: e164, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      )
    } catch (e) {
      console.error('set-phone: doc update failed:', e)
      // לא קריטי — ההצמדה ב-Auth הצליחה
    }

    return res.status(200).json({ ok: true, phone: e164 })
  } catch (e) {
    console.error('set-phone error:', e)
    return res.status(500).json({ ok: false, reason: 'error', error: e.message })
  }
}
