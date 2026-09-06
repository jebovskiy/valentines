import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { setMainButton, setBackButton, hapticFeedback } from '../utils/telegram';
import { getAnimation } from '../types';

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

  const anim = getAnimation(valentine.animation_type);
  const senderLabel = valentine.is_own ? 'вы' : valentine.sender_name;
  const timeDate = formatDateTime(valentine.sent_at);

  return (
    <div style={styles.container} className={isAnimating ? 'animate-slide-up' : ''}>
      <div style={styles.receivedBody}>
        <div style={styles.receivedHeart} className="animate-pulse">{anim.emoji}</div>
        <div style={styles.receivedFrom}>от {senderLabel}</div>

        <div style={styles.msgBox}>
          <p style={styles.messageText}>
            {valentine.message || anim.label}
          </p>
        </div>

        <div style={styles.receivedTime}>
          {timeDate}
        </div>
      </div>

      <button
        onClick={() => {
          hapticFeedback('impact', 'light');
          navigate('/send');
        }}
        style={styles.replyBtn}
      >
        {valentine.is_own ? 'Отправить ещё' : 'Ответить'}
      </button>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
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
  receivedBody: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: '16px',
    padding: '24px 0',
  },
  receivedHeart: {
    fontSize: '88px',
    lineHeight: 1,
  },
  receivedFrom: {
    fontSize: '16px',
    color: 'var(--text-secondary)',
  },
  msgBox: {
    padding: '20px 24px',
    background: 'var(--surface-elevated)',
    borderRadius: '20px',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    maxWidth: '320px',
    width: '100%',
  },
  messageText: {
    fontSize: '18px',
    lineHeight: 1.6,
    color: 'var(--text-primary)',
    textAlign: 'center',
  },
  receivedTime: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  replyBtn: {
    width: '100%',
    padding: '16px',
    background: 'var(--primary)',
    color: 'var(--tg-button-text-color)',
    borderRadius: '16px',
    fontSize: '17px',
    fontWeight: '600',
    boxShadow: 'var(--shadow)',
    cursor: 'pointer',
    border: 'none',
  },
};