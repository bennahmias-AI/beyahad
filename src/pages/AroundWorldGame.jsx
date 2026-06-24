/*
  AroundWorldGame.jsx
  Vintage Israeli "Around the World" board game - playable screen (vs computer, local).
  Landscape-only layout: side panel (you + dice) | board center | side panel (others).
  Multiplayer (Firebase) lives in AroundWorldOnline; this file holds the
  local engine + UI so the game is fully playable against bots.

  Props: onBack, onHome, profile (current user doc, optional)
*/

import { useEffect, useRef, useState } from 'react';
import AroundWorldBoard from './AroundWorldBoard.jsx';
import { TILES, TILE_COUNT, RULES, TOKEN_COLORS, GROUPS, MAX_LEVEL, LEVEL_NAMES, rentFor, buildCost, nextBuildLabel, randomPriceIndex, applyIndex, sellValue, regionOf, REGION_LABELS } from '../data/aroundWorldBoard';
import { flagSVG } from '../data/aroundWorldFlags';
import { PropertyCard, CardsModal, CardFooter, DebtSellModal } from './AroundWorldCards.jsx';
import { cardBack } from '../data/aroundWorldBoardArt';
import { playSound, isMuted, setMuted } from '../utils/gameSounds';
import { IconBackRTL } from '../icons/index.jsx';
import HomeButton from '../components/HomeButton.jsx';
import { GameIcon } from '../icons/gameIcons.jsx';
import LeaveConfirmModal from '../components/LeaveConfirmModal.jsx';
import AroundWorldOnline from './AroundWorldOnline.jsx';
import Avatar from '../components/Avatar.jsx';
import { MUSIC_TRACKS } from '../utils/gameSounds.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const INK = '#1c1c1c';
const CREAM = '#f6efdf';

// ---- card decks -----------------------------------------------------------
const LOTTO_CARDS = [
  { text: 'זכית בפרס הראשון בלוטו!', amount: +200 },
  { text: 'זכית בפרס השני בלוטו!', amount: +100 },
  { text: 'ניחשת חמישה מספרים - יפה מאוד!', amount: +80 },
  { text: 'מספר אחד היה חסר לזכייה הגדולה...', amount: +50 },
  { text: 'הכרטיס לא זכה הפעם. קנית עוד אחד.', amount: -20 },
  { text: 'מילאת טופס כפול בטעות.', amount: -40 },
  { text: 'זכית בפרס ניחומים.', amount: +30 },
  { text: 'זכייה גדולה במפעל הפיס!', amount: +500 },
  { text: 'הג׳קפוט! זכית בפרס הענק!', amount: +1000 },
  { text: 'חבר מילא עליך כרטיס - והוא זכה!', amount: +120 },
];

const CHANCE_CARDS = [
  { text: 'מצאת ארנק ברחוב והחזרת אותו. קיבלת פרס.', amount: +100 },
  { text: 'קיבלת החזר מס מהמדינה.', amount: +150 },
  { text: 'דוח חניה... משלמים.', amount: -50 },
  { text: 'הרכב נכנס למוסך לתיקון.', amount: -100 },
  { text: 'יום הולדת לנכד - קנית מתנה.', amount: -60 },
  { text: 'מכרת מזכרות מהטיול ברווח.', amount: +80 },
  { text: 'נסיעה ישר להתחלה! קבל 200.', goto: 0, amount: +200 },
  { text: 'שכחת את הדרכון - חוזרים 3 צעדים.', back: 3 },
  { text: 'קח כרטיס פיס חינם!', freeLotto: true },
  { text: 'טסת לישראל!', goto: 11, land: true },
  { text: 'טסת לארה"ב!', goto: 7, land: true },
  { text: 'טסת לפולין!', goto: 32, land: true },
  { text: 'טסת ליוון!', goto: 37, land: true },
  { text: 'טסת לגאנה!', goto: 21, land: true },
];

// ---- helpers ----------------------------------------------------------------
function netWorth(p, owners) {
  let v = p.cash;
  for (const t of TILES) if (t.type === 'prop' && owners[t.id] === p.uid) v += t.price;
  return v;
}

function focusWindow(pos) {
  const ids = [];
  for (let d = -1; d <= 2; d++) ids.push(((pos + d) % TILE_COUNT + TILE_COUNT) % TILE_COUNT);
  return ids;
}

// סדר אקראי לחפיסה (הפתעה / מפעל הפיס) — כל קלף יוצא פעם אחת לפני שחוזר
function shuffledOrder(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ── איקוני קו מקוריים (לא אימוג'י) — לבן על הזכוכית הכהה ──
const Ic = ({ size = 20, color = '#fff', children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>{children}</svg>
);
const IcDice = (p) => <Ic {...p}><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1.4" fill={p.color || '#fff'} stroke="none" /><circle cx="16" cy="8" r="1.4" fill={p.color || '#fff'} stroke="none" /><circle cx="12" cy="12" r="1.4" fill={p.color || '#fff'} stroke="none" /><circle cx="8" cy="16" r="1.4" fill={p.color || '#fff'} stroke="none" /><circle cx="16" cy="16" r="1.4" fill={p.color || '#fff'} stroke="none" /></Ic>;
const IcCamera = (p) => <Ic {...p}><rect x="2" y="6" width="14" height="12" rx="3" /><path d="M16 10l6-3.5v11L16 14z" /></Ic>;
const IcMap = (p) => <Ic {...p}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></Ic>;
const IcSound = (p) => <Ic {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={p.color || '#fff'} stroke="none" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></Ic>;
const IcSoundOff = (p) => <Ic {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={p.color || '#fff'} stroke="none" /><path d="M22 9l-6 6M16 9l6 6" /></Ic>;
const IcMusic = (p) => <Ic {...p}><path d="M9 17V5l10-2v12" /><circle cx="6" cy="17" r="3" /><circle cx="16" cy="15" r="3" /></Ic>;
const IcMusicOff = (p) => <Ic {...p}><path d="M9 17V5l10-2v6" /><circle cx="6" cy="17" r="3" /><path d="M3 3l18 18" /></Ic>;
const IcNext = (p) => <Ic {...p}><path d="M5 4l10 8-10 8z" fill={p.color || '#fff'} stroke="none" /><rect x="16" y="4" width="2.6" height="16" rx="1" fill={p.color || '#fff'} stroke="none" /></Ic>;
const IcZoom = (p) => <Ic {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M11 8v6M8 11h6" /></Ic>;
const IcChat = (p) => <Ic {...p}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.7L3 21l1.8-5.4A8.4 8.4 0 0 1 4 11.5a8.5 8.5 0 0 1 17 0Z" /></Ic>;
const IcTrophy = (p) => <Ic {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 5H5.5a2 2 0 0 0 0 4H8M16 5h2.5a2 2 0 0 1 0 4H16" /><path d="M10 13.5V17h4v-3.5M8.5 20h7M10 17h4" /></Ic>;
const awMenuItem = { display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', padding: '8px 12px', textAlign: 'right', borderRadius: 8 };
const awVolBtn = { width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.12)', color: '#fff', fontSize: 18, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 };

// כפתור מוזיקה עם תפריט: כיבוי/הפעלה + שיר הבא + עוצמה (−/+)
function AwMusicButton({ musicOn, onToggle, onNext, onVolDown, onVolUp }) {
  const [open, setOpen] = useState(false);
  // התפריט נסגר לבד אחרי 3 שניות
  useEffect(() => { if (!open) return; const t = setTimeout(() => setOpen(false), 3000); return () => clearTimeout(t); }, [open]);
  return (
    <div style={{ position: 'relative', display: 'flex' }}>
      <button onClick={() => setOpen(o => !o)} title="מוזיקה" aria-label="מוזיקה"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: musicOn ? 1 : 0.5, display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>
        <IcMusic size={21} />
      </button>
      {open && (
        <>
          {/* שכבה שקופה — לחיצה בכל מקום אחר סוגרת את תפריט המוזיקה */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
          <div style={{ position: 'absolute', bottom: '130%', insetInlineEnd: 0, transform: 'translateX(-18px)', background: 'rgba(20,33,48,.96)', border: '1px solid rgba(255,255,255,.25)', borderRadius: 12, padding: 6, display: 'flex', flexDirection: 'column', gap: 4, whiteSpace: 'nowrap', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
            <button onClick={onToggle} style={awMenuItem}>
              {musicOn ? <IcMusicOff size={16} /> : <IcMusic size={16} />} {musicOn ? 'כיבוי מוזיקה' : 'הפעלת מוזיקה'}
            </button>
            <button onClick={onNext} style={awMenuItem}>
              <IcNext size={16} /> שיר הבא
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 8px' }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>עוצמה</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={onVolDown} aria-label="החלש" style={awVolBtn}>−</button>
                <button onClick={onVolUp} aria-label="הגבר" style={awVolBtn}>+</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// מוזיקת רקע — נגן מקומי לכל מכשיר (זהה למצב האונליין). 8 רצועות; מתחלפות אקראית.
function awBgStyle() {
  const h = new Date().getHours();
  const img = (h >= 6 && h < 18) ? 'aroundworld-morning%20bg.jpg' : 'aroundworld-evening%20bg.jpg';
  return `url(/${img}) center/cover no-repeat #14405f`;
}

const MUSIC_VOLUME = 0.10;

const BOT_NAMES = ['דניאל התותח', 'רינת המתוקה', 'רומי היפה'];

// שורת הכסף עם אנימציה: כשהסכום משתנה — צצה בועה +X (ירוק) / −X (אדום)
// למעלה, המספר נצבע לרגע, ורק אז מתעדכן הסכום בקופה.
function CashLine({ cash, fontSize = 17 }) {
  const [shown, setShown] = useState(cash);
  const [delta, setDelta] = useState(null);
  const prevRef = useRef(cash);
  useEffect(() => {
    const prev = prevRef.current;
    if (cash === prev) return;
    const d = cash - prev;
    prevRef.current = cash;
    setDelta({ amount: d, id: Date.now() });
    const t1 = setTimeout(() => setShown(cash), 850);
    const t2 = setTimeout(() => setDelta(null), 1300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [cash]);
  const up = delta ? delta.amount > 0 : false;
  const flash = delta ? (up ? '#1c9e3f' : '#d8402a') : null;
  const base = shown < 200 ? '#a32d2d' : '#1c4e26';
  return (
    <div style={{ position: 'relative', fontWeight: 800, fontSize, color: flash || base, transition: 'color .2s' }}>
      {shown.toLocaleString()} ₪
      {delta && (
        <span style={{ position: 'absolute', left: '50%', bottom: '100%', transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 5 }}>
          <span style={{ display: 'inline-block', whiteSpace: 'nowrap', fontWeight: 900, fontSize: fontSize - 2, color: up ? '#1c9e3f' : '#d8402a', textShadow: '0 1px 3px rgba(0,0,0,.25)', animation: 'awCashPop 1.3s ease forwards' }}>
            {up ? '+' : '−'}{Math.abs(delta.amount).toLocaleString()} ₪
          </span>
        </span>
      )}
    </div>
  );
}

// ── קובייה בודדת (פאה עם נקודות) + אנימציית זריקת קוביות על הלוח ──
function DiceFace({ value, size = 46 }) {
  const layouts = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const on = new Set(layouts[value] || []);
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.2, background: 'linear-gradient(145deg,#fff,#efe7d6)', border: `2px solid ${INK}`, boxShadow: '0 8px 18px rgba(0,0,0,.4), inset 0 -3px 6px rgba(0,0,0,.12)', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,1fr)', padding: size * 0.12, boxSizing: 'border-box' }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {on.has(i) && <span style={{ width: size * 0.17, height: size * 0.17, borderRadius: '50%', background: INK }} />}
        </span>
      ))}
    </div>
  );
}

function DiceToss({ d1, d2 }) {
  const [stage, setStage] = useState('tumble');
  const [faces, setFaces] = useState([d1, d2]);
  // נקודת נחיתה אקראית על הטבעת הכחולה (סביב הגלובוס, מחוץ למרכז ולפני האריחים) — מחושבת פעם אחת לכל הטלה
  const boxRef = useRef(null);
  const [board, setBoard] = useState(0);
  // זרע אקראי לנחיתה (זווית + מרחק כאחוז מגודל הלוח) פעם אחת לכל הטלה
  const seedRef = useRef(null);
  if (!seedRef.current) {
    seedRef.current = { ang: Math.random() * Math.PI * 2, rf: 0.30 + Math.random() * 0.04 };
  }
  useEffect(() => {
    const el = boxRef.current;
    setBoard(el ? Math.min(el.clientWidth, el.clientHeight) : 360);
  }, []);
  useEffect(() => {
    const start = Date.now();
    const TUMBLE = 650;
    let timer;
    const tick = () => {
      if (Date.now() - start < TUMBLE) {
        setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
        timer = setTimeout(tick, 75);
      } else {
        setFaces([d1, d2]);
        setStage('settle');
      }
    };
    tick();
    return () => clearTimeout(timer);
    // eslint-disable-next-line
  }, []);
  const B = board || 360;
  const size = Math.max(20, Math.round(B * 0.072));
  const r = B * seedRef.current.rf;
  const x = Math.round(Math.cos(seedRef.current.ang) * r);
  const y = Math.round(Math.sin(seedRef.current.ang) * r);
  return (
    <div ref={boxRef} style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ display: 'flex', gap: Math.round(size * 0.18), transform: `translate(${x}px, ${y}px)` }}>
        <div style={{ animation: stage === 'tumble' ? 'awDiceDrop1 .65s cubic-bezier(.4,.05,.55,1) forwards' : 'awDiceLand .3s ease-out forwards' }}><DiceFace value={faces[0]} size={size} /></div>
        <div style={{ animation: stage === 'tumble' ? 'awDiceDrop2 .65s cubic-bezier(.4,.05,.55,1) forwards' : 'awDiceLand .3s ease-out forwards' }}><DiceFace value={faces[1]} size={size} /></div>
      </div>
    </div>
  );
}

// ============================================================================
export default function AroundWorldGame({ onBack, onHome, profile, initialRoomId = null, autoInviteFriend = null }) {
  // ---- orientation ----
  // שתי שכבות לסיבוב אוטומטי:
  //  1. PWA מותקן / Android Chrome — מנסים screen.orientation.lock('landscape')
  //     (סיבוב פיזי אמיתי; לא נתמך ב-iOS Safari — נופל בשקט)
  //  2. כל השאר (דפדפן רגיל, iOS) — מסובבים את התצוגה 90° ב-CSS
  //     כך שהלוח נראה לרוחב גם כשהמכשיר מוחזק אנכית (בלי הודעה)
  const [isPortrait, setIsPortrait] = useState(
    () => window.matchMedia('(orientation: portrait)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const fn = (e) => setIsPortrait(e.matches);
    mq.addEventListener('change', fn);
    // ניסיון לנעול לרוחב (PWA / Android) — עוטף ב-try כי זורק בדפדפנים שלא תומכים
    try {
      const so = window.screen && window.screen.orientation;
      if (so && so.lock) {
        const p = so.lock('landscape');
        if (p && p.catch) p.catch(() => { /* iOS/unsupported - CSS fallback handles it */ });
      }
    } catch { /* unsupported - CSS rotation fallback handles it */ }
    return () => {
      mq.removeEventListener('change', fn);
      // ביציאה — מחזירים את שאר האפליקציה לאנכי (portrait)
      try {
        const so = window.screen && window.screen.orientation;
        if (so && so.lock) {
          const p = so.lock('portrait');
          if (p && p.catch) p.catch(() => { try { so.unlock && so.unlock(); } catch { /* ignore */ } });
        } else if (so && so.unlock) {
          so.unlock();
        }
      } catch { /* ignore */ }
    };
  }, []);

  // ---- game state ----
  const [phase, setPhase] = useState('setup'); // setup | idle | walking | card | gameover
  const [players, setPlayers] = useState([]);
  const [owners, setOwners] = useState({});
  const [hotels, setHotels] = useState({});
  const [turnIdx, setTurnIdx] = useState(0);
  const [round, setRound] = useState(1);
  const [dice, setDice] = useState([null, null]);
  const [focusTiles, setFocusTiles] = useState(null);
  const [card, setCard] = useState(null); // { kind, tile?, text?, amount?, ... }
  const [message, setMessage] = useState('');
  const [winner, setWinner] = useState(null);
  const [setupStep, setSetupStep] = useState('mode'); // mode | bots
  const [viewPlayer, setViewPlayer] = useState(null); // player whose assets are shown
  const [cameraMode, setCameraMode] = useState(() => {
    try { return localStorage.getItem('beyahad_aroundworld_camera') || 'zoom'; } catch { return 'zoom'; }
  }); // zoom = camera follows the token | full = whole board, token just moves
  const [priceIndex, setPriceIndex] = useState(null); // per-region % - reshuffled every round
  const [muted, setMutedState] = useState(() => isMuted());
  // online routing: null = local/setup ; 'online-random' | 'online-friend' = אונליין
  const [onlineMode, setOnlineMode] = useState(null);
  const [onlineNum, setOnlineNum] = useState(4);
  // אישור יציאה + הצצה (משחק מקומי נגד המחשב)
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [peek, setPeek] = useState(false);
  const [diceToss, setDiceToss] = useState(null);   // אנימציית זריקת קוביות על הלוח
  const [debtor, setDebtor] = useState(null);   // שחקן שנכנס למינוס וחייב למכור ({uid, deadline}) או null
  const debtRef = useRef(null);   // { uid, timer, resolve } — לסיום ההמתנה כשהשחקן מתאזן

  // ---- מוזיקת רקע ----
  const [musicOn, setMusicOn] = useState(() => {
    try { return localStorage.getItem('beyahad_aroundworld_music') !== 'off'; } catch { return true; }
  });
  const [trackIdx, setTrackIdx] = useState(() => Math.floor(Math.random() * MUSIC_TRACKS.length));
  const audioRef = useRef(null);
  const [musicVol, setMusicVol] = useState(MUSIC_VOLUME);
  const nextRandomTrack = () => setTrackIdx((i) => {
    if (MUSIC_TRACKS.length <= 1) return i;
    let n = i; while (n === i) n = Math.floor(Math.random() * MUSIC_TRACKS.length);
    return n;
  });
  const toggleMusic = () => setMusicOn((on) => {
    const next = !on;
    try { localStorage.setItem('beyahad_aroundworld_music', next ? 'on' : 'off'); } catch {}
    return next;
  });
  const musicVolDown = () => setMusicVol((v) => Math.max(0.02, +(v - 0.03).toFixed(2)));
  const musicVolUp = () => { setMusicVol((v) => Math.min(0.6, +(v + 0.03).toFixed(2))); setMusicOn(true); try { localStorage.setItem('beyahad_aroundworld_music', 'on'); } catch {} };

  // refs mirror state for the async engine
  const S = useRef({});
  S.current = { phase, players, owners, hotels, turnIdx, round, cameraMode, priceIndex };

  // חפיסות קלפים מסתובבות (הפתעה / מפעל הפיס) — קלף שיצא הולך לתחתית, וחוזר רק אחרי שכל השאר יצאו
  const lottoDeckRef = useRef(null);
  const chanceDeckRef = useRef(null);
  function drawCard(ref, cards) {
    if (!ref.current || ref.current.length !== cards.length) ref.current = shuffledOrder(cards.length);
    const idx = ref.current[0];
    ref.current = [...ref.current.slice(1), idx];   // הקלף שיצא — לתחתית החפיסה
    return cards[idx];
  }

  const myName = profile?.name || 'אני';

  // ---- setup ----
  function startGame(botCount) {
    const ps = [
      { uid: 'me', name: myName, isBot: false, color: TOKEN_COLORS[0].color, cash: RULES.START_CASH, pos: 0, skip: 0, dead: false },
    ];
    for (let i = 0; i < botCount; i++) {
      ps.push({ uid: 'bot' + i, name: BOT_NAMES[i], isBot: true, color: TOKEN_COLORS[i + 1].color, cash: RULES.START_CASH, pos: 0, skip: 0, dead: false });
    }
    setPlayers(ps);
    setOwners({}); setHotels({}); setTurnIdx(0); setRound(1);
    setPriceIndex(randomPriceIndex());
    setWinner(null); setCard(null); setFocusTiles(null);
    setMessage('התור של ' + ps[0].name + ' - הטל קוביות!');
    setPhase('idle');
  }

  // ---- engine: turn flow ----
  const updatePlayer = (uid, patch) =>
    setPlayers((ps) => ps.map((p) => (p.uid === uid ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p)));

  // camera helper: in 'full' mode we never zoom - the board stays whole and
  // only the token animates between tiles
  const focus = (ids) => setFocusTiles(S.current.cameraMode === 'zoom' ? ids : null);

  // ── מינוס/חוב: מכירת מדינות לקופה כדי לא להיפסל ──
  const ownedTilesOf = (uid) => TILES.filter((t) => t.type === 'prop' && S.current.owners[t.id] === uid);

  // מוכר מדינות חזרה לקופה: החזר = מחיר + מלונות; הכסף לשחקן, המדינה משוחררת
  function sellProperties(uid, tileIds) {
    if (!tileIds || !tileIds.length) return;
    let refund = 0;
    for (const id of tileIds) refund += sellValue(TILES[id], S.current.hotels[id] || 0);
    updatePlayer(uid, (p) => ({ cash: p.cash + refund }));
    setOwners((o) => { const c = { ...o }; for (const id of tileIds) delete c[id]; return c; });
    setHotels((h) => { const c = { ...h }; for (const id of tileIds) delete c[id]; return c; });
    playSound('win');
    // יתרה חזויה אחרי המכירה (ה-state עוד לא התעדכן סינכרונית)
    const p = S.current.players.find((x) => x.uid === uid);
    const newCash = (p ? p.cash : 0) + refund;
    const remaining = ownedTilesOf(uid).filter((t) => !tileIds.includes(t.id)).length;
    if (debtRef.current && debtRef.current.uid === uid && (newCash >= 0 || remaining === 0)) {
      clearTimeout(debtRef.current.timer);
      const r = debtRef.current.resolve; debtRef.current = null; r(newCash >= 0 ? 'paid' : 'broke');
    }
  }

  // המתנה שהשחקן האנושי ימכור עד יציאה מהמינוס, או עד תום הזמן (20 שניות)
  function humanSettle(uid, deadline) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (debtRef.current && debtRef.current.uid === uid) { debtRef.current = null; resolve('timeout'); }
      }, Math.max(0, deadline - Date.now()));
      debtRef.current = { uid, timer, resolve };
    });
  }

  // בוט: מוכר אוטומטית את היקרות ביותר עד שמתאזן (או עד שנגמרו המדינות)
  async function botSettle(uid) {
    await sleep(900);
    for (let guard = 0; guard < 40; guard++) {
      const p = S.current.players.find((x) => x.uid === uid);
      if (!p || p.cash >= 0) break;
      const owned = ownedTilesOf(uid);
      if (!owned.length) break;
      owned.sort((a, b) => sellValue(b, S.current.hotels[b.id] || 0) - sellValue(a, S.current.hotels[a.id] || 0));
      const tile = owned[0];
      const refund = sellValue(tile, S.current.hotels[tile.id] || 0);
      updatePlayer(uid, (pp) => ({ cash: pp.cash + refund }));
      setOwners((o) => { const c = { ...o }; delete c[tile.id]; return c; });
      setHotels((h) => { const c = { ...h }; delete c[tile.id]; return c; });
      setMessage(p.name + ' מכר את ' + tile.name + ' תמורת ' + refund + ' ₪');
      playSound('step');
      await sleep(850);
    }
  }

  // מצב מינוס: כל שחקן שבמינוס אך מחזיק מדינות מקבל הזדמנות למכור לפני פסילה
  async function settleDebts() {
    const attempted = new Set();
    for (let guard = 0; guard < 8; guard++) {
      const ps = S.current.players;
      const d = ps.find((p) => !p.dead && p.cash < 0 && !attempted.has(p.uid) && ownedTilesOf(p.uid).length > 0);
      if (!d) break;
      attempted.add(d.uid);
      const deadline = Date.now() + 20000;
      setFocusTiles(null);
      setMessage(d.name + ' נכנס למינוס! חייב למכור מדינה כדי להישאר במשחק');
      setDebtor({ uid: d.uid, deadline });
      if (d.isBot) await botSettle(d.uid);
      else await humanSettle(d.uid, deadline);
      setDebtor(null);
      await sleep(250);
    }
  }

  async function rollAndWalk() {
    const { players: ps, turnIdx: ti } = S.current;
    const p = ps[ti];
    if (!p || S.current.phase !== 'idle') return;

    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    setDice([d1, d2]);
    setDiceToss({ d1, d2, id: Date.now() });   // זריקת קוביות מונפשת על הלוח
    playSound('dice');
    setPhase('walking');
    setMessage(p.name + ' הטיל ' + (d1 + d2) + ' - צועדים!');
    // הקוביות נזרקות תמיד למרכז הלוח שומרים מצלמה על לוח מלא בזמן הזריקה (גם במצב עוקבת)
    setFocusTiles(null);
    await sleep(780);
    // רק אחרי שהקוביות נחתו נכנסת המצלמה העוקבת ועוקבת אחרי החייל
    focus(focusWindow(p.pos));
    await sleep(S.current.cameraMode === 'zoom' ? 620 : 150);

    await walkSteps(p.uid, d1 + d2);
    await sleep(350);
    await landOn(p.uid);
  }

  async function walkSteps(uid, steps) {
    // track position locally - React state updaters are async, so reading
    // a variable set inside them (the old bug) made the camera jump to tile 0
    let pos = S.current.players.find((x) => x.uid === uid).pos;
    for (let i = 0; i < steps; i++) {
      pos = (pos + 1) % TILE_COUNT;
      const bonus = pos === 0 ? RULES.PASS_START_BONUS : 0;
      const newPos = pos;
      updatePlayer(uid, (p) => ({ pos: newPos, cash: p.cash + bonus }));
      playSound('step');
      focus(focusWindow(newPos));
      await sleep(480);
    }
  }

  async function walkBack(uid, steps) {
    let pos = S.current.players.find((x) => x.uid === uid).pos;
    for (let i = 0; i < steps; i++) {
      pos = (pos - 1 + TILE_COUNT) % TILE_COUNT;
      const newPos = pos;
      updatePlayer(uid, { pos: newPos });
      playSound('step');
      focus(focusWindow(newPos));
      await sleep(480);
    }
  }

  async function landOn(uid) {
    await sleep(100);
    const ps = S.current.players;
    const p = ps.find((x) => x.uid === uid);
    const tile = TILES[p.pos];
    focus(focusWindow(p.pos));

    if (tile.type === 'prop') {
      const owner = S.current.owners[tile.id];
      if (!owner) {
        setCard({ kind: 'buy', tile, uid, price: applyIndex(tile.price, S.current.priceIndex, tile) });
      } else if (owner === uid) {
        const level = S.current.hotels[tile.id] || 0;
        if (level < MAX_LEVEL) {
          setCard({ kind: 'hotel', tile, uid, level });
        } else {
          setCard({ kind: 'info', tile, uid, text: 'עיר הבירה כבר בנויה כאן - המדינה בשיאה!' });
        }
      } else {
        const rent = applyIndex(rentFor(tile, S.current.owners, S.current.hotels), S.current.priceIndex, tile);
        setCard({ kind: 'rent', tile, uid, owner, amount: rent, level: S.current.hotels[tile.id] || 0 });
        playSound('badStep');
      }
    } else if (tile.type === 'special') {
      if (tile.amount === 'birthday') {
        setCard({ kind: 'birthday', tile, uid });
      } else {
        setCard({ kind: 'pay', tile, uid, amount: tile.amount });
        if (tile.amount < 0) playSound('badStep');
      }
    } else if (tile.type === 'lotto') {
      const c = drawCard(lottoDeckRef, LOTTO_CARDS);
      setCard({ kind: 'lotto', tile, uid, ...c });
    } else if (tile.type === 'chance') {
      let c = drawCard(chanceDeckRef, CHANCE_CARDS);
      // "קח כרטיס פיס חינם" — מגריל תוצאת לוטו אמיתית (כמו כרטיס שנמשך)
      if (c.freeLotto) {
        const l = drawCard(lottoDeckRef, LOTTO_CARDS);
        c = { text: 'כרטיס פיס חינם! ' + l.text, amount: l.amount };
      }
      setCard({ kind: 'chance', tile, uid, ...c });
    } else {
      // corner
      if (tile.key === 'einKnisa') { setCard({ kind: 'pay', tile, uid, amount: -RULES.EIN_KNISA_FINE }); playSound('badStep'); }
      else if (tile.key === 'atzor') { setCard({ kind: 'atzor', tile, uid }); playSound('badStep'); }
      else if (tile.key === 'odPaam') setCard({ kind: 'odPaam', tile, uid });
      else setCard({ kind: 'info', tile, uid, text: 'נחת על ההתחלה!' });
    }
    setPhase('card');
  }

  // ---- card resolution ----
  async function resolveCard(action) {
    const c = card;
    if (!c) return;
    const uid = c.uid;
    let extraTurn = false;

    if (c.kind === 'buy' && action === 'yes') {
      const pay = c.price ?? c.tile.price;
      updatePlayer(uid, (p) => ({ cash: p.cash - pay }));
      setOwners((o) => ({ ...o, [c.tile.id]: uid }));
    }
    if (c.kind === 'hotel' && action === 'yes') {
      const cost = buildCost(c.tile, c.level);
      const actor = S.current.players.find((x) => x.uid === uid);
      if (actor && actor.cash >= cost) {
        updatePlayer(uid, (p) => ({ cash: p.cash - cost }));
        setHotels((h) => ({ ...h, [c.tile.id]: (h[c.tile.id] || 0) + 1 }));
      }
    }
    if (c.kind === 'rent') {
      updatePlayer(uid, (p) => ({ cash: p.cash - c.amount }));
      updatePlayer(c.owner, (p) => ({ cash: p.cash + c.amount }));
    }
    if (c.kind === 'pay') {
      updatePlayer(uid, (p) => ({ cash: p.cash + c.amount }));
    }
    if (c.kind === 'birthday') {
      playSound('win');
      setPlayers((ps) => {
        const others = ps.filter((p) => p.uid !== uid && !p.dead);
        return ps.map((p) => {
          if (p.uid === uid) return { ...p, cash: p.cash + RULES.BIRTHDAY_GIFT * others.length };
          if (!p.dead) return { ...p, cash: p.cash - RULES.BIRTHDAY_GIFT };
          return p;
        });
      });
    }
    if (c.kind === 'lotto' || c.kind === 'chance') {
      if (typeof c.amount === 'number') {
        updatePlayer(uid, (p) => ({ cash: p.cash + c.amount }));
        if (c.amount > 0) playSound('win');
      }
    }
    if (c.kind === 'atzor') {
      updatePlayer(uid, { skip: RULES.ATZOR_SKIP_TURNS });
    }
    if (c.kind === 'odPaam') {
      extraTurn = true;
    }

    setCard(null);

    // chance movement effects
    if (c.kind === 'chance' && typeof c.goto === 'number') {
      setPhase('walking');
      const p = S.current.players.find((x) => x.uid === uid);
      const steps = (c.goto - p.pos + TILE_COUNT) % TILE_COUNT;
      if (steps > 0) {
        // עוברים דרך ההתחלה בכיוון השעון → בונוס מעבר 200 ש"ח (כמו בהקפה רגילה)
        const passBonus = (c.goto !== 0 && c.goto < p.pos) ? RULES.PASS_START_BONUS : 0;
        updatePlayer(uid, (pp) => ({ pos: c.goto, cash: pp.cash + passBonus }));
        focus(focusWindow(c.goto));
        await sleep(900);
      }
      if (c.land) { await landOn(uid); return; }
    }
    if (c.kind === 'chance' && c.back) {
      setPhase('walking');
      await walkBack(uid, c.back);
      await sleep(300);
      await landOn(uid);
      return;
    }

    await sleep(250);
    await endTurn(uid, extraTurn);
  }

  async function endTurn(uid, extraTurn) {
    // לפני פסילה — מי שבמינוס אך מחזיק מדינות מקבל הזדמנות למכור ולהישאר
    await settleDebts();
    // bankruptcy check
    let alive = [];
    setPlayers((ps) => {
      const next = ps.map((p) => {
        if (!p.dead && p.cash < 0) {
          return { ...p, dead: true };
        }
        return p;
      });
      alive = next.filter((p) => !p.dead);
      return next;
    });
    await sleep(50);
    const psNow = S.current.players;
    const deadNow = psNow.filter((p) => p.cash < 0 && !p.dead).map((p) => p.uid);
    // free properties of newly-dead players
    setOwners((o) => {
      const c = { ...o };
      for (const t in c) {
        const p = psNow.find((x) => x.uid === c[t]);
        if (p && (p.dead || p.cash < 0)) delete c[t];
      }
      return c;
    });

    const living = psNow.filter((p) => !(p.dead || p.cash < 0));
    if (living.length === 1) {
      setWinner(living[0]);
      playSound('win');
      setPhase('gameover');
      return;
    }

    setFocusTiles(null);

    if (extraTurn) {
      const p = psNow.find((x) => x.uid === uid);
      if (p && !p.dead && p.cash >= 0) {
        setMessage('תור נוסף ל' + p.name + '!');
        setPhase('idle');
        return;
      }
    }

    // advance to next living player (skipping atzor turns)
    let ti = S.current.turnIdx;
    let r = S.current.round;
    for (let hops = 0; hops < psNow.length * 3; hops++) {
      ti = (ti + 1) % psNow.length;
      if (ti === 0) r += 1;
      const np = psNow[ti];
      if (np.dead || np.cash < 0) continue;
      if (np.skip > 0) {
        updatePlayer(np.uid, (p) => ({ skip: p.skip - 1 }));
        continue;
      }
      break;
    }

    if (r > RULES.MAX_ROUNDS) {
      const ranked = [...living].sort((a, b) => netWorth(b, S.current.owners) - netWorth(a, S.current.owners));
      setWinner(ranked[0]);
      playSound('win');
      setPhase('gameover');
      return;
    }

    if (r !== S.current.round) {
      setPriceIndex(randomPriceIndex()); // מדד המחירים מתחלף כל סיבוב
    }
    setTurnIdx(ti); setRound(r);
    setMessage('התור של ' + psNow[ti].name);
    setPhase('idle');
  }

  // ---- bot autoplay ----
  useEffect(() => {
    const p = players[turnIdx];
    if (!p || !p.isBot) return;
    if (phase === 'idle') {
      const t = setTimeout(() => rollAndWalk(), 1100);
      return () => clearTimeout(t);
    }
    if (phase === 'card' && card) {
      const t = setTimeout(() => {
        let action = 'ok';
        if (card.kind === 'buy') action = p.cash - (card.price ?? card.tile.price) >= 300 ? 'yes' : 'no';
        if (card.kind === 'hotel') action = p.cash - buildCost(card.tile, card.level) >= 200 ? 'yes' : 'no';
        resolveCard(action);
      }, 1400);
      return () => clearTimeout(t);
    }
  }, [phase, turnIdx, card, players]);

  // ---- מוזיקת רקע: הפעלה/עצירה + עקיפת חסימת autoplay ----
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = musicVol;
    if (musicOn) a.play().catch(() => {});
    else a.pause();
  }, [musicOn, trackIdx, musicVol]);
  useEffect(() => {
    if (!musicOn) return;
    const kick = () => { const a = audioRef.current; if (a && a.paused && musicOn) a.play().catch(() => {}); };
    window.addEventListener('pointerdown', kick);
    window.addEventListener('touchstart', kick);
    return () => { window.removeEventListener('pointerdown', kick); window.removeEventListener('touchstart', kick); };
  }, [musicOn]);

  // ---- derived ----
  const tokens = players.filter((p) => !p.dead).map((p) => ({ uid: p.uid, color: p.color, tileId: p.pos }));
  const tokenColors = Object.fromEntries(players.map((p) => [p.uid, p.color]));
  const active = players[turnIdx];
  const isMyTurn = active && !active.isBot && phase === 'idle';

  // כשמגיע התור שלי — יוצאים אוטומטית ממצב ההצצה (peek)
  useEffect(() => {
    if (isMyTurn && peek) setPeek(false);
  }, [isMyTurn]); // eslint-disable-line

  // גלגול אוטומטי — אם לא הטלת קוביות תוך 5 שניות, המשחק מטיל בשבילך
  useEffect(() => {
    if (!isMyTurn) return;
    const t = setTimeout(() => rollAndWalk(), 5000);
    return () => clearTimeout(t);
  }, [isMyTurn, turnIdx, phase]);

  // המשך אוטומטי על חלון הקלף — שלא יישאר תקוע אם השחקן לא לוחץ.
  // קלף חובה (יום הולדת / תשלום / שכירות וכו') ממשיך אחרי 6 שניות;
  // קלף החלטה (קנייה / בנייה) אחרי 12 שניות עם ברירת מחדל "לא עכשיו" (כדי לא לבזבז כסף).
  useEffect(() => {
    if (phase !== 'card' || !card) return;
    const p = players[turnIdx];
    if (!p || p.isBot) return;                 // בוטים מטופלים בנפרד
    if (card.kind === 'lotto' || card.kind === 'chance') return; // CardFlip מטפל בהם
    const discretionary = card.kind === 'buy' || card.kind === 'hotel';
    const t2 = setTimeout(() => resolveCard(discretionary ? 'no' : 'ok'), discretionary ? 12000 : 6000);
    return () => clearTimeout(t2);
  }, [phase, card, turnIdx, players]); // eslint-disable-line

  // ---- UI pieces ----
  const panelCard = (p, isActive) => (
    <div key={p.uid} onClick={() => setViewPlayer(p)} role="button" style={{
      background: '#fff', border: isActive ? '3px solid #2f9e3f' : '1px solid #d3d1c7',
      borderRadius: 14, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8,
      opacity: p.dead ? 0.4 : 1, cursor: 'pointer',
    }}>
      <Avatar name={p.name} size={36} photoURL={p.uid === 'me' ? (profile?.photoURL || null) : null} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, border: `2px solid ${INK}`, flex: 'none' }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {p.name}{p.skip > 0 ? ' (עוצר)' : ''}{p.dead ? ' - פרש' : ''}
          </span>
        </div>
        <CashLine cash={p.cash} />
      </div>
    </div>
  );

  // ============== RENDER ==============

  // אונליין — שחקן רנדומלי / שחק עם חברים / הזמנה נכנסת (מנותב ל-AroundWorldOnline)
  if (onlineMode || initialRoomId || autoInviteFriend) {
    return (
      <AroundWorldOnline
        mode={onlineMode || 'online-friend'}
        numPlayers={onlineNum}
        initialRoomId={initialRoomId}
        autoInviteFriend={autoInviteFriend}
        onBack={() => setOnlineMode(null)}
        onHome={onHome}
        onExit={onBack}
      />
    );
  }

  if (phase === 'setup') {
    return (
      <SetupScreen
        onBack={onBack}
        onHome={onHome}
        onStart={(botCount) => startGame(botCount)}
        onOnline={(mode, n) => { setOnlineNum(n); setOnlineMode(mode); }}
      />
    );
  }

  // כשהמכשיר אנכי והנעילה הפיזית לא עבדה (iOS / דפדפן) — מסובבים את
  // כל המשחק 90° ב-CSS: הקונטיינר מקבל רוחב=גובה-המסך והפוך,
  // מסתובב וממורכז — כך הלוח נראה לרוחב גם כשהטלפון אנכי.
  const rotateOuter = isPortrait
    ? { position: 'fixed', inset: 0, zIndex: 1000, overflow: 'hidden' }
    : null;
  const rotateInner = isPortrait
    ? {
        position: 'absolute', top: '50%', left: '50%',
        width: '100vh', height: '100vw',
        transform: 'translate(-50%,-50%) rotate(90deg)',
        transformOrigin: 'center center',
      }
    : null;

  const gameInner = (
    <div style={{ position: isPortrait ? 'absolute' : 'fixed', inset: 0, zIndex: 1000, background: awBgStyle(), direction: 'rtl', fontFamily: 'Heebo, sans-serif', overflow: 'hidden' }}>
      <style>{`@keyframes awCashPop{0%{opacity:0;transform:translateY(6px) scale(.7)}18%{opacity:1;transform:translateY(0) scale(1.12)}32%{transform:translateY(0) scale(1)}72%{opacity:1;transform:translateY(-10px)}100%{opacity:0;transform:translateY(-22px)}}@keyframes awDiceDrop1{0%{transform:translateY(-240px) scale(1.7) rotate(-120deg);opacity:0}18%{opacity:1}70%{transform:translateY(10px) scale(.95) rotate(10deg)}85%{transform:translateY(-3px) scale(1.02) rotate(2deg)}100%{transform:translateY(0) scale(1) rotate(0)}}@keyframes awDiceDrop2{0%{transform:translateY(-275px) scale(1.8) rotate(150deg);opacity:0}20%{opacity:1}72%{transform:translateY(9px) scale(.95) rotate(-8deg)}87%{transform:translateY(-3px) scale(1.02) rotate(-2deg)}100%{transform:translateY(0) scale(1) rotate(0)}}@keyframes awDiceLand{0%{transform:scale(1.06)}45%{transform:scale(.97)}100%{transform:scale(1)}}@keyframes awBDie1{0%{transform:translateY(var(--d,-200px)) scale(1.7) rotate(-120deg);opacity:0}18%{opacity:1}72%{transform:translateY(0) scale(.95) rotate(8deg)}88%{transform:translateY(0) scale(1.03) rotate(2deg)}100%{transform:translateY(0) scale(1) rotate(0)}}@keyframes awBDie2{0%{transform:translateY(var(--d,-230px)) scale(1.8) rotate(150deg);opacity:0}20%{opacity:1}74%{transform:translateY(0) scale(.95) rotate(-6deg)}88%{transform:translateY(0) scale(1.03) rotate(-2deg)}100%{transform:translateY(0) scale(1) rotate(0)}}@keyframes awBLand{0%{transform:scale(1.06)}45%{transform:scale(.96)}100%{transform:scale(1)}}`}</style>

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'row', gap: 8, padding: 8 }}>

        <button onClick={() => setConfirmLeave(true)} aria-label="יציאה מהמשחק" style={{ position: 'absolute', top: 6, insetInlineEnd: 6, zIndex: 80, width: 30, height: 30, borderRadius: '50%', border: `2px solid ${INK}`, background: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer', color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}>✕</button>

        {/* right panel (RTL start): me + dice */}
        <div style={{ width: 168, flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {players.filter((p) => !p.isBot).map((p) => panelCard(p, active?.uid === p.uid))}
          <div style={{ marginTop: 'auto' }}>
            <div style={{ background: 'rgba(15,28,42,.72)', border: '1px solid rgba(255,255,255,.30)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: 22, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div style={{ display: 'flex', gap: 11, justifyContent: 'center' }}>
                {[0, 1].map((i) => (
                  <div key={i} style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 30, color: '#fff' }}>
                    {dice[i] ?? '·'}
                  </div>
                ))}
              </div>
              <button
                onClick={rollAndWalk}
                disabled={!isMyTurn}
                style={{ background: isMyTurn ? '#e7cd94' : 'rgba(255,255,255,.14)', border: isMyTurn ? '1px solid #d8b974' : '1px solid rgba(255,255,255,.18)', borderRadius: 16, padding: '15px 6px', fontSize: 17, fontWeight: 800, color: isMyTurn ? '#1c2433' : 'rgba(255,255,255,.6)', cursor: isMyTurn ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><IcDice size={20} color={isMyTurn ? '#1c2433' : 'rgba(255,255,255,.6)'} /> הטלת קוביות</span>
              </button>
              <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,.9)' }}>
                {isMyTurn ? 'תורך!' : (active ? 'תור ' + active.name : '')}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 999, padding: '8px 10px' }}>
                <button
                  onClick={() => {
                    const m = cameraMode === 'zoom' ? 'full' : 'zoom';
                    setCameraMode(m);
                    try { localStorage.setItem('beyahad_aroundworld_camera', m); } catch { /* ignore */ }
                    if (m === 'full') setFocusTiles(null);
                  }}
                  title={cameraMode === 'zoom' ? 'מצלמה עוקבת' : 'לוח מלא'} aria-label="מצלמה"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 21, lineHeight: 1, padding: 2 }}>
                  {cameraMode === 'zoom' ? <IcCamera size={21} /> : <IcMap size={21} />}
                </button>
                <button
                  onClick={() => { const m = !muted; setMuted(m); setMutedState(m); if (!m) playSound('step'); }}
                  title={muted ? 'צלילים כבויים' : 'צלילים פועלים'} aria-label="צלילים"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 21, lineHeight: 1, padding: 2, opacity: muted ? 0.5 : 1 }}>
                  {muted ? <IcSoundOff size={21} /> : <IcSound size={21} />}
                </button>
                <AwMusicButton musicOn={musicOn} onToggle={toggleMusic} onNext={nextRandomTrack} onVolDown={musicVolDown} onVolUp={musicVolUp} />
              </div>
            </div>
          </div>
        </div>

        {/* board center */}
        <div
          style={{ flex: 1, minWidth: 0, position: 'relative' }}
          onDoubleClick={() => setPeek((v) => !v)}
        >
          <AroundWorldBoard
            focusTiles={peek ? null : focusTiles}
            tokens={tokens}
            owners={owners}
            hotels={hotels}
            tokenColors={tokenColors}
            priceIndex={priceIndex}
            diceToss={diceToss}
          />
          {peek && (
            <div style={{ position: 'absolute', top: 8, insetInlineStart: '50%', transform: 'translateX(-50%)', background: 'rgba(28,28,28,.78)', color: '#fff', borderRadius: 999, padding: '5px 14px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
              לוח מלא — לחיצה כפולה לזום חזרה
            </div>
          )}
          {/* אנימציית זריקת קוביות — בתוך הלוח, גודל יחסי ללוח */}
          {diceToss && false && null}
        </div>

        {/* left panel: opponents */}
        <div style={{ width: 168, flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
          {players.filter((p) => p.isBot).map((p) => panelCard(p, active?.uid === p.uid))}
        </div>
      </div>

      {/* player cards modal */}
      {viewPlayer && (
        <CardsModal player={viewPlayer} players={players} owners={owners} hotels={hotels} lottoCards={LOTTO_CARDS} chanceCards={CHANCE_CARDS} onClose={() => setViewPlayer(null)} rotate={isPortrait} />
      )}

      {/* מינוס: חלון מכירת מדינות — מוצג רק לשחקן האנושי שחייב למכור (בוט מוכר אוטומטית) */}
      {debtor && (() => {
        const dp = players.find((p) => p.uid === debtor.uid);
        if (!dp || dp.isBot) return null;
        const items = TILES.filter((t) => t.type === 'prop' && owners[t.id] === debtor.uid).map((t) => ({ tile: t, level: hotels[t.id] || 0 }));
        return <DebtSellModal player={dp} items={items} deadline={debtor.deadline} onSell={(ids) => sellProperties(debtor.uid, ids)} rotate={isPortrait} />;
      })()}

      {/* lotto / chance: flip-card animation (a card rises from the deck,
          flips to reveal, then flips back) - classic board-game feel */}
      {card && (card.kind === 'lotto' || card.kind === 'chance') && (
        <CardFlip card={card} actor={active} onDone={() => resolveCard('ok')} />
      )}

      {/* landing card (everything except lotto/chance) */}
      {card && card.kind !== 'lotto' && card.kind !== 'chance' && (
        <LandingCard card={card} players={players} onAction={resolveCard} />
      )}

      {/* game over */}
      {phase === 'gameover' && winner && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(28,28,28,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: CREAM, border: `3px solid ${INK}`, borderRadius: 18, padding: '26px 30px', textAlign: 'center', width: 'min(92vw, 400px)' }}>
            <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'center' }}><IcTrophy size={50} color="#caa53e" /></div>
            <div style={{ fontWeight: 900, fontSize: 28, color: INK, margin: '8px 0' }}>{winner.name} ניצח!</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#444', marginBottom: 18 }}>
              שווי כולל: {netWorth(winner, owners).toLocaleString()} ₪
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setSetupStep('mode'); setPhase('setup'); }} style={{ flex: 1, background: '#2f9e3f', color: '#fff', border: `2.5px solid ${INK}`, borderRadius: 12, padding: 12, fontSize: 17, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                משחק חדש
              </button>
              <button onClick={onBack} style={{ flex: 1, background: '#fff', color: INK, border: `2.5px solid ${INK}`, borderRadius: 12, padding: 12, fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                חזרה לזירה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ב-portrait — עוטפים בקונטיינר מסובב; אחרת מחזירים ישירות
  const leaveModal = confirmLeave ? (
    <LeaveConfirmModal
      title="לעזוב את המשחק?"
      subtitle="המשחק הנוכחי יסתיים"
      stayLabel="לא, להישאר במשחק"
      leaveLabel="כן, לעזוב"
      onStay={() => setConfirmLeave(false)}
      onLeave={() => { setConfirmLeave(false); onBack(); }}
    />
  ) : null;

  const audioEl = (
    <audio
      ref={audioRef}
      src={MUSIC_TRACKS[trackIdx]}
      onEnded={nextRandomTrack}
      onCanPlay={() => { if (musicOn) audioRef.current?.play().catch(() => {}); }}
      style={{ display: 'none' }}
    />
  );

  if (isPortrait) {
    return (
      <>
        <div style={rotateOuter}>
          <div style={rotateInner}>{gameInner}</div>
        </div>
        {leaveModal}
        {audioEl}
      </>
    );
  }
  return (
    <>
      {gameInner}
      {leaveModal}
      {audioEl}
    </>
  );
}

// ============================================================================
// SETUP SCREEN — מסך בחירת מצב (בסגנון רמיקוב): שחקן רנדומלי /
// שחק עם חברים / נגד המחשב / כמה שחקנים
// ============================================================================
function SetupScreen({ onBack, onHome, onStart, onOnline }) {
  const [step, setStep] = useState('mode'); // 'mode' | 'ai-setup' | 'random-setup'
  const [soon, setSoon] = useState(false);

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">מסביב לעולם</div>
      </div>

      <div style={{ padding: '8px 20px 32px' }}>
        {/* כרטיס אינטרו */}
        <div style={{ background: 'linear-gradient(135deg, #2f73c9 0%, #1d4e8f 100%)', borderRadius: 20, padding: '20px 18px', color: '#FBF7EE', marginBottom: 24, boxShadow: '0 8px 20px -6px rgba(29,78,143,.5)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}><GameIcon id="aroundworld" size={52} /></div>
          <div className="h-display" style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 6 }}>מסביב לעולם</div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'rgba(255,255,255,.92)' }}>מטיילים בעולם, קונים מדינות — ומי שמתעשר הכי הרבה מנצח</div>
        </div>

        {step === 'mode' && (
          <>
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>בחרו איך לשחק:</h2>
            <AwModeButton onClick={() => setStep('random-setup')} iconId="online-random" gradient="linear-gradient(135deg, #7E2C2E, #5A1D1E)" label="שחקן רנדומלי" description="שחקו עם אנשים אחרים באפליקציה" badge="חדש" />
            <AwModeButton onClick={() => onOnline('online-friend', 4)} iconId="online-friend" gradient="linear-gradient(135deg, #4F6B4A, #354D31)" label="שחק עם חברים" description="הזמינו חברים מהרשימה שלכם" badge="חדש" />
            <AwModeButton onClick={() => setStep('ai-setup')} iconId="vs-ai" gradient="linear-gradient(135deg, #2C5566, #173846)" label="נגד המחשב" description="שחקו לבד מול יריבי מחשב" />
            <AwModeButton onClick={() => setSoon(true)} iconId="local-2p" gradient="linear-gradient(135deg, #B89048, #8A6A2E)" label="כמה שחקנים" description="2-4 שחקנים על אותו מכשיר" badge="בקרוב" />

            {soon && (
              <div style={{ marginTop: 14, background: '#fff', border: '1px dashed var(--line-strong)', borderRadius: 14, padding: '14px 16px', textAlign: 'center', fontSize: 14.5, fontWeight: 700, color: '#a35a12' }}>
                משחק על אותו מכשיר יגיע ממש בקרוב - בינתיים אפשר לשחק אונליין או נגד המחשב 😊
              </div>
            )}
          </>
        )}

        {step === 'random-setup' && (
          <>
            <AwBackLink onClick={() => setStep('mode')} />
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 6px', color: 'var(--ink)' }}>עם כמה שחקנים תרצו לשחק?</h2>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 12 }}>נחכה עד שיצטרפו מספיק אנשים, ואז המשחק יתחיל אוטומטית.</div>
            <AwCountPicker options={[2, 3, 4]} labels={['2 שחקנים', '3 שחקנים', '4 שחקנים']} onPick={(n) => onOnline('online-random', n)} />
          </>
        )}

        {step === 'ai-setup' && (
          <>
            <AwBackLink onClick={() => setStep('mode')} />
            <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>נגד כמה יריבים?</h2>
            <AwCountPicker options={[1, 2, 3]} labels={['יריב אחד', '2 יריבים', '3 יריבים']} onPick={(n) => onStart(n)} />
          </>
        )}
      </div>
    </div>
  );
}

function AwBackLink({ onClick }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ink-2)', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
      <IconBackRTL size={18} color="#8389A4" /> חזרה
    </button>
  );
}

function AwModeButton({ onClick, iconId, gradient, label, description, badge }) {
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '16px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', position: 'relative' }}>
      {badge && <div style={{ position: 'absolute', top: -8, insetInlineStart: 12, background: '#e8761f', color: 'white', fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 999 }}>{badge}</div>}
      <div style={{ width: 52, height: 52, borderRadius: 14, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><GameIcon id={iconId} size={36} /></div>
      <div style={{ flex: 1 }}>
        <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)', lineHeight: 1.15 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginTop: 2 }}>{description}</div>
      </div>
      <IconBackRTL size={20} color="#8389A4" />
    </button>
  );
}

function AwCountPicker({ options, labels, onPick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {options.map((n, i) => (
        <button key={n} onClick={() => onPick(n)} style={{
          width: '100%', textAlign: 'right', background: 'var(--surface)',
          border: '1px solid var(--line)', borderRadius: 16, padding: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
        }}>
          <span className="h-display" style={{ fontSize: 18, color: 'var(--ink)' }}>{labels[i]}</span>
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', background: 'linear-gradient(135deg,#2f73c9,#1d4e8f)', borderRadius: 10, padding: '5px 9px' }}>
            {Array.from({ length: Math.min(n, 3) }).map((_, k) => <GameIcon key={k} id="aroundworld" size={20} />)}
          </span>
        </button>
      ))}
    </div>
  );
}

// ---- player assets modal: the country cards a player owns -------------------
function PlayerAssets({ player, owners, hotels, onClose }) {
  const owned = TILES.filter((t) => t.type === 'prop' && owners[t.id] === player.uid);
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 35, background: 'rgba(28,28,28,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: CREAM, border: `3px solid ${INK}`, borderRadius: 18, width: 'min(92vw, 560px)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: '0 18px 50px rgba(0,0,0,.4)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `2px solid ${INK}`, background: '#fff' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: player.color, border: `3px solid ${INK}`, flex: 'none' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: INK }}>המדינות של {player.name}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1c4e26' }}>{player.cash.toLocaleString()} ₪ בקופה · {owned.length} מדינות</div>
          </div>
          <button onClick={onClose} aria-label="סגירה" style={{ width: 38, height: 38, borderRadius: 10, border: `2px solid ${INK}`, background: '#fff', fontSize: 18, fontWeight: 900, cursor: 'pointer', color: INK }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: 12 }}>
          {owned.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '26px 10px', fontWeight: 700, fontSize: 17, color: '#555' }}>
              עוד אין מדינות. הכל לפניו! 🌍
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
              {owned.map((t) => {
                const grp = GROUPS[t.group];
                const level = hotels[t.id] || 0;
                const rent = rentFor(t, owners, hotels);
                return (
                  <div key={t.id} style={{ background: '#fff', border: `2px solid ${INK}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: 9, background: grp.color }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
                      <div style={{ width: 58, height: 38, flex: 'none' }} dangerouslySetInnerHTML={{ __html: flagSVG(t.flag) }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 17, color: INK, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {t.name}
                          {level > 0 && <span style={{ background: level === 4 ? '#2f73c9' : '#d8402a', color: '#fff', fontSize: 11.5, fontWeight: 800, borderRadius: 7, padding: '1px 7px', border: `1.5px solid ${INK}` }}>{LEVEL_NAMES[level]}</span>}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: '#333' }}>
                          קנייה {t.price} ₪ · שכירות {rent} ₪
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- landing card modal -----------------------------------------------------
function LandingCard({ card, players, onAction }) {
  const t = card.tile;
  const actor = players.find((p) => p.uid === card.uid);
  const ownerP = card.owner ? players.find((p) => p.uid === card.owner) : null;
  const isHuman = actor && !actor.isBot;
  const grp = t && t.type === 'prop' ? GROUPS[t.group] : null;

  let title = t?.name || '';
  let sub = '';
  let buttons = null;

  const btn = (label, action, bg, fg = '#fff') => (
    <button key={label} onClick={() => onAction(action)} style={{
      flex: 1, background: bg, color: fg, border: `2.5px solid ${INK}`, borderRadius: 12,
      padding: '13px 8px', fontSize: 18, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
    }}>{label}</button>
  );

  // property tiles get the REAL card next to the action - so the player can
  // see all rent tiers and judge whether the purchase pays off
  if (t && t.type === 'prop' && (card.kind === 'buy' || card.kind === 'hotel' || card.kind === 'rent')) {
    let hl = -1, sideTitle = '', sideSub = '', actions = null;
    if (card.kind === 'buy') {
      const eff = card.price ?? t.price;
      const pct = (eff !== t.price && card.price != null) ? Math.round((eff / t.price - 1) * 100) : 0;
      const canAfford = actor && actor.cash >= eff;
      sideTitle = 'מדינה פנויה';
      sideSub = grp.label + (pct ? ' · מדד ' + (pct > 0 ? '+' : '') + pct + '%' : '');
      if (canAfford) {
        actions = [btn('לקנות · ' + eff + ' ₪', 'yes', '#2f9e3f'), btn('לא עכשיו', 'no', '#fff', INK)];
      } else {
        sideSub += ' · אין לך מספיק כסף לרכוש';
        actions = [btn('המשך', 'no', '#d8402a')];
      }
    } else if (card.kind === 'hotel') {
      hl = card.level + 1;
      const cost = buildCost(t, card.level);
      const what = nextBuildLabel(card.level);
      const canAfford = actor && actor.cash >= cost;
      sideTitle = 'המדינה שלך!';
      sideSub = 'השכירות תעלה ל-' + t.rents[hl] + ' ₪';
      if (canAfford) {
        actions = [btn('לבנות ' + what + ' · ' + cost + ' ₪', 'yes', '#2f73c9'), btn('לא עכשיו', 'no', '#fff', INK)];
      } else {
        sideSub += ' · אין לך מספיק כסף לבנות';
        actions = [btn('המשך', 'no', '#d8402a')];
      }
    } else {
      hl = card.level != null ? card.level : Math.max(0, t.rents.indexOf(card.amount));
      sideTitle = 'המדינה של ' + (ownerP?.name || '');
      sideSub = 'תשלום שכירות';
      actions = [btn('לשלם ' + card.amount + ' ₪', 'ok', '#d8402a')];
    }
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(28,28,28,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', padding: 16, boxSizing: 'border-box' }}>
        <div style={{ background: CREAM, border: `3px solid ${INK}`, borderRadius: 18, padding: '14px 18px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14, boxShadow: '0 18px 50px rgba(0,0,0,.4)', maxWidth: '100%', boxSizing: 'border-box' }}>
          <PropertyCard tile={t} level={hl} width={150} footer={card.kind === 'buy' ? <CardFooter color="#1c4e26">מחיר {card.price ?? t.price} ₪</CardFooter> : null} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 190, flex: 'none', textAlign: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: 21, color: INK, lineHeight: 1.1 }}>{sideTitle}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#3a3a3a', lineHeight: 1.3 }}>{sideSub}</div>
            {isHuman ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>{actions}</div>
            ) : (
              <div style={{ fontSize: 15, color: '#666' }}>{actor?.name} חושב...</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (card.kind === 'buy') {
    sub = 'מדינה פנויה · ' + grp.label;
    buttons = isHuman ? [btn('לקנות · ' + t.price + ' ₪', 'yes', '#2f9e3f'), btn('לא עכשיו', 'no', '#fff', INK)] : null;
  } else if (card.kind === 'hotel') {
    const cost = buildCost(t, card.level);
    const what = nextBuildLabel(card.level);
    const nextRent = t.rents[card.level + 1];
    sub = 'כל היבשת שלך! ' + (card.level === 0 ? 'אפשר לבנות מלון' : 'אפשר לשדרג ל' + LEVEL_NAMES[card.level + 1]) + ' - השכירות תעלה ל-' + nextRent + ' ₪';
    buttons = isHuman ? [btn('לבנות ' + what + ' · ' + cost + ' ₪', 'yes', '#2f73c9'), btn('לא עכשיו', 'no', '#fff', INK)] : null;
  } else if (card.kind === 'rent') {
    sub = 'המדינה של ' + (ownerP?.name || '') + ' - תשלום שכירות ' + card.amount + ' ₪';
    buttons = isHuman ? [btn('לשלם ' + card.amount + ' ₪', 'ok', '#d8402a')] : null;
  } else if (card.kind === 'pay') {
    sub = (t.sub || '') + ' · תשלום ' + Math.abs(card.amount) + ' ₪';
    buttons = isHuman ? [btn('לשלם', 'ok', '#d8402a')] : null;
  } else if (card.kind === 'birthday') {
    sub = 'מזל טוב! כל שחקן נותן לך ' + RULES.BIRTHDAY_GIFT + ' ₪ 🎂';
    buttons = isHuman ? [btn('תודה רבה!', 'ok', '#2f9e3f')] : null;
  } else if (card.kind === 'lotto' || card.kind === 'chance') {
    title = card.kind === 'lotto' ? 'מפעל הפיס' : 'הפתעה';
    sub = card.text + (typeof card.amount === 'number' ? (card.amount > 0 ? ' · +' + card.amount + ' ₪' : ' · ' + card.amount + ' ₪') : '');
    buttons = isHuman ? [btn('אישור', 'ok', typeof card.amount === 'number' && card.amount < 0 ? '#d8402a' : '#2f9e3f')] : null;
  } else if (card.kind === 'atzor') {
    sub = 'עוצרים ל-' + RULES.ATZOR_SKIP_TURNS + ' סיבובים';
    buttons = isHuman ? [btn('בסדר...', 'ok', '#e8761f')] : null;
  } else if (card.kind === 'odPaam') {
    sub = 'מגיע לך תור נוסף! 🎉';
    buttons = isHuman ? [btn('יאללה!', 'ok', '#2f9e3f')] : null;
  } else if (card.kind === 'info') {
    sub = card.text;
    buttons = isHuman ? [btn('אישור', 'ok', '#fff', INK)] : null;
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(28,28,28,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl' }}>
      <div style={{ background: CREAM, border: `3px solid ${INK}`, borderRadius: 18, width: 'min(86vw, 380px)', padding: '16px 20px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', boxShadow: '0 18px 50px rgba(0,0,0,.4)' }}>
        {grp && <div style={{ width: '100%', height: 9, background: grp.color, borderRadius: 5 }} />}
        {t && t.type === 'prop' && (
          <div style={{ width: 96, height: 64 }} dangerouslySetInnerHTML={{ __html: flagSVG(t.flag) }} />
        )}
        <div style={{ fontWeight: 900, fontSize: 28, color: INK, lineHeight: 1.05 }}>{title}</div>
        <div style={{ fontWeight: 700, fontSize: 17, color: '#3a3a3a', lineHeight: 1.35 }}>{sub}</div>
        {!isHuman && <div style={{ fontSize: 15, color: '#666' }}>{actor?.name} חושב...</div>}
        {buttons && <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 6 }}>{buttons}</div>}
      </div>
    </div>
  );
}

// ---- lotto / chance flip-card animation -------------------------------------
// A face-down card rises from the center deck, flips to reveal the result,
// waits, then flips back and drops home - like drawing a card in real life.
function CardFlip({ card, actor, onDone }) {
  // stage: 'rise' -> 'reveal' -> 'return'
  const [stage, setStage] = useState('rise');
  const isHuman = actor && !actor.isBot;
  const isLotto = card.kind === 'lotto';
  const accent = isLotto ? '#2f9e3f' : '#e8761f';
  const deckSide = isLotto ? { right: '14%' } : { left: '14%' }; // matches in-board decks
  const amount = typeof card.amount === 'number' ? card.amount : null;

  useEffect(() => {
    const t1 = setTimeout(() => setStage('reveal'), 620); // rise + flip to face
    return () => clearTimeout(t1);
  }, []);

  // bots auto-confirm; humans tap the button
  useEffect(() => {
    if (stage !== 'reveal') return;
    const t = setTimeout(() => setStage('return'), isHuman ? 6000 : 1700);
    return () => clearTimeout(t);
  }, [stage, isHuman]);

  // once returning, finish after the drop-home transition
  useEffect(() => {
    if (stage !== 'return') return;
    const t = setTimeout(onDone, 600);
    return () => clearTimeout(t);
  }, [stage, onDone]);

  const lifted = stage === 'reveal';
  const gone = stage === 'return';

  // card transform across stages
  const wrapStyle = {
    position: 'absolute', bottom: '8%', ...deckSide,
    width: 220, height: 300, zIndex: 2,
    transformStyle: 'preserve-3d',
    transition: 'transform .6s cubic-bezier(.34,1.2,.5,1)',
    transform: lifted
      ? 'translate(0,0) scale(1)'
      : 'translateY(40px) scale(.42)',
  };
  // when lifted, recenter to the middle of the screen
  if (lifted) {
    wrapStyle.bottom = 'auto';
    wrapStyle.top = '50%';
    wrapStyle.left = '50%';
    wrapStyle.right = 'auto';
    wrapStyle.transform = 'translate(-50%,-50%) scale(1)';
  }
  if (gone) {
    wrapStyle.transform = (deckSide.left ? 'translate(-50%,160%)' : 'translate(50%,160%)') + ' scale(.42)';
    wrapStyle.opacity = 0;
  }

  const innerStyle = {
    position: 'relative', width: '100%', height: '100%',
    transformStyle: 'preserve-3d',
    transition: 'transform .55s ease',
    transform: lifted ? 'rotateY(0deg)' : 'rotateY(180deg)',
  };
  const face = {
    position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    borderRadius: 16, overflow: 'hidden', boxShadow: '0 18px 50px rgba(0,0,0,.5)',
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(28,28,28,.55)', direction: 'rtl', overflow: 'hidden' }}>
      <div style={wrapStyle}>
        <div style={innerStyle}>
          {/* FRONT face (revealed content) */}
          <div style={{ ...face, transform: 'rotateY(0deg)', background: CREAM, border: `4px solid ${accent}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '18px 16px', textAlign: 'center', gap: 12 }}>
            <div style={{ fontFamily: 'Rubik, Heebo, sans-serif', fontWeight: 900, fontSize: 23, color: accent }}>{isLotto ? 'מפעל הפיס' : 'הפתעה'}</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: INK, lineHeight: 1.35 }}>{card.text}</div>
            {amount != null && (
              <div style={{ fontWeight: 900, fontSize: 26, color: amount < 0 ? '#d8402a' : '#1c4e26' }}>
                {amount > 0 ? '+' : ''}{amount} ₪
              </div>
            )}
            {card.back && <div style={{ fontWeight: 800, fontSize: 16, color: '#a35a12' }}>חוזרים {card.back} צעדים</div>}
            {isHuman && stage === 'reveal' && (
              <button onClick={() => setStage('return')} style={{ marginTop: 4, background: accent, color: '#fff', border: `2.5px solid ${INK}`, borderRadius: 12, padding: '10px 28px', fontSize: 17, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                אישור
              </button>
            )}
          </div>
          {/* BACK face (face-down deck design) */}
          <div style={{ ...face, transform: 'rotateY(180deg)', display: 'flex' }}
            dangerouslySetInnerHTML={{ __html: cardBack(card.kind) }} />
        </div>
      </div>
    </div>
  );
}
