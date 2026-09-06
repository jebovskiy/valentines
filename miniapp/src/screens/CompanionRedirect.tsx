import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { hapticFeedback } from '../utils/telegram';

export function CompanionRedirect() {
  const { token } = useParams<{ token: string }>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (token) {
      const timer = setTimeout(() => {
        try {
          window.location.href = `valentines://pair?token=${encodeURIComponent(token)}`;
        } catch (_) {
          // ignore
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [token]);

  const copyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      hapticFeedback('notification', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = token;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (_) {
        // ignore
      }
    }
  };

  const openApp = () => {
    if (token) {
      window.location.href = `valentines://pair?token=${encodeURIComponent(token)}`;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.bigHeart}>💌</div>
      <h1 style={styles.title}>Открываем приложение…</h1>
      <p style={styles.description}>
        Если ничего не произошло — приложение «Валентинки» не установлено. Установите APK и нажмите ещё раз.
      </p>

      <button style={styles.primaryButton} onClick={openApp}>
        Открыть в приложении
      </button>

      <div style={styles.tokenRow}>
        <code style={styles.token}>{token ? `${token.slice(0, 10)}…` : ''}</code>
        <button style={styles.copyButton} onClick={copyToken}>
          {copied ? '✓ Скопирован' : 'Копировать'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '24px',
    textAlign: 'center',
    gap: '16px',
    background: 'radial-gradient(ellipse 600px 400px at 50% -10%, #3E1D38 0%, transparent 60%), #1B0F18',
  },
  bigHeart: {
    width: '72px',
    height: '72px',
    borderRadius: '22px',
    background: 'linear-gradient(160deg, #FF9A8C, #B8564B)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    boxShadow: '0 14px 30px -10px rgba(255, 122, 107, 0.5)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '19px',
    color: 'var(--text-cream)',
    margin: 0,
  },
  description: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    maxWidth: '260px',
    margin: 0,
  },
  primaryButton: {
    padding: '14px 28px',
    background: 'linear-gradient(120deg, #FF7A6B, #B8564B)',
    color: '#2A0F0C',
    borderRadius: '100px',
    fontWeight: '600',
    fontSize: '15px',
    border: 'none',
    cursor: 'pointer',
  },
  tokenRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px',
  },
  token: {
    fontSize: '12px',
    color: 'var(--text-faint)',
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: '6px 12px',
    fontSize: '11px',
    color: 'var(--text-muted)',
    background: 'var(--bg-panel-2)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '100px',
    cursor: 'pointer',
  },
};