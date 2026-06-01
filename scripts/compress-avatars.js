// scripts/compress-avatars.js
// ─────────────────────────────────────────────────────────────
// דוחס את כל קובצי האווטרים ב-public/avatars/.
//
// כל אווטר מוקטן ל-256×256 פיקסל ונדחס — מה שמוריד כל קובץ
// מ-~1MB ל-~30-50KB, בלי הבדל נראה לעין (האווטר מוצג בעיגול קטן).
//
// הרצה:
//   node scripts/compress-avatars.js
//
// דורש: npm install sharp
//
// הגנה: כותב לקובץ זמני ואז מחליף — אם משהו נכשל, הקובץ המקורי נשמר.
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIR = path.join(__dirname, '..', 'public', 'avatars')

const SIZE = 256          // אווטר מוצג לכל היותר ב-110px, 256 נותן מרווח לתצוגות חדות
const QUALITY = 82        // איכות PNG/דחיסה — איזון טוב בין משקל לחדות

async function main() {
  if (!fs.existsSync(DIR)) {
    console.error(`\n❌ התיקייה לא נמצאה: ${DIR}\n`)
    process.exit(1)
  }

  const files = fs.readdirSync(DIR).filter(f => /\.png$/i.test(f))
  if (files.length === 0) {
    console.error('\n❌ לא נמצאו קובצי PNG בתיקייה\n')
    process.exit(1)
  }

  console.log(`\n🗜️  דוחס ${files.length} אווטרים ב-${DIR}\n`)

  let before = 0, after = 0, done = 0, failed = 0

  for (const file of files) {
    const full = path.join(DIR, file)
    const tmp = path.join(DIR, `__tmp_${file}`)
    try {
      const origSize = fs.statSync(full).size
      before += origSize

      await sharp(full)
        .resize(SIZE, SIZE, { fit: 'cover' })   // ריבוע 256×256, חיתוך מהמרכז
        .png({ quality: QUALITY, compressionLevel: 9 })
        .toFile(tmp)

      const newSize = fs.statSync(tmp).size
      // מחליף את המקורי בדחוס
      fs.renameSync(tmp, full)
      after += newSize
      done++

      const kb = (n) => (n / 1024).toFixed(0) + 'KB'
      console.log(`  ✓ ${file.padEnd(8)} ${kb(origSize).padStart(8)} → ${kb(newSize)}`)
    } catch (e) {
      console.log(`  ❌ ${file}: ${e.message}`)
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
      failed++
    }
  }

  const mb = (n) => (n / 1024 / 1024).toFixed(1) + 'MB'
  console.log(`\n─────────────────────────────`)
  console.log(`✓ נדחסו: ${done}   ❌ נכשלו: ${failed}`)
  console.log(`📦 לפני:  ${mb(before)}`)
  console.log(`📦 אחרי:  ${mb(after)}`)
  console.log(`💾 חיסכון: ${mb(before - after)} (${Math.round((1 - after / before) * 100)}%)`)
  console.log(`─────────────────────────────\n`)
}

main()
