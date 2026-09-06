import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { hapticFeedback } from '../utils/telegram';

export function CompanionRedirect() {
  const { token } = useParams<{ token: string }>();
  const [copied, setCopied] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const deepLink = token ? `valentines://pair?token=${encodeURIComponent(token)}` : '';
  const httpsLink = token ? `https://valentines-sigma-neon.vercel.app/c/${encodeURIComponent(token)}` : '';

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

  return (
    <div style={styles.container}>
      <div style={styles.bigHeart}>💌</div>
      <h1 style={styles.title}>Открыть приложение «Валентинки»</h1>
      <p style={styles.description}>
        Нажмите кнопку — приложение установит связь с вашей парой. Если оно не установлено, откройте страницу в браузере: она так же приведёт в приложение.
      </p>

      {!attempted ? (
        <a
          href={deepLink}
          style={styles.primaryButton}
          onClick={() => setAttempted(true)}
        >
          Открыть приложение
        </a>
      ) : (
        <div style={styles.fallback}>
          <p style={styles.description}>
            Не открылось? Возможно, приложение не установлено. Попробуйте вариант ниже.
          </p>
          <a href={httpsLink} style={styles.primaryButton} onClick={() => window.location.reload()}>
            Открыть ещё раз
          </a>
          <p style={styles.hint}>
            Перед первым открытием установите APK «Валентинки» на этот телефон.
          </p>
        </div>
      )}

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
    textDecoration: 'none',
  },
  fallback: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  hint: {
    fontSize: '12px',
    color: 'var(--text-faint)',
    lineHeight: 1.5,
    maxWidth: '240px',
    margin: 0,
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