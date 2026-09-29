import { AppleEmoji } from './AppleEmoji';

/** Star positions (percent of the box) + per-star timing. */
const STARS: Array<{ top: string; left: string; emojiSize: number; delay: number }> = [
  { top: '28%', left: '26%', emojiSize: 0.34, delay: 0 },
  { top: '20%', left: '58%', emojiSize: 0.42, delay: 0.5 },
  { top: '48%', left: '47%', emojiSize: 0.5, delay: 0.8 },
  { top: '64%', left: '29%', emojiSize: 0.36, delay: 0.3 },
  { top: '58%', left: '64%', emojiSize: 0.4, delay: 1.1 },
];

/**
 * "Sparkle": several sparkle emojis, each smoothly growing and shrinking on its
 * own rhythm. Static frame shows the stars at full size.
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
      aria-label="Блеск"
    >
      {STARS.map((star, i) => {
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
                filter: 'drop-shadow(0 0 12px rgba(240, 184, 96, 0.6))',
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