// scripts/recipe-prompts.js
// ─────────────────────────────────────────────────────────────
// פרומפטים ליצירת תמונות מתכונים אוטומטית דרך Gemini.
//
// שתי קבוצות:
//   CATEGORY_IMAGES — תמונת שער ריאליסטית אחת לכל קטגוריה (12).
//                     נשמרות ב-public/recipe-categories/{id}.png
//   SEED_IMAGES     — תמונה ריאליסטית לכל מתכון לדוגמה (7).
//                     נשמרות ב-public/recipe-seed/{id}.png
//
// הפרומפטים מתוכננים לתמונות אוכל מקצועיות, מפתות, בתאורה טבעית.
// ─────────────────────────────────────────────────────────────

// ── תבנית בסיס לצילום אוכל מקצועי ──
// (בניגוד לרקעי הברכה — כאן דווקא רוצים שהמנה תמלא את הפריים)
const food = (dish) =>
  'Professional food photography, appetizing and beautiful, ' +
  'soft natural window light, shallow depth of field, ' +
  'styled on a rustic wooden table or ceramic plate, ' +
  'warm inviting colors, high-end restaurant menu quality, ' +
  'top-down or 45-degree angle, the dish fills most of the frame. ' +
  `The dish: ${dish}. ` +
  'IMPORTANT: no text, no letters, no words, no hands, no people, no logos.'

// ── תמונות שער לקטגוריות (12) ──
// id חייב להתאים ל-id ב-src/data/recipeCategories.js
export const CATEGORY_IMAGES = [
  { id: 'cakes',     dish: 'an assortment of beautiful cakes and desserts, a sliced layered cake with cream, colorful pastries' },
  { id: 'soups',     dish: 'a steaming bowl of hearty homemade soup with vegetables, garnished with herbs' },
  { id: 'salads',    dish: 'a fresh colorful chopped vegetable salad in a bowl, tomatoes cucumbers and greens, olive oil' },
  { id: 'meat',      dish: 'a roasted golden chicken and grilled meat on a platter, herbs and roasted potatoes' },
  { id: 'pasta',     dish: 'a plate of Italian pasta with tomato sauce and fresh basil, parmesan' },
  { id: 'baking',    dish: 'freshly baked artisan bread loaves and golden challah on a wooden board, rustic bakery' },
  { id: 'breakfast', dish: 'a beautiful breakfast spread, shakshuka in a pan with eggs, fresh bread' },
  { id: 'fish',      dish: 'a grilled salmon fillet with lemon and herbs on a plate, elegant seafood dish' },
  { id: 'vegan',     dish: 'a colorful vegan vegetable bowl, fresh greens chickpeas and roasted vegetables' },
  { id: 'holiday',   dish: 'a festive holiday meal table, traditional Jewish holiday food, warm candlelight' },
  { id: 'sides',     dish: 'a bowl of fluffy white rice and golden roasted potatoes, simple side dishes' },
  { id: 'drinks',    dish: 'colorful fruit smoothies and fresh juice in glasses, banana and berry shakes' },
]

// ── תמונות למתכונים לדוגמה (7) ──
// id חייב להתאים למתכון ב-seedCommunityContent (לפי הסדר/שם)
export const SEED_IMAGES = [
  { id: 'levivot',   dish: 'crispy golden potato latkes (levivot) stacked on a plate with sour cream' },
  { id: 'marak-of',  dish: 'a clear golden chicken soup with carrots and zucchini in a bowl' },
  { id: 'ugat-tapuchim', dish: 'a homemade apple cake with cinnamon, sliced, dusted with powdered sugar' },
  { id: 'chamin',    dish: 'a traditional Jewish cholent (chamin) stew with beans, potatoes, meat and eggs in a pot' },
  { id: 'salat',     dish: 'a finely chopped Israeli vegetable salad with tomatoes, cucumbers and parsley' },
  { id: 'ktzitzot',  dish: 'beef meatballs in rich red tomato sauce in a pan, garnished with parsley' },
  { id: 'shakshuka', dish: 'a classic shakshuka, eggs poached in spiced tomato pepper sauce in a cast iron pan' },
]

// ממפה שם מתכון לדוגמה → id של תמונה (לחיבור בקוד)
export const SEED_TITLE_TO_IMAGE = {
  'לביבות תפוחי אדמה של רחל': 'levivot',
  'מרק עוף של סבתא מרים': 'marak-of',
  'עוגת תפוחים של חנה': 'ugat-tapuchim',
  'חמין של יעקב': 'chamin',
  'סלט ירקות קצוץ של אסתר': 'salat',
  'קציצות בקר ברוטב של דוד': 'ktzitzot',
  'שקשוקה של משה': 'shakshuka',
}

export { food }
