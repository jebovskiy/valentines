const STARS = [
  { x: 0.24, y: 0.2, s: 0.09, delay: 0 },
  { x: 0.72, y: 0.14, s: 0.07, delay: -0.8 },
  { x: 0.84, y: 0.42, s: 0.1, delay: -1.4 },
  { x: 0.18, y: 0.6, s: 0.12, delay: -1.9 },
  { x: 0.7, y: 0.72, s: 0.08, delay: -0.5 },
  { x: 0.36, y: 0.84, s: 0.07, delay: -2.3 },
];

const CRESCENT_PATH =
  'M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.298 7.299 7.298.463 0 .916-.07 1.34-.202a.768.768 0 0 1 .728 1.353 8.598 8.598 0 0 1-2.068 1.268 8.584 8.584 0 0 1-4.299 0A8.577 8.577 0 0 1 0 8.567 8.577 8.577 0 0 1 6 .278z';

/**
 * "Moon": relaxing crescent with a soft glow and twinkling stars. Reads well
 * at small sizes; static frame shows the moon fully lit.
 */
export function MoonAnimation({
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
  return (
    <div
      style={{
        ...style,
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      className={className}
      role="img"
      aria-label="Полумесяц со звёздами"
    >
      {/* halo glow */}
      <div
        style={{
          position: 'absolute',
          width: size * 0.95,
          height: size * 0.95,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(190, 216, 250, 0.42), transparent 70%)',
          opacity: 0,
          willChange: 'opacity',
          animation: autoPlay ? 'va-moon-glow 4s ease-in-out infinite' : 'none',
          ...(autoPlay ? {} : { opacity: 1 }),
        }}
      />

      {/* stars */}
      {STARS.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${s.x * 100}%`,
            top: `${s.y * 100}%`,
            width: size * s.s,
            height: size * s.s,
            borderRadius: '50%',
            background: '#ffffff',
            opacity: 0,
            willChange: 'opacity, transform',
            animation: autoPlay
              ? `va-moon-star 3s ease-in-out ${s.delay}s infinite`
              : 'none',
            ...(autoPlay ? {} : { opacity: 0.85 }),
          }}
        />
      ))}

      {/* crescent */}
      <svg
        width={size * 0.52}
        height={size * 0.52}
        viewBox="0 0 16 16"
        fill="none"
        style={{
          position: 'relative',
          color: '#f7f3e0',
          filter: 'drop-shadow(0 0 14px rgba(240, 200, 120, 0.45))',
          willChange: 'transform',
          animation: autoPlay ? 'va-moon-float 4s ease-in-out infinite' : 'none',
        }}
      >
        <path d={CRESCENT_PATH} fill="currentColor" />
      </svg>
    </div>
  );
}