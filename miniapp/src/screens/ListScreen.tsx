import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useValentinesStore, partnerName, daysTogether } from '../hooks/useValentinesStore';
import { setMainButton, hapticFeedback, webApp } from '../utils/telegram';
import { HeartOpenAnimation } from '../components/HeartOpenAnimation';
import { AppleEmoji } from '../components/AppleEmoji';
import { getAnimation } from '../types';
import { api } from '../api/client';

export function ListScreen() {
  const { valentines, isLoading, error, fetchValentines, refreshValentines, markSeen, pair, checkPair, createInvite, joinInvite, profile, androidPaired, refreshPairingStatus } = useValentinesStore();
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setMainButton({ isVisible: false });
  }, []);

  const isAndroid = webApp?.platform === 'android' || webApp?.platform === 'android_x';

  useEffect(() => {
    if (isAndroid) refreshPairingStatus();
  }, [isAndroid, refreshPairingStatus]);

  useEffect(() => {
    if (!inviteCode) return;
    const interval = setInterval(() => {
      checkPair();
    }, 3000);
    return () => clearInterval(interval);
  }, [inviteCode, checkPair]);

  useEffect(() => {
    if (!pair) return;
    const interval = setInterval(() => {
      refreshValentines();
    }, 5000);
    return () => clearInterval(interval);
  }, [pair, refreshValentines]);

  useEffect(() => {
    if (pair) setInviteCode('');
  }, [pair]);

  const received = valentines.filter((v) => !v.is_own);
  const sent = valentines.filter((v) => v.is_own);
  const partner = partnerName(pair, useValentinesStore.getState().currentUser?.id ?? null);
  const days = daysTogether(pair);

  const feed = [...received, ...sent].sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
  );

  if (isLoading && valentines.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Загрузка валентинок...</p>
      </div>
    );
  }

  if (error && !error.toLowerCase().includes('pair not found')) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>{error}</p>
        <button onClick={fetchValentines} style={styles.retryButton}>
          Попробовать снова
        </button>
      </div>
    );
  }

  if (!pair) {
    return (
      <CreatePairForm
        inviteCode={inviteCode}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        isBusy={isBusy}
        error={localError}
        onCreateInvite={async () => {
          setIsBusy(true);
          setLocalError(null);
          const code = await createInvite();
          setIsBusy(false);
          if (code) {
            setInviteCode(code);
            hapticFeedback('notification', 'success');
            navigator.clipboard?.writeText(code);
          } else {
            const currentError = useValentinesStore.getState().error;
            setLocalError(currentError || 'Не удалось создать приглашение. Попробуйте снова.');
          }
        }}
        onJoin={async () => {
          const code = joinCode.trim().toUpperCase();
          if (code.length < 6) {
            setLocalError('Введите код приглашения');
            return;
          }
          setIsBusy(true);
          setLocalError(null);
          const ok = await joinInvite(code);
          setIsBusy(false);
          if (!ok) setLocalError('Код неверный или истёк. Проверьте и попробуйте снова.');
        }}
      />
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.feedHeader}>
        <div style={styles.feedHeaderRow}>
          <h1 style={styles.feedTitle}>Валентинки</h1>
          <button
            onClick={() => navigate('/profile')}
            style={styles.widgetBtn}
            title="Профиль"
          >
            {profile ? (
              <img
                src={api.avatarUrl(profile.id)}
                alt=""
                style={styles.avatarImg}
                onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              />
            ) : (
              <AppleEmoji emoji="👤" size={16} />
            )}
          </button>
        </div>
        <div style={styles.feedSub}>вы и {partner} · {days} {formatDays(days)} вместе</div>
      </header>

      {feed.length > 0 ? (
        <div style={styles.feedColumns}>
          <div style={styles.feedColumn}>
            {feed
              .filter((_, i) => i % 2 === 0)
              .map((valentine, colIndex) => (
                <ValentineCard
                  key={valentine.id}
                  valentine={valentine}
                  isTall={colIndex % 2 === 0}
                  onPress={() => {
                    hapticFeedback('impact', 'light');
                    if (!valentine.seen_at) markSeen(valentine.id);
                    navigate(`/valentine/${valentine.id}`);
                  }}
                />
              ))}
          </div>
          <div style={styles.feedColumn}>
            {feed
              .filter((_, i) => i % 2 === 1)
              .map((valentine, colIndex) => (
                <ValentineCard
                  key={valentine.id}
                  valentine={valentine}
                  isTall={colIndex % 2 === 0}
                  onPress={() => {
                    hapticFeedback('impact', 'light');
                    if (!valentine.seen_at) markSeen(valentine.id);
                    navigate(`/valentine/${valentine.id}`);
                  }}
                />
              ))}
          </div>
        </div>
      ) : (
        <div style={styles.emptyContainer}>
          <div style={styles.emptyIcon}>
            <HeartOpenAnimation size={64} style={{ opacity: 0.3 }} />
          </div>
            <h2 style={styles.emptyTitle}>Валентинок пока нет</h2>
            <p style={styles.emptyText}>Отправьте первую валентинку партнеру — она появится в вашей ленте</p>
            <button
              onClick={() => navigate('/send')}
              style={styles.emptyAction}
            >
              Отправить валентинку
            </button>
        </div>
      )}

      {isAndroid && !androidPaired && (
        <button
          onClick={() => {
            hapticFeedback('impact', 'light');
            navigate('/pairing');
          }}
          style={styles.bindButton}
        >
          Привязать к приложению
        </button>
      )}

      <button
        onClick={() => {
          hapticFeedback('impact', 'light');
          navigate('/send');
        }}
        style={styles.feedFab}
        aria-label="Отправить валентинку"
      >
        ＋
      </button>
    </div>
  );
}

function formatDays(days: number): string {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

function ValentineCard({ valentine, isTall, onPress }: { valentine: any; isTall: boolean; onPress: () => void }) {
  const anim = getAnimation(valentine.animation_type);
  const senderLabel = valentine.is_own ? 'Вы' : valentine.sender_name;
  const isUnread = !valentine.is_own && !valentine.seen_at;
  const gradient = animationGradient(valentine.animation_type);
  const tall = isTall;

  return (
    <Link
      to={`/valentine/${valentine.id}`}
      onClick={onPress}
      style={{ ...styles.feedItem, minHeight: tall ? 196 : 94, background: gradient }}
    >
      <div style={styles.feedEmoji}>
        <AppleEmoji emoji={anim.emoji} size={tall ? 40 : 26} />
      </div>
      <div style={!tall ? styles.feedMetaBottom : styles.feedMetaTop}>
        <span style={styles.overlayPill}>{senderLabel}</span>
        <span style={styles.overlayPill}>{formatFeedTime(valentine.sent_at)}</span>
      </div>
      {isUnread && <span style={styles.feedNewPill}>новое</span>}
      {valentine.is_own && (
        <span style={valentine.seen_at ? styles.feedReadPill : styles.feedUnreadPill}>
          {valentine.seen_at ? '✓ прочитано' : 'не прочитано'}
        </span>
      )}
    </Link>
  );
}

function animationGradient(type: string): string {
  switch (type) {
    case 'sparkle':
      return 'var(--grad-sparkle)';
    case 'moon':
      return 'var(--grad-moon)';
    case 'flame':
      return 'var(--grad-flame)';
    default:
      return 'var(--grad-heart)';
  }
}

function formatFeedTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isSameDay) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 1) return 'вчера';

  const weekdayNames = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  if (diffDays < 7) return weekdayNames[date.getDay()];

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function CreatePairForm({
  inviteCode,
  joinCode,
  setJoinCode,
  isBusy,
  error,
  onCreateInvite,
  onJoin,
}: {
  inviteCode: string;
  joinCode: string;
  setJoinCode: (v: string) => void;
  isBusy: boolean;
  error: string | null;
  onCreateInvite: () => void;
  onJoin: () => void;
}) {
  return (
    <div style={styles.createContainer}>
      <div style={styles.createIcon}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-6.7-4.35-9.83-8.62C.44 9.27 1.55 4.94 5.1 3.89 7.4 3.13 9.95 3.98 12 5.67c2.05-1.69 4.6-2.54 6.9-1.78 3.55 1.05 4.66 5.38 2.93 8.49C18.7 16.65 12 21 12 21z" />
          <path d="M20.5 4.5 3 22" stroke="#333" />
        </svg>
      </div>
      <h2 style={styles.createTitle}>Свяжите вашу пару</h2>

      <div style={styles.inviteSection}>
        <h3 style={styles.sectionLabel}>1. Создать приглашение</h3>
        {!inviteCode ? (
          <button
            onClick={onCreateInvite}
            disabled={isBusy}
            style={{ ...styles.createButton, opacity: isBusy ? 0.6 : 1 }}
          >
            {isBusy ? 'Создание...' : 'Создать код приглашения'}
          </button>
        ) : (
          <div style={styles.inviteCodeBox}>
            <div style={styles.inviteCode} onClick={() => navigator.clipboard?.writeText(inviteCode)}>
              {inviteCode}
            </div>
            <div style={styles.inviteCodeHint}>Код скопирован. Отправьте его партнёру.</div>
          </div>
        )}
      </div>

      <div style={styles.inviteSection}>
        <h3 style={styles.sectionLabel}>2. Или введите код партнёра</h3>
        <div style={styles.createInputWrapper}>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="Код (например ABC123XY)"
            style={styles.createInput}
            autoComplete="off"
            disabled={isBusy}
          />
        </div>
        <button
          onClick={onJoin}
          disabled={isBusy || joinCode.trim().length < 6}
          style={{ ...styles.createButton, opacity: isBusy || joinCode.trim().length < 6 ? 0.6 : 1 }}
        >
          {isBusy ? 'Подключение...' : 'Подключиться'}
        </button>
      </div>

      {error && <p style={styles.createError}>{error}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    maxWidth: '480px',
    margin: '0 auto',
    height: '100vh',
    overflow: 'hidden',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: '16px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '2px solid var(--hairline-soft)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: '24px',
    textAlign: 'center',
    gap: '16px',
  },
  errorText: {
    color: 'var(--text-secondary)',
    fontSize: '16px',
  },
  retryButton: {
    padding: '12px 14px',
    height: '40px',
    background: 'var(--primary)',
    color: 'var(--on-primary)',
    borderRadius: '16px',
    fontWeight: '700',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: '24px',
    textAlign: 'center',
    gap: '16px',
  },
  emptyIcon: {
    color: 'var(--text-faint)',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '22px',
    fontWeight: '600',
    color: 'var(--ink)',
    letterSpacing: '-0.3px',
  },
  emptyText: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    maxWidth: '280px',
    lineHeight: 1.5,
  },
  emptyAction: {
    marginTop: '8px',
    padding: '12px 14px',
    height: '40px',
    background: 'var(--primary)',
    color: 'var(--on-primary)',
    borderRadius: '16px',
    fontWeight: '700',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  feedHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '16px 4px 4px',
  },
  feedHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  widgetBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    overflow: 'hidden',
    padding: 0,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  bindButton: {
    width: '100%',
    maxWidth: '300px',
    padding: '12px 14px',
    height: '40px',
    background: 'var(--secondary-bg)',
    color: 'var(--ink)',
    borderRadius: '16px',
    fontWeight: '700',
    fontSize: '14px',
    margin: '8px auto 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedTitle: {
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
    fontSize: '24px',
    color: 'var(--ink)',
    letterSpacing: '-0.5px',
  },
  feedSub: {
    fontSize: '12px',
    color: 'var(--text-faint)',
  },
  feedColumns: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '14px 0',
    overflowY: 'auto',
    flex: 1,
    minHeight: 0,
  },
  feedColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '12px',
    flex: 1,
    minWidth: 0,
  },
  feedItem: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '12px',
    textDecoration: 'none',
    color: 'inherit',
    borderRadius: '16px',
    border: '1px solid var(--hairline-soft)',
    position: 'relative',
  },
  feedEmoji: {
    alignSelf: 'flex-start',
  },
  feedMetaTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: '6px',
    flexWrap: 'wrap',
  },
  feedMetaBottom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: '6px',
    flexWrap: 'wrap',
  },
  overlayPill: {
    background: 'var(--canvas)',
    color: 'var(--ink)',
    fontSize: '10px',
    fontWeight: '500',
    lineHeight: 1.3,
    letterSpacing: '0.01em',
    padding: '5px 10px',
    borderRadius: '9999px',
    fontFamily: 'var(--font-body)',
  },
  feedNewPill: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'var(--canvas)',
    color: 'var(--primary)',
    fontSize: '10px',
    fontWeight: '700',
    lineHeight: 1.3,
    padding: '5px 10px',
    borderRadius: '9999px',
    fontFamily: 'var(--font-body)',
  },
  feedReadPill: {
    position: 'absolute',
    bottom: '12px',
    right: '12px',
    background: 'var(--canvas)',
    color: 'var(--mute)',
    fontSize: '10px',
    fontWeight: '600',
    lineHeight: 1.3,
    padding: '5px 10px',
    borderRadius: '9999px',
    fontFamily: 'var(--font-body)',
  },
  feedUnreadPill: {
    position: 'absolute',
    bottom: '12px',
    right: '12px',
    background: 'var(--canvas)',
    color: 'var(--ash)',
    fontSize: '10px',
    fontWeight: '600',
    lineHeight: 1.3,
    padding: '5px 10px',
    borderRadius: '9999px',
    fontFamily: 'var(--font-body)',
  },
  feedFab: {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: 'var(--primary)',
    color: 'var(--on-primary)',
    fontSize: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    lineHeight: 1,
    boxShadow: 'var(--shadow-fab)',
  },
  createContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: '24px',
    textAlign: 'center',
  },
  createIcon: {
    color: 'var(--primary)',
    opacity: 0.9,
    marginBottom: '16px',
  },
  createTitle: {
    fontSize: '22px',
    fontWeight: '700',
    marginBottom: '8px',
    color: 'var(--ink)',
    letterSpacing: '-0.3px',
  },
  createText: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    maxWidth: '300px',
    marginBottom: '20px',
  },
  createInputWrapper: {
    width: '100%',
    maxWidth: '300px',
    marginBottom: '12px',
  },
  createInput: {
    width: '100%',
    padding: '11px 15px',
    height: '44px',
    fontSize: '16px',
    textAlign: 'center',
    background: 'var(--canvas)',
    color: 'var(--ink)',
    borderRadius: '16px',
    border: '1px solid var(--ash)',
  },
  createError: {
    fontSize: '13px',
    color: 'var(--error)',
    marginBottom: '12px',
    maxWidth: '300px',
  },
  createButton: {
    width: '100%',
    maxWidth: '300px',
    padding: '12px 14px',
    height: '40px',
    background: 'var(--primary)',
    color: 'var(--on-primary)',
    borderRadius: '16px',
    fontWeight: '700',
    fontSize: '14px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  createHint: {
    marginTop: '16px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    maxWidth: '300px',
    lineHeight: 1.5,
  },
  inviteSection: {
    width: '100%',
    maxWidth: '300px',
    marginBottom: '20px',
  },
  sectionLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    marginBottom: '10px',
    textAlign: 'left',
  },
  inviteCodeBox: {
    textAlign: 'center',
  },
  inviteCode: {
    fontSize: '28px',
    fontWeight: '800',
    letterSpacing: '4px',
    color: 'var(--primary)',
    background: 'var(--surface-card)',
    borderRadius: '16px',
    padding: '14px 16px',
    cursor: 'pointer',
    userSelect: 'all',
    marginBottom: '8px',
    border: '1px solid var(--hairline)',
  },
  inviteCodeHint: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
};