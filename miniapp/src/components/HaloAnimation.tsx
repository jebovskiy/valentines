import { AppleEmoji } from './AppleEmoji';

/**
 * "Halo": a plain face emoji (🙂) with a glowing crown (👑) that smoothly
 * slips onto the head ("одевается"), holds, and smoothly lifts away
 * ("снимается").
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
  const emojiSize = size * 0.6;
  const crownSize = size * 0.36;
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
      aria-label="Эмодзи с короной"
    >
      {/* plain face emoji */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: emojiSize,
          height: emojiSize,
          marginLeft: -emojiSize / 2,
          marginTop: -emojiSize / 2,
        }}
      >
        <AppleEmoji emoji="🙂" size={emojiSize} />
      </div>

      {/* glowing crown that puts on / takes off (rendered on top) */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '19%',
          width: crownSize,
          height: crownSize,
          marginLeft: -crownSize / 2,
          marginTop: -crownSize / 2,
          willChange: 'transform, opacity',
          animation: autoPlay ? 'va-halo-onoff 4s ease-in-out infinite' : 'none',
          ...(autoPlay ? {} : { opacity: 1 }),
        }}
      >
        {/* soft glow halo behind the crown */}
        <div
          style={{
            position: 'absolute',
            inset: '-30%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(240, 209, 112, 0.55), rgba(240, 209, 112, 0) 70%)',
          }}
        />
        <AppleEmoji
          emoji="👑"
          size={crownSize}
          style={{
            position: 'relative',
            filter: 'drop-shadow(0 0 6px rgba(240, 209, 112, 0.9)) drop-shadow(0 0 16px rgba(240, 209, 112, 0.5))',
          }}
        />
      </div>
    </div>
  );
}