// scripts/compress-recipe-images.js
// ─────────────────────────────────────────────────────────────
// דוחס את תמונות הקטגוריות (ואת תמונות המתכונים לדוגמה) שנוצרו
// ע"י generate-recipe-images.js.
//
// התמונות נוצרות כ-PNG כבדים (~1.5-2MB כל אחת). כאן אנו ממירים
// אותן ל-JPEG דחוס (~120-200KB) ברוחב 600px — מתאים בול לכרטיס
// בגריד, בלי הבדל נראה לעין, וקל בהרבה לטעינה (חשוב לקשישים על
// דאטה סלולרי).
//
// הרצה:
//   node scripts/compress-recipe-images.js              ← הכל
//   node scripts/compress-recipe-images.js categories   ← רק קטגוריות
//   node scripts/compress-recipe-images.js seed         ← רק מתכונים
//
// דורש: npm install sharp
//
// פלט: לכל X.png נוצר X.jpg באותה תיקייה. ה-PNG המקורי נשאר
//      (אפשר למחוק ידנית אחר כך — הקוד מצביע ל-.jpg).
//
// הגנה: כותב לקובץ זמני ואז מחליף — אם משהו נכשל, לא נדרס כלום.
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(__dirname, '..', 'public')
const CAT_DIR = path.join(PUBLIC, 'recipe-categories')
const SEED_DIR = path.join(PUBLIC, 'recipe-seed')
const TIP_DIR = path.join(PUBLIC, 'tip-categories')

const WIDTH = 600         // הכרטיס מוצג ~200px — 600 נותן מרווח ל-retina
const QUALITY = 72        // איכות JPEG — איזון מצוין בין משקל לחדות לתמונת רקע

async function compressDir(label, dir) {
  if (!fs.existsSync(dir)) {
    console.log(`\n⏭️  ${label}: התיקייה לא קיימת (${dir}) — מדלג`)
    return { before: 0, after: 0, done: 0, failed: 0 }
  }

  const files = fs.readdirSync(dir).filter(f => /\.png$/i.test(f))
  if (files.length === 0) {
    console.log(`\n⏭️  ${label}: אין קובצי PNG — מדלג`)
    return { before: 0, after: 0, done: 0, failed: 0 }
  }

  console.log(`\n── ${label} — ${files.length} תמונות ──`)
  let before = 0, after = 0, done = 0, failed = 0

  for (const file of files) {
    const src = path.join(dir, file)
    const outName = file.replace(/\.png$/i, '.jpg')
    const out = path.join(dir, outName)
    const tmp = path.join(dir, `__tmp_${outName}`)
    try {
      const origSize = fs.statSync(src).size
      before += origSize

      await sharp(src)
        .resize(WIDTH, null, { withoutEnlargement: true })   // רוחב 600, גובה יחסי
        .jpeg({ quality: QUALITY, mozjpeg: true })
        .toFile(tmp)

      const newSize = fs.statSync(tmp).size
      fs.renameSync(tmp, out)
      after += newSize
      done++

      const kb = (n) => (n / 1024).toFixed(0) + 'KB'
      console.log(`  ✓ ${outName.padEnd(20)} ${kb(origSize).padStart(8)} → ${kb(newSize)}`)
    } catch (e) {
      console.log(`  ❌ ${file}: ${e.message}`)
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
      failed++
    }
  }
  return { before, after, done, failed }
}

async function main() {
  const which = (process.argv[2] || 'all').toLowerCase()
  console.log(`\n🗜️  דוחס תמונות מתכונים ל-JPEG (רוחב ${WIDTH}px, איכות ${QUALITY})`)

  const totals = { before: 0, after: 0, done: 0, failed: 0 }
  const add = (r) => { totals.before += r.before; totals.after += r.after; totals.done += r.done; totals.failed += r.failed }

  if (which === 'all' || which === 'categories') {
    add(await compressDir('תמונות קטגוריות', CAT_DIR))
  }
  if (which === 'all' || which === 'tips') {
    add(await compressDir('תמונות קטגוריות עצות', TIP_DIR))
  }
  if (which === 'all' || which === 'seed') {
    add(await compressDir('תמונות מתכונים לדוגמה', SEED_DIR))
  }

  const mb = (n) => (n / 1024 / 1024).toFixed(1) + 'MB'
  console.log(`\n─────────────────────────────`)
  console.log(`✓ נדחסו: ${totals.done}   ❌ נכשלו: ${totals.failed}`)
  if (totals.before > 0) {
    console.log(`📦 לפני:  ${mb(totals.before)}`)
    console.log(`📦 אחרי:  ${mb(totals.after)}`)
    console.log(`💾 חיסכון: ${mb(totals.before - totals.after)} (${Math.round((1 - totals.after / totals.before) * 100)}%)`)
  }
  console.log(`─────────────────────────────`)
  console.log(`\nℹ️  נוצרו קובצי .jpg חדשים. ה-PNG המקורי נשאר — אפשר למחוק ידנית.`)
  console.log(`   הקוד מצביע עכשיו ל-.jpg (recipeCategories.js + seed ב-firebase.js).\n`)
}

main()
