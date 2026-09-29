import { AppleEmoji } from './AppleEmoji';

const GOLD = '#f0d170';

/**
 * "Halo": the halo emoji (😇) with a golden ring that smoothly slips onto the
 * head ("одевается"), holds, and smoothly lifts away ("снимается"). Static
 * frame shows the emoji with the halo settled in place.
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
      {/* golden halo ring that puts on / takes off */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '34%',
          width: ringW,
          height: ringH,
          marginLeft: -ringW / 2,
          marginTop: -ringH / 2,
          border: `3px solid ${GOLD}`,
          borderRadius: '50%',
          opacity: 0,
          filter: `drop-shadow(0 0 6px ${GOLD})`,
          willChange: 'transform, opacity',
          animation: autoPlay ? 'va-halo-onoff 4s ease-in-out infinite' : 'none',
          ...(autoPlay ? {} : { opacity: 1 }),
        }}
      />

      {/* emoji with halo */}
      <AppleEmoji
        emoji="😇"
        size={emojiSize}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  );
}