import { CSSProperties, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { setMainButton, setBackButton, hapticFeedback } from '../utils/telegram';
import { BackButton } from '../components/BackButton';
import type { MovieListItem, PoiskkinoCandidate, PoiskkinoPart, MovieReview } from '../types';

type Tab = 'watch' | 'watched';
const ASPECTS = [
  { key: 'visuals', label: 'Картинка' },
  { key: 'plot', label: 'Сюжет' },
  { key: 'acting', label: 'Акт. игра' },
  { key: 'music', label: 'Музыка' },
  { key: 'atmosphere', label: 'Атмосфера' },
  { key: 'humor', label: 'Юмор' },
] as const;

const ASPECT_LABELS: Record<string, string> = {
  visual: 'Картинка',
  plot: 'Сюжет',
  acting: 'Актёры',
  music: 'Музыка',
  atmosphere: 'Атмосфера',
  humor: 'Юмор',
};

function myReview(movie: MovieListItem, myId: number | null): MovieReview | undefined {
  if (!myId) return undefined;
  return movie.reviews.find((r) => r.author_telegram_id === myId);
}
function partnerReview(movie: MovieListItem, myId: number | null): MovieReview | undefined {
  if (!myId) return undefined;
  return movie.reviews.find((r) => r.author_telegram_id !== myId);
}

export function MoviesScreen() {
  const navigate = useNavigate();
  const {
    movies, fetchMovies, deleteMovie, markMovieWatched,
    shareMovie, getMovieInsight, getEveningPick,
  } = useValentinesStore();
  const { currentUser } = useValentinesStore();
  const myId = currentUser?.id ?? null;

  const [tab, setTab] = useState<Tab>('watch');
  const [showSearch, setShowSearch] = useState(false);
  const [showReview, setShowReview] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState<MovieListItem | null>(null);
  const [eveningMovie, setEveningMovie] = useState<MovieListItem | null>(null);
  const [eveningError, setEveningError] = useState<string | null>(null);
  const [eveningLoading, setEveningLoading] = useState(false);

  useEffect(() => {
    void fetchMovies();
    setBackButton(true, () => {
      if (window.history.length > 1) navigate(-1);
      else navigate('/');
    });
    setMainButton({ isVisible: false });
    return () => setBackButton(false);
  }, [fetchMovies, navigate]);

  const wantToWatch = movies.filter((m) => m.status === 'want_to_watch');
  const watched = movies.filter((m) => m.status === 'watched');
  const activeMovies = tab === 'watch' ? wantToWatch : watched;

  const handleEvening = async () => {
    if (eveningLoading) return;
    setEveningLoading(true);
    setEveningError(null);
    const store = useValentinesStore.getState();
    store.clearError();
    const pick = await getEveningPick();
    const serverError = useValentinesStore.getState().error;
    setEveningLoading(false);
    if (pick) {
      setEveningMovie(pick);
      hapticFeedback('notification', 'success');
    } else {
      setEveningError(
        serverError || (movies.length === 0 ? 'Список пуст — добавьте фильм через поиск' : 'Не удалось выбрать фильм, попробуйте ещё раз')
      );
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>Фильмы</span>
      </div>

      <div style={styles.tabs}>
        {(
          [
            { key: 'watch', label: `Хочу (${wantToWatch.length})` },
            { key: 'watched', label: `Просмотрено (${watched.length})` },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setEveningMovie(null); hapticFeedback('selection'); }}
            style={{
              ...styles.tabBtn,
              background: tab === t.key ? 'var(--ink)' : 'transparent',
              color: tab === t.key ? '#fff' : 'var(--ink-secondary)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={styles.actionsRow}>
        <button onClick={() => setShowSearch(true)} style={styles.actionBtn}>
          🎬 Найти фильм
        </button>
        <button onClick={() => void handleEvening()} disabled={eveningLoading} style={styles.actionBtn}>
          {eveningLoading ? '⏳ Выбираем…' : '🎲 На вечер'}
        </button>
        <button onClick={() => navigate('/movies/taste')} style={styles.actionBtn}>
          🎚️ Мой вкус
        </button>
      </div>

      {eveningError && (
        <div style={styles.eveningError}>
          <p style={styles.eveningErrorText}>{eveningError}</p>
        </div>
      )}

      {eveningMovie && (
        <div style={styles.eveningCard}>
          <p style={styles.eveningTitle}>Случайный фильм на вечер:</p>
          <p style={styles.eveningName}>
            {eveningMovie.title}{eveningMovie.year ? ` (${eveningMovie.year})` : ''}
          </p>
          {eveningMovie.description && <p style={styles.eveningPlot}>{eveningMovie.description}</p>}
          <button onClick={() => { setEveningMovie(null); }} style={styles.eveningClose}>Закрыть</button>
        </div>
      )}

      {activeMovies.length === 0 && (
        <p style={styles.empty}>
          {tab === 'watch' ? 'Список пуст — найдите фильм через поиск 👇' : 'Пока ничего не просмотрено'}
        </p>
        )}

      {activeMovies.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          myId={myId}
          onOpenDetail={() => { setShowDetail(movie); hapticFeedback('selection'); }}
          onMarkWatched={() => { void markMovieWatched(movie.id); hapticFeedback('notification', 'success'); }}
          onOpenReview={() => { setShowReview(movie.id); hapticFeedback('selection'); }}
          onDelete={() => { void deleteMovie(movie.id); hapticFeedback('notification', 'error'); }}
          onShare={() => { void shareMovie(movie.id); hapticFeedback('notification', 'success'); }}
          onGetInsight={getMovieInsight}
        />
      ))}

      {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}
      {showReview && <ReviewOverlay movieId={showReview} onClose={() => setShowReview(null)} />}
      {showDetail && <DetailOverlay movie={showDetail} onClose={() => setShowDetail(null)} />}
    </div>
  );
}

function MovieCard({
  movie,
  myId,
  onOpenDetail,
  onMarkWatched,
  onOpenReview,
  onDelete,
  onShare,
  onGetInsight,
}: {
  movie: MovieListItem;
  myId: number | null;
  onOpenDetail: () => void;
  onMarkWatched: () => void;
  onOpenReview: () => void;
  onDelete: () => void;
  onShare: () => void;
  onGetInsight: (id: string) => Promise<Record<string, unknown> | null>;
}) {
  const [insight, setInsight] = useState<Record<string, unknown> | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const mine = myReview(movie, myId);
  const partner = partnerReview(movie, myId);
  const bothReviewed = !!mine && !!partner;

  useEffect(() => {
    if (!bothReviewed) return;
    setLoadingInsight(true);
    void onGetInsight(movie.id).then((r) => { setInsight(r); setLoadingInsight(false); });
  }, [bothReviewed, movie.id]);

  return (
    <div style={styles.card} onClick={onOpenDetail}>
      <div style={styles.cardHeader}>
        {movie.poster_url ? (
          <img src={movie.poster_url} alt="" style={styles.poster} />
        ) : (
          <div style={styles.posterFallback}>🎬</div>
        )}
        <div style={styles.cardInfo}>
          <span style={styles.cardTitle}>
            {movie.title}{movie.year ? <span style={styles.cardYear}> ({movie.year})</span> : null}
          </span>
          {movie.genre && <p style={styles.cardMeta}>{movie.genre}</p>}
          {movie.rating && <p style={styles.cardMeta}>⭐ {movie.rating}</p>}
          <p style={styles.cardMeta}>Добавил(а): {movie.added_by_name ?? 'Партнер'}</p>
        </div>
      </div>

      {movie.description && <p style={styles.cardPlot}>{movie.description.length > 200 ? `${movie.description.slice(0, 200)}…` : movie.description}</p>}

      {movie.taste_match != null && (
        <div style={styles.tasteBadge}>
          🎯 Ваше совпадение: <strong>{movie.taste_match}%</strong>
        </div>
      )}

      {mine && (
        <div style={styles.reviewBadge}>
          ✅ Ваш отзыв
        </div>
      )}
      {!mine && partner && (
        <div style={styles.reviewBadgePending}>
          ⏳ Партнёр уже оставил отзыв
        </div>
      )}

      {bothReviewed && (
        <InsightBlock insight={insight} loading={loadingInsight} />
      )}

      <div style={styles.cardActions} onClick={(e) => e.stopPropagation()}>
        {movie.status === 'want_to_watch' && (
          <button onClick={onMarkWatched} style={styles.cardBtn}>🍿 Смотрели</button>
        )}
        {movie.status === 'watched' && !mine && (
          <button onClick={onOpenReview} style={styles.cardBtn}>✍️ Написать отзыв</button>
        )}
        <button onClick={onShare} style={styles.cardBtnSecondary}>📨 Партнёру</button>
        <button onClick={onDelete} style={styles.cardBtnDanger}>✕</button>
      </div>
    </div>
  );
}

function InsightBlock({ insight, loading }: { insight: Record<string, unknown> | null; loading: boolean }) {
  if (loading) return <p style={styles.insightLoading}>Загружаем анализ…</p>;
  if (!insight) return null;
  const i = insight as Record<string, any>;
  return (
    <div style={styles.insight}>
      {i.compatibility_percent != null && (
        <div style={styles.compatBadge}>
          Совпадение вкусов: <strong>{i.compatibility_percent}%</strong>
        </div>
      )}
      {i.summary && <p style={styles.insightText}>{i.summary}</p>}
      {i.verdict && i.verdict !== i.summary && <p style={styles.insightText}>{i.verdict}</p>}
      {Array.isArray(i.common_points) && i.common_points.length > 0 && (
        <p style={styles.insightSection}>Общее: {i.common_points.join('; ')}</p>
      )}
      {Array.isArray(i.disagreements) && i.disagreements.length > 0 && (
        <p style={styles.insightSection}>Разногласия: {i.disagreements.join('; ')}</p>
      )}
      {Array.isArray(i.liked) && i.liked.length > 0 && (
        <p style={styles.insightSection}>
          Понравилось: {i.liked.map((l: any) => `${l.who ? `${l.who}: ` : ''}${l.what}`).join('; ')}
        </p>
      )}
      {Array.isArray(i.disliked) && i.disliked.length > 0 && (
        <p style={styles.insightSection}>
          Не понравилось: {i.disliked.map((d: any) => `${d.who ? `${d.who}: ` : ''}${d.what}`).join('; ')}
        </p>
      )}
      {Array.isArray(i.similar_movies) && i.similar_movies.length > 0 && (
        <p style={styles.insightSection}>
          Похожие: {i.similar_movies.map((m: any) => `${m.title}${m.year ? ` (${m.year})` : ''}`).join(', ')}
        </p>
      )}
    </div>
  );
}

function DetailOverlay({ movie, onClose }: { movie: MovieListItem; onClose: () => void }) {
  return (
    <div style={styles.detailOverlay} onClick={onClose}>
      <div style={styles.detailCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.detailHeader}>
          {movie.poster_url ? (
            <img src={movie.poster_url} alt="" style={styles.detailPoster} />
          ) : (
            <div style={styles.detailPoster}>🎬</div>
          )}
          <div style={styles.detailInfo}>
            <p style={styles.detailTitle}>
              {movie.title}{movie.year ? <span style={styles.cardYear}> ({movie.year})</span> : null}
            </p>
            {movie.genre && <p style={styles.detailMeta}>{movie.genre}</p>}
            {movie.rating && <p style={styles.detailMeta}>⭐ Рейтинг: {movie.rating}</p>}
            {movie.added_by_name && <p style={styles.detailMeta}>Добавил(а): {movie.added_by_name}</p>}
          </div>
        </div>

        {movie.description && (
          <div style={styles.detailSection}>
            <p style={styles.detailSectionTitle}>Описание</p>
            <p style={styles.detailText}>{movie.description}</p>
          </div>
        )}

        {movie.taste_match != null && (
          <div style={styles.tasteBadgeFull}>
            🎯 Ваше совпадение: <strong>{movie.taste_match}%</strong>
          </div>
        )}

        {movie.aspect_scores && (
          <div style={styles.detailSection}>
            <p style={styles.detailSectionTitle}>Сильные стороны фильма</p>
            <div style={styles.aspectGrid}>
              {Object.entries(movie.aspect_scores)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([key, val]) => (
                  <span key={key} style={styles.aspectChip}>
                    {ASPECT_LABELS[key] ?? key}: <strong>{val}/5</strong>
                  </span>
                ))}
            </div>
          </div>
        )}

        <div style={styles.detailStatus}>
          {movie.status === 'want_to_watch' ? '📌 В планах посмотреть' : '🍿 Уже смотрели'}
        </div>

        <button onClick={onClose} style={styles.detailClose}>Закрыть</button>
      </div>
    </div>
  );
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { searchMovies, movieSearchResults, movieSearchLoading, getMovieParts, addMovie, addMoviesBatch } = useValentinesStore();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState<number | null>(null);
  const [partsPicker, setPartsPicker] = useState<PoiskkinoCandidate | null>(null);
  const [partsList, setPartsList] = useState<PoiskkinoPart[]>([]);
  const [selectedParts, setSelectedParts] = useState<number[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = (q: string) => {
    setQuery(q);
    clearTimeout(timer.current);
    if (!q.trim()) { void searchMovies(''); return; }
    timer.current = setTimeout(() => void searchMovies(q), 350);
  };

  const handlePick = async (candidate: PoiskkinoCandidate) => {
    setAdding(candidate.kp_id);
    const parts = await getMovieParts(candidate.kp_id);
    setAdding(null);
    if (parts && parts.length > 0) {
      setPartsList(parts);
      setPartsPicker(candidate);
      setSelectedParts(parts.map((p) => p.kp_id));
      return;
    }
    await addMovie({ kp_id: candidate.kp_id, title: candidate.name || candidate.alternative_name || undefined, year: candidate.year || undefined });
    onClose();
    hapticFeedback('notification', 'success');
  };

  const togglePart = (kpId: number) => {
    setSelectedParts((prev) =>
      prev.includes(kpId) ? prev.filter((id) => id !== kpId) : [...prev, kpId]
    );
  };

  const handleAddSelected = async () => {
    setPartsLoading(true);
    const items = [partsPicker, ...partsList]
      .filter((p): p is PoiskkinoCandidate | PoiskkinoPart => !!p)
      .filter((p) => selectedParts.includes(p.kp_id))
      .map((p) => ({ kp_id: p.kp_id, title: p.name || p.alternative_name || undefined, year: p.year || undefined }));
    const added = await addMoviesBatch(items);
    setPartsLoading(false);
    onClose();
    if (added !== null && added > 0) hapticFeedback('notification', 'success');
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.overlayCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.topBar}>
          <BackButton />
          <span style={styles.title}>Найти фильм</span>
        </div>
        <input
          value={query}
          onChange={(e) => doSearch(e.target.value)}
          placeholder="Название фильма (RU или EN)…"
          autoFocus
          style={styles.searchInput}
        />
        {movieSearchLoading && <p style={styles.empty}>Ищем…</p>}
        {!movieSearchLoading && movieSearchResults.length === 0 && query.length >= 2 && (
          <p style={styles.empty}>Ничего не найдено</p>
        )}
        <div style={styles.results}>
          {movieSearchResults.map((r) => (
            <button
              key={r.kp_id}
              onClick={() => void handlePick(r)}
              disabled={adding !== null}
              style={styles.resultBtn}
            >
              {r.poster_url ? (
                <img src={r.poster_url} alt="" style={styles.resultPoster} />
              ) : (
                <div style={styles.resultPosterFallback}>🎬</div>
              )}
              <div style={{ flex: 1 }}>
                <p style={styles.resultTitle}>{r.name || r.alternative_name || 'Без названия'}</p>
                {r.alternative_name && r.name && r.alternative_name !== r.name && (
                  <p style={styles.resultAltName}>{r.alternative_name}</p>
                )}
                <p style={styles.resultMeta}>
                  {r.year && `${r.year}`}
                  {r.rating_kp && ` · КП ${r.rating_kp}`}
                  {r.rating_imdb && ` · IMDb ${r.rating_imdb}`}
                  {r.genres?.length > 0 && ` · ${r.genres.slice(0, 2).join(', ')}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {partsPicker && (
        <div style={styles.overlay} onClick={onClose}>
          <div style={styles.overlayCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.topBar}>
              <BackButton />
              <span style={styles.title}>Части фильма</span>
            </div>
            <p style={styles.empty}>
              У «{partsPicker.name || partsPicker.alternative_name}» есть части. Отметьте, что добавить:
            </p>
            <div style={styles.results}>
              {[partsPicker, ...partsList].map((p) => {
                const checked = selectedParts.includes(p.kp_id);
                return (
                  <button key={p.kp_id} onClick={() => togglePart(p.kp_id)} style={styles.partCheckBtn}>
                    <span style={{ ...styles.checkbox, background: checked ? 'var(--ink)' : 'transparent' }}>
                      {checked ? '✓' : ''}
                    </span>
                    <span style={{ flex: 1 }}>
                      <p style={styles.resultTitle}>{p.name || p.alternative_name || 'Без названия'}</p>
                      {p.alternative_name && p.name && p.alternative_name !== p.name && (
                        <p style={styles.resultAltName}>{p.alternative_name}</p>
                      )}
                      <p style={styles.resultMeta}>
                        {p.year && `${p.year}`}
                        {p.rating_imdb && ` · IMDb ${p.rating_imdb}`}
                        {p.kp_id === partsPicker.kp_id ? ' · (выбран фильм)' : ''}
                      </p>
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => void handleAddSelected()}
              disabled={selectedParts.length === 0 || partsLoading}
              style={styles.saveBtn}
            >
              {partsLoading ? 'Добавляем…' : `Добавить выбранные (${selectedParts.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewOverlay({ movieId, onClose }: { movieId: string; onClose: () => void }) {
  const { addMovieReview } = useValentinesStore();
  const [values, setValues] = useState({ visuals: 3, plot: 3, acting: 3, music: 3, atmosphere: 3, humor: 3 });
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const setVal = (key: keyof typeof values, v: number) => setValues((prev) => ({ ...prev, [key]: v }));

  const handleSave = async () => {
    setSaving(true);
    await addMovieReview(movieId, { ...values, comment: comment.trim() || null });
    setSaving(false);
    onClose();
    hapticFeedback('notification', 'success');
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.overlayCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.topBar}>
          <BackButton />
          <span style={styles.title}>Ваш отзыв</span>
        </div>
        <div style={styles.reviewForm}>
          {ASPECTS.map((a) => (
            <div key={a.key} style={styles.sliderRow}>
              <span style={styles.sliderLabel}>{a.label}</span>
              <input
                type="range"
                min={1}
                max={5}
                value={values[a.key]}
                onChange={(e) => setVal(a.key, Number(e.target.value))}
                style={styles.slider}
              />
              <span style={styles.sliderVal}>{values[a.key]}</span>
            </div>
          ))}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Комментарий (необязательно)"
            rows={3}
            style={styles.reviewInput}
          />
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            style={styles.saveBtn}
          >
            {saving ? 'Сохраняем…' : 'Сохранить отзыв'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  topBar: { display: 'flex', alignItems: 'center', gap: 8, height: 44, position: 'relative' },
  title: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 18, fontWeight: 700, color: 'var(--ink)', zIndex: 1, pointerEvents: 'none' },
  tabs: { display: 'flex', gap: 6, background: 'var(--surface-card)', borderRadius: 999, padding: 4 },
  tabBtn: { flex: 1, padding: '9px 4px', borderRadius: 999, fontSize: 13, fontWeight: 600, transition: 'background .2s ease' },
  actionsRow: { display: 'flex', gap: 8 },
  actionBtn: {
    flex: 1, padding: '12px', borderRadius: 14, background: 'var(--surface-card)',
    border: '1px solid var(--hairline)', fontSize: 14, fontWeight: 600, color: 'var(--ink)',
  },
  empty: { textAlign: 'center', color: 'var(--ink-secondary)', fontSize: 14, padding: '24px 0' },

  eveningCard: {
    background: '#fff3c4', borderRadius: 16, padding: '14px 16px', border: '1px solid #ffe27a',
  },
  eveningTitle: { fontSize: 13, color: '#8a6e00', marginBottom: 4 },
  eveningName: { fontSize: 17, fontWeight: 700, color: '#5c4600', marginBottom: 4 },
  eveningPlot: { fontSize: 13, color: '#6b5a20', lineHeight: 1.4, marginBottom: 8 },
  eveningClose: {
    width: '100%', padding: '10px', borderRadius: 999, background: '#c59e1a',
    color: '#fff', fontWeight: 700, fontSize: 14,
  },
  eveningError: {
    background: '#fdecec', borderRadius: 12, padding: '10px 14px', border: '1px solid #fcc',
  },
  eveningErrorText: { fontSize: 13, color: '#b33', fontWeight: 600 },

  card: {
    background: 'var(--surface-card)', borderRadius: 18, padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--hairline)',
    cursor: 'pointer', transition: 'border-color .2s ease, box-shadow .2s ease',
  },
  cardHeader: { display: 'flex', gap: 12 },
  poster: { width: 64, height: 96, borderRadius: 10, objectFit: 'cover' },
  posterFallback: {
    width: 64, height: 96, borderRadius: 10, background: 'var(--secondary-bg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
  },
  cardInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 },
  cardYear: { fontWeight: 400, color: 'var(--ink-secondary)' },
  cardMeta: { fontSize: 13, color: 'var(--ink-secondary)' },
  cardPlot: { fontSize: 14, color: 'var(--ink-secondary)', lineHeight: 1.4 },

  tasteBadge: {
    padding: '6px 12px', borderRadius: 999, background: '#e6ecff', color: '#2b4bd6',
    fontSize: 13, fontWeight: 600, alignSelf: 'flex-start',
  },
  tasteBadgeFull: {
    textAlign: 'center', padding: '10px', borderRadius: 14, background: '#e6ecff',
    color: '#2b4bd6', fontSize: 15, fontWeight: 600,
  },
  aspectGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  aspectChip: {
    padding: '5px 10px', borderRadius: 999, background: 'var(--secondary-bg)',
    fontSize: 13, color: 'var(--ink)', fontWeight: 500,
  },

  detailOverlay: {
    position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(255,255,255,.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', backdropFilter: 'blur(4px)',
  },
  detailCard: {
    width: '100%', maxWidth: 420, maxHeight: '82vh', overflowY: 'auto',
    background: '#fff', borderRadius: 20,
    padding: '20px 18px 24px', display: 'flex', flexDirection: 'column', gap: 14,
    border: '1px solid var(--hairline)', boxShadow: '0 12px 40px rgba(0,0,0,.18)',
  },
  detailHeader: { display: 'flex', gap: 14 },
  detailPoster: {
    width: 100, height: 150, borderRadius: 12, objectFit: 'cover', flexShrink: 0,
    background: 'var(--secondary-bg)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 40,
  },
  detailInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  detailTitle: { fontSize: 19, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 },
  detailMeta: { fontSize: 13, color: 'var(--ink-secondary)' },
  detailSection: { display: 'flex', flexDirection: 'column', gap: 6 },
  detailSectionTitle: { fontSize: 14, fontWeight: 700, color: 'var(--ink)' },
  detailText: { fontSize: 14, color: 'var(--ink-secondary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' },
  detailStatus: {
    padding: '8px 12px', borderRadius: 999, background: 'var(--secondary-bg)',
    fontSize: 13, fontWeight: 600, color: 'var(--ink)', alignSelf: 'flex-start',
  },
  detailClose: {
    padding: '14px', borderRadius: 999, background: 'var(--ink)', color: '#fff',
    fontSize: 15, fontWeight: 700, border: 'none', width: '100%',
  },

  reviewBadge: {
    padding: '6px 12px', borderRadius: 999, background: '#d8f0dc', color: '#0a5c1e',
    fontSize: 13, fontWeight: 600, alignSelf: 'flex-start',
  },
  reviewBadgePending: {
    padding: '6px 12px', borderRadius: 999, background: '#fff3c4', color: '#8a6e00',
    fontSize: 13, fontWeight: 600, alignSelf: 'flex-start',
  },

  insight: {
    background: 'var(--secondary-bg)', borderRadius: 14, padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  insightLoading: { fontSize: 13, color: 'var(--ink-secondary)', fontStyle: 'italic' },
  compatBadge: {
    display: 'inline-flex', padding: '5px 10px', borderRadius: 999,
    background: '#d8f0dc', color: '#0a5c1e', fontSize: 13, fontWeight: 600, alignSelf: 'flex-start',
  },
  insightText: { fontSize: 14, lineHeight: 1.4, color: 'var(--ink)' },
  insightSection: { fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.3 },

  cardActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  cardBtn: {
    padding: '10px 14px', borderRadius: 999, background: 'var(--ink)', color: '#fff',
    fontSize: 14, fontWeight: 600, border: 'none',
  },
  cardBtnSecondary: {
    padding: '10px 14px', borderRadius: 999, background: 'var(--secondary-bg)', color: 'var(--ink)',
    fontSize: 14, fontWeight: 600, border: '1px solid var(--hairline)',
  },
  cardBtnDanger: {
    padding: '10px 14px', borderRadius: 999, background: 'transparent', color: '#b33',
    fontSize: 14, fontWeight: 600, border: '1px solid #fcc',
  },

  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'flex-end', zIndex: 1000,
  },
  overlayCard: {
    width: '100%', maxHeight: '85vh', background: 'var(--surface-card)',
    borderRadius: '20px 20px 0 0', padding: '12px 16px 24px', overflowY: 'auto',
  },

  searchInput: {
    width: '100%', padding: '12px', borderRadius: 14, border: '1px solid var(--hairline)',
    background: 'var(--surface-elevated)', color: 'var(--ink)', fontSize: 15, marginBottom: 10,
  },
  results: { display: 'flex', flexDirection: 'column', gap: 6 },
  resultBtn: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px', borderRadius: 14,
    background: 'var(--surface-elevated)', border: '1px solid var(--hairline)', textAlign: 'left',
  },
  resultPoster: { width: 40, height: 60, borderRadius: 6, objectFit: 'cover' },
  resultPosterFallback: {
    width: 40, height: 60, borderRadius: 6, background: 'var(--secondary-bg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
  },
  resultTitle: { fontSize: 14, fontWeight: 600, color: 'var(--ink)' },
  resultAltName: { fontSize: 12, color: 'var(--ink-secondary)', fontStyle: 'italic' },
  resultMeta: { fontSize: 12, color: 'var(--ink-secondary)' },
  partCheckBtn: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px', borderRadius: 14,
    background: 'var(--surface-elevated)', border: '1px solid var(--hairline)', textAlign: 'left',
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, border: '2px solid var(--hairline)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0,
  },

  reviewForm: { display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 },
  sliderRow: { display: 'flex', alignItems: 'center', gap: 10 },
  sliderLabel: { width: 90, fontSize: 13, color: 'var(--ink-secondary)', whiteSpace: 'nowrap' },
  slider: { flex: 1, accentColor: 'var(--ink)' },
  sliderVal: { width: 24, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--ink)' },
  reviewInput: {
    resize: 'none', fontSize: 15, lineHeight: 1.5, color: 'var(--ink)',
    borderRadius: 14, padding: '10px 12px', border: '1px solid var(--hairline)',
    background: 'var(--surface-elevated)',
  },
  saveBtn: {
    padding: '14px', borderRadius: 999, background: 'var(--ink)', color: '#fff',
    fontSize: 15, fontWeight: 700, border: 'none',
  },
};
