import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore, partnerName } from '../hooks/useValentinesStore';
import { api } from '../api/client';
import { setMainButton, setBackButton, hapticFeedback, webApp } from '../utils/telegram';
import { BackButton } from '../components/BackButton';

function InitialAvatar({ name, size }: { name: string; size: number }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div
      style={{
        ...styles.initialAvatar,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {letter}
    </div>
  );
}

export function ProfileScreen() {
  const navigate = useNavigate();
  const { profile, partnerProfile, pair, currentUser, fetchProfile, updateMyName, updatePartnerName, androidPaired, refreshPairingStatus } =
    useValentinesStore();

  const [myName, setMyName] = useState('');
  const [partnerNameLocal, setPartnerNameLocal] = useState('');
  const [isSavingMy, setIsSavingMy] = useState(false);
  const [isSavingPartner, setIsSavingPartner] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true);
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile && myName === '') setMyName(profile.display_name ?? profile.first_name ?? '');
    if (pair && partnerProfile) {
      const current = partnerName(pair, currentUser?.id ?? null);
      if (partnerNameLocal === '') setPartnerNameLocal(current);
    }
  }, [profile, partnerProfile]);

  const saveMyName = async () => {
    if (!myName.trim()) return;
    setIsSavingMy(true);
    setMessage(null);
    const ok = await updateMyName(myName.trim());
    setIsSavingMy(false);
    if (ok) {
      hapticFeedback('notification', 'success');
      setMessage('Имя обновлено, партнёр увидит его');
    } else {
      setMessage('Не удалось обновить имя');
    }
  };

  const savePartnerName = () => {
    setIsSavingPartner(true);
    updatePartnerName(partnerNameLocal.trim());
    setIsSavingPartner(false);
    hapticFeedback('notification', 'success');
    setMessage('Имя партнёра обновлено (только у вас)');
  };

  const isAndroid =
    webApp?.platform === 'android' || webApp?.platform === 'android_x';

  const meAvatar = profile ? api.selfAvatarUrl(profile.id) : null;
  const partnerAvatar = partnerProfile ? api.avatarUrl(partnerProfile.id) : null;

  return (
    <div style={styles.container}>
      <BackButton to="/" />
      {message && <p style={styles.toast}>{message}</p>}

      <div style={styles.avatarRow}>
        <div style={styles.avatarWrap}>
          <InitialAvatar name={profile?.display_name ?? profile?.first_name ?? 'Вы'} size={64} />
          {meAvatar && (
            <img
              src={meAvatar}
              alt=""
              style={styles.avatar}
              onLoad={(e) => ((e.target as HTMLImageElement).style.opacity = '1')}
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            />
          )}
        </div>
        <div style={styles.identity}>
          <div style={styles.nameBold}>
            {profile?.display_name ?? profile?.first_name ?? 'Вы'}
          </div>
          {profile?.username && <div style={styles.username}>@{profile.username}</div>}
        </div>
      </div>

      <div style={styles.section}>
        <p style={styles.sectionLabel}>Моё имя (видно партнёру)</p>
        <input
          value={myName}
          maxLength={50}
          onChange={(e) => setMyName(e.target.value)}
          style={styles.input}
          placeholder="Моё имя"
        />
        <button onClick={saveMyName} disabled={isSavingMy} style={styles.saveButton}>
          {isSavingMy ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>

      {partnerProfile && (
        <div style={styles.section}>
          <p style={styles.sectionLabel}>Имя партнёра (только у вас)</p>
          <div style={styles.partnerWrap}>
            <div style={{ ...styles.avatarWrap, width: '40px', height: '40px' }}>
              <InitialAvatar name={partnerProfile?.display_name ?? 'Партнёр'} size={40} />
              {partnerAvatar && (
                <img
                  src={partnerAvatar}
                  alt=""
                  style={styles.smallAvatar}
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                />
              )}
            </div>
            <input
              value={partnerNameLocal}
              maxLength={50}
              onChange={(e) => setPartnerNameLocal(e.target.value)}
              style={styles.input}
              placeholder="Имя партнёра"
            />
          </div>
          <button onClick={savePartnerName} disabled={isSavingPartner} style={styles.saveButton}>
            {isSavingPartner ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      )}

      {isAndroid && !androidPaired && (
        <button
          onClick={async () => {
            hapticFeedback('impact', 'light');
            await refreshPairingStatus();
            navigate('/pairing');
          }}
          style={styles.bindButton}
        >
          Привязать к приложению
        </button>
      )}

      {isAndroid && androidPaired && (
        <p style={styles.bindHint}>Приложение уже привязано</p>
      )}

      <button onClick={() => navigate('/pairing')} style={styles.linkButton}>
        Настройка виджета
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    padding: '64px 16px 24px',
    maxWidth: '480px',
    margin: '0 auto',
    flex: 1,
    gap: '12px',
    position: 'relative',
  },
  toast: {
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    borderRadius: '16px',
    padding: '12px 16px',
    fontSize: '14px',
    color: 'var(--ink)',
  },
  avatarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '8px 0 16px',
  },
  avatarWrap: {
    position: 'relative',
    width: '64px',
    height: '64px',
    flexShrink: 0,
    borderRadius: '50%',
    overflow: 'hidden',
  },
  initialAvatar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--primary)',
    color: 'var(--on-primary)',
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    overflow: 'hidden',
  },
  avatar: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'cover',
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    opacity: 0,
    transition: 'opacity 0.2s ease',
  },
  identity: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  nameBold: {
    fontFamily: 'var(--font-display)',
    fontSize: '20px',
    fontWeight: '700',
    color: 'var(--ink)',
    letterSpacing: '-0.5px',
  },
  username: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
  },
  section: {
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    borderRadius: '16px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sectionLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
  },
  input: {
    fontSize: '16px',
    color: 'var(--ink)',
    background: 'transparent',
    width: '100%',
    padding: '6px 0',
    borderBottom: '1px solid var(--hairline)',
    borderRadius: 0,
  },
  saveButton: {
    padding: '0 18px',
    height: '40px',
    background: 'var(--canvas)',
    color: 'var(--ink)',
    borderRadius: '16px',
    border: '1px solid var(--hairline)',
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
    fontSize: '12px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  partnerWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  smallAvatar: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'cover',
    background: 'var(--surface-elevated)',
    border: '1px solid var(--hairline)',
  },
  bindButton: {
    padding: '0 20px',
    height: '44px',
    background: 'var(--primary)',
    color: 'var(--on-primary)',
    borderRadius: '16px',
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
    fontSize: '14px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bindHint: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    padding: '8px',
    fontFamily: 'var(--font-body)',
  },
  linkButton: {
    padding: '0 18px',
    height: '40px',
    background: 'var(--secondary-bg)',
    color: 'var(--ink)',
    borderRadius: '16px',
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
    fontSize: '12px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};