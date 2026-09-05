import { useEffect, useState, useRef } from 'react';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { api } from '../api/client';
import { setMainButton, setBackButton, hapticFeedback, webApp } from '../utils/telegram';

export function PairingScreen() {
  const { pair, fetchPair } = useValentinesStore();
  const [step, setStep] = useState<'init' | 'qr' | 'waiting' | 'success' | 'error'>('init');
  const [pairingUrl, setPairingUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true);
    if (!pair) {
      initPairing();
    } else {
      setStep('success');
    }
  }, [pair]);

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

  return (
    <div style={styles.container}>
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

      {step === 'waiting' && (
        <WaitingState onRetry={initPairing} />
      )}

      {step === 'success' && (
        <SuccessState pair={pair!} onRetry={initPairing} />
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
        Ссылка действует 10 минут. Если приложение не установлено, откроется страница в App Store / Google Play.
      </p>

      <button onClick={onRetry} style={styles.retryButton}>
        Создать новую ссылку
      </button>
    </div>
  );
}

function WaitingState({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={styles.centerContainer}>
      <div style={styles.spinnerLarge} />
      <h2 style={styles.title}>Ожидание подключения...</h2>
      <p style={styles.description}>
        Откройте ссылку в companion-приложении. Экран обновится автоматически после успешного пэйринга.
      </p>
      <button onClick={onRetry} style={styles.retryButton}>
        Отмена
      </button>
    </div>
  );
}

function SuccessState({ pair, onRetry }: { pair: any; onRetry: () => void }) {
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
        Парная связь установлена. Валентинки теперь будут появляться на виджете партнера мгновенно.
      </p>
      <div style={styles.pairInfo}>
        <p style={styles.pairId}>ID пары: <code>{pair.id.slice(0, 8)}...</code></p>
      </div>
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
    border: '3px solid var(--border)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  spinnerLarge: {
    width: '48px',
    height: '48px',
    border: '4px solid var(--border)',
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
    background: 'var(--primary-light)',
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
    background: 'rgba(76, 175, 80, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#4caf50',
    marginBottom: '8px',
  },
  errorIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(244, 67, 54, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#f44336',
    marginBottom: '8px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '8px',
  },
  description: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    maxWidth: '320px',
    marginBottom: '16px',
  },
  qrWrapper: {
    background: 'white',
    padding: '16px',
    borderRadius: '16px',
    boxShadow: 'var(--shadow)',
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
    fontFamily: 'monospace',
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
    padding: '16px',
    background: 'var(--primary)',
    color: 'var(--tg-button-text-color)',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '16px',
  },
  secondaryButton: {
    padding: '16px',
    background: 'var(--tg-secondary-bg-color)',
    color: 'var(--text-primary)',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '16px',
    border: '1px solid var(--border)',
  },
  retryButton: {
    padding: '12px 24px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    borderRadius: '12px',
    fontWeight: '500',
    fontSize: '14px',
  },
  hint: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    maxWidth: '320px',
    marginBottom: '16px',
  },
  errorText: {
    color: '#f44336',
    fontSize: '14px',
    marginBottom: '16px',
  },
  pairInfo: {
    marginTop: '16px',
    padding: '16px',
    background: 'var(--tg-secondary-bg-color)',
    borderRadius: '12px',
    border: '1px solid var(--border)',
  },
  pairId: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    fontFamily: 'monospace',
  },
};