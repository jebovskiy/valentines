import { useHomeScreenPrompt } from '../lib/homeScreen';

interface AddToHomeBannerProps {
  /** Баннер живёт в глобальной обвязке и появляется только у парных. */
  visible: boolean;
}

/**
 * Предложение добавить ярлык на рабочий стол. Логика (кулдауны, статусы,
 * localStorage) — в `useHomeScreenPrompt`, здесь только вид.
 */
export function AddToHomeBanner({ visible }: AddToHomeBannerProps) {
  const prompt = useHomeScreenPrompt();

  if (!visible || !prompt.visible) return null;

  return (
    <div style={styles.card}>
      <div style={styles.top}>
        <span style={styles.icon}>🏠</span>
        <div style={styles.body}>
          <div style={styles.title}>Откройте приложение за секунду</div>
          <div style={styles.text}>
            Добавьте ярлык на рабочий стол — приложение откроется сразу, без поиска в Telegram.
          </div>
        </div>
      </div>
      <div style={styles.actions}>
        <button onClick={prompt.dismiss} style={styles.laterBtn} disabled={prompt.busy}>
          Не сейчас
        </button>
        <button onClick={() => void prompt.add()} style={styles.addBtn} disabled={prompt.busy}>
          {prompt.busy ? 'Добавляем…' : 'Добавить'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    position: 'fixed',
    left: 'calc(12px + var(--app-safe-left))',
    right: 'calc(12px + var(--app-safe-right))',
    // Над плавающей кнопкой «ленты» и под модалками, чтобы не перекрывать оверлеи.
    bottom: 'calc(84px + var(--app-bottom-inset))',
    zIndex: 90,
    background: 'var(--surface-card)',
    borderRadius: 18,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    border: '1px solid var(--hairline)',
    boxShadow: 'var(--shadow-fab)',
  },
  top: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 26,
    lineHeight: 1,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  text: {
    fontSize: 12,
    lineHeight: '18px',
    color: 'var(--mute)',
    marginTop: 3,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  laterBtn: {
    height: 38,
    padding: '0 14px',
    borderRadius: 999,
    background: 'var(--surface-soft)',
    color: 'var(--mute)',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  },
  addBtn: {
    height: 38,
    padding: '0 18px',
    borderRadius: 999,
    background: 'var(--primary)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  },
};