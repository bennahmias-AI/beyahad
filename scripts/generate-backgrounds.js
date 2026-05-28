// scripts/generate-backgrounds.js
// ─────────────────────────────────────────────────────────────
// מחולל רקעים אוטומטי — מתחבר ל-Gemini, מייצר תמונות, ושומר
// אותן לתיקיות תחת public/backgrounds/.
//
// הרצה:
//   node scripts/generate-backgrounds.js
//
// דורש: מפתח GEMINI_API_KEY בקובץ .env.local
//
// מבנה: כל קטגוריה = תיקייה אחת. בכל קטגוריה יש רשימת "סגנונות"
//        (variants), כל אחד עם פרומפט ומספר תמונות. כל התמונות
//        נשמרות באותה תיקייה, ממוספרות יחד (1.png, 2.png, ...).
//
// הגנות מובנות:
//   • לא נוגע בתיקיות שלא מוגדרות ב-bg-prompts.js (SHABAT/SHAVUA TOV בטוחות).
//   • אם קובץ כבר קיים — מדלג עליו (אפשר להריץ שוב בלי לדרוס).
//   • השהיה בין בקשות כדי לא לעבור את מכסת ה-API.
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { CATEGORIES } from './bg-prompts.js'

dotenv.config({ path: '.env.local' })

const API_KEY = process.env.GEMINI_API_KEY
const MODEL = 'gemini-2.5-flash-image'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BG_ROOT = path.join(__dirname, '..', 'public', 'backgrounds')

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

// בונה תוכנית: רשימת {prompt} באורך הכולל של כל הסגנונות בקטגוריה.
// לדוגמה: 5 מצויר + 5 ריאליסטי = 10 פריטים, שיישמרו 1.png..10.png.
function buildPlan(cat) {
  const plan = []
  for (const variant of cat.variants) {
    for (let i = 0; i < variant.count; i++) {
      plan.push({ prompt: variant.prompt })
    }
  }
  return plan
}

async function main() {
  if (!API_KEY) {
    console.error('\n❌ חסר מפתח GEMINI_API_KEY בקובץ .env.local')
    console.error('   פתח את .env.local והדבק את המפתח אחרי GEMINI_API_KEY=\n')
    process.exit(1)
  }

  console.log(`\n🎨 מתחיל ליצור רקעים. מודל: ${MODEL}`)
  console.log(`📁 יעד: ${BG_ROOT}\n`)

  let totalCreated = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const cat of CATEGORIES) {
    const dir = path.join(BG_ROOT, cat.dir)
    fs.mkdirSync(dir, { recursive: true })

    const plan = buildPlan(cat)
    console.log(`\n── ${cat.label} (${cat.dir}) — ${plan.length} תמונות ──`)

    for (let idx = 0; idx < plan.length; idx++) {
      const n = idx + 1
      const filePath = path.join(dir, `${n}.png`)

      if (fs.existsSync(filePath)) {
        console.log(`  ⏭️  ${n}.png כבר קיים — מדלג`)
        totalSkipped++
        continue
      }

      try {
        process.stdout.write(`  ⏳ יוצר ${n}.png ... `)
        const b64 = await generateImage(plan[idx].prompt)
        if (!b64) {
          console.log('⚠️  לא הוחזרה תמונה')
          totalFailed++
        } else {
          fs.writeFileSync(filePath, Buffer.from(b64, 'base64'))
          console.log('✓ נשמר')
          totalCreated++
        }
      } catch (e) {
        console.log(`❌ ${e.message}`)
        totalFailed++
      }

      await sleep(2000)
    }
  }

  console.log(`\n─────────────────────────────`)
  console.log(`✓ נוצרו: ${totalCreated}`)
  console.log(`⏭️  דולגו (כבר קיימים): ${totalSkipped}`)
  console.log(`❌ נכשלו: ${totalFailed}`)
  console.log(`─────────────────────────────`)
  console.log(`\nהתמונות נשמרו ב-public/backgrounds/.`)
  console.log(`לחיבור קטגוריה לאפליקציה — הוסף שורה ל-BG_CATEGORIES ב-GreetingMaker.jsx\n`)
}

main()
