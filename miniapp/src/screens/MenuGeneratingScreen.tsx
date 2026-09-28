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

@keyframes mg-flame {
  0%, 100% { transform: scale(1) translateY(0); opacity: .85; }
  35% { transform: scale(1.08) translateY(-2px); opacity: 1; }
  70% { transform: scale(.96) translateY(1px); opacity: .7; }
}
.mg-flame > path { animation: mg-flame 1.1s ease-in-out infinite; transform-origin: 50% 100%; }
.mg-flame > path:nth-child(2) { animation-delay: -.4s; }
.mg-flame > path:nth-child(3) { animation-delay: -.8s; }

@keyframes mg-toss {
  0% { transform: translate(0, 0) rotate(0deg); }
  28% { transform: translate(4px, -42px) rotate(-9deg); }
  52% { transform: translate(-6px, -48px) rotate(11deg); }
  76% { transform: translate(3px, -14px) rotate(-4deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
.mg-toss { animation: mg-toss 1.7s cubic-bezier(.45, .05, .55, .95) infinite; }

@keyframes mg-steam {
  0% { opacity: 0; transform: translateY(10px) translateX(0) scale(.9); }
  40% { opacity: .75; }
  100% { opacity: 0; transform: translateY(-28px) translateX(7px) scale(1.05); }
}
.mg-steam path { animation: mg-steam 2.2s ease-out infinite; }
.mg-steam path:nth-child(2) { animation-delay: -.75s; }
.mg-steam path:nth-child(3) { animation-delay: -1.5s; }

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

@keyframes mg-rock {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  45% { transform: translateY(-3px) rotate(2.2deg); }
  55% { transform: translateY(0) rotate(-.5deg); }
}
.mg-rock { animation: mg-rock 3.8s ease-in-out infinite; transform-origin: 110px 118px; }
`;

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    padding: '18px 16px calc(28px + env(safe-area-inset-bottom))',
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
    <svg viewBox="0 0 220 170" width={220} height={170} fill="none">
      <defs>
        <linearGradient id="mg-pan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#94a3b8" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
      </defs>
      <g className="mg-flame">
        <path d="M104 152 q-17 -17 -4 -35 q-6 12 -11 9 q-18 23 2 40 z" fill="#f97316" />
        <path d="M113 152 q-11 -13 -3 -26 q-5 9 -10 7 q-12 20 1 35 z" fill="#fbbf24" />
        <path d="M97 156 q-5 -9 0 -15 q-3 6 -6 5 q-6 11 1 18 z" fill="#fdba74" />
        <path d="M118 154 q-3 -7 0 -13 q-3 5 -6 4 q-5 11 1 18 z" fill="#fdba74" />
      </g>
      <rect x="152" y="78" width="56" height="13" rx="6.5" fill="#92400e" />
      <rect x="202" y="80" width="9" height="8" rx="4" fill="#78350f" />
      <ellipse cx="104" cy="82" rx="58" ry="14" fill="#334155" />
      <ellipse cx="104" cy="76" rx="58" ry="15" fill="url(#mg-pan)" />
      <ellipse cx="96" cy="72" rx="36" ry="8" fill="#1e293b" />
      <g className="mg-steam">
        <path d="M62 50 q3 -11 -1 -17" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
        <path d="M76 46 q3 -13 -2 -20" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
        <path d="M90 50 q3 -10 -1 -15" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
      </g>
      <g className="mg-toss" style={{ transformOrigin: '104px 62px' }}>
        <ellipse cx="104" cy="62" rx="22" ry="13" fill="#fef3c7" />
        <circle cx="106" cy="66" r="10" fill="#f59e0b" />
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
    <svg viewBox="0 0 220 170" width={220} height={170} fill="none">
      <defs>
        <linearGradient id="mg-kettle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#94a3b8" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
      </defs>
      <g className="mg-steam" style={{ transformOrigin: '158px 40px' }}>
        <path d="M150 38 q4 -12 0 -20" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
        <path d="M160 34 q4 -14 -1 -22" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
        <path d="M170 40 q4 -12 0 -18" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
      </g>
      <g className="mg-rock">
        <ellipse cx="110" cy="120" rx="50" ry="9" fill="#1e293b" />
        <path d="M62 54 q44 -36 98 -6" stroke="#334155" strokeWidth="9" strokeLinecap="round" />
        <ellipse cx="112" cy="28" rx="30" ry="7" fill="#94a3b8" />
        <ellipse cx="106" cy="68" rx="48" ry="46" fill="url(#mg-kettle)" />
        <path d="M150 62 q24 -6 22 -26" stroke="#475569" strokeWidth="10" strokeLinecap="round" />
        <ellipse cx="100" cy="40" rx="16" ry="8" fill="#cbd5e1" opacity=".35" />
        <ellipse cx="110" cy="112" rx="44" ry="7" fill="#334155" opacity=".8" />
      </g>
    </svg>
  );
}

export function MenuGeneratingScreen() {
  const navigate = useNavigate();
  const { menuLoading, menuResult, error } = useValentinesStore();
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