import { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';
import { setMainButton, setBackButton, hapticFeedback, webApp } from '../utils/telegram';
import { BackButton } from '../components/BackButton';

export function PairingScreen() {
  const [step, setStep] = useState<'init' | 'qr' | 'success' | 'error'>('init');
  const [pairingUrl, setPairingUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true);
    initPairing();
  }, []);

  const initPairing = async () => {
    setStep('init');
    setError('');
    const result = await api.initiatePairing();
    if (result.error) {
      setError(result.error);
      setStep('error');
      return;
    }
    setPairingUrl(result.data!.pairingUrl);
    setToken(result.data!.token);
    setStep('qr');
  };

  const copyLink = () => {
    if (pairingUrl) {
      navigator.clipboard.writeText(pairingUrl);
      hapticFeedback('notification', 'success');
    }
  };

  const openDeepLink = () => {
    if (pairingUrl && webApp) {
      webApp.openLink(pairingUrl);
    }
  };

  useEffect(() => {
    if (step !== 'qr' || !token) return;
    const poll = setInterval(async () => {
      const result = await api.getPairingStatus(token);
      if (result.data?.status === 'completed') {
        clearInterval(poll);
        setStep('success');
        hapticFeedback('notification', 'success');
      } else if (result.data?.status === 'expired') {
        clearInterval(poll);
        setError('Ссылка истекла. Создайте новую.');
        setStep('error');
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [step, token]);

  return (
    <div style={styles.container}>
      <BackButton to="/" />
      {step === 'init' && (
        <LoadingState text="Создание ссылки для пэйринга..." />
      )}

      {step === 'qr' && (
        <QRStep
          pairingUrl={pairingUrl}
          token={token}
          onCopy={copyLink}
          onOpenApp={openDeepLink}
          onRetry={initPairing}
        />
      )}

      {step === 'success' && (
        <SuccessState onRetry={initPairing} />
      )}

      {step === 'error' && (
        <ErrorState error={error} onRetry={initPairing} />
      )}
    </div>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <div style={styles.centerContainer}>
      <div style={styles.spinner} />
      <p style={styles.loadingText}>{text}</p>
    </div>
  );
}

function QRStep({
  pairingUrl,
  token,
  onCopy,
  onOpenApp,
  onRetry,
}: {
  pairingUrl: string;
  token: string;
  onCopy: () => void;
  onOpenApp: () => void;
  onRetry: () => void;
}) {
  return (
    <div style={styles.centerContainer}>
      <div style={styles.iconWrapper}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      </div>
      <h2 style={styles.title}>Настройка виджета</h2>
      <p style={styles.description}>
        Установите companion-приложение и откройте эту ссылку, чтобы связать его с вашей парой
      </p>

      <div style={styles.qrWrapper}>
        <QRCode value={pairingUrl} size={200} />
        <p style={styles.tokenText}>Токен: <code>{token.slice(0, 8)}...{token.slice(-8)}</code></p>
      </div>

      <div style={styles.actions}>
        <button onClick={onOpenApp} style={styles.primaryButton}>
          Открыть в приложении
        </button>
        <button onClick={onCopy} style={styles.secondaryButton}>
          Копировать ссылку
        </button>
      </div>

      <p style={styles.hint}>
        Ссылка действует 10 минут. Если приложение не установлено, откроется страница с инструкцией.
      </p>

      <button onClick={onRetry} style={styles.retryButton}>
        Создать новую ссылку
      </button>
    </div>
  );
}

function SuccessState({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={styles.centerContainer}>
      <div style={styles.successIcon}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="16 8 12 12 8 16" />
        </svg>
      </div>
      <h2 style={styles.title}>Виджет настроен!</h2>
      <p style={styles.description}>
        Парная связь установлена. Валентинки теперь будут появляться на виджете мгновенно.
      </p>
      <button onClick={onRetry} style={styles.retryButton}>
        Пересвязать устройство
      </button>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div style={styles.centerContainer}>
      <div style={styles.errorIcon}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <h2 style={styles.title}>Ошибка</h2>
      <p style={styles.errorText}>{error}</p>
      <button onClick={onRetry} style={styles.primaryButton}>
        Попробовать снова
      </button>
    </div>
  );
}

function QRCode({ value, size }: { value: string; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Simple QR code placeholder - in production use a real QR library
    ctx.fillStyle = '#000000';
    const moduleSize = size / 25;
    for (let y = 0; y < 25; y++) {
      for (let x = 0; x < 25; x++) {
        // Simple pattern based on string hash
        const hash = simpleHash(value + x + y);
        if (hash % 2 === 0) {
          ctx.fillRect(x * moduleSize, y * moduleSize, moduleSize, moduleSize);
        }
      }
    }
    // Finder patterns
    drawFinder(ctx, 0, 0, moduleSize);
    drawFinder(ctx, 18, 0, moduleSize);
    drawFinder(ctx, 0, 18, moduleSize);
  }, [value, size]);

  return <canvas ref={canvasRef} width={size} height={size} style={styles.qrCanvas} />;
}

function drawFinder(ctx: CanvasRenderingContext2D, x: number, y: number, moduleSize: number) {
  ctx.fillStyle = '#000000';
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
        ctx.fillRect((x + i) * moduleSize, (y + j) * moduleSize, moduleSize, moduleSize);
      }
    }
  }
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    maxWidth: '480px',
    margin: '0 auto',
    flex: 1,
    position: 'relative',
  },
  centerContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    textAlign: 'center',
    padding: '24px',
    gap: '20px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '2px solid var(--hairline-soft)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  spinnerLarge: {
    width: '48px',
    height: '48px',
    border: '4px solid var(--hairline-soft)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: 'var(--text-secondary)',
    fontSize: '16px',
  },
  iconWrapper: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'var(--secondary-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--primary)',
    marginBottom: '8px',
  },
  successIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'var(--success-pale)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--success-deep)',
    marginBottom: '8px',
  },
  errorIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(158, 10, 10, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--error)',
    marginBottom: '8px',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '20px',
    fontWeight: '700',
    marginBottom: '8px',
    color: 'var(--ink)',
    letterSpacing: '-0.5px',
  },
  description: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    maxWidth: '320px',
    marginBottom: '16px',
    fontFamily: 'var(--font-body)',
  },
  qrWrapper: {
    background: 'white',
    padding: '16px',
    borderRadius: '16px',
    border: '1px solid var(--hairline)',
    marginBottom: '20px',
  },
  qrCanvas: {
    display: 'block',
    margin: '0 auto',
    borderRadius: '8px',
  },
  tokenText: {
    marginTop: '12px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    maxWidth: '300px',
    marginBottom: '16px',
  },
  primaryButton: {
    padding: '0 20px',
    height: '44px',
    background: 'var(--primary)',
    color: 'var(--on-primary)',
    borderRadius: '16px',
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
    fontSize: '14px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  secondaryButton: {
    padding: '0 18px',
    height: '40px',
    background: 'var(--canvas)',
    color: 'var(--ink)',
    borderRadius: '16px',
    border: '1px solid var(--hairline)',
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
    fontSize: '12px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  retryButton: {
    padding: '0 18px',
    height: '40px',
    background: 'transparent',
    color: 'var(--ink-soft)',
    borderRadius: '16px',
    fontFamily: 'var(--font-display)',
    fontWeight: '600',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  hint: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    maxWidth: '320px',
    marginBottom: '16px',
    fontFamily: 'var(--font-body)',
  },
  errorText: {
    color: 'var(--error)',
    fontSize: '14px',
    marginBottom: '16px',
    fontFamily: 'var(--font-body)',
  },
  pairInfo: {
    marginTop: '16px',
    padding: '16px',
    background: 'var(--secondary-bg)',
    borderRadius: '16px',
    border: '1px solid var(--hairline)',
  },
  pairId: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
  },
};