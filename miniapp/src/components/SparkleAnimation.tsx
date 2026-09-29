import { AppleEmoji } from './AppleEmoji';

/** Small star positions (percent of the box) + per-star timing. */
const SMALL_STARS: Array<{ top: string; left: string; emojiSize: number; delay: number }> = [
  { top: '30%', left: '32%', emojiSize: 0.3, delay: 0 },
  { top: '26%', left: '66%', emojiSize: 0.28, delay: 0.5 },
  { top: '62%', left: '58%', emojiSize: 0.3, delay: 1 },
];

/**
 * "Sparkle": one big sparkle emoji in the center, growing and shrinking,
 * surrounded by three small sparkles, each pulsing on its own rhythm.
 * Static frame shows all sparkles at full size.
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
  const centerSize = size * 0.52;
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
      aria-label="Блеск"
    >
      {/* big center sparkle */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: centerSize,
          height: centerSize,
          marginLeft: -centerSize / 2,
          marginTop: -centerSize / 2,
        }}
      >
        <AppleEmoji
          emoji="✨"
          size={centerSize}
          style={{
            filter: 'drop-shadow(0 0 14px rgba(240, 184, 96, 0.65))',
            willChange: 'transform',
            animation: autoPlay ? 'va-spark-pulse 2.4s ease-in-out infinite' : 'none',
          }}
        />
      </div>

      {/* three small sparkles, each pulsing independently */}
      {SMALL_STARS.map((star, i) => {
        const absolute = star.emojiSize * size;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: star.top,
              left: star.left,
              width: absolute,
              height: absolute,
              marginLeft: -absolute / 2,
              marginTop: -absolute / 2,
            }}
          >
            <AppleEmoji
              emoji="✨"
              size={absolute}
              style={{
                filter: 'drop-shadow(0 0 10px rgba(240, 184, 96, 0.6))',
                willChange: 'transform',
                animation: autoPlay
                  ? `va-spark-pulse 2.4s ease-in-out ${star.delay}s infinite`
                  : 'none',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}