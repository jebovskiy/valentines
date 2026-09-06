import { useEffect, useRef, useState } from 'react';

// Square to heart path morphing
const SQUARE_PATH = 'M12,4 L20,4 C22.209,4 24,5.791 24,8 L24,16 C24,18.209 22.209,20 20,20 L12,20 C9.791,20 8,18.209 8,16 L8,8 C8,5.791 9.791,4 12,4 Z';
const HEART_PATH = 'M12,6.5 C10.5,5 8.5,5 7,6.5 C4.5,8.5 4.5,12 7,14.5 L11.5,19 L12,19.5 L12.5,19 L17,14.5 C19.5,12 19.5,8.5 17,6.5 C15.5,5 13.5,5 12,6.5 Z';
const INTERMEDIATE_PATHS = [
  'M12,4.5 L19.5,4.5 C21.433,4.5 23,6.067 23,8 L23,15.5 C23,17.433 21.433,19 19.5,19 L12.5,19 C10.567,19 9,17.433 9,15.5 L9,8 C9,6.067 10.567,4.5 12.5,4.5 Z',
  'M12,5 L19,5 C20.657,5 22,6.343 22,8 L22,15 C22,16.657 20.657,18 19,18 L13,18 C11.343,18 10,16.657 10,15 L10,8 C10,6.343 11.343,5 13,5 Z',
  'M11.8,5.5 C10.2,4.2 8.2,4.2 7,5.8 C4.8,7.8 4.8,10.8 6.8,12.8 L11.5,17.5 L12,18 L12.5,17.5 L17.2,12.8 C19.2,10.8 19.2,7.8 17,5.8 C15.8,4.2 13.8,4.2 12.2,5.5 Z',
];

export function HeartOpenAnimation({
  size = 40,
  autoPlay = true,
  duration = 800,
  style,
  className,
}: {
  size?: number;
  autoPlay?: boolean;
  duration?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [path, setPath] = useState(SQUARE_PATH);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();

  const animate = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    startTimeRef.current = performance.now();

    const animateFrame = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current!;
      const progress = Math.min(elapsed / duration, 1);

      if (progress < 0.3) {
        // Square to intermediate
        const localProgress = progress / 0.3;
        setPath(interpolatePath(SQUARE_PATH, INTERMEDIATE_PATHS[0], localProgress));
      } else if (progress < 0.6) {
        // Intermediate to more heart-like
        const localProgress = (progress - 0.3) / 0.3;
        setPath(interpolatePath(INTERMEDIATE_PATHS[0], INTERMEDIATE_PATHS[2], localProgress));
      } else {
        // To final heart
        const localProgress = (progress - 0.6) / 0.4;
        setPath(interpolatePath(INTERMEDIATE_PATHS[2], HEART_PATH, localProgress));
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animateFrame);
      } else {
        setPath(HEART_PATH);
        setIsAnimating(false);
      }
    };

    animationRef.current = requestAnimationFrame(animateFrame);
  };

  useEffect(() => {
    if (autoPlay) {
      const timer = setTimeout(animate, 100);
      return () => clearTimeout(timer);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [autoPlay, duration]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{
        ...style,
        width: size,
        height: size,
      }}
      className={className}
      role="img"
      aria-label="Анимированное сердце"
    >
      <path
        d={path}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          filter: 'drop-shadow(0 2px 4px rgba(233, 30, 99, 0.3))',
        }}
      />
      {isAnimating && (
        <animateTransform
          attributeName="transform"
          type="scale"
          from="1"
          to="1.05"
          dur="0.4s"
          repeatCount="indefinite"
          values="1;1.05;1"
          keyTimes="0;0.5;1"
          calcMode="spline"
          keySplines="0.4 0 0.2 1;0.4 0 0.2 1"
        />
      )}
    </svg>
  );
}

function interpolatePath(path1: string, path2: string, t: number): string {
  const coords1 = parsePath(path1);
  const coords2 = parsePath(path2);

  if (coords1.length !== coords2.length) return t < 0.5 ? path1 : path2;

  const parts: string[] = [];
  for (let i = 0; i < coords1.length; i++) {
    const c1 = coords1[i];
    const c2 = coords2[i];
    if (typeof c1 === 'string' || typeof c2 === 'string') {
      parts.push(c1 as string);
      continue;
    }
    const values = c1[1].map((v, j) => v + (c2[1][j] - v) * t);
    parts.push(`${c1[0]} ${values.join(' ')}`);
  }
  return parts.join(' ');
}

function parsePath(path: string): Array<string | [string, number[]]> {
  const tokens = path.match(/[MLHVCSQTAZmlhvcsqtaz]|-?\d*\.?\d+/g) || [];
  const result: Array<string | [string, number[]]> = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    if (/[MLHVCSQTAZmlhvcsqtaz]/.test(token)) {
      const command = token.toUpperCase();
      const coordCount = getCoordCount(command);
      const coords = tokens.slice(i + 1, i + 1 + coordCount).map(Number);
      result.push([command, coords]);
      i += 1 + coordCount;
    } else {
      i++;
    }
  }
  return result;
}

function getCoordCount(command: string): number {
  const counts: Record<string, number> = {
    M: 2, L: 2, H: 1, V: 1,
    C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0,
  };
  return counts[command] || 0;
}

export function HeartOpenLottie({ size = 120 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: size, height: size }}
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M100,30 C70,15 40,30 40,60 C40,95 70,130 100,170 C130,130 160,95 160,60 C160,30 130,15 100,30 Z"
        fill="#e91e63"
        filter="url(#glow)"
      >
        <animateTransform
          attributeName="transform"
          type="scale"
          from="1"
          to="1.1"
          dur="1.5s"
          repeatCount="indefinite"
          values="1;1.1;1"
          keyTimes="0;0.5;1"
          calcMode="spline"
          keySplines="0.4 0 0.2 1;0.4 0 0.2 1"
        />
      </path>
    </svg>
  );
}