import { useMemo } from 'react';

export interface SpotlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function rectFromElement(el: Element | null): SpotlightRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
  };
}

export function rectOf(...elements: (Element | null)[]): SpotlightRect[] {
  return elements
    .map(rectFromElement)
    .filter((r): r is SpotlightRect => !!r && r.width > 0 && r.height > 0);
}

export function Spotlight({
  rects,
  radius = 24,
}: {
  rects: SpotlightRect[];
  radius?: number;
}) {
  const maskId = useMemo(
    () => `spot-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  return (
    <div style={styles.root} aria-hidden="true">
      <svg style={{ position: 'absolute', inset: 0, width: '100vw', height: '100vh' }}>
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="#fff" />
            {rects.map((r, i) => (
              <rect
                key={i}
                x={r.left}
                y={r.top}
                width={r.width}
                height={r.height}
                rx={radius}
                fill="#000"
              />
            ))}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(18, 16, 14, 0.55)" mask={`url(#${maskId})`} />
      </svg>
      {rects.map((r, i) => (
        <div
          key={`ring-${i}`}
          style={{
            position: 'fixed',
            left: r.left - 6,
            top: r.top - 6,
            width: r.width + 12,
            height: r.height + 12,
            borderRadius: radius + 6,
            border: '3px solid rgba(255,255,255,0.95)',
            boxShadow: '0 0 0 2px rgba(230,0,35,0.35), inset 0 0 0 2px rgba(230,0,35,0.2)',
            animation: 'spotlightPulse 1.6s ease-in-out infinite',
            zIndex: 1,
          }}
        />
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 1400,
  },
};