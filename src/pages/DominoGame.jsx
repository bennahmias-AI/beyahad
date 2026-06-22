/*
  DominoGame.jsx
  דומינו 0–6 (28 אבנים) — מסך משחק לרוחב, נגד המחשב (מקומי).
  וריאנט: עם משיכה מהבריכה. סיבוב יחיד — הראשון שנפטר מכל האבנים מנצח
  (או חסימה → המעט נקודות ביד מנצח).
  מראה: שולחן לבד ירוק תלת-ממדי, אבני שנהב עם עומק, נקודות עגולות.

  Props: onBack, onHome, profile
*/

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { playSound, isMuted, setMuted } from '../utils/gameSounds';
import { MUSIC_TRACKS } from '../utils/gameSounds.js';
import { IconBackRTL, IconEffects } from '../icons/index.jsx';
import HomeButton from '../components/HomeButton.jsx';
import { GameIcon } from '../icons/gameIcons.jsx';
import LeaveConfirmModal from '../components/LeaveConfirmModal.jsx';
import Avatar from '../components/Avatar.jsx';
import DominoOnline from './DominoOnline.jsx';

// ── עוטף ראשי: מסך בחירת מצב → אונליין / נגד המחשב ──
export default function DominoGame({ onBack, onHome, profile, initialRoomId = null, initialMode = null, autoInviteFriend = null }) {
  const [mode, setMode] = useState(
    initialRoomId ? 'online-friend'
      : (autoInviteFriend ? 'online-friend'
        : (initialMode && String(initialMode).startsWith('online') ? initialMode : null))
  );
  const [roomId, setRoomId] = useState(initialRoomId || null);
  useEffect(() => { if (initialRoomId) { setMode('online-friend'); setRoomId(initialRoomId); } }, [initialRoomId]);

  if (!mode) {
    return (
      <DominoModeSelect
        onBack={onBack} onHome={onHome}
        onSelectAI={() => setMode('ai')}
        onSelectOnlineRandom={() => setMode('online-random')}
        onSelectOnlineFriend={() => setMode('online-friend')}
      />
    );
  }
  if (mode === 'ai') {
    return <DominoLocal onBack={() => setMode(null)} onExit={onBack} onHome={onHome} profile={profile} />;
  }
  return (
    <DominoOnline
      mode={mode} initialRoomId={roomId} autoInviteFriend={autoInviteFriend}
      onBack={autoInviteFriend ? onBack : () => { setMode(null); setRoomId(null); }}
      onHome={onHome} onExit={onBack}
    />
  );
}

// ── מסך בחירת מצב (כמו רמיקוב): אונליין רנדומלי / חברים / נגד המחשב / כמה שחקנים ──
function DominoModeSelect({ onBack, onHome, onSelectAI, onSelectOnlineRandom, onSelectOnlineFriend }) {
  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">דומינו</div>
      </div>
      <div style={{ padding: '8px 20px 32px' }}>
        <div style={{ background: 'linear-gradient(135deg,#218a59,#136441)', borderRadius: 20, padding: '20px 18px', color: '#FBF7EE', marginBottom: 24, boxShadow: '0 8px 20px -6px rgba(19,100,65,.5)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}><GameIcon id="domino" size={52} /></div>
          <div className="h-display" style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 6 }}>דומינו</div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'rgba(255,255,255,.92)' }}>התאימו ופרקו את כל האבנים ראשונים</div>
        </div>
        <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>בחרו איך לשחק:</h2>
        <DomModeButton onClick={onSelectOnlineRandom} iconId="online-random" gradient="linear-gradient(135deg,#7E2C2E,#5A1D1E)" label="שחקן רנדומלי" description="שחקו עם אנשים אחרים באפליקציה" badge="חדש" />
        <DomModeButton onClick={onSelectOnlineFriend} iconId="online-friend" gradient="linear-gradient(135deg,#4F6B4A,#354D31)" label="שחק עם חברים" description="הזמינו חברים מהרשימה שלכם" badge="חדש" />
        <DomModeButton onClick={onSelectAI} iconId="vs-ai" gradient="linear-gradient(135deg,#2C5566,#173846)" label="נגד המחשב" description="שחקו לבד מול יריב מחשב" />
      </div>
    </div>
  );
}

function DomModeButton({ onClick, iconId, gradient, label, description, badge, comingSoon }) {
  return (
    <button onClick={comingSoon ? undefined : onClick} disabled={comingSoon} style={{ width: '100%', textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', cursor: comingSoon ? 'default' : 'pointer', position: 'relative', opacity: comingSoon ? 0.6 : 1 }}>
      {badge && <div style={{ position: 'absolute', top: -8, insetInlineStart: 12, background: 'var(--burgundy)', color: 'white', fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconEffects size={11} color="white" /> {badge}</div>}
      {comingSoon && <div style={{ position: 'absolute', top: -8, insetInlineStart: 12, background: 'var(--bg-app)', color: 'var(--ink-3)', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999, border: '1px solid var(--line)' }}>בקרוב</div>}
      <div style={{ width: 52, height: 52, borderRadius: 14, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><GameIcon id={iconId} size={36} /></div>
      <div style={{ flex: 1 }}>
        <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)', lineHeight: 1.15 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginTop: 2 }}>{description}</div>
      </div>
      {!comingSoon && <IconBackRTL size={20} color="#8389A4" />}
    </button>
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BOT_NAMES = ['דניאל', 'רינת', 'רומי'];
const MUSIC_VOLUME = 0.10;

// ── אייקוני קו (לבן על רקע כהה) ──
const IcBase = ({ size = 18, color = '#fff', children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>{children}</svg>
);
const IcMusic = (p) => <IcBase {...p}><path d="M9 17V5l10-2v12" /><circle cx="6" cy="17" r="3" /><circle cx="16" cy="15" r="3" /></IcBase>;
const IcMusicOff = (p) => <IcBase {...p}><path d="M9 17V5l10-2v6" /><circle cx="6" cy="17" r="3" /><path d="M3 3l18 18" /></IcBase>;
const IcSound = (p) => <IcBase {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={p.color || '#fff'} stroke="none" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></IcBase>;
const IcSoundOff = (p) => <IcBase {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={p.color || '#fff'} stroke="none" /><path d="M22 9l-6 6M16 9l6 6" /></IcBase>;
const IcNext = (p) => <IcBase {...p}><path d="M5 4l10 8-10 8z" fill={p.color || '#fff'} stroke="none" /><rect x="16" y="4" width="2.6" height="16" rx="1" fill={p.color || '#fff'} stroke="none" /></IcBase>;
const dmMenuItem = { display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', padding: '8px 10px', textAlign: 'right', borderRadius: 8 };
const dmVolBtn = { width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.12)', color: '#fff', fontSize: 18, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 };

// נקודות לכל ערך (אינדקסים 0..8 ברשת 3x3)
const FACES = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function makeSet() {
  const t = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) t.push({ a, b, id: a + '-' + b });
  return t;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const pipSum = (hand) => hand.reduce((s, t) => s + t.a + t.b, 0);
const fitsEnd = (t, v) => v != null && (t.a === v || t.b === v);
const playableTiles = (hand, l, r) => hand.filter((t) => fitsEnd(t, l) || fitsEnd(t, r));
const keyOf = (t) => Math.min(t.a, t.b) + '-' + Math.max(t.a, t.b);

// פריסת נחש מעוגנת על אבן הפתיחה: זרוע ימין גדלה ימינה+למטה, זרוע שמאל שמאלה+למעלה.
// הוספת אבן בצד אחד לא מזיזה אבנים קיימות, והנחש לא חייב להיות סימטרי.
function buildSnake2(line, perRow, oi) {
  const L = 62, S = 31, PITCH = S + L;
  const placed = [];
  if (!line.length) return { placed, w: 1, h: 1 };
  if (oi == null || oi < 0 || oi >= line.length) oi = 0;

  // אבן הפתיחה: עוגן קבוע במרכז השורה המרכזית
  placed.push({ t: line[oi], li: oi, x: 0, y: 0, w: L, h: S, dir: 'R' });

  // זרוע ימין line[oi+1..]: ימינה ואז פנייה למטה
  let rcol = 1, rrow = 0, rRight = true;
  for (let k = oi + 1; k < line.length; k++) {
    if (rRight && rcol > perRow - 1) {
      placed.push({ t: line[k], li: k, x: (perRow - 1) * L + (L - S), y: rrow * PITCH + S, w: S, h: L, dir: 'D' });
      rrow++; rRight = false; rcol = perRow - 1; continue;
    }
    if (!rRight && rcol < 0) {
      placed.push({ t: line[k], li: k, x: 0, y: rrow * PITCH + S, w: S, h: L, dir: 'D' });
      rrow++; rRight = true; rcol = 0; continue;
    }
    placed.push({ t: line[k], li: k, x: rcol * L, y: rrow * PITCH, w: L, h: S, dir: rRight ? 'R' : 'L' });
    rcol += rRight ? 1 : -1;
  }

  // זרוע שמאל line[oi-1..0]: שמאלה ואז פנייה למעלה
  let lcol = -1, lrow = 0, lLeft = true;
  for (let k = oi - 1; k >= 0; k--) {
    if (lLeft && lcol < -(perRow - 1)) {
      placed.push({ t: line[k], li: k, x: -(perRow - 1) * L, y: lrow * PITCH - L, w: S, h: L, dir: 'D' });
      lrow--; lLeft = false; lcol = -(perRow - 1); continue;
    }
    if (!lLeft && lcol > 0) {
      placed.push({ t: line[k], li: k, x: 0, y: lrow * PITCH - L, w: S, h: L, dir: 'D' });
      lrow--; lLeft = true; lcol = 0; continue;
    }
    placed.push({ t: line[k], li: k, x: lcol * L, y: lrow * PITCH, w: L, h: S, dir: lLeft ? 'R' : 'L' });
    lcol += lLeft ? -1 : 1;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  placed.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x + p.w); maxY = Math.max(maxY, p.y + p.h); });
  placed.forEach((p) => { p.x -= minX; p.y -= minY; });
  return { placed, w: maxX - minX, h: maxY - minY };
}

// פריסת "נחש" מתפתל: ימינה -> פנייה למטה -> שמאלה -> פנייה למטה ...
// כל אבן מקבלת מיקום מוחלט + כיוון (R/L/D) כדי שהמספרים הנוגעים תמיד יתאימו.
function buildSnake(line, perRow) {
  const L = 62, S = 31;
  const PITCH = S + L; // מרווח בין ראשי שורות; אבן הפנייה האנכית ממלאה את הרווח ונוגעת צמוד ב-2 השורות
  const placed = [];
  let i = 0, row = 0;
  while (i < line.length) {
    const right = (row % 2 === 0);
    const rowTop = row * PITCH;
    const remaining = line.length - i;
    const hCount = remaining > perRow ? perRow : remaining;
    for (let k = 0; k < hCount; k++) {
      const col = right ? k : (perRow - 1 - k);
      placed.push({ t: line[i], x: col * L, y: rowTop, w: L, h: S, dir: right ? 'R' : 'L' });
      i++;
    }
    if (i < line.length) {
      // אבן פנייה אנכית — צמודה לקצה השורה, ממלאה את הרווח עד השורה הבאה
      const vx = right ? (perRow - 1) * L + (L - S) : 0;
      placed.push({ t: line[i], x: vx, y: rowTop + S, w: S, h: L, dir: 'D' });
      i++;
    }
    row++;
  }
  if (!placed.length) return { placed, w: 1, h: 1 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  placed.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x + p.w); maxY = Math.max(maxY, p.y + p.h); });
  placed.forEach((p) => { p.x -= minX; p.y -= minY; });
  return { placed, w: maxX - minX, h: maxY - minY };
}

// ---------- אבן בודדת ----------
function Face({ v }) {
  return (
    <div className="dm-half">
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i}>{FACES[v].includes(i) ? <i className="dm-pip" /> : null}</span>
      ))}
    </div>
  );
}
function DTile({ a, b, vertical, onClick, cls = '', style }) {
  return (
    <div className={'dm-tile ' + (vertical ? 'v' : 'h') + ' ' + cls} onClick={onClick} style={style}>
      <Face v={a} /><Face v={b} />
    </div>
  );
}

// ============================================================================
function DominoLocal({ onBack, onHome, profile, onExit, onGoOnline }) {
  // ---- orientation (לרוחב; נעילה פיזית + fallback CSS כמו במסביב לעולם) ----
  const [isPortrait, setIsPortrait] = useState(() => window.matchMedia('(orientation: portrait)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const fn = (e) => setIsPortrait(e.matches);
    mq.addEventListener('change', fn);
    try {
      const so = window.screen && window.screen.orientation;
      if (so && so.lock) { const p = so.lock('landscape'); if (p && p.catch) p.catch(() => {}); }
    } catch { /* unsupported */ }
    return () => {
      mq.removeEventListener('change', fn);
      try {
        const so = window.screen && window.screen.orientation;
        if (so && so.lock) { const p = so.lock('portrait'); if (p && p.catch) p.catch(() => { try { so.unlock && so.unlock(); } catch {} }); }
        else if (so && so.unlock) so.unlock();
      } catch {}
    };
  }, []);

  // ---- game state ----
  const [phase, setPhase] = useState('setup'); // setup | playing | gameover
  const [difficulty, setDifficulty] = useState(2);
  const [botName] = useState(() => BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]);
  const [hand, setHand] = useState([]);
  const [botHand, setBotHand] = useState([]);
  const [boneyard, setBoneyard] = useState([]);
  const [line, setLine] = useState([]); // [{a,b}] שמאל→ימין; line[i].b === line[i+1].a
  const [turn, setTurn] = useState('me'); // me | bot
  const [message, setMessage] = useState('');
  const [winner, setWinner] = useState(null); // 'me' | 'bot' | null
  const [pending, setPending] = useState(null); // אבן שמתאימה לשני הקצוות → בחירת קצה
  const [muted, setMutedState] = useState(() => isMuted());
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [botDrawFlash, setBotDrawFlash] = useState(0);
  const [perRow, setPerRow] = useState(4);     // הנחש פונה כל 4 אבנים (קבוע)
  const [fitScale, setFitScale] = useState(1); // זום אוטומטי להתאמה ללוח
  const [openerKey, setOpenerKey] = useState(null); // אבן הפתיחה (עוגן הפריסה)
  const [lastSide, setLastSide] = useState('r');    // צד המהלך האחרון (להדגשת האבן החדשה)

  const leftEnd = line.length ? line[0].a : null;
  const rightEnd = line.length ? line[line.length - 1].b : null;
  const myName = profile?.name || 'אני';

  // refs mirror (לוגיקת בוט אסינכרונית)
  const G = useRef({});
  G.current = { phase, hand, botHand, boneyard, line, turn, difficulty };
  const chainRef = useRef(null);       // עוטף הלוח
  const chainInnerRef = useRef(null);  // השרשרת הפנימית (לזום)
  const snakeDimsRef = useRef({ w: 1, h: 1 });
  const passRef = useRef(0); // ספירת דילוגים רצופים (חסימה)

  // ---- music ----
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem('beyahad_domino_music') !== 'off'; } catch { return true; } });
  const [trackIdx, setTrackIdx] = useState(() => Math.floor(Math.random() * MUSIC_TRACKS.length));
  const [musicVol, setMusicVol] = useState(MUSIC_VOLUME);
  const [musicMenu, setMusicMenu] = useState(false);
  const audioRef = useRef(null);
  const nextTrack = () => setTrackIdx((i) => { if (MUSIC_TRACKS.length <= 1) return i; let n = i; while (n === i) n = Math.floor(Math.random() * MUSIC_TRACKS.length); return n; });
  const toggleMusic = () => setMusicOn((on) => { const n = !on; try { localStorage.setItem('beyahad_domino_music', n ? 'on' : 'off'); } catch {} return n; });
  const volDown = () => setMusicVol((v) => Math.max(0.02, +(v - 0.03).toFixed(2)));
  const volUp = () => { setMusicVol((v) => Math.min(0.6, +(v + 0.03).toFixed(2))); setMusicOn(true); try { localStorage.setItem('beyahad_domino_music', 'on'); } catch {} };
  useEffect(() => { const a = audioRef.current; if (!a) return; a.volume = musicVol; if (musicOn) a.play().catch(() => {}); else a.pause(); }, [musicOn, trackIdx, musicVol]);
  useEffect(() => {
    if (!musicOn) return;
    const kick = () => { const a = audioRef.current; if (a && a.paused && musicOn) a.play().catch(() => {}); };
    window.addEventListener('pointerdown', kick); window.addEventListener('touchstart', kick);
    return () => { window.removeEventListener('pointerdown', kick); window.removeEventListener('touchstart', kick); };
  }, [musicOn]);

  // ---- deal + open ----
  function startGame(diff) {
    setDifficulty(diff);
    const deck = shuffle(makeSet());
    const me = deck.slice(0, 7);
    const bot = deck.slice(7, 14);
    const bone = deck.slice(14);

    // קובע מי פותח: הכפולה הגבוהה ביותר; אם אין — האבן הגבוהה ביותר
    let opener = null, openTile = null;
    for (let v = 6; v >= 0 && !openTile; v--) {
      if (me.find((t) => t.a === v && t.b === v)) { opener = 'me'; openTile = { a: v, b: v }; }
      else if (bot.find((t) => t.a === v && t.b === v)) { opener = 'bot'; openTile = { a: v, b: v }; }
    }
    if (!openTile) {
      const best = (h) => h.reduce((m, t) => (t.a + t.b > m.a + t.b || (t.a + t.b === m.a + m.b && Math.max(t.a, t.b) > Math.max(m.a, m.b)) ? t : m), h[0]);
      const bm = best(me), bb = best(bot);
      if (bm.a + bm.b >= bb.a + bb.b) { opener = 'me'; openTile = bm; } else { opener = 'bot'; openTile = bb; }
    }
    const rm = (h) => h.filter((t) => !(t.a === openTile.a && t.b === openTile.b));
    const meH = opener === 'me' ? rm(me) : me;
    const botH = opener === 'bot' ? rm(bot) : bot;

    passRef.current = 0;
    setHand(meH); setBotHand(botH); setBoneyard(bone);
    setLine([{ a: openTile.a, b: openTile.b }]);
    setOpenerKey(keyOf(openTile)); setLastSide('r');
    setWinner(null); setPending(null);
    setTurn(opener === 'me' ? 'bot' : 'me');
    setMessage((opener === 'me' ? myName : botName) + ' פתח עם ' + openTile.a + '־' + openTile.b);
    setPhase('playing');
    playSound('step');
  }

  // ---- placing ----
  function placeOnLine(prev, tile, side) {
    // מחזיר line חדש + הקצוות מתעדכנים. side: 'l' | 'r'
    const l = prev.length ? prev[0].a : null;
    const r = prev.length ? prev[prev.length - 1].b : null;
    if (side === 'l') {
      const other = tile.a === l ? tile.b : tile.a; // הצד שלא נוגע
      return [{ a: other, b: l }, ...prev];
    } else {
      const other = tile.a === r ? tile.b : tile.a;
      return [...prev, { a: r, b: other }];
    }
  }

  function afterPlay(who, newHand, newLine, newBone) {
    passRef.current = 0;
    if (newHand.length === 0) {
      setWinner(who); setPhase('gameover'); playSound('win');
      setMessage((who === 'me' ? myName : botName) + ' ניצח!');
      return;
    }
    if (who === 'me') { setTurn('bot'); setMessage('התור של ' + botName); }
    else { setTurn('me'); setMessage('תורך'); }
  }

  // ---- player actions ----
  function tapTile(tile) {
    if (phase !== 'playing' || turn !== 'me') return;
    const okL = fitsEnd(tile, leftEnd), okR = fitsEnd(tile, rightEnd);
    if (!okL && !okR) return; // לא משחקת
    if (okL && okR && leftEnd !== rightEnd) { setPending(tile); return; }
    const side = okR ? 'r' : 'l';
    doPlay(tile, side);
  }
  function doPlay(tile, side) {
    setPending(null);
    const nl = placeOnLine(line, tile, side);
    const nh = hand.filter((t) => t.id !== tile.id);
    setLine(nl); setHand(nh);
    setLastSide(side);
    playSound('step');
    scrollChain(side);
    afterPlay('me', nh, nl, boneyard);
  }
  function drawForMe() {
    if (phase !== 'playing' || turn !== 'me' || boneyard.length === 0) return;
    const drawn = boneyard[0];
    setBoneyard((b) => b.slice(1));
    setHand((h) => [...h, drawn]);
    playSound('step');
  }
  function passMe() {
    if (phase !== 'playing' || turn !== 'me') return;
    passRef.current += 1;
    if (passRef.current >= 2) return endBlocked();
    setTurn('bot'); setMessage(botName + ' משחק...');
  }

  function scrollChain() { /* serpentine + זום אוטומטי מציגים את כל האבנים — אין צורך בגלילה */ }

  // ---- serpentine: כמה אבנים בשורה + זום אוטומטי שכל האבנים ייראו ----
  useLayoutEffect(() => {
    const wrap = chainRef.current;
    if (!wrap) return;
    const cw = wrap.clientWidth, ch = wrap.clientHeight;
    const fit = Math.floor((cw - 12) / 62);
    const pr = Math.max(4, Math.min(7, fit - 2)); // פונים מוקדם — לא מחכים לקצה הלוח
    if (false) { setPerRow(perRow); }
    const { w: iw, h: ih } = snakeDimsRef.current;
    const s = Math.min(1, (cw - 12) / (iw || 1), (ch - 12) / (ih || 1));
    if (Math.abs(s - fitScale) > 0.015) setFitScale(s);
  }, [line, isPortrait, perRow]);

  function endBlocked() {
    const my = pipSum(G.current.hand), bt = pipSum(G.current.botHand);
    const w = my <= bt ? 'me' : 'bot';
    setWinner(w); setPhase('gameover'); playSound('win');
    setMessage('המשחק נחסם — ' + (w === 'me' ? myName : botName) + ' מנצח (פחות נקודות)');
  }

  // ---- bot turn ----
  useEffect(() => {
    if (phase !== 'playing' || turn !== 'bot') return;
    let alive = true;
    (async () => {
      await sleep(900);
      if (!alive) return;
      let bh = G.current.botHand.slice();
      let bone = G.current.boneyard.slice();
      let ln = G.current.line.slice();
      const ends = () => ({ l: ln.length ? ln[0].a : null, r: ln.length ? ln[ln.length - 1].b : null });

      // משיכה עד שיש מהלך
      let play = playableTiles(bh, ends().l, ends().r);
      while (play.length === 0 && bone.length > 0) {
        const d = bone.shift(); bh.push(d);
        setBoneyard(bone.slice()); setBotHand(bh.slice());
        setBotDrawFlash((n) => n + 1);
        playSound('step');
        await sleep(550); if (!alive) return;
        play = playableTiles(bh, ends().l, ends().r);
      }
      if (play.length === 0) { // דילוג
        passRef.current += 1;
        if (passRef.current >= 2) { endBlocked(); return; }
        setTurn('me'); setMessage('אין ל' + botName + ' מהלך — תורך');
        return;
      }
      // בחירת אבן: קל=אקראי, אחרת=הכי הרבה נקודות (להיפטר), קשה מעדיף כפולות
      const diff = G.current.difficulty;
      let pick;
      if (diff === 1) pick = play[Math.floor(Math.random() * play.length)];
      else {
        const sorted = play.slice().sort((a, b) => {
          if (diff >= 3) { const da = a.a === a.b, db = b.a === b.b; if (da !== db) return da ? -1 : 1; }
          return (b.a + b.b) - (a.a + a.b);
        });
        pick = sorted[0];
      }
      const e = ends();
      const okR = fitsEnd(pick, e.r), okL = fitsEnd(pick, e.l);
      const side = okR ? 'r' : 'l';
      ln = placeOnLine(ln, pick, side);
      bh = bh.filter((t) => t.id !== pick.id);
      setLine(ln.slice()); setBotHand(bh.slice()); setLastSide(side);
      playSound('step'); scrollChain(side);
      await sleep(120); if (!alive) return;
      afterPlay('bot', bh, ln, bone);
    })();
    return () => { alive = false; };
  }, [turn, phase]); // eslint-disable-line

  // ---- derived UI ----
  const myPlayable = phase === 'playing' && turn === 'me' ? playableTiles(hand, leftEnd, rightEnd) : [];
  const myPlayableIds = new Set(myPlayable.map((t) => t.id));
  const mustDraw = phase === 'playing' && turn === 'me' && myPlayable.length === 0;
  const oi = openerKey ? Math.max(0, line.findIndex((t) => keyOf(t) === openerKey)) : 0;
  const snake = buildSnake2(line, perRow, oi);
  snakeDimsRef.current = { w: snake.w, h: snake.h };
  const newestLi = lastSide === 'l' ? 0 : line.length - 1;
  const newestKey = line.length ? keyOf(line[newestLi]) : '';

  // ============================== RENDER ==============================
  if (phase === 'setup') {
    return <SetupScreen onBack={onBack} onHome={onHome} onStart={startGame} onGoOnline={onGoOnline} />;
  }

  const css = `
  .dm-scene{position:absolute;inset:0;display:flex;flex-direction:column;direction:rtl;font-family:Heebo,Arial,sans-serif;overflow:hidden;
    background:radial-gradient(ellipse 75% 85% at 50% 42%,#3fa06f 0%,#218a59 42%,#136441 74%,#0e4a31 100%);box-shadow:inset 0 0 70px rgba(0,0,0,.6)}
  .dm-top{display:flex;align-items:center;gap:8px;padding:6px 10px;color:#f4e3b2}
  .dm-iconbtn{width:34px;height:34px;border-radius:50%;border:2px solid #0f3f28;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;flex:none}
  .dm-title{font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#f4e3b2;text-shadow:0 2px 4px rgba(0,0,0,.6)}
  .dm-score{font-size:14px;font-weight:bold;color:#eaf6ef;text-shadow:0 1px 2px rgba(0,0,0,.5)}
  .dm-side{position:absolute;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:4px;z-index:6;width:64px;pointer-events:none}
  .dm-side-bot{inset-inline-start:8px}
  .dm-side-me{inset-inline-end:8px}
  .dm-side-av{border-radius:50%;padding:2px;transition:box-shadow .2s}
  .dm-side.on .dm-side-av{box-shadow:0 0 0 3px #f1c95c,0 0 14px rgba(241,201,92,.75)}
  .dm-side-name{font-size:13px;font-weight:800;color:#eaf6ef;text-shadow:0 1px 2px rgba(0,0,0,.55);text-align:center;line-height:1.1}
  .dm-side-count{font-size:11px;font-weight:800;color:#0e3a26;background:#f4e3b2;border-radius:999px;padding:1px 9px}
  .dm-side-tiles{display:flex;flex-direction:column;gap:3px;margin-top:3px}
  .dm-back.sm{width:34px;height:20px}
  .dm-chainwrap{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:8px 78px}
  .dm-chain{position:relative;direction:ltr;transform-origin:center center}
  .dm-hand{display:flex;justify-content:center;align-items:flex-end;gap:9px;padding:4px 10px 12px;min-height:0}
  .dm-status{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);background:rgba(15,28,42,.82);color:#fff;font-size:13px;font-weight:700;padding:5px 16px;border-radius:999px;white-space:nowrap;z-index:8}
  .dm-actbtn{border:none;cursor:pointer;font-family:inherit;font-weight:bold;color:#3a2a08;padding:10px 18px;border-radius:13px;background:linear-gradient(#ecca7e,#c99f44);box-shadow:0 4px 0 #8a6a22,0 9px 13px rgba(0,0,0,.4);font-size:15px}
  .dm-tile{position:relative;display:flex;border-radius:6px;background:linear-gradient(160deg,#fcf8ee,#f2ead7);border:1px solid #cdbf9f;overflow:hidden;box-sizing:border-box;flex:none}
  .dm-tile.h{flex-direction:row}
  .dm-tile.v{flex-direction:column}
  .dm-chain .dm-tile{width:62px;height:31px;box-shadow:0 4px 0 #b0a586,0 9px 11px rgba(0,0,0,.45),inset 0 1px 2px rgba(255,255,255,.9),inset 0 -2px 3px rgba(0,0,0,.12)}
  .dm-hand .dm-tile{width:42px;height:84px;box-shadow:0 6px 0 #b0a586,0 12px 15px rgba(0,0,0,.5),inset 0 1px 2px #fff,inset 0 -2px 4px rgba(0,0,0,.12);transition:transform .15s}
  .dm-half{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr)}
  .dm-tile.h .dm-half{width:50%;height:100%}
  .dm-tile.v .dm-half{width:100%;height:50%}
  .dm-tile.h .dm-half:first-child{border-right:1.4px solid rgba(50,40,25,.42)}
  .dm-tile.v .dm-half:first-child{border-bottom:1.4px solid rgba(50,40,25,.42)}
  .dm-half>span{display:flex;align-items:center;justify-content:center}
  .dm-pip{flex:0 0 auto;border-radius:50%;background:radial-gradient(circle at 38% 32%,#636363,#0a0a0a 78%);box-shadow:inset 0 1px 1px rgba(0,0,0,.9),inset 0 -1px 1px rgba(255,255,255,.22)}
  .dm-chain .dm-pip{width:6px;height:6px}
  .dm-hand .dm-pip{width:9px;height:9px}
  .dm-hand .dm-tile.play{cursor:pointer;transform:translateY(-9px);box-shadow:0 6px 0 #b0a586,0 14px 17px rgba(0,0,0,.5),0 0 0 2.5px #f1c95c,0 0 14px rgba(241,201,92,.6),inset 0 1px 2px #fff}
  .dm-hand .dm-tile.dim{opacity:.5}
  @keyframes dm-drop{0%{opacity:0;transform:translateY(-30px) scale(1.10)}65%{opacity:1}100%{opacity:1;transform:translateY(0) scale(1)}}
  .dm-tile.drop{animation:dm-drop .34s cubic-bezier(.22,1.15,.36,1)}
  .dm-tile.last{filter:drop-shadow(0 0 5px rgba(241,201,92,.95)) drop-shadow(0 0 2px rgba(241,201,92,.9));z-index:3}
  .dm-back{position:relative;display:flex;align-items:center;justify-content:center;width:42px;height:26px;border-radius:5px;background:linear-gradient(152deg,#114730,#0a2c1d);border:1px solid #c9a24a;box-shadow:0 4px 0 #06231a,0 9px 11px rgba(0,0,0,.45)}
  .dm-back i{width:12px;height:12px;background:#c9a24a;opacity:.6;transform:rotate(45deg);border-radius:2px}
  .dm-bone{display:flex;align-items:center;gap:6px}
  .dm-bonestack{position:relative;width:46px;height:30px}
  .dm-bonestack .dm-back{position:absolute}
  `;

  const gameInner = (
    <div className="dm-scene">
      <style>{css}</style>

      <div className="dm-top">
        <button className="dm-iconbtn" onClick={() => setConfirmLeave(true)} aria-label="יציאה">
          <span style={{ fontSize: 16, fontWeight: 900, color: '#1c1c1c' }}>✕</span>
        </button>
        <div className="dm-title">דומינו</div>
        <div style={{ flex: 1 }} />
        {/* בריכה */}
        <div className="dm-bone">
          <div className="dm-bonestack">
            {Array.from({ length: Math.min(4, boneyard.length) }).map((_, i) => (
              <div key={i} className="dm-back" style={{ transform: `translate(${i * 2}px, ${-i * 3}px)`, width: 44, height: 26 }}><i /></div>
            ))}
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#eaf6ef' }}>{boneyard.length}</span>
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMusicMenu((o) => !o)} className="dm-iconbtn" aria-label="מוזיקה" style={{ background: '#0f3f28', borderColor: '#0a2c1d' }}>
            <IcMusic size={18} color="#f4e3b2" />
          </button>
          {musicMenu && (
            <>
              <div onClick={() => setMusicMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
              <div style={{ position: 'absolute', top: '112%', insetInlineEnd: 0, background: 'rgba(15,28,42,.97)', border: '1px solid rgba(255,255,255,.22)', borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', gap: 4, whiteSpace: 'nowrap', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,.45)', minWidth: 184 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 8px' }}>
                  <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>עוצמה</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={volDown} aria-label="החלש" style={dmVolBtn}>−</button>
                    <button onClick={volUp} aria-label="הגבר" style={dmVolBtn}>+</button>
                  </div>
                </div>
                <button onClick={nextTrack} style={dmMenuItem}><IcNext size={16} color="#fff" /> השיר הבא</button>
                <button onClick={toggleMusic} style={dmMenuItem}>{musicOn ? <IcMusicOff size={16} color="#fff" /> : <IcMusic size={16} color="#fff" />} {musicOn ? 'השתקת מוזיקה' : 'הפעלת מוזיקה'}</button>
                <button onClick={() => { const m = !muted; setMuted(m); setMutedState(m); }} style={dmMenuItem}>{muted ? <IcSoundOff size={16} color="#fff" /> : <IcSound size={16} color="#fff" />} {muted ? 'הפעלת סאונד' : 'השתקת סאונד'}</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* שחקנים בצדדים (יש מקום פנוי בצדדים בלרוחב) */}
      <div className={'dm-side dm-side-bot' + (phase === 'playing' && turn === 'bot' ? ' on' : '')}>
        <div className="dm-side-av"><Avatar name={botName} size={44} /></div>
        <span className="dm-side-name">{botName}</span>
        <span className="dm-side-count">{botHand.length} אבנים</span>
        <div className="dm-side-tiles">
          {Array.from({ length: Math.min(5, botHand.length) }).map((_, i) => <div key={i} className="dm-back sm"><i /></div>)}
        </div>
      </div>
      <div className={'dm-side dm-side-me' + (phase === 'playing' && turn === 'me' ? ' on' : '')}>
        <div className="dm-side-av"><Avatar name={myName} size={44} /></div>
        <span className="dm-side-name">{myName}</span>
        <span className="dm-side-count">{hand.length} אבנים</span>
      </div>

      {/* שרשרת מתפתלת (נחש) + זום אוטומטי */}
      <div className="dm-chainwrap" ref={chainRef}>
        <div className="dm-chain" ref={chainInnerRef} style={{ width: snake.w, height: snake.h, transform: `scale(${fitScale})` }}>
          {snake.placed.map((p) => {
            const k = keyOf(p.t);
            return (
            <DTile
              key={k}
              a={p.dir === 'L' ? p.t.b : p.t.a}
              b={p.dir === 'L' ? p.t.a : p.t.b}
              vertical={p.dir === 'D'}
              cls={k === newestKey ? 'drop last' : ''}
              style={{ position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h }}
            />
            );
          })}
        </div>
      </div>

      {/* סטטוס */}
      <div className="dm-status">{message}</div>

      {/* בחירת קצה */}
      {pending && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }} onClick={() => setPending(null)}>
          <div style={{ background: '#f6efdf', border: '3px solid #1c1c1c', borderRadius: 16, padding: 20, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 12, color: '#1c1c1c' }}>לאיזה צד להניח?</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="dm-actbtn" onClick={() => doPlay(pending, 'r')}>צד ימין ({rightEnd})</button>
              <button className="dm-actbtn" onClick={() => doPlay(pending, 'l')}>צד שמאל ({leftEnd})</button>
            </div>
          </div>
        </div>
      )}

      {/* היד שלי */}
      <div className="dm-hand">
        {hand.map((t) => {
          const playable = myPlayableIds.has(t.id);
          return <DTile key={t.id} a={t.a} b={t.b} vertical onClick={() => tapTile(t)} cls={turn === 'me' && phase === 'playing' ? (playable ? 'play' : 'dim') : ''} />;
        })}
      </div>

      {/* כפתור משיכה / דילוג */}
      {mustDraw && (
        <button className="dm-actbtn" style={{ position: 'absolute', bottom: 16, insetInlineStart: 16, zIndex: 9 }} onClick={boneyard.length > 0 ? drawForMe : passMe}>
          {boneyard.length > 0 ? 'משיכה מהבריכה (' + boneyard.length + ')' : 'דילוג'}
        </button>
      )}

      {/* סיום */}
      {phase === 'gameover' && winner && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(20,30,25,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#f6efdf', border: '3px solid #1c1c1c', borderRadius: 18, padding: '26px 30px', textAlign: 'center', width: 'min(90vw,380px)' }}>
            <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}><GameIcon id="trophy" size={48} /></div>
            <div style={{ fontWeight: 900, fontSize: 26, color: '#1c1c1c', margin: '6px 0' }}>{winner === 'me' ? myName + ' ניצח!' : botName + ' ניצח'}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#444', marginBottom: 16 }}>{message}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="dm-actbtn" style={{ flex: 1 }} onClick={() => startGame(difficulty)}>משחק חדש</button>
              <button className="dm-actbtn" style={{ flex: 1, background: '#fff' }} onClick={onExit || onBack}>חזרה לזירה</button>
            </div>
          </div>
        </div>
      )}

      <audio ref={audioRef} src={MUSIC_TRACKS[trackIdx]} onEnded={nextTrack} onCanPlay={() => { if (musicOn) audioRef.current?.play().catch(() => {}); }} style={{ display: 'none' }} />
    </div>
  );

  const leaveModal = confirmLeave ? (
    <LeaveConfirmModal title="לעזוב את המשחק?" subtitle="המשחק הנוכחי יסתיים" stayLabel="לא, להישאר" leaveLabel="כן, לעזוב"
      onStay={() => setConfirmLeave(false)} onLeave={() => { setConfirmLeave(false); (onExit || onBack)(); }} />
  ) : null;

  if (isPortrait) {
    return (
      <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: '100vh', height: '100vw', transform: 'translate(-50%,-50%) rotate(90deg)', transformOrigin: 'center center' }}>
            {gameInner}
          </div>
        </div>
        {leaveModal}
      </>
    );
  }
  return (<>{gameInner}{leaveModal}</>);
}

// ============================================================================
function SetupScreen({ onBack, onHome, onStart, onGoOnline }) {
  const Diff = ({ n, label, sub }) => (
    <button onClick={() => onStart(n)} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%',
      background: '#fff', border: '2px solid #1f6a45', borderRadius: 16, padding: '14px 18px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right',
    }}>
      <span style={{ fontWeight: 800, fontSize: 18, color: '#14512f' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#557' }}>{sub}</span>
    </button>
  );
  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">דומינו</div>
      </div>
      <div style={{ padding: '8px 20px 32px' }}>
        <div style={{ background: 'linear-gradient(135deg,#218a59,#136441)', borderRadius: 20, padding: '20px 18px', color: '#FBF7EE', marginBottom: 24, textAlign: 'center', boxShadow: '0 8px 20px -6px rgba(19,100,65,.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}><GameIcon id="domino" size={52} /></div>
          <div className="h-display" style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 6 }}>דומינו</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.92)' }}>מי שמסיים את כל האבנים ראשון — מנצח</div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#14512f', marginBottom: 10 }}>נגד המחשב · בחר רמת קושי</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Diff n={1} label="קל" sub="המחשב משחק אקראית" />
          <Diff n={2} label="בינוני" sub="המחשב נפטר מאבנים גבוהות" />
          <Diff n={3} label="קשה" sub="המחשב משחק חכם, מעדיף כפולות" />
        </div>
        {onGoOnline && (
          <>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#14512f', margin: '22px 0 10px' }}>אונליין · נגד אנשים אמיתיים</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => onGoOnline('online-random')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%', background: '#fff', border: '2px solid #1f6a45', borderRadius: 16, padding: '14px 18px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}>
                <span style={{ fontWeight: 800, fontSize: 18, color: '#14512f' }}>שחקן רנדומלי</span>
                <span style={{ fontSize: 13, color: '#557' }}>נתחבר אתכם לשחקנים אחרים</span>
              </button>
              <button onClick={() => onGoOnline('online-friend')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%', background: '#fff', border: '2px solid #1f6a45', borderRadius: 16, padding: '14px 18px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}>
                <span style={{ fontWeight: 800, fontSize: 18, color: '#14512f' }}>שחק עם חבר</span>
                <span style={{ fontSize: 13, color: '#557' }}>הזמינו עד 3 חברים לשולחן</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
