// scripts/recipe-prompts.js
// ─────────────────────────────────────────────────────────────
// פרומפטים ליצירת תמונות מתכונים אוטומטית דרך Gemini.
//
// שתי קבוצות:
//   CATEGORY_IMAGES — תמונת שער ריאליסטית אחת לכל קטגוריה (12).
//                     נשמרות ב-public/recipe-categories/{id}.png
//   SEED_IMAGES     — תמונה לכל מתכון לדוגמה עם hasImage:true.
//                     נגזרות אוטומטית מ-src/data/seedRecipes.js.
//                     נשמרות ב-public/recipe-seed/{id}.png
//
// הפרומפטים מתוכננים לתמונות אוכל מקצועיות, מפתות, בתאורה טבעית.
// ─────────────────────────────────────────────────────────────
import { SEED_RECIPES } from '../src/data/seedRecipes.js'

// ── תבנית בסיס לצילום אוכל מקצועי ──
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

// ── תמונות למתכונים לדוגמה ──
// נגזר אוטומטית: כל מתכון עם hasImage:true מקבל תמונה.
// ה-dish נבנה משם המתכון + רשימת המצרכים, כדי שהתמונה תתאים למנה.
export const SEED_IMAGES = SEED_RECIPES
  .filter(r => r.hasImage)
  .map(r => ({
    id: r.id,
    dish: `${r.title} — a homemade Israeli dish. Key ingredients: ${(r.ingredients || []).slice(0, 4).join(', ')}`,
  }))

export { food }
