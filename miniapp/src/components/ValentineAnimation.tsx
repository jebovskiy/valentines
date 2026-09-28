import { HeartOpenAnimation } from './HeartOpenAnimation';
import { EnvelopeAnimation } from './EnvelopeAnimation';
import { SparkleAnimation } from './SparkleAnimation';
import { MoonAnimation } from './MoonAnimation';
import { FlameAnimation } from './FlameAnimation';
import { BloomAnimation } from './BloomAnimation';
import { HaloAnimation } from './HaloAnimation';
import { AnimationType } from '../types';

/**
 * Renders the scene animation for each valentine type. Every scene loops its
 * own motion when autoPlay is on and shows a readable static frame otherwise.
 */
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
      }}
    >
      {type === 'heart_open' && <EnvelopeAnimation size={size} autoPlay={autoPlay} />}
      {type === 'sparkle' && <SparkleAnimation size={size} autoPlay={autoPlay} />}
      {type === 'moon' && <MoonAnimation size={size} autoPlay={autoPlay} />}
      {type === 'flame' && <FlameAnimation size={size} autoPlay={autoPlay} />}
      {type === 'bloom_petals' && <BloomAnimation size={size} autoPlay={autoPlay} />}
      {type === 'golden_halo' && <HaloAnimation size={size} autoPlay={autoPlay} />}
      {!['heart_open', 'sparkle', 'moon', 'flame', 'bloom_petals', 'golden_halo'].includes(type) && (
        <HeartOpenAnimation size={size} autoPlay={autoPlay} duration={900} />
      )}
    </div>
  );
}