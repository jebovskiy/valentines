import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { setMainButton, setBackButton, hapticFeedback } from '../utils/telegram';
import { BackButton } from '../components/BackButton';
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
      <BackButton to="/" />
      <div style={styles.receivedBody}>
        <div style={styles.receivedCard}>
          <div style={styles.receivedHeart} className="animate-pulse">{anim.emoji}</div>
          <div style={styles.receivedFrom}>от {senderLabel}</div>

          <div style={styles.msgBox}>
            {valentine.message || anim.label}
          </div>

          <div style={styles.receivedTime}>
            {isTodayThenTime(valentine.sent_at) ? `сегодня, ${timeDate}` : timeDate}
          </div>

          {valentine.is_own && (
            <div style={valentine.seen_at ? styles.readStatus : styles.unreadStatus}>
              {valentine.seen_at ? '✓ прочитано' : 'ещё не прочитано'}
            </div>
          )}
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

function isTodayThenTime(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
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
    maxWidth: '480px',
    margin: '0 auto',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative',
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
    fontSize: '22px',
    fontWeight: '600',
    color: 'var(--ink)',
    letterSpacing: '-0.3px',
  },
  notFoundText: {
    color: 'var(--text-secondary)',
  },
  backButton: {
    marginTop: '8px',
    padding: '12px 14px',
    height: '40px',
    background: 'var(--primary)',
    color: 'var(--on-primary)',
    borderRadius: '16px',
    fontWeight: '700',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  receivedBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    textAlign: 'center',
    gap: '18px',
  },
  receivedCard: {
    width: '100%',
    maxWidth: '320px',
    borderRadius: '16px',
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },
  receivedHeart: {
    width: '96px',
    height: '96px',
    borderRadius: '50%',
    background: 'var(--secondary-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '44px',
  },
  receivedFrom: {
    fontFamily: 'var(--font-display)',
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--mute)',
  },
  msgBox: {
    fontFamily: 'var(--font-display)',
    fontSize: '20px',
    fontWeight: '600',
    lineHeight: 1.4,
    letterSpacing: '-0.3px',
    color: 'var(--ink)',
    maxWidth: '260px',
  },
  receivedTime: {
    fontSize: '12px',
    color: 'var(--text-faint)',
  },
  readStatus: {
    fontSize: '12px',
    color: 'var(--mute)',
  },
  unreadStatus: {
    fontSize: '12px',
    color: 'var(--ash)',
  },
  replyBtn: {
    marginTop: '8px',
    padding: '12px 14px',
    height: '40px',
    borderRadius: '16px',
    background: 'var(--primary)',
    color: 'var(--on-primary)',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
};