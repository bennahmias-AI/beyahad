/*
  MonopolyGame.jsx
  Vintage Israeli Monopoly - playable game screen (vs computer, local).
  Landscape-only layout: side panel (you + dice) | board center | side panel (others).
  Multiplayer (Firebase) comes later as MonopolyOnline; this file holds the
  local engine + UI so the game is fully playable against bots.

  Props: onBack, onHome, profile (current user doc, optional)
*/

import { useEffect, useRef, useState } from 'react';
import MonopolyBoard from './MonopolyBoard.jsx';
import { TILES, TILE_COUNT, RULES, TOKEN_COLORS, GROUPS, MAX_LEVEL, LEVEL_NAMES, rentFor, buildCost, nextBuildLabel, randomPriceIndex, applyIndex, regionOf, REGION_LABELS } from '../data/monopolyBoard';
import { flagSVG } from '../data/monopolyFlags';
import { PropertyCard, CardsModal, CardFooter } from './MonopolyCards.jsx';
import { cardBack } from '../data/monopolyBoardArt';
import { playSound, isMuted, setMuted } from '../utils/gameSounds';

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

const BOT_NAMES = ['המחשב', 'רובי', 'חכמוני'];

// nice inline SVG icons for the setup buttons (replacing the muddy emojis)
const ICON_ROBOT = (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" style={{ flex: 'none' }}>
    <rect x="5" y="8" width="16" height="13" rx="4" fill="#fff" stroke="#1c1c1c" strokeWidth="2" />
    <circle cx="10" cy="14" r="1.9" fill="#1c1c1c" />
    <circle cx="16" cy="14" r="1.9" fill="#1c1c1c" />
    <path d="M10 18 h6" stroke="#1c1c1c" strokeWidth="2" strokeLinecap="round" />
    <path d="M13 8 V4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    <circle cx="13" cy="3" r="2" fill="#fff" stroke="#1c1c1c" strokeWidth="1.6" />
    <path d="M5 13 H2 M21 13 H24" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const ICON_FRIENDS = (
  <svg width="28" height="26" viewBox="0 0 28 26" fill="none" style={{ flex: 'none' }}>
    <circle cx="9" cy="9" r="4" fill="#f4c20d" stroke="#1c1c1c" strokeWidth="2" />
    <path d="M2 22 c0-4 3.5-6.5 7-6.5 s7 2.5 7 6.5" fill="#f4c20d" stroke="#1c1c1c" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="19" cy="10" r="3.4" fill="#2f73c9" stroke="#1c1c1c" strokeWidth="2" />
    <path d="M15 22 c0-3.5 3-5.8 6-5.8 s6 2.3 6 5.8" fill="#2f73c9" stroke="#1c1c1c" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

// ============================================================================
export default function MonopolyGame({ onBack, onHome, profile }) {
  // ---- orientation ----
  const [isPortrait, setIsPortrait] = useState(
    () => window.matchMedia('(orientation: portrait)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const fn = (e) => setIsPortrait(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
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
    try { return localStorage.getItem('beyahad_monopoly_camera') || 'zoom'; } catch { return 'zoom'; }
  }); // zoom = camera follows the token | full = whole board, token just moves
  const [priceIndex, setPriceIndex] = useState(null); // per-region % - reshuffled every round
  const [muted, setMutedState] = useState(() => isMuted());

  // refs mirror state for the async engine
  const S = useRef({});
  S.current = { phase, players, owners, hotels, turnIdx, round, cameraMode, priceIndex };

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

  async function rollAndWalk() {
    const { players: ps, turnIdx: ti } = S.current;
    const p = ps[ti];
    if (!p || S.current.phase !== 'idle') return;

    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    setDice([d1, d2]);
    playSound('dice');
    setPhase('walking');
    setMessage(p.name + ' הטיל ' + (d1 + d2) + ' - צועדים!');
    // camera travels FIRST to where the player stands, then follows each step
    focus(focusWindow(p.pos));
    await sleep(S.current.cameraMode === 'zoom' ? 950 : 400);

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
        setCard({ kind: 'rent', tile, uid, owner, amount: rent });
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
      const c = LOTTO_CARDS[Math.floor(Math.random() * LOTTO_CARDS.length)];
      setCard({ kind: 'lotto', tile, uid, ...c });
    } else if (tile.type === 'chance') {
      const c = CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)];
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
      updatePlayer(uid, (p) => ({ cash: p.cash - cost }));
      setHotels((h) => ({ ...h, [c.tile.id]: (h[c.tile.id] || 0) + 1 }));
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
        updatePlayer(uid, { pos: c.goto });
        focus(focusWindow(c.goto));
        await sleep(900);
      }
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

  // ---- derived ----
  const tokens = players.filter((p) => !p.dead).map((p) => ({ uid: p.uid, color: p.color, tileId: p.pos }));
  const tokenColors = Object.fromEntries(players.map((p) => [p.uid, p.color]));
  const active = players[turnIdx];
  const isMyTurn = active && !active.isBot && phase === 'idle';

  // ---- UI pieces ----
  const panelCard = (p, isActive) => (
    <div key={p.uid} onClick={() => setViewPlayer(p)} role="button" style={{
      background: '#fff', border: isActive ? '3px solid #2f9e3f' : '1px solid #d3d1c7',
      borderRadius: 14, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8,
      opacity: p.dead ? 0.4 : 1, cursor: 'pointer',
    }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: p.color, border: `3px solid ${INK}`, flex: 'none' }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {p.name}{p.skip > 0 ? ' (עוצר)' : ''}{p.dead ? ' - פרש' : ''}
        </div>
        <div style={{ fontWeight: 800, fontSize: 17, color: p.cash < 200 ? '#a32d2d' : '#1c4e26' }}>
          {p.cash.toLocaleString()} ₪
        </div>
      </div>
    </div>
  );

  // ============== RENDER ==============

  if (phase === 'setup') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#cfd3d8', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', fontFamily: 'Heebo, sans-serif' }}>
        <div style={{ background: CREAM, border: `3px solid ${INK}`, borderRadius: 18, padding: '26px 28px', width: 'min(92vw, 420px)', textAlign: 'center', boxShadow: '0 18px 50px rgba(0,0,0,.3)' }}>
          <div style={{ fontFamily: 'Rubik, Heebo, sans-serif', fontWeight: 900, fontSize: 34, color: '#d8402a' }}>מסביב לעולם</div>
          <div style={{ fontWeight: 800, fontSize: 19, color: INK, marginBottom: 18 }}>משחק הלוח הקלאסי - מטיילים, קונים וזוכים</div>
          {setupStep === 'mode' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              <button onClick={() => setSetupStep('bots')} style={{
                background: '#2f9e3f', color: '#fff', border: `3px solid ${INK}`, borderRadius: 14,
                padding: '15px 10px', fontSize: 20, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>{ICON_ROBOT}<span>לשחק נגד המחשב</span></button>
              <button onClick={() => setMessage('soon')} style={{
                background: '#fff', color: INK, border: `3px solid ${INK}`, borderRadius: 14,
                padding: '15px 10px', fontSize: 20, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                {ICON_FRIENDS}<span>לשחק עם חברים</span>
                <span style={{ position: 'absolute', top: -10, insetInlineStart: -8, background: '#e8761f', color: '#fff', fontSize: 12, fontWeight: 800, borderRadius: 10, padding: '2px 10px', border: `2px solid ${INK}` }}>בקרוב!</span>
              </button>
              {message === 'soon' && (
                <div style={{ fontSize: 14.5, fontWeight: 700, color: '#a35a12' }}>משחק עם חברים יגיע ממש בקרוב - בינתיים תתאמנו על המחשב 😊</div>
              )}
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: 17, color: INK, marginBottom: 10 }}>נגד כמה יריבים לשחק?</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 12 }}>
                {[1, 2, 3].map((n) => (
                  <button key={n} onClick={() => startGame(n)} style={{
                    width: 74, height: 74, borderRadius: 16, border: `3px solid ${INK}`, background: TOKEN_COLORS[n].color,
                    fontSize: 30, fontWeight: 900, color: n === 1 ? INK : '#fff', cursor: 'pointer', fontFamily: 'inherit',
                  }}>{n}</button>
                ))}
              </div>
              <button onClick={() => setSetupStep('mode')} style={{ background: 'transparent', border: 'none', fontSize: 15, fontWeight: 700, color: '#555', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>→ חזרה</button>
            </>
          )}
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', fontSize: 16, fontWeight: 700, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
            חזרה לזירה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'linear-gradient(160deg, #2f6ea0 0%, #1d557f 55%, #14405f 100%)', direction: 'rtl', fontFamily: 'Heebo, sans-serif', overflow: 'hidden' }}>

      {isPortrait && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(28,28,28,.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#fff', textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 64 }}>🔄</div>
          <div style={{ fontWeight: 800, fontSize: 26 }}>סובבו את הטלפון לרוחב</div>
          <div style={{ fontSize: 17, opacity: 0.85 }}>המשחק משוחק לרוחב כדי שתראו את כל הלוח</div>
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'row', gap: 8, padding: 8 }}>

        {/* right panel (RTL start): me + dice */}
        <div style={{ width: 168, flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onBack} aria-label="יציאה מהמשחק" style={{ alignSelf: 'flex-start', width: 40, height: 40, borderRadius: 12, border: `2px solid ${INK}`, background: '#fff', fontSize: 19, fontWeight: 900, cursor: 'pointer', color: INK }}>✕</button>
          {players.filter((p) => !p.isBot).map((p) => panelCard(p, active?.uid === p.uid))}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => {
                const m = cameraMode === 'zoom' ? 'full' : 'zoom';
                setCameraMode(m);
                try { localStorage.setItem('beyahad_monopoly_camera', m); } catch { /* ignore */ }
                if (m === 'full') setFocusTiles(null);
              }}
              style={{ background: '#fff', border: `2px solid ${INK}`, borderRadius: 12, padding: '8px 6px', fontSize: 14, fontWeight: 700, color: INK, cursor: 'pointer', fontFamily: 'inherit' }}>
              {cameraMode === 'zoom' ? '🎥 מצלמה עוקבת' : '🗺️ לוח מלא'}
            </button>
            <button
              onClick={() => { const m = !muted; setMuted(m); setMutedState(m); if (!m) playSound('step'); }}
              style={{ background: '#fff', border: `2px solid ${INK}`, borderRadius: 12, padding: '8px 6px', fontSize: 14, fontWeight: 700, color: INK, cursor: 'pointer', fontFamily: 'inherit' }}>
              {muted ? '🔇 צלילים כבויים' : '🔊 צלילים פועלים'}
            </button>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {[0, 1].map((i) => (
                <div key={i} style={{ width: 46, height: 46, borderRadius: 10, background: '#fff', border: `2.5px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 24, color: INK }}>
                  {dice[i] ?? '·'}
                </div>
              ))}
            </div>
            <button
              onClick={rollAndWalk}
              disabled={!isMyTurn}
              style={{
                background: isMyTurn ? '#f4c20d' : '#d9d4c2', border: `3px solid ${INK}`, borderRadius: 14,
                padding: '13px 6px', fontSize: 18, fontWeight: 800, color: INK, cursor: isMyTurn ? 'pointer' : 'default',
                fontFamily: 'inherit', opacity: isMyTurn ? 1 : 0.6,
              }}>
              🎲 הטלת קוביות
            </button>
          </div>
        </div>

        {/* board center */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <MonopolyBoard
            focusTiles={focusTiles}
            tokens={tokens}
            owners={owners}
            hotels={hotels}
            tokenColors={tokenColors}
            priceIndex={priceIndex}
          />
        </div>

        {/* left panel: opponents */}
        <div style={{ width: 168, flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
          {players.filter((p) => p.isBot).map((p) => panelCard(p, active?.uid === p.uid))}
        </div>
      </div>

      {/* player cards modal */}
      {viewPlayer && (
        <CardsModal player={viewPlayer} players={players} owners={owners} hotels={hotels} onClose={() => setViewPlayer(null)} />
      )}

      {/* lotto / chance: flip-card animation (a card rises from the deck,
          flips to reveal, then flips back) - real-Monopoly feel */}
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
            <div style={{ fontSize: 50 }}>🏆</div>
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
      sideTitle = 'מדינה פנויה';
      sideSub = grp.label + (pct ? ' · מדד ' + (pct > 0 ? '+' : '') + pct + '%' : '');
      actions = [btn('לקנות · ' + eff + ' ₪', 'yes', '#2f9e3f'), btn('לא עכשיו', 'no', '#fff', INK)];
    } else if (card.kind === 'hotel') {
      hl = card.level + 1;
      const cost = buildCost(t, card.level);
      const what = nextBuildLabel(card.level);
      sideTitle = 'המדינה שלך!';
      sideSub = 'השכירות תעלה ל-' + t.rents[hl] + ' ₪';
      actions = [btn('לבנות ' + what + ' · ' + cost + ' ₪', 'yes', '#2f73c9'), btn('לא עכשיו', 'no', '#fff', INK)];
    } else {
      hl = Math.max(0, t.rents.indexOf(card.amount));
      sideTitle = 'המדינה של ' + (ownerP?.name || '');
      sideSub = 'תשלום שכירות';
      actions = [btn('לשלם ' + card.amount + ' ₪', 'ok', '#d8402a')];
    }
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(28,28,28,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl' }}>
        <div style={{ background: CREAM, border: `3px solid ${INK}`, borderRadius: 18, padding: '14px 18px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16, boxShadow: '0 18px 50px rgba(0,0,0,.4)', maxWidth: '94vw' }}>
          <PropertyCard tile={t} level={hl} width={172} footer={card.kind === 'buy' ? <CardFooter color="#1c4e26">מחיר {card.price ?? t.price} ₪</CardFooter> : null} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 190, maxWidth: 230, textAlign: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: 23, color: INK, lineHeight: 1.05 }}>{sideTitle}</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#3a3a3a' }}>{sideSub}</div>
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
    if (stage !== 'reveal' || isHuman) return;
    const t = setTimeout(() => setStage('return'), 1700);
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
