import { AppleEmoji } from './AppleEmoji';

/**
 * "Sparkle": a sparkle emoji in the center that smoothly grows and shrinks.
 * Static frame shows the emoji at rest.
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
  const emojiSize = size * 0.52;
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
      <AppleEmoji
        emoji="✨"
        size={emojiSize}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          filter: 'drop-shadow(0 0 14px rgba(240, 184, 96, 0.65))',
          willChange: 'transform',
          animation: autoPlay ? 'va-spark-pulse 2.4s ease-in-out infinite' : 'none',
        }}
      />
    </div>
  );
}