import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { setMainButton, setBackButton, hapticFeedback } from '../utils/telegram';
import { BackButton } from '../components/BackButton';
import { AppleEmoji } from '../components/AppleEmoji';
import { getAnimation } from '../types';
import { formatDateTime } from '../utils/date';

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
  const senderLabel = valentine.is_own ? 'Вы' : valentine.sender_name;
  const timeDate = formatDateTime(valentine.sent_at);
  const gradient = animationGradient(valentine.animation_type);

  return (
    <div style={styles.container} className={isAnimating ? 'animate-slide-up' : ''}>
      <BackButton to="/" />
      <div style={styles.receivedBody}>
        <div style={{ ...styles.receivedCard, background: gradient }}>
          <div style={styles.cardArt}>
            <AppleEmoji emoji={anim.emoji} size={88} />
          </div>
          <div style={styles.cardContent}>
            <div style={styles.overlayPill}>от {senderLabel}</div>
            <div style={styles.msgBox}>
              {valentine.message || anim.label}
            </div>
            <div style={styles.receivedTime}>
              {timeDate}
            </div>
            {valentine.is_own && (
              <div style={valentine.seen_at ? styles.readStatus : styles.unreadStatus}>
                {valentine.seen_at ? '✓ прочитано' : 'не прочитано'}
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
    </div>
  );
}

function animationGradient(type: string): string {
  switch (type) {
    case 'sparkle':
      return 'var(--grad-sparkle)';
    case 'moon':
      return 'var(--grad-moon)';
    case 'flame':
      return 'var(--grad-flame)';
    default:
      return 'var(--grad-heart)';
  }
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
    justifyContent: 'center',
    gap: '16px',
    padding: '24px 0 12px',
    minHeight: 0,
  },
  receivedCard: {
    width: '100%',
    maxWidth: '360px',
    margin: '0 auto',
    borderRadius: '32px',
    border: '1px solid var(--hairline-soft)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },
  cardArt: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0,
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '20px',
  },
  overlayPill: {
    backgroundColor: 'var(--canvas)',
    color: 'var(--ink)',
    fontFamily: 'var(--font-body)',
    fontSize: '10px',
    fontWeight: '500',
    lineHeight: 1.3,
    letterSpacing: '0.01em',
    padding: '5px 10px',
    borderRadius: '9999px',
  },
  msgBox: {
    fontFamily: 'var(--font-display)',
    fontSize: '20px',
    fontWeight: '700',
    lineHeight: 1.25,
    letterSpacing: '-0.5px',
    color: 'var(--ink)',
  },
  receivedTime: {
    fontFamily: 'var(--font-body)',
    fontSize: '11.5px',
    fontWeight: 500,
    color: 'var(--mute)',
  },
  readStatus: {
    fontFamily: 'var(--font-body)',
    fontSize: '11.5px',
    fontWeight: 500,
    color: 'var(--mute)',
  },
  unreadStatus: {
    fontFamily: 'var(--font-body)',
    fontSize: '11.5px',
    fontWeight: 500,
    color: 'var(--ash)',
  },
  replyBtn: {
    width: '100%',
    maxWidth: '360px',
    margin: '0 auto',
    padding: '0 18px',
    height: '40px',
    borderRadius: '16px',
    background: 'var(--canvas)',
    color: 'var(--ink)',
    fontFamily: 'var(--font-display)',
    fontSize: '12px',
    fontWeight: '700',
    lineHeight: 1,
    cursor: 'pointer',
    border: '1px solid var(--hairline)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
};