import { HeartSquare } from './HeartSquare';

const RING_DELAYS = [0, 0.9, 1.8];

const GOLD = '#f0b83e';

/**
 * "Halo": a golden heart (square-heart shape) with glowing rings scaling out
 * on staggered delays. Static frame shows the heart with one ring lit.
 */
export function HaloAnimation({
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
  const heartSize = size * 0.52;
  const ringW = size * 0.3;
  const ringH = size * 0.14;
  return (
    <div
      style={{
        ...style,
        position: 'relative',
        width: size,
        height: size,
      }}
      className={className}
      role="img"
      aria-label="Золотое сияющее сердце"
    >
      {/* glowing rings */}
      {RING_DELAYS.map((d, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            top: '36%',
            width: ringW,
            height: ringH,
            marginLeft: -ringW / 2,
            marginTop: -ringH / 2,
            border: `2px solid ${GOLD}`,
            borderRadius: '50%',
            opacity: 0,
            willChange: 'transform, opacity',
            animation: autoPlay
              ? `va-ring 2.8s ease-out ${d}s infinite`
              : 'none',
            ...(autoPlay ? {} : { opacity: 0.9, transform: 'scale(1.4)' }),
          }}
        />
      ))}

      {/* golden heart */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginLeft: -(heartSize * 0.5),
          marginTop: -(heartSize * 0.42),
        }}
      >
        <HeartSquare size={heartSize} color={GOLD} />
      </div>
    </div>
  );
}