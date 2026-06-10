// api/send-email-code.js
// ─────────────────────────────────────────────────────────────
// שולח קוד אימות חד-פעמי (6 ספרות) למייל — Vercel serverless.
//
// הזרימה:
//   1. הלקוח שולח { email }.
//   2. מייצרים קוד אקראי בן 6 ספרות.
//   3. שומרים ב-Firestore (emailCodes/{emailKey}) רק את ה-HASH של הקוד
//      (לא הקוד עצמו), עם חותמת זמן ותוקף 10 דקות ומונה ניסיונות.
//   4. שולחים מייל עם הקוד דרך Resend.
//
// אבטחה:
//   • הקוד עצמו לעולם לא נשמר — רק SHA-256 שלו. גם אם מישהו יקרא את
//     המסמך, אי אפשר לשחזר ממנו את הקוד.
//   • rate-limit: לא שולחים קוד חדש לאותו מייל יותר מפעם ב-30 שניות.
//   • האוסף emailCodes חסום לגמרי בכללי Firestore (אף לקוח לא ניגש אליו);
//     רק ה-Admin SDK בשרת קורא/כותב בו.
//
// משתני סביבה (ב-Vercel):
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY  (כבר קיימים)
//   RESEND_API_KEY      — מפתח ה-API מ-resend.com
//   RESEND_FROM         — כתובת השולח (למשל onboarding@resend.dev בהתחלה)
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

// מנרמל מייל למפתח מסמך בטוח (אותיות קטנות, ללא תווים בעייתיים)
function emailKeyOf(email) {
  return String(email).trim().toLowerCase().replace(/[^a-z0-9]/g, '_')
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}
function hashCode(code, email) {
  // ה-hash כולל גם את המייל כ-salt קל, כך שאותו קוד למיילים שונים שונה
  return crypto.createHash('sha256').update(`${code}:${email.toLowerCase()}`).digest('hex')
}

async function sendViaResend(toEmail, code) {
  const apiKey = process.env.RESEND_API_KEY
  const from   = process.env.RESEND_FROM || 'onboarding@resend.dev'
  if (!apiKey) throw new Error('RESEND_API_KEY missing')

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; text-align: right;">
      <h1 style="color: #7E2C2E; font-size: 24px; margin-bottom: 8px;">קוד הכניסה שלך לביחד</h1>
      <p style="font-size: 16px; color: #4A5274; line-height: 1.6;">
        הזן את הקוד הבא במסך האימות באפליקציה:
      </p>
      <div style="font-size: 38px; font-weight: bold; letter-spacing: 8px; color: #1B2540;
                  background: #F6F0E3; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
        ${code}
      </div>
      <p style="font-size: 14px; color: #8389A4; line-height: 1.6;">
        הקוד תקף ל-10 דקות. אם לא ביקשת קוד זה, אפשר להתעלם מההודעה.
      </p>
      <p style="font-size: 15px; color: #4A5274; margin-top: 24px;">בברכה,<br/>צוות ביחד 💙</p>
    </div>
  `

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `ביחד <${from}>`,
      to: [toEmail],
      subject: `קוד הכניסה שלך: ${code}`,
      html,
    }),
  })

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`resend failed: ${resp.status} ${txt}`)
  }
  return true
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, reason: 'POST only' })

  try {
    const { email } = req.body || {}
    if (!isValidEmail(email)) return res.status(400).json({ ok: false, reason: 'bad-email' })

    const app = getAdminApp()
    const db = admin.firestore(app)
    const key = emailKeyOf(email)
    const ref = db.collection('emailCodes').doc(key)

    // rate-limit: לא יותר מפעם ב-30 שניות
    const existing = await ref.get()
    if (existing.exists) {
      const last = existing.data().sentAt?.toMillis?.() || 0
      if (Date.now() - last < 30 * 1000) {
        return res.status(429).json({ ok: false, reason: 'too-soon' })
      }
    }

    // מייצרים קוד 6 ספרות (100000–999999)
    const code = String(crypto.randomInt(100000, 1000000))
    const codeHash = hashCode(code, email)

    await ref.set({
      email: String(email).trim().toLowerCase(),
      codeHash,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
      attempts: 0,
      verified: false,
    })

    await sendViaResend(String(email).trim(), code)

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('send-email-code error:', e)
    return res.status(500).json({ ok: false, reason: 'error', error: e.message })
  }
}
