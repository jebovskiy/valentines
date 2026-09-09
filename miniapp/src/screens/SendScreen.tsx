import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore, partnerName } from '../hooks/useValentinesStore';
import { setMainButton, setBackButton, hapticFeedback } from '../utils/telegram';
import { BackButton } from '../components/BackButton';
import { AppleEmoji } from '../components/AppleEmoji';
import { ANIMATIONS, AnimationType, STREAK_LOCKED_ANIMATIONS, TEST_TELEGRAM_ID } from '../types';

const MAX_MESSAGE_LENGTH = 500;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function SendScreen() {
  const navigate = useNavigate();
  const { sendValentine, currentUser, pair, streak } = useValentinesStore();
  const [message, setMessage] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [mode, setMode] = useState<'text' | 'photo'>('text');
  const [animationType, setAnimationType] = useState<AnimationType>('heart_open');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [recipient, setRecipient] = useState<'partner' | 'self'>('partner');
  const [lockHint, setLockHint] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maxStreak = streak?.max ?? 0;

  const partner = partnerName(pair, currentUser?.id ?? null);
  const isTestUser = currentUser?.id === TEST_TELEGRAM_ID;

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, () => navigate(-1));
  }, [navigate]);

  useEffect(() => {
    setCharCount(message.length);
  }, [message]);

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Выберите изображение (JPG, PNG или WebP)');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('Фото больше 5 МБ. Выберите другое.');
      return;
    }
    setError(null);
    fileToBase64(file)
      .then((dataUrl) => {
        setPhotoBase64(dataUrl);
        setMode('photo');
      })
      .catch(() => setError('Не удалось прочитать файл'));
  };

  const handleSend = async () => {
    if (isSending) return;

    let effectivePayload: { message: string | null; photo: string | null } = { message: null, photo: null };
    if (mode === 'photo') {
      if (!photoBase64) {
        setError('Добавьте фото');
        return;
      }
      effectivePayload = { message: null, photo: photoBase64 };
    } else {
      if (!message.trim()) {
        setError('Введите текст или добавьте фото');
        return;
      }
      effectivePayload = { message: message.trim(), photo: null };
    }

    hapticFeedback('impact', 'medium');
    setIsSending(true);
    setError(null);

    const valentine = await sendValentine(
      animationType,
      effectivePayload.message,
      isTestUser ? recipient : 'partner',
      effectivePayload.photo
    );

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
        <p style={styles.subtitle}>выбери анимацию и добавь фото или текст</p>
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
        {ANIMATIONS.map((anim) => {
          const active = animationType === anim.type;
          const lockedDay = STREAK_LOCKED_ANIMATIONS[anim.type];
          const locked = lockedDay !== undefined && maxStreak < lockedDay;
          return (
            <button
              key={anim.type}
              onClick={() => {
                if (locked) {
                  setLockHint(`Откроется на ${lockedDay}-й день стрика 🔥 (сейчас ${maxStreak})`);
                  hapticFeedback('impact', 'light');
                  return;
                }
                setLockHint(null);
                setAnimationType(anim.type);
              }}
              style={{
                ...styles.typeChip,
                opacity: locked ? 0.55 : active ? 1 : 0.9,
                background: active ? 'var(--ink)' : 'var(--surface-card)',
                color: active ? 'var(--canvas)' : 'var(--ink)',
                border: active ? '1px solid var(--ink)' : '1px solid var(--hairline)',
              }}
              aria-label={anim.label}
            >
              <AppleEmoji emoji={anim.emoji} size={16} />
              {anim.label}
              {locked ? ' 🔒' : ''}
            </button>
          );
        })}
      </div>

      {lockHint && (
        <p style={{ margin: '2px 0 0', textAlign: 'center', fontSize: 13, color: 'var(--ink-secondary)' }}>{lockHint}</p>
      )}

      <div style={styles.modeRow}>
        <button
          onClick={() => {
            setMode('text');
            setError(null);
          }}
          style={{
            ...styles.modeChip,
            background: mode === 'text' ? 'var(--ink)' : 'var(--surface-card)',
            color: mode === 'text' ? 'var(--canvas)' : 'var(--ink)',
          }}
        >
          Текст
        </button>
        <button
          onClick={() => {
            setMode('photo');
            setError(null);
            if (!photoBase64) fileInputRef.current?.click();
          }}
          style={{
            ...styles.modeChip,
            background: mode === 'photo' ? 'var(--ink)' : 'var(--surface-card)',
            color: mode === 'photo' ? 'var(--canvas)' : 'var(--ink)',
          }}
        >
          Изображение
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {mode === 'text' ? (
        <div style={styles.composeCard}>
          <textarea
            value={message}
            onChange={handleMessageChange}
            placeholder={`Скучаю. Вернись скорее…`}
            style={styles.textarea}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={5}
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
      ) : (
        <div style={styles.photoCard}>
          {photoBase64 ? (
            <>
              <img src={photoBase64} alt="Выбранное фото" style={styles.photoPreview} />
              <button onClick={() => fileInputRef.current?.click()} style={styles.changePhotoBtn}>
                Изменить фото
              </button>
              <button
                onClick={() => {
                  setPhotoBase64(null);
                }}
                style={styles.clearPhotoBtn}
              >
                Убрать фото
              </button>
            </>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} style={styles.photoPicker}>
              <span style={styles.photoPickerIcon}>📷</span>
              <span>Выбрать фотографию</span>
            </button>
          )}
        </div>
      )}

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
    fontWeight: '700',
    fontSize: '24px',
    color: 'var(--ink)',
    letterSpacing: '-0.5px',
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
    flexWrap: 'wrap',
    gap: '8px',
    padding: '20px 0 0',
  },
  typeChip: {
    height: '36px',
    padding: '0 16px',
    borderRadius: '9999px',
    fontFamily: 'var(--font-display)',
    fontSize: '12px',
    fontWeight: '700',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    transition: 'background 0.15s ease, color 0.15s ease, border 0.15s ease',
    cursor: 'pointer',
  },
  composeCard: {
    marginTop: '22px',
    borderRadius: '16px',
    background: 'var(--canvas)',
    border: '1px solid var(--ash)',
    padding: '15px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  photoCard: {
    marginTop: '22px',
    borderRadius: '16px',
    background: 'var(--canvas)',
    border: '1px solid var(--ash)',
    padding: '15px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    maxHeight: '300px',
    objectFit: 'contain',
    borderRadius: '12px',
  },
  photoPicker: {
    width: '100%',
    height: '140px',
    borderRadius: '12px',
    background: 'var(--surface-card)',
    border: '1px dashed var(--ash)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  photoPickerIcon: {
    fontSize: '36px',
  },
  changePhotoBtn: {
    width: '100%',
    height: '40px',
    borderRadius: '16px',
    background: 'var(--surface-card)',
    color: 'var(--ink)',
    fontSize: '13px',
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
    border: '1px solid var(--hairline)',
    cursor: 'pointer',
  },
  clearPhotoBtn: {
    width: '100%',
    height: '40px',
    borderRadius: '16px',
    background: 'transparent',
    color: 'var(--mute)',
    fontSize: '13px',
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
  },
  modeRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px',
  },
  modeChip: {
    flex: 1,
    height: '44px',
    borderRadius: '16px',
    fontSize: '14px',
    fontWeight: '700',
    fontFamily: 'var(--font-display)',
    border: '1px solid var(--hairline)',
    cursor: 'pointer',
    lineHeight: '1.4',
  },
  textarea: {
    width: '100%',
    fontSize: '14px',
    lineHeight: 1.5,
    color: 'var(--ink)',
    background: 'transparent',
    resize: 'none',
    minHeight: '130px',
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
    height: '44px',
    borderRadius: '16px',
    background: 'var(--primary)',
    color: 'var(--on-primary)',
    fontFamily: 'var(--font-display)',
    fontSize: '14px',
    fontWeight: '700',
    lineHeight: 1,
    cursor: 'pointer',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};