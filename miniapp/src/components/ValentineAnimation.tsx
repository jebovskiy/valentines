import { HeartOpenAnimation } from './HeartOpenAnimation';
import { AnimationType } from '../types';

const COLORS: Record<AnimationType, string> = {
  heart_open: '#ff8fa3',
  sparkle: '#ffb066',
  moon: '#a9c0f5',
  flame: '#ff7a3d',
  bloom_petals: '#ff7aa8',
  golden_halo: '#f0b83e',
};

const SPARKS = [
  { x: 0.68, y: 0.22, delay: 0.55 },
  { x: 0.12, y: 0.34, delay: 0.45 },
  { x: 0.72, y: 0.76, delay: 0.63 },
  { x: 0.18, y: 0.7, delay: 0.5 },
  { x: 0.5, y: 0.05, delay: 0.59 },
];

const PETALS = [0, 60, 120, 180, 240, 300];

export function ValentineAnimation({
  type,
  size = 100,
  autoPlay = true,
}: {
  type: AnimationType;
  size?: number;
  autoPlay?: boolean;
}) {
  const c = COLORS[type] ?? COLORS.heart_open;

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: c,
      }}
    >
      {type === 'moon' && (
        <div
          style={{
            position: 'absolute',
            width: size * 1.25,
            height: size * 1.25,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(169,192,245,0.55), transparent 70%)',
            opacity: 0,
            willChange: 'opacity',
            animation: autoPlay ? 'va-glow-in 1s ease-out forwards' : 'none',
          }}
        />
      )}

      {type === 'flame' && (
        <div
          style={{
            position: 'absolute',
            width: size * 1.2,
            height: size * 1.2,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,140,60,0.5), transparent 65%)',
            opacity: 0,
            willChange: 'opacity, transform',
            animation: autoPlay ? 'va-flame-pulse 1.4s ease-in-out 0.2s both' : 'none',
          }}
        />
      )}

      {type === 'golden_halo' && (
        <div
          style={{
            position: 'absolute',
            width: size * 1.5,
            height: size * 1.5,
            borderRadius: '50%',
            background:
              'conic-gradient(from 0deg, #f0c869, transparent 30%, #f0c869 60%, transparent 90%)',
            opacity: 0,
            willChange: 'opacity, transform',
            animation: autoPlay
              ? 'va-halo-in 0.6s ease-out 0.2s both, va-halo-spin 4s linear 0.5s infinite'
              : 'none',
          }}
        />
      )}

      {type === 'sparkle' &&
        SPARKS.map((s, i) => {
          const dotSize = Math.max(3, size * 0.08);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${s.x * 100}%`,
                top: `${s.y * 100}%`,
                width: dotSize,
                height: dotSize,
                background: '#ffe27a',
                borderRadius: '50%',
                opacity: 0,
                willChange: 'opacity, transform',
                animation: autoPlay
                  ? `va-spark-pop 0.6s ease-out ${s.delay}s forwards`
                  : 'none',
              }}
            />
          );
        })}

      {type === 'bloom_petals' &&
        PETALS.map((ang, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: size * 0.26,
              height: size * 0.4,
              background: i % 2 === 0 ? '#ffc3dc' : '#ffb3cd',
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              transformOrigin: '50% 100%',
              opacity: 0,
              willChange: 'opacity, transform',
              animation: autoPlay
                ? `va-petal-bloom 0.6s ease-out ${0.4 + i * 0.06}s forwards`
                : 'none',
              ['--petal-ang' as string]: `${ang}deg`,
            } as React.CSSProperties}
          />
        ))}

      <HeartOpenAnimation size={size} autoPlay={autoPlay} duration={900} />
    </div>
  );
}
