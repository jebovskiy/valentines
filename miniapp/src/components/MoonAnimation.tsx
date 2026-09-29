const STARS = [
  { x: 10, y: 20, delay: 0 },
  { x: 22, y: 60, delay: 0.7 },
  { x: 70, y: 15, delay: 1.4 },
  { x: 85, y: 55, delay: 0.3 },
  { x: 45, y: 75, delay: 1.9 },
  { x: 60, y: 30, delay: 1.1 },
  { x: 15, y: 45, delay: 2.3 },
  { x: 90, y: 30, delay: 0.9 },
];

const CRESCENT_PATH =
  'M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.298 7.299 7.298.463 0 .916-.07 1.34-.202a.768.768 0 0 1 .728 1.353 8.598 8.598 0 0 1-2.068 1.268 8.584 8.584 0 0 1-4.299 0A8.577 8.577 0 0 1 0 8.567 8.577 8.577 0 0 1 6 .278z';

/**
 * "Night": a gold crescent drifting over a dark sky with twinkling stars.
 * Self-contained dark stage so it reads well at small sizes.
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
        overflow: 'hidden',
        borderRadius: size * 0.18,
        background: 'linear-gradient(180deg, #151033, #241a4a)',
      }}
      className={className}
      role="img"
      aria-label="Полумесяц со звёздами"
    >
      {/* stars */}
      {STARS.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: size * 0.03,
            height: size * 0.03,
            borderRadius: '50%',
            background: '#fff',
            opacity: 0,
            willChange: 'opacity',
            animation: autoPlay
              ? `va-tw 3s ease-in-out ${s.delay}s infinite`
              : 'none',
            ...(autoPlay ? {} : { opacity: 0.8 }),
          }}
        />
      ))}

      {/* crescent moon */}
      <svg
        width={size * 0.48}
        height={size * 0.48}
        viewBox="0 0 16 16"
        fill="none"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginLeft: -(size * 0.48) / 2,
          marginTop: -(size * 0.48) / 2,
          color: '#f0b860',
          filter: 'drop-shadow(0 0 14px rgba(240, 200, 120, 0.4))',
          willChange: 'transform',
          animation: autoPlay ? 'va-drift 6s ease-in-out infinite' : 'none',
        }}
      >
        <path d={CRESCENT_PATH} fill="currentColor" />
      </svg>
    </div>
  );
}