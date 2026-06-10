// api/set-email.js
// ─────────────────────────────────────────────────────────────
// מצמיד/מעדכן כתובת מייל בחשבון Auth קיים של משתמש — Vercel serverless.
// תאום ל-set-phone.js. משמש את האדמין כדי לשנות ידנית מייל של לקוח
// מכרטיס הלקוח בפאנל הניהול.
//
// מעדכן את שני המקומות:
//   1. כתובת המייל בחשבון ה-Auth (auth.updateUser) — כך כניסה בקוד-מייל
//      תמצא את המשתמש לפי המייל הזה.
//   2. שדה email במסמך users/{uid} (לתצוגה ועקביות).
//
// אבטחה: רק משתמש עם role==='admin' (לפי מסמך users שלו) יכול לקרוא.
// הקורא שולח את ה-ID token שלו ב-Authorization: Bearer <token>.
//
// משתני סביבה (כבר מוגדרים ב-Vercel):
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

// ולידציה בסיסית של מייל. מחזיר את המייל באותיות קטנות, או null אם לא תקין.
function normalizeEmail(input) {
  if (!input) return null
  const s = String(input).trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null
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
    const { uid, email } = req.body || {}
    if (!uid || !email) return res.status(400).json({ ok: false, reason: 'missing' })

    const clean = normalizeEmail(email)
    if (!clean) return res.status(400).json({ ok: false, reason: 'bad-email' })

    // 4) מעדכנים את המייל בחשבון ה-Auth הקיים
    try {
      await auth.updateUser(uid, { email: clean })
    } catch (e) {
      const code = e?.code || ''
      if (code === 'auth/email-already-exists') {
        // המייל כבר שייך לחשבון Auth אחר
        return res.status(409).json({ ok: false, reason: 'email-taken' })
      }
      if (code === 'auth/user-not-found') {
        return res.status(404).json({ ok: false, reason: 'user-not-found' })
      }
      if (code === 'auth/invalid-email') {
        return res.status(400).json({ ok: false, reason: 'bad-email' })
      }
      throw e
    }

    // 5) מעדכנים גם את מסמך המשתמש (לתצוגה/עקביות)
    try {
      await db.collection('users').doc(uid).set(
        { email: clean, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      )
    } catch (e) {
      console.error('set-email: doc update failed:', e)
      // לא קריטי — העדכון ב-Auth הצליח
    }

    return res.status(200).json({ ok: true, email: clean })
  } catch (e) {
    console.error('set-email error:', e)
    return res.status(500).json({ ok: false, reason: 'error', error: e.message })
  }
}
