import { HeartSquare } from './HeartSquare';

const SPARKS = [
  { x: 26, y: 20, delay: 0 },
  { x: 76, y: 16, delay: 0.5 },
  { x: 18, y: 66, delay: 1.1 },
  { x: 82, y: 64, delay: 0.3 },
  { x: 50, y: 10, delay: 1.6 },
  { x: 50, y: 84, delay: 0.9 },
];

const STAR_COLOR = '#f0b860';

/**
 * "Sparkle": a still heart with twinkling star bursts around it (star = two
 * crossing bars, each burst rotates while scaling). Reads well at small sizes.
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
  const heartSize = size * 0.44;
  const spark = size * 0.14;
  const bar = spark * 0.143;
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
      aria-label="Сердце с искрами вокруг"
    >
      {/* still heart from square */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginLeft: -(heartSize * 0.5),
          marginTop: -(heartSize * 0.42),
        }}
      >
        <HeartSquare size={heartSize} color="#e8a0b8" />
      </div>

      {/* twinkling star bursts */}
      {SPARKS.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: spark,
            height: spark,
            opacity: 0,
            willChange: 'transform, opacity',
            animation: autoPlay
              ? `va-twk 2.4s ease-in-out ${s.delay}s infinite`
              : 'none',
            ...(autoPlay ? {} : { opacity: i === 0 ? 1 : 0.3 }),
          }}
        >
          {/* vertical bar */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              width: bar,
              height: spark,
              marginLeft: -bar / 2,
              background: STAR_COLOR,
              borderRadius: 2,
            }}
          />
          {/* horizontal bar */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              width: spark,
              height: bar,
              marginTop: -bar / 2,
              background: STAR_COLOR,
              borderRadius: 2,
            }}
          />
        </div>
      ))}
    </div>
  );
}