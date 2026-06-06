// src/pages/LandingPage.jsx
// ─────────────────────────────────────────────────────────────
// אתר תדמית — מוצג רק במחשב ולמשתמש לא-מחובר (ראה App.jsx).
// מסביר את הפלטפורמה ומזמין להתחברות (onLogin → AuthPage הקיימת).
// אסתטיקה תואמת-מותג: קרם חם, בורדו/טורקיז/חרדל, פונט Huninn,
// טקסט גדול וקריא לגיל השלישי. אינו נטען כלל בנייד.
// ─────────────────────────────────────────────────────────────
import {
  IconCoffee, IconPodium, IconMusic, IconGames,
  IconRadio, IconTV, IconGreeting, IconGroup,
} from '../icons/index.jsx'

const FEATURES = [
  { Icon: IconCoffee,   title: 'קפה בסלון',     desc: 'שיחת וידאו אחד-על-אחד, פנים אל פנים, בלחיצה אחת.' },
  { Icon: IconPodium,   title: 'פרלמנט',         desc: 'דיון קבוצתי חי בנושאים שמעניינים אתכם.' },
  { Icon: IconMusic,    title: 'שירה בציבור',    desc: 'שרים יחד את השירים שאנחנו אוהבים.' },
  { Icon: IconGames,    title: 'זירת משחקים',    desc: 'בינגו, שש-בש, שחמט, רמיקוב ועוד — מול חברים או המחשב.' },
  { Icon: IconRadio,    title: 'רדיו',            desc: 'תחנות ישראליות ומכל העולם, מנגנות ברקע.' },
  { Icon: IconTV,       title: 'טלוויזיה',        desc: 'ערוצים חיים, ישירות אל המסך.' },
  { Icon: IconGreeting, title: 'ברכות אישיות',   desc: 'יוצרים ברכה יפה למשפחה ולחברים בכמה נגיעות.' },
  { Icon: IconGroup,    title: 'קהילה וחברים',   desc: 'צ׳אט והודעות קוליות, עצות ומתכונים מהקהילה.' },
]

export default function LandingPage({ onLogin }) {
  return (
    <div className="by-lp" dir="rtl">
      <style>{`
        .by-lp {
          width: 100%;
          height: 100vh;
          overflow-y: auto;
          background:
            radial-gradient(1100px 620px at 88% -8%, rgba(126,44,46,.16), transparent 60%),
            radial-gradient(900px 560px at 6% 14%, rgba(44,85,102,.14), transparent 60%),
            radial-gradient(800px 600px at 70% 110%, rgba(184,144,72,.16), transparent 60%),
            var(--bg-app);
          color: var(--ink);
          font-family: var(--font-body);
          overflow-x: hidden;
        }
        .by-wrap { max-width: 1180px; margin: 0 auto; padding: 0 40px; }

        .by-nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: 26px 0 8px;
        }
        .by-brand { display: flex; align-items: center; gap: 14px; }
        .by-brand img { width: 52px; height: 52px; border-radius: 14px; box-shadow: var(--shadow-sm); }
        .by-brand .name { font-family: var(--font-display); font-weight: 800; font-size: 30px; color: var(--wine); letter-spacing: -.02em; }

        .by-btn {
          font-family: var(--font-body); font-weight: 800; font-size: 19px;
          color: #fff; background: var(--wine);
          border-radius: 999px; padding: 14px 30px;
          box-shadow: 0 10px 24px -8px rgba(107,58,79,.6);
          transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
        }
        .by-btn:hover { transform: translateY(-2px); box-shadow: 0 16px 30px -10px rgba(107,58,79,.7); background: var(--wine-deep); }
        .by-btn:active { transform: translateY(0); }

        /* Hero */
        .by-hero { display: grid; grid-template-columns: 1.1fr .9fr; gap: 48px; align-items: center; padding: 56px 0 64px; }
        .by-kicker {
          display: inline-flex; align-items: center; gap: 9px;
          font-family: var(--font-display); font-weight: 800; font-size: 15px;
          color: var(--wine); background: var(--wine-soft);
          padding: 9px 18px; border-radius: 999px; letter-spacing: .02em;
        }
        .by-kicker .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--wine); }
        .by-h1 {
          font-family: var(--font-display); font-weight: 800;
          font-size: 60px; line-height: 1.05; letter-spacing: -.03em;
          color: var(--ink); margin: 22px 0 0;
        }
        .by-h1 .accent { color: var(--wine); }
        .by-sub { font-size: 23px; line-height: 1.6; color: var(--ink-2); font-weight: 600; margin: 22px 0 32px; max-width: 540px; }
        .by-cta-row { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
        .by-cta-note { font-size: 16px; color: var(--ink-3); font-weight: 600; }

        .by-hero-art { position: relative; display: flex; align-items: center; justify-content: center; min-height: 360px; }
        .by-disc {
          width: 320px; height: 320px; border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #fff 0%, var(--surface) 45%, var(--surface-2) 100%);
          box-shadow: var(--shadow-lg); border: 1px solid var(--line);
          display: flex; align-items: center; justify-content: center;
        }
        .by-disc img { width: 190px; height: 190px; border-radius: 44px; box-shadow: 0 18px 40px -12px rgba(27,37,64,.4); }
        .by-float {
          position: absolute; width: 84px; height: 84px; border-radius: 24px;
          background: var(--surface); border: 1px solid var(--line);
          box-shadow: var(--shadow-md);
          display: flex; align-items: center; justify-content: center;
        }
        .by-float.f1 { top: 8px;  right: 16px; }
        .by-float.f2 { bottom: 24px; right: -6px; }
        .by-float.f3 { top: 30px; left: 0; }
        .by-float.f4 { bottom: 0; left: 40px; }

        /* Features */
        .by-section-h { text-align: center; margin: 18px 0 8px; }
        .by-section-h h2 { font-family: var(--font-display); font-weight: 800; font-size: 38px; color: var(--ink); letter-spacing: -.02em; margin: 0; }
        .by-section-h p { font-size: 19px; color: var(--ink-2); font-weight: 600; margin: 12px 0 0; }
        .by-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px;
          padding: 40px 0 8px;
        }
        .by-card {
          background: var(--surface); border: 1px solid var(--line);
          border-radius: var(--radius-lg); padding: 28px 24px;
          box-shadow: var(--shadow-sm);
          transition: transform .15s ease, box-shadow .15s ease;
        }
        .by-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
        .by-card h3 { font-family: var(--font-display); font-weight: 800; font-size: 22px; color: var(--ink); margin: 16px 0 8px; }
        .by-card p { font-size: 16.5px; line-height: 1.55; color: var(--ink-2); font-weight: 500; margin: 0; }

        /* Closing band */
        .by-band {
          margin: 64px 0 0; padding: 56px 48px;
          background: linear-gradient(135deg, var(--teal) 0%, var(--teal-deep) 100%);
          border-radius: 34px; text-align: center; color: #FBF7EE;
          box-shadow: var(--shadow-lg);
        }
        .by-band h2 { font-family: var(--font-display); font-weight: 800; font-size: 40px; margin: 0 0 12px; letter-spacing: -.02em; }
        .by-band p { font-size: 20px; font-weight: 600; opacity: .94; margin: 0 0 28px; }
        .by-btn--light { background: #FBF7EE; color: var(--teal-deep); box-shadow: 0 12px 28px -10px rgba(0,0,0,.4); }
        .by-btn--light:hover { background: #fff; }

        /* Footer */
        .by-foot {
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;
          padding: 34px 0 48px; margin-top: 36px;
          color: var(--ink-3); font-size: 16px; font-weight: 600;
        }
        .by-foot a { color: var(--ink-2); text-decoration: none; }
        .by-foot a:hover { color: var(--wine); }
        .by-foot .links { display: flex; gap: 24px; }

        /* Entrance animation (staggered) — respects reduce-motion globally */
        @keyframes byUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        .by-lp .up { opacity: 0; animation: byUp .7s cubic-bezier(.2,.7,.2,1) forwards; }

        /* below 1024 it never renders, but keep a safe fallback */
        @media (max-width: 1080px) {
          .by-hero { grid-template-columns: 1fr; }
          .by-hero-art { order: -1; }
          .by-grid { grid-template-columns: repeat(2, 1fr); }
          .by-h1 { font-size: 46px; }
        }
      `}</style>

      <div className="by-wrap">
        {/* Nav */}
        <nav className="by-nav up" style={{ animationDelay: '0ms' }}>
          <div className="by-brand">
            <img src="/icon-192.png" alt="ביחד" />
            <span className="name">ביחד</span>
          </div>
          <button className="by-btn" onClick={onLogin}>כניסה</button>
        </nav>

        {/* Hero */}
        <header className="by-hero">
          <div>
            <span className="by-kicker up" style={{ animationDelay: '80ms' }}>
              <span className="dot" /> הפלטפורמה החברתית לגיל השלישי
            </span>
            <h1 className="by-h1 up" style={{ animationDelay: '160ms' }}>
              לא להיות לבד.<br /><span className="accent">להיות בְּיַחַד.</span>
            </h1>
            <p className="by-sub up" style={{ animationDelay: '240ms' }}>
              כל החברים, השיחות, המשחקים, המוזיקה והברכות — במקום אחד חם, פשוט וקל לשימוש.
              נבנה במיוחד כדי שיהיה נעים ונוח, בטלפון ובמחשב.
            </p>
            <div className="by-cta-row up" style={{ animationDelay: '320ms' }}>
              <button className="by-btn" onClick={onLogin}>כניסה לאפליקציה</button>
              <span className="by-cta-note">התחברות מהירה עם מספר טלפון</span>
            </div>
          </div>

          <div className="by-hero-art up" style={{ animationDelay: '260ms' }}>
            <div className="by-disc"><img src="/icon-512.png" alt="ביחד" /></div>
            <div className="by-float f1"><IconCoffee size={56} /></div>
            <div className="by-float f2"><IconMusic size={56} /></div>
            <div className="by-float f3"><IconGames size={56} /></div>
            <div className="by-float f4"><IconRadio size={56} /></div>
          </div>
        </header>

        {/* Features */}
        <section>
          <div className="by-section-h up" style={{ animationDelay: '80ms' }}>
            <h2>הכול במקום אחד</h2>
            <p>שמונה דרכים פשוטות להישאר מחוברים, פעילים ושמחים.</p>
          </div>
          <div className="by-grid">
            {FEATURES.map((f, i) => (
              <div className="by-card up" key={f.title} style={{ animationDelay: `${140 + i * 70}ms` }}>
                <f.Icon size={58} />
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing band */}
        <section className="by-band up" style={{ animationDelay: '60ms' }}>
          <h2>ביחד — נעים יותר</h2>
          <p>הצטרפו לקהילה חמה שמחכה לכם. ההתחברות לוקחת פחות מדקה.</p>
          <button className="by-btn by-btn--light" onClick={onLogin}>כניסה לאפליקציה</button>
        </section>

        {/* Footer */}
        <footer className="by-foot">
          <span>© 2026 ביחד · כל הזכויות שמורות</span>
          <span className="links">
            <a href="/privacy.html" target="_blank" rel="noopener">מדיניות פרטיות</a>
            <a href="mailto:info@spacemedia.co.il">צור קשר</a>
          </span>
        </footer>
      </div>
    </div>
  )
}
