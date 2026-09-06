import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { hapticFeedback } from '../utils/telegram';
import { BackButton } from '../components/BackButton';
import { AppleEmoji } from '../components/AppleEmoji';

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
      <BackButton
        to="/"
        onBack={() => {
          if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.close?.();
          } else {
            window.history.length > 1 ? window.history.back() : (window.location.href = 'https://valentines-sigma-neon.vercel.app/');
          }
        }}
      />
      <div style={styles.bigHeart}>
        <AppleEmoji emoji="💌" size={32} />
      </div>
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
    background: 'var(--surface-soft)',
    position: 'relative',
  },
  bigHeart: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'var(--secondary-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '22px',
    fontWeight: '600',
    letterSpacing: '-0.3px',
    color: 'var(--ink)',
    margin: 0,
  },
  description: {
    fontSize: '14px',
    color: 'var(--mute)',
    lineHeight: 1.5,
    maxWidth: '260px',
    margin: 0,
  },
  primaryButton: {
    padding: '12px 14px',
    height: '40px',
    background: 'var(--primary)',
    color: 'var(--on-primary)',
    borderRadius: '16px',
    fontWeight: '700',
    fontSize: '14px',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
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
    fontFamily: 'var(--font-body)',
  },
  copyButton: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--mute)',
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    borderRadius: '9999px',
    cursor: 'pointer',
  },
};