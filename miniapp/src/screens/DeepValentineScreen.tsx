import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { setMainButton, setBackButton, hapticFeedback } from '../utils/telegram';
import { BackButton } from '../components/BackButton';
import { AppleEmoji } from '../components/AppleEmoji';
import { getAnimation, ValentineWithSender } from '../types';

export function DeepValentineScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [valentine, setValentine] = useState<ValentineWithSender | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, () => {
      navigate('/', { replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    (async () => {
      const result = await api.getValentine(id);
      if (cancelled) return;
      if (result.data?.valentine) {
        setValentine(result.data.valentine);
        const v = result.data.valentine;
        if (!v.is_own && !v.seen_at) {
          api.markSeen(v.id);
        }
      } else {
        setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (valentine) {
      hapticFeedback('impact', 'light');
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [valentine]);

  if (notFound) {
    return (
      <div style={styles.notFound}>
        <BackButton
          to="/"
          onBack={() => {
            navigate('/', { replace: true });
          }}
        />
        <div style={styles.notFoundIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h2 style={styles.notFoundTitle}>Валентинка не найдена</h2>
        <p style={styles.notFoundText}>Возможно, она уже была удалена</p>
        <button onClick={() => navigate('/')} style={styles.backButton}>
          К списку
        </button>
      </div>
    );
  }

  if (!valentine) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Открываем валентинку…</p>
      </div>
    );
  }

  const anim = getAnimation(valentine.animation_type);
  const senderLabel = valentine.is_own ? 'вы' : valentine.sender_name;
  const timeDate = formatDateTime(valentine.sent_at);
  const gradient = animationGradient(valentine.animation_type);

  return (
    <div style={styles.container} className={isAnimating ? 'animate-slide-up' : ''}>
      <BackButton
        to="/"
        onBack={() => {
          navigate('/', { replace: true });
        }}
      />
      <div style={styles.receivedBody}>
        <div style={styles.cardWrap}>
          <div style={{ ...styles.receivedCard, background: gradient }}>
            <div style={styles.cardArt}>
              <AppleEmoji emoji={anim.emoji} size={104} />
            </div>
            <div style={styles.cardContent}>
              <div style={styles.overlayPill}>от {senderLabel}</div>
              <div style={styles.msgBox}>
                {valentine.message || anim.label}
              </div>
              <div style={styles.receivedTime}>
                {isTodayThenTime(valentine.sent_at) ? `сегодня, ${timeDate}` : timeDate}
              </div>
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
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: '16px',
  },
  loadingText: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid var(--border)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
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
    position: 'relative',
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
    background: 'var(--secondary-bg)',
    color: 'var(--ink)',
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
  cardWrap: {
    width: '100%',
    maxWidth: '360px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    flex: 1,
    minHeight: 0,
  },
  receivedCard: {
    width: '100%',
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
    fontSize: '22px',
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
  replyBtn: {
    width: '100%',
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