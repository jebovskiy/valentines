import type { CSSProperties } from 'react';

export type GreetingScene = 'morning' | 'night';
export type GreetingMode = 'celebrate' | 'received';

interface GreetingOverlayProps {
  scene: GreetingScene;
  mode: GreetingMode;
  names: { me: string; partner: string };
  senderName?: string | null;
  onClose: () => void;
  onReply?: () => void;
  onSend: () => void;
  sending: boolean;
  sent: boolean;
}

interface SceneTheme {
  sky: string;
  horizonGlow: string;
  sunCore: string;
  titleGradient: string;
  emoji: string;
  subtitle: string;
  accent: string;
  onAccent: string;
}

const SCENES: Record<GreetingScene, SceneTheme> = {
  morning: {
    sky: 'linear-gradient(163deg, #ffe9ec 0%, #ffd6dc 16%, #ffc7ad 36%, #ffb15e 62%, #ff8f4d 100%)',
    horizonGlow: 'radial-gradient(circle at 50% 132%, rgba(255, 245, 220, 0.35) 0%, rgba(255, 230, 180, 0) 42%)',
    sunCore: 'radial-gradient(circle at 38% 32%, #fffdf3 0%, #ffe9a6 46%, #ffc25e 78%, #ffab4f 100%)',
    titleGradient: 'linear-gradient(90deg, #ff9a3d 0%, #ffd05c 25%, #fff3c4 50%, #ffd05c 75%, #ff9a3d 100%)',
    emoji: '☀️',
    subtitle: 'Тёплого спокойного дня',
    accent: '#ff8f4d',
    onAccent: '#fff7ea',
  },
  night: {
    sky: 'linear-gradient(165deg, #070b20 0%, #10193d 40%, #232e5c 100%)',
    horizonGlow: 'radial-gradient(circle at 50% 132%, rgba(110, 140, 235, 0.3) 0%, rgba(60, 80, 180, 0) 42%)',
    sunCore: 'radial-gradient(circle at 38% 32%, #fffbe8 0%, #fdf2c0 40%, #ffe9a0 75%, #ffd76b 100%)',
    titleGradient: 'linear-gradient(90deg, #aab7ff 0%, #e8e6ff 25%, #ffffff 50%, #e8e6ff 75%, #aab7ff 100%)',
    emoji: '🌙',
    subtitle: 'Сладких снов',
    accent: '#5f7bff',
    onAccent: '#ffffff',
  },
};

function RandomParticles({ count, chars, maxSize, minSize, scene }: { count: number; chars: string[]; maxSize: number; minSize: number; scene: GreetingScene }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const left = (i * 7.3 + 4) % 96;
        const size = minSize + ((i * 37) % (maxSize - minSize + 1));
        const delay = -((i * 1.7) % 12);
        const duration = 8 + ((i * 3) % 8);
        const sway = ((i % 2 === 0 ? 1 : -1) * (10 + ((i * 13) % 40))).toFixed(0);
        const char = chars[i % chars.length];
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              bottom: '-6vh',
              fontSize: size,
              animation: `greet-rise ${duration}s linear ${delay}s infinite`,
              ['--sway' as string]: `${sway}px`,
              opacity: 0,
              textShadow: '0 2px 14px rgba(255,255,255,0.55)',
              filter: scene === 'night' ? 'brightness(0.9)' : undefined,
            }}
          >
            {char}
          </span>
        );
      })}
    </>
  );
}

export function GreetingOverlay({ scene, mode, names, senderName, onClose, onReply, onSend, sending, sent }: GreetingOverlayProps) {
  const theme = SCENES[scene];
  const night = scene === 'night';
  const phrase = night ? 'Спокойной ночи' : 'Доброе утро';
  const receivedLine = night
    ? `желает тебе спокойной ночи ${theme.emoji}`
    : `желает тебе доброго утра ${theme.emoji}`;

  return (
    <div style={overlayStyle}>
      <div style={{ ...styles.sky, background: theme.sky }}>
        <div style={{ ...styles.horizonGlow, background: theme.horizonGlow }} />
      </div>

      {/* light bloom + drifting warmth overlay */}
      <div style={styles.bloom} />

      {/* stars fading as the sun rises */}
      <div style={styles.stars}>
        {[14, 22, 38, 52, 66, 78, 88].map((left, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: `${6 + ((i * 9) % 14)}vh`,
              width: 6 + (i % 3) * 2,
              height: 6 + (i % 3) * 2,
              borderRadius: '50%',
              background: '#fff9e0',
              boxShadow: '0 0 10px 2px rgba(255,255,255,0.75)',
              animation: `greet-star-dawn ${night ? 0.01 : 5 + (i * 0.7)}s ease forwards ${i * 0.35}s, greet-twinkle 1.6s ease-in-out ${i * 0.4}s infinite`,
            }}
          />
        ))}
      </div>

      {/* clouds drifting */}
      <div style={styles.clouds}>
        {[
          { top: '16vh', scale: 1.15, dur: '46s', delay: '-10s', opacity: 0.75 },
          { top: '30vh', scale: 0.85, dur: '64s', delay: '-28s', opacity: 0.55 },
          { top: '48vh', scale: 1.35, dur: '78s', delay: '-52s', opacity: 0.4 },
        ].map((c, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: c.top,
              left: '-30vw',
              opacity: c.opacity,
              transform: `scale(${c.scale})`,
              animation: `greet-drift ${c.dur} linear ${c.delay} infinite`,
              fontSize: 96,
              filter: 'blur(1px) saturate(0.6)',
            }}
          >
            ☁️
          </div>
        ))}
      </div>

      {/* sun */}
      <div style={styles.sunWrap}>
        <div style={{ ...styles.sun, background: theme.sunCore }} />
      </div>

      {/* flying birds */}
      <div style={{ position: 'absolute', top: '14vh', left: '-8vw', fontSize: 26, animation: 'greet-drift 40s linear -22s infinite', opacity: 0.85 }}>
        🕊️
      </div>
      <div style={{ position: 'absolute', top: '22vh', left: '-26vw', fontSize: 18, animation: 'greet-drift 55s linear -40s infinite', opacity: 0.6 }}>
        🕊️
      </div>

      {/* rolling meadow hint */}
      <div style={styles.meadowBack} />
      <div style={styles.meadowFront} />

      {/* floating hearts & sparkles */}
      <RandomParticles count={16} chars={['❤️', '💛', '🧡', '✨', '🌸', '💖']} minSize={16} maxSize={30} scene={scene} />

      {/* content */}
      <div style={styles.content}>
        <div style={styles.emojiWrap}>
          <span style={{ fontSize: 64, animation: 'greet-soft-bounce 2.6s ease-in-out infinite' }}>{theme.emoji}</span>
        </div>

        <h1
          style={{
            ...styles.title,
            background: theme.titleGradient,
          }}
        >
          {phrase}
        </h1>

        <p style={styles.namesLine}>
          Для {names.me}
          {names.partner && names.partner !== names.me ? ` и ${names.partner}` : ''}
        </p>

        {mode === 'received' && senderName ? (
          <p style={styles.receivedLine}>
            <span style={{ color: 'var(--ink)' }}>{senderName}</span> {receivedLine}
          </p>
        ) : (
          <p style={styles.subtitle}>{theme.subtitle}</p>
        )}

        <div style={styles.actions}>
          {mode === 'received' && onReply ? (
            <button
              style={{ ...styles.primaryBtn, background: theme.accent, color: theme.onAccent }}
              onClick={onReply}
            >
              {theme.emoji} Ответить
            </button>
          ) : mode === 'celebrate' && !sent ? (
            <button style={{ ...styles.primaryBtn, background: theme.accent, color: theme.onAccent }} onClick={onSend} disabled={sending}>
              {sending ? 'Отправляем…' : `${theme.emoji} ${night ? 'Пожелать спокойной ночи' : 'Пожелать доброе утро'}`}
            </button>
          ) : (
            <div style={{ ...styles.sentPill, borderColor: 'transparent' }}>
              <span style={{ color: 'var(--ink)' }}>{theme.emoji}</span>
              {mode === 'received'
                ? `${night ? 'Спокойной ночи' : 'Доброе утро'} уже прозвучало`
                : `${night ? 'Спокойной ночи' : 'Доброе утро'} передано партнёру`}
            </div>
          )}
          <button style={styles.closeBtn} onClick={onClose}>
            {mode === 'received' ? 'Спасибо!' : 'Скрыть'}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1200,
  overflow: 'hidden',
  animation: 'greet-fade-in 0.5s ease-out both',
};

const styles: Record<string, CSSProperties> = {
  sky: {
    position: 'absolute',
    inset: 0,
    background: SCENES.morning.sky,
  },
  horizonGlow: {
    position: 'absolute',
    inset: 0,
  },
  bloom: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0) 0%, rgba(255, 240, 210, 0.06) 100%)',
  },
  stars: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  },
  clouds: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  },
  sunWrap: {
    position: 'absolute',
    top: '9vh',
    left: '50%',
    width: '46vw',
    height: '46vw',
    maxWidth: 230,
    maxHeight: 230,
    marginLeft: '-23vw',
    transform: 'translateX(-50%)',
    pointerEvents: 'none',
    animation: 'greet-sun-rise 1.3s cubic-bezier(0.2, 0.9, 0.3, 1) both',
  },
  sun: {
    position: 'absolute',
    inset: '6%',
    borderRadius: '50%',
    boxShadow: '0 0 26px 6px rgba(255, 190, 120, 0.22), inset 0 -10px 26px rgba(255, 150, 60, 0.3)',
    animation: 'greet-lift 5.4s ease-in-out infinite',
  },
  meadowBack: {
    position: 'absolute',
    bottom: '-9vh',
    left: '-15vw',
    width: '130vw',
    height: '20vh',
    borderRadius: '50%',
    background: 'rgba(255, 244, 214, 0.4)',
    filter: 'blur(8px)',
  },
  meadowFront: {
    position: 'absolute',
    bottom: '-13vh',
    left: '-8vw',
    width: '116vw',
    height: '18vh',
    borderRadius: '50%',
    background: 'rgba(255, 252, 240, 0.75)',
    filter: 'blur(14px)',
  },
  content: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '96px 28px 40px',
    zIndex: 10,
  },
  emojiWrap: {
    animation: 'greet-pop 0.8s cubic-bezier(0.18, 1.25, 0.4, 1) both',
    filter: 'drop-shadow(0 8px 22px rgba(255,160,70,0.35))',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontWeight: '800',
    fontSize: 46,
    letterSpacing: '-1.2px',
    lineHeight: 1.05,
    color: 'transparent',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    backgroundSize: '200% auto',
    animation: 'greet-pop 0.9s cubic-bezier(0.18, 1.25, 0.4, 1) 0.25s both, greet-shine 4s linear 1.2s infinite',
    margin: '6px 0 2px',
    textShadow: '0 2px 30px rgba(255, 150, 60, 0.25)',
  },
  namesLine: {
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    fontWeight: 600,
    color: 'rgba(137, 82, 40, 0.85)',
    animation: 'greet-slide-up 0.8s ease-out 0.55s both',
    margin: 0,
  },
  receivedLine: {
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    lineHeight: 1.5,
    fontWeight: 500,
    color: 'rgba(120, 70, 40, 0.95)',
    animation: 'greet-slide-up 0.8s ease-out 0.6s both',
    maxWidth: 300,
    marginTop: 10,
    marginBottom: 0,
  },
  subtitle: {
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    lineHeight: 1.5,
    fontWeight: 500,
    color: 'rgba(120, 70, 40, 0.95)',
    animation: 'greet-slide-up 0.8s ease-out 0.6s both',
    margin: '10px 0 0',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    marginTop: 28,
    animation: 'greet-slide-up 0.8s ease-out 0.75s both',
  },
  primaryBtn: {
    padding: '0 26px',
    height: 52,
    borderRadius: 9999,
    border: 'none',
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 15,
    lineHeight: 1,
    boxShadow: '0 14px 34px rgba(255, 130, 70, 0.4)',
    transition: 'transform 0.15s ease, opacity 0.15s ease',
  },
  sentPill: {
    padding: '0 24px',
    height: 48,
    borderRadius: 9999,
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 14,
    background: 'rgba(255, 255, 255, 0.6)',
    boxShadow: '0 10px 26px rgba(255, 140, 80, 0.22)',
  },
  closeBtn: {
    padding: '0 18px',
    height: 40,
    borderRadius: 9999,
    border: 'none',
    background: 'rgba(255, 255, 255, 0.55)',
    color: 'rgba(110, 60, 30, 0.95)',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
    lineHeight: 1,
    boxShadow: '0 6px 18px rgba(255, 140, 80, 0.18)',
  },
};