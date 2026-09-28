const RAYS = [0, 40, 80, 120, 160, 200, 240, 280, 320];

const HEART_PATH =
  'M12,21 C5,16 1,11 1,7.5 C1,4 3.5,2 6.5,2 C8.5,2 10.5,3 12,5.5 C13.5,3 15.5,2 17.5,2 C20.5,2 23,4 23,7.5 C23,11 19,16 12,21 Z';

const SPARKS = [
  { x: 0.5, y: 0.5, s: 0.18, d: 0 },
  { x: 0.3, y: 0.3, s: 0.1, d: -0.5 },
  { x: 0.7, y: 0.28, s: 0.12, d: -1 },
  { x: 0.26, y: 0.62, s: 0.09, d: -1.5 },
  { x: 0.74, y: 0.66, s: 0.1, d: -2 },
];

/**
 * "Golden halo": a crown-like ring of rotating light rays around a golden
 * heart, with small sparks at the tips. Reads well at small sizes.
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
  const rayLen = size * 0.72;
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
      aria-label="Золотое сияние вокруг сердца"
    >
      {/* halo rays */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          opacity: 0.9,
          willChange: 'transform',
          animation: autoPlay ? 'va-halo-rotate 6s linear infinite' : 'none',
        }}
      >
        {RAYS.map((ang, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 2.5,
              height: rayLen,
              marginTop: -rayLen / 2,
              background:
                i % 2 === 0
                  ? 'linear-gradient(180deg, #f0c869 0%, #f7e7b6 50%, transparent 100%)'
                  : 'linear-gradient(180deg, #ffe27a 0%, #f7e7b6 50%, transparent 100%)',
              transform: `translate(-50%, 0) rotate(${ang}deg)`,
              opacity: i % 2 === 0 ? 0.9 : 0.55,
            }}
          />
        ))}
      </div>

      {/* sparks */}
      {SPARKS.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${s.x * 100}%`,
            top: `${s.y * 100}%`,
            width: size * 0.06 * (s.s / 0.18),
            height: size * 0.06 * (s.s / 0.18),
            borderRadius: '50%',
            background: '#fff3c4',
            opacity: 0,
            willChange: 'opacity, transform',
            animation: autoPlay
              ? `va-halo-spark 3s ease-in-out ${s.d}s infinite`
              : 'none',
            ...(autoPlay ? {} : { opacity: 0.9 }),
          }}
        />
      ))}

      {/* glowing heart */}
      <svg
        width={size * 0.44}
        height={size * 0.44}
        viewBox="0 0 24 24"
        fill="none"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          color: '#f0b83e',
          transform: 'translate(-50%, -50%)',
          filter: 'drop-shadow(0 0 10px rgba(240, 184, 62, 0.6))',
          willChange: 'transform',
          animation: autoPlay ? 'va-halo-heart 2s ease-in-out infinite' : 'none',
        }}
      >
        <path d={HEART_PATH} fill="currentColor" stroke="currentColor" strokeWidth="0.8" />
      </svg>
    </div>
  );
}