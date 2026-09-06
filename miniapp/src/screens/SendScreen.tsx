import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore, partnerName } from '../hooks/useValentinesStore';
import { setMainButton, setBackButton, hapticFeedback } from '../utils/telegram';
import { BackButton } from '../components/BackButton';
import { ANIMATIONS, AnimationType, TEST_TELEGRAM_ID } from '../types';

const MAX_MESSAGE_LENGTH = 500;

export function SendScreen() {
  const navigate = useNavigate();
  const { sendValentine, currentUser, pair } = useValentinesStore();
  const [message, setMessage] = useState('');
  const [animationType, setAnimationType] = useState<AnimationType>('heart_open');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [recipient, setRecipient] = useState<'partner' | 'self'>('partner');

  const partner = partnerName(pair, currentUser?.id ?? null);
  const isTestUser = currentUser?.id === TEST_TELEGRAM_ID;

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, () => navigate(-1));
  }, [navigate]);

  useEffect(() => {
    setCharCount(message.length);
  }, [message]);

  const handleSend = async () => {
    if (isSending) return;

    hapticFeedback('impact', 'medium');
    setIsSending(true);
    setError(null);

    const valentine = await sendValentine(animationType, message.trim() || null, isTestUser ? recipient : 'partner');

    setIsSending(false);
    if (valentine) {
      hapticFeedback('notification', 'success');
      navigate('/');
    } else {
      setError('Не удалось отправить. Попробуйте снова.');
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_MESSAGE_LENGTH) {
      setMessage(value);
    }
  };

  return (
    <div style={styles.container}>
      <BackButton to="/" />
      <header style={styles.header}>
        <h1 style={styles.title}>Отправить {partner}</h1>
        <p style={styles.subtitle}>выбери анимацию и добавь пару слов</p>
      </header>

      {isTestUser && (
        <div style={styles.recipientRow}>
          {(['partner', 'self'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRecipient(r)}
              style={{
                ...styles.recipientChip,
                background: recipient === r ? 'var(--ink)' : 'var(--surface-card)',
                color: recipient === r ? 'var(--on-dark)' : 'var(--ink)',
                border: recipient === r ? '1px solid var(--ink)' : '1px solid var(--hairline)',
              }}
            >
              {r === 'partner' ? 'Партнёру' : 'Себе ☝️'}
            </button>
          ))}
        </div>
      )}

      <div style={styles.typeRow}>
        {ANIMATIONS.map((anim) => (
          <button
            key={anim.type}
            onClick={() => setAnimationType(anim.type)}
            style={{
              ...styles.typeChip,
              background: animationType === anim.type ? 'var(--secondary-bg)' : 'var(--surface-card)',
              border: animationType === anim.type ? '1px solid var(--ink)' : '1px solid var(--hairline)',
            }}
            aria-label={anim.label}
          >
            {anim.emoji}
          </button>
        ))}
      </div>

      <div style={styles.composeCard}>
        <div style={styles.composePreview}>
          <span style={styles.previewEmoji}>
            {ANIMATIONS.find((a) => a.type === animationType)!.emoji}
          </span>
          <div style={styles.composePreviewTag}>{ANIMATIONS.find((a) => a.type === animationType)!.label}</div>
        </div>
        <textarea
          value={message}
          onChange={handleMessageChange}
          placeholder={`Скучаю. Вернись скорее…`}
          style={styles.textarea}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={4}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="sentences"
          disabled={isSending}
        />
        <div style={styles.charCounter}>
          <span style={{ color: charCount > MAX_MESSAGE_LENGTH * 0.9 ? 'var(--primary)' : 'var(--text-secondary)' }}>
            {charCount}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>/{MAX_MESSAGE_LENGTH}</span>
        </div>
      </div>

      {error && (
        <div style={styles.error} role="alert">
          {error}
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={isSending}
        style={{
          ...styles.sendBtn,
          opacity: isSending ? 0.6 : 1,
        }}
      >
        {isSending ? 'Отправка...' : 'Отправить'}
      </button>
    </div>
  );
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
    position: 'relative',
  },
  header: {
    marginBottom: '24px',
    paddingTop: '8px',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontWeight: '600',
    fontSize: '22px',
    color: 'var(--ink)',
    letterSpacing: '-0.3px',
    paddingLeft: '48px',
  },
  subtitle: {
    color: 'var(--text-faint)',
    fontSize: '12px',
    marginTop: '2px',
  },
  recipientRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
  recipientChip: {
    flex: 1,
    padding: '8px 16px',
    borderRadius: '9999px',
    fontSize: '14px',
    fontWeight: '700',
    border: '1px solid var(--hairline)',
    cursor: 'pointer',
    lineHeight: '1.4',
    textAlign: 'center',
  },
  typeRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    padding: '20px 0 0',
  },
  typeChip: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    fontSize: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    transition: 'transform 0.15s ease, background 0.15s ease, border 0.15s ease',
    cursor: 'pointer',
  },
  composeCard: {
    marginTop: '22px',
    minHeight: '150px',
    borderRadius: '16px',
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  composePreview: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  previewEmoji: {
    fontSize: '24px',
  },
  composePreviewTag: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--mute)',
    background: 'var(--secondary-bg)',
    padding: '4px 10px',
    borderRadius: '9999px',
    fontFamily: 'var(--font-body)',
  },
  textarea: {
    width: '100%',
    fontSize: '16px',
    lineHeight: 1.5,
    color: 'var(--ink)',
    background: 'transparent',
    resize: 'none',
    minHeight: '80px',
    fontFamily: 'var(--font-body)',
  },
  charCounter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '4px',
    padding: '8px 0 0',
    fontSize: '12px',
    color: 'var(--text-faint)',
    borderTop: '1px solid var(--hairline-soft)',
    marginTop: '12px',
  },
  error: {
    marginBottom: '16px',
    padding: '12px 16px',
    background: 'var(--surface-card)',
    border: '1px solid var(--error)',
    borderRadius: '16px',
    color: 'var(--error)',
    fontSize: '14px',
    textAlign: 'center',
  },
  sendBtn: {
    width: '100%',
    marginTop: '24px',
    height: '48px',
    borderRadius: '16px',
    background: 'var(--primary)',
    color: 'var(--on-primary)',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};