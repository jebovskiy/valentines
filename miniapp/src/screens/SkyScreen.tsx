import { shallow } from 'zustand/shallow';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { BackButton } from '../components/BackButton';
import { hapticFeedback, setBackButton, setMainButton } from '../utils/telegram';
import { getAnimation } from '../types';
import type { ValentineWithSender } from '../types';

type SkyFilter = 'all' | 'm' | 'p';

interface SkyStar {
  id: string;
  valentine: ValentineWithSender;
  day: string;
  dayKey: number;
  time: string;
  who: 'm' | 'p';
  size: 0 | 1 | 2;
  x: number;
  y: number;
  twinklePhase: number;
  hueShift: number;
}

interface DustDot {
  x: number;
  y: number;
  r: number;
  delay: number;
}

interface Comet {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  delay: number;
  duration: number;
  width: number;
}

const ME_COLOR = '#F2C16B';
const PARTNER_COLOR = '#F29BBD';
const ME_GLOW = '#FFE08A';
const PARTNER_GLOW = '#F7C5D6';
const PHOTO_COLOR = '#E8EBFA';
const PHOTO_GLOW = '#F5F5FF';
const STAR_RADIUS = [3.2, 4.4, 5.6];
const SKY_W = 300;
const SKY_H = 330;
const DUST_COUNT = 54;
const COMET_COUNT = 2;
const LAYOUT_SEED = 7;
const SERIES_DAYS = 7;
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function starParts(iso: string): { day: string; dayKey: number; time: string } {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return {
    day: `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`,
    dayKey: d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(),
    time: `${hh}:${mm}`,
  };
}

/** Deterministic layout: stars spread left→right, dust keeps the same seed as the mockup. */
function buildSky(valentines: ValentineWithSender[]): { stars: SkyStar[]; dust: DustDot[]; comets: Comet[] } {
  const rnd = mulberry32(LAYOUT_SEED);
  const stars: SkyStar[] = [];
  const n = valentines.length;

  valentines.forEach((v, i) => {
    const { day, dayKey, time } = starParts(v.sent_at);
    const size: 0 | 1 | 2 = v.photo_url ? 2 : v.message ? 1 : 0;
    let x = SKY_W / 2;
    let y = SKY_H / 2;
    let placed = false;
    for (let attempt = 0; attempt < 30 && !placed; attempt++) {
      x = n > 1 ? 20 + (i * 260) / (n - 1) + (rnd() - 0.5) * 14 : SKY_W / 2;
      y = 38 + rnd() * 250;
      placed = stars.every((s) => Math.hypot(s.x - x, s.y - y) > 24);
    }
    stars.push({
      id: v.id,
      valentine: v,
      day,
      dayKey,
      time,
      who: v.is_own ? 'm' : 'p',
      size,
      x,
      y,
      twinklePhase: rnd() * Math.PI * 2,
      hueShift: (rnd() - 0.5) * 12,
    });
  });

  const dust: DustDot[] = Array.from({ length: DUST_COUNT }, () => ({
    x: rnd() * SKY_W,
    y: rnd() * SKY_H,
    r: 0.5 + rnd() * 0.6,
    delay: rnd() * 3,
  }));

  const comets: Comet[] = Array.from({ length: COMET_COUNT }, () => ({
    startX: -40 + rnd() * 60,
    startY: 60 + rnd() * 120,
    endX: SKY_W + 40 - rnd() * 60,
    endY: SKY_H - 60 - rnd() * 120,
    delay: rnd() * 8,
    duration: 6 + rnd() * 3,
    width: 1.5 + rnd() * 1,
  }));

  return { stars, dust, comets };
}

function sparkPath(x: number, y: number, r: number): string {
  return (
    `M${x},${y - r} Q${x},${y} ${x + r},${y} Q${x},${y} ${x},${y + r} ` +
    `Q${x},${y} ${x - r},${y} Q${x},${y} ${x},${y - r}Z`
  );
}

function starsWord(n: number): string {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return 'звезда';
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'звезды';
  return 'звезд';
}

function daysWord(n: number): string {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return 'день';
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'дня';
  return 'дней';
}

export function SkyScreen() {
  const navigate = useNavigate();
  const { valentines, isLoading, error, fetchValentines, markSeen } = useValentinesStore(
    (s) => ({
      valentines: s.valentines,
      isLoading: s.isLoading,
      error: s.error,
      fetchValentines: s.fetchValentines,
      markSeen: s.markSeen,
    }),
    shallow,
  );

  const [filter, setFilter] = useState<SkyFilter>('all');
  const [showSeries, setShowSeries] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, () => navigate('/'));
    return () => setBackButton(false);
  }, [navigate]);

  const sorted = useMemo(
    () =>
      [...valentines].sort(
        (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime(),
      ),
    [valentines],
  );
  const { stars, dust, comets } = useMemo(() => buildSky(sorted), [sorted]);

  const uniqueDays = useMemo(() => {
    const days: number[] = [];
    stars.forEach((s) => {
      if (!days.includes(s.dayKey)) days.push(s.dayKey);
    });
    return days;
  }, [stars]);

  const seriesPoints = useMemo(() => {
    const recent = uniqueDays.slice(-SERIES_DAYS);
    return recent
      .map((day) => stars.find((s) => s.dayKey === day))
      .filter((s): s is SkyStar => Boolean(s))
      .map((s) => `${s.x.toFixed(1)},${s.y.toFixed(1)}`)
      .join(' ');
  }, [stars, uniqueDays]);

  const visible = useMemo(
    () => stars.filter((s) => filter === 'all' || s.who === filter),
    [stars, filter],
  );
  const selected = visible.find((s) => s.id === selectedId) ?? visible[visible.length - 1] ?? null;

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [lastTouchDist, setLastTouchDist] = useState(0);

  const openValentine = (v: ValentineWithSender) => {
    hapticFeedback('impact', 'light');
    if (!v.seen_at) void markSeen(v.id);
    navigate(`/valentine/${v.id}`);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      setLastTouchDist(Math.hypot(dx, dy));
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (lastTouchDist > 0) {
        const ns = Math.max(0.6, Math.min(1.8, scale * (dist / lastTouchDist)));
        setScale(ns);
      }
      setLastTouchDist(dist);
    }
  };

  const handleTouchEnd = () => {
    setLastTouchDist(0);
    if (scale < 0.8) {
      setScale(1);
      setPan({ x: 0, y: 0 });
    }
  };

  const handleDoubleClick = () => {
    hapticFeedback('selection');
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  if (isLoading && stars.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.centerBox}>
          <div style={styles.spinner} />
          <p style={styles.mutedText}>Загружаем наше небо...</p>
        </div>
      </div>
    );
  }

  if (error && stars.length === 0 && !error.toLowerCase().includes('pair not found')) {
    return (
      <div style={styles.container}>
        <div style={styles.centerBox}>
          <p style={styles.mutedText}>{error}</p>
          <button onClick={() => void fetchValentines()} style={styles.retryButton}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  const seriesLen = Math.min(uniqueDays.length, SERIES_DAYS);

  return (
    <div style={styles.containerImmersive}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>Наше небо</span>
        <button
          onClick={() => {
            hapticFeedback('selection');
            setScale(1);
            setPan({ x: 0, y: 0 });
          }}
          style={styles.resetBtn}
          aria-label="Сбросить масштаб"
        >
          ⟳
        </button>
      </div>

      {stars.length > 0 && (
        <div style={styles.subtitle}>
          {stars.length} {starsWord(stars.length)} · серия {seriesLen} {daysWord(seriesLen)}
        </div>
      )}

      <div style={styles.panelImmersive}>
        {stars.length === 0 ? (
          <div style={styles.emptyBox}>
            <div style={styles.emptyTitle}>Небо пока пустое</div>
            <div style={styles.emptyText}>
              Отправьте первую валентинку — и она станет первой звездой вашего неба
            </div>
            <button
              onClick={() => {
                hapticFeedback('impact', 'light');
                navigate('/send');
              }}
              style={styles.emptyAction}
            >
              Отправить валентинку
            </button>
          </div>
        ) : (
          <>
            <div style={styles.chips}>
              {(
                [
                  { key: 'all', label: 'Все' },
                  { key: 'm', label: 'От вас' },
                  { key: 'p', label: 'От партнёра' },
                ] as { key: SkyFilter; label: string }[]
              ).map((c) => (
                <button
                  key={c.key}
                  aria-pressed={filter === c.key}
                  onClick={() => {
                    hapticFeedback('selection');
                    setFilter(c.key);
                  }}
                  style={{ ...styles.chip, ...(filter === c.key ? styles.chipActive : {}) }}
                >
                  {c.label}
                </button>
              ))}
              <button
                aria-pressed={showSeries}
                onClick={() => {
                  hapticFeedback('selection');
                  setShowSeries((v) => !v);
                }}
                style={{ ...styles.chip, ...(showSeries ? styles.chipActive : {}) }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="6" cy="19" r="3" />
                  <circle cx="18" cy="5" r="3" />
                  <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
                </svg>
                Серия
              </button>
            </div>

            <svg
              viewBox={`0 0 ${SKY_W} ${SKY_H}`}
              width="100%"
              height="100%"
              style={{
                display: 'block',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: 'center center',
                willChange: 'transform',
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onDoubleClick={handleDoubleClick}
              role="img"
              aria-label="Звёздное небо валентинок"
            >
              <defs>
                <filter id="starGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect width={SKY_W} height={SKY_H} fill="#0B0F24" />
              {dust.map((d, i) => {
                const isBright = i % 4 === 0;
                const color = isBright ? '#B8C4F0' : '#7A86B8';
                const opacity = isBright ? 0.9 : 0.25;
                return (
                  <circle
                    key={`d${i}`}
                    className={isBright ? 'sky-twinkle' : 'sky-twinkle-slow'}
                    cx={d.x.toFixed(1)}
                    cy={d.y.toFixed(1)}
                    r={d.r.toFixed(1)}
                    fill={color}
                    opacity={opacity}
                    style={{ animationDelay: `${d.delay.toFixed(1)}s` }}
                  />
                );
              })}
              {comets.map((c, i) => (
                <line
                  key={`comet-${i}`}
                  className="sky-comet"
                  x1={c.startX.toFixed(1)}
                  y1={c.startY.toFixed(1)}
                  x2={c.endX.toFixed(1)}
                  y2={c.endY.toFixed(1)}
                  stroke="#E8EBFA"
                  strokeWidth={c.width.toFixed(1)}
                  strokeLinecap="round"
                  opacity={0.7}
                  style={{
                    animationDelay: `${c.delay.toFixed(1)}s`,
                    animationDuration: `${c.duration.toFixed(1)}s`,
                    filter: 'drop-shadow(0 0 3px #E8EBFA)',
                  }}
                />
              ))}

              {showSeries && seriesPoints && (
                <polyline
                  points={seriesPoints}
                  fill="none"
                  stroke="#8E97C4"
                  strokeWidth={1}
                  strokeDasharray="3 4"
                  opacity={0.55}
                />
              )}

              {stars.map((s) => {
                const color = s.who === 'm' ? ME_COLOR : PARTNER_COLOR;
                const glow = s.who === 'm' ? ME_GLOW : PARTNER_GLOW;
                const isPhoto = s.size === 2;
                const photoColor = isPhoto ? PHOTO_COLOR : color;
                const photoGlow = isPhoto ? PHOTO_GLOW : glow;
                const r = STAR_RADIUS[s.size];
                const unseen = !s.valentine.is_own && !s.valentine.seen_at;
                const inFilter = filter === 'all' || s.who === filter;
                const isSelected = selected?.id === s.id;
                return (
                  <g key={s.id} className="sky-star" opacity={inFilter ? 1 : 0.18} style={{ animationDelay: `${(s.twinklePhase / (Math.PI * 2) * 6).toFixed(2)}s` }}>
                    <defs>
                      <radialGradient id={`grad-${s.id}`} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={isPhoto ? PHOTO_COLOR : glow} stopOpacity={0.9} />
                        <stop offset="70%" stopColor={photoColor} stopOpacity={0.7} />
                        <stop offset="100%" stopColor={photoColor} stopOpacity={0} />
                      </radialGradient>
                      <radialGradient id={`glow-${s.id}`} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={photoGlow} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={photoColor} stopOpacity={0} />
                      </radialGradient>
                    </defs>
                    {unseen && (
                      <circle
                        className="sky-pulse"
                        cx={s.x.toFixed(1)}
                        cy={s.y.toFixed(1)}
                        r={r + 4}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.5}
                      />
                    )}
                    <circle
                      className="sky-twinkle"
                      cx={s.x.toFixed(1)}
                      cy={s.y.toFixed(1)}
                      r={(r * 2.2).toFixed(1)}
                      fill={`url(#glow-${s.id})`}
                      style={{ animationDelay: `${(s.twinklePhase / (Math.PI * 2) * 3).toFixed(2)}s` }}
                    />
                    {isPhoto ? (
                      <>
                        <path d={sparkPath(s.x, s.y, r * 2.4)} fill={photoColor} opacity={0.9} />
                        <circle cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={(r * 1.3).toFixed(1)} fill={`url(#grad-${s.id})`} />
                        <circle cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={(r * 0.5).toFixed(1)} fill="#FFF8E8" />
                      </>
                    ) : (
                      <circle cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={r} fill={`url(#grad-${s.id})`} />
                    )}
                    {isSelected && (
                      <circle
                        cx={s.x.toFixed(1)}
                        cy={s.y.toFixed(1)}
                        r={r + 9}
                        fill="none"
                        stroke="#E8EBFA"
                        strokeWidth={1.5}
                      />
                    )}
                  </g>
                );
              })}

              {stars.map((s) => {
                const inFilter = filter === 'all' || s.who === filter;
                if (!inFilter) return null;
                return (
                  <circle
                    key={`hit-${s.id}`}
                    className="sky-hit"
                    cx={s.x.toFixed(1)}
                    cy={s.y.toFixed(1)}
                    r={14}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`Валентинка, ${s.who === 'm' ? 'от вас' : 'от партнёра'}, ${s.day}`}
                    onClick={() => {
                      hapticFeedback('selection');
                      setSelectedId(s.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        hapticFeedback('selection');
                        setSelectedId(s.id);
                      }
                    }}
                  />
                );
              })}
            </svg>

            <div style={styles.legend}>
              <span style={styles.legendItem}>
                <span style={{ ...styles.legendDot, background: ME_COLOR }} />
                Вы
              </span>
              <span style={styles.legendItem}>
                <span style={{ ...styles.legendDot, background: PARTNER_COLOR }} />
                Партнёр
              </span>
              <span style={styles.legendItem}>
                <span style={{ ...styles.legendDot, border: `1px solid ${PARTNER_COLOR}` }} />
                Не открыта
              </span>
              <span>Крупнее: с текстом, с фото</span>
            </div>

            {selected && (
              <div style={styles.card}>
                <div style={styles.cardMeta}>
                  <span
                    style={{
                      ...styles.legendDot,
                      background: selected.who === 'm' ? ME_COLOR : PARTNER_COLOR,
                    }}
                  />
                  <span style={styles.cardWho}>{selected.who === 'm' ? 'Вы' : 'Партнёр'}</span>
                  <span>
                    {selected.day}, {selected.time}
                  </span>
                  {!selected.valentine.is_own && !selected.valentine.seen_at && (
                    <span style={styles.badgeNew}>Новая</span>
                  )}
                </div>
                <div
                  style={{
                    ...styles.cardText,
                    color: selected.valentine.message ? '#E8EBFA' : selected.valentine.photo_url ? '#C9D0F0' : '#8E97C4',
                  }}
                >
                  {selected.valentine.message || (selected.valentine.photo_url ? 'изображение' : 'Без текста')}
                </div>
                <div style={styles.cardFooter}>
                  <span style={styles.cardHint}>
                    Анимация: {getAnimation(selected.valentine.animation_type).label}
                    {selected.size === 2 ? ' · с фото' : ''}
                  </span>
                  <button
                    onClick={() => openValentine(selected.valentine)}
                    style={styles.openBtn}
                  >
                    Открыть
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '16px 16px 24px',
    maxWidth: 480,
    margin: '0 auto',
    minHeight: '100%',
    boxSizing: 'border-box',
  },
  containerImmersive: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '10px 12px 12px',
    height: '100dvh',
    maxHeight: '100dvh',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    background: '#070A1C',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    height: 44,
    position: 'relative',
  },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--ink)',
    fontFamily: 'var(--font-display)',
    zIndex: 1,
    pointerEvents: 'none',
  },
  subtitle: {
    fontSize: 12,
    color: 'var(--text-faint)',
    textAlign: 'center',
    marginTop: -4,
  },
  resetBtn: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: 'rgba(232,235,250,0.1)',
    color: '#E8EBFA',
    border: '1px solid rgba(232,235,250,0.2)',
    fontSize: 16,
    lineHeight: 1,
    padding: 0,
    cursor: 'pointer',
    zIndex: 2,
    WebkitAppearance: 'none' as const,
  },
  panel: {
    background: '#0F1530',
    border: '1px solid #1B1F33',
    borderRadius: 24,
    padding: '12px 0',
    overflow: 'hidden',
  },
  panelImmersive: {
    background: '#070A1C',
    border: '1px solid #151937',
    borderRadius: 18,
    padding: 0,
    overflow: 'hidden',
    flex: 1,
    minHeight: 0,
    display: 'flex',
  },
  chips: {
    display: 'flex',
    gap: 6,
    padding: '0 16px 10px',
    flexWrap: 'wrap',
  },
  chip: {
    background: '#1A2142',
    color: '#C9D0F0',
    border: '0.5px solid #2B3566',
    borderRadius: 999,
    padding: '0 12px',
    height: 28,
    fontSize: 12,
    lineHeight: '26px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    WebkitAppearance: 'none' as const,
  },
  chipActive: {
    background: '#2B3566',
    color: '#fff',
    borderColor: '#4A57A0',
  },
  legend: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    padding: '8px 16px',
    fontSize: 11,
    color: '#8E97C4',
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    display: 'inline-block',
    flex: 'none',
    boxSizing: 'border-box',
  },
  card: {
    margin: '4px 12px 0',
    background: '#1A2142',
    borderRadius: 16,
    padding: '12px 14px',
    minHeight: 116,
    display: 'flex',
    flexDirection: 'column',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: '#8E97C4',
  },
  cardWho: {
    color: '#E8EBFA',
    fontWeight: 500,
  },
  badgeNew: {
    marginLeft: 'auto',
    background: '#3A2440',
    color: '#F29BBD',
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 11,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 1.5,
    margin: '8px 0 10px',
    minHeight: 22,
    wordBreak: 'break-word',
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 'auto',
  },
  cardHint: {
    fontSize: 12,
    color: '#8E97C4',
  },
  openBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: '#E8EBFA',
    color: '#0F1530',
    border: 'none',
    borderRadius: 999,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    WebkitAppearance: 'none' as const,
  },
  centerBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    minHeight: '60vh',
    textAlign: 'center',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '2px solid var(--hairline-soft)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  mutedText: {
    color: 'var(--text-secondary)',
    fontSize: 14,
    maxWidth: 280,
    lineHeight: 1.5,
  },
  retryButton: {
    padding: '12px 14px',
    height: 40,
    background: 'var(--primary)',
    color: 'var(--on-primary)',
    borderRadius: 16,
    fontWeight: 700,
    fontSize: 14,
    border: 'none',
    cursor: 'pointer',
  },
  emptyBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '32px 20px',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: '#E8EBFA',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 1.5,
    color: '#8E97C4',
    maxWidth: 260,
  },
  emptyAction: {
    marginTop: 6,
    padding: '10px 16px',
    height: 40,
    background: '#E8EBFA',
    color: '#0F1530',
    borderRadius: 999,
    fontWeight: 600,
    fontSize: 14,
    border: 'none',
    cursor: 'pointer',
    WebkitAppearance: 'none' as const,
  },
};
