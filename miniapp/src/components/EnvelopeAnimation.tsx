const HEART_PATH =
  'M12,21 C5,16 1,11 1,7.5 C1,4 3.5,2 6.5,2 C8.5,2 10.5,3 12,5.5 C13.5,3 15.5,2 17.5,2 C20.5,2 23,4 23,7.5 C23,11 19,16 12,21 Z';

/**
 * Envelope from the animations sketch (map.html): the flap opens, the letter
 * rises out of the envelope and a heart appears on it. Reads well at small
 * sizes. Shows the opened final frame when autoPlay is off.
 */
export function EnvelopeAnimation({
  size = 100,
  autoPlay = true,
  style,
  className,
}: {
  size?: number;
  autoPlay?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  const w = size;
  const h = size * 0.68;
  const inset = size * 0.06;

  const letterPlay = autoPlay
    ? { animation: 'va-env-letter 4s ease infinite' }
    : { transform: 'translateY(-62%)' };
  const heartPlay = autoPlay
    ? { animation: 'va-env-heart 4s ease infinite' }
    : { opacity: 1, transform: 'scale(1)' };
  const flapPlay = autoPlay
    ? { animation: 'va-env-flap 4s ease infinite' }
    : { transform: 'rotateX(180deg)', zIndex: 0 };

  return (
    <div
      style={{
        ...style,
        position: 'relative',
        width: w,
        height: h,
        perspective: w * 3.5,
      }}
      className={className}
      role="img"
      aria-label="Конверт открывается, из него поднимается письмо с сердцем"
    >
      {/* envelope interior */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: size * 0.07,
          background: '#ffc9d4',
        }}
      />
      {/* letter rising out */}
      <div
        style={{
          position: 'absolute',
          left: inset,
          right: inset,
          top: size * 0.07,
          height: h * 0.84,
          borderRadius: size * 0.04,
          background: 'var(--canvas)',
          border: '1px solid #ffccd6',
          boxShadow: '0 4px 12px rgba(230, 0, 35, 0.14)',
          zIndex: 1,
          display: 'grid',
          placeItems: 'center',
          ...letterPlay,
        }}
      >
        <svg
          width={size * 0.24}
          height={size * 0.24}
          viewBox="0 0 24 24"
          fill="none"
          role="presentation"
          style={{
            color: 'var(--primary)',
            opacity: 0,
            willChange: 'opacity, transform',
            ...heartPlay,
          }}
        >
          <path
            d={HEART_PATH}
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: 'drop-shadow(0 2px 5px rgba(230, 0, 35, 0.4))',
            }}
          />
        </svg>
      </div>
      {/* front face with V-shaped opening */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          borderRadius: size * 0.07,
          background: '#ff9fb3',
          clipPath: 'polygon(0 0, 50% 58%, 100% 0, 100% 100%, 0 100%)',
        }}
      />
      {/* flap */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '58%',
          zIndex: 3,
          background: '#f78aa0',
          clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
          transformOrigin: '50% 0%',
          willChange: 'transform, z-index',
          ...flapPlay,
        }}
      />
    </div>
  );
}