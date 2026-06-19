/*
  gen-shabbat-text.mjs — generate 30 "שבת שלום" cards via Gemini 2.5 Flash Image ("Nano Banana")
  ------------------------------------------------------------------------------------------------
  Gemini writes the Hebrew itself (text baked into the art), one of your 30 exact texts per card,
  across 5 styles. Output: scripts/shabbat-new/01.jpg ... 30.jpg

  SETUP — run from the project root (C:\Users\User\Desktop\beyahad):
    npm install sharp
    node scripts\gen-shabbat-text.mjs

  The key is read automatically from your .env (GEMINI_API_KEY). You can also: set GEMINI_API_KEY=...
  Generate everything, then REVIEW: any card whose Hebrew came out wrong, regenerate just it, e.g.:
    node scripts\gen-shabbat-text.mjs 9 14 18
  (If you get HTTP 404 on the model, change MODEL below to 'gemini-2.5-flash-image-preview'.)
*/

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

// ---- API key: from environment, or fall back to .env ----
let API_KEY = process.env.GEMINI_API_KEY
if (!API_KEY) {
  try {
    const env = fs.readFileSync(path.resolve('.env'), 'utf8')
    const m = env.match(/^\s*(?:VITE_)?(?:GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_GENAI_API_KEY)\s*=\s*(.+?)\s*$/m)
    if (m) API_KEY = m[1].trim().replace(/^["']|["']$/g, '')
  } catch {}
}
if (!API_KEY) { console.error('No GEMINI_API_KEY found (environment or .env).'); process.exit(1) }

const MODEL = 'gemini-2.5-flash-image' // if 404 -> 'gemini-2.5-flash-image-preview'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
const OUT = path.resolve('scripts/shabbat-new')
fs.mkdirSync(OUT, { recursive: true })

// ---- styles ----
const TRAD = 'rich traditional and elegant — deep burgundy and gold, an ornate gold filigree frame, lit Shabbat candles, a braided challah and a glass of wine, warm candlelight glow'
const FLORAL = 'soft delicate watercolor florals on warm cream, gentle pastel flowers and greenery, airy, light and sweet'
const LAND = 'a serene painted Israeli landscape at golden hour (calm rolling hills, the Galilee, or honey-colored Jerusalem stone), peaceful warm light'
const FAMILY = 'a warm, cozy Shabbat table scene, soft golden lamplight, inviting and homely, warm welcoming tones'
const TYPO = 'elegant and minimal — large graceful gold Hebrew calligraphy as the hero on a deep warm gradient, a single thin gold flourish, refined and clean'
const VINTAGE = 'a nostalgic vintage Israeli postcard look, sepia and faded warm tones, aged paper texture, retro and charming'

// ---- [exact text, style] x30 ----
const CARDS = [
  ['שבת שלום ומבורכת!', FLORAL],
  ['שבת של אור ושמחה.', FLORAL],
  ['שבת המלכה.', TRAD],
  ['זמן למנוחה. שבת שלום.', LAND],
  ['שבת של אהבה ומשפחה.', FAMILY],
  ['שבת מתוקה מדבש.', FLORAL],
  ['שתהיה שבת שלום, שקטה ורגועה.', LAND],
  ['שבת של מנוחה, שלווה והטענת מצברים.', LAND],
  ['שבת שלום! רגע לעצור, לנשום ולהודות.', LAND],
  ['שבת של שקט פנימי ושלוות הנפש.', LAND],
  ['זמן של ניתוק מהשגרה וחיבור ללב. שבת שלום.', LAND],
  ['שבת שלום – פסק זמן של קסם באמצע החיים.', TYPO],
  ['מאחלים שבת של רוגע, שלווה ונחת.', LAND],
  ['שבת מוארת ומבורכת לכל בית ישראל.', TRAD],
  ['שיאירו נרות השבת את הבית בחום ובשמחה.', TRAD],
  ['שבת קודש, שבת של אור ואמונה.', TRAD],
  ['שתהיה שבת של בשורות טובות וישועות.', TRAD],
  ['שבת המלכה פורסת כנפיה – שבת שלום!', TRAD],
  ['שבת שלום! שתשרה הברכה בביתכם.', TRAD],
  ['שבת של ברכה, שפע וטוב.', TRAD],
  ['שבת של זמן איכות, חיוכים ומשפחה.', FAMILY],
  ['קבלת שבת באהבה ובשמחה.', FAMILY],
  ['שבת של התכנסות, אהבה וביחד.', FAMILY],
  ['מאחלים שבת מלאה באנרגיות טובות.', FAMILY],
  ['שבת של ניגונים, שמחה בלב וארוחות טעימות.', FAMILY],
  ['שבת שלום למשפחה, לחברים ולכל האהובים.', FAMILY],
  ['שתהיה השבת הזו מזור לנפש ולגוף.', LAND],
  ['שבת שלום ומבורכת, מלאה ברגעים קטנים של אושר.', TYPO],
  ['שבת עטופה במחשבות חיוביות ורגעים יפים.', VINTAGE],
  ['שבוע טוב מתחיל בשבת שלום ומבורכת.', TYPO],
]

function buildPrompt(text, style) {
  return `Design a beautiful, elegant Shabbat (Jewish Sabbath) greeting card BACKGROUND, square 1:1 aspect ratio. ` +
    `Visual style: ${style}. ` +
    `IMPORTANT: do NOT include ANY text, letters, words, numbers or writing of any kind anywhere in the image. ` +
    `Keep the CENTER calm and relatively empty (place the decorative elements toward the edges and corners) so a blessing can be added on top later. ` +
    `Warm and inviting, high quality, no people and no faces.`
}

async function genOne(i) {
  const [text, style] = CARDS[i]
  const body = { contents: [{ parts: [{ text: buildPrompt(text, style) }] }] }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'x-goog-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const part = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data)
  if (!part) throw new Error(`no image (${data?.candidates?.[0]?.finishReason || '?'})`)
  const buf = Buffer.from(part.inlineData.data, 'base64')
  const out = path.join(OUT, `${String(i + 1).padStart(2, '0')}.jpg`)
  await sharp(buf).resize(1024, 1024, { fit: 'cover' }).jpeg({ quality: 86 }).toFile(out)
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const args = process.argv.slice(2).map(Number).filter((n) => n >= 1 && n <= CARDS.length)
  const idxs = args.length ? args.map((n) => n - 1) : CARDS.map((_, i) => i)
  console.log(`Generating ${idxs.length} card(s) -> ${OUT}\n`)
  let ok = 0
  for (const i of idxs) {
    let done = false
    for (let a = 1; a <= 2 && !done; a++) {
      try {
        await genOne(i); ok++; done = true
        console.log(`[${String(i + 1).padStart(2, '0')}] ok   "${CARDS[i][0]}"`)
      } catch (e) {
        console.log(`[${String(i + 1).padStart(2, '0')}] fail ${a}: ${e.message}`)
        if (a < 2) await sleep(4000)
      }
    }
    await sleep(1500) // stay under the rate limit
  }
  console.log(`\nDone. ${ok}/${idxs.length} saved in ${OUT}`)
  console.log('Review the folder. To regenerate specific cards:  node scripts\\gen-shabbat-text.mjs 9 14 18')
})()
