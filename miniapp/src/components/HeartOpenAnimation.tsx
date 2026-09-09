import { useEffect, useState } from 'react';

const HEART_PATH =
  'M12,21 C5,16 1,11 1,7.5 C1,4 3.5,2 6.5,2 C8.5,2 10.5,3 12,5.5 C13.5,3 15.5,2 17.5,2 C20.5,2 23,4 23,7.5 C23,11 19,16 12,21 Z';

export function HeartOpenAnimation({
  size = 40,
  autoPlay = true,
  duration = 900,
  style,
  className,
}: {
  size?: number;
  autoPlay?: boolean;
  duration?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [visible, setVisible] = useState(!autoPlay);

  useEffect(() => {
    if (!autoPlay) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, [autoPlay]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{
        ...style,
        width: size,
        height: size,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.3)',
        transition: autoPlay
          ? `opacity ${duration * 0.35}ms cubic-bezier(0.34, 1.56, 0.64, 1), transform ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1)`
          : 'none',
        willChange: 'transform, opacity',
      }}
      className={className}
      role="img"
      aria-label="Анимированное сердце"
    >
      <path
        d={HEART_PATH}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          filter: 'drop-shadow(0 2px 6px rgba(233, 30, 99, 0.35))',
        }}
      />
    </svg>
  );
}
