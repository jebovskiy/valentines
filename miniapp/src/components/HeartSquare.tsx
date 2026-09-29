/** Heart assembled from a rotated square plus two circles (map heart shape). */
export function HeartSquare({
  size,
  color,
  style,
}: {
  size: number;
  color: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        transform: 'rotate(45deg)',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: color,
          borderRadius: size * 0.12,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          left: -size / 2,
          top: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          left: 0,
          top: -size / 2,
        }}
      />
    </div>
  );
}