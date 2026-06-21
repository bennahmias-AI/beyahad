// api/notify-suggestion.js
// ─────────────────────────────────────────────────────────────
// מודיע למנהל/ים במייל כשמתקבלת הצעת משחק חדשה — Vercel serverless.
//
// הזרימה:
//   1. הלקוח (submitGameSuggestion) שומר את ההצעה ב-Firestore, ואז
//      שולח POST לכאן עם { name, text }.
//   2. כאן אוספים נמענים: SUGGESTIONS_EMAIL (רשימה מופרדת בפסיקים) +
//      המייל של כל המשתמשים עם role=='admin'.
//   3. שולחים מייל דרך Resend.
//
// best-effort: גם אם המייל נכשל, ההצעה כבר נשמרה ותופיע בפאנל הניהול.
//
// משתני סביבה (ב-Vercel):
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY  (כבר קיימים)
//   RESEND_API_KEY, RESEND_FROM                                       (כבר קיימים)
//   SUGGESTIONS_EMAIL  — אופציונלי: כתובת/כתובות לקבלת ההתראות (מופרד בפסיקים).
//                        אם ריק — נשלח למייל של מנהלי המערכת.
// ─────────────────────────────────────────────────────────────
import admin from 'firebase-admin'

function getAdminApp() {
  if (admin.apps.length) return admin.app()
  const projectId   = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  let   privateKey  = process.env.FIREBASE_PRIVATE_KEY
  if (privateKey && privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n')
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  })
}

function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim()) }

async function adminEmails(db) {
  try {
    const snap = await db.collection('users').where('role', '==', 'admin').get()
    return snap.docs.map(d => d.data().email).filter(isValidEmail)
  } catch (e) {
    console.error('adminEmails error:', e)
    return []
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

async function sendViaResend(recipients, name, text) {
  const apiKey = process.env.RESEND_API_KEY
  const from   = process.env.RESEND_FROM || 'onboarding@resend.dev'
  if (!apiKey) throw new Error('RESEND_API_KEY missing')

  const safeText = escapeHtml(text).replace(/\n/g, '<br/>')
  const safeName = escapeHtml(name || 'משתמש')
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; text-align: right;">
      <h1 style="color: #7E2C2E; font-size: 22px; margin-bottom: 4px;">הצעת משחק חדשה 💡</h1>
      <p style="font-size: 15px; color: #4A5274; margin: 0 0 16px;">מאת: <strong>${safeName}</strong></p>
      <div style="font-size: 16px; color: #1B2540; line-height: 1.6; background: #F6F0E3; border-radius: 12px; padding: 16px 18px;">
        ${safeText}
      </div>
      <p style="font-size: 13px; color: #8389A4; line-height: 1.6; margin-top: 18px;">
        אפשר לראות, לסמן כטופל או למחוק בבקרת הניהול (?admin).
      </p>
      <p style="font-size: 14px; color: #4A5274; margin-top: 18px;">צוות ביחד 💙</p>
    </div>
  `
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `ביחד <${from}>`,
      to: recipients,
      subject: `הצעת משחק חדשה מאת ${name || 'משתמש'}`,
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
    const { name, text } = req.body || {}
    if (!text || !String(text).trim()) return res.status(400).json({ ok: false, reason: 'empty' })

    // נמענים: מ-ENV (ברירת מחדל = המייל של בן) + מנהלים
    const envList = String(process.env.SUGGESTIONS_EMAIL || 'bennahmias@gmail.com')
      .split(',').map(s => s.trim()).filter(isValidEmail)

    const app = getAdminApp()
    const db = admin.firestore(app)
    const admins = await adminEmails(db)

    const recipients = [...new Set([...envList, ...admins])]
    if (recipients.length === 0) {
      // אין למי לשלוח — לא שגיאה (ההצעה כבר נשמרה בפאנל)
      return res.status(200).json({ ok: true, emailed: 0, reason: 'no-recipients' })
    }

    await sendViaResend(recipients, name, String(text).slice(0, 1000))
    return res.status(200).json({ ok: true, emailed: recipients.length })
  } catch (e) {
    console.error('notify-suggestion error:', e)
    return res.status(500).json({ ok: false, reason: 'error', error: e.message })
  }
}
