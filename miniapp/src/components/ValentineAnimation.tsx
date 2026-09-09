import { CSSProperties } from 'react';
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

const SPARKS: Array<{ dx: number; dy: number; delay: number }> = [
  { dx: 34, dy: -16, delay: 0.12 },
  { dx: -36, dy: -8, delay: 0.02 },
  { dx: 26, dy: 30, delay: 0.2 },
  { dx: -28, dy: 26, delay: 0.08 },
  { dx: 2, dy: -40, delay: 0.16 },
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
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: COLORS[type] ?? COLORS.heart_open,
      }}
    >
      {type === 'moon' && (
        <div
          style={{
            position: 'absolute',
            width: size * 1.25,
            height: size * 1.25,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(169, 192, 245, 0.55), transparent 70%)',
            opacity: 0,
            animation: 'va-glow-in 1s ease-out forwards',
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
            background: 'radial-gradient(circle, rgba(255, 140, 60, 0.5), transparent 65%)',
            opacity: 0,
            animation: 'va-flame-pulse 1s ease-in-out 0.3s both',
          }}
        />
      )}
      {type === 'golden_halo' && (
        <div
          style={{
            position: 'absolute',
            width: size * 1.45,
            height: size * 1.45,
            borderRadius: '50%',
            background:
              'conic-gradient(from 0deg, #f0c869, transparent 30%, #f0c869 60%, transparent 90%)',
            opacity: 0,
            animation:
              'va-halo-in 0.6s ease-out 0.3s both, va-halo-spin 4s linear 0.6s infinite',
          }}
        />
      )}
      {type === 'sparkle' &&
        SPARKS.map((s, i) => (
          <span
            key={i}
            style={
              {
                position: 'absolute',
                width: size * 0.07,
                height: size * 0.07,
                background: '#ffb066',
                borderRadius: 2,
                transform: 'translate(-50%, -50%)',
                opacity: 0,
                transformOrigin: 'center',
                ['--dx' as string]: `${s.dx}px`,
                ['--dy' as string]: `${s.dy}px`,
                animation: `va-spark-out 0.9s ease-out ${0.55 + s.delay}s forwards`,
              } as CSSProperties
            }
          />
        ))}
      {type === 'bloom_petals' &&
        PETALS.map((ang, i) => (
          <span
            key={i}
            style={
              {
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: size * 0.28,
                height: size * 0.44,
                background: '#ffc3dc',
                borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                transformOrigin: '50% 100%',
                opacity: 0,
                ['--ang' as string]: `${ang}deg`,
                animation: `va-petal-out 0.7s ease-out ${0.45 + i * 0.06}s both`,
              } as CSSProperties
            }
          />
        ))}
      <HeartOpenAnimation size={size} autoPlay={autoPlay} duration={900} />
    </div>
  );
}