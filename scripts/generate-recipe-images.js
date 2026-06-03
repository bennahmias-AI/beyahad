// scripts/generate-recipe-images.js
// ─────────────────────────────────────────────────────────────
// מחולל תמונות מתכונים אוטומטי — מתחבר ל-Gemini, מייצר תמונות
// אוכל ריאליסטיות, ושומר אותן תחת public/.
//
// הרצה:
//   node scripts/generate-recipe-images.js              ← הכל (קטגוריות + מתכונים)
//   node scripts/generate-recipe-images.js categories   ← רק תמונות שער לקטגוריות
//   node scripts/generate-recipe-images.js seed         ← רק תמונות למתכונים לדוגמה
//
// דורש: מפתח GEMINI_API_KEY בקובץ .env.local או .env
//
// יעד:
//   public/recipe-categories/{id}.png   — שער לכל קטגוריה
//   public/recipe-seed/{id}.png         — תמונה לכל מתכון לדוגמה
//
// הגנות מובנות:
//   • אם קובץ כבר קיים — מדלג עליו (אפשר להריץ שוב בלי לדרוס).
//   • השהיה בין בקשות כדי לא לעבור את מכסת ה-API.
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { CATEGORY_IMAGES, SEED_IMAGES, food } from './recipe-prompts.js'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const API_KEY = process.env.GEMINI_API_KEY
const MODEL = 'gemini-2.5-flash-image'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(__dirname, '..', 'public')
const CAT_DIR = path.join(PUBLIC, 'recipe-categories')
const SEED_DIR = path.join(PUBLIC, 'recipe-seed')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// שולח בקשה אחת ל-Gemini ומחזיר base64 של התמונה (או null)
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

// מייצר קבוצת תמונות (קטגוריות או מתכונים) לתיקיית יעד.
async function generateGroup(label, items, destDir) {
  fs.mkdirSync(destDir, { recursive: true })
  console.log(`\n── ${label} — ${items.length} תמונות ──`)
  let created = 0, skipped = 0, failed = 0

  for (const item of items) {
    const filePath = path.join(destDir, `${item.id}.png`)
    if (fs.existsSync(filePath)) {
      console.log(`  ⏭️  ${item.id}.png כבר קיים — מדלג`)
      skipped++
      continue
    }
    try {
      process.stdout.write(`  ⏳ יוצר ${item.id}.png ... `)
      const b64 = await generateImage(food(item.dish))
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
  return { created, skipped, failed }
}

async function main() {
  if (!API_KEY) {
    console.error('\n❌ חסר מפתח GEMINI_API_KEY בקובץ .env.local או .env')
    console.error('   פתח את .env והדבק את המפתח אחרי GEMINI_API_KEY=\n')
    process.exit(1)
  }

  const which = (process.argv[2] || 'all').toLowerCase()
  console.log(`\n🍲 מתחיל ליצור תמונות מתכונים. מודל: ${MODEL}`)

  const totals = { created: 0, skipped: 0, failed: 0 }
  const add = (r) => { totals.created += r.created; totals.skipped += r.skipped; totals.failed += r.failed }

  if (which === 'all' || which === 'categories') {
    add(await generateGroup('תמונות שער לקטגוריות', CATEGORY_IMAGES, CAT_DIR))
  }
  if (which === 'all' || which === 'seed') {
    add(await generateGroup('תמונות למתכונים לדוגמה', SEED_IMAGES, SEED_DIR))
  }

  console.log(`\n─────────────────────────────`)
  console.log(`✓ נוצרו: ${totals.created}`)
  console.log(`⏭️  דולגו (כבר קיימים): ${totals.skipped}`)
  console.log(`❌ נכשלו: ${totals.failed}`)
  console.log(`─────────────────────────────`)
  console.log(`\nהתמונות נשמרו ב-public/recipe-categories/ ו-public/recipe-seed/.\n`)
}

main()
