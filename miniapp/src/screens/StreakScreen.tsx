import { CSSProperties, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { STREAK_TIERS } from '../types';
import { setMainButton, setBackButton } from '../utils/telegram';
import { BackButton } from '../components/BackButton';
import { ValentineAnimation } from '../components/ValentineAnimation';
import { AppleEmoji } from '../components/AppleEmoji';

const TIER_NAMES: Record<string, string> = {
  heart_open: 'Валентинка',
  sparkle_burst: 'Блеск',
  moon_glow: 'Ночь',
  flame_pulse: 'Страсть',
  bloom_petals: 'Цветение',
  golden_halo: 'Нимб',
};

function isUnlocked(tierDay: number, current: number, max: number): boolean {
  return tierDay === 1 || tierDay <= max || tierDay <= current;
}

export function StreakScreen() {
  const navigate = useNavigate();
  const { pair, streak, fetchStreak } = useValentinesStore();

  useEffect(() => {
    void fetchStreak();
    const onBackClick = () => navigate('/');
    setBackButton(true, onBackClick);
    setMainButton({ isVisible: false });
    return () => setBackButton(false);
  }, [navigate, fetchStreak]);

  const current = streak?.current ?? 0;
  const max = streak?.max ?? 0;

  const nextTier = useMemo(() => {
    for (const tier of STREAK_TIERS) {
      if (!isUnlocked(tier.day, current, max)) return tier;
    }
    return null;
  }, [current, max]);

  const progressToNext = nextTier ? Math.min(1, Math.max(0, current / nextTier.day)) : 1;
  const nextLeft = nextTier ? nextTier.day - current : 0;

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>Стрик</span>
        <div style={styles.topBarRight}>{pair ? <AppleEmoji emoji="🔥" size={18} /> : null}</div>
      </div>

      <div style={styles.counterCard}>
        <div style={styles.counter}>
          <AppleEmoji emoji="🔥" size={26} />
          <span style={styles.counterNum}>{current}</span>
          <span style={styles.counterDays}>дней подряд</span>
        </div>
        <p style={styles.counterSub}>
          отмечайте дни, когда вы обмениваетесь валентинками, и забирайте новые анимации
        </p>
      </div>

      {nextTier && (
        <div style={styles.nextCard}>
          <div style={styles.nextLabel}>ДО СЛЕДУЮЩЕГО ТИРА</div>
          <div style={styles.nextRow}>
            <ValentineAnimation type={nextTier.type} size={56} autoPlay={false} />
            <div>
              <div style={styles.nextName}>{TIER_NAMES[nextTier.name] ?? nextTier.name}</div>
              <div style={styles.nextDay}>День {nextTier.day}</div>
            </div>
          </div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${progressToNext * 100}%` }} />
          </div>
          <div style={styles.nextHint}>
            ещё {nextLeft} {pluralDay(nextLeft)}
          </div>
        </div>
      )}

      {!nextTier && (
        <div style={styles.nextCard}>
          <div style={styles.nextLabel}>ВСЕ ТИРЫ ОТКРЫТЫ</div>
          <div style={styles.nextRow}>
            <AppleEmoji emoji="👑" size={40} />
            <div style={styles.nextName}>Вы достигли максимума ({max})</div>
          </div>
        </div>
      )}

      <div style={styles.grid}>
        {STREAK_TIERS.map((tier) => {
          const unlocked = isUnlocked(tier.day, current, max);
          const lockedDay = STREAK_TIERS.find((t) => t.day === tier.day);
          const isCurrent = current >= tier.day && nextTier?.day === tier.day && unlocked;
          return (
            <div
              key={tier.day}
              style={{
                ...styles.tile,
                background: unlocked ? `radial-gradient(circle at 30% 20%, ${tier.soft}, ${tier.mid})` : 'var(--surface-card)',
                opacity: unlocked ? 1 : 0.75,
                border: isCurrent ? '2px solid var(--ink)' : '1px solid var(--hairline)',
              }}
            >
              <div style={styles.tileTop}>
                <AppleEmoji emoji={tier.icon} size={20} />
                <span style={styles.tileDay}>День {tier.day}</span>
              </div>
              <div style={{ color: unlocked ? '#fff' : 'var(--ink-secondary)' }}>
                {unlocked ? (
                  <ValentineAnimation type={tier.type} size={52} autoPlay={isCurrent} />
                ) : (
                  <div style={styles.tileLock}><AppleEmoji emoji="🔒" size={22} /></div>
                )}
              </div>
              <div
                style={{
                  ...styles.tileName,
                  color: unlocked ? 'rgba(255,255,255,0.95)' : 'var(--ink-secondary)',
                }}
              >
                {TIER_NAMES[lockedDay?.name ?? tier.name] ?? tier.name}
              </div>
              {!unlocked && (
                <div style={styles.tileUnlock}>откроется на {tier.day} 🔥</div>
              )}
            </div>
          );
        })}
      </div>

      <p style={styles.footnote}>🔥 стрик обновляется автоматически, когда ты отправляешь или получаешь валентинку</p>
    </div>
  );
}

function pluralDay(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'дней';
  if (last > 1 && last < 5) return 'дня';
  if (last === 1) return 'день';
  return 'дней';
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: 16,
    maxWidth: 480,
    margin: '0 auto',
    minHeight: '100vh',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 44,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
  },
  topBarRight: {
    marginLeft: 'auto',
  },
  counterCard: {
    background: 'linear-gradient(180deg, #2b2724, #171412)',
    borderRadius: 20,
    padding: '22px 20px',
    textAlign: 'center',
  },
  counter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  counterNum: {
    fontSize: 48,
    fontWeight: 800,
    color: '#f0c869',
    lineHeight: 1,
  },
  counterDays: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
  },
  counterSub: {
    margin: '8px 0 0',
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  nextCard: {
    background: 'var(--surface-card)',
    borderRadius: 20,
    padding: '16px 18px',
  },
  nextLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: 'var(--ink-secondary)',
    marginBottom: 10,
  },
  nextRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  nextName: {
    fontSize: 17,
    fontWeight: 700,
  },
  nextDay: {
    fontSize: 13,
    color: 'var(--ink-secondary)',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    background: 'var(--hairline)',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, #f0c869, #ff8fa3)',
    transition: 'width .4s ease',
  },
  nextHint: {
    marginTop: 8,
    fontSize: 13,
    color: 'var(--ink-secondary)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
  },
  tile: {
    borderRadius: 18,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    minHeight: 118,
  },
  tileTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  tileDay: {
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.9)',
  },
  tileLock: {
    width: 52,
    height: 52,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileName: {
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'center',
  },
  tileUnlock: {
    fontSize: 11,
    color: 'var(--ink-secondary)',
    textAlign: 'center',
  },
  footnote: {
    textAlign: 'center',
    fontSize: 12,
    color: 'var(--ink-secondary)',
    margin: '2px 0 16px',
  },
};