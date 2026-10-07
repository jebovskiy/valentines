import { shallow } from 'zustand/shallow';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { setMainButton, setBackButton } from '../utils/telegram';

const STAGE_MS = 4000;

const CAPTIONS = [
  'Разогреваем сковороду — подбираем блюда недели…',
  'Кипит кастрюля — проверяем цены и порции…',
  'Дай чайнику настояться — собираем список покупок…',
];

const sceneCss = `
.menu-gen-fade { animation: mg-fade .6s ease both; }
@keyframes mg-fade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* ── Сковорода ── */
@keyframes mg-flame {
  0%, 100% { transform: scaleY(1) translateY(0); opacity: .9; }
  25% { transform: scaleY(1.3) translateY(-3px); opacity: 1; }
  50% { transform: scaleY(.86) translateY(1px); opacity: .7; }
  75% { transform: scaleY(1.14) translateY(-2px); opacity: .95; }
}
.mg-flame > path { animation: mg-flame 1.05s ease-in-out infinite; transform-origin: 50% 100%; }
.mg-flame > path:nth-child(2) { animation-delay: -.35s; }
.mg-flame > path:nth-child(3) { animation-delay: -.65s; }
.mg-flame > path:nth-child(4) { animation-delay: -.12s; }

/* Подкидывание: присед перед взлётом → рывок вверх с вращением → ловля, приплюскивание и отскок */
@keyframes mg-toss {
  0%   { transform: translate(0, 0) rotate(0deg) scale(1, .9); }
  14%  { transform: translate(0, 3px) rotate(0deg) scale(1.14, .8); }
  38%  { transform: translate(9px, -52px) rotate(-16deg) scale(1, 1.04); }
  54%  { transform: translate(-11px, -60px) rotate(18deg) scale(1.05, 1.05); }
  74%  { transform: translate(3px, -14px) rotate(-7deg) scale(1.22, .7); }
  87%  { transform: translate(-2px, 1px) rotate(-2deg) scale(1, .95); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1, .9); }
}
.mg-toss { animation: mg-toss 2.3s cubic-bezier(.45, .05, .55, .95) infinite; }

/* Шкварчащие капли масла, выпрыгивающие с края сковороды */
@keyframes mg-sizzle {
  0%   { transform: translate(0, 0) scale(.35); opacity: 0; }
  20%  { opacity: 1; }
  40%  { transform: translate(-4px, -12px) scale(1); opacity: .95; }
  70%  { transform: translate(5px, -26px) scale(.8); opacity: .8; }
  100% { transform: translate(-6px, -40px) scale(.15); opacity: 0; }
}
.mg-sizzle circle { animation: mg-sizzle 1.7s ease-out infinite; }
.mg-sizzle circle:nth-child(2) { animation-delay: -.55s; }
.mg-sizzle circle:nth-child(3) { animation-delay: -1.1s; }

/* Едва заметная вибрация самой сковороды поверх огня */
@keyframes mg-wobble {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-1.4deg); }
  50% { transform: rotate(1deg); }
  75% { transform: rotate(-.6deg); }
}
.mg-wobble { animation: mg-wobble 3.2s ease-in-out infinite; transform-origin: 110px 118px; }

@keyframes mg-steam {
  0% { opacity: 0; transform: translateY(14px) translateX(0) rotate(0deg) scale(.75); }
  25% { opacity: .8; }
  60% { opacity: .85; transform: translateY(-10px) translateX(7px) rotate(7deg) scale(1); }
  100% { opacity: 0; transform: translateY(-36px) translateX(-9px) rotate(-11deg) scale(1.3); }
}
.mg-steam path { animation: mg-steam 2.1s ease-out infinite; }
.mg-steam path:nth-child(2) { animation-delay: -.7s; }
.mg-steam path:nth-child(3) { animation-delay: -1.4s; }

/* ── Кастрюля ── */
@keyframes mg-lid {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  22% { transform: translateY(-18px) rotate(-1.5deg); }
  40% { transform: translateY(-4px) rotate(1deg); }
  62% { transform: translateY(-16px) rotate(1.5deg); }
  80% { transform: translateY(-3px) rotate(-1deg); }
}
.mg-lid { animation: mg-lid 1.35s ease-in-out infinite; transform-origin: 110px 44px; }

@keyframes mg-bubble {
  0% { transform: translateY(0) scale(.7); opacity: 0; }
  30% { opacity: .85; }
  100% { transform: translateY(-18px) scale(1.2); opacity: 0; }
}
.mg-bubbles circle { animation: mg-bubble 1.5s ease-in infinite; }
.mg-bubbles circle:nth-child(2) { animation-delay: .5s; }
.mg-bubbles circle:nth-child(3) { animation-delay: 1s; }

/* ── Чайник ── */
@keyframes mg-rock {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  22% { transform: translateY(-3px) rotate(4deg); }
  48% { transform: translateY(0) rotate(-2deg); }
  74% { transform: translateY(-4px) rotate(-4.5deg); }
}
.mg-rock { animation: mg-rock 3.2s ease-in-out infinite; transform-origin: 110px 124px; }

/* Крышка-свисток дребезжит, пока чайник раскачивается */
@keyframes mg-rattle {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  10% { transform: translate(-1.8px, 0) rotate(-2deg); }
  20% { transform: translate(2.2px, -1px) rotate(2.4deg); }
  30% { transform: translate(-1.2px, 1px) rotate(-1.6deg); }
  40% { transform: translate(1.8px, -1px) rotate(2deg); }
  50% { transform: translate(-2.2px, 0) rotate(-2.4deg); }
  60% { transform: translate(1.2px, 1px) rotate(1.6deg); }
  70% { transform: translate(-1.8px, -1px) rotate(-2deg); }
  80% { transform: translate(2px, 0) rotate(2.2deg); }
  90% { transform: translate(-1px, 1px) rotate(-1.4deg); }
}
.mg-rattle { animation: mg-rattle .6s ease-in-out infinite; transform-origin: 112px 30px; }

/* Ритмичные клубы пара из носика */
@keyframes mg-puff {
  0%   { opacity: 0; transform: translate(0, 0) scale(.35); }
  18%  { opacity: .85; }
  45%  { opacity: .6; transform: translate(14px, -16px) scale(1.15); }
  100% { opacity: 0; transform: translate(22px, -32px) scale(1.9); }
}
.mg-puffs circle { animation: mg-puff 1.5s ease-out infinite; }
.mg-puffs circle:nth-child(2) { animation-delay: -.5s; }
.mg-puffs circle:nth-child(3) { animation-delay: -1s; }
`;

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100%',
    padding: '18px 16px 28px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scene: {
    width: '100%',
    maxWidth: 460,
    textAlign: 'center',
  },
  stage: {
    height: 210,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
  },
  caption: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--ink)',
  },
  hint: {
    marginTop: 10,
    fontSize: 12.5,
    color: 'var(--ash)',
    lineHeight: '18px',
  },
  dots: {
    display: 'flex',
    gap: 7,
    justifyContent: 'center',
    marginTop: 18,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'var(--hairline)',
    transition: 'background .3s, transform .3s',
  },
  dotActive: {
    background: 'var(--primary)',
    transform: 'scale(1.25)',
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: 'var(--ink)',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13.5,
    lineHeight: '19px',
    color: 'var(--ash)',
    marginBottom: 18,
  },
  backBtn: {
    height: 44,
    padding: '0 22px',
    borderRadius: 999,
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    color: 'var(--primary)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};

function SkilletScene() {
  return (
    <svg viewBox="0 0 220 190" width={220} height={190} fill="none">
      <defs>
        <linearGradient id="mg-pan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#94a3b8" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
      </defs>
      <g className="mg-wobble">
        <g className="mg-flame">
          <path d="M88 164 q-17 -15 -4 -32 q-6 11 -11 8 q-17 24 2 40 z" fill="#f97316" />
          <path d="M106 168 q-13 -17 -4 -31 q-6 10 -11 8 q-13 23 1 39 z" fill="#fbbf24" />
          <path d="M122 164 q-14 -13 -3 -27 q-6 8 -9 6 q-13 21 1 35 z" fill="#fdba74" />
          <path d="M98 168 q-5 -10 0 -16 q-4 7 -7 6 q-7 13 0 20 z" fill="#fde68a" />
        </g>
        <rect x="164" y="106" width="48" height="13" rx="6.5" fill="#92400e" />
        <rect x="210" y="108" width="9" height="8" rx="4" fill="#78350f" />
        <ellipse cx="104" cy="122" rx="62" ry="20" fill="#334155" />
        <ellipse cx="104" cy="112" rx="62" ry="22" fill="url(#mg-pan)" />
        <ellipse cx="104" cy="114" rx="52" ry="16" fill="#94a3b8" opacity=".25" />
        <ellipse cx="98" cy="106" rx="46" ry="13" fill="#1e293b" />
      </g>
      <g className="mg-steam">
        <path d="M58 62 q4 -12 -1 -18" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
        <path d="M74 56 q4 -14 -2 -21" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
        <path d="M90 62 q4 -11 -1 -16" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
      </g>
      <g className="mg-sizzle">
        <circle cx="150" cy="106" r="3" fill="#fde68a" />
        <circle cx="132" cy="112" r="2.5" fill="#fde68a" />
        <circle cx="62" cy="110" r="2" fill="#fde68a" />
      </g>
      <g className="mg-toss" style={{ transformOrigin: '104px 100px' }}>
        <ellipse cx="104" cy="100" rx="24" ry="14" fill="#fef3c7" />
        <circle cx="107" cy="104" r="11" fill="#f59e0b" />
        <circle cx="82" cy="94" r="5" fill="#f87171" />
        <circle cx="126" cy="98" r="5" fill="#4ade80" />
      </g>
    </svg>
  );
}

function PotScene() {
  return (
    <svg viewBox="0 0 220 170" width={220} height={170} fill="none">
      <defs>
        <linearGradient id="mg-pot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#94a3b8" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
      </defs>
      <g className="mg-steam">
        <path d="M78 34 q3 -10 -1 -16" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
        <path d="M106 30 q3 -12 -2 -19" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
        <path d="M134 34 q3 -10 -1 -16" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
      </g>
      <g className="mg-bubbles">
        <circle cx="82" cy="100" r="4.5" fill="#93c5fd" />
        <circle cx="114" cy="90" r="5.5" fill="#93c5fd" />
        <circle cx="142" cy="102" r="4" fill="#93c5fd" />
      </g>
      <rect x="44" y="72" width="24" height="13" rx="6.5" fill="#1f2937" />
      <rect x="152" y="72" width="24" height="13" rx="6.5" fill="#1f2937" />
      <rect x="60" y="56" width="100" height="72" rx="12" fill="url(#mg-pot)" />
      <ellipse cx="110" cy="124" rx="42" ry="6" fill="#1e293b" opacity=".7" />
      <g className="mg-lid">
        <rect x="54" y="42" width="112" height="14" rx="7" fill="#94a3b8" />
        <rect x="104" y="32" width="12" height="14" rx="5" fill="#cbd5e1" />
      </g>
    </svg>
  );
}

function KettleScene() {
  return (
    <svg viewBox="0 0 220 190" width={220} height={190} fill="none">
      <defs>
        <linearGradient id="mg-kettle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#94a3b8" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
      </defs>
      <g className="mg-steam">
        <path d="M164 42 q4 -12 -1 -18" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
        <path d="M174 38 q4 -14 -2 -20" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
        <path d="M184 44 q4 -11 -1 -16" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
      </g>
      <g className="mg-puffs" style={{ transformOrigin: '178px 34px' }}>
        <circle cx="178" cy="34" r="7" fill="#e2e8f0" />
        <circle cx="178" cy="34" r="7" fill="#e2e8f0" />
        <circle cx="178" cy="34" r="7" fill="#e2e8f0" />
      </g>
      <g className="mg-rock">
        <ellipse cx="110" cy="124" rx="52" ry="9" fill="#1e293b" />
        <path d="M60 56 q46 -38 100 -8" stroke="#334155" strokeWidth="9" strokeLinecap="round" />
        <g className="mg-rattle">
          <path d="M84 30 q28 6 56 0" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="112" cy="30" rx="32" ry="8" fill="#94a3b8" />
          <rect x="106" y="16" width="12" height="14" rx="4" fill="#cbd5e1" />
          <ellipse cx="132" cy="18" rx="9" ry="7" fill="#ef4444" />
          <rect x="127" y="19" width="7" height="8" rx="2" fill="#b91c1c" />
        </g>
        <ellipse cx="106" cy="70" rx="50" ry="48" fill="url(#mg-kettle)" />
        <ellipse cx="92" cy="44" rx="18" ry="9" fill="#cbd5e1" opacity=".35" />
        <path d="M150 66 q24 -10 26 -34" stroke="#475569" strokeWidth="11" strokeLinecap="round" />
        <ellipse cx="110" cy="114" rx="44" ry="7" fill="#334155" opacity=".8" />
      </g>
    </svg>
  );
}

export function MenuGeneratingScreen() {
  const navigate = useNavigate();
  const { menuLoading, menuResult, error } = useValentinesStore(
    (s) => ({ menuLoading: s.menuLoading, menuResult: s.menuResult, error: s.error }),
    shallow,
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const settled = !menuLoading;
  const failed = settled && !menuResult;
  const stage = Math.floor(tick / (STAGE_MS / 1000)) % 3;

  useLayoutEffect(() => {
    if (settled && menuResult) navigate('/menu/result', { replace: true });
  }, [settled, menuResult, navigate]);

  useEffect(() => {
    if (settled) {
      setBackButton(true, () => navigate(failed ? '/menu/allergens' : '/menu/result'));
    } else {
      setBackButton(false);
    }
    return () => setBackButton(false);
  }, [settled, failed, navigate]);

  useEffect(() => {
    setMainButton({ isVisible: false });
  }, []);

  return (
    <div style={styles.container}>
      <style>{sceneCss}</style>
      {failed ? (
        <div style={{ ...styles.scene, maxWidth: 400 }}>
          <div style={styles.errorTitle}>Не получилось подобрать меню</div>
          <div style={styles.errorText}>
            {error || 'Попробуйте ещё раз, возможно, стоит изменить состав семьи, бюджет или исключения.'}
          </div>
          <button style={styles.backBtn} onClick={() => navigate('/menu/allergens')}>
            Назад к настройкам
          </button>
        </div>
      ) : (
        <div style={styles.scene}>
          <div key={stage} className="menu-gen-fade" style={styles.stage}>
            {stage === 0 && <SkilletScene />}
            {stage === 1 && <PotScene />}
            {stage === 2 && <KettleScene />}
          </div>
          <div key={`cap-${stage}`} style={styles.caption}>
            <span className="menu-gen-fade" style={{ display: 'inline-block' }}>
              {CAPTIONS[stage]}
            </span>
          </div>
          <div style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ ...styles.dot, ...(i === stage ? styles.dotActive : {}) }} />
            ))}
          </div>
          <div style={styles.hint}>Подбор обычно занимает меньше минуты — не закрывайте приложение</div>
        </div>
      )}
    </div>
  );
}