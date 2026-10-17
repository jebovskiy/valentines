import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { hapticFeedback, setBackButton, setMainButton } from '../utils/telegram';
import { getAnimation } from '../types';
import type { StreakDay, StreakDayPreview } from '../types';

interface SkyStar {
  day: string;
  label: string;
  count: number;
  latest: StreakDayPreview;
  who: 'm' | 'p';
  hasPhoto: boolean;
  size: 0 | 1 | 2;
  unseen: boolean;
  x: number;
  y: number;
  phase: number;
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

interface SkyLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const SKY_W = 300;
const SKY_H = 330;
const DUST_COUNT = 54;
const COMET_COUNT = 2;
const LAYOUT_SEED = 7;
// Golden angle: the sunflower (phyllotaxis) spread that keeps points evenly
// distributed in a disk for any count, from 1 star to a 365-star year.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const STAR_RADIUS = [3.2, 4.4, 5.6];
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

function dayLabel(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

function plural(n: number, one: string, few: string, many: string): string {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

const daysWord = (n: number) => plural(n, 'день', 'дня', 'дней');
const valentinesWord = (n: number) => plural(n, 'валентинка', 'валентинки', 'валентинок');

/**
 * Deterministic layout: stars are the pair-local days (oldest near the centre,
 * newest at the rim) placed on a golden-angle spiral, so the sky never overlaps
 * however long the streak grows. Calendar-consecutive days are joined into a
 * constellation. Dust and comets keep the same seed as the mockup.
 */
function buildSky(days: StreakDay[]): { stars: SkyStar[]; dust: DustDot[]; comets: Comet[]; lines: SkyLine[] } {
  const chrono = [...days].reverse();
  const n = chrono.length;
  const rnd = mulberry32(LAYOUT_SEED);
  const cx = SKY_W / 2;
  const cy = SKY_H / 2;
  const maxR = Math.min(SKY_W, SKY_H) / 2 - 18;

  const stars: SkyStar[] = chrono.map((d, i) => {
    const radius = n <= 1 ? 0 : maxR * Math.sqrt((i + 0.5) / n);
    const theta = i * GOLDEN_ANGLE;
    const x = Math.max(12, Math.min(SKY_W - 12, cx + Math.cos(theta) * radius + (rnd() - 0.5) * 4));
    const y = Math.max(14, Math.min(SKY_H - 14, cy + Math.sin(theta) * radius + (rnd() - 0.5) * 4));
    const hasPhoto = !!d.latest.photo_url;
    const size: 0 | 1 | 2 = hasPhoto || d.count >= 3 ? 2 : d.latest.message || d.count >= 2 ? 1 : 0;
    return {
      day: d.day,
      label: dayLabel(d.day),
      count: d.count,
      latest: d.latest,
      who: d.latest.is_own ? 'm' : 'p',
      hasPhoto,
      size,
      unseen: !d.latest.is_own && !d.latest.seen_at,
      x,
      y,
      phase: rnd() * Math.PI * 2,
    };
  });

  const lines: SkyLine[] = [];
  for (let i = 1; i < stars.length; i++) {
    if (dayDiff(stars[i].day, stars[i - 1].day) === 1) {
      lines.push({ x1: stars[i - 1].x, y1: stars[i - 1].y, x2: stars[i].x, y2: stars[i].y });
    }
  }

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

  return { stars, dust, comets, lines };
}

function sparkPath(x: number, y: number, r: number): string {
  return (
    `M${x},${y - r} Q${x},${y} ${x + r},${y} Q${x},${y} ${x},${y + r} ` +
    `Q${x},${y} ${x - r},${y} Q${x},${y} ${x},${y - r}Z`
  );
}

export function SkyScreen() {
  const navigate = useNavigate();
  const markSeen = useValentinesStore((s) => s.markSeen);
  const valentineCount = useValentinesStore((s) => s.valentines.length);

  const [days, setDays] = useState<StreakDay[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getStreakDays();
      if (res.error || !res.data) {
        setLoadError(true);
      } else {
        setDays(res.data.days ?? []);
        setLoadError(false);
      }
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, () => navigate('/'));
    return () => setBackButton(false);
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  // A new valentine (own or partner) can add a day: refetch once the store's list
  // actually changes, not on the initial hydration.
  const prevCount = useRef<number | null>(null);
  useEffect(() => {
    if (prevCount.current === null) {
      prevCount.current = valentineCount;
      return;
    }
    if (prevCount.current !== valentineCount) {
      prevCount.current = valentineCount;
      void load();
    }
  }, [valentineCount, load]);

  const { stars, dust, comets, lines } = useMemo(() => buildSky(days ?? []), [days]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  useEffect(() => {
    if (stars.length > 0 && !stars.some((s) => s.day === selectedDay)) {
      setSelectedDay(stars[stars.length - 1].day);
    }
  }, [stars, selectedDay]);

  const selected = stars.find((s) => s.day === selectedDay) ?? stars[stars.length - 1] ?? null;

  const [scale, setScale] = useState(1);
  const [lastTouchDist, setLastTouchDist] = useState(0);

  const hitRefs = useRef<(SVGCircleElement | null)[]>([]);

  const moveSelection = (delta: number) => {
    if (stars.length === 0) return;
    const cur = stars.findIndex((s) => s.day === selectedDay);
    const base = cur === -1 ? stars.length - 1 : cur;
    const next = (base + delta + stars.length) % stars.length;
    setSelectedDay(stars[next].day);
    requestAnimationFrame(() => hitRefs.current[next]?.focus());
  };

  const openValentine = (latest: StreakDayPreview) => {
    hapticFeedback('impact', 'light');
    if (!latest.is_own && !latest.seen_at) void markSeen(latest.id);
    navigate(`/valentine/${latest.id}`);
  };

  // Pinch-to-zoom. `touch-action: none` on the svg (CSS) already suppresses the
  // browser gesture, so this handler stays passive and never calls preventDefault
  // (which a passive React listener cannot honour anyway).
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      setLastTouchDist(Math.hypot(dx, dy));
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
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
    if (scale < 0.8) setScale(1);
  };

  const handleDoubleClick = () => {
    hapticFeedback('selection');
    setScale(1);
  };

  // Свайп вниз за верхнюю ручку — закрыть небо.
  const [pullY, setPullY] = useState(0);
  const pullStartY = useRef<number | null>(null);

  const handlePullStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    pullStartY.current = e.touches[0].clientY;
  };
  const handlePullMove = (e: React.TouchEvent) => {
    if (pullStartY.current === null || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - pullStartY.current;
    if (dy > 0) setPullY(Math.min(dy, 160));
  };
  const handlePullEnd = () => {
    if (pullY > 80) {
      hapticFeedback('impact', 'light');
      navigate('/');
    } else {
      setPullY(0);
    }
    pullStartY.current = null;
  };

  if (isLoading && stars.length === 0) {
    return (
      <div style={styles.containerImmersive}>
        <div style={styles.centerBox}>
          <div style={styles.spinner} />
          <p style={styles.mutedTextDark}>Загружаем наше небо...</p>
        </div>
      </div>
    );
  }

  if (loadError && stars.length === 0) {
    return (
      <div style={styles.containerImmersive}>
        <div style={styles.centerBox}>
          <p style={styles.mutedTextDark}>Не удалось загрузить небо</p>
          <button onClick={() => void load()} style={styles.retryButton}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...styles.containerImmersive,
        transform: pullY > 0 ? `translateY(${pullY}px)` : undefined,
        opacity: pullY > 0 ? Math.max(0.4, 1 - pullY / 220) : 1,
        transition: pullStartY.current === null ? 'transform 260ms ease, opacity 260ms ease' : 'none',
      }}
    >
      <div
        style={styles.pullHandleArea}
        onTouchStart={handlePullStart}
        onTouchMove={handlePullMove}
        onTouchEnd={handlePullEnd}
      >
        <span style={styles.title}>Наше небо</span>
        <div style={styles.pullGrip} />
      </div>

      {stars.length > 0 && (
        <div style={styles.subtitle}>
          {stars.length} {daysWord(stars.length)} · свайп вниз — назад
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
            <div style={styles.skyArea}>
              <svg
                viewBox={`0 0 ${SKY_W} ${SKY_H}`}
                width="100%"
                height="100%"
                preserveAspectRatio="xMidYMid meet"
                style={{
                  display: 'block',
                  transform: `scale(${scale})`,
                  transformOrigin: 'center center',
                  willChange: 'transform',
                  touchAction: 'none',
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onDoubleClick={handleDoubleClick}
                role="group"
                aria-label="Звёздное небо: стрелками выбирайте день, Enter — открыть валентинку"
              >
                <title>Наше небо</title>
                <defs>
                  <radialGradient id="skyCoreMe" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--sky-me-glow)" stopOpacity={0.95} />
                    <stop offset="60%" stopColor="var(--sky-me)" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="var(--sky-me)" stopOpacity={0} />
                  </radialGradient>
                  <radialGradient id="skyCorePartner" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--sky-partner)" stopOpacity={0.95} />
                    <stop offset="60%" stopColor="var(--sky-partner)" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="var(--sky-partner)" stopOpacity={0} />
                  </radialGradient>
                  <radialGradient id="skyCorePhoto" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--sky-photo-glow)" stopOpacity={0.95} />
                    <stop offset="60%" stopColor="var(--sky-photo)" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="var(--sky-photo)" stopOpacity={0} />
                  </radialGradient>
                  <radialGradient id="skyGlowMe" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--sky-me-glow)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--sky-me)" stopOpacity={0} />
                  </radialGradient>
                  <radialGradient id="skyGlowPartner" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--sky-partner)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--sky-partner)" stopOpacity={0} />
                  </radialGradient>
                  <radialGradient id="skyGlowPhoto" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--sky-photo-glow)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--sky-photo)" stopOpacity={0} />
                  </radialGradient>
                </defs>

                <rect width={SKY_W} height={SKY_H} fill="transparent" />

                {dust.map((d, i) => {
                  const isBright = i % 4 === 0;
                  return (
                    <circle
                      key={`d${i}`}
                      className={isBright ? 'sky-twinkle' : 'sky-twinkle-slow'}
                      cx={d.x.toFixed(1)}
                      cy={d.y.toFixed(1)}
                      r={d.r.toFixed(1)}
                      fill={isBright ? 'var(--sky-dust)' : 'var(--sky-faint)'}
                      opacity={isBright ? 0.9 : 0.25}
                      style={{ animationDelay: `${d.delay.toFixed(1)}s` }}
                    />
                  );
                })}

                {lines.map((l, i) => (
                  <line
                    key={`line-${i}`}
                    x1={l.x1.toFixed(1)}
                    y1={l.y1.toFixed(1)}
                    x2={l.x2.toFixed(1)}
                    y2={l.y2.toFixed(1)}
                    stroke="var(--sky-line)"
                    strokeWidth={1}
                    strokeLinecap="round"
                  />
                ))}

                {comets.map((c, i) => (
                  <line
                    key={`comet-${i}`}
                    className="sky-comet"
                    x1={c.startX.toFixed(1)}
                    y1={c.startY.toFixed(1)}
                    x2={c.endX.toFixed(1)}
                    y2={c.endY.toFixed(1)}
                    stroke="var(--sky-dust)"
                    strokeWidth={c.width.toFixed(1)}
                    strokeLinecap="round"
                    opacity={0.7}
                    style={{
                      animationDelay: `${c.delay.toFixed(1)}s`,
                      animationDuration: `${c.duration.toFixed(1)}s`,
                      filter: 'drop-shadow(0 0 3px var(--sky-dust))',
                    }}
                  />
                ))}

                {stars.map((s) => {
                  const glowId = s.hasPhoto ? 'skyGlowPhoto' : s.who === 'm' ? 'skyGlowMe' : 'skyGlowPartner';
                  const coreId = s.hasPhoto ? 'skyCorePhoto' : s.who === 'm' ? 'skyCoreMe' : 'skyCorePartner';
                  const r = STAR_RADIUS[s.size];
                  const isSelected = selected?.day === s.day;
                  return (
                    <g key={s.day}>
                      {isSelected && (
                        <circle
                          cx={s.x.toFixed(1)}
                          cy={s.y.toFixed(1)}
                          r={r + 9}
                          fill="none"
                          stroke="var(--sky-text)"
                          strokeWidth={1.5}
                        />
                      )}
                      {s.unseen && (
                        <circle
                          className="sky-pulse"
                          cx={s.x.toFixed(1)}
                          cy={s.y.toFixed(1)}
                          r={r + 4}
                          fill="none"
                          stroke={s.who === 'm' ? 'var(--sky-me)' : 'var(--sky-partner)'}
                          strokeWidth={1.5}
                        />
                      )}
                      <circle
                        className="sky-twinkle"
                        cx={s.x.toFixed(1)}
                        cy={s.y.toFixed(1)}
                        r={(r * 2.2).toFixed(1)}
                        fill={`url(#${glowId})`}
                        style={{ animationDelay: `${((s.phase / (Math.PI * 2)) * 3).toFixed(2)}s` }}
                      />
                      {s.hasPhoto ? (
                        <>
                          <path d={sparkPath(s.x, s.y, r * 2.4)} fill="var(--sky-photo)" opacity={0.9} />
                          <circle cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={(r * 1.3).toFixed(1)} fill={`url(#${coreId})`} />
                          <circle cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={(r * 0.5).toFixed(1)} fill="#FFF8E8" />
                        </>
                      ) : (
                        <circle cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={r} fill={`url(#${coreId})`} />
                      )}
                    </g>
                  );
                })}

                {stars.map((s, i) => (
                  <circle
                    key={`hit-${s.day}`}
                    ref={(el) => {
                      hitRefs.current[i] = el;
                    }}
                    className="sky-hit"
                    cx={s.x.toFixed(1)}
                    cy={s.y.toFixed(1)}
                    r={18}
                    fill="transparent"
                    tabIndex={selected?.day === s.day ? 0 : -1}
                    role="button"
                    aria-label={`${s.label}: ${s.count} ${valentinesWord(s.count)}, ${s.who === 'm' ? 'от вас' : 'от партнёра'}`}
                    onFocus={() => setSelectedDay(s.day)}
                    onClick={() => {
                      hapticFeedback('selection');
                      setSelectedDay(s.day);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        moveSelection(1);
                      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        moveSelection(-1);
                      } else if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedDay(s.day);
                        openValentine(s.latest);
                      }
                    }}
                  />
                ))}
              </svg>
            </div>

            <div style={styles.legend}>
              <span style={styles.legendItem}>
                <span style={{ ...styles.legendDot, background: 'var(--sky-me)' }} />
                Вы
              </span>
              <span style={styles.legendItem}>
                <span style={{ ...styles.legendDot, background: 'var(--sky-partner)' }} />
                Партнёр
              </span>
              <span style={styles.legendItem}>
                <span style={{ ...styles.legendDot, border: '1px solid var(--sky-partner)' }} />
                Не открыта
              </span>
              <span>Крупнее — больше в день</span>
            </div>

            {selected && (
              <div style={styles.card}>
                <div style={styles.cardMeta}>
                  <span
                    style={{
                      ...styles.legendDot,
                      background: selected.who === 'm' ? 'var(--sky-me)' : 'var(--sky-partner)',
                    }}
                  />
                  <span style={styles.cardWho}>{selected.who === 'm' ? 'Вы' : 'Партнёр'}</span>
                  <span>{selected.label}</span>
                  {selected.unseen && <span style={styles.badgeNew}>Новая</span>}
                </div>
                {selected.count > 1 && (
                  <div style={styles.cardCount}>
                    {selected.count} {valentinesWord(selected.count)} за день
                  </div>
                )}
                <div
                  style={{
                    ...styles.cardText,
                    color: selected.latest.message
                      ? 'var(--sky-text)'
                      : selected.hasPhoto
                        ? 'var(--sky-muted)'
                        : 'var(--sky-faint)',
                  }}
                >
                  {selected.latest.message || (selected.hasPhoto ? 'изображение' : 'Без текста')}
                </div>
                <div style={styles.cardFooter}>
                  <span style={styles.cardHint}>
                    Анимация: {getAnimation(selected.latest.animation_type).label}
                    {selected.hasPhoto ? ' · с фото' : ''}
                  </span>
                  <button onClick={() => openValentine(selected.latest)} style={styles.openBtn}>
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
  containerImmersive: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '6px 12px calc(10px + var(--app-bottom-inset))',
    height: '100dvh',
    maxHeight: '100dvh',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    background: 'linear-gradient(180deg, var(--sky-bg-top), var(--sky-bg-bottom))',
  },
  pullHandleArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '6px 0 2px',
    touchAction: 'none',
    cursor: 'grab',
  },
  pullGrip: {
    width: 40,
    height: 5,
    borderRadius: 999,
    background: 'var(--sky-grip)',
  },
  mutedTextDark: {
    color: 'var(--sky-muted)',
    fontSize: 14,
    maxWidth: 280,
    lineHeight: 1.5,
  },
  title: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--sky-text)',
    fontFamily: 'var(--font-display)',
    pointerEvents: 'none',
    textShadow: '0 0 14px rgba(255,255,255,0.2)',
  },
  subtitle: {
    fontSize: 12,
    color: 'var(--sky-muted)',
    textAlign: 'center',
    marginTop: -2,
  },
  panelImmersive: {
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    padding: 0,
    overflow: 'hidden',
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  skyArea: {
    flex: 1,
    minHeight: 240,
    position: 'relative',
  },
  legend: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    padding: '8px 16px',
    fontSize: 11,
    color: 'var(--sky-muted)',
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
    background: 'var(--sky-panel)',
    border: '1px solid var(--sky-border)',
    borderRadius: 20,
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
    color: 'var(--sky-muted)',
  },
  cardWho: {
    color: 'var(--sky-text)',
    fontWeight: 500,
  },
  badgeNew: {
    marginLeft: 'auto',
    background: '#3a1a22',
    color: 'var(--sky-me-glow)',
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 11,
  },
  cardCount: {
    fontSize: 12,
    color: 'var(--sky-muted)',
    marginTop: 6,
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
    color: 'var(--sky-muted)',
  },
  openBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    background: 'var(--sky-me)',
    color: 'var(--sky-text)',
    border: 'none',
    borderRadius: 999,
    padding: '0 16px',
    height: 44,
    minHeight: 44,
    fontSize: 14,
    fontWeight: 700,
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
    border: '2px solid var(--sky-border)',
    borderTopColor: 'var(--sky-me)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  retryButton: {
    padding: '0 16px',
    height: 44,
    minHeight: 44,
    background: 'var(--sky-me)',
    color: 'var(--sky-text)',
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
    color: 'var(--sky-text)',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 1.5,
    color: 'var(--sky-muted)',
    maxWidth: 260,
  },
  emptyAction: {
    marginTop: 6,
    padding: '0 16px',
    height: 44,
    minHeight: 44,
    background: 'var(--sky-me)',
    color: 'var(--sky-text)',
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 14,
    border: 'none',
    cursor: 'pointer',
    WebkitAppearance: 'none' as const,
  },
};
