import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { api } from '../api/client';
import { hapticFeedback, popBackButton, pushBackButton } from '../utils/telegram';
import { AppleEmoji } from './AppleEmoji';
import { Spotlight, SpotlightRect, rectOf } from './Spotlight';

type SheetPhase = 'closed' | 'opening' | 'open' | 'closing';

const ONBOARD_FLAG = 'has_seen_navigation_onboarding_v1';
const SEEN_KEY = (id: number) => `valentines_nav_seen_${id}`;

interface SeenSnapshot {
  notes: number;
  want: number;
  watched: number;
  streak: number;
}

function loadSeen(id: number | null): SeenSnapshot | null {
  if (id == null) return null;
  try {
    const raw = localStorage.getItem(SEEN_KEY(id));
    return raw ? (JSON.parse(raw) as SeenSnapshot) : null;
  } catch {
    return null;
  }
}

function saveSeen(id: number | null, s: SeenSnapshot) {
  if (id == null) return;
  try {
    localStorage.setItem(SEEN_KEY(id), JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function daysWord(n: number): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a >= 11 && a <= 14) return 'дней';
  if (b === 1) return 'день';
  if (b >= 2 && b <= 4) return 'дня';
  return 'дней';
}

const EASE_OUT_SHEET = '320ms cubic-bezier(0.32, 0.72, 0, 1) 20ms';
const EASE_IN_SHEET = '260ms cubic-bezier(0.4, 0, 1, 1)';
const EASE_OUT_SCRIM = 'opacity 200ms ease-out';
const EASE_IN_SCRIM = 'opacity 200ms ease-in 120ms';
const EASE_HANDLE = 'transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1) 320ms';

const ONBOARD_COPY: Record<number, { title: string; text: string; btn: string }> = {
  1: {
    title: 'Больше, чем валентинки',
    text: 'Заметки, фильмы и стрик теперь в одном месте. Нажмите на аватар, чтобы открыть разделы.',
    btn: 'Далее',
  },
  2: {
    title: 'Общие дела и фильмы',
    text: 'Держите заметки, выбирайте фильмы на вечер — всё под рукой.',
    btn: 'Далее',
  },
  3: {
    title: 'Не теряйте стрик',
    text: 'Отправляйте валентинки каждый день и заполняйте календарь.',
    btn: 'Понятно',
  },
};

export function NavSheet() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    notes,
    movies,
    streak,
    profile,
    partnerProfile,
    currentUser,
    fetchNotes,
    fetchMovies,
    fetchStreak,
  } = useValentinesStore();

  const userId = currentUser?.id ?? null;

  const want = movies.filter((m) => m.status === 'want_to_watch').length;
  const watched = movies.filter((m) => m.status === 'watched').length;
  const streakDays = streak?.current ?? 0;

  const [phase, setPhase] = useState<SheetPhase>('closed');
  const [press, setPress] = useState(false);
  const [badge, setBadge] = useState(0);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [spotRects, setSpotRects] = useState<SpotlightRect[]>([]);

  const avatarRef = useRef<HTMLButtonElement>(null);
  const notesRef = useRef<HTMLButtonElement>(null);
  const moviesRef = useRef<HTMLButtonElement>(null);
  const streakRef = useRef<HTMLButtonElement>(null);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const stepRef = useRef(step);
  stepRef.current = step;

  const onboardingActive = step > 0;
  const onboardingActiveRef = useRef(onboardingActive);
  onboardingActiveRef.current = onboardingActive;

  const dismiss = (opts: { force?: boolean; then?: () => void } = {}) => {
    if (phaseRef.current === 'closed') {
      opts.then?.();
      return;
    }
    if (phaseRef.current === 'closing') return;
    if (!opts.force && onboardingActiveRef.current) return;
    if (!onboardingActiveRef.current) popBackButton();
    setPhase('closing');
    window.setTimeout(() => {
      setPhase('closed');
      opts.then?.();
    }, 260);
  };

  const openSheet = () => {
    if (onboardingActiveRef.current && stepRef.current === 1) return;
    if (phaseRef.current !== 'closed') return;
    hapticFeedback('impact', 'light');
    setPhase('opening');
    requestAnimationFrame(() => requestAnimationFrame(() => setPhase('open')));
    if (!onboardingActiveRef.current) {
      pushBackButton(() => dismiss());
      void (async () => {
        await Promise.all([fetchNotes(), fetchMovies(), fetchStreak()]);
        const s = useValentinesStore.getState();
        saveSeen(userId, {
          notes: s.notes.length,
          want: s.movies.filter((m) => m.status === 'want_to_watch').length,
          watched: s.movies.filter((m) => m.status === 'watched').length,
          streak: s.streak?.current ?? 0,
        });
        setBadge(0);
      })();
    } else {
      void fetchNotes();
      void fetchMovies();
      void fetchStreak();
    }
  };

  const goTo = (path: string) => {
    if (onboardingActiveRef.current) return;
    hapticFeedback('impact', 'light');
    dismiss({ then: () => navigate(path) });
  };

  const handleAvatarPress = () => {
    setPress(true);
    window.setTimeout(() => setPress(false), 120);
  };

  useEffect(() => {
    void fetchNotes();
    void fetchMovies();
    void fetchStreak();
  }, [fetchNotes, fetchMovies, fetchStreak]);

  useEffect(() => {
    const seen = loadSeen(userId);
    if (!seen) {
      setBadge(0);
      return;
    }
    const delta = (cur: number, prev: number) => Math.max(0, cur - prev);
    setBadge(
      delta(notes.length, seen.notes) +
        delta(want, seen.want) +
        delta(watched, seen.watched) +
        delta(streakDays, seen.streak),
    );
  }, [notes, movies, streak, userId]);

  useEffect(() => {
    if (step !== 0) return;
    if (localStorage.getItem(ONBOARD_FLAG)) return;
    const st = useValentinesStore.getState();
    if (!st.pair || !st.currentUser) return;
    if (!['/', '/notes', '/movies', '/streak'].includes(location.pathname)) return;
    const t = window.setTimeout(() => {
      if (!localStorage.getItem(ONBOARD_FLAG)) setStep(1);
    }, 700);
    return () => window.clearTimeout(t);
  }, [step, location.pathname]);

  useEffect(() => {
    if (step === 0) {
      setSpotRects([]);
      return;
    }
    const measure = () => {
      const st = stepRef.current;
      if (st === 1) setSpotRects(rectOf(avatarRef.current));
      else if (st === 2) setSpotRects(rectOf(notesRef.current, moviesRef.current));
      else if (st === 3) setSpotRects(rectOf(streakRef.current));
      else setSpotRects([]);
    };
    const delay = step === 2 ? 640 : step === 3 ? 380 : 120;
    const t = window.setTimeout(measure, delay);
    const onResize = () => window.setTimeout(measure, 60);
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  }, [step, phase]);

  useEffect(() => {
    return () => {
      if (!onboardingActiveRef.current) popBackButton();
    };
  }, []);

  const goOnboardNext = () => {
    hapticFeedback('impact', 'light');
    if (step === 1) {
      setStep(2);
      openSheet();
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      localStorage.setItem(ONBOARD_FLAG, '1');
      dismiss({ force: true, then: () => setStep(0) });
    }
  };

  const scrimStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.42)',
    zIndex: 1350,
    border: 'none',
    ...(phase === 'open'
      ? { opacity: 1, transition: EASE_OUT_SCRIM }
      : { opacity: 0, transition: phase === 'closing' ? EASE_IN_SCRIM : EASE_OUT_SCRIM }),
  };

  const sheetStyle: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1400,
    background: 'var(--surface-elevated)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.2)',
    padding: '10px 6px calc(14px + env(safe-area-inset-bottom))',
    ...(phase === 'open'
      ? { transform: 'translateY(0)', transition: `transform ${EASE_OUT_SHEET}` }
      : { transform: 'translateY(100%)', transition: phase === 'closing' ? `transform ${EASE_IN_SHEET} 0ms` : `transform ${EASE_OUT_SHEET}` }),
  };

  const handleStyle: React.CSSProperties = {
    width: 44,
    height: 5,
    borderRadius: 999,
    background: 'var(--stone)',
    margin: '4px auto 10px',
    transformOrigin: 'center',
    ...(phase === 'open'
      ? { transform: 'scaleX(1)', transition: `transform ${EASE_HANDLE}` }
      : { transform: 'scaleX(0.8)', transition: phase === 'closing' ? 'transform 150ms ease 0ms' : `transform ${EASE_HANDLE}` }),
  };

  const rowAnim = (i: number): React.CSSProperties =>
    phase === 'open'
      ? {
          opacity: 1,
          transform: 'translateY(0px)',
          transition: `opacity 180ms ease-out ${280 + i * 40}ms, transform 180ms ease-out ${280 + i * 40}ms`,
        }
      : {
          opacity: 0,
          transform: 'translateY(8px)',
          transition: phase === 'closing' ? 'opacity 120ms ease-in, transform 120ms ease-in' : 'none',
        };

  const rowBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '10px 12px',
    borderRadius: 16,
    background: 'none',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
  };

  const rows: {
    key: string;
    ref: React.RefObject<HTMLButtonElement>;
    path: string;
    emoji: string;
    iconBg: string;
    title: string;
    sub: string;
  }[] = [
    {
      key: 'notes',
      ref: notesRef,
      path: '/notes',
      emoji: '📝',
      iconBg: 'linear-gradient(180deg, #fff3c4, #ffe27a)',
      title: 'Заметки',
      sub: `${notes.length} активных`,
    },
    {
      key: 'movies',
      ref: moviesRef,
      path: '/movies',
      emoji: '🎬',
      iconBg: 'linear-gradient(180deg, #dbe8ff, #b9cdfa)',
      title: 'Фильмы',
      sub: `Хочу ${want} · Просмотрено ${watched}`,
    },
    {
      key: 'streak',
      ref: streakRef,
      path: '/streak',
      emoji: '🔥',
      iconBg: 'linear-gradient(180deg, #ffe3cc, #ffc9a3)',
      title: 'Стрик',
      sub: `${streakDays} ${daysWord(streakDays)} подряд`,
    },
  ];

  const onStreak = location.pathname === '/streak';

  const partnerAv = partnerProfile ? api.avatarUrl(partnerProfile.id) : null;
  const selfAv = profile ? api.selfAvatarUrl(profile.id) : null;

  return (
    <>
      <button
        ref={avatarRef}
        onClick={openSheet}
        onPointerDown={handleAvatarPress}
        className={press ? 'animate-avatar-press' : undefined}
        style={{
          position: 'fixed',
          top: 12,
          right: onStreak ? 60 : 12,
          zIndex: 1300,
          width: 40,
          height: 40,
          borderRadius: '50%',
          padding: 0,
          background: 'var(--surface-card)',
          border: '1px solid var(--hairline)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.12)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
        title="Разделы"
      >
        <SheetAvatar partner={partnerAv} self={selfAv} />
        {badge > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              minWidth: 18,
              height: 18,
              padding: '0 4px',
              borderRadius: 999,
              background: 'var(--primary)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              lineHeight: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>

      {phase !== 'closed' && (
        <>
          <button style={scrimStyle} onClick={() => dismiss()} aria-label="Закрыть" />
          <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
            <div style={handleStyle} />
            {rows.map((row, i) => (
              <button key={row.key} ref={row.ref} onClick={() => goTo(row.path)} style={{ ...rowBase, ...rowAnim(i) }} title={row.title}>
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    background: row.iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AppleEmoji emoji={row.emoji} size={20} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{row.title}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--ash)', marginTop: 1 }}>{row.sub}</span>
                </span>
                <span style={{ color: 'var(--stone)', fontSize: 20, transform: 'translateY(-1px)' }}>›</span>
              </button>
            ))}
            <div style={{ height: 1, background: 'var(--hairline)', margin: '4px 18px 6px' }} />
            <button onClick={() => goTo('/profile')} style={{ ...rowBase, ...rowAnim(3) }} title="Профиль">
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  background: 'linear-gradient(180deg, #f6f6f3, #e5e5e0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AppleEmoji emoji="👤" size={20} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Профиль</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--ash)', marginTop: 1 }}>Профиль и настройки</span>
              </span>
              <span style={{ color: 'var(--stone)', fontSize: 20, transform: 'translateY(-1px)' }}>›</span>
            </button>
          </div>
        </>
      )}

      {step > 0 && (
        <>
          <Spotlight rects={spotRects} />
          <div
            style={{
              position: 'fixed',
              left: 18,
              right: 18,
              top: '30%',
              zIndex: 1450,
              background: 'var(--surface-elevated)',
              borderRadius: 22,
              padding: '20px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
              {ONBOARD_COPY[step].title}
            </div>
            <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--mute)', marginBottom: 14 }}>
              {ONBOARD_COPY[step].text}
            </div>
            <button
              onClick={goOnboardNext}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 999,
                background: 'var(--primary)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {ONBOARD_COPY[step].btn}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function SheetAvatar({ partner, self }: { partner: string | null; self: string | null }) {
  const candidates = ([partner, self].filter(Boolean) as string[]).slice(0, 2);
  const [idx, setIdx] = useState(0);
  const src = candidates[idx] ?? null;

  useEffect(() => {
    setIdx(0);
  }, [candidates[0], candidates[1]]);

  if (!src) {
    return <AppleEmoji emoji="👥" size={22} />;
  }

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}