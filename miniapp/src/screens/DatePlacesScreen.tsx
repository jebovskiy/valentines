import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { api } from '../api/client';
import {
  DateMood,
  DateCategory,
  DateBudget,
  DateChoice,
} from '../types';
import { setMainButton, setBackButton, hapticFeedback, requestGeolocation, webApp } from '../utils/telegram';
import { BackButton } from '../components/BackButton';

const MOODS: { value: DateMood; label: string; emoji: string }[] = [
  { value: 'romantic', label: 'Романтично', emoji: '🌹' },
  { value: 'fun', label: 'Весело', emoji: '🎉' },
  { value: 'calm', label: 'Спокойно', emoji: '🌿' },
  { value: 'active', label: 'Активно', emoji: '🏃' },
];

const CATEGORIES: { value: DateCategory; label: string; emoji: string }[] = [
  { value: 'food', label: 'Еда', emoji: '🍽' },
  { value: 'entertainment', label: 'Развлечения', emoji: '🎡' },
  { value: 'nature', label: 'Природа', emoji: '🏞' },
  { value: 'culture', label: 'Культура', emoji: '🏛' },
];

const BUDGETS: { value: DateBudget; label: string }[] = [
  { value: 'any', label: 'Любой' },
  { value: 'cheap', label: 'Дёшево' },
  { value: 'mid', label: 'Средне' },
  { value: 'high', label: 'Дорого' },
];

const RADII: { value: number | null; label: string }[] = [
  { value: 1000, label: 'до 1 км' },
  { value: 3000, label: 'до 3 км' },
  { value: 5000, label: 'до 5 км' },
  { value: 10000, label: 'до 10 км' },
  { value: null, label: 'Любое' },
];

function isIntegrationEnabled(): boolean {
  try {
    return localStorage.getItem('vn_integration_enabled_google_places') !== '0';
  } catch {
    return true;
  }
}

function formatDistance(m: number | null): string {
  if (m == null) return '';
  if (m < 1000) return `${Math.round(m / 10) * 10} м`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} км`;
}

function openExternal(url: string): void {
  if (webApp?.openLink) webApp.openLink(url);
  else window.open(url, '_blank');
}

type Phase = 'setup' | 'swipe' | 'result';

export function DatePlacesScreen() {
  const navigate = useNavigate();
  const {
    dateSession,
    currentUser,
    pair,
    createDateSession,
    voteDate,
    finishDateSession,
    clearDateSession,
    fetchDateSession,
    setupDateRealtime,
    cleanupDateRealtime,
    fetchIntegrations,
  } = useValentinesStore();

  const [phase, setPhase] = useState<Phase>('setup');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState<number | null>(5000);
  const [mood, setMood] = useState<DateMood | null>('romantic');
  const [category, setCategory] = useState<DateCategory | null>('food');
  const [budget, setBudget] = useState<DateBudget>('any');
  const [openNow, setOpenNow] = useState(true);
  const [localIdx, setLocalIdx] = useState(0);
  const [leaving, setLeaving] = useState<DateChoice | null>(null);
  const [locating, setLocating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);

  useEffect(() => {
    void fetchDateSession();
    void fetchIntegrations().catch(() => undefined);
    setMainButton({ isVisible: false });
    const onBackClick = () => navigate(-1);
    setBackButton(true, onBackClick);
    return () => setBackButton(false);
  }, [navigate, fetchDateSession, fetchIntegrations]);

  useEffect(() => {
    if (pair) setupDateRealtime(pair.id);
    return () => cleanupDateRealtime();
  }, [pair, setupDateRealtime, cleanupDateRealtime]);

  useEffect(() => {
    const s = dateSession;
    if (!s) {
      setPhase('setup');
      return;
    }
    if (s.status === 'done') {
      setPhase('result');
      return;
    }
    if (s.places && s.places.length >= 3) {
      setPhase('swipe');
      const mine = s.votes?.filter((v) => v.user_id === currentUser?.id) ?? [];
      setLocalIdx(Math.min(mine.length, 2));
    }
  }, [dateSession, currentUser]);

  const myVotes = dateSession?.votes?.filter((v) => v.user_id === currentUser?.id) ?? [];
  const partnerVotes = dateSession?.votes?.filter((v) => v.user_id !== currentUser?.id) ?? [];
  const currentPlace = dateSession?.places?.[localIdx] ?? null;
  const waitingForPartner = phase === 'swipe' && myVotes.length >= 3 && dateSession?.status === 'active';
  const matched = dateSession?.match?.matched === true;
  const matchPlace = dateSession?.match?.place ?? null;

  const askLocation = async () => {
    hapticFeedback('impact', 'light');
    setLocating(true);
    const point = await requestGeolocation();
    setLocating(false);
    if (point) {
      setCoords({ lat: point.latitude, lng: point.longitude });
      setScreenError(null);
    } else {
      setScreenError('Не получили геопозицию. Разрешите доступ, чтобы искать места рядом.');
    }
  };

  const startPick = async () => {
    if (generating) return;
    if (!isIntegrationEnabled()) {
      setScreenError('Интеграция Google Places отключена в настройках. Включите её, чтобы искать места.');
      return;
    }
    if (!coords) {
      setScreenError('Для подбора «Куда пойти» включите геопозицию.');
      return;
    }
    setGenerating(true);
    setScreenError(null);
    const session = await createDateSession({
      lat: coords.lat,
      lng: coords.lng,
      radius_m: radius,
      mood,
      category,
      budget,
      open_now: openNow ? true : null,
    });
    setGenerating(false);
    if (!session) {
      const err = useValentinesStore.getState().error;
      setScreenError(err || 'Не удалось найти места. Попробуйте изменить фильтры.');
      return;
    }
    setLocalIdx(0);
  };

  const handleVote = async (choice: DateChoice) => {
    const s = dateSession;
    if (!s || !currentPlace || leaving) return;
    hapticFeedback(choice === 'like' ? 'impact' : 'selection', choice === 'like' ? 'light' : undefined);
    setLeaving(choice);
    await voteDate(s.id, localIdx, choice);
    window.setTimeout(() => {
      setLeaving(null);
      setLocalIdx((i) => i + 1);
    }, 220);
  };

  const finishAndReset = async () => {
    const s = dateSession;
    if (s) {
      const { error } = useValentinesStore.getState();
      if (!error) {
        await finishDateSession(s.id);
      }
    }
    clearDateSession();
    setPhase('setup');
  };

  const openPlace = () => {
    const place = currentPlace ?? matchPlace;
    if (!place) return;
    const uri = place.googleMapsUri || `https://maps.google.com/?q=${place.lat},${place.lng}`;
    openExternal(uri);
  };

  const progressDone = Math.min(myVotes.length, 3);

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>Куда пойти?</span>
      </div>

      {screenError && (
        <div style={styles.errorBanner}>
          <div style={styles.errorText}>{screenError}</div>
          {screenError.includes('настройках') && (
            <button onClick={() => navigate('/settings')} style={styles.errorLink}>Открыть настройки</button>
          )}
        </div>
      )}

      {phase === 'setup' && (
        <>
          <div style={styles.locationCard}>
            {!coords ? (
              <>
                <div style={styles.locationTitle}>📍 Где вы?</div>
                <div style={styles.locationDesc}>
                  Покажем места рядом с вами. Расстояние и бюджет — на ваше усмотрение.
                </div>
                <button onClick={askLocation} disabled={locating} style={styles.primaryBtn}>
                  {locating ? 'Запрашиваем…' : 'Разрешить геопозицию'}
                </button>
              </>
            ) : (
              <>
                <div style={styles.locationTitle}>📍 Места у вас</div>
                <div style={styles.locationDesc}>
                  Рядом с вами{radius ? ` в радиусе ${formatDistance(radius)}` : ''}.
                  <button onClick={askLocation} style={styles.locationRefresh}>обновить</button>
                </div>
                <div style={styles.chipRow}>
                  {RADII.map((r) => (
                    <button
                      key={String(r.value)}
                      onClick={() => setRadius(r.value)}
                      style={{ ...styles.chip, background: radius === r.value ? 'var(--primary)' : 'var(--surface-card)', color: radius === r.value ? '#fff' : 'var(--mute)' }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Настроение</div>
            <div style={styles.chipRow}>
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMood(mood === m.value ? null : m.value)}
                  style={{ ...styles.chip, background: mood === m.value ? 'var(--primary)' : 'var(--surface-card)', color: mood === m.value ? '#fff' : 'var(--mute)' }}
                >
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Тип</div>
            <div style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(category === c.value ? null : c.value)}
                  style={{ ...styles.chip, background: category === c.value ? 'var(--primary)' : 'var(--surface-card)', color: category === c.value ? '#fff' : 'var(--mute)' }}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Бюджет <span style={styles.sectionHint}>· оценка по Google</span></div>
            <div style={styles.chipRow}>
              {BUDGETS.map((b) => (
                <button
                  key={b.value}
                  onClick={() => setBudget(b.value)}
                  style={{ ...styles.chip, background: budget === b.value ? 'var(--primary)' : 'var(--surface-card)', color: budget === b.value ? '#fff' : 'var(--mute)' }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.toggleRow}>
              <span style={styles.toggleLabel}>Только открыто сейчас</span>
              <label style={styles.switch}>
                <input type="checkbox" checked={openNow} onChange={() => setOpenNow((v) => !v)} style={{ display: 'none' }} />
                <span style={{ ...styles.switchTrack, background: openNow ? 'var(--primary)' : 'var(--stone)' }}>
                  <span style={{ ...styles.switchThumb, transform: openNow ? 'translateX(18px)' : 'translateX(2px)' }} />
                </span>
              </label>
            </div>
          </div>

          <button onClick={startPick} disabled={generating} style={styles.primaryBtnBig}>
            {generating ? 'Ищем места…' : 'Подобрать 3 места'}
          </button>
        </>
      )}

      {phase === 'swipe' && dateSession && currentPlace && !waitingForPartner && (
        <>
          <div style={styles.progressRow}>
            <span style={styles.progressText}>Карточка {Math.min(localIdx + 1, 3)} из 3</span>
            <span style={styles.progressDots}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ ...styles.progressDot, background: i < progressDone ? 'var(--primary)' : 'var(--stone)' }} />
              ))}
            </span>
          </div>

          <div key={currentPlace.id} className={`animate-slide-up ${leaving ? (leaving === 'like' ? 'animate-fly-right' : 'animate-fly-left') : ''}`} style={styles.card}>
            {currentPlace.photoName ? (
              <img
                src={api.placePhotoUrl(currentPlace.photoName)}
                alt=""
                style={styles.cardImage}
                draggable={false}
                onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              />
            ) : null}
            <div style={{ ...styles.cardImage, display: currentPlace.photoName ? 'none' : 'flex' }}>
              <span style={styles.cardImageEmoji}>{(getEmoji(currentPlace.typeLabel))}</span>
            </div>

            <div style={styles.cardBody}>
              <div style={styles.cardTitleRow}>
                <h2 style={styles.cardName}>{currentPlace.name}</h2>
                {currentPlace.rating != null && (
                  <span style={styles.rating}>★ {currentPlace.rating.toFixed(1)}</span>
                )}
              </div>
              <div style={styles.tagsRow}>
                {currentPlace.typeLabel && <span style={styles.tag}>{currentPlace.typeLabel}</span>}
                {currentPlace.priceLabel && <span style={styles.tag}>{currentPlace.priceLabel}</span>}
                {currentPlace.distanceM != null && <span style={styles.tag}>{formatDistance(currentPlace.distanceM)}</span>}
              </div>
              <div style={styles.cardAddress}>{currentPlace.address || 'Адрес уточняется'}</div>

              {partnerVotes.some((v) => v.place_index === localIdx && v.choice === 'like') && (
                <div style={styles.partnerLike}>💗 Партнёру нравится</div>
              )}
              {partnerVotes.some((v) => v.place_index === localIdx && v.choice === 'dislike') && (
                <div style={styles.partnerPass}>Партнёр пропустил</div>
              )}
            </div>
          </div>

          <div style={styles.actionsRow}>
            <button onClick={() => handleVote('dislike')} disabled={!!leaving} style={styles.noBtn} aria-label="Не нравится">
              ✖
            </button>
            <button onClick={() => handleVote('like')} disabled={!!leaving} style={styles.likeBtn} aria-label="Нравится">
              ❤️
            </button>
          </div>
        </>
      )}

      {phase === 'swipe' && waitingForPartner && (
        <div style={styles.waitingCard}>
          <div className="animate-pulse" style={styles.waitingEmoji}>💕</div>
          <div style={styles.waitingTitle}>Ждём партнёра</div>
          <div style={styles.waitingDesc}>
            Вы выбрали все места. Пока партнёр не пролистает карточки, результат не откроется — чуть-чуть осталось.
          </div>
        </div>
      )}

      {phase === 'result' && (
        <div style={styles.resultCard}>
          {matched && matchPlace ? (
            <>
              <div style={styles.resultEmoji}>🎉</div>
              <div style={styles.resultTitle}>Совпадение!</div>
              <div style={styles.resultSub}>Обоим понравилось — договоритесь о свидании здесь:</div>

              {matchPlace.photoName && (
                <img
                  src={api.placePhotoUrl(matchPlace.photoName)}
                  alt=""
                  style={styles.resultImage}
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                />
              )}
              <div style={styles.resultPlaceName}>{matchPlace.name}</div>
              <div style={styles.resultPlaceMeta}>
                {matchPlace.typeLabel}
                {matchPlace.rating != null ? ` · ★ ${matchPlace.rating.toFixed(1)}` : ''}
                {matchPlace.priceLabel ? ` · ${matchPlace.priceLabel}` : ''}
                {matchPlace.distanceM != null ? ` · ${formatDistance(matchPlace.distanceM)}` : ''}
              </div>
              <div style={styles.resultAddress}>{matchPlace.address}</div>

              <button onClick={openPlace} style={styles.primaryBtnBig}>Открыть в Google Maps</button>
              <button onClick={finishAndReset} style={styles.secondaryBtn}>Завершить</button>
            </>
          ) : (
            <>
              <div style={styles.resultEmoji}>🤷</div>
              <div style={styles.resultTitle}>Совпадений нет</div>
              <div style={styles.resultSub}>
                Вы не сошлись на этих местах. Ничего страшного — попробуйте другой набор с новыми фильтрами.
              </div>
              <button onClick={finishAndReset} style={styles.primaryBtnBig}>Новый подбор</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function getEmoji(typeLabel: string | null): string {
  const map: Record<string, string> = {
    'Ресторан': '🍽️',
    'Кафе': '☕️',
    'Пекарня': '🥐',
    'Бар': '🍸',
    'Парк': '🌳',
    'Сад': '🌷',
    'Пляж': '🏖️',
    'Музей': '🏛️',
    'Галерея': '🖼️',
    'Театр': '🎭',
    'Библиотека': '📚',
    'Кинотеатр': '🎬',
    'Боулинг': '🎳',
    'Парк развлечений': '🎢',
    'Аквариум': '🦈',
    'Аркада': '🕹️',
    'Стадион': '🏟️',
    'Фитнес': '💪',
    'СПА': '🧖',
  };
  return typeLabel ? (map[typeLabel] ?? '📍') : '📍';
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: 16,
    maxWidth: 480,
    margin: '0 auto',
    minHeight: '100vh',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 44,
    position: 'relative',
  },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--ink)',
    zIndex: 1,
    pointerEvents: 'none',
  },
  errorBanner: {
    background: 'var(--secondary-bg)',
    borderRadius: 14,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    lineHeight: '18px',
    color: 'var(--error-deep)',
  },
  errorLink: {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    color: 'var(--primary)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  },
  locationCard: {
    background: 'var(--surface-card)',
    borderRadius: 18,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  locationDesc: {
    fontSize: 13,
    lineHeight: '19px',
    color: 'var(--mute)',
  },
  locationRefresh: {
    background: 'none',
    border: 'none',
    color: 'var(--primary)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    padding: 0,
    marginLeft: 8,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  sectionHint: {
    fontWeight: 400,
    color: 'var(--stone)',
    fontSize: 11,
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    padding: '8px 12px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    border: '1px solid var(--hairline)',
    cursor: 'pointer',
    transition: 'background 120ms ease, color 120ms ease',
  },
  primaryBtn: {
    width: '100%',
    height: 44,
    borderRadius: 999,
    background: 'var(--primary)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
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
    marginTop: 2,
  },
  secondaryBtn: {
    width: '100%',
    height: 44,
    borderRadius: 999,
    background: 'var(--secondary-bg)',
    color: 'var(--ink)',
    fontSize: 14,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    background: 'var(--surface-card)',
    borderRadius: 16,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ink)',
  },
  switch: {
    cursor: 'pointer',
    display: 'flex',
  },
  switchTrack: {
    width: 40,
    height: 24,
    borderRadius: 999,
    display: 'block',
    position: 'relative',
    transition: 'background 150ms ease',
  },
  switchThumb: {
    position: 'absolute',
    top: 2,
    left: 0,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
    transition: 'transform 150ms ease',
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--mute)',
  },
  progressDots: {
    display: 'flex',
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  card: {
    background: 'var(--surface-card)',
    borderRadius: 22,
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
  },
  cardImage: {
    width: '100%',
    height: 190,
    objectFit: 'cover',
    background: 'linear-gradient(180deg, #ffe3c2, #ffcf9a)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImageEmoji: {
    fontSize: 64,
  },
  cardBody: {
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardName: {
    fontSize: 19,
    fontWeight: 700,
    color: 'var(--ink)',
    flex: 1,
  },
  rating: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--ink)',
    whiteSpace: 'nowrap',
  },
  tagsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 8px',
    borderRadius: 999,
    background: 'var(--secondary-bg)',
    color: 'var(--mute)',
  },
  cardAddress: {
    fontSize: 12,
    color: 'var(--ash)',
    lineHeight: '17px',
  },
  partnerLike: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--error-deep)',
    background: 'var(--grad-heart)',
    padding: '8px 12px',
    borderRadius: 12,
    textAlign: 'center',
  },
  partnerPass: {
    fontSize: 12,
    color: 'var(--ash)',
    background: 'var(--secondary-bg)',
    padding: '8px 12px',
    borderRadius: 12,
    textAlign: 'center',
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 24,
  },
  noBtn: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    fontSize: 24,
    cursor: 'pointer',
  },
  likeBtn: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'var(--primary)',
    border: 'none',
    fontSize: 26,
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(230, 0, 35, 0.35)',
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
  resultCard: {
    background: 'var(--surface-card)',
    borderRadius: 22,
    padding: '24px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    textAlign: 'center',
    alignItems: 'center',
  },
  resultEmoji: {
    fontSize: 52,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--ink)',
  },
  resultSub: {
    fontSize: 13,
    lineHeight: '19px',
    color: 'var(--mute)',
  },
  resultImage: {
    width: '100%',
    height: 160,
    objectFit: 'cover',
    borderRadius: 16,
    marginTop: 4,
  },
  resultPlaceName: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  resultPlaceMeta: {
    fontSize: 13,
    color: 'var(--mute)',
  },
  resultAddress: {
    fontSize: 12,
    color: 'var(--ash)',
    lineHeight: '17px',
    marginBottom: 6,
  },
};