// api/verify-email-code.js
// ─────────────────────────────────────────────────────────────
// מאמת קוד שנשלח במייל, ואם תקין — מחזיר Firebase custom token
// שהלקוח משתמש בו כדי להתחבר (signInWithCustomToken).
//
// הזרימה:
//   1. הלקוח שולח { email, code }.
//   2. שולפים את המסמך emailCodes/{key}, בודקים תוקף + מספר ניסיונות.
//   3. משווים SHA-256 של הקוד שהוזן מול ה-hash השמור.
//   4. אם תקין: מוצאים משתמש Auth קיים עם המייל הזה (לפי email ב-Auth,
//      ואם אין — לפי שדה email במסמך users), או יוצרים חדש.
//   5. מחזירים custom token ל-uid הזה.
//
// אבטחה:
//   • עד 5 ניסיונות שגויים — אחר כך הקוד ננעל וצריך לבקש חדש.
//   • הקוד נמחק (verified) אחרי שימוש מוצלח — לא ניתן לשימוש חוזר.
//   • התאמת המשתמש מבוססת על המייל שאומת בלבד.
//
// משתני סביבה: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// ─────────────────────────────────────────────────────────────
import admin from 'firebase-admin'
import crypto from 'crypto'

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

function emailKeyOf(email) {
  return String(email).trim().toLowerCase().replace(/[^a-z0-9]/g, '_')
}
function hashCode(code, email) {
  return crypto.createHash('sha256').update(`${code}:${email.toLowerCase()}`).digest('hex')
}

// מוצא משתמש Auth קיים לפי המייל; אם אין — מחפש לפי שדה email במסמכי users;
// אם עדיין אין — יוצר משתמש Auth חדש. מחזיר uid.
async function resolveUid(auth, db, email) {
  const clean = String(email).trim().toLowerCase()

  // 1) משתמש Auth עם המייל הזה
  try {
    const u = await auth.getUserByEmail(clean)
    if (u) return u.uid
  } catch (e) {
    if (e?.code !== 'auth/user-not-found') throw e
  }

  // 2) מסמך users עם שדה email תואם (משתמשים ותיקים שנוצרו עם טלפון)
  try {
    const snap = await db.collection('users').where('email', '==', clean).limit(1).get()
    if (!snap.empty) return snap.docs[0].id
  } catch (e) {
    console.error('verify-email-code: users lookup failed:', e)
  }

  // 3) יוצרים משתמש Auth חדש
  const created = await auth.createUser({ email: clean, emailVerified: true })
  return created.uid
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, reason: 'POST only' })

  try {
    const { email, code } = req.body || {}
    if (!email || !code) return res.status(400).json({ ok: false, reason: 'missing' })

    const app = getAdminApp()
    const auth = admin.auth(app)
    const db = admin.firestore(app)
    const key = emailKeyOf(email)
    const ref = db.collection('emailCodes').doc(key)

    const snap = await ref.get()
    if (!snap.exists) return res.status(400).json({ ok: false, reason: 'no-code' })

    const data = snap.data()

    // תוקף
    const expires = data.expiresAt?.toMillis?.() || 0
    if (Date.now() > expires) {
      return res.status(400).json({ ok: false, reason: 'expired' })
    }
    // מספר ניסיונות
    if ((data.attempts || 0) >= 5) {
      return res.status(429).json({ ok: false, reason: 'too-many-attempts' })
    }
    // כבר נוצל
    if (data.verified) {
      return res.status(400).json({ ok: false, reason: 'used' })
    }

    // השוואת הקוד
    const given = hashCode(String(code).trim(), data.email)
    if (given !== data.codeHash) {
      await ref.update({ attempts: (data.attempts || 0) + 1 })
      return res.status(400).json({ ok: false, reason: 'wrong-code' })
    }

    // תקין — מסמנים כמנוצל ומחזירים custom token
    await ref.update({ verified: true })
    const uid = await resolveUid(auth, db, data.email)
    const token = await auth.createCustomToken(uid)

    return res.status(200).json({ ok: true, token, uid })
  } catch (e) {
    console.error('verify-email-code error:', e)
    return res.status(500).json({ ok: false, reason: 'error', error: e.message })
  }
}
