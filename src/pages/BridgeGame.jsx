/*
  BridgeGame.jsx
  ברידג' — שלב א': מיני-ברידג' נגד המחשב (מקומי).

  מיני-ברידג' = הגרסה הרשמית ללימוד ברידג', בלי שלב ההכרזות (המכרז):
    1. מחלקים 13 קלפים לכל אחד מ-4 המושבים.
    2. סופרים נקודות גבוהות (A=4 K=3 Q=2 J=1). לזוג עם יותר נקודות - הכרוז.
    3. יד השותף של הכרוז נחשפת על השולחן ("הדומם").
    4. הכרוז בוחר שליט (או "בלי שליט") ומקבל יעד לקיחות לפי הנקודות המשותפות.
    5. משחקים 13 לקיחות רגילות - חובה לשרת בסוג הקלף שהובל.

  הקלה מכוונת ל-UX: כשהזוג שלנו מכריז, השחקן האנושי הוא תמיד הכרוז,
  כדי שלא ייתקע כדומם בלי מה לעשות. הוא משחק גם את קלפי הדומם, כמו בברידג' אמיתי.

  מושבים: 0=דרום (אתם, למטה) · 1=מערב (שמאל) · 2=צפון (השותף, למעלה) · 3=מזרח (ימין)
  סדר המשחק עם כיוון השעון: דרום -> מערב -> צפון -> מזרח.
  זוגות: {0,2} = אנחנו · {1,3} = היריבים.

  Props: onBack, onHome, profile
*/

import { useEffect, useRef, useState } from 'react';
import { playSound } from '../utils/gameSounds';
import { useGameMusic, GameMusicButton } from '../hooks/useGameMusic.jsx';
import { IconBackRTL } from '../icons/index.jsx';
import HomeButton from '../components/HomeButton.jsx';
import { GameIcon } from '../icons/gameIcons.jsx';
import LeaveConfirmModal from '../components/LeaveConfirmModal.jsx';
import BridgeOnline from './BridgeOnline.jsx';

// ── קבועים של חפיסת הקלפים ────────────────────────────────
const SUIT_CHAR = ['♣', '♦', '♥', '♠'];              // 0=תלתן 1=יהלום 2=לב 3=עלה
const SUIT_NAME = ['תלתן', 'יהלום', 'לב', 'עלה'];
const RED_SUITS = [1, 2];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const NT = 4;                                          // "בלי שליט"

const rankLabel = (r) => RANK_LABEL[r] || String(r);
const isRed = (s) => RED_SUITS.includes(s);
const cardKey = (c) => `${c.s}-${c.r}`;

// ── מושבים ────────────────────────────────────────────────
const SOUTH = 0, WEST = 1, NORTH = 2, EAST = 3;
const nextSeat = (i) => (i + 1) % 4;
const partnerOf = (i) => (i + 2) % 4;
const sameSide = (a, b) => a % 2 === b % 2;
const isOurSide = (i) => i % 2 === 0;                   // 0 ו-2 = הזוג שלנו

// שמות הבוטים - לעולם לא "המחשב"
const PARTNER_NAMES = ['רותי', 'שרה', 'מרים', 'אסתר'];
const RIVAL_NAMES = ['משה', 'דוד', 'יעקב', 'אבנר', 'חיים', 'רפי'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── מוזיקת רקע ─────────────────────────────────
// זהה בהתנהגות לשאר המשחקים: דלוקה כברירת מחדל, עוצמה נשמרת,
// מעבר אוטומטי לשיר הבא, ו"בעיטה" במגע הראשון (דפדפנים חוסמים ניגון אוטומטי).
const MUSIC_HOOK_MOVED = true; // ההוק והכפתור עברו ל-hooks/useGameMusic.js (משותף עם האונליין)

// ── חלוקה וספירת נקודות ───────────────────────────────────
function freshDeal() {
  const deck = [];
  for (let s = 0; s < 4; s++) for (const r of RANKS) deck.push({ s, r });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const hands = [[], [], [], []];
  deck.forEach((c, i) => hands[i % 4].push(c));
  return hands.map(sortHand);
}

// מיון יד: לפי סוג (עלה, לב, יהלום, תלתן), ובתוך כל סוג מהגבוה לנמוך
function sortHand(hand) {
  return [...hand].sort((a, b) => (b.s - a.s) || (b.r - a.r));
}

const HCP_VALUE = { 14: 4, 13: 3, 12: 2, 11: 1 };
const handHcp = (hand) => hand.reduce((sum, c) => sum + (HCP_VALUE[c.r] || 0), 0);

// ── חוקי משחק ─────────────────────────────────────────────
// אילו קלפים מותר לשחק: חובה לשרת בסוג שהובל אם יש
function legalCards(hand, trick) {
  if (!trick.length) return hand;
  const led = trick[0].card.s;
  const inSuit = hand.filter(c => c.s === led);
  return inSuit.length ? inSuit : hand;
}

// מי מוביל בלקיחה (חלקית או מלאה)
function trickLeader(trick, trump) {
  let best = trick[0];
  for (const play of trick.slice(1)) {
    const c = play.card, b = best.card;
    if (trump !== NT && c.s === trump && b.s !== trump) best = play;
    else if (c.s === b.s && c.r > b.r) best = play;
  }
  return best;
}

// האם קלף a מנצח את קלף b (בהינתן הסוג שהובל)
function beats(a, b, trump, led) {
  if (trump !== NT) {
    if (a.s === trump && b.s !== trump) return true;
    if (b.s === trump && a.s !== trump) return false;
  }
  if (a.s !== b.s) return a.s === led;    // קלף שלא בסוג שהובל אף פעם לא מנצח
  return a.r > b.r;
}

// ── יעד הלקיחות לפי נקודות משותפות ────────────────────────
// 26+ נקודות = משחק מלא · אחרת חוזה חלקי (7 לקיחות)
function targetTricks(combinedHcp, trump) {
  if (combinedHcp < 26) return 7;
  if (trump === NT) return 9;
  if (trump === 3 || trump === 2) return 10;   // עלה / לב - סוגים ראשיים
  return 11;                                    // יהלום / תלתן
}
const contractLabel = (trump, target) =>
  `${target - 6}${trump === NT ? ' ללא שליט' : SUIT_CHAR[trump]}`;

// ── בינה מלאכותית פשוטה לבוטים ────────────────────────────
function aiChooseCard(hand, trick, trump, seat) {
  const legal = legalCards(hand, trick);
  if (legal.length === 1) return legal[0];
  const lowest = (arr) => arr.reduce((m, c) => (c.r < m.r ? c : m), arr[0]);

  // פתיחת לקיחה - מובילים
  if (!trick.length) {
    const aces = legal.filter(c => c.r === 14 && c.s !== trump);
    if (aces.length) return pick(aces);
    const bySuit = {};
    legal.forEach(c => { (bySuit[c.s] = bySuit[c.s] || []).push(c); });
    const longest = Object.values(bySuit).sort((a, b) => b.length - a.length)[0];
    return lowest(longest);
  }

  const led = trick[0].card.s;
  const leader = trickLeader(trick, trump);
  // אם השותף כבר מוביל בלקיחה - לא מבזבזים קלף גבוה
  if (sameSide(leader.seat, seat)) return lowest(legal);
  // מנסים לנצח בזול ביותר
  const winners = legal.filter(c => beats(c, leader.card, trump, led));
  if (winners.length) return lowest(winners);
  // אי אפשר לנצח - משליכים נמוך, ומעדיפים לא לבזבז שליט
  const nonTrump = legal.filter(c => c.s !== trump);
  return lowest(nonTrump.length ? nonTrump : legal);
}

// בחירת חוזה אוטומטית לכרוז ממוחשב - הסוג המשותף הארוך ביותר
function aiChooseTrump(declarerHand, dummyHand) {
  const counts = [0, 0, 0, 0];
  [...declarerHand, ...dummyHand].forEach(c => { counts[c.s]++; });
  let best = 0;
  for (let s = 1; s < 4; s++) if (counts[s] > counts[best]) best = s;
  return counts[best] >= 8 ? best : NT;   // פחות מ-8 קלפים משותפים = בלי שליט
}

// ═══════════════════════════════════════════════════════════
// עוטף ראשי - מסך בחירת מצב
// ═══════════════════════════════════════════════════════════
export default function BridgeGame({ onBack, onHome, profile, initialRoomId = null, autoInviteFriend = null }) {
  const [mode, setMode] = useState(
    initialRoomId ? 'online-random' : (autoInviteFriend ? 'online-friends' : null)
  );

  if (!mode) {
    return (
      <BridgeModeSelect
        onBack={onBack} onHome={onHome}
        onSelectAI={() => setMode('ai')}
        onSelectOnline={() => setMode('online-random')}
        onSelectFriends={() => setMode('online-friends')}
      />
    );
  }
  if (mode === 'online-random' || mode === 'online-friends') {
    return (
      <BridgeOnline
        initialRoomId={initialRoomId}
        friendsMode={mode === 'online-friends'}
        autoInviteFriend={autoInviteFriend}
        onBack={autoInviteFriend || initialRoomId ? onBack : () => setMode(null)}
        onHome={onHome}
      />
    );
  }
  return <BridgeLocal onBack={() => setMode(null)} onHome={onHome} profile={profile} />;
}

// ── מסך בחירת מצב ─────────────────────────────────────────
function BridgeModeSelect({ onBack, onHome, onSelectAI, onSelectOnline, onSelectFriends }) {
  const [howOpen, setHowOpen] = useState(false);
  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">הברידג' של קלרה</div>
      </div>
      <div style={{ padding: '8px 20px 32px' }}>
        <div style={{ background: 'linear-gradient(135deg,#2E6B45,#1d4a2e)', borderRadius: 20, padding: '20px 18px', color: '#FBF7EE', marginBottom: 22, boxShadow: '0 8px 20px -6px rgba(29,74,46,.5)', textAlign: 'center' }}>
          <div style={{ fontSize: 40, letterSpacing: 2, marginBottom: 4 }}>
            <span style={{ color: '#FBF7EE' }}>♠</span>
            <span style={{ color: '#E8884F' }}>♥</span>
            <span style={{ color: '#E8884F' }}>♦</span>
            <span style={{ color: '#FBF7EE' }}>♣</span>
          </div>
          <div className="h-display" style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 6 }}>הברידג' של קלרה</div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'rgba(255,255,255,.92)' }}>
            משחק הקלפים הקלאסי - אתם והשותף מול שני יריבים
          </div>
        </div>

        <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--ink)' }}>בחרו איך לשחק:</h2>
        <BrModeButton onClick={onSelectOnline} iconId="online-random" gradient="linear-gradient(135deg,#7E2C2E,#5A1D1E)"
          label="שחקן רנדומלי" description="שחקו עם אנשים אחרים באפליקציה" />
        <BrModeButton onClick={onSelectFriends} iconId="online-friend" gradient="linear-gradient(135deg,#4F6B4A,#354D31)"
          label="שחק עם חברים" description="הזמינו חברים מהרשימה שלכם" />
        <BrModeButton onClick={onSelectAI} iconId="vs-ai" gradient="linear-gradient(135deg,#2C5566,#173846)"
          label="נגד המחשב" description="אתם והשותף מול שני יריבים" />
        <BrModeButton onClick={() => setHowOpen(true)} iconId="level-easy" gradient="linear-gradient(135deg,#96742E,#6b5220)"
          label="איך משחקים?" description="הסבר קצר בעברית פשוטה" />

        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px', marginTop: 18, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--ink)' }}>בשולחן האונליין:</strong> מושבים שנשארו פנויים מתמלאים בשחקני מחשב, כך שאפשר להתחיל גם בשניים.
        </div>
      </div>

      {howOpen && <HowToPlayModal onClose={() => setHowOpen(false)} />}
    </div>
  );
}

function BrModeButton({ onClick, iconId, gradient, label, description }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'right',
      background: gradient, border: 'none', borderRadius: 18, padding: '16px 18px',
      marginBottom: 12, color: '#FBF7EE', fontFamily: 'inherit', cursor: 'pointer',
      boxShadow: '0 6px 16px -6px rgba(0,0,0,.35)', minHeight: 'unset',
    }}>
      <GameIcon id={iconId} size={40} />
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: 19, fontWeight: 800 }}>{label}</span>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,.85)', marginTop: 2 }}>{description}</span>
      </span>
    </button>
  );
}

// ── הסבר קצר ──────────────────────────────────────────────
function HowToPlayModal({ onClose }) {
  const items = [
    ['השולחן', 'ארבעה מושבים, שני זוגות. אתם והשותף שלכם (למעלה) מול שני היריבים בצדדים.'],
    ['הנקודות', 'לכל קלף גבוה יש ערך: אס 4, מלך 3, מלכה 2, נסיך 1. הזוג עם יותר נקודות מוביל את המשחק.'],
    ['הדומם', 'קלפי השותף של המוביל נחשפים על השולחן, והמוביל משחק גם אותם.'],
    ['השליט', 'המוביל בוחר סוג שיהיה "שליט" - קלף בסוג הזה מנצח כל קלף אחר. אפשר גם לבחור "בלי שליט".'],
    ['הלקיחות', 'בכל סיבוב כל אחד שם קלף. חובה לשים קלף מאותו סוג שהובל, אם יש לכם. הקלף הגבוה ביותר לוקח.'],
    ['המטרה', 'להשלים את מספר הלקיחות שנקבע בחוזה. הצלחתם - ניצחתם!'],
  ];
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, direction: 'rtl',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-app, #F6F0E3)', borderRadius: 22, padding: '22px 20px',
        maxWidth: 420, width: '100%', maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 12 }}>איך משחקים ברידג'?</div>
        {items.map(([t, d]) => (
          <div key={t} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#2E6B45' }}>{t}</div>
            <div style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{d}</div>
          </div>
        ))}
        <button onClick={onClose} className="big-btn big-btn--primary" style={{ width: '100%', marginTop: 6 }}>הבנתי, בואו נשחק</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// המשחק עצמו - מיני-ברידג' נגד המחשב
// ═══════════════════════════════════════════════════════════
function BridgeLocal({ onBack, onHome, profile }) {
  const [names] = useState(() => {
    const partner = pick(PARTNER_NAMES);
    const rivals = [...RIVAL_NAMES].sort(() => Math.random() - 0.5).slice(0, 2);
    return { [SOUTH]: profile?.name || 'אתם', [WEST]: rivals[0], [NORTH]: partner, [EAST]: rivals[1] };
  });

  const [game, setGame] = useState(() => startDeal());
  const [leaveOpen, setLeaveOpen] = useState(false);
  const music = useGameMusic('beyahad-bridge-music');
  const busyRef = useRef(false);

  // ── יצירת חלוקה חדשה ────────────────────────────────────
  function startDeal() {
    const hands = freshDeal();
    const hcp = hands.map(handHcp);
    const nsPoints = hcp[SOUTH] + hcp[NORTH];
    const ewPoints = hcp[WEST] + hcp[EAST];

    let declarer;
    if (nsPoints >= ewPoints) {
      declarer = SOUTH;                                  // הזוג שלנו - אתם תמיד הכרוז
    } else {
      declarer = hcp[WEST] >= hcp[EAST] ? WEST : EAST;   // אצל היריבים - בעל הנקודות הרבות
    }
    const dummy = partnerOf(declarer);
    const combined = isOurSide(declarer) ? nsPoints : ewPoints;

    return {
      phase: 'contract',        // contract -> play -> done
      hands, hcp, nsPoints, ewPoints, combined,
      declarer, dummy,
      trump: null, target: null,
      trick: [],                // [{seat, card}]
      turn: null,
      tricksWon: [0, 0, 0, 0],
      lastTrick: null,          // { winner } - הלקיחה נשארת רגע על השולחן
      trickNo: 0,
      result: null,
    };
  }

  // ── בחירת החוזה ─────────────────────────────────────────
  function chooseTrump(trump) {
    setGame(g => {
      const target = targetTricks(g.combined, trump);
      return { ...g, trump, target, phase: 'play', turn: nextSeat(g.declarer) };
    });
  }

  // כרוז ממוחשב בוחר לבד
  useEffect(() => {
    if (game.phase !== 'contract' || isOurSide(game.declarer)) return;
    const t = setTimeout(() => {
      chooseTrump(aiChooseTrump(game.hands[game.declarer], game.hands[game.dummy]));
    }, 1100);
    return () => clearTimeout(t);
  }, [game.phase, game.declarer]);

  // ── שחקן משחק קלף ───────────────────────────────────────
  function playCard(seat, card) {
    setGame(g => {
      if (g.phase !== 'play' || g.turn !== seat) return g;
      const hands = g.hands.map((h, i) => (i === seat ? h.filter(c => cardKey(c) !== cardKey(card)) : h));
      const trick = [...g.trick, { seat, card }];
      try { playSound('drop'); } catch { /* סאונד לא קריטי */ }

      if (trick.length < 4) return { ...g, hands, trick, turn: nextSeat(seat) };

      // הלקיחה הושלמה - מחשבים מנצח
      const winner = trickLeader(trick, g.trump).seat;
      const tricksWon = [...g.tricksWon];
      tricksWon[winner]++;
      return { ...g, hands, trick, tricksWon, turn: null, lastTrick: { winner }, trickNo: g.trickNo + 1 };
    });
  }

  // ── סגירת לקיחה אחרי השהייה קצרה ───────────────────────
  useEffect(() => {
    if (game.phase !== 'play' || game.trick.length !== 4 || !game.lastTrick) return;
    const t = setTimeout(() => {
      setGame(g => {
        const winner = g.lastTrick ? g.lastTrick.winner : g.turn;
        try { playSound('step'); } catch { /* לא קריטי */ }
        const declTricks = g.tricksWon[g.declarer] + g.tricksWon[g.dummy];
        if (g.trickNo >= 13) {
          const made = declTricks >= g.target;
          const weWon = isOurSide(g.declarer) ? made : !made;
          try { playSound(weWon ? 'win' : 'lose'); } catch { /* לא קריטי */ }
          return { ...g, phase: 'done', trick: [], lastTrick: null, turn: null, result: { made, declTricks, weWon } };
        }
        return { ...g, trick: [], lastTrick: null, turn: winner };
      });
    }, 1400);
    return () => clearTimeout(t);
  }, [game.trick.length, game.lastTrick, game.phase]);

  // ── תור הבוטים ──────────────────────────────────────────
  // הבוטים משחקים כל מושב שאינו בשליטת השחקן.
  const humanControls = (seat) =>
    seat === SOUTH || (isOurSide(game.declarer) && seat === game.dummy);

  useEffect(() => {
    if (game.phase !== 'play' || game.turn === null) return;
    if (humanControls(game.turn)) return;
    if (busyRef.current) return;
    busyRef.current = true;
    const seat = game.turn;
    const t = setTimeout(() => {
      const card = aiChooseCard(game.hands[seat], game.trick, game.trump, seat);
      playCard(seat, card);
      busyRef.current = false;
    }, 850);
    return () => { clearTimeout(t); busyRef.current = false; };
  }, [game.turn, game.phase, game.trick.length]);

  const newDeal = () => setGame(startDeal());

  // ── מידע לתצוגה ─────────────────────────────────────────
  const { hands, trump, target, trick, turn, tricksWon, declarer, dummy, phase } = game;
  const declaringSideIsOurs = isOurSide(declarer);
  const ourTricks = tricksWon[SOUTH] + tricksWon[NORTH];
  const theirTricks = tricksWon[WEST] + tricksWon[EAST];
  const myTurn = phase === 'play' && turn !== null && humanControls(turn);
  const legalKeys = new Set(myTurn ? legalCards(hands[turn], trick).map(cardKey) : []);
  const playedBy = (seat) => {
    const p = trick.find(x => x.seat === seat);
    return p ? p.card : null;
  };

  return (
    <div onPointerDown={music.kick} style={{
      height: '100%', display: 'flex', flexDirection: 'column', direction: 'rtl',
      background: 'linear-gradient(180deg,#3b2a1c 0%,#241a11 100%)', overflow: 'hidden',
    }}>
      {/* ── סרגל עליון ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 8px', flexShrink: 0 }}>
        <button onClick={() => setLeaveOpen(true)} aria-label="יציאה" style={{
          width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.14)',
          color: '#F6F0E3', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0,
        }}><IconBackRTL size={20} color="#F6F0E3" /></button>
        <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {phase === 'contract'
            ? <Chip bg="#96742E" fg="#fff">בחירת שליט</Chip>
            : (
              <>
                <Chip bg="#2E6B45" fg="#EAF3DE">
                  חוזה {contractLabel(trump, target)} · {declaringSideIsOurs ? 'אתם מובילים' : 'הם מובילים'}
                </Chip>
                <Chip bg="rgba(255,255,255,.14)" fg="#F6F0E3">
                  לקיחות: אנחנו {ourTricks} · הם {theirTricks}
                </Chip>
              </>
            )}
        </div>
        <GameMusicButton {...music} />
      </div>

      {/* ── השולחן ─────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, padding: '0 10px', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          flex: 1, minHeight: 0, borderRadius: 20, padding: '10px 8px',
          background: 'radial-gradient(ellipse at 50% 40%, #3a8358 0%, #2E6B45 45%, #1d4a2e 100%)',
          border: '5px solid #5e3e22',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,.35), 0 10px 24px -8px rgba(0,0,0,.6)',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden',
        }}>
          {/* צפון - השותף / הדומם */}
          <SeatTop
            name={names[NORTH]} hand={hands[NORTH]}
            exposed={dummy === NORTH}
            isDummy={dummy === NORTH} isDeclarer={declarer === NORTH}
            active={turn === NORTH}
            clickable={phase === 'play' && turn === NORTH && humanControls(NORTH)}
            legalKeys={legalKeys} onPlay={(c) => playCard(NORTH, c)}
          />

          {/* אמצע - מערב · הלקיחה · מזרח */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '4px 2px' }}>
            <SeatSide
              name={names[WEST]} isDummy={dummy === WEST} isDeclarer={declarer === WEST}
              active={turn === WEST} count={hands[WEST].length}
              exposed={dummy === WEST} hand={hands[WEST]}
            />
            <TrickCenter trick={trick} winner={game.lastTrick ? game.lastTrick.winner : null} />
            <SeatSide
              name={names[EAST]} isDummy={dummy === EAST} isDeclarer={declarer === EAST}
              active={turn === EAST} count={hands[EAST].length}
              exposed={dummy === EAST} hand={hands[EAST]}
            />
          </div>

          {/* שורת סטטוס תחתונה בתוך השולחן */}
          <div style={{ textAlign: 'center', color: '#C0DD97', fontSize: 12.5, fontWeight: 700, minHeight: 18 }}>
            {phase === 'play' && turn !== null && (
              humanControls(turn)
                ? (turn === SOUTH ? 'התור שלכם - בחרו קלף' : `שחקו קלף מהדומם (${names[NORTH]})`)
                : `${names[turn]} חושב/ת...`
            )}
            {phase === 'play' && turn === null && trick.length === 4 && 'לקיחה!'}
          </div>
        </div>
      </div>

      {/* ── היד שלכם ───────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '8px 6px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 8px 5px', color: '#E8D9C2', fontSize: 12.5, fontWeight: 700,
        }}>
          <span>{names[SOUTH]}{declarer === SOUTH ? ' · הכרוז' : ''}</span>
          <span style={{ opacity: .8 }}>{handHcp(hands[SOUTH])} נקודות</span>
        </div>
        <HandFan
          hand={hands[SOUTH]}
          clickable={phase === 'play' && turn === SOUTH}
          legalKeys={turn === SOUTH ? legalKeys : null}
          onPlay={(c) => playCard(SOUTH, c)}
        />
      </div>

      {/* ── בחירת שליט ─────────────────────────────── */}
      {phase === 'contract' && declaringSideIsOurs && (
        <TrumpChooser
          combined={game.combined} hand={hands[SOUTH]} dummyHand={hands[NORTH]}
          partnerName={names[NORTH]} onChoose={chooseTrump}
        />
      )}

      {/* ── סיום חלוקה ─────────────────────────────── */}
      {phase === 'done' && game.result && (
        <ResultModal
          result={game.result} target={target} trump={trump}
          declaringSideIsOurs={declaringSideIsOurs}
          onNewDeal={newDeal} onExit={onBack}
        />
      )}

      {leaveOpen && (
        <LeaveConfirmModal
          onStay={() => setLeaveOpen(false)}
          onLeave={() => { setLeaveOpen(false); onBack(); }}
        />
      )}
    </div>
  );
}

// ── רכיבי תצוגה ───────────────────────────────────────────
function Chip({ children, bg, fg }) {
  return (
    <span style={{
      background: bg, color: fg, fontSize: 11.5, fontWeight: 700,
      padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

// קלף בודד
function Card({ card, size = 'md', dim = false, highlight = false, onClick = null }) {
  const dims = { sm: [26, 36, 12], md: [34, 48, 15], lg: [40, 56, 18] }[size];
  const [w, h, fs] = dims;
  return (
    <div
      onClick={onClick || undefined}
      role={onClick ? 'button' : undefined}
      style={{
        width: w, height: h, borderRadius: Math.round(w / 6),
        background: '#FFFDF8', color: isRed(card.s) ? '#C41E1E' : '#1B1B1E',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontSize: fs, fontWeight: 800, lineHeight: 1,
        border: highlight ? '2.5px solid #E8C879' : '1px solid rgba(0,0,0,.22)',
        boxShadow: highlight ? '0 0 10px rgba(232,200,121,.65)' : '0 2px 5px rgba(0,0,0,.3)',
        opacity: dim ? 0.42 : 1,
        cursor: onClick ? 'pointer' : 'default',
        transform: highlight ? 'translateY(-5px)' : 'none',
        transition: 'transform .15s, box-shadow .15s, opacity .15s',
        flexShrink: 0, userSelect: 'none',
      }}>
      <span>{rankLabel(card.r)}</span>
      <span style={{ fontSize: fs * 0.9 }}>{SUIT_CHAR[card.s]}</span>
    </div>
  );
}

// גב קלף
function CardBack() {
  return (
    <div style={{
      width: 22, height: 31, borderRadius: 4, flexShrink: 0,
      background: 'repeating-linear-gradient(45deg,#1e4b7a,#1e4b7a 3px,#2b6099 3px,#2b6099 6px)',
      border: '1.5px solid #FFFDF8', boxShadow: '0 2px 4px rgba(0,0,0,.35)',
    }} />
  );
}

// שם מושב + סימון תפקיד
function SeatTag({ name, isDummy, isDeclarer, active }) {
  return (
    <div style={{ textAlign: 'center', lineHeight: 1.25 }}>
      <div style={{
        fontSize: 11.5, fontWeight: 800, color: active ? '#E8C879' : '#C0DD97',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E8C879', display: 'inline-block' }} />}
        {name}
      </div>
      {(isDummy || isDeclarer) && (
        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#9ec7a8' }}>
          {isDeclarer ? 'הכרוז' : 'הדומם'}
        </div>
      )}
    </div>
  );
}

// מושב עליון (צפון) - כדומם מציגים שורה לכל סוג, עם קלפים לחיצים
function SeatTop({ name, hand, exposed, isDummy, isDeclarer, active, clickable, legalKeys, onPlay }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <SeatTag name={name} isDummy={isDummy} isDeclarer={isDeclarer} active={active} />
      {exposed ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
          {[3, 2, 1, 0].map(s => {
            const cards = hand.filter(c => c.s === s);
            if (!cards.length) return null;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{
                  fontSize: 13, width: 14, textAlign: 'center', flexShrink: 0,
                  color: isRed(s) ? '#FFC2C2' : '#FFFDF8',
                }}>{SUIT_CHAR[s]}</span>
                {cards.map(c => {
                  const legal = !!(clickable && legalKeys && legalKeys.has(cardKey(c)));
                  return (
                    <button key={cardKey(c)} onClick={legal ? () => onPlay(c) : undefined} disabled={!legal}
                      style={{
                        width: 21, height: 28, borderRadius: 4, padding: 0, minHeight: 'unset',
                        background: '#FFFDF8', color: isRed(c.s) ? '#C41E1E' : '#1B1B1E',
                        fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit',
                        border: legal ? '2px solid #E8C879' : '1px solid rgba(0,0,0,.2)',
                        boxShadow: legal ? '0 0 8px rgba(232,200,121,.7)' : '0 1px 3px rgba(0,0,0,.3)',
                        opacity: clickable && !legal ? 0.42 : 1,
                        cursor: legal ? 'pointer' : 'default', flexShrink: 0,
                      }}>{rankLabel(c.r)}</button>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 1 }}>
          {Array.from({ length: Math.min(hand.length, 13) }).map((_, i) => <CardBack key={i} />)}
        </div>
      )}
    </div>
  );
}

// מושב צדדי (מערב/מזרח) - דומם מוצג כרשימת סוגים קומפקטית
function SeatSide({ name, isDummy, isDeclarer, active, count, exposed, hand }) {
  return (
    <div style={{ width: 78, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <SeatTag name={name} isDummy={isDummy} isDeclarer={isDeclarer} active={active} />
      {exposed ? (
        <div style={{
          background: 'rgba(255,253,248,.94)', borderRadius: 7, padding: '4px 5px',
          display: 'flex', flexDirection: 'column', gap: 1, width: '100%', boxSizing: 'border-box',
        }}>
          {[3, 2, 1, 0].map(s => {
            const cards = hand.filter(c => c.s === s);
            return (
              <div key={s} style={{
                fontSize: 10.5, fontWeight: 800, lineHeight: 1.25,
                color: isRed(s) ? '#C41E1E' : '#1B1B1E', wordBreak: 'break-all',
              }}>
                {SUIT_CHAR[s]} {cards.length ? cards.map(c => rankLabel(c.r)).join(' ') : '-'}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', paddingInline: 2 }}>
          {/* ערימה חופפת — נשארת צרה ולא נוגעת במרכז השולחן */}
          {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
            <div key={i} style={{ marginInlineStart: i === 0 ? 0 : -15 }}><CardBack /></div>
          ))}
        </div>
      )}
    </div>
  );
}

// מרכז השולחן - הקלפים שהונחו בלקיחה הנוכחית
function TrickCenter({ trick, winner }) {
  const bySeat = {};
  trick.forEach(p => { bySeat[p.seat] = p.card; });
  const slot = (seat) => bySeat[seat]
    ? <Card card={bySeat[seat]} size="md" highlight={winner === seat} />
    : <div style={{ width: 34, height: 48 }} />;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      background: 'rgba(0,0,0,.16)', borderRadius: 14, padding: '6px 4px', minHeight: 128,
      justifyContent: 'center',
    }}>
      {slot(NORTH)}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {slot(EAST)}
        {slot(WEST)}
      </div>
      {slot(SOUTH)}
    </div>
  );
}

// היד של השחקן - מסודרת לפי סוגים
function HandFan({ hand, clickable, legalKeys, onPlay }) {
  return (
    <div style={{ display: 'flex', gap: 7, justifyContent: 'center', flexWrap: 'wrap', padding: '0 4px' }}>
      {[3, 2, 1, 0].map(s => {
        const cards = hand.filter(c => c.s === s);
        if (!cards.length) return null;
        return (
          <div key={s} style={{ display: 'flex', gap: 2 }}>
            {cards.map(c => {
              const legal = !legalKeys || legalKeys.has(cardKey(c));
              return (
                <Card key={cardKey(c)} card={c} size="lg"
                  dim={clickable && !legal}
                  highlight={clickable && legal}
                  onClick={clickable && legal ? () => onPlay(c) : null} />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── בחירת שליט (רק כשאתם הכרוז) ──────────────────────────
function TrumpChooser({ combined, hand, dummyHand, partnerName, onChoose }) {
  const counts = [0, 0, 0, 0];
  [...hand, ...dummyHand].forEach(c => { counts[c.s]++; });
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, direction: 'rtl',
    }}>
      <div style={{ background: '#F6F0E3', borderRadius: 22, padding: '20px 18px', maxWidth: 420, width: '100%', maxHeight: '86vh', overflowY: 'auto' }}>
        <div className="h-display" style={{ fontSize: 21, color: '#2E6B45', marginBottom: 4 }}>אתם מובילים את החלוקה!</div>
        <div style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 14 }}>
          לכם ול{partnerName} יש יחד <strong>{combined} נקודות</strong>.
          בחרו סוג שיהיה השליט - כדאי לבחור את הסוג שיש לכם בו הכי הרבה קלפים.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[3, 2, 1, 0].map(s => (
            <button key={s} onClick={() => onChoose(s)} style={trumpBtnStyle(isRed(s) ? '#C41E1E' : '#1B1B1E')}>
              <span style={{ fontSize: 26 }}>{SUIT_CHAR[s]}</span>
              <span style={{ flex: 1, textAlign: 'right' }}>{SUIT_NAME[s]}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5F5E5A' }}>
                {counts[s]} קלפים · יעד {targetTricks(combined, s)}
              </span>
            </button>
          ))}
          <button onClick={() => onChoose(NT)} style={trumpBtnStyle('#2C5566')}>
            <span style={{ fontSize: 20, fontWeight: 800 }}>NT</span>
            <span style={{ flex: 1, textAlign: 'right' }}>בלי שליט</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5F5E5A' }}>
              יעד {targetTricks(combined, NT)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

const trumpBtnStyle = (color) => ({
  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
  background: '#FFFDF8', border: '2px solid #E4DECE', borderRadius: 14,
  padding: '11px 14px', color, fontSize: 18, fontWeight: 800,
  fontFamily: 'inherit', cursor: 'pointer', minHeight: 'unset', textAlign: 'right',
});

// ── סיום חלוקה ───────────────────────────────────────────
function ResultModal({ result, target, trump, declaringSideIsOurs, onNewDeal, onExit }) {
  const { made, declTricks, weWon } = result;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, direction: 'rtl',
    }}>
      <div style={{ background: '#F6F0E3', borderRadius: 22, padding: '24px 20px', maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <GameIcon id={weWon ? 'trophy' : 'ai-win'} size={62} />
        </div>
        <div className="h-display" style={{ fontSize: 24, color: weWon ? '#2E6B45' : '#7E2C2E', marginBottom: 8 }}>
          {weWon ? 'כל הכבוד, ניצחתם!' : 'הפעם לא הסתדר'}
        </div>
        <div style={{ fontSize: 15.5, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 18 }}>
          החוזה היה <strong>{contractLabel(trump, target)}</strong> - צריך היה {target} לקיחות.<br />
          {declaringSideIsOurs ? 'לקחתם' : 'היריבים לקחו'} <strong>{declTricks}</strong> לקיחות, {made ? 'החוזה בוצע' : 'החוזה נכשל'}.
        </div>
        <button onClick={onNewDeal} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 10 }}>
          חלוקה חדשה
        </button>
        <button onClick={onExit} style={{
          width: '100%', background: 'transparent', border: 'none', color: 'var(--ink-3)',
          fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', padding: 8,
        }}>חזרה לתפריט</button>
      </div>
    </div>
  );
}
