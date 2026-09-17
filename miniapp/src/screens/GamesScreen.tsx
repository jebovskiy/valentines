import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { GameId, GameMood } from '../types';
import { setMainButton, setBackButton, hapticFeedback } from '../utils/telegram';
import { BackButton } from '../components/BackButton';

const MOODS: { value: GameMood; label: string; emoji: string; desc: string }[] = [
  { value: 'нежное', label: 'Нежное', emoji: '🌸', desc: 'Тёплые и трогательные' },
  { value: 'веселое', label: 'Весёлое', emoji: '🎉', desc: 'Лёгкие и смешные' },
  { value: 'погорячее', label: 'Погорячее', emoji: '🔥', desc: 'Смелые и страстные' },
  { value: 'поговорить', label: 'Поговорить', emoji: '💬', desc: 'Глубокие и откровенные' },
  { value: 'спокойное', label: 'Спокойное', emoji: '🌙', desc: 'Мягкие и уютные' },
];

const GAME_TITLES: Record<GameId, string> = {
  KNOW_ME: 'Насколько ты меня знаешь?',
  CHOOSE_ONE: 'Выбери одно',
  ASSOCIATIONS: 'Ассоциации',
  COMPLIMENTS: 'Комплименты',
  SPEED_FACTS: 'Это мы?',
};

const GAMES: { id: GameId; emoji: string; title: string; sub: string; bg: string }[] = [
  {
    id: 'KNOW_ME',
    emoji: '💡',
    title: 'Насколько ты меня знаешь?',
    sub: 'Вопросы о ваших вкусах и мечтах — ответы открываются вместе',
    bg: 'linear-gradient(180deg, #ffe0e6, #ffb8c6)',
  },
  {
    id: 'CHOOSE_ONE',
    emoji: '🃏',
    title: 'Выбери одно',
    sub: '15 быстрых дуэлей: «или — или». Оба выбирают — узнаёте, совпали ли',
    bg: 'linear-gradient(180deg, #dbe8ff, #b9cdfa)',
  },
  {
    id: 'ASSOCIATIONS',
    emoji: '🎭',
    title: 'Ассоциации',
    sub: 'Слово — и каждый пишет свою ассоциацию. Совпадения скажут многое',
    bg: 'linear-gradient(180deg, #dcf5e5, #aee6c6)',
  },
  {
    id: 'COMPLIMENTS',
    emoji: '💐',
    title: 'Комплименты',
    sub: 'Тёплые вопросы-комплименты друг другу — без счёта, только приятно',
    bg: 'linear-gradient(180deg, #fff3e0, #ffd9a8)',
  },
  {
    id: 'SPEED_FACTS',
    emoji: '⚡',
    title: 'Это мы?',
    sub: '8 утверждений о паре — отвечаете «да» или «нет» и узнаёте, совпало ли',
    bg: 'linear-gradient(180deg, #e9e6ff, #c9c2f5)',
  },
];

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '18px 16px calc(24px + env(safe-area-inset-bottom))',
    maxWidth: 460,
    margin: '0 auto',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--ink)',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: '19px',
    color: 'var(--mute)',
    marginBottom: 16,
  },
  continueCard: {
    background: 'var(--surface-card)',
    borderRadius: 18,
    padding: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: '1px solid var(--hairline)',
    marginBottom: 16,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
  },
  continueEmoji: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    background: 'var(--grad-heart)',
    flexShrink: 0,
  },
  gameCard: {
    background: 'var(--surface-card)',
    borderRadius: 20,
    padding: 16,
    border: '1px solid var(--hairline)',
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
    cursor: 'pointer',
    marginBottom: 12,
    transition: 'border-color 120ms ease',
  },
  gameCardSelected: {
    borderColor: 'var(--primary)',
    boxShadow: '0 0 0 1px var(--primary)',
  },
  gameIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  gameTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--ink)',
    marginBottom: 3,
  },
  gameSub: {
    fontSize: 12,
    lineHeight: '17px',
    color: 'var(--ash)',
  },
  section: {
    marginTop: 18,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--ink)',
    marginBottom: 2,
  },
  sectionHint: {
    fontSize: 12,
    color: 'var(--ash)',
    fontWeight: 500,
  },
  moodGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 6,
  },
  moodChip: {
    borderRadius: 14,
    padding: '10px 4px',
    border: '1px solid var(--hairline)',
    background: 'var(--surface-card)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    transition: 'border-color 120ms ease',
  },
  moodChipSelected: {
    borderColor: 'var(--primary)',
    boxShadow: '0 0 0 1px var(--primary)',
  },
  moodEmoji: {
    fontSize: 22,
  },
  moodLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ink)',
    textAlign: 'center',
    lineHeight: '12px',
  },
  primaryBtnBig: {
    width: '100%',
    height: 48,
    borderRadius: 999,
    background: 'var(--primary)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    marginTop: 20,
  },
};

export function GamesScreen() {
  const navigate = useNavigate();
  const {
    pair,
    gameSession,
    createGameSession,
    fetchGameSession,
    setupGameRealtime,
    cleanupGameRealtime,
  } = useValentinesStore();

  const [selectedGame, setSelectedGame] = useState<GameId>('KNOW_ME');
  const [mood, setMood] = useState<GameMood>('нежное');
  const [starting, setStarting] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);

  useEffect(() => {
    void fetchGameSession();
    setMainButton({ isVisible: false });
    const onBackClick = () => navigate(-1);
    setBackButton(true, onBackClick);
    return () => setBackButton(false);
  }, [navigate, fetchGameSession]);

  useEffect(() => {
    if (pair) setupGameRealtime(pair.id);
    return () => cleanupGameRealtime();
  }, [pair, setupGameRealtime, cleanupGameRealtime]);

  const hasActive = gameSession?.status === 'active';

  const start = async () => {
    if (starting) return;
    hapticFeedback('impact', 'light');
    setStarting(true);
    setScreenError(null);
    const session = await createGameSession(selectedGame, mood);
    setStarting(false);
    if (session) {
      navigate('/games/play');
    } else {
      setScreenError(useValentinesStore.getState().error || 'Не удалось начать игру. Попробуйте ещё раз.');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>Игры</span>
      </div>

      <div style={styles.subtitle}>
        Игры для двоих в реальном времени: оба отвечаете, ответы раскрываются одновременно.
      </div>

      {screenError && (
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '12px 14px', fontSize: 13, lineHeight: '18px', color: 'var(--primary)', marginBottom: 14 }}>
          {screenError}
        </div>
      )}

      {hasActive && (
        <button style={styles.continueCard} onClick={() => {
          hapticFeedback('impact', 'light');
          navigate('/games/play');
        }}>
          <span style={styles.continueEmoji}>▶️</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
              {gameSession ? GAME_TITLES[gameSession.game_id] : ''}
            </span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--ash)', marginTop: 1 }}>
              Сессия активна — продолжить игру
            </span>
          </span>
          <span style={{ color: 'var(--stone)', fontSize: 20 }}>›</span>
        </button>
      )}

      {GAMES.map((g) => {
        const selected = selectedGame === g.id;
        return (
          <button
            key={g.id}
            style={{ ...styles.gameCard, ...(selected ? styles.gameCardSelected : {}) }}
            onClick={() => { hapticFeedback('selection'); setSelectedGame(g.id); }}
            title={g.title}
          >
            <span style={{ ...styles.gameIcon, background: g.bg }}>
              <span style={{ fontSize: 24 }}>{g.emoji}</span>
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={styles.gameTitle}>{g.title}</span>
              <span style={styles.gameSub}>{g.sub}</span>
            </span>
            <span style={{ color: selected ? 'var(--primary)' : 'var(--stone)', fontSize: 18 }}>{selected ? '✓' : '›'}</span>
          </button>
        );
      })}

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Настроение вечера</div>
        <div style={styles.sectionHint}>Подберём карточки под ваше настроение</div>
      </div>

      <div style={styles.moodGrid}>
        {MOODS.map((m) => {
          const selected = mood === m.value;
          return (
            <button
              key={m.value}
              style={{ ...styles.moodChip, ...(selected ? styles.moodChipSelected : {}) }}
              onClick={() => setMood(m.value)}
              title={m.desc}
            >
              <span style={styles.moodEmoji}>{m.emoji}</span>
              <span style={styles.moodLabel}>{m.label}</span>
            </button>
          );
        })}
      </div>

      <button onClick={start} disabled={starting} style={styles.primaryBtnBig}>
        {starting ? 'Собираем карточки…' : 'Начать игру'}
      </button>
    </div>
  );
}