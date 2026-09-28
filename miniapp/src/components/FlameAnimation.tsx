const TONGUES = [
  { x: 0.5, y: 0.56, w: 0.5, h: 0.62, rot: 0, delay: 0, z: 1 },
  { x: 0.36, y: 0.42, w: 0.24, h: 0.3, rot: -18, delay: -0.3, z: 2 },
  { x: 0.64, y: 0.42, w: 0.24, h: 0.3, rot: 18, delay: -0.6, z: 2 },
];

const HEART_PATH =
  'M12,21 C5,16 1,11 1,7.5 C1,4 3.5,2 6.5,2 C8.5,2 10.5,3 12,5.5 C13.5,3 15.5,2 17.5,2 C20.5,2 23,4 23,7.5 C23,11 19,16 12,21 Z';

/**
 * "Flame": a red heart with dancing flames around it. Reads well at small
 * sizes; static frame shows flames spread around a lit heart.
 */
export function FlameAnimation({
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      className={className}
      role="img"
      aria-label="Сердце в языках пламени"
    >
      {/* warm glow */}
      <div
        style={{
          position: 'absolute',
          width: size * 1.05,
          height: size * 1.05,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 140, 60, 0.4), transparent 70%)',
          opacity: 0,
          willChange: 'opacity',
          animation: autoPlay ? 'va-flame-glow 1.6s ease-in-out infinite' : 'none',
          ...(autoPlay ? {} : { opacity: 0.6 }),
        }}
      />

      {/* flame tongues */}
      {TONGUES.map((t, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${t.x * 100}%`,
            top: `${t.y * 100}%`,
            width: size * t.w,
            height: size * t.h,
            background:
              i === 0
                ? 'linear-gradient(180deg, #ffb066 0%, #ff7a3d 60%, #e6461b 100%)'
                : 'linear-gradient(180deg, #ffe27a 0%, #ff9c4d 100%)',
            borderRadius: '50% 50% 50% 50% / 70% 70% 30% 30%',
            transform: `translate(-50%, -50%) rotate(${t.rot}deg)`,
            transformOrigin: 'center bottom',
            opacity: 0.95,
            zIndex: t.z,
            willChange: 'transform',
            animation: autoPlay ? `va-flame-flicker 0.9s ease-in-out ${t.delay}s infinite` : 'none',
            boxShadow:
              i === 0
                ? '0 0 14px rgba(255, 122, 61, 0.55)'
                : '0 0 10px rgba(255, 226, 122, 0.5)',
            ['--rot' as string]: `${t.rot}deg`,
          } as React.CSSProperties}
        />
      ))}

      {/* heart */}
      <svg
        width={size * 0.52}
        height={size * 0.52}
        viewBox="0 0 24 24"
        fill="none"
        style={{
          position: 'relative',
          zIndex: 3,
          color: '#ff4d4d',
          filter: 'drop-shadow(0 0 10px rgba(255, 60, 40, 0.55))',
          willChange: 'transform',
          animation: autoPlay ? 'va-heart-beat 1.4s ease-in-out infinite' : 'none',
        }}
      >
        <path d={HEART_PATH} fill="currentColor" stroke="currentColor" strokeWidth="0.8" />
      </svg>
    </div>
  );
}