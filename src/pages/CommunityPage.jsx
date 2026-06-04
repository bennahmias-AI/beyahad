// src/pages/CommunityPage.jsx
// ─────────────────────────────────────────────────────────────
// מסך תוכן קהילתי — משמש גם ל"עצות" וגם ל"מתכונים".
//
// מקבל prop בשם `kind`:  'tip'  → מסך עצות
//                        'recipe' → מסך מתכונים
// אין לשוניות — כל מסך עצמאי לגמרי עם כותרת משלו.
//
// פסיכולוגית: כשמשתמש רואה "42 צפו במתכון שלי" — הוא מרגיש
// נחוץ ומועיל. זו "הותרת חותם" בצורה פרקטית.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { useUserStore } from '../stores/userStore.js'
import {
  watchCommunityPosts, createCommunityPost,
  incrementPostViews, togglePostLike, seedCommunityContent,
} from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'
import { IconBackRTL, IconHeart } from '../icons/index.jsx'
import HomeButton from '../components/HomeButton.jsx'

// הגדרות לכל סוג מסך
const CONFIG = {
  tip: {
    screenTitle: 'עצות של חברים',
    emoji: '💡',
    accent: '#B89048',
    accentDeep: '#8A6A2E',
    addLabel: 'הוסף עצה משלך',
    emptyTitle: 'עדיין אין עצות',
    composeTitle: '💡 הוסף עצה משלך',
    composeSub: 'שתף עצה או טיפ מניסיון החיים שלך',
    titlePlaceholder: 'למשל: איך לחסוך בחשמל',
    bodyLabel: 'העצה',
    bodyPlaceholder: 'כתוב כאן את העצה במילים שלך...',
  },
  recipe: {
    screenTitle: 'מתכונים',
    emoji: '🍲',
    accent: '#7E2C2E',
    accentDeep: '#5A1D1E',
    addLabel: 'הוסף מתכון משלך',
    emptyTitle: 'עדיין אין מתכונים',
    composeTitle: '🍲 הוסף מתכון משלך',
    composeSub: 'שתף מתכון אהוב — אחרים ישמחו לנסות',
    titlePlaceholder: 'למשל: עוגת תפוחים של סבתא',
    bodyLabel: 'המתכון',
    bodyPlaceholder: 'מצרכים והוראות הכנה...',
  },
}

// קטגוריות העצות — מקבילות למבנה המתכונים
const TIP_CATEGORIES = [
  { id: 'home',    name: 'לבית',          emoji: '🏠', grad: ['#C97B84', '#8E4A5A'], img: '/tip-categories/home.jpg' },
  { id: 'car',     name: 'לרכב',          emoji: '🚗', grad: ['#5E7CA6', '#33507A'], img: '/tip-categories/car.jpg' },
  { id: 'daily',   name: 'ליום-יום',      emoji: '✨', grad: ['#C9A24B', '#9A6E22'], img: '/tip-categories/daily.jpg' },
  { id: 'travel',  name: 'טיולים ופנאי',  emoji: '✈️', grad: ['#3E8FA8', '#235A6E'], img: '/tip-categories/travel.jpg' },
  { id: 'season',  name: 'לפי עונה',      emoji: '🌦️', grad: ['#6F9A5A', '#3E6B34'], img: '/tip-categories/season.jpg' },
  { id: 'kitchen', name: 'מטבח ובישול',   emoji: '🍳', grad: ['#A8503A', '#6E2E22'], img: '/tip-categories/kitchen.jpg' },
  { id: 'tech',    name: 'טכנולוגיה',     emoji: '📱', grad: ['#7E6BA6', '#4E3E78'], img: '/tip-categories/tech.jpg' },
  { id: 'family',  name: 'משפחה ונכדים',  emoji: '👨‍👩‍👧', grad: ['#C98A4B', '#8A5A22'], img: '/tip-categories/family.jpg' },
  { id: 'other',   name: 'כללי',          emoji: '💡', grad: ['#7E7466', '#544C40'], img: null },
]
const TIP_CAT_BY_ID = Object.fromEntries(TIP_CATEGORIES.map(c => [c.id, c]))
function tipCategoryOf(id) { return TIP_CAT_BY_ID[id] || TIP_CAT_BY_ID['other'] }

// עצות לדוגמה — קטגוריית "לבית" (10 עצות, מיוחסות לחברים)
const HOME_TIPS = [
  { category: 'home', author: 'רחל אברהמי', title: 'ריח טוב בארון', body: 'הניחו שקיות בד קטנות עם סבון מוצק מגורד בתוך ארון הבגדים במקום להשתמש במבשמי אוויר כימיים.' },
  { category: 'home', author: 'מרים שלום', title: 'הסרת אבנית מקומקום', body: 'הרתיחו מים עם חצי כוס חומץ וכמה פלחי לימון, השאירו לחצי שעה ושטפו היטב.' },
  { category: 'home', author: 'דוד פרץ', title: 'מניעת החלקה על שטיחים', body: 'הדביקו פסי סיליקון דקים או הניחו רשת מיוחדת נגד החלקה מתחת לשטיחי חדר הרחצה והסלון.' },
  { category: 'home', author: 'חנה גולדמן', title: 'ניקוי חלונות מבריק', body: 'השתמשו בתערובת של מים, מעט חומץ ונייר עיתון ישן לניגוב – זה לא משאיר סימנים.' },
  { category: 'home', author: 'יעקב לוי', title: 'פתיחת סתימות קלות בכיור', body: 'שפכו חצי כוס סודה לשתייה, מעליה חצי כוס חומץ, חכו 15 דקות ושטפו במים רותחים.' },
  { category: 'home', author: 'אסתר כהן', title: 'חידוד מספריים ישנים', body: 'גזרו כמה פעמים חתיכת נייר כסף (אלומיניום) שקופלה לכמה שכבות.' },
  { category: 'home', author: 'לאה ברקוביץ', title: 'הסרת מדבקות מזכוכית', body: 'חממו את המדבקה עם מייבש שיער למשך דקה והיא תתקלף בקלות ללא סימני דבק.' },
  { category: 'home', author: 'משה דניאל', title: 'הברקת ברזים', body: 'שפשפו את הברז עם חצי לימון סחוט ולאחר מכן נגבו במטלית יבשה ונקייה.' },
  { category: 'home', author: 'שרה פלדמן', title: 'סידור כבלים במגירה', body: 'השתמשו בגלילי נייר טואלט ריקים כדי לאחסן כבלים מגולגלים ולמנוע מהם להסתבך זה בזה.' },
  { category: 'home', author: 'יוסף מזרחי', title: 'דישון לעציצים', body: 'הוסיפו מעט קפה שחור משומש לאדמת העציצים – זה משמש כדשן טבעי ומצוין לצמחים.' },
]

// עצות לדוגמה — קטגוריית "לרכב"
const CAR_TIPS = [
  { category: 'car', author: 'בתיה רוזן', title: 'ניקוי פנסים עכורים', body: 'מרחו משחת שיניים רגילה על פלסטיק הפנס, שפשפו במעגלים עם מטלית ושטפו במים.' },
  { category: 'car', author: 'אברהם נחום', title: 'מניעת הצטברות אדים בשמשה', body: 'מרחו מעט קצף גילוח על החלק הפנימי של השמשה ונגבו היטב עד לשקיפות מלאה.' },
  { category: 'car', author: 'רחל אברהמי', title: 'מציאת הרכב בחניון', body: 'צלמו בסמארטפון את מספר העמוד והצבע מיד אחרי שאתם מחנים בחניון גדול.' },
  { category: 'car', author: 'מרים שלום', title: 'שמירה על המגבים', body: 'נקו את גומי המגב עם מגבון לח מדי פעם כדי להסיר אבק, להאריך את חייו ולמנוע חריקות.' },
  { category: 'car', author: 'דוד פרץ', title: 'קירור מהיר של רכב לוהט', body: 'פתחו חלון אחד, גשו לדלת הנגדית ופתחו וסגרו אותה במהירות 5-6 פעמים כמו מניפה כדי לדחוף את האוויר החם החוצה.' },
  { category: 'car', author: 'חנה גולדמן', title: 'שמירה על ריפודי המושבים', body: 'פרסו סדין ישן או מגבת גדולה על המושב האחורי כשאתם מסיעים נכדים עם אוכל או ציוד מהים.' },
  { category: 'car', author: 'יעקב לוי', title: 'ניקיון מחזיקי הכוסות', body: 'הניחו תבניות מאפינס מסיליקון בתוך מחזיקי הכוסות ברכב – קל לשלוף ולשטוף אותן כשהן מתלכלכות.' },
  { category: 'car', author: 'אסתר כהן', title: 'בדיקת לחץ אוויר', body: 'בדקו אוויר בצמיגים פעם בחודש. צמיגים מנופחים כראוי משפרים את הבטיחות וחוסכים דלק.' },
  { category: 'car', author: 'לאה ברקוביץ', title: 'שחרור מנעול דלת נוקשה', body: 'רססו מעט תרסיס שמן (כמו WD-40) לתוך חור המנעול, במידה ויש מפתח פיזי לדלת.' },
  { category: 'car', author: 'משה דניאל', title: 'ריח טוב ברכב', body: 'תפסו אטב כביסה מעץ על פתח המזגן אחרי שטפטפתם עליו כמה טיפות של שמן אתרי אהוב.' },
]

// עצות לדוגמה — קטגוריית "ליום-יום"
const DAILY_TIPS = [
  { category: 'daily', author: 'שרה פלדמן', title: 'שחרור רוכסן תקוע', body: 'שפשפו עיפרון עופרת פשוט או קצה של סבון מוצק על שיני הרוכסן הבעייתי.' },
  { category: 'daily', author: 'יוסף מזרחי', title: 'פתיחת צנצנת עקשנית', body: 'כרכו גומייה עבה סביב המכסה כדי לייצר אחיזה טובה יותר לכף היד, או תנו מכה קלה על התחתית.' },
  { category: 'daily', author: 'בתיה רוזן', title: 'השחלת חוט במחט', body: 'רססו מעט ספריי לשיער על קצה החוט כדי להקשות אותו, או למרוח עליו מעט לק שקוף.' },
  { category: 'daily', author: 'אברהם נחום', title: 'הסרת מסטיק מבגד', body: 'הכניסו את הבגד למקפיא לשעתיים. המסטיק יתקשה ויתפורר בקלות מבלי לפגוע בבד.' },
  { category: 'daily', author: 'רחל אברהמי', title: 'התרת קשר בשרשרת עדינה', body: 'פזרו מעט טלק או קורנפלור על הקשר, והיעזרו בשתי סיכות תפירה כדי לשחרר אותו בעדינות.' },
  { category: 'daily', author: 'מרים שלום', title: 'מציאת פריטים קטנים (כמו עגיל שנפל)', body: 'מתחו גרביון ניילון על פתח צינור השואב אבק ושאבו באזור – הפריט ייצמד לגרביון ולא יישאב פנימה.' },
  { category: 'daily', author: 'דוד פרץ', title: 'כתיבת פתק ללא עט', body: 'צלמו תמונה בסמארטפון של מה שרציתם לזכור (כמו מספר טלפון על שלט חוצות או מתכון בעיתון).' },
  { category: 'daily', author: 'חנה גולדמן', title: 'הרגעת עקיצת יתוש', body: 'מרחו מעט משחת שיניים בטעם מנטה או שפשפו פלח לימון ישירות על העקיצה כדי להרגיע את הגירוד.' },
  { category: 'daily', author: 'יעקב לוי', title: 'שמירה על סוללות מרוכזות', body: 'אחסנו סוללות חדשות בקופסה סגורה הרחק מלחות וחום (אין צורך לאחסן במקרר).' },
  { category: 'daily', author: 'אסתר כהן', title: 'הפרדת מפתחות בצרור', body: 'צבעו את ראשיהם של מפתחות דומים בלק ציפורניים בצבעים שונים כדי לזהות אותם בקלות.' },
]

// עצות לדוגמה — קטגוריית "טיולים ופנאי"
const TRAVEL_TIPS = [
  { category: 'travel', author: 'לאה ברקוביץ', title: 'אריזה ללא קמטים', body: 'גלגלו את הבגדים לגלילים צפופים במקום לקפל אותם – זה גם חוסך המון מקום במזוודה וגם מונע קמטים.' },
  { category: 'travel', author: 'משה דניאל', title: 'אריזת תכשיטים מונעת קשרים', body: 'השחילו שרשראות בתוך קשיות שתייה וסגרו אותן, כך שהן לא יסתבכו זו בזו.' },
  { category: 'travel', author: 'שרה פלדמן', title: 'צילום מסמכים חשובים', body: 'צלמו בנייד את הדרכון, כרטיס קופת החולים ופוליסת הביטוח, ושלחו לעצמכם בוואטסאפ לגיבוי.' },
  { category: 'travel', author: 'יוסף מזרחי', title: 'חיסכון במשקל בתיק הרחצה', body: 'קנו בקבוקוני פלסטיק קטנים (של 50-100 מ\"ל) ומלאו בהם שמפו וסבון במקום לסחוב בקבוקים מלאים.' },
  { category: 'travel', author: 'בתיה רוזן', title: 'אריזת נעליים', body: 'הכניסו נעליים לתוך כובעי רחצה (כמו אלו שמחלקים במלונות) כדי שהסוליה לא תלכלך את הבגדים סביבה.' },
  { category: 'travel', author: 'אברהם נחום', title: 'מים קרים לטיול בחוץ', body: 'הקפיאו חצי בקבוק מים באלכסון בלילה שלפני, ומלאו את החצי השני במים רגילים בבוקר היציאה.' },
  { category: 'travel', author: 'רחל אברהמי', title: 'הגנה מפני כייסים', body: 'השתמשו בחגורת כסף פנימית או הקפידו להחזיק את הארנק בכיס הקדמי בלבד, לעולם לא באחורי.' },
  { category: 'travel', author: 'מרים שלום', title: 'הטענה זמינה', body: 'החזיקו תמיד כבל הטענה נוסף וסוללה ניידת טעונה (פאוור-בנק) בתיק היד או הגב הקטן.' },
  { category: 'travel', author: 'דוד פרץ', title: 'בחירת מסלול מותאם', body: 'בדקו מראש באתרים קהילתיים את רמת הנגישות, מידת ההליכה, והימצאות ספסלי ישיבה ושירותים במסלול.' },
  { category: 'travel', author: 'חנה גולדמן', title: 'תרופות בטיסה', body: 'ארזו תמיד את תרופות המרשם שלכם בתיק העלייה למטוס (טרולי), לעולם לא במזוודה שנשלחת לתא המטען.' },
]

// עצות לדוגמה — קטגוריית "לפי עונה"
const SEASON_TIPS = [
  { category: 'season', author: 'יעקב לוי', title: 'צינון המיטה בקיץ', body: 'הכניסו את הציפה של השמיכה או את הסדין למקפיא למשך 20 דקות (בתוך שקית אטומה) לפני השינה.' },
  { category: 'season', author: 'אסתר כהן', title: 'מניעת עובש בחורף', body: 'אווררו את הבית מדי יום לפחות רבע שעה גם כשקר בחוץ, כדי להזרים אוויר טרי ולמנוע לחות.' },
  { category: 'season', author: 'לאה ברקוביץ', title: 'כפות רגליים חמות בחורף', body: 'פזרו מעט פלפל שחור טחון בתוך גרביים חמות לפני שגורבים אותן (פטנט סבתות ידוע לחימום מהיר).' },
  { category: 'season', author: 'משה דניאל', title: 'מלכודת זבובים טבעית לקיץ', body: 'הניחו קערית עם חומץ תפוחים וכמה טיפות סבון כלים על השולחן במרפסת.' },
  { category: 'season', author: 'שרה פלדמן', title: 'ייבוש מהיר של מטריה', body: 'השאירו את המטריה פתוחה למחצה בחדר האמבטיה או במרפסת השירות במקום לסגור אותה כשהיא רטובה.' },
  { category: 'season', author: 'יוסף מזרחי', title: 'הקפדה על שתייה בקיץ', body: 'הניחו קנקן מים שקוף עם פלחי לימון ונענע במרכז שולחן הסלון כתזכורת טבעית לשתות יותר.' },
  { category: 'season', author: 'בתיה רוזן', title: 'הסרת בוץ מנעליים בחורף', body: 'תנו לבוץ להתייבש לחלוטין לפני שאתם מנסים להבריש אותו מהנעל, אחרת הוא רק יימרח ויכתים.' },
  { category: 'season', author: 'אברהם נחום', title: 'הרחקת נמלים בקיץ', body: 'פזרו מעט אבקת קינמון, ציפורן או שאריות קפה באזורים בהם הנמלים נכנסות למטבח.' },
  { category: 'season', author: 'רחל אברהמי', title: 'שמירה על עור הפנים בחורף', body: 'מרחו קרם לחות מיד אחרי המקלחת, כשהעור עוד מעט לח, כדי לכלוא את הלחות פנימה.' },
  { category: 'season', author: 'מרים שלום', title: 'חיסכון בחשמל בקיץ', body: 'כוונו את המזגן ל-24 או 25 מעלות ושלבו אותו עם מאוורר תקרה, התחושה תהיה קרירה ונעימה מבלי לבזבז אנרגיה.' },
]

// עצות לדוגמה — קטגוריית "מטבח ובישול"
const KITCHEN_TIPS = [
  { category: 'kitchen', author: 'דוד פרץ', title: 'קילוף שום בקלות', body: 'הכניסו את שיני השום לצנצנת סגורה ושקשקו אותה חזק למשך 10 שניות – הקליפות ייפרדו מעצמן.' },
  { category: 'kitchen', author: 'חנה גולדמן', title: 'שמירה על טריות עשבי תיבול', body: 'עטפו פטרוזיליה או כוסברה בנייר סופג לח, והכניסו לשקית אטומה במקרר.' },
  { category: 'kitchen', author: 'יעקב לוי', title: 'מניעת גלישת מים מסיר', body: 'הניחו כף עץ לרוחב חלקו העליון של הסיר (למשל כשמכינים פסטה) כדי לשבור את הבועות ולמנוע גלישה.' },
  { category: 'kitchen', author: 'אסתר כהן', title: 'סחיטת לימון מקסימלית', body: 'גלגלו את הלימון תוך כדי לחיצה על השיש לפני החיתוך, או חממו אותו במיקרוגל ל-10 שניות.' },
  { category: 'kitchen', author: 'לאה ברקוביץ', title: 'שמירה על חצי אבוקדו', body: 'השאירו את הגלעין בתוך החצי שלא נאכל, טפטפו קצת מיץ לימון ואחסנו בקופסה אטומה יחד עם חתיכת בצל.' },
  { category: 'kitchen', author: 'משה דניאל', title: 'התפחת בצק ביום קר', body: 'הכניסו את קערת הבצק לתנור כבוי, ולצידה הניחו קערה קטנה עם מים רותחים שייצרו אדים חמימים.' },
  { category: 'kitchen', author: 'שרה פלדמן', title: 'בדיקת טריות ביצה', body: 'הכניסו את הביצה לכוס מים – ביצה טרייה תשקע לקרקעית, ואילו ביצה ישנה (ומקולקלת) תצוף למעלה.' },
  { category: 'kitchen', author: 'יוסף מזרחי', title: 'מניעת דמעות בחיתוך בצל', body: 'הכניסו את הבצל למקפיא ל-15 דקות לפני החיתוך, או חתכו אותו ליד ברז מים זורמים.' },
  { category: 'kitchen', author: 'בתיה רוזן', title: 'תיקון מרק מלוח מדי', body: 'הכניסו למרק תפוח אדמה קלוף ושלם שייספוג את עודפי המלח, והוציאו אותו בסוף הבישול.' },
  { category: 'kitchen', author: 'אברהם נחום', title: 'ניקוי קרש חיתוך מעץ', body: 'פזרו עליו מלח גס ושפשפו עם חצי לימון כדי לחטא, לנקות היטב ולהסיר ריחות של שום או דגים.' },
]

// עצות לדוגמה — קטגוריית "טכנולוגיה"
const TECH_TIPS = [
  { category: 'tech', author: 'רחל אברהמי', title: 'הגדלת טקסט במסך', body: 'אל תאמצו את העיניים. היכנסו להגדרות התצוגה במכשיר והגדילו את גודל הגופן למידה שנוחה לכם לקריאה.' },
  { category: 'tech', author: 'מרים שלום', title: 'הקראת הודעות בקול', body: 'השתמשו בעוזרת הקולית (כמו Siri או Google) ובקשו ממנה: \"תקריאי לי את ההודעה האחרונה\".' },
  { category: 'tech', author: 'דוד פרץ', title: 'גיבוי תמונות אוטומטי', body: 'ודאו שמותקנת לכם אפליקציה כמו Google Photos או iCloud כדי שהתמונות שלכם ישמרו תמיד בענן, גם אם הטלפון אובד.' },
  { category: 'tech', author: 'חנה גולדמן', title: 'צילום תמונה מהיר', body: 'ברוב המכשירים, לחיצה כפולה ומהירה על כפתור ההפעלה בצד המכשיר פותחת מיד את המצלמה.' },
  { category: 'tech', author: 'יעקב לוי', title: 'חיפוש בוואטסאפ', body: 'השתמשו בזכוכית המגדלת בחלק העליון של הוואטסאפ כדי למצוא תמונות, מסמכים או מילים ספציפיות במקום לגלול אחורה שעות.' },
  { category: 'tech', author: 'אסתר כהן', title: 'סינון שיחות לא רצויות', body: 'הורידו אפליקציה לזיהוי שיחות (כמו Truecaller) כדי לדעת מראש אם המספר שמחייג אליכם שייך לטלמרקטינג או ספאם.' },
  { category: 'tech', author: 'לאה ברקוביץ', title: 'הקלדה קולית', body: 'התעייפתם מלהקליד? לחצו על סמל המיקרופון הקטן במקלדת (לא זה של ההודעה הקולית בוואטסאפ) ופשוט דברו – הטלפון יהפוך את המילים לטקסט.' },
  { category: 'tech', author: 'משה דניאל', title: 'סידור אפליקציות במסך', body: 'רכזו את האפליקציות שאתם צריכים ליום-יום (קופת חולים, בנק, פנגו) לתיקייה אחת במסך הראשי בשם \"סידורים\".' },
  { category: 'tech', author: 'שרה פלדמן', title: 'הארכת חיי הסוללה', body: 'הנמיכו מעט את בהירות המסך והפעילו את \"מצב חיסכון בסוללה\" כשאתם יוצאים מהבית ליום שלם.' },
  { category: 'tech', author: 'יוסף מזרחי', title: 'הפתרון להכל', body: 'אם הטלפון נתקע או עושה בעיות – הפתרון הראשון, הפשוט והיעיל ביותר הוא תמיד לכבות ולהדליק אותו מחדש.' },
]

// עצות לדוגמה — קטגוריית "משפחה ונכדים"
const FAMILY_TIPS = [
  { category: 'family', author: 'בתיה רוזן', title: 'זמן איכות ללא מסכים', body: 'הגדירו \"קופסת טלפונים\" בכניסה לבית בארוחות שישי, שבה כולם – מבוגרים וצעירים – מניחים את הניידים.' },
  { category: 'family', author: 'אברהם נחום', title: 'קופסת הפתעות לביקורים', body: 'החזיקו בבית \"קופסת פלא\" עם מדבקות, צבעים ומשחקים קטנים שיוצאת מהארון רק כשהנכדים מגיעים לבקר.' },
  { category: 'family', author: 'רחל אברהמי', title: 'אפייה משותפת בסבלנות', body: 'הכניסו מתכון פשוט כמו כדורי שוקולד, ותנו לנכדים ללוש וללכלך – החוויה המשותפת חשובה יותר ממטבח מבריק.' },
  { category: 'family', author: 'מרים שלום', title: 'מתנות שהן חוויות', body: 'במקום עוד צעצוע פלסטיק, קנו חוויות משותפות: כרטיסים להצגה, ביקור בחי-פארק או סדנת יצירה יחד איתכם.' },
  { category: 'family', author: 'דוד פרץ', title: 'הקלטת סיפורי ילדות', body: 'הקליטו את עצמכם בהודעה קולית מספרים זיכרון מהילדות שלכם או סיפור אגדה לפני השינה, ושלחו לנכדים בוואטסאפ.' },
  { category: 'family', author: 'חנה גולדמן', title: 'יצירה מחומרים ממוחזרים', body: 'שמרו גלילי נייר טואלט, קרטוני ביצים ופקקים כדי ליצור עבודות יד ופעילות זולה ויצירתית בחופשים.' },
  { category: 'family', author: 'יעקב לוי', title: 'אלבום משפחתי משותף', body: 'פתחו קבוצת וואטסאפ שקטה שמיועדת רק להעלאת תמונות יפות של המשפחה, כדי שאף תמונה מוצלחת לא תלך לאיבוד בשיחות.' },
  { category: 'family', author: 'אסתר כהן', title: 'משחקים בשיחת וידאו', body: 'אם אתם מדברים עם נכד בשיחת וידאו, אפשר לשחק יחד משחקים מרחוק כמו \"ארץ עיר\", \"20 שאלות\" או חידונים.' },
  { category: 'family', author: 'לאה ברקוביץ', title: 'טיפוח גינה משותף', body: 'העניקו לנכד או נכדה עציץ קטן משלהם, שיהיה באחריותם להשקות ולטפח בכל פעם שהם מגיעים אליכם.' },
  { category: 'family', author: 'משה דניאל', title: 'להיות סבא וסבתא, לא הורים', body: 'תנו לילדים שלכם לחנך ולעשות את עבודת ההורות, והשאירו לעצמכם את התפקיד הכיפי – להיות המקום המפנק, המכיל ונטול הביקורת.' },
]

export default function CommunityPage({ onBack, onHome, kind = 'tip', initialPostId = null }) {
  const { profile, authUser } = useUserStore()
  const cfg = CONFIG[kind] || CONFIG.tip

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [openPost, setOpenPost] = useState(null)
  const [composing, setComposing] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [activeCat, setActiveCat] = useState(null)   // קטגוריה נבחרת (null = גריד הקטגוריות)
  const [search, setSearch] = useState('')           // חיפוש חופשי
  const openedInitialRef = useRef(false)
  const [notice, setNotice] = useState('')   // הודעת "נשלח לאישור" אחרי פרסום

  // ההודעה נעלמת לבד אחרי כמה שניות
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 6000)
    return () => clearTimeout(t)
  }, [notice])

  // Watch posts of this kind
  useEffect(() => {
    setLoading(true)
    const unsub = watchCommunityPosts(kind, list => {
      setPosts(list)
      setLoading(false)
    })
    return () => unsub && unsub()
  }, [kind])

  // הגענו מהתראה על לייק — פותחים אוטומטית את הפוסט הספציפי (פעם אחת)
  useEffect(() => {
    if (!initialPostId || openedInitialRef.current || posts.length === 0) return
    const post = posts.find(p => p.id === initialPostId)
    if (post) {
      openedInitialRef.current = true
      setOpenPost(post)
      incrementPostViews(post.id).catch(() => {})
    }
  }, [initialPostId, posts])

  const openItem = async (post) => {
    setOpenPost(post)
    await incrementPostViews(post.id)
  }

  // אדמין רואה הכל; משתמש רגיל רואה תוכן מאושר + הפוסטים שלו עצמו (גם ממתינים).
  const isAdmin = profile?.role === 'admin'
  const visiblePosts = posts.filter(p =>
    p.approved !== false || (authUser?.uid && p.authorUid === authUser.uid) || isAdmin
  )

  // ספירת עצות לכל קטגוריה
  const countByCat = {}
  for (const p of visiblePosts) {
    const c = p.category || 'other'
    countByCat[c] = (countByCat[c] || 0) + 1
  }
  const catPosts = activeCat ? visiblePosts.filter(p => (p.category || 'other') === activeCat) : []
  const searchQ = search.trim().toLowerCase()
  const searchResults = searchQ
    ? visiblePosts.filter(p =>
        (p.title || '').toLowerCase().includes(searchQ) ||
        (p.body || '').toLowerCase().includes(searchQ) ||
        (p.authorName || '').toLowerCase().includes(searchQ))
    : []

  // מילוי עצות לדוגמה — כרגע קטגוריית "לבית"
  const handleSeed = async () => {
    if (seeding) return
    setSeeding(true)
    try {
      if (kind === 'tip') {
        const existing = new Set(posts.map(p => `${p.category}|${p.title}`))
        for (const t of [...HOME_TIPS, ...CAR_TIPS, ...DAILY_TIPS, ...TRAVEL_TIPS, ...SEASON_TIPS, ...KITCHEN_TIPS, ...TECH_TIPS, ...FAMILY_TIPS]) {
          if (existing.has(`${t.category}|${t.title}`)) continue
          await createCommunityPost({
            kind: 'tip', title: t.title, body: t.body,
            category: t.category, authorUid: authUser?.uid, authorName: t.author,
            approved: true,   // תוכן דוגמה — מאושר אוטומטית
          })
        }
      } else {
        await seedCommunityContent(authUser?.uid)
      }
    } catch (e) {
      console.error('seed error:', e)
    }
    setSeeding(false)
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">{cfg.screenTitle}</div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div style={{ padding: '8px 20px 28px' }}>
        {notice && (
          <div onClick={() => setNotice('')} style={{
            background: '#3E6B34', color: '#fff', borderRadius: 14, padding: '12px 16px',
            fontSize: 15, fontWeight: 700, marginBottom: 14, cursor: 'pointer', lineHeight: 1.5,
          }}>✓ {notice}</div>
        )}
        {/* Add button */}
        <button
          onClick={() => setComposing(true)}
          style={{
            width: '100%',
            background: `linear-gradient(135deg, ${cfg.accent} 0%, ${cfg.accentDeep} 100%)`,
            color: '#FBF7EE', border: 'none',
            borderRadius: 18, padding: '15px 18px',
            fontSize: 17, fontWeight: 700, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: `0 8px 20px -8px ${cfg.accent}88`,
            marginBottom: 18,
          }}
        >
          ➕ {cfg.addLabel}
        </button>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontSize: 16 }}>טוען...</div>
        ) : visiblePosts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-2)' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>{cfg.emoji}</div>
            <div className="h-display" style={{ fontSize: 20, marginBottom: 6, color: 'var(--ink)' }}>{cfg.emptyTitle}</div>
            <div style={{ fontSize: 15 }}>היה הראשון לשתף — לחץ על הכפתור למעלה</div>
            {isAdmin && (
            <button onClick={handleSeed} disabled={seeding} style={{
              marginTop: 24, background: 'var(--surface)', color: 'var(--ink-3)',
              border: '1px dashed var(--line-strong)', borderRadius: 12, padding: '10px 18px',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            }}>{seeding ? 'ממלא...' : '✨ מלא תוכן לדוגמה'}</button>
            )}
          </div>
        ) : (
          <>
            {/* שורת חיפוש */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 14, padding: '10px 14px', marginBottom: 16 }}>
              <span style={{ fontSize: 18 }}>🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="חיפוש עצה, נושא או חבר..."
                style={{ flex: 1, border: 'none', outline: 'none', background: 'none', fontSize: 16, fontFamily: 'inherit', color: 'var(--ink)', direction: 'rtl' }}
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="נקה חיפוש" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 20, padding: 0, lineHeight: 1 }}>✕</button>
              )}
            </div>

            {searchQ ? (
              searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--ink-2)' }}>
                  <div style={{ fontSize: 48, marginBottom: 10 }}>🔍</div>
                  <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)' }}>לא נמצאו עצות</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>נסו מילה אחרת</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 14, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 12 }}>{searchResults.length} {searchResults.length === 1 ? 'תוצאה' : 'תוצאות'}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {searchResults.map(post => (
                      <PostCard key={post.id} post={post} accent={cfg.accent} myUid={authUser?.uid} onClick={() => openItem(post)} />
                    ))}
                  </div>
                </>
              )
            ) : activeCat ? (
              <>
                <TipCategoryHeader cat={tipCategoryOf(activeCat)} count={catPosts.length} onBack={() => setActiveCat(null)} />
                {catPosts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--ink-2)' }}>
                    <div style={{ fontSize: 48, marginBottom: 10 }}>{tipCategoryOf(activeCat).emoji}</div>
                    <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)' }}>עדיין אין עצות בנושא הזה</div>
                    <div style={{ fontSize: 14, marginTop: 4 }}>היה הראשון להוסיף!</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {catPosts.map(post => (
                      <PostCard key={post.id} post={post} accent={cfg.accent} myUid={authUser?.uid} onClick={() => openItem(post)} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>עיינו לפי נושא:</div>
                  {isAdmin && (
                  <button onClick={handleSeed} disabled={seeding} style={{
                    background: 'var(--surface)', color: 'var(--ink-3)',
                    border: '1px dashed var(--line-strong)', borderRadius: 10, padding: '6px 12px',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>{seeding ? 'ממלא...' : '✨ מלא עצות לדוגמה'}</button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {TIP_CATEGORIES.filter(c => c.id !== 'other' || (countByCat['other'] || 0) > 0).map(cat => (
                    <TipCategoryCard key={cat.id} cat={cat} count={countByCat[cat.id] || 0} onClick={() => setActiveCat(cat.id)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Compose modal ──────────────────────────────────── */}
      {composing && (
        <ComposeModal
          cfg={cfg}
          onClose={() => setComposing(false)}
          onSubmit={async ({ title, body, category }) => {
            await createCommunityPost({
              kind, title, body, category,
              authorUid: authUser?.uid,
              authorName: profile?.name || 'משתמש',
              approved: isAdmin,   // אדמין — מאושר מיד; משתמש רגיל — ממתין לאישור
            })
            setComposing(false)
            if (!isAdmin) {
              setNotice(kind === 'recipe'
                ? 'המתכון נשלח! הוא יופיע לכולם אחרי שמנהל יאשר אותו.'
                : 'העצה נשלחה! היא תופיע לכולם אחרי שמנהל יאשר אותה.')
            }
          }}
        />
      )}

      {/* ── Post detail modal ──────────────────────────────── */}
      {openPost && (
        <PostDetailModal
          post={openPost}
          accent={cfg.accent}
          myUid={authUser?.uid}
          onClose={() => setOpenPost(null)}
        />
      )}
    </div>
  )
}

// ── Post card (in list) ─────────────────────────────────────
// כרטיס קטגוריה (גריד) — תמונת שער ריאליסטית עם fallback לאימוג'י על גרדיאנט
function TipCategoryCard({ cat, count, onClick }) {
  const [imgOk, setImgOk] = useState(Boolean(cat.img))
  const showImg = cat.img && imgOk
  return (
    <button onClick={onClick} style={{
      border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
      borderRadius: 18, overflow: 'hidden', position: 'relative',
      aspectRatio: '1 / 0.82', boxShadow: 'var(--shadow-sm)',
      background: `linear-gradient(145deg, ${cat.grad[0]}, ${cat.grad[1]})`,
      display: 'block', width: '100%',
    }}>
      {showImg && (
        <img
          src={cat.img}
          alt={cat.name}
          loading="lazy"
          onError={() => setImgOk(false)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {!showImg && (
        <span style={{
          position: 'absolute', insetInlineStart: 10, bottom: 6,
          fontSize: 58, opacity: 0.3, lineHeight: 1, transform: 'rotate(-8deg)',
        }}>{cat.emoji}</span>
      )}
      <div style={{
        position: 'absolute', inset: 0, padding: '14px 15px',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', textAlign: 'right',
        background: showImg
          ? 'linear-gradient(to top, rgba(20,23,42,.78) 0%, rgba(20,23,42,.15) 55%, rgba(20,23,42,0) 100%)'
          : 'linear-gradient(to top, rgba(20,23,42,.34) 0%, rgba(20,23,42,0) 60%)',
      }}>
        <div style={{ color: '#fff', fontSize: 19, fontWeight: 900, lineHeight: 1.15, textShadow: '0 1px 4px rgba(0,0,0,.4)' }}>{cat.name}</div>
        <div style={{ color: 'rgba(255,255,255,.92)', fontSize: 12.5, fontWeight: 700, marginTop: 2 }}>{count} {count === 1 ? 'עצה' : 'עצות'}</div>
      </div>
    </button>
  )
}

// כותרת קטגוריה (מעל הרשימה) עם כפתור חזרה
function TipCategoryHeader({ cat, count, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <button onClick={onBack} aria-label="חזרה לקטגוריות" style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
        border: '1px solid var(--line)', background: 'var(--surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><IconBackRTL size={20} color="#1B2540" /></button>
      <span style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0, fontSize: 22,
        background: `linear-gradient(145deg, ${cat.grad[0]}, ${cat.grad[1]})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{cat.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="h-display" style={{ fontSize: 21, color: 'var(--ink)', lineHeight: 1.1 }}>{cat.name}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>{count} {count === 1 ? 'עצה' : 'עצות'}</div>
      </div>
    </div>
  )
}

function PostCard({ post, accent, myUid, onClick }) {
  const likeCount = (post.likes || []).length
  const iLiked = myUid && (post.likes || []).includes(myUid)

  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'right',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 18, padding: '14px 16px',
      boxShadow: 'var(--shadow-sm)',
      fontFamily: 'inherit',
      display: 'block',
    }}>
      {post.category && (
        <span style={{
          display: 'inline-block', fontSize: 11.5, fontWeight: 800, color: accent,
          background: 'rgba(184,144,72,.14)', padding: '3px 10px', borderRadius: 999, marginBottom: 8,
        }}>{tipCategoryOf(post.category).name}</span>
      )}
      {post.approved === false && (
        <span style={{
          display: 'inline-block', fontSize: 11.5, fontWeight: 800, color: '#8A6A2E',
          background: 'rgba(184,144,72,.18)', padding: '3px 10px', borderRadius: 999, marginBottom: 8, marginInlineStart: 6,
        }}>⏳ ממתין לאישור</span>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Avatar name={post.authorName} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="h-display" style={{
            fontSize: 18, color: 'var(--ink)', lineHeight: 1.25, marginBottom: 3,
          }}>
            {post.title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>
            מאת {post.authorName}
          </div>
        </div>
      </div>

      {/* preview of body */}
      <div style={{
        fontSize: 14, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.5,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {post.body}
      </div>

      {/* stats row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, marginTop: 10,
        fontSize: 13, color: 'var(--ink-3)', fontWeight: 600,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          👁 {post.views || 0} צפיות
        </span>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 4,
          color: iLiked ? accent : 'var(--ink-3)',
        }}>
          <IconHeart size={15} color={iLiked ? accent : '#8389A4'} />
          {likeCount}
        </span>
        <span style={{ marginInlineStart: 'auto', color: accent, fontWeight: 700 }}>
          קרא עוד ←
        </span>
      </div>
    </button>
  )
}

// ── Compose modal ───────────────────────────────────────────
function ComposeModal({ cfg, onClose, onSubmit }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('home')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const canSubmit = title.trim().length > 0 && body.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit || saving) return
    setSaving(true)
    try {
      await onSubmit({ title, body, category })
    } catch (e) {
      console.error(e)
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(20,23,42,0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-app)',
        borderRadius: '24px 24px 0 0',
        padding: '22px 20px calc(22px + env(safe-area-inset-bottom))',
        width: '100%', maxWidth: 430,
        maxHeight: '88vh', overflowY: 'auto',
        direction: 'rtl',
      }}>
        <div style={{
          width: 40, height: 4, borderRadius: 2, background: 'var(--line-strong)',
          margin: '0 auto 18px',
        }}/>

        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 4 }}>
          {cfg.composeTitle}
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 18 }}>
          {cfg.composeSub}
        </div>

        {/* Title */}
        <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
          כותרת
        </label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={cfg.titlePlaceholder}
          style={{
            width: '100%', fontSize: 17, fontFamily: 'inherit',
            padding: '13px 14px', borderRadius: 14,
            border: '1px solid var(--line-strong)',
            background: 'var(--surface)', color: 'var(--ink)',
            marginBottom: 16, direction: 'rtl',
          }}
        />

        {/* קטגוריה */}
        <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
          נושא
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {TIP_CATEGORIES.filter(c => c.id !== 'other').map(c => {
            const sel = category === c.id
            return (
              <button key={c.id} type="button" onClick={() => setCategory(c.id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14.5, fontWeight: 700,
                border: `1.5px solid ${sel ? cfg.accent : 'var(--line-strong)'}`,
                background: sel ? cfg.accent : 'var(--surface)',
                color: sel ? '#fff' : 'var(--ink)',
              }}>
                <span>{c.emoji}</span><span>{c.name}</span>
              </button>
            )
          })}
        </div>

        {/* Body */}
        <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
          {cfg.bodyLabel}
        </label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={7}
          placeholder={cfg.bodyPlaceholder}
          style={{
            width: '100%', fontSize: 16, fontFamily: 'inherit',
            padding: '13px 14px', borderRadius: 14,
            border: '1px solid var(--line-strong)',
            background: 'var(--surface)', color: 'var(--ink)',
            marginBottom: 20, direction: 'rtl', resize: 'vertical',
            lineHeight: 1.5,
          }}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="big-btn big-btn--ghost" style={{ flex: 1 }}>
            ביטול
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="big-btn"
            style={{
              flex: 2,
              background: canSubmit ? `linear-gradient(135deg, ${cfg.accent}, ${cfg.accentDeep})` : 'var(--line-strong)',
              color: 'white',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'מפרסם...' : 'פרסם'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Post detail modal ───────────────────────────────────────
function PostDetailModal({ post, accent, myUid, onClose }) {
  const [likes, setLikes] = useState(post.likes || [])
  const iLiked = myUid && likes.includes(myUid)

  const handleLike = async () => {
    if (!myUid) return
    setLikes(prev => prev.includes(myUid)
      ? prev.filter(u => u !== myUid)
      : [...prev, myUid])
    await togglePostLike(post.id, myUid)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1001,
      background: 'rgba(20,23,42,0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-app)',
        borderRadius: '24px 24px 0 0',
        padding: '22px 20px calc(22px + env(safe-area-inset-bottom))',
        width: '100%', maxWidth: 430,
        maxHeight: '88vh', overflowY: 'auto',
        direction: 'rtl',
      }}>
        <div style={{
          width: 40, height: 4, borderRadius: 2, background: 'var(--line-strong)',
          margin: '0 auto 18px',
        }}/>

        {/* Author */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Avatar name={post.authorName} size={52} />
          <div>
            <div className="h-display" style={{ fontSize: 16, color: 'var(--ink)' }}>
              {post.authorName}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>
              👁 {post.views || 0} צפיות
            </div>
          </div>
        </div>

        {/* Title */}
        {post.category && (
          <span style={{
            display: 'inline-block', fontSize: 12, fontWeight: 800, color: accent,
            background: 'rgba(184,144,72,.14)', padding: '4px 12px', borderRadius: 999, marginBottom: 10,
          }}>{tipCategoryOf(post.category).name}</span>
        )}
        <div className="h-display" style={{
          fontSize: 24, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 14,
        }}>
          {post.title}
        </div>

        {/* Body */}
        <div style={{
          fontSize: 17, color: 'var(--ink-2)', lineHeight: 1.7,
          whiteSpace: 'pre-wrap', marginBottom: 24,
        }}>
          {post.body}
        </div>

        {/* Like + close */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleLike}
            className="big-btn"
            style={{
              flex: 1,
              background: iLiked ? accent : 'var(--surface)',
              color: iLiked ? 'white' : 'var(--ink)',
              border: iLiked ? 'none' : '1px solid var(--line-strong)',
            }}
          >
            <IconHeart size={20} color={iLiked ? 'white' : accent} />
            אהבתי · {likes.length}
          </button>
          <button onClick={onClose} className="big-btn big-btn--ghost" style={{ flex: 1 }}>
            סגור
          </button>
        </div>
      </div>
    </div>
  )
}
