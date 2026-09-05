import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { setMainButton, setBackButton, hapticFeedback } from '../utils/telegram';
import { HeartOpenAnimation } from '../components/HeartOpenAnimation';

export function DetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { valentines, markSeen } = useValentinesStore();

  const valentine = valentines.find((v) => v.id === id);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, () => navigate(-1));

    if (valentine && !valentine.is_own && !valentine.seen_at) {
      markSeen(valentine.id);
    }
  }, [navigate, valentine]);

  useEffect(() => {
    if (valentine) {
      hapticFeedback('impact', 'light');
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [valentine]);

  if (!valentine) {
    return (
      <div style={styles.notFound}>
        <div style={styles.notFoundIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h2 style={styles.notFoundTitle}>Валентинка не найдена</h2>
        <p style={styles.notFoundText}>Возможно, она была удалена</p>
        <button onClick={() => navigate(-1)} style={styles.backButton}>
          Назад
        </button>
      </div>
    );
  }

  const isDelivered = !!valentine.delivered_at;
  const isSeen = !!valentine.seen_at;

  return (
    <div style={styles.container}>
      <div style={styles.card} className={isAnimating ? 'animate-slide-up' : ''}>
        <div style={styles.animationWrapper}>
          <HeartOpenAnimation
            size={120}
            autoPlay={isAnimating}
            duration={1000}
            style={{ filter: 'drop-shadow(0 8px 24px rgba(233, 30, 99, 0.4))' }}
          />
        </div>

        <div style={styles.info}>
          <div style={styles.senderRow}>
            <span style={styles.senderLabel}>От</span>
            <span style={styles.senderName}>{valentine.sender_name}</span>
          </div>

          <div style={styles.timeRow}>
            <span style={styles.timeLabel}>
              {valentine.is_own ? 'Отправлено' : 'Получено'}
            </span>
            <span style={styles.timeValue}>{formatDateTime(valentine.sent_at)}</span>
          </div>

          {valentine.message && (
            <div style={styles.messageContainer}>
              <p style={styles.messageText}>{valentine.message}</p>
            </div>
          )}

          <div style={styles.statusRow}>
            <div style={{
              ...styles.statusItem,
              background: isSeen ? 'rgba(76, 175, 80, 0.1)' : isDelivered ? 'rgba(33, 150, 243, 0.1)' : 'rgba(255, 152, 0, 0.1)',
              borderColor: isSeen ? 'rgba(76, 175, 80, 0.3)' : isDelivered ? 'rgba(33, 150, 243, 0.3)' : 'rgba(255, 152, 0, 0.3)',
            }}>
              <span style={{
                ...styles.statusDot,
                background: isSeen ? '#4caf50' : isDelivered ? '#2196f3' : '#ff9800',
              }} />
              <span style={{
                ...styles.statusText,
                color: isSeen ? '#4caf50' : isDelivered ? '#2196f3' : '#ff9800',
              }}>
                {isSeen ? 'Прочитано' : isDelivered ? 'Доставлено' : 'Отправляется...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.actions}>
        {valentine.is_own && (
          <button onClick={() => navigate('/send')} style={styles.actionButton}>
            Отправить ещё
          </button>
        )}
        {!valentine.is_own && (
          <button onClick={() => navigate('/send')} style={styles.actionButton}>
            Ответить
          </button>
        )}
      </div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    paddingBottom: '100px',
    maxWidth: '480px',
    margin: '0 auto',
    flex: 1,
  },
  notFound: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: '24px',
    textAlign: 'center',
    gap: '16px',
  },
  notFoundIcon: {
    color: 'var(--text-secondary)',
    opacity: 0.5,
  },
  notFoundTitle: {
    fontSize: '20px',
    fontWeight: '600',
  },
  notFoundText: {
    color: 'var(--text-secondary)',
  },
  backButton: {
    marginTop: '8px',
    padding: '12px 24px',
    background: 'var(--primary)',
    color: 'var(--tg-button-text-color)',
    borderRadius: '12px',
    fontWeight: '600',
  },
  card: {
    background: 'var(--surface-elevated)',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: 'var(--shadow-elevated)',
    border: '1px solid var(--border)',
    marginBottom: '24px',
  },
  animationWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  senderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    paddingBottom: '8px',
    borderBottom: '1px solid var(--border)',
  },
  senderLabel: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  senderName: {
    fontSize: '18px',
    fontWeight: '600',
    background: 'linear-gradient(135deg, var(--primary), #ff6b9d)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  timeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
  timeLabel: {},
  timeValue: {
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  messageContainer: {
    padding: '16px',
    background: 'var(--primary-light)',
    borderRadius: '16px',
    border: '1px solid rgba(233, 30, 99, 0.15)',
  },
  messageText: {
    fontSize: '16px',
    lineHeight: 1.6,
    color: 'var(--text-primary)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '8px',
    borderTop: '1px solid var(--border)',
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '20px',
    borderWidth: '1px',
    borderStyle: 'solid',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  statusText: {
    fontSize: '14px',
    fontWeight: '500',
  },
  actions: {
    padding: '0 16px',
  },
  actionButton: {
    width: '100%',
    padding: '16px',
    background: 'var(--primary)',
    color: 'var(--tg-button-text-color)',
    borderRadius: '16px',
    fontSize: '16px',
    fontWeight: '600',
    boxShadow: 'var(--shadow)',
  },
};