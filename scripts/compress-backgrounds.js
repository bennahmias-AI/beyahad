// scripts/compress-backgrounds.js
// ─────────────────────────────────────────────────────────────
// דוחס את כל רקעי העיצוב האישי שב-public/backgrounds/<CATEGORY>/*.png
//
// הרקעים נוצרו כ-PNG כבדות מאוד (3-5MB כל אחת). כאן ממירים אותן
// ל-JPEG דחוס (~150KB) ברוחב 1080px — מתאים לתצוגה, בלי הבדל נראה
// לעין, וקריטי לגודל קובץ ה-AAB (שתפח ל-520MB בגלל ה-PNG האלה).
//
// ⚠ הסקריפט ממיר ל-.jpg ומוחק את ה-.png המקורי (חוסך מקום).
//   לכן אחרי ההרצה צריך לעדכן בקוד את ext:'png' ל-ext:'jpg'.
//
// הרצה:
//   node scripts/compress-backgrounds.js              ← כל הקטגוריות
//   node scripts/compress-backgrounds.js SHABAT       ← קטגוריה אחת
//
// דורש: sharp (כבר מותקן בפרויקט)
//
// בטיחות: כותב קודם את ה-JPEG, מוודא שנוצר תקין, ורק אז מוחק את
//         ה-PNG המקורי. אם המרה נכשלת — ה-PNG נשאר במקומו.
//         אפשר להריץ שוב (מדלג על PNG שכבר הומר ל-JPEG קיים).
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BG = path.join(__dirname, '..', 'public', 'backgrounds')

const WIDTH = 1080
const QUALITY = 82

async function compressDir(catId, dir) {
  const pngs = fs.readdirSync(dir).filter(f => /\.png$/i.test(f))
  if (pngs.length === 0) return { before: 0, after: 0, done: 0, skipped: 0, failed: 0 }

  console.log(`\n── ${catId} — ${pngs.length} תמונות PNG ──`)
  let before = 0, after = 0, done = 0, skipped = 0, failed = 0

  for (const file of pngs) {
    const src = path.join(dir, file)
    const jpgName = file.replace(/\.png$/i, '.jpg')
    const dst = path.join(dir, jpgName)
    try {
      const origSize = fs.statSync(src).size
      before += origSize

      // אם כבר קיים JPEG באותו שם — מדלגים (וגם מוחקים את ה-PNG הכפול)
      if (fs.existsSync(dst)) {
        fs.unlinkSync(src)
        skipped++
        after += fs.statSync(dst).size
        continue
      }

      await sharp(src)
        .resize(WIDTH, WIDTH, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: QUALITY, mozjpeg: true })
        .toFile(dst)

      const newSize = fs.statSync(dst).size
      if (newSize <= 0) throw new Error('JPEG ריק')

      fs.unlinkSync(src)   // מוחק את ה-PNG המקורי רק אחרי שה-JPEG נוצר תקין
      after += newSize
      done++

      const kb = (n) => (n / 1024).toFixed(0) + 'KB'
      console.log(`  ✓ ${file.padEnd(12)} ${kb(origSize).padStart(9)} → ${jpgName} ${kb(newSize)}`)
    } catch (e) {
      console.log(`  ❌ ${file}: ${e.message}`)
      if (fs.existsSync(dst)) { try { fs.unlinkSync(dst) } catch {} }
      failed++
    }
  }
  return { before, after, done, skipped, failed }
}

async function main() {
  if (!fs.existsSync(BG)) { console.log(`❌ לא קיים: ${BG}`); return }
  const only = process.argv[2]
  const dirs = fs.readdirSync(BG, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name)
    .filter(name => !only || name === only)

  if (dirs.length === 0) { console.log(only ? `❌ לא נמצאה קטגוריה: ${only}` : '❌ אין קטגוריות'); return }

  console.log(`\n🗜️  דוחס רקעי עיצוב אישי ל-JPEG (רוחב ${WIDTH}px, איכות ${QUALITY})`)
  const t = { before: 0, after: 0, done: 0, skipped: 0, failed: 0 }
  for (const cat of dirs) {
    const r = await compressDir(cat, path.join(BG, cat))
    t.before += r.before; t.after += r.after; t.done += r.done; t.skipped += r.skipped; t.failed += r.failed
  }

  const mb = (n) => (n / 1024 / 1024).toFixed(1) + 'MB'
  console.log(`\n─────────────────────────────`)
  console.log(`✓ הומרו: ${t.done}   ⏭️  דולגו: ${t.skipped}   ❌ נכשלו: ${t.failed}`)
  if (t.before > 0) {
    console.log(`📦 לפני:  ${mb(t.before)}`)
    console.log(`📦 אחרי:  ${mb(t.after)}`)
    console.log(`💾 חיסכון: ${mb(t.before - t.after)} (${Math.round((1 - t.after / t.before) * 100)}%)`)
  }
  console.log(`─────────────────────────────\n`)
}

main()
