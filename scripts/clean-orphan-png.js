// scripts/clean-orphan-png.js
// ─────────────────────────────────────────────────────────────
// מוחק קובצי PNG מיותרים — כאלה שכבר קיים להם JPG תואם באותה תיקייה.
// אלה שאריות מדחיסות קודמות (recipe-categories / recipe-seed) שלא
// נמחקו, והן ניפחו את ה-AAB ב~85MB. הקוד כבר מצביע ל-.jpg.
//
// בטיחות: מוחק X.png רק אם X.jpg קיים באותה תיקייה. אם אין JPG
//         תואם — ה-PNG נשאר במקומו (לא נמחק כלום בלי תחליף).
//
// הרצה:  node scripts/clean-orphan-png.js
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(__dirname, '..', 'public')

// התיקיות לניקוי — אלה שידוע שיש בהן כפילות PNG+JPG
const DIRS = ['recipe-categories', 'recipe-seed', 'tip-categories']

let totalDeleted = 0, totalFreed = 0, totalKept = 0

for (const d of DIRS) {
  const dir = path.join(PUBLIC, d)
  if (!fs.existsSync(dir)) { console.log(`⏭️  ${d}: לא קיים`); continue }

  const pngs = fs.readdirSync(dir).filter(f => /\.png$/i.test(f))
  if (pngs.length === 0) { console.log(`⏭️  ${d}: אין PNG`); continue }

  console.log(`\n── ${d} ──`)
  let del = 0, freed = 0, kept = 0
  for (const png of pngs) {
    const jpg = png.replace(/\.png$/i, '.jpg')
    const jpgPath = path.join(dir, jpg)
    const pngPath = path.join(dir, png)
    if (fs.existsSync(jpgPath)) {
      const size = fs.statSync(pngPath).size
      fs.unlinkSync(pngPath)
      del++; freed += size
    } else {
      console.log(`  ⚠ ${png} — אין JPG תואם, נשאר`)
      kept++
    }
  }
  const mb = (n) => (n / 1024 / 1024).toFixed(1) + 'MB'
  console.log(`  ✓ נמחקו ${del} PNG, שוחררו ${mb(freed)}${kept ? `, נשמרו ${kept} ללא תחליף` : ''}`)
  totalDeleted += del; totalFreed += freed; totalKept += kept
}

const mb = (n) => (n / 1024 / 1024).toFixed(1) + 'MB'
console.log(`\n─────────────────────────────`)
console.log(`✓ סה"כ נמחקו: ${totalDeleted} קבצים   💾 שוחרר: ${mb(totalFreed)}`)
if (totalKept) console.log(`⚠ נשמרו ${totalKept} PNG ללא JPG תואם`)
console.log(`─────────────────────────────\n`)
