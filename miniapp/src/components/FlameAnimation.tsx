const EMBERS = [
  { x: -14, drift: -7, delay: 0 },
  { x: 8, drift: 4, delay: 0.4 },
  { x: -6, drift: -3, delay: 0.9 },
  { x: 16, drift: 8, delay: 1.3 },
  { x: 0, drift: 0, delay: 1.8 },
  { x: -20, drift: -10, delay: 2.1 },
];

/**
 * "Flame": three SVG flame layers, each flickering on its own rhythm, with
 * embers rising up. Static frame shows the full flame lit.
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
  const flameW = size * 0.64;
  const flameH = size * 0.78;
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
      aria-label="Языки пламени с поднимающимися искрами"
    >
      {/* layered flame */}
      <svg
        className="flame-svg"
        viewBox="0 0 100 100"
        width={flameW}
        height={flameH}
        style={{
          position: 'absolute',
          left: '50%',
          marginLeft: -flameW / 2,
          bottom: '6%',
        }}
      >
        <path
          className="fl-outer"
          d="M50 96 C26 80 20 54 33 32 C39 22 45 13 50 3 C55 13 61 22 67 32 C80 54 74 80 50 96 Z"
          fill="#e0708a"
          style={{
            transformOrigin: '50px 96px',
            animation: autoPlay ? 'va-flickA 1.7s ease-in-out infinite' : 'none',
          }}
        />
        <path
          className="fl-inner"
          d="M50 88 C35 76 32 58 41 43 C44 38 47 32 50 25 C53 32 56 38 59 43 C68 58 65 76 50 88 Z"
          fill="#f0b860"
          style={{
            transformOrigin: '50px 96px',
            animation: autoPlay ? 'va-flickB 1.3s ease-in-out infinite' : 'none',
          }}
        />
        <path
          className="fl-core"
          d="M50 78 C42 70 41 59 46 50 C47 47 48 45 50 42 C52 45 53 47 54 50 C59 59 58 70 50 78 Z"
          fill="#ffe7a6"
          style={{
            transformOrigin: '50px 96px',
            animation: autoPlay ? 'va-flickC 0.9s ease-in-out infinite' : 'none',
          }}
        />
      </svg>

      {/* rising embers */}
      {autoPlay &&
        EMBERS.map((e, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              bottom: '20%',
              left: `calc(50% + ${e.x}px)`,
              width: size * 0.04,
              height: size * 0.04,
              borderRadius: '50%',
              background: '#f0b860',
              opacity: 0,
              willChange: 'transform, opacity',
              animation: `va-emb 2.6s linear ${e.delay}s infinite`,
              ['--x' as string]: `${e.drift}px`,
            } as React.CSSProperties}
          />
        ))}
    </div>
  );
}