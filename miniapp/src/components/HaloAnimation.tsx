import { AppleEmoji } from './AppleEmoji';

const GOLD = '#f0d170';

/**
 * "Halo": a face emoji (no built-in halo) with a golden ring drawn over its
 * head that smoothly slips onto the head ("одевается"), holds, and smoothly
 * lifts away ("снимается"). Using 🙂 + drawn ring avoids a duplicated halo.
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
  const ringW = size * 0.42;
  const ringH = size * 0.16;
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
      aria-label="Эмодзи с нимбом"
    >
      {/* plain face emoji, no halo baked in */}
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

      {/* golden halo ring right above the head (rendered on top) */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '38%',
          width: ringW,
          height: ringH,
          marginLeft: -ringW / 2,
          marginTop: -ringH / 2,
          border: `3px solid ${GOLD}`,
          borderRadius: '50%',
          opacity: 0,
          filter: `drop-shadow(0 0 8px ${GOLD})`,
          willChange: 'transform, opacity',
          animation: autoPlay ? 'va-halo-onoff 4s ease-in-out infinite' : 'none',
          ...(autoPlay ? {} : { opacity: 1 }),
        }}
      />
    </div>
  );
}