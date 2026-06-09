// scripts/compress-ready.js
// ─────────────────────────────────────────────────────────────
// דוחס את כל תמונות הברכות המוכנות שב-public/ready/<OCCASION>/*.jpg
//
// התמונות נוצרו ע"י gen-greetings.mjs במשקל כבד (~0.5-1MB כל אחת).
// כאן ממירים אותן ל-JPEG דחוס (~150KB) ברוחב 1080px — מתאים בול
// לתצוגה במסך מלא, בלי הבדל נראה לעין, וקל בהרבה לטעינה ולהורדה
// (קריטי לקשישים על דאטה סלולרי, וגם מאיץ את הוספת השם/קרדיט).
//
// הרצה:
//   node scripts/compress-ready.js              ← כל התיקיות
//   node scripts/compress-ready.js YOM_SHLISHI  ← תיקייה אחת בלבד
//
// דורש: npm install sharp  (כבר מותקן בפרויקט)
//
// בטיחות: דוחס על המקום (אותו שם קובץ) דרך קובץ זמני ואז מחליף —
//         אם דחיסה נכשלת, הקובץ המקורי לא נדרס. מדלג על קבצים
//         שכבר קטנים מהסף (כדי שאפשר להריץ שוב בלי נזק).
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const READY = path.join(__dirname, '..', 'public', 'ready')

const WIDTH = 1080         // התמונה מוצגת במסך מלא — 1080 חד גם ב-retina
const QUALITY = 80         // איכות JPEG — איזון מצוין בין משקל לחדות
const SKIP_BELOW = 200 * 1024  // קובץ שכבר קטן מ-200KB — לא נוגעים (כבר דחוס)

async function compressDir(occId, dir) {
  const files = fs.readdirSync(dir).filter(f => /\.jpe?g$/i.test(f))
  if (files.length === 0) return { before: 0, after: 0, done: 0, skipped: 0, failed: 0 }

  console.log(`\n── ${occId} — ${files.length} תמונות ──`)
  let before = 0, after = 0, done = 0, skipped = 0, failed = 0

  for (const file of files) {
    const src = path.join(dir, file)
    const tmp = path.join(dir, `__tmp_${file}`)
    try {
      const origSize = fs.statSync(src).size
      if (origSize < SKIP_BELOW) {
        skipped++
        before += origSize; after += origSize
        continue
      }
      before += origSize

      await sharp(src)
        .resize(WIDTH, WIDTH, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: QUALITY, mozjpeg: true })
        .toFile(tmp)

      const newSize = fs.statSync(tmp).size
      // אם איכשהו יצא גדול יותר — לא מחליפים
      if (newSize >= origSize) {
        fs.unlinkSync(tmp)
        skipped++
        after += origSize
        continue
      }
      fs.renameSync(tmp, src)   // מחליף את המקור (אותו שם)
      after += newSize
      done++

      const kb = (n) => (n / 1024).toFixed(0) + 'KB'
      console.log(`  ✓ ${file.padEnd(10)} ${kb(origSize).padStart(8)} → ${kb(newSize)}`)
    } catch (e) {
      console.log(`  ❌ ${file}: ${e.message}`)
      if (fs.existsSync(tmp)) { try { fs.unlinkSync(tmp) } catch {} }
      failed++
    }
  }
  return { before, after, done, skipped, failed }
}

async function main() {
  if (!fs.existsSync(READY)) {
    console.log(`❌ התיקייה לא קיימת: ${READY}`)
    return
  }
  const only = process.argv[2]   // אופציונלי — תיקייה אחת בלבד
  const dirs = fs.readdirSync(READY, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => !only || name === only)

  if (dirs.length === 0) {
    console.log(only ? `❌ לא נמצאה תיקייה: ${only}` : '❌ אין תיקיות תחת public/ready')
    return
  }

  console.log(`\n🗜️  דוחס ברכות מוכנות ל-JPEG (רוחב ${WIDTH}px, איכות ${QUALITY})`)
  const totals = { before: 0, after: 0, done: 0, skipped: 0, failed: 0 }
  for (const occId of dirs) {
    const r = await compressDir(occId, path.join(READY, occId))
    totals.before += r.before; totals.after += r.after
    totals.done += r.done; totals.skipped += r.skipped; totals.failed += r.failed
  }

  const mb = (n) => (n / 1024 / 1024).toFixed(1) + 'MB'
  console.log(`\n─────────────────────────────`)
  console.log(`✓ נדחסו: ${totals.done}   ⏭️  דולגו: ${totals.skipped}   ❌ נכשלו: ${totals.failed}`)
  if (totals.before > 0) {
    console.log(`📦 לפני:  ${mb(totals.before)}`)
    console.log(`📦 אחרי:  ${mb(totals.after)}`)
    console.log(`💾 חיסכון: ${mb(totals.before - totals.after)} (${Math.round((1 - totals.after / totals.before) * 100)}%)`)
  }
  console.log(`─────────────────────────────\n`)
}

main()
