import { shallow } from 'zustand/shallow';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { GameId, GameMood, HotLevel } from '../types';
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
  TRUTH_DARE: 'Правда или действие',
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
  {
    id: 'TRUTH_DARE',
    emoji: '😈',
    title: 'Правда или действие',
    sub: 'Выбирайте: ответить на откровенный вопрос или выполнить задание. ИИ подготовит и то и другое',
    bg: 'linear-gradient(180deg, #ffe8e0, #ffcbb4)',
  },
];

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '18px 16px 24px',
    maxWidth: 460,
    margin: '0 auto',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    position: 'relative',
  },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--ink)',
    zIndex: 1,
    pointerEvents: 'none',
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
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1000,
    animation: 'fadeIn 150ms ease',
  },
  modalCard: {
    background: 'var(--surface-card)',
    borderRadius: 20,
    padding: '24px',
    maxWidth: 340,
    width: '100%',
    textAlign: 'center',
    border: '1px solid var(--hairline)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalEmoji: { fontSize: 44, marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 },
  modalText: { fontSize: 14, lineHeight: '20px', color: 'var(--mute)', marginBottom: 18 },
  modalBtnRow: { display: 'flex', gap: 10 },
  modalBtnPrimary: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    background: 'var(--primary)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
  },
  modalBtnSecondary: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    background: 'var(--secondary-bg)',
    color: 'var(--ink)',
    fontSize: 14,
    fontWeight: 700,
    border: '1px solid var(--hairline)',
    cursor: 'pointer',
  },
  loadingOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(7,10,28,0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1000,
    animation: 'fadeIn 150ms ease',
  },
  loadingCard: {
    textAlign: 'center',
    maxWidth: 280,
  },
  loadingEmoji: { fontSize: 56, marginBottom: 16 },
  loadingTitle: { fontSize: 18, fontWeight: 700, color: '#E8EBFA', marginBottom: 8 },
  loadingSub: { fontSize: 13, color: '#8E97C4', lineHeight: '19px' },

  settingsSection: {
    marginTop: 18,
    marginBottom: 16,
  },
  settingsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    background: 'var(--surface-card)',
    borderRadius: 14,
    border: '1px solid var(--hairline)',
    cursor: 'pointer',
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  settingsChevron: {
    fontSize: 14,
    color: 'var(--ash)',
    transition: 'transform 150ms ease',
  },
  settingsContent: {
    marginTop: 10,
    padding: '12px 14px',
    background: 'var(--surface-card)',
    borderRadius: 14,
    border: '1px solid var(--hairline)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingInfo: {
    flex: 1,
    minWidth: 0,
  },
  settingLabel: {
    display: 'block',
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--ink)',
    marginBottom: 2,
  },
  settingDesc: {
    display: 'block',
    fontSize: 12,
    lineHeight: '16px',
    color: 'var(--ash)',
  },
  toggleBtnOn: {
    height: 32,
    padding: '0 14px',
    borderRadius: 999,
    background: 'var(--primary)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
  },
  toggleBtnOff: {
    height: 32,
    padding: '0 14px',
    borderRadius: 999,
    background: 'var(--secondary-bg)',
    color: 'var(--ink)',
    fontSize: 12,
    fontWeight: 700,
    border: '1px solid var(--hairline)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  heatLevelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  },
  heatLevelBtn: {
    padding: '12px',
    borderRadius: 12,
    border: '1px solid var(--hairline)',
    background: 'var(--secondary-bg)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    textAlign: 'center',
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
  },
  heatLevelBtnSelected: {
    borderColor: 'var(--primary)',
    boxShadow: '0 0 0 1px var(--primary)',
    background: 'var(--grad-heart)',
  },
  heatLevelEmoji: { fontSize: 20 },
  heatLevelLabel: { fontSize: 12, fontWeight: 700, color: 'var(--ink)' },
  heatLevelDesc: { fontSize: 10, color: 'var(--ash)', lineHeight: '12px' },
  confirmBtn: {
    height: 32,
    padding: '0 16px',
    borderRadius: 999,
    background: 'var(--primary)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
  },
};

export function GamesScreen() {
  const navigate = useNavigate();
  const { pair, gameSession, createGameSession, fetchGameSession, setupGameRealtime, cleanupGameRealtime, fetchPairSettings, pairSettings, updateMyHot18Confirmed, updateMyHotLevel, setHot18Enabled, } = useValentinesStore(
    (s) => ({ pair: s.pair, gameSession: s.gameSession, createGameSession: s.createGameSession, fetchGameSession: s.fetchGameSession, setupGameRealtime: s.setupGameRealtime, cleanupGameRealtime: s.cleanupGameRealtime, fetchPairSettings: s.fetchPairSettings, pairSettings: s.pairSettings, updateMyHot18Confirmed: s.updateMyHot18Confirmed, updateMyHotLevel: s.updateMyHotLevel, setHot18Enabled: s.setHot18Enabled }),
    shallow,
  );

  const [selectedGame, setSelectedGame] = useState<GameId>('KNOW_ME');
  const [mood, setMood] = useState<GameMood>('нежное');
  const [starting, setStarting] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [showHot18Modal, setShowHot18Modal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loadingTip, setLoadingTip] = useState('');

  // Determine if current user is partner A or B
  const isPartnerA = pair?.telegram_user_a === useValentinesStore.getState().currentUser?.id;
  const myHotLevel = isPartnerA ? pairSettings?.hot_level_a : pairSettings?.hot_level_b;
  const myHot18Confirmed = isPartnerA ? pairSettings?.hot_18_confirmed_a : pairSettings?.hot_18_confirmed_b;
  const hot18Enabled = pairSettings?.hot_18_enabled ?? true;

  // Heat level labels for UI
  const HOT_LEVEL_LABELS: Record<HotLevel, { label: string; emoji: string; desc: string }> = {
    flirt: { label: 'Флирт', emoji: '💋', desc: 'Лёгкий флирт, поцелуи' },
    warm: { label: 'Тёплое', emoji: '🔥', desc: 'Страсть, прикосновения' },
    bold: { label: 'Смелое', emoji: '🌶️', desc: 'Откровенные вопросы и действия' },
    wild: { label: 'Дикое', emoji: '🌪️', desc: 'Максимальная откровенность' },
  };

  useEffect(() => {
    if (pair) {
      fetchPairSettings();
    }
  }, [pair, fetchPairSettings]);

  const TIPS = [
    '💡 ИИ подбирает вопросы именно под ваше настроение',
    '💡 Ответы раскрываются одновременно — честнее так',
    '💡 В «Правда или действие» у каждого свои варианты',
    '💡 Можно писать до 2000 символов',
    '💡 В конце — подробная статистика синхронности',
  ];

  useEffect(() => {
    if (starting) {
      setLoadingTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
      const t = window.setInterval(() => {
        setLoadingTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
      }, 2500);
      return () => window.clearInterval(t);
    }
  }, [starting]);

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
    // Для TRUTH_DARE + погорячее — проверяем 18+
    if (selectedGame === 'TRUTH_DARE' && mood === 'погорячее') {
      if (!hot18Enabled) {
        setScreenError('Категория 18+ отключена в настройках');
        return;
      }
      if (!myHot18Confirmed) {
        hapticFeedback('selection');
        setShowHot18Modal(true);
        return;
      }
    }
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

  const startWithHot18 = async (is18: boolean) => {
    setShowHot18Modal(false);
    if (is18) {
      // User confirms they are 18+
      await updateMyHot18Confirmed(true);
      // Re-fetch to get updated settings
      await fetchPairSettings();
    }
    hapticFeedback('impact', 'light');
    setStarting(true);
    setScreenError(null);
    const session = await createGameSession(selectedGame, is18 ? 'погорячее 18+' : 'погорячее');
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

      {/* Settings section */}
      <div style={styles.settingsSection}>
        <div style={styles.settingsHeader} onClick={() => setShowSettings(!showSettings)}>
          <span style={styles.settingsTitle}>⚙️ Настройки игр</span>
          <span style={styles.settingsChevron}>{showSettings ? '▲' : '▼'}</span>
        </div>
        {showSettings && (
          <div style={styles.settingsContent}>
            {/* 18+ toggle */}
            <div style={styles.settingRow}>
              <div style={styles.settingInfo}>
                <span style={styles.settingLabel}>🌶️ Категория 18+</span>
                <span style={styles.settingDesc}>
                  Откровенные вопросы и задания для взрослых. Оба партнёра должны подтвердить возраст.
                </span>
              </div>
              <button
                style={{ ...styles.toggleBtn, ...(hot18Enabled ? styles.toggleBtnOn : styles.toggleBtnOff) }}
                onClick={() => setHot18Enabled(!hot18Enabled)}
                disabled={starting}
              >
                {hot18Enabled ? 'Включено' : 'Выключено'}
              </button>
            </div>

            {/* Heat level selector (only visible if 18+ enabled) */}
            {hot18Enabled ? (
              <div style={styles.settingRow}>
                <div style={styles.settingInfo}>
                  <span style={styles.settingLabel}>🌡️ Уровень жара</span>
                  <span style={styles.settingDesc}>
                    Ваш личный максимум. Партнёр не видит ваш выбор. Игра использует меньший из двух уровней.
                  </span>
                </div>
                <div style={styles.heatLevelGrid}>
                  {(['flirt', 'warm', 'bold', 'wild'] as HotLevel[]).map((level) => {
                    const isSelected = myHotLevel === level;
                    const info = HOT_LEVEL_LABELS[level];
                    return (
                      <button
                        key={level}
                        style={{
                          ...styles.heatLevelBtn,
                          ...(isSelected ? styles.heatLevelBtnSelected : {}),
                        }}
                        onClick={() => !starting && updateMyHotLevel(level)}
                        disabled={starting}
                      >
                        <span style={styles.heatLevelEmoji}>{info.emoji}</span>
                        <span style={styles.heatLevelLabel}>{info.label}</span>
                        <span style={styles.heatLevelDesc}>{info.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* 18+ confirmation status */}
            <div style={styles.settingRow}>
              <div style={styles.settingInfo}>
                <span style={styles.settingLabel}>✅ Подтверждение 18+</span>
                <span style={styles.settingDesc}>
                  {myHot18Confirmed
                    ? 'Вы подтвердили возраст. Можно играть в 18+ режим.'
                    : 'Для 18+ режима нужно подтвердить возраст при старте игры.'}
                </span>
              </div>
              {hot18Enabled && !myHot18Confirmed && (
                <button
                  style={styles.confirmBtn}
                  onClick={() => {
                    hapticFeedback('selection');
                    setShowHot18Modal(true);
                  }}
                  disabled={starting}
                >
                  Подтвердить 18+
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showHot18Modal && (
        <div style={styles.modalOverlay} onClick={() => setShowHot18Modal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalEmoji}>🔥</div>
            <div style={styles.modalTitle}>Погорячее 🌶️</div>
            <div style={styles.modalText}>
              Два варианта: обычный «погорячее» (флирт, поцелуи, страсть) или «погорячее 18+» (откровенные вопросы и задания для взрослых).
            </div>
            <div style={styles.modalBtnRow}>
              <button onClick={() => startWithHot18(false)} style={styles.modalBtnSecondary}>
                Обычное 🔥
              </button>
              <button onClick={() => startWithHot18(true)} style={styles.modalBtnPrimary}>
                18+ 🌶️
              </button>
            </div>
          </div>
        </div>
      )}

      {starting && !showHot18Modal && (
        <div style={styles.loadingOverlay}>
          <div style={styles.loadingCard}>
            <div className="animate-pulse" style={styles.loadingEmoji}>🎲</div>
            <div style={styles.loadingTitle}>Собираем карточки...</div>
            <div style={styles.loadingSub}>{loadingTip}</div>
          </div>
        </div>
      )}
    </div>
  );
}