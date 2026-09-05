import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { setMainButton, hapticFeedback } from '../utils/telegram';
import { HeartOpenAnimation } from '../components/HeartOpenAnimation';

export function ListScreen() {
  const { valentines, isLoading, error, fetchValentines, markSeen, pair } = useValentinesStore();
  const navigate = useNavigate();

  useEffect(() => {
    setMainButton({
      text: 'Отправить валентинку',
      onClick: () => {
        hapticFeedback('impact', 'light');
        navigate('/send');
      },
      color: 'var(--tg-button-color)',
      isVisible: true,
    });
  }, [navigate]);

  const received = valentines.filter((v) => !v.is_own);
  const sent = valentines.filter((v) => v.is_own);

  if (isLoading && valentines.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Загрузка валентинок...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>{error}</p>
        <button onClick={fetchValentines} style={styles.retryButton}>
          Попробовать снова
        </button>
      </div>
    );
  }

  if (!pair) {
    return (
      <div style={styles.emptyContainer}>
        <div style={styles.emptyIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </div>
        <h2 style={styles.emptyTitle}>Пара не создана</h2>
        <p style={styles.emptyText}>Пригласите партнера, чтобы начать обмениваться валентинками</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Валентинки</h1>
        {pair && (
          <div style={styles.pairBadge}>
            <span style={styles.badgeDot} />
            <span style={styles.badgeText}>Связано</span>
          </div>
        )}
      </header>

      {received.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Полученные</h2>
          <div style={styles.list}>
            {received.map((valentine) => (
              <ValentineCard
                key={valentine.id}
                valentine={valentine}
                onPress={() => {
                  hapticFeedback('impact', 'light');
                  if (!valentine.seen_at) markSeen(valentine.id);
                  navigate(`/valentine/${valentine.id}`);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {sent.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Отправленные</h2>
          <div style={styles.list}>
            {sent.map((valentine) => (
              <ValentineCard
                key={valentine.id}
                valentine={valentine}
                onPress={() => {
                  hapticFeedback('impact', 'light');
                  navigate(`/valentine/${valentine.id}`);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {valentines.length === 0 && (
        <div style={styles.emptyContainer}>
          <div style={styles.emptyIcon}>
            <HeartOpenAnimation size={64} style={{ opacity: 0.3 }} />
          </div>
            <h2 style={styles.emptyTitle}>Валентинок пока нет</h2>
            <p style={styles.emptyText}>Отправьте первую валентинку партнеру — она появится на его виджете</p>
            <button
              onClick={() => navigate('/send')}
              style={styles.emptyAction}
            >
              Отправить валентинку
            </button>
        </div>
      )}
    </div>
  );
}

function ValentineCard({ valentine, onPress }: { valentine: any; onPress: () => void }) {
  const isDelivered = !!valentine.delivered_at;
  const isSeen = !!valentine.seen_at;

  return (
    <Link to={`/valentine/${valentine.id}`} onClick={onPress} style={styles.card}>
      <div style={styles.cardContent}>
        <div style={styles.cardAnimation}>
          <HeartOpenAnimation size={40} />
        </div>
        <div style={styles.cardInfo}>
          <div style={styles.cardHeader}>
            <span style={styles.cardSender}>{valentine.sender_name}</span>
            <span style={styles.cardTime}>{formatTime(valentine.sent_at)}</span>
          </div>
          {valentine.message && (
            <p style={styles.cardMessage}>{valentine.message}</p>
          )}
          <div style={styles.cardStatus}>
            <span style={{
              ...styles.statusDot,
              background: isSeen ? '#4caf50' : isDelivered ? '#2196f3' : '#ff9800',
            }} />
            <span style={styles.statusText}>
              {isSeen ? 'Прочитано' : isDelivered ? 'Доставлено' : 'Отправляется...'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  if (hours < 24) return `${hours} ч. назад`;
  if (days < 7) return `${days} дн. назад`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    paddingBottom: '100px',
    maxWidth: '480px',
    margin: '0 auto',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: '16px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid var(--border)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: '24px',
    textAlign: 'center',
    gap: '16px',
  },
  errorText: {
    color: 'var(--text-secondary)',
    fontSize: '16px',
  },
  retryButton: {
    padding: '12px 24px',
    background: 'var(--primary)',
    color: 'var(--tg-button-text-color)',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '16px',
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: '24px',
    textAlign: 'center',
    gap: '16px',
  },
  emptyIcon: {
    color: 'var(--text-secondary)',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  emptyText: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    maxWidth: '280px',
    lineHeight: 1.5,
  },
  emptyAction: {
    marginTop: '8px',
    padding: '14px 28px',
    background: 'var(--primary)',
    color: 'var(--tg-button-text-color)',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, var(--primary), #ff6b9d)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  pairBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'var(--primary-light)',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--primary-dark)',
  },
  badgeDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--primary)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  badgeText: {},
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '12px',
    paddingLeft: '4px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  card: {
    display: 'block',
    textDecoration: 'none',
    color: 'inherit',
    background: 'var(--surface-elevated)',
    borderRadius: '16px',
    padding: '14px 16px',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--border)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  cardContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  cardAnimation: {
    flexShrink: 0,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '4px',
  },
  cardSender: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  cardTime: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  cardMessage: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    marginBottom: '8px',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  cardStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
};