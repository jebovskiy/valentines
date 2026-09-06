import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { setMainButton, setBackButton, hapticFeedback } from '../utils/telegram';
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
      window.Telegram?.WebApp?.close?.();
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

  return (
    <div style={styles.container} className={isAnimating ? 'animate-slide-up' : ''}>
      <div style={styles.receivedBody}>
        <div style={styles.receivedHeart} className="animate-pulse">{anim.emoji}</div>
        <div style={styles.receivedFrom}>от {senderLabel}</div>

        <div style={styles.msgBox}>
          {valentine.message || anim.label}
        </div>

        <div style={styles.receivedTime}>
          {isTodayThenTime(valentine.sent_at) ? `сегодня, ${timeDate}` : timeDate}
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
    paddingBottom: '100px',
    maxWidth: '480px',
    margin: '0 auto',
    minHeight: '100vh',
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
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '30px 26px',
    textAlign: 'center',
    gap: '14px',
  },
  receivedHeart: {
    width: '96px',
    height: '96px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,122,107,0.4), transparent 70%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '44px',
  },
  receivedFrom: {
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontSize: '16px',
    color: 'var(--text-muted)',
  },
  msgBox: {
    fontFamily: 'var(--font-display)',
    fontSize: '19px',
    lineHeight: 1.4,
    color: 'var(--text-cream)',
    maxWidth: '220px',
  },
  receivedTime: {
    fontSize: '11px',
    color: 'var(--text-faint)',
  },
  replyBtn: {
    marginTop: '8px',
    padding: '12px 26px',
    borderRadius: '100px',
    background: 'var(--bg-panel-2)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    fontSize: '13px',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
};