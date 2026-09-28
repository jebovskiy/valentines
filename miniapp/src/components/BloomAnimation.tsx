const PETALS = [0, 60, 120, 180, 240, 300];

const DRIFTERS = [
  { x: 0.24, y: 0.8, s: 0.14, rot: -20, delay: 0 },
  { x: 0.78, y: 0.74, s: 0.11, rot: 25, delay: -1.2 },
  { x: 0.5, y: 0.9, s: 0.09, rot: -5, delay: -2.2 },
];

/**
 * "Bloom": six petals open around a center bud and softly sway, a few petals
 * drift down. Reads well at small sizes; static frame shows an open flower.
 */
export function BloomAnimation({
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
  const petalR = size * 0.3;
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
      aria-label="Цветок распускает лепестки"
    >
      {/* petals around the bud */}
      {PETALS.map((ang, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: size * 0.42,
            height: size * 0.5,
            marginLeft: -(size * 0.42) / 2,
            marginTop: -(size * 0.5) / 2,
            background: i % 2 === 0 ? '#ffc3dc' : '#ffb3cd',
            borderRadius: '50% 50% 50% 50% / 70% 70% 30% 30%',
            transform: `rotate(${ang}deg) translateY(${-petalR}px)`,
            transformOrigin: 'center center',
            opacity: 0.9,
            zIndex: 1,
            willChange: 'transform',
            animation: autoPlay
              ? `va-bloom-sway 3.4s ease-in-out ${i * 0.08}s infinite`
              : 'none',
            boxShadow: '0 0 8px rgba(255, 150, 190, 0.25)',
            ['--ang' as string]: `${ang}deg`,
            ['--r' as string]: `${-petalR}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* drifting petals */}
      {autoPlay &&
        DRIFTERS.map((d, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${d.x * 100}%`,
              top: `${d.y * 100}%`,
              width: size * d.s,
              height: size * d.s * 0.7,
              background: '#ffc3dc',
              borderRadius: '50% 0 50% 50%',
              transform: `rotate(${d.rot}deg) scale(0)`,
              opacity: 0,
              willChange: 'transform, opacity',
              animation: `va-bloom-drift 3.4s ease-out ${d.delay}s infinite`,
              ['--rot' as string]: `${d.rot}deg`,
            } as React.CSSProperties}
          />
        ))}

      {/* center bud */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size * 0.18,
          height: size * 0.18,
          marginLeft: -(size * 0.18) / 2,
          marginTop: -(size * 0.18) / 2,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #ffd7e4, #ff9cb8)',
          zIndex: 2,
          boxShadow: '0 0 12px rgba(255, 150, 190, 0.5)',
          willChange: 'transform',
          animation: autoPlay ? 'va-glow-in 1s ease-out infinite' : 'none',
        }}
      />
    </div>
  );
}