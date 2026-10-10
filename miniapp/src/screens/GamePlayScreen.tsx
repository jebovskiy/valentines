import { shallow } from 'zustand/shallow';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { GameId, GameMood, GameRound } from '../types';
import { setMainButton, setBackButton, hapticFeedback } from '../utils/telegram';
import { BackButton } from '../components/BackButton';

const MOOD_EMOJI: Record<GameMood, string> = {
  'нежное': '🌸',
  'веселое': '🎉',
  'погорячее': '🔥',
  'погорячее 18+': '🌶️',
  'поговорить': '💬',
  'спокойное': '🌙',
};

const MOOD_LABEL: Record<GameMood, string> = {
  'нежное': 'теплый вечер',
  'веселое': 'веселый вечер',
  'погорячее': 'жаркий вечер',
  'погорячее 18+': 'взрослый вечер',
  'поговорить': 'вечер разговоров',
  'спокойное': 'спокойный вечер',
};

const GAME_TITLES: Record<GameId, string> = {
  KNOW_ME: 'Насколько ты меня знаешь?',
  CHOOSE_ONE: 'Выбери одно',
  ASSOCIATIONS: 'Ассоциации',
  COMPLIMENTS: 'Комплименты',
  SPEED_FACTS: 'Это мы?',
  TRUTH_DARE: 'Правда или действие',
};

function normalizeAnswer(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function categoryLabel(gameId: GameId, round: GameRound): string {
  switch (gameId) {
    case 'KNOW_ME':
      return round.category === 'final' ? 'Финальный вопрос' : 'Вопрос';
    case 'CHOOSE_ONE':
      return round.category === 'surprise' ? 'Сюрприз' : 'Выбери одно';
    case 'ASSOCIATIONS':
      return 'Ассоциация';
    case 'COMPLIMENTS':
      return 'Комплимент';
    case 'SPEED_FACTS':
      return 'Это мы?';
    case 'TRUTH_DARE':
      return 'Выберите: правда или действие';
    default:
      return '';
  }
}

function reactionFor(gameId: GameId, round: GameRound, mine: string, partner: string): string {
  if (gameId === 'TRUTH_DARE') {
    if (mine === '🔥 Действие' && partner === '🔥 Действие') return '🔥 Оба выбрали действие — дерзайте!';
    if (mine === partner) return '💬 Оба выбрали правду — откровенно!';
    return '😏 Один смелый, один вдумчивый — идеальный дуэт.';
  }
  if (round.type === 'choice') {
    if (mine === partner) {
      if (round.category === 'surprise') return '🔥 Одинаковый выбор из четырёх — это судьба!';
      return '❤️ Вы выбрали одинаково — вы на одной волне!';
    }
    return '😏 Ответы разные — кажется, есть что обсудить.';
  }
  if (gameId === 'KNOW_ME') return '';
  const same = normalizeAnswer(mine) === normalizeAnswer(partner);
  if (gameId === 'ASSOCIATIONS') {
    return same
      ? '🎯 Одинаковые ассоциации — вы на одной волне!'
      : '😏 Ассоциации разные — зато есть о чём поговорить.';
  }
  if (gameId === 'COMPLIMENTS') return '💐 Какие тёплые слова!';
  return same
    ? '❤️ Вы написали почти одно и то же — настоящая связь!'
    : '😏 Ответы разные — кажется, есть что обсудить.';
}

function isChoiceRound(round: GameRound): boolean {
  return (round.type === 'choice' || round.type === 'truth_dare') && round.options.length > 0;
}

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
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    padding: '0 44px',
  },
  moodBadge: {
    fontSize: 22,
    position: 'absolute',
    right: 0,
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressText: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--mute)',
  },
  card: {
    background: 'var(--surface-card)',
    borderRadius: 22,
    padding: '22px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    border: '1px solid var(--hairline)',
  },
  cardCategory: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--primary)',
  },
  cardQuestion: {
    fontSize: 19,
    fontWeight: 700,
    lineHeight: '25px',
    color: 'var(--ink)',
    marginBottom: 4,
  },
  option: {
    width: '100%',
    padding: '14px 14px',
    borderRadius: 14,
    background: 'var(--secondary-bg)',
    border: '1px solid var(--hairline)',
    color: 'var(--ink)',
    fontSize: 15,
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
  },
  optionPicked: {
    background: 'var(--primary)',
    borderColor: 'var(--primary)',
    color: '#fff',
  },
  textarea: {
    width: '100%',
    minHeight: 92,
    padding: '12px 14px',
    borderRadius: 14,
    background: 'var(--secondary-bg)',
    border: '1px solid var(--hairline)',
    color: 'var(--ink)',
    fontSize: 15,
    lineHeight: '20px',
    resize: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  primaryBtn: {
    width: '100%',
    height: 46,
    borderRadius: 999,
    background: 'var(--primary)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  waitingCard: {
    background: 'var(--surface-card)',
    borderRadius: 22,
    padding: '32px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    alignItems: 'center',
    border: '1px solid var(--hairline)',
  },
  waitingEmoji: {
    fontSize: 44,
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  waitingDesc: {
    fontSize: 13,
    lineHeight: '19px',
    color: 'var(--mute)',
  },
  myPickBadge: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--mute)',
    background: 'var(--secondary-bg)',
    padding: '8px 12px',
    borderRadius: 12,
  },
  revealBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  revealRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  revealAvatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    background: 'var(--secondary-bg)',
  },
  revealAnswer: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 14,
    background: 'var(--secondary-bg)',
    border: '1px solid var(--hairline)',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ink)',
  },
  reaction: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--error-deep)',
    background: 'var(--grad-heart)',
    padding: '10px 12px',
    borderRadius: 12,
    textAlign: 'center',
  },
  finalCard: {
    background: 'var(--surface-card)',
    borderRadius: 22,
    padding: '26px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    alignItems: 'center',
    textAlign: 'center',
    border: '1px solid var(--hairline)',
  },
  finalEmoji: {
    fontSize: 50,
  },
  finalTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--ink)',
  },
  finalSub: {
    fontSize: 13,
    lineHeight: '19px',
    color: 'var(--mute)',
  },
  finalCount: {
    fontSize: 30,
    fontWeight: 800,
    color: 'var(--primary)',
  },
  finalAnswers: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 6,
  },
  finalAnswerBlock: {
    padding: '12px 14px',
    borderRadius: 14,
    background: 'var(--secondary-bg)',
    border: '1px solid var(--hairline)',
    fontSize: 14,
    lineHeight: '20px',
    color: 'var(--ink)',
    textAlign: 'left',
  },
};

export function GamePlayScreen() {
  const navigate = useNavigate();
  const { pair, currentUser, gameSession, answerGame, finishGameSession, fetchGameSession, setupGameRealtime, cleanupGameRealtime, } = useValentinesStore(
    (s) => ({ pair: s.pair, currentUser: s.currentUser, gameSession: s.gameSession, answerGame: s.answerGame, finishGameSession: s.finishGameSession, fetchGameSession: s.fetchGameSession, setupGameRealtime: s.setupGameRealtime, cleanupGameRealtime: s.cleanupGameRealtime }),
    shallow,
  );

  const [revealIdx, setRevealIdx] = useState(0);
  const [textDraft, setTextDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const lastSessionId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setMainButton({ isVisible: false });
    const onBackClick = () => navigate('/games');
    setBackButton(true, onBackClick);
    void fetchGameSession().finally(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
      setBackButton(false);
    };
  }, [navigate, fetchGameSession]);

  useEffect(() => {
    if (ready && !gameSession) {
      navigate('/games', { replace: true });
    }
  }, [ready, gameSession, navigate]);

  useEffect(() => {
    if (pair) setupGameRealtime(pair.id);
    return () => cleanupGameRealtime();
  }, [pair, setupGameRealtime, cleanupGameRealtime]);

  useEffect(() => {
    if (!gameSession) return;
    if (gameSession.id !== lastSessionId.current) {
      lastSessionId.current = gameSession.id;
      setRevealIdx(0);
      setTextDraft('');
    }
  }, [gameSession?.id]);

  // Поллинг на случай потери realtime: пока ждём ответа партнёра — подтягиваем сессию.
  useEffect(() => {
    if (!gameSession || gameSession.status !== 'active') return;
    const answers = gameSession.answers ?? [];
    const myCount = answers.filter((a) => a.user_id === currentUser?.id).length;
    const partnerCount = answers.filter((a) => a.user_id !== currentUser?.id).length;
    const waiting = myCount > partnerCount && myCount <= rounds.length;
    if (!waiting && myCount === partnerCount) return;
    const t = window.setInterval(() => {
      void fetchGameSession();
    }, 2500);
    return () => window.clearInterval(t);
  }, [gameSession?.id, gameSession?.answers?.length, currentUser?.id, fetchGameSession]);

  const rounds = gameSession?.rounds ?? [];
  const total = rounds.length;
  const isInitiator = gameSession?.initiator_id === currentUser?.id;

  const answers = gameSession?.answers ?? [];

  const myAnswers = useMemo(
    () => answers.filter((a) => a.user_id === currentUser?.id),
    [answers, currentUser?.id],
  );
  const partnerAnswers = useMemo(
    () => answers.filter((a) => a.user_id !== currentUser?.id),
    [answers, currentUser?.id],
  );
  const myByIndex = useMemo(() => new Map(myAnswers.map((a) => [a.round_index, a.answer])), [myAnswers]);
  const partByIndex = useMemo(() => new Map(partnerAnswers.map((a) => [a.round_index, a.answer])), [partnerAnswers]);

  const bothAnsweredCount = rounds.filter((_, i) => myByIndex.has(i) && partByIndex.has(i)).length;
  const allDone = total > 0 && bothAnsweredCount >= total && revealIdx >= total;

  const round = revealIdx < total ? rounds[revealIdx] : null;
  const mine = round ? myByIndex.get(revealIdx) : undefined;
  const partners = round ? partByIndex.get(revealIdx) : undefined;

  // Свой вариант правды/действия: инициатор — A (truth/dare), партнёр — B (truthB/dareB).
  const tdTextFor = (r: GameRound, byMe: boolean, answer: string): string => {
    const pickedTruth = answer === r.options[0];
    const myA = byMe === isInitiator;
    if (pickedTruth) return (myA ? r.truth : (r.truthB ?? r.truth)) ?? '';
    return (myA ? r.dare : (r.dareB ?? r.dare)) ?? '';
  };

  const showReveal = !!round && bothAnsweredCount > revealIdx;
  const showWait = !!round && !showReveal && mine !== undefined;
  const showAnswer = !!round && !showReveal && mine === undefined;

  const submitChoice = async (answer: string) => {
    if (!round || sending) return;
    hapticFeedback('impact', 'light');
    setSending(true);
    await answerGame(revealIdx, answer);
    setSending(false);
  };

  const submitSkip = async () => {
    if (!round || sending) return;
    hapticFeedback('selection');
    setSending(true);
    await answerGame(revealIdx, '__SKIP__');
    setSending(false);
  };

  const submitText = async () => {
    if (!round || sending || textDraft.trim().length === 0) return;
    hapticFeedback('impact', 'light');
    setSending(true);
    await answerGame(revealIdx, textDraft.trim());
    setSending(false);
    setTextDraft('');
  };

  const nextReveal = () => {
    hapticFeedback('selection');
    setRevealIdx((i) => i + 1);
  };

  const finish = async () => {
    if (!gameSession) return;
    await finishGameSession(gameSession.id);
    navigate('/games');
  };

  if (!gameSession) {
    return (
      <div style={styles.container}>
        <div style={styles.topBar}>
          <BackButton />
          <span style={styles.title}>Игра</span>
        </div>
        <div style={styles.waitingCard}>
          <div className="animate-pulse" style={styles.waitingEmoji}>🎲</div>
          <div style={styles.waitingTitle}>Загружаем игру…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>
          {GAME_TITLES[gameSession.game_id]}
        </span>
        {gameSession.mood && <span style={styles.moodBadge}>{MOOD_EMOJI[gameSession.mood]}</span>}
      </div>

      {allDone ? (
        <FinalCard
          rounds={rounds}
          myByIndex={myByIndex}
          partByIndex={partByIndex}
          gameId={gameSession.game_id}
          mood={gameSession.mood}
          onFinish={finish}
        />
      ) : (
        <>
          <div style={styles.progressRow}>
            <span style={styles.progressText}>Вопрос {Math.min(revealIdx + 1, total)} из {total}</span>
          </div>

          {showWait && (
            <div style={styles.waitingCard}>
              <div className="animate-pulse" style={styles.waitingEmoji}>💕</div>
              <div style={styles.waitingTitle}>Ждём партнёра</div>
              <div style={styles.waitingDesc}>
                Вы ответили. Когда партнёр ответит — оба ответа раскроются одновременно.
              </div>
              <div style={styles.myPickBadge}>Ваш выбор: {mine}</div>
            </div>
          )}

          {showAnswer && round && (
            <div className="animate-slide-up" style={styles.card}>
              <div style={styles.cardCategory}>
                {categoryLabel(gameSession.game_id, round)}
              </div>
              <div style={styles.cardQuestion}>{round.text}</div>

              {isChoiceRound(round) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {round.options.map((opt) => (
                    <button key={opt} onClick={() => submitChoice(opt)} style={styles.option}>
                      {opt}
                    </button>
                  ))}
                  <button
                    onClick={submitSkip}
                    disabled={sending}
                    style={{
                      ...styles.option,
                      background: 'var(--secondary-bg)',
                      color: 'var(--ash)',
                      borderColor: 'var(--hairline)',
                    }}
                  >
                    Пропустить
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                    <textarea
                      value={textDraft}
                      onChange={(e) => setTextDraft(e.target.value.slice(0, 2000))}
                      placeholder="Напишите, что бы вы хотели..."
                      style={styles.textarea}
                      maxLength={2000}
                    />
                    <span style={{ fontSize: 12, color: 'var(--ash)', whiteSpace: 'nowrap', marginBottom: 4 }}>
                      {textDraft.length}/2000
                    </span>
                  </div>
                  <button
                    onClick={submitText}
                    disabled={sending || textDraft.trim().length === 0}
                    style={{ ...styles.primaryBtn, ...(sending || textDraft.trim().length === 0 ? styles.primaryBtnDisabled : {}) }}
                  >
                    Отправить
                  </button>
                </div>
              )}
            </div>
          )}

          {showReveal && round && mine !== undefined && partners !== undefined && (
            <div className="animate-slide-up" style={styles.card}>
              <div style={styles.cardCategory}>Ответы</div>
              <div style={styles.cardQuestion}>{round.text}</div>
              {round.type === 'truth_dare' ? (
                <div style={styles.revealBlock}>
                  <div style={styles.revealRow}>
                    <span style={styles.revealAvatar}>🙂</span>
                    <span style={styles.revealAnswer}>
                      Вы: <strong>{mine}</strong> — {tdTextFor(round, true, mine)}
                    </span>
                  </div>
                  <div style={styles.revealRow}>
                    <span style={styles.revealAvatar}>😊</span>
                    <span style={styles.revealAnswer}>
                      Партнёр: <strong>{partners}</strong> — {tdTextFor(round, false, partners)}
                    </span>
                  </div>
                </div>
              ) : round.type !== 'text' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
                  {round.options.map((opt) => {
                    const pickedByMe = opt === mine;
                    const pickedByPartner = opt === partners;
                    const isMatch = mine === partners && pickedByMe;
                    return (
                      <div
                        key={opt}
                        style={{
                          ...styles.option,
                          opacity: pickedByMe || pickedByPartner ? 1 : 0.35,
                          outline: isMatch ? '2px solid var(--primary)' : 'none',
                          background: isMatch ? 'var(--grad-heart)' : 'var(--secondary-bg)',
                          color: isMatch ? 'var(--error-deep)' : 'var(--ink)',
                          textAlign: 'center',
                        }}
                      >
                        {opt}
                      </div>
                    );
                  })}
                </div>
              )}
              {round.type === 'text' && (
                <div style={styles.revealBlock}>
                  <div style={styles.revealRow}>
                    <span style={styles.revealAvatar}>🙂</span>
                    <span style={styles.revealAnswer}>{mine}</span>
                  </div>
                  <div style={styles.revealRow}>
                    <span style={styles.revealAvatar}>😊</span>
                    <span style={styles.revealAnswer}>{partners}</span>
                  </div>
                </div>
              )}
              {reactionFor(gameSession.game_id, round, mine, partners) && (
                <div style={styles.reaction}>{reactionFor(gameSession.game_id, round, mine, partners)}</div>
              )}
              <button onClick={nextReveal} style={styles.primaryBtn}>Дальше</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FinalCard({
  rounds,
  myByIndex,
  partByIndex,
  gameId,
  mood,
  onFinish,
}: {
  rounds: GameRound[];
  myByIndex: Map<number, string>;
  partByIndex: Map<number, string>;
  gameId: GameId;
  mood: GameMood | null;
  onFinish: () => void;
}) {
  let matchedChoice = 0;
  let choiceCount = 0;
  let matchedText = 0;
  let textCount = 0;
  let myTruths = 0;
  let myDares = 0;
  let partTruths = 0;
  let partDares = 0;
  let myChars = 0;
  let partChars = 0;
  for (let i = 0; i < rounds.length; i++) {
    const mine = myByIndex.get(i);
    const partners = partByIndex.get(i);
    if (mine === undefined || partners === undefined) continue;
    if (isChoiceRound(rounds[i])) {
      choiceCount++;
      if (mine === partners) matchedChoice++;
      if (gameId === 'TRUTH_DARE') {
        if (mine === rounds[i].options[0]) myTruths++;
        else myDares++;
        if (partners === rounds[i].options[0]) partTruths++;
        else partDares++;
      }
    } else if (rounds[i].type === 'text') {
      textCount++;
      if (normalizeAnswer(mine) === normalizeAnswer(partners)) matchedText++;
    }
    if (mine) myChars += mine.length;
    if (partners) partChars += partners.length;
  }

  const totalAnswered = choiceCount + textCount;
  const syncPct = totalAnswered > 0 ? Math.round((matchedChoice + matchedText) / totalAnswered * 100) : 0;
  const longestMine = [...myByIndex.values()].reduce((m, s) => Math.max(m, s.length), 0);
  const longestPart = [...partByIndex.values()].reduce((m, s) => Math.max(m, s.length), 0);

  let emoji = '💘';
  let title = 'Идеальная пара';
  let sub = '';
  let countValue: string | null = null;
  let countCaption = 'ответов совпали';
  let listTitle: string | null = null;

  if (gameId === 'COMPLIMENTS') {
    emoji = '💐';
    title = 'Комплименты получены';
    sub = 'Никакого счёта — только искренние слова друг другу. Перечитывайте их, когда грустно.';
    listTitle = 'Комплименты';
  } else if (gameId === 'ASSOCIATIONS') {
    const pct = textCount > 0 ? matchedText / textCount : 0;
    if (pct >= 0.5) {
      emoji = '🎯';
      title = 'Вы мыслите в унисон!';
      sub = 'Больше половины ассоциаций совпали — вы настроены на одну волну.';
    } else {
      emoji = '🌌';
      title = 'Вы очень разные — и это здорово';
      sub = 'Ассоциации разошлись, зато сколько нового вы узнали друг о друге!';
    }
    countValue = `${matchedText} из ${textCount}`;
    countCaption = 'ассоциаций совпали';
    listTitle = 'Ваши ассоциации';
  } else if (gameId === 'KNOW_ME') {
    const pct = choiceCount > 0 ? matchedChoice / choiceCount : 0;
    if (pct >= 0.8) {
      emoji = '💘';
      title = 'Вы читаете мысли друг друга';
      sub = 'Восемь из десяти и чаще — вы будто знаете ответы заранее.';
    } else if (pct >= 0.5) {
      emoji = '❤️';
      title = 'Вы отлично понимаете друг друга';
      sub = 'Больше половины совпадений — вы точно на одной волне.';
    } else {
      emoji = '🌱';
      title = 'Вам есть что открыть друг о друге';
      sub = 'Разные ответы — это не плохо, это повод для новых разговоров.';
    }
    countValue = `${matchedChoice} из ${choiceCount}`;
    listTitle = 'Ваш следующий момент';
  } else if (gameId === 'TRUTH_DARE') {
    emoji = '🎲';
    title = 'Отлично сыграно!';
    sub = `Правда: вы ${myTruths} / партнёр ${partTruths}  ·  Действие: вы ${myDares} / партнёр ${partDares}. Синхронность ${syncPct}%.`;
    countValue = `${myTruths + myDares} раундов`;
    countCaption = 'сыграно';
  } else {
    const pct = choiceCount > 0 ? matchedChoice / choiceCount : 0;
    if (gameId === 'SPEED_FACTS') {
      if (pct >= 0.75) {
        emoji = '⚡';
        title = 'Вы правда на одной волне!';
        sub = 'Совпали почти во всех «Да/Нет» — вы отлично чувствуете друг друга.';
      } else if (pct >= 0.5) {
        emoji = '❤️';
        title = 'Хорошая синхронность';
        sub = 'Больше половины ответов совпали — вы хорошо понимаете друг друга.';
      } else {
        emoji = '😏';
        title = 'Есть что обсудить';
        sub = 'Мнения о вас разошлись — отличный повод поговорить вечером.';
      }
    } else {
      if (pct >= 0.75) {
        emoji = '🎯';
        title = 'Вы на одной волне!';
        sub = 'Совпали почти во всём — ваши вкусы очень близкие.';
      } else if (pct >= 0.4) {
        emoji = '💫';
        title = 'Хорошая синхронность';
        sub = 'Набираете обороты — главное, что вам вместе весело.';
      } else {
        emoji = '😏';
        title = 'Ого-ого';
        sub = 'Меньше половины — похоже, вам есть что обсудить вечером.';
      }
    }
    countValue = `${matchedChoice} из ${choiceCount}`;
  }

  const showList =
    gameId === 'KNOW_ME' || gameId === 'ASSOCIATIONS' || gameId === 'COMPLIMENTS';

  return (
    <div className="animate-slide-up" style={styles.finalCard}>
      <div style={styles.finalEmoji}>{emoji}</div>
      <div style={styles.finalTitle}>{title}</div>
      <div style={styles.finalSub}>{sub}</div>
      {countValue !== null && (
        <>
          <div style={styles.finalCount}>{countValue}</div>
          <div style={styles.finalSub}>{countCaption}</div>
        </>
      )}
      {mood && (
        <div style={styles.finalSub}>
          {MOOD_EMOJI[mood]} Ваш {MOOD_LABEL[mood]} прошёл.
        </div>
      )}
      <div style={{ marginTop: 6, padding: '10px 12px', background: 'var(--secondary-bg)', borderRadius: 12, fontSize: 12, color: 'var(--ink)', lineHeight: 1.6 }}>
        <div><strong>Статистика:</strong> всего раундов {totalAnswered}, синхронность {syncPct}%</div>
        <div>Ваши символы: {myChars} (макс {longestMine})  ·  Партнёра: {partChars} (макс {longestPart})</div>
        {gameId === 'TRUTH_DARE' && (
          <div>Правда — вы: {myTruths}, партнёр: {partTruths}  ·  Действие — вы: {myDares}, партнёр: {partDares}</div>
        )}
      </div>

      {showList && (
        <div style={styles.finalAnswers}>
          {listTitle && (
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mute)' }}>{listTitle}</div>
          )}
          {rounds.map((r, i) => {
            if (gameId === 'KNOW_ME' && r.type !== 'text') return null;
            const mine = myByIndex.get(i);
            const partners = partByIndex.get(i);
            if (mine === undefined || partners === undefined) return null;
            return (
              <div key={i} style={styles.finalAnswerBlock}>
                {gameId !== 'KNOW_ME' && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>
                    {r.text}
                  </div>
                )}
                <div><strong>Вы:</strong> «{mine}»</div>
                <div><strong>Партнёр:</strong> «{partners}»</div>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={onFinish} style={{ ...styles.primaryBtn, marginTop: 8 }}>
        Спасибо ❤️
      </button>
    </div>
  );
}