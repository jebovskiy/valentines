import { hapticFeedback } from '../utils/telegram';

interface PhotoLightboxProps {
  src: string;
  onClose: () => void;
}

export function PhotoLightbox({ src, onClose }: PhotoLightboxProps) {
  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-label="Фото в полный экран">
      <button
        onClick={(e) => {
          e.stopPropagation();
          hapticFeedback('impact', 'light');
          onClose();
        }}
        style={styles.close}
        aria-label="Закрыть"
      >
        ×
      </button>
      <img
        src={src}
        alt="Фото валентинки"
        style={styles.img}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'rgba(0,0,0,0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 'calc(20px + var(--app-safe-top))',
    paddingBottom: 'calc(20px + var(--app-safe-bottom))',
    paddingLeft: 'calc(20px + var(--app-safe-left))',
    paddingRight: 'calc(20px + var(--app-safe-right))',
  },
  img: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    borderRadius: '12px',
    WebkitUserSelect: 'none',
    userSelect: 'none',
  },
  close: {
    position: 'fixed',
    top: 'calc(14px + var(--app-safe-top))',
    right: 'calc(14px + var(--app-safe-right))',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    fontSize: '26px',
    lineHeight: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    cursor: 'pointer',
    zIndex: 1001,
  },
};