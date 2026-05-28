// scripts/download-fonts.js
// ─────────────────────────────────────────────────────────────
// מוריד 10 פונטים עבריים מ-Google Fonts וממיר אותם ל-base64,
// כדי שנוכל להטמיע אותם ישירות בתוך ה-SVG של הברכה.
//
// למה base64? כי ה-SVG מוטמע כתמונה (<img>), והדפדפן מרנדר אותו
// מבודד — הוא לא רואה פונטים חיצוניים. הדרך היחידה שהפונט "ייכנס"
// לגרפיקה היא להטמיע את קובץ הפונט עצמו בתוך ה-SVG כ-data URL.
//
// הרצה:  node scripts/download-fonts.js
// תוצאה: src/greetingFonts.js  (קובץ עם base64 של כל פונט)
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_FILE = path.join(__dirname, '..', 'src', 'greetingFonts.js')

// 10 הפונטים הנבחרים. key = מזהה (תואם ל-id ב-FONTS),
// family = שם המשפחה כפי שמופיע ב-CSS, url = בקשת css2 לאותו פונט/משקל.
// אנחנו מבקשים מ-Google Fonts את ה-CSS, מחלצים ממנו את כתובת ה-woff2,
// מורידים אותו, וממירים ל-base64.
const FONTS = [
  { key: 'heebo',     family: 'Heebo',            css: 'Heebo:wght@800' },
  { key: 'assistant', family: 'Assistant',        css: 'Assistant:wght@800' },
  { key: 'rubik',     family: 'Rubik',            css: 'Rubik:wght@700' },
  { key: 'secular',   family: 'Secular One',      css: 'Secular+One' },
  { key: 'frank',     family: 'Frank Ruhl Libre', css: 'Frank+Ruhl+Libre:wght@900' },
  { key: 'david',     family: 'David Libre',      css: 'David+Libre:wght@700' },
  { key: 'suez',      family: 'Suez One',         css: 'Suez+One' },
  { key: 'amatic',    family: 'Amatic SC',        css: 'Amatic+SC:wght@700' },
  { key: 'gveret',    family: 'Gveret Levin',     css: 'Gveret+Levin' },
  { key: 'fredoka',   family: 'Fredoka',          css: 'Fredoka:wght@600' },
]

// מוריד טקסט/בינארי מ-url ומחזיר Buffer
function fetchBuffer(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // עוקב אחרי הפניה
        return fetchBuffer(res.headers.location, headers).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
}

async function main() {
  const result = {}

  for (const font of FONTS) {
    process.stdout.write(`מוריד ${font.family}... `)
    try {
      // 1. מבקשים את ה-CSS מ-Google Fonts (עם subset עברי).
      //    User-Agent מודרני → נקבל woff2 (קטן ועובד מצוין ב-SVG בדפדפנים מודרניים).
      const cssUrl = `https://fonts.googleapis.com/css2?family=${font.css}&subset=hebrew&display=swap`
      const modernUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
      const css = (await fetchBuffer(cssUrl, { 'User-Agent': modernUA })).toString('utf8')

      // 2. מחלצים את כתובת קובץ הפונט — תופס כל פורמט (woff2/woff/ttf).
      //    מעדיפים את ההתאמה האחרונה (לרוב הבלוק העברי בסוף ה-CSS).
      const all = [...css.matchAll(/url\((https:\/\/[^)]+\.(woff2|woff|ttf))\)/g)]
      if (all.length === 0) throw new Error('לא נמצאה כתובת פונט ב-CSS')
      const m = all[all.length - 1]
      const fontUrl = m[1]
      const fmt = m[2] // woff2 | woff | ttf
      const mime = fmt === 'woff2' ? 'font/woff2' : fmt === 'woff' ? 'font/woff' : 'font/ttf'
      const fmtName = fmt === 'woff2' ? 'woff2' : fmt === 'woff' ? 'woff' : 'truetype'

      // 3. מורידים את הקובץ וממירים ל-base64
      const buf = await fetchBuffer(fontUrl, { 'User-Agent': modernUA })
      const b64 = buf.toString('base64')
      result[font.key] = { family: font.family, mime, fmtName, b64 }
      console.log(`✓ (${fmt}, ${Math.round(buf.length / 1024)}KB)`)
    } catch (e) {
      console.log(`✗ ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 500))
  }

  // 4. כותבים קובץ JS שמייצא את כל ה-base64
  let out = '// קובץ אוטומטי — אל תערוך ידנית!\n'
  out += '// נוצר ע"י scripts/download-fonts.js\n'
  out += '// מכיל את הפונטים כ-base64 להטמעה בתוך ה-SVG של הברכה.\n\n'
  out += 'export const GREETING_FONTS = {\n'
  for (const [key, v] of Object.entries(result)) {
    out += `  '${key}': { family: ${JSON.stringify(v.family)}, mime: '${v.mime}', fmt: '${v.fmtName}', b64: '${v.b64}' },\n`
  }
  out += '}\n'

  fs.writeFileSync(OUT_FILE, out)
  console.log(`\nנכתב: ${OUT_FILE}`)
  console.log(`גודל כולל: ${Math.round(fs.statSync(OUT_FILE).size / 1024)}KB`)
}

main()
