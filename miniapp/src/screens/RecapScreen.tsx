import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Recap, RecapAggregates, RecapPeriod } from '../types';
import { setMainButton, setBackButton, hapticFeedback, webApp } from '../utils/telegram';
import { BackButton } from '../components/BackButton';
import { AppleEmoji } from '../components/AppleEmoji';

const PERIODS: { key: RecapPeriod; label: string }[] = [
  { key: '7d', label: '7 дней' },
  { key: '30d', label: '30 дней' },
  { key: '90d', label: '90 дней' },
  { key: 'all', label: 'всё время' },
];

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function greetingsTotal(greetings: Record<string, number>): number {
  return Object.values(greetings).reduce((sum, count) => sum + count, 0);
}

/** Текст для «поделиться»: только то, что уже показано на карточке. */
function shareText(recap: Recap): string {
  const a = recap.aggregates;
  return [
    `${a.periodLabel}: ${recap.summary.headline}`,
    recap.summary.highlight_number,
    recap.summary.insight,
  ].join('\n\n');
}

export function RecapScreen() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<RecapPeriod>('30d');
  const [recap, setRecap] = useState<Recap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (next: RecapPeriod) => {
    setLoading(true);
    setError(null);
    const result = await api.getRecap(next);
    if (result.error || !result.data?.recap) {
      setError(result.error ?? 'Не удалось собрать итоги');
      setRecap(null);
    } else {
      setRecap(result.data.recap);
      hapticFeedback('impact', 'light');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(period);
  }, [load, period]);

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, () => navigate('/settings'));
    return () => setBackButton(false);
  }, [navigate]);

  const handleShare = () => {
    if (!recap) return;
    webApp?.openTelegramLink(
      `https://t.me/share/url?url=&text=${encodeURIComponent(shareText(recap))}`
    );
  };

  const aggregates = recap?.aggregates ?? null;

  const stats = useMemo(() => {
    if (!aggregates) return [] as { icon: string; label: string; value: string }[];
    const a: RecapAggregates = aggregates;
    const items: { icon: string; label: string; value: string }[] = [];

    items.push({
      icon: '💌',
      label: 'валентинок',
      value: String(a.valentinesCount),
    });
    if (a.valentinesCount > 0) {
      items.push({
        icon: '🤝',
        label: `${a.partnerAName} / ${a.partnerBName}`,
        value: `${a.partnerACount} / ${a.partnerBCount}`,
      });
    }
    items.push({
      icon: '🔥',
      label: 'стрик сейчас',
      value: `${a.currentStreak} / ${a.maxStreak}`,
    });
    const greetings = greetingsTotal(a.greetingsByType);
    if (greetings > 0) {
      items.push({ icon: '🌅', label: 'приветствий', value: String(greetings) });
    }
    if (a.moviesWatched > 0) {
      items.push({ icon: '🎬', label: 'фильмов вместе', value: String(a.moviesWatched) });
    }
    if (a.avgMovieCompatibility !== null) {
      items.push({ icon: '🍿', label: 'совместимость', value: `${a.avgMovieCompatibility}%` });
    }
    if (a.datesMatched > 0) {
      items.push({ icon: '📍', label: 'свиданий', value: String(a.datesMatched) });
    }
    if (a.mostActiveHour !== null) {
      items.push({ icon: '🕘', label: 'час активности', value: formatHour(a.mostActiveHour) });
    }
    if (a.mostActiveWeekday) {
      items.push({ icon: '📅', label: 'день недели', value: a.mostActiveWeekday });
    }
    if (a.biggestMovieGap) {
      items.push({ icon: '⚖️', label: 'главный спор', value: a.biggestMovieGap });
    }
    return items;
  }, [aggregates]);

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>Итоги</span>
        <div style={styles.topBarRight}>
          <AppleEmoji emoji="✨" size={18} />
        </div>
      </div>

      <div style={styles.periods}>
        {PERIODS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setPeriod(option.key)}
            style={{
              ...styles.periodButton,
              ...(period === option.key ? styles.periodButtonActive : null),
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={styles.card}>
          <div style={styles.loading}>Собираем ваши цифры…</div>
        </div>
      )}

      {!loading && error && (
        <div style={styles.card}>
          <div style={styles.errorTitle}>Итоги не собрались</div>
          <p style={styles.errorText}>{error}</p>
          <button type="button" style={styles.retry} onClick={() => void load(period)}>
            Попробовать снова
          </button>
        </div>
      )}

      {!loading && recap && (
        <>
          <div style={styles.card}>
            <div style={styles.cardLabel}>{recap.aggregates.periodLabel}</div>
            <div style={styles.headline}>{recap.summary.headline}</div>
            <div style={styles.highlight}>{recap.summary.highlight_number}</div>
            <p style={styles.insight}>{recap.summary.insight}</p>
            <div style={styles.funFact}>
              <span style={styles.funFactIcon}>😂</span>
              <span>{recap.summary.fun_fact}</span>
            </div>
            <div style={styles.closing}>{recap.summary.closing_line}</div>
          </div>

          <div style={styles.grid}>
            {stats.map((item) => (
              <div key={item.label} style={styles.tile}>
                <AppleEmoji emoji={item.icon} size={20} />
                <div style={styles.tileValue}>{item.value}</div>
                <div style={styles.tileLabel}>{item.label}</div>
              </div>
            ))}
          </div>

          <button type="button" style={styles.share} onClick={handleShare}>
            Поделиться итогами
          </button>
        </>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: 16,
    paddingBottom: 32,
    maxWidth: 480,
    margin: '0 auto',
    minHeight: '100%',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 44,
    position: 'relative',
  },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--ink)',
    zIndex: 1,
    pointerEvents: 'none',
  },
  topBarRight: {
    marginLeft: 'auto',
  },
  periods: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 6,
  },
  periodButton: {
    padding: '8px 4px',
    borderRadius: 999,
    border: '1px solid var(--hairline)',
    background: 'var(--surface-card)',
    color: 'var(--ink-secondary)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  periodButtonActive: {
    background: 'var(--ink)',
    color: '#fff',
    borderColor: 'var(--ink)',
  },
  card: {
    background: 'linear-gradient(180deg, #2b2724, #171412)',
    borderRadius: 22,
    padding: '22px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
  },
  headline: {
    fontSize: 26,
    fontWeight: 800,
    lineHeight: 1.15,
    color: '#fff',
  },
  highlight: {
    fontSize: 17,
    fontWeight: 700,
    color: '#f0c869',
    lineHeight: 1.3,
  },
  insight: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: 'rgba(255,255,255,0.85)',
  },
  funFact: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '10px 12px',
    fontSize: 13,
    lineHeight: 1.45,
    color: 'rgba(255,255,255,0.9)',
  },
  funFactIcon: {
    flexShrink: 0,
  },
  closing: {
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.65)',
  },
  loading: {
    padding: '20px 0',
    textAlign: 'center',
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
  },
  errorText: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  retry: {
    alignSelf: 'flex-start',
    padding: '10px 16px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.3)',
    background: 'transparent',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
  },
  tile: {
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    borderRadius: 18,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  tileValue: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--ink)',
  },
  tileLabel: {
    fontSize: 12,
    color: 'var(--ink-secondary)',
  },
  share: {
    padding: 14,
    borderRadius: 999,
    border: 'none',
    background: 'var(--ink)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
};