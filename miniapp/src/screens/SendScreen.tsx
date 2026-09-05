import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { setMainButton, setBackButton, hapticFeedback } from '../utils/telegram';
import { HeartOpenAnimation } from '../components/HeartOpenAnimation';

const MAX_MESSAGE_LENGTH = 500;

export function SendScreen() {
  const navigate = useNavigate();
  const { sendValentine, currentUser } = useValentinesStore();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMainButton({
      text: 'Отправить',
      onClick: handleSend,
      color: 'var(--tg-button-color)',
      isVisible: true,
    });
    setBackButton(true, () => navigate(-1));
    textareaRef.current?.focus();
  }, [navigate]);

  useEffect(() => {
    setCharCount(message.length);
  }, [message]);

  const handleSend = async () => {
    if (isSending) return;
    if (!message.trim() && !currentUser) return;

    hapticFeedback('impact', 'medium');
    setIsSending(true);
    setError(null);

    const valentine = await sendValentine('heart_open', message.trim() || null);

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
        <h1 style={styles.title}>Новая валентинка</h1>
      </header>

      <div style={styles.animationWrapper}>
        <HeartOpenAnimation size={100} autoPlay={true} duration={1000} />
      </div>

      <div style={styles.inputWrapper}>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleMessageChange}
          placeholder="Напишите что-то приятное... (необязательно)"
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

      <div style={styles.hint}>
        <span style={styles.hintIcon}>✨</span>
        <span>Валентинка мгновенно появится на виджете партнера</span>
      </div>
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
  animationWrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '24px',
    padding: '24px',
    background: 'var(--primary-light)',
    borderRadius: '24px',
    border: '1px solid rgba(233, 30, 99, 0.15)',
  },
  inputWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--surface-elevated)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  textarea: {
    flex: 1,
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
  hint: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  hintIcon: {
    fontSize: '16px',
  },
};