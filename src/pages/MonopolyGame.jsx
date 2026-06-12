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
import { TILES, TILE_COUNT, RULES, TOKEN_COLORS, GROUPS, ownsFullGroup, rentFor } from '../data/monopolyBoard';
import { flagSVG } from '../data/monopolyFlags';

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

  // refs mirror state for the async engine
  const S = useRef({});
  S.current = { phase, players, owners, hotels, turnIdx, round };

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
    setWinner(null); setCard(null); setFocusTiles(null);
    setMessage('התור של ' + ps[0].name + ' - הטל קוביות!');
    setPhase('idle');
  }

  // ---- engine: turn flow ----
  const updatePlayer = (uid, patch) =>
    setPlayers((ps) => ps.map((p) => (p.uid === uid ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p)));

  async function rollAndWalk() {
    const { players: ps, turnIdx: ti } = S.current;
    const p = ps[ti];
    if (!p || S.current.phase !== 'idle') return;

    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    setDice([d1, d2]);
    setPhase('walking');
    setMessage(p.name + ' הטיל ' + (d1 + d2) + ' - צועדים!');
    await sleep(700);

    await walkSteps(p.uid, d1 + d2);
    await sleep(350);
    await landOn(p.uid);
  }

  async function walkSteps(uid, steps) {
    for (let i = 0; i < steps; i++) {
      let newPos = 0;
      setPlayers((ps) => ps.map((pl) => {
        if (pl.uid !== uid) return pl;
        newPos = (pl.pos + 1) % TILE_COUNT;
        const bonus = newPos === 0 ? RULES.PASS_START_BONUS : 0;
        return { ...pl, pos: newPos, cash: pl.cash + bonus };
      }));
      setFocusTiles(focusWindow(newPos));
      await sleep(480);
    }
  }

  async function walkBack(uid, steps) {
    for (let i = 0; i < steps; i++) {
      let newPos = 0;
      setPlayers((ps) => ps.map((pl) => {
        if (pl.uid !== uid) return pl;
        newPos = (pl.pos - 1 + TILE_COUNT) % TILE_COUNT;
        return { ...pl, pos: newPos };
      }));
      setFocusTiles(focusWindow(newPos));
      await sleep(480);
    }
  }

  async function landOn(uid) {
    await sleep(100);
    const ps = S.current.players;
    const p = ps.find((x) => x.uid === uid);
    const tile = TILES[p.pos];
    setFocusTiles(focusWindow(p.pos));

    if (tile.type === 'prop') {
      const owner = S.current.owners[tile.id];
      if (!owner) {
        setCard({ kind: 'buy', tile, uid });
      } else if (owner === uid) {
        const full = ownsFullGroup(tile, S.current.owners, uid);
        if (full && !S.current.hotels[tile.id]) {
          setCard({ kind: 'hotel', tile, uid });
        } else {
          setCard({ kind: 'info', tile, uid, text: 'נחת בשטח שלך. נעים בבית!' });
        }
      } else {
        const rent = rentFor(tile, S.current.owners, S.current.hotels);
        setCard({ kind: 'rent', tile, uid, owner, amount: rent });
      }
    } else if (tile.type === 'special') {
      if (tile.amount === 'birthday') {
        setCard({ kind: 'birthday', tile, uid });
      } else {
        setCard({ kind: 'pay', tile, uid, amount: tile.amount });
      }
    } else if (tile.type === 'lotto') {
      const c = LOTTO_CARDS[Math.floor(Math.random() * LOTTO_CARDS.length)];
      setCard({ kind: 'lotto', tile, uid, ...c });
    } else if (tile.type === 'chance') {
      const c = CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)];
      setCard({ kind: 'chance', tile, uid, ...c });
    } else {
      // corner
      if (tile.key === 'einKnisa') setCard({ kind: 'pay', tile, uid, amount: -RULES.EIN_KNISA_FINE });
      else if (tile.key === 'atzor') setCard({ kind: 'atzor', tile, uid });
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
      updatePlayer(uid, (p) => ({ cash: p.cash - c.tile.price }));
      setOwners((o) => ({ ...o, [c.tile.id]: uid }));
    }
    if (c.kind === 'hotel' && action === 'yes') {
      updatePlayer(uid, (p) => ({ cash: p.cash - c.tile.hotel }));
      setHotels((h) => ({ ...h, [c.tile.id]: true }));
    }
    if (c.kind === 'rent') {
      updatePlayer(uid, (p) => ({ cash: p.cash - c.amount }));
      updatePlayer(c.owner, (p) => ({ cash: p.cash + c.amount }));
    }
    if (c.kind === 'pay') {
      updatePlayer(uid, (p) => ({ cash: p.cash + c.amount }));
    }
    if (c.kind === 'birthday') {
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
      if (typeof c.amount === 'number') updatePlayer(uid, (p) => ({ cash: p.cash + c.amount }));
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
        setFocusTiles(focusWindow(c.goto));
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
      setPhase('gameover');
      return;
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
        if (card.kind === 'buy') action = p.cash - card.tile.price >= 300 ? 'yes' : 'no';
        if (card.kind === 'hotel') action = p.cash - card.tile.hotel >= 200 ? 'yes' : 'no';
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
    <div key={p.uid} style={{
      background: '#fff', border: isActive ? '3px solid #2f9e3f' : '1px solid #d3d1c7',
      borderRadius: 14, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8,
      opacity: p.dead ? 0.4 : 1,
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
          <div style={{ fontFamily: 'Rubik, Heebo, sans-serif', fontWeight: 900, fontSize: 34, color: '#d8402a' }}>מונופול</div>
          <div style={{ fontWeight: 800, fontSize: 19, color: INK, marginBottom: 18 }}>מסביב לעולם · נוסטלגיה משנות ה-80</div>
          <div style={{ fontWeight: 700, fontSize: 17, color: INK, marginBottom: 10 }}>נגד כמה יריבים לשחק?</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 18 }}>
            {[1, 2, 3].map((n) => (
              <button key={n} onClick={() => startGame(n)} style={{
                width: 74, height: 74, borderRadius: 16, border: `3px solid ${INK}`, background: TOKEN_COLORS[n].color,
                fontSize: 30, fontWeight: 900, color: n === 1 ? INK : '#fff', cursor: 'pointer', fontFamily: 'inherit',
              }}>{n}</button>
            ))}
          </div>
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', fontSize: 16, fontWeight: 700, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
            חזרה לזירה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#cfd3d8', direction: 'rtl', fontFamily: 'Heebo, sans-serif', overflow: 'hidden' }}>

      {isPortrait && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(28,28,28,.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#fff', textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 64 }}>🔄</div>
          <div style={{ fontWeight: 800, fontSize: 26 }}>סובבו את הטלפון לרוחב</div>
          <div style={{ fontSize: 17, opacity: 0.85 }}>מונופול משוחק לרוחב כדי שתראו את כל הלוח</div>
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'row', gap: 8, padding: 8 }}>

        {/* right panel (RTL start): me + dice */}
        <div style={{ width: 168, flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onBack} aria-label="יציאה מהמשחק" style={{ alignSelf: 'flex-start', width: 40, height: 40, borderRadius: 12, border: `2px solid ${INK}`, background: '#fff', fontSize: 19, fontWeight: 900, cursor: 'pointer', color: INK }}>✕</button>
          {players.filter((p) => !p.isBot).map((p) => panelCard(p, active?.uid === p.uid))}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          />
          <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,.94)', borderRadius: 20, padding: '5px 16px', fontWeight: 700, fontSize: 15, color: INK, whiteSpace: 'nowrap', maxWidth: '92%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            סיבוב {round}/{RULES.MAX_ROUNDS} · {message}
          </div>
        </div>

        {/* left panel: opponents */}
        <div style={{ width: 168, flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
          {players.filter((p) => p.isBot).map((p) => panelCard(p, active?.uid === p.uid))}
        </div>
      </div>

      {/* landing card */}
      {card && (
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
              <button onClick={() => setPhase('setup')} style={{ flex: 1, background: '#2f9e3f', color: '#fff', border: `2.5px solid ${INK}`, borderRadius: 12, padding: 12, fontSize: 17, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
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

  if (card.kind === 'buy') {
    sub = 'מדינה פנויה · ' + grp.label;
    buttons = isHuman ? [btn('לקנות · ' + t.price + ' ₪', 'yes', '#2f9e3f'), btn('לא עכשיו', 'no', '#fff', INK)] : null;
  } else if (card.kind === 'hotel') {
    sub = 'כל היבשת שלך! אפשר לבנות מלון - השכירות תוכפל';
    buttons = isHuman ? [btn('לבנות מלון · ' + t.hotel + ' ₪', 'yes', '#2f73c9'), btn('לא עכשיו', 'no', '#fff', INK)] : null;
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
    title = card.kind === 'lotto' ? 'לוטו' : 'צ׳אנס';
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
