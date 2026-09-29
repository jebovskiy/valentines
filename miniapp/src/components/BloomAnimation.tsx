const PETAL_COLORS = ['#f2a6c4', '#e0708a'];

/**
 * "Bloom": six SVG petals scaling out from the flower's center, staggered,
 * while the center bud pops in. Static frame shows the open flower.
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
      <svg
        viewBox="0 0 100 100"
        width={size * 0.9}
        height={size * 0.9}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginLeft: -(size * 0.9) / 2,
          marginTop: -(size * 0.9) / 2,
        }}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const angle = i * 60;
          const delay = i * 0.06;
          return (
            <g key={i} transform={`rotate(${angle} 50 50)`}>
              <ellipse
                cx={50}
                cy={27}
                rx={12}
                ry={20}
                fill={PETAL_COLORS[i % 2]}
                style={{
                  transformOrigin: '50px 50px',
                  transform: autoPlay ? 'scale(0)' : 'scale(1)',
                  animation: autoPlay
                    ? `va-petal-pop 3.2s ease-out ${delay}s infinite`
                    : 'none',
                }}
              />
            </g>
          );
        })}
        <circle
          cx={50}
          cy={50}
          r={10}
          fill="#f0b860"
          style={{
            transformOrigin: '50px 50px',
            transform: autoPlay ? 'scale(0)' : 'scale(1)',
            animation: autoPlay ? 'va-center-pop 3.2s ease-out infinite' : 'none',
          }}
        />
      </svg>
    </div>
  );
}