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
              background: animationType === anim.type ? 'linear-gradient(160deg, #FF9A8C, var(--accent-coral-dim))' : 'var(--bg-panel-2)',
              border: animationType === anim.type ? '1px solid transparent' : '1px solid rgba(255, 255, 255, 0.06)',
              boxShadow: animationType === anim.type ? '0 8px 20px -6px rgba(255, 122, 107, 0.5)' : 'none',
              transform: animationType === anim.type ? 'scale(1.05)' : 'scale(1)',
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
    fontFamily: 'var(--font-display)',
    fontWeight: '600',
    fontSize: '20px',
    color: 'var(--text-cream)',
  },
  subtitle: {
    color: 'var(--text-faint)',
    fontSize: '12px',
    marginTop: '2px',
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
    borderRadius: '18px',
    fontSize: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-panel-2)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    transition: 'transform 0.15s ease, background 0.15s ease, border 0.15s ease',
    cursor: 'pointer',
  },
  composeCard: {
    marginTop: '22px',
    minHeight: '150px',
    borderRadius: '24px',
    background: 'var(--bg-panel-2)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
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
    fontSize: '11px',
    color: 'var(--accent-gold)',
    background: 'rgba(240, 184, 96, 0.12)',
    padding: '4px 10px',
    borderRadius: '100px',
    fontFamily: 'monospace',
  },
  textarea: {
    width: '100%',
    fontSize: '16px',
    lineHeight: 1.5,
    color: 'var(--text-cream)',
    background: 'transparent',
    resize: 'none',
    minHeight: '80px',
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
  },
  charCounter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '4px',
    padding: '8px 0 0',
    fontSize: '12px',
    color: 'var(--text-faint)',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    marginTop: '12px',
  },
  error: {
    marginBottom: '16px',
    padding: '12px 16px',
    background: 'rgba(184, 86, 75, 0.15)',
    border: '1px solid rgba(255, 122, 107, 0.3)',
    borderRadius: '12px',
    color: 'var(--accent-coral)',
    fontSize: '14px',
    textAlign: 'center',
  },
  sendBtn: {
    width: '100%',
    marginTop: '24px',
    height: '52px',
    borderRadius: '100px',
    background: 'linear-gradient(120deg, var(--accent-coral), var(--accent-coral-dim))',
    color: '#2A0F0C',
    fontSize: '15px',
    fontWeight: '600',
    boxShadow: 'var(--shadow-glow)',
    cursor: 'pointer',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};