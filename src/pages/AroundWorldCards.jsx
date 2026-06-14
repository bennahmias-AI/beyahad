/*
  AroundWorldCards.jsx
  Property cards styled after the REAL game cards (Ben's photo):
  rounded light card -> inner black frame -> tinted header with the country
  name -> big flag field -> 5 rent rows (number left, label right).

  Exports:
    PropertyCard - a single card. `level` highlights the active rent row
                   (0..4) with a yellow tint; -1 = no highlight.
    CardsModal   - full-screen modal: tabs "הכרטיסיות של X" / "כל הכרטיסיות".
*/

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { TILES, GROUPS, rentFor } from '../data/aroundWorldBoard';
import { flagSVG } from '../data/aroundWorldFlags';

const INK = '#1c1c1c';
const CREAM = '#f6efdf';

export const CARD_ROW_LABELS = ['דמי ביקור', 'עם מלון אחד', 'עם 2 מלונות', 'עם 3 מלונות', 'עיר בירה'];

export function PropertyCard({ tile, level = -1, width = 200, footer = null }) {
  const grp = GROUPS[tile.group];
  // width יכול להיות מספר (px) או '100%' (גמיש — בתוך grid).
  // כשגמיש, הכרטיס תופס 100% מהתא והגדלים הפנימיים מחושבים מבסיס קבוע.
  const isFluid = typeof width !== 'number';
  const base = isFluid ? 150 : width;
  const f = (n) => Math.round(base * n);
  return (
    <div style={{
      width, flex: 'none', background: '#f4f2ec', border: '1px solid #c9c6bd', borderRadius: f(0.07),
      padding: f(0.035), boxShadow: '0 5px 14px rgba(0,0,0,.22)', direction: 'rtl', fontFamily: 'Heebo, sans-serif',
      boxSizing: 'border-box', maxWidth: '100%',
    }}>
      <div style={{ border: `${Math.max(2, f(0.013))}px solid ${INK}`, borderRadius: f(0.03), overflow: 'hidden', background: '#fff' }}>
        <div style={{
          background: grp.color + '55', borderBottom: `2px solid ${INK}`, textAlign: 'center',
          fontWeight: 900, fontSize: f(tile.name.length > 9 ? 0.078 : 0.105), padding: `${f(0.025)}px 4px`, color: INK, lineHeight: 1.1,
          whiteSpace: 'nowrap', overflow: 'hidden',
        }}>{tile.name}</div>
        <div style={{ height: f(0.56), borderBottom: `2px solid ${INK}` }}>
          <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: flagSVG(tile.flag) }} />
        </div>
        <div style={{ padding: `${f(0.045)}px ${f(0.06)}px` }}>
          {CARD_ROW_LABELS.map((lb, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: f(0.072), lineHeight: 1.62, color: INK,
              fontWeight: level === i ? 900 : 700,
              background: level === i ? '#f4c20d66' : 'transparent',
              borderRadius: 5, padding: '0 5px',
            }}>
              <span>{lb}</span>
              <span style={{ fontWeight: level === i ? 900 : 800 }}>{tile.rents[i]}</span>
            </div>
          ))}
        </div>
        {footer}
      </div>
    </div>
  );
}

// small footer line inside a card (e.g. price / owner)
export function CardFooter({ children, color = '#3a3a3a' }) {
  return (
    <div style={{ borderTop: `2px solid ${INK}`, textAlign: 'center', fontWeight: 800, fontSize: 13, padding: '5px 4px', color }}>
      {children}
    </div>
  );
}

/*
  CardsModal - shows a player's owned cards or the full catalog.
  props: player (the panel that was tapped), players (all), owners, hotels, onClose
*/
export function CardsModal({ player, players, owners, hotels, onClose, rotate = false }) {
  const [tab, setTab] = useState('mine'); // mine | all
  const allProps = TILES.filter((t) => t.type === 'prop');
  const mine = allProps.filter((t) => owners[t.id] === player.uid);
  const shown = tab === 'mine' ? mine : allProps;

  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setTab(id)} style={{
      flex: 1, padding: '9px 6px', fontSize: 16, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
      background: tab === id ? '#2f9e3f' : '#fff', color: tab === id ? '#fff' : INK,
      border: `2px solid ${INK}`, borderRadius: 12,
    }}>{label}</button>
  );

  // כשהמשחק מסובב (טלפון ב-portrait מאולץ ל-landscape), ה-portal יושב על document.body
  // הלא-מסובב — אז נסובב את תוכן המודאל 90° כדי שיתאים לכיוון המשחק.
  const overlayInner = (
    <div onClick={(e) => e.stopPropagation()} style={{ background: CREAM, border: `3px solid ${INK}`, borderRadius: 18, width: '100%', maxWidth: 760, maxHeight: '100%', display: 'flex', flexDirection: 'column', boxShadow: '0 18px 50px rgba(0,0,0,.4)', overflow: 'hidden', fontFamily: 'Heebo, sans-serif' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `2px solid ${INK}`, background: '#fff' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: player.color, border: `3px solid ${INK}`, flex: 'none' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: INK }}>{player.name} · {player.cash.toLocaleString()} ₪</div>
          </div>
          <button onClick={onClose} aria-label="סגירה" style={{ width: 36, height: 36, borderRadius: 10, border: `2px solid ${INK}`, background: '#fff', fontSize: 17, fontWeight: 900, cursor: 'pointer', color: INK }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '8px 12px 0' }}>
          {tabBtn('mine', 'הכרטיסיות של ' + player.name + ' (' + mine.length + ')')}
          {tabBtn('all', 'כל הכרטיסיות (' + allProps.length + ')')}
        </div>

        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', minHeight: 0, flex: 1, padding: 12 }}>
          {shown.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '26px 10px', fontWeight: 700, fontSize: 17, color: '#555' }}>
              עוד אין מדינות. הכל לפניו! 🌍
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12, justifyContent: 'center', width: '100%' }}>
              {shown.map((t) => {
                const ownerUid = owners[t.id];
                const ownerP = ownerUid ? players.find((p) => p.uid === ownerUid) : null;
                const level = ownerUid ? (hotels[t.id] || 0) : -1;
                let footer;
                if (!ownerP) {
                  footer = <CardFooter color="#1c4e26">פנויה · מחיר {t.price} ₪</CardFooter>;
                } else if (tab === 'mine') {
                  footer = <CardFooter>שכירות כעת: {rentFor(t, owners, hotels)} ₪</CardFooter>;
                } else {
                  footer = (
                    <CardFooter>
                      <span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', background: ownerP.color, border: `1.5px solid ${INK}`, marginInlineEnd: 5, verticalAlign: 'middle' }} />
                      של {ownerP.name}
                    </CardFooter>
                  );
                }
                return <PropertyCard key={t.id} tile={t} level={level} width="100%" footer={footer} />;
              })}
            </div>
          )}
        </div>
      </div>
  );

  // מסגרת ה-overlay: כשמסובב — container פנימי מסובב 90° עם מימדי מסך מוחלפים.
  return createPortal((
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(28,28,28,.6)', direction: 'rtl', overflow: 'hidden' }}>
      {rotate ? (
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '100vh', height: '100vw', transform: 'translate(-50%,-50%) rotate(90deg)', transformOrigin: 'center center', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, boxSizing: 'border-box' }}>
          {overlayInner}
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, boxSizing: 'border-box' }}>
          {overlayInner}
        </div>
      )}
    </div>
  ), document.body);
}
