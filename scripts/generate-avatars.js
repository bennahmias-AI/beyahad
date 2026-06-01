// scripts/generate-avatars.js
// ─────────────────────────────────────────────────────────────
// מחולל אווטרי פרופיל אוטומטי — מתחבר ל-Gemini, מייצר 18 דמויות,
// ושומר אותן ב-public/avatars/ (1.png ... 18.png).
//
// הרצה:
//   node scripts/generate-avatars.js
//
// דורש: מפתח GEMINI_API_KEY בקובץ .env.local או .env
//
// הגנות מובנות:
//   • אם קובץ כבר קיים — מדלג עליו (אפשר להריץ שוב בלי לדרוס).
//   • השהיה בין בקשות כדי לא לעבור את מכסת ה-API.
//
// בנוי באותו דפוס בדיוק כמו generate-backgrounds.js.
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { AVATAR_CATEGORY } from './avatar-prompts.js'

// מנסה קודם .env.local ואם אין — נופל ל-.env (שם המפתח שמור)
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const API_KEY = process.env.GEMINI_API_KEY
const MODEL = 'gemini-2.5-flash-image'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'public', 'avatars')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// שולח בקשה אחת ל-Gemini ומחזיר base64 של התמונה (או null אם נכשל)
async function generateImage(prompt) {
  const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`API error ${res.status}: ${txt.slice(0, 300)}`)
  }

  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts || []
  for (const part of parts) {
    if (part.inlineData?.data) return part.inlineData.data
  }
  return null
}

async function main() {
  if (!API_KEY) {
    console.error('\n❌ חסר מפתח GEMINI_API_KEY בקובץ .env.local')
    console.error('   פתח את .env.local והדבק את המפתח אחרי GEMINI_API_KEY=\n')
    process.exit(1)
  }

  console.log(`\n🎨 מתחיל ליצור אווטרים. מודל: ${MODEL}`)
  console.log(`📁 יעד: ${OUT_DIR}\n`)

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const plan = AVATAR_CATEGORY.variants
  console.log(`── ${AVATAR_CATEGORY.label} (${AVATAR_CATEGORY.dir}) — ${plan.length} אווטרים ──\n`)

  let created = 0, skipped = 0, failed = 0

  for (let idx = 0; idx < plan.length; idx++) {
    const n = idx + 1
    const filePath = path.join(OUT_DIR, `${n}.png`)

    if (fs.existsSync(filePath)) {
      console.log(`  ⏭️  ${n}.png כבר קיים — מדלג`)
      skipped++
      continue
    }

    try {
      process.stdout.write(`  ⏳ יוצר ${n}.png ... `)
      const b64 = await generateImage(plan[idx].prompt)
      if (!b64) {
        console.log('⚠️  לא הוחזרה תמונה')
        failed++
      } else {
        fs.writeFileSync(filePath, Buffer.from(b64, 'base64'))
        console.log('✓ נשמר')
        created++
      }
    } catch (e) {
      console.log(`❌ ${e.message}`)
      failed++
    }

    await sleep(2000)
  }

  console.log(`\n─────────────────────────────`)
  console.log(`✓ נוצרו: ${created}`)
  console.log(`⏭️  דולגו (כבר קיימים): ${skipped}`)
  console.log(`❌ נכשלו: ${failed}`)
  console.log(`─────────────────────────────`)
  console.log(`\nהאווטרים נשמרו ב-public/avatars/.`)
  console.log(`כדי ליצור מחדש אווטר מסוים — מחק את הקובץ שלו והרץ שוב.\n`)
}

main()
