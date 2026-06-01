// scripts/avatar-prompts.js
// ─────────────────────────────────────────────────────────────
// הגדרת הפרומפטים ליצירת אווטרי פרופיל אוטומטית.
//
// 18 דמויות בסגנון מצויר אחיד, על רקע לבן נקי, מגוון רחב של
// גילאים (בדגש על מבוגרים — הקהל של ביחד), מינים ומראה.
//
// כל אווטר נשמר כקובץ נפרד בתיקייה public/avatars/ (1.png ... 18.png).
//
// המפתח לאחידות: כל 18 הפרומפטים חולקים את אותו "בסיס סגנון"
// (avatarStyle), ומשתנה רק תיאור הדמות (subject). כך כל הדמויות
// יוצאות באותו קו ציורי, לייטינג ופרופורציות.
// ─────────────────────────────────────────────────────────────

// ── בסיס סגנון אחיד לכל האווטרים ──
// head-and-shoulders, פנים קדימה, חיוך עדין, רקע לבן טהור, ריבועי.
const avatarStyle = (subject) =>
  'Friendly cartoon avatar portrait, flat modern vector illustration style ' +
  'with clean bold outlines and warm soft shading. ' +
  'Head-and-shoulders, centered, facing forward, gentle warm smile. ' +
  'Pure solid white background (#FFFFFF) — no pattern, no scenery, no props. ' +
  'Consistent lighting, consistent proportions, dignified and welcoming. ' +
  'Square 1:1 composition, single person only. ' +
  `Person: ${subject} ` +
  'IMPORTANT: no text, no letters, no words, no logos, no border, white background only.'

// ── 18 דמויות מגוונות ──
// דגש על גיל מבוגר (הקהל של ביחד), מגוון מינים, שיער, משקפיים, לבוש.
const SUBJECTS = [
  'an older woman around 70 with short curly silver-grey hair and warm brown eyes, wearing glasses and a soft teal blouse, kind grandmother look',
  'an older man around 75 with a neat white beard and bald head, wearing glasses and a warm brown cardigan, gentle grandfather look',
  'a woman in her 60s with shoulder-length wavy grey hair, wearing elegant earrings and a burgundy blouse, graceful and warm',
  'a man in his 60s with greying short hair and a trimmed grey moustache, wearing a checkered shirt, friendly and approachable',
  'an older woman around 80 with white hair tied in a soft bun, wearing pearl earrings and a lavender cardigan, sweet and serene',
  'an older man around 80 with thin white hair and reading glasses, wearing a navy sweater vest, wise and gentle',
  'a woman in her 50s with chin-length auburn hair and light freckles, wearing a green blouse, energetic and cheerful',
  'a man in his 50s with salt-and-pepper hair and stubble, wearing a casual grey jacket, calm and friendly',
  'an older woman around 70 with curly grey hair and round glasses, wearing a mustard-yellow scarf, lively and warm',
  'an older man around 72 with combed-back grey hair and a clean-shaven face, wearing a light blue collared shirt, dignified',
  'a woman in her 60s with straight silver hair to the shoulders, wearing simple glasses and a soft pink top, gentle smile',
  'a man in his 65 with a full grey beard and warm eyes, wearing a forest-green pullover, kind and grandfatherly',
  'a woman in her 40s with dark brown hair in a low ponytail, wearing a teal cardigan, friendly and bright',
  'a man in his 40s with short dark hair and glasses, wearing a casual denim shirt, approachable and warm',
  'an older woman around 75 with soft white wavy hair, wearing a coral blouse and small earrings, warm and caring',
  'an older man around 78 with a bald head and white moustache, wearing a beige cardigan, gentle and wise',
  'a woman in her 50s with curly shoulder-length brown hair touched with grey, wearing a plum blouse, warm and confident',
  'a man in his 55 with greying wavy hair and a short beard, wearing a warm rust-colored sweater, friendly and relaxed',

  // ── 20 דמויות צעירות (גילאי 18–40) — לסירוגין אישה/גבר כדי לשמור על החוקיות ──
  // (מקומות 19–38: אי-זוגי=אשה, זוגי=גבר)
  // 19 (אשה)
  'a young woman around 25 with long straight dark hair, wearing a mustard top and small earrings, bright and cheerful',
  // 20 (גבר)
  'a young man around 25 with short dark hair and a neat fade, clean-shaven, wearing a navy t-shirt, friendly and confident',
  // 21 (אשה)
  'a woman around 30 with wavy auburn hair to the shoulders, wearing a teal blouse, warm and approachable',
  // 22 (גבר)
  'a man around 30 with short brown hair and a trimmed beard, wearing a grey henley shirt, relaxed and friendly',
  // 23 (אשה)
  'a young woman around 22 with a high ponytail and dark hair, wearing round glasses and a coral sweater, lively and smart',
  // 24 (גבר)
  'a young man around 22 with curly dark hair, clean-shaven, wearing a green hoodie, easygoing and warm',
  // 25 (אשה)
  'a woman around 35 with shoulder-length brown hair, wearing a burgundy blazer, professional and warm',
  // 26 (גבר)
  'a man around 35 with short black hair and glasses, light stubble, wearing a blue collared shirt, calm and friendly',
  // 27 (אשה)
  'a young woman around 28 with long wavy blonde hair, wearing a soft pink blouse, gentle and bright',
  // 28 (גבר)
  'a young man around 28 with dark hair styled up and a short beard, wearing a forest-green t-shirt, warm and upbeat',
  // 29 (אשה)
  'a woman around 40 with chin-length dark bob hair, wearing elegant earrings and a teal top, confident and kind',
  // 30 (גבר)
  'a man around 40 with short greying-at-the-temples dark hair, clean-shaven, wearing a charcoal sweater, friendly and steady',
  // 31 (אשה)
  'a young woman around 24 with curly brown hair and freckles, wearing a yellow blouse, cheerful and energetic',
  // 32 (גבר)
  'a young man around 24 with short sandy-brown hair, clean-shaven, wearing a light blue t-shirt, friendly and casual',
  // 33 (אשה)
  'a woman around 32 with long dark hair in soft waves, wearing a plum cardigan, warm and graceful',
  // 34 (גבר)
  'a man around 32 with short dark hair and a full short beard, wearing a denim shirt, approachable and warm',
  // 35 (אשה)
  'a young woman around 27 with straight shoulder-length auburn hair and glasses, wearing a teal sweater, smart and friendly',
  // 36 (גבר)
  'a young man around 27 with curly black hair, light stubble, wearing a rust-colored t-shirt, relaxed and cheerful',
  // 37 (אשה)
  'a woman around 38 with wavy brown hair to the shoulders, wearing a soft cream blouse, warm and confident',
  // 38 (גבר)
  'a man around 38 with short dark hair and a neat beard, wearing a green collared shirt, friendly and grounded',
]

export const AVATAR_CATEGORY = {
  dir: 'avatars',
  label: 'אווטרים',
  variants: SUBJECTS.map(subject => ({
    prompt: avatarStyle(subject),
    count: 1,
  })),
}
