import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  to?: string;
  onBack?: () => void;
  children?: ReactNode;
}

export function BackButton({ to = '/', onBack, children }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onBack) return onBack();
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(to);
    }
  };

  return (
    <button onClick={handleClick} style={styles.btn} aria-label="Назад">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {children}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  btn: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    color: 'var(--ink)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 10,
  },
};