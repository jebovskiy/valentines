import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { Integration } from '../types';
import { setMainButton, setBackButton } from '../utils/telegram';
import { BackButton } from '../components/BackButton';

function isEnabled(id: string): boolean {
  try {
    return localStorage.getItem(`vn_integration_enabled_${id}`) !== '0';
  } catch {
    return true;
  }
}

function setEnabled(id: string, on: boolean): void {
  try {
    localStorage.setItem(`vn_integration_enabled_${id}`, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function SettingsScreen() {
  const navigate = useNavigate();
  const { integrations, fetchIntegrations } = useValentinesStore();
  const [enabled, setEnabledState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void fetchIntegrations();
    setMainButton({ isVisible: false });
    const onBackClick = () => navigate(-1);
    setBackButton(true, onBackClick);
    return () => setBackButton(false);
  }, [fetchIntegrations, navigate]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const i of integrations) next[i.id] = isEnabled(i.id);
    setEnabledState((prev) => ({ ...prev, ...next }));
  }, [integrations]);

  const toggle = (integration: Integration) => {
    const next = !enabled[integration.id];
    setEnabled(integration.id, next);
    setEnabledState((prev) => ({ ...prev, [integration.id]: next }));
  };

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>Настройки</span>
      </div>

      <div style={styles.introCard}>
        <div style={styles.introTitle}>⚡️ Интеграции</div>
        <div style={styles.introText}>
          Подключайте сервисы — с каждым подключением приложение становится умнее:
          лучше подбирает фильмы, места для свиданий и помогает понимать друг друга.
        </div>
      </div>

      {integrations.length === 0 && (
        <div style={styles.empty}>Загружаем интеграции…</div>
      )}

      <div style={styles.list}>
        {integrations.map((integration) => (
          <div key={integration.id} style={styles.card}>
            <div style={styles.cardTop}>
              <span style={styles.icon}>{integration.icon}</span>
              <div style={styles.cardBody}>
                <div style={styles.cardName}>{integration.name}</div>
                <div style={styles.cardDesc}>{integration.description}</div>
              </div>
            </div>

            <div style={styles.capRow}>
              {integration.capabilities.map((cap) => (
                <span key={cap} style={styles.capTag}>{cap}</span>
              ))}
            </div>

            <div style={styles.cardBottom}>
              <span
                style={{
                  ...styles.status,
                  background: integration.connected ? 'var(--success-pale)' : 'var(--secondary-bg)',
                  color: integration.connected ? 'var(--success-deep)' : 'var(--mute)',
                }}
              >
                {integration.connected ? 'Подключено' : 'Не подключено'}
              </span>
              <label style={styles.switch}>
                <span style={styles.switchLabel}>{enabled[integration.id] ? 'Вкл' : 'Выкл'}</span>
                <input
                  type="checkbox"
                  checked={enabled[integration.id] ?? true}
                  onChange={() => toggle(integration)}
                  style={{ display: 'none' }}
                />
                <span
                  style={{
                    ...styles.switchTrack,
                    background: enabled[integration.id] ? 'var(--primary)' : 'var(--stone)',
                  }}
                >
                  <span
                    style={{
                      ...styles.switchThumb,
                      transform: enabled[integration.id] ? 'translateX(18px)' : 'translateX(2px)',
                    }}
                  />
                </span>
              </label>
            </div>

            {!integration.connected && (
              <div style={styles.hint}>
                Ключ интеграции хранится на сервере. Добавьте его в настройках Railway (env).
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={() => navigate('/date')} style={styles.dateBtn}>
        🗺️ Открыть «Куда пойти»
      </button>
    </div>
  );
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
  introCard: {
    background: 'var(--surface-card)',
    borderRadius: 18,
    padding: '16px',
  },
  introTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--ink)',
    marginBottom: 6,
  },
  introText: {
    fontSize: 13,
    lineHeight: '20px',
    color: 'var(--mute)',
  },
  empty: {
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--stone)',
    padding: 24,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  card: {
    background: 'var(--surface-card)',
    borderRadius: 18,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  cardTop: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 26,
    lineHeight: 1,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: '18px',
    color: 'var(--mute)',
    marginTop: 3,
  },
  capRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  capTag: {
    fontSize: 11,
    lineHeight: 1,
    padding: '5px 8px',
    borderRadius: 999,
    background: 'var(--secondary-bg)',
    color: 'var(--mute)',
  },
  cardBottom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    fontSize: 12,
    fontWeight: 600,
    padding: '5px 10px',
    borderRadius: 999,
  },
  switch: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  switchLabel: {
    fontSize: 12,
    color: 'var(--mute)',
  },
  switchTrack: {
    width: 40,
    height: 24,
    borderRadius: 999,
    position: 'relative',
    display: 'block',
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
  hint: {
    fontSize: 11,
    lineHeight: '16px',
    color: 'var(--stone)',
    background: 'var(--surface-soft)',
    borderRadius: 10,
    padding: '8px 10px',
  },
  dateBtn: {
    width: '100%',
    height: 46,
    borderRadius: 999,
    background: 'var(--primary)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    marginTop: 4,
  },
};