const SPARKLES = [
  { x: 0.5, y: 0.45, s: 1.0, d: 0 },
  { x: 0.33, y: 0.3, s: 0.55, d: -0.8 },
  { x: 0.67, y: 0.28, s: 0.6, d: -1.2 },
  { x: 0.26, y: 0.6, s: 0.5, d: -0.4 },
  { x: 0.72, y: 0.62, s: 0.55, d: -1.6 },
  { x: 0.5, y: 0.72, s: 0.7, d: -2.0 },
  { x: 0.4, y: 0.16, s: 0.38, d: -0.6 },
  { x: 0.62, y: 0.85, s: 0.42, d: -1.0 },
];

const CLIP_STAR =
  'polygon(50% 0%, 57% 43%, 100% 50%, 57% 57%, 50% 100%, 43% 57%, 0% 50%, 43% 43%)';

/**
 * "Sparkle": golden 4-point stars bursting around the center, each twinkling
 * in, drifting up a little and fading. Reads well at small sizes.
 */
export function SparkleAnimation({
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
      }}
      className={className}
      role="img"
      aria-label="Золотые искры вспыхивают вокруг центра"
    >
      {SPARKLES.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x * 100}%`,
            top: `${p.y * 100}%`,
            width: size * 0.2 * p.s,
            height: size * 0.2 * p.s,
            background: i % 2 === 0 ? '#ffe27a' : '#fff3c4',
            clipPath: CLIP_STAR,
            opacity: autoPlay ? 0 : i === 0 ? 1 : 0,
            filter: 'drop-shadow(0 0 4px rgba(240, 184, 62, 0.55))',
            willChange: 'transform, opacity',
            transform: autoPlay ? undefined : 'scale(0.9)',
            animation: autoPlay
              ? `va-spark-twinkle 2.8s ease-in-out ${p.d}s infinite`
              : 'none',
          }}
        />
      ))}

      {autoPlay && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,235,160,0.28), transparent 70%)',
            animation: 'va-glow-in 1s ease-out infinite',
          }}
        />
      )}
    </div>
  );
}