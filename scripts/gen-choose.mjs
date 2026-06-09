// scripts/gen-choose.mjs
// ─────────────────────────────────────────────────────────────
// מייצר תמונות איור (סגנון אנימציה/פיקסאר) לכרטיסי מסך הבחירה בברכות.
// פלט: public/choose/<key>.jpg
//
// הרצה (Windows cmd):
//   cd C:\Users\User\Desktop\beyahad
//   node --env-file=scripts\.env scripts\gen-choose.mjs
//
// מדלג על קבצים שכבר קיימים. למחזר/לחדש — מחק את הקובץ ב-public/choose/ והרץ שוב.
// ─────────────────────────────────────────────────────────────

import fs from 'node:fs'
import path from 'node:path'

const API_KEY = process.env.GEMINI_API_KEY
if (!API_KEY) {
  console.error('\n❌ חסר GEMINI_API_KEY. הרץ עם --env-file=scripts\\.env\n')
  process.exit(1)
}

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview'
const BASE = 'https://generativelanguage.googleapis.com/v1beta'
const OUT = path.resolve('public/choose')

// כל פריט: שם קובץ + פרומפט. סגנון אנימציה תלת-מימד, ללא טקסט.
const ITEMS = [
  {
    key: 'design',
    prompt:
      'A warm, charming 3D animated illustration in Pixar / Disney style about making a greeting card. ' +
      'Show an artists palette with colorful paint, paintbrushes, blooming flowers, a decorated blank card, ' +
      'and a few floating hearts, arranged on a soft pastel background. ' +
      'Vibrant cheerful colors, rounded friendly shapes, soft lighting, high-quality 3D render, cute and inviting. ' +
      'Absolutely NO text, NO words, NO letters anywhere. Square 1:1 composition, subject in the upper area.',
  },
]

async function genOne(item, file) {
  const body = { contents: [{ parts: [{ text: item.prompt }] }] }
  let r = await fetch(`${BASE}/models/${MODEL}:generateContent?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!r.ok) {
    const errText = await r.text()
    if (/modal/i.test(errText)) {
      const body2 = { ...body, generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }
      r = await fetch(`${BASE}/models/${MODEL}:generateContent?key=${API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body2),
      })
    } else {
      console.error(`\n❌ שגיאה (${r.status}):\n${errText.slice(0, 700)}`)
      process.exit(1)
    }
  }
  if (!r.ok) { console.error(`   ⚠️ דילוג על "${item.key}"`); return }
  const j = await r.json()
  const parts = j?.candidates?.[0]?.content?.parts || []
  const img = parts.find(p => p.inlineData)?.inlineData
  if (!img) { console.error(`   ⚠️ לא חזרה תמונה ל"${item.key}"`); return }
  fs.writeFileSync(file, Buffer.from(img.data, 'base64'))
  console.log(`   ✓ ${item.key}.jpg`)
}

fs.mkdirSync(OUT, { recursive: true })
console.log(`\n=== כרטיסי בחירה — מודל ${MODEL} ===`)
for (const item of ITEMS) {
  const file = path.join(OUT, `${item.key}.jpg`)
  if (fs.existsSync(file)) { console.log(`   ⏭️  כבר קיים: ${item.key}.jpg`); continue }
  await genOne(item, file)
  await new Promise(res => setTimeout(res, 1500))
}
console.log('\n✅ סיום!\n')
