import { AppleEmoji } from './AppleEmoji';

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

/**
 * "Night": a full-bleed dark sky that fills its parent, with the 🌙 moon
 * emoji drifting and stars twinkling. Position absolute inset 0 so it works
 * both as the tile inside the size box and as the whole-card background.
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
  const starSize = Math.max(2, size * 0.03);
  const moonSize = size * 0.5;
  return (
    <div
      style={{
        ...style,
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #151033, #241a4a)',
      }}
      className={className}
      role="img"
      aria-label="Ночное небо с луной и звёздами"
    >
      {/* stars */}
      {STARS.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: starSize,
            height: starSize,
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

      {/* moon emoji */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: moonSize,
          height: moonSize,
          marginLeft: -moonSize / 2,
          marginTop: -moonSize / 2,
        }}
      >
        <AppleEmoji
          emoji="🌙"
          size={moonSize}
          style={{
            filter: 'drop-shadow(0 0 18px rgba(240, 200, 120, 0.45))',
            willChange: 'transform',
            animation: autoPlay ? 'va-moon-drift 6s ease-in-out infinite' : 'none',
          }}
        />
      </div>
    </div>
  );
}