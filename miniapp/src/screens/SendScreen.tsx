import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore, partnerName } from '../hooks/useValentinesStore';
import { setMainButton, setBackButton, hapticFeedback } from '../utils/telegram';
import { ANIMATIONS, AnimationType } from '../types';

const MAX_MESSAGE_LENGTH = 500;

export function SendScreen() {
  const navigate = useNavigate();
  const { sendValentine, currentUser, pair } = useValentinesStore();
  const [message, setMessage] = useState('');
  const [animationType, setAnimationType] = useState<AnimationType>('heart_open');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const partner = partnerName(pair, currentUser?.id ?? null);

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, () => navigate(-1));
    textareaRef.current?.focus();
  }, [navigate]);

  useEffect(() => {
    setCharCount(message.length);
  }, [message]);

  const handleSend = async () => {
    if (isSending) return;

    hapticFeedback('impact', 'medium');
    setIsSending(true);
    setError(null);

    const valentine = await sendValentine(animationType, message.trim() || null);

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
      <header style={styles.header}>
        <h1 style={styles.title}>Отправить {partner}</h1>
        <p style={styles.subtitle}>выбери анимацию и добавь пару слов</p>
      </header>

      <div style={styles.typeRow}>
        {ANIMATIONS.map((anim) => (
          <button
            key={anim.type}
            onClick={() => setAnimationType(anim.type)}
            style={{
              ...styles.typeChip,
              background: animationType === anim.type ? 'var(--primary)' : 'var(--surface-elevated)',
              border: animationType === anim.type ? '1px solid var(--primary)' : '1px solid var(--border)',
              transform: animationType === anim.type ? 'scale(1.1)' : 'scale(1)',
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
          <div style={styles.composePreviewTag}>{animationType}</div>
        </div>
        <textarea
          ref={textareaRef}
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
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, var(--primary), #ff6b9d)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
    marginTop: '4px',
  },
  typeRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  typeChip: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    fontSize: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s ease, background 0.15s ease, border 0.15s ease',
    cursor: 'pointer',
  },
  composeCard: {
    background: 'var(--surface-elevated)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  composePreview: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    background: 'var(--primary-light)',
    borderBottom: '1px solid var(--border)',
  },
  previewEmoji: {
    fontSize: '20px',
  },
  composePreviewTag: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--primary-dark)',
    fontFamily: 'monospace',
    padding: '2px 8px',
    background: 'rgba(233, 30, 99, 0.1)',
    borderRadius: '6px',
  },
  textarea: {
    width: '100%',
    padding: '16px',
    fontSize: '16px',
    lineHeight: 1.5,
    color: 'var(--text-primary)',
    background: 'transparent',
    resize: 'none',
    minHeight: '120px',
  },
  charCounter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '4px',
    padding: '8px 16px',
    fontSize: '12px',
    background: 'var(--tg-secondary-bg-color)',
    borderTop: '1px solid var(--border)',
  },
  error: {
    marginBottom: '16px',
    padding: '12px 16px',
    background: 'rgba(244, 67, 54, 0.1)',
    border: '1px solid rgba(244, 67, 54, 0.3)',
    borderRadius: '12px',
    color: '#f44336',
    fontSize: '14px',
    textAlign: 'center',
  },
  sendBtn: {
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