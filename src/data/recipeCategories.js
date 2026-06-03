// src/data/recipeCategories.js
// ─────────────────────────────────────────────────────────────
// קטגוריות המתכונים — נקודת אמת אחת (גם לכתיבה, גם לתצוגה).
//
// כל קטגוריה: id (נשמר ב-Firestore), שם בעברית, אימוג'י, צבע גרדיאנט,
// ותמונת שער (img). התמונות נוצרות ע"י scripts/generate-recipe-images.js
// ונדחסות ל-JPEG ע"י scripts/compress-recipe-images.js, ונשמרות ב-
// public/recipe-categories/. אם תמונה עדיין לא קיימת — הכרטיס נופל
// חזרה לגרדיאנט הצבעוני (fallback אוטומטי בקוד).
// ─────────────────────────────────────────────────────────────

export const RECIPE_CATEGORIES = [
  { id: 'cakes',     name: 'עוגות וקינוחים', emoji: '🍰', grad: ['#C97B84', '#8E4A5A'], img: '/recipe-categories/cakes.jpg' },
  { id: 'soups',     name: 'מרקים',          emoji: '🍲', grad: ['#C98A4B', '#8A5A22'], img: '/recipe-categories/soups.jpg' },
  { id: 'salads',    name: 'סלטים',          emoji: '🥗', grad: ['#6F9A5A', '#3E6B34'], img: '/recipe-categories/salads.jpg' },
  { id: 'meat',      name: 'בשרים ועוף',     emoji: '🍗', grad: ['#A8503A', '#6E2E22'], img: '/recipe-categories/meat.jpg' },
  { id: 'pasta',     name: 'פסטה ואיטלקי',   emoji: '🍝', grad: ['#C29A3B', '#8A6A2E'], img: '/recipe-categories/pasta.jpg' },
  { id: 'baking',    name: 'מאפים ולחמים',   emoji: '🥖', grad: ['#B98A52', '#7E5A2E'], img: '/recipe-categories/baking.jpg' },
  { id: 'breakfast', name: 'ארוחת בוקר',     emoji: '🍳', grad: ['#C9A24B', '#9A6E22'], img: '/recipe-categories/breakfast.jpg' },
  { id: 'fish',      name: 'דגים',           emoji: '🐟', grad: ['#3E8FA8', '#235A6E'], img: '/recipe-categories/fish.jpg' },
  { id: 'vegan',     name: 'צמחוני וטבעוני', emoji: '🥬', grad: ['#5A9A6A', '#346B44'], img: '/recipe-categories/vegan.jpg' },
  { id: 'holiday',   name: 'אוכל לחג',       emoji: '🕯️', grad: ['#8E5A9A', '#5A2E6B'], img: '/recipe-categories/holiday.jpg' },
  { id: 'sides',     name: 'תוספות',         emoji: '🍚', grad: ['#B8943B', '#8A6A2E'], img: '/recipe-categories/sides.jpg' },
  { id: 'drinks',    name: 'שתייה ושייקים',  emoji: '🥤', grad: ['#C26B6B', '#8A3E3E'], img: '/recipe-categories/drinks.jpg' },
  { id: 'other',     name: 'אחר',            emoji: '🍴', grad: ['#7E7466', '#544C40'], img: null },
]

// מילון מהיר id → קטגוריה
export const CATEGORY_BY_ID = Object.fromEntries(RECIPE_CATEGORIES.map(c => [c.id, c]))

// מחזיר את אובייקט הקטגוריה (או "אחר" אם לא נמצא / חסר)
export function categoryOf(id) {
  return CATEGORY_BY_ID[id] || CATEGORY_BY_ID['other']
}
