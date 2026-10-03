import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { setMainButton, setBackButton } from '../utils/telegram';
import { BackButton } from '../components/BackButton';

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '18px 16px calc(24px + var(--app-safe-bottom))',
    maxWidth: 460,
    margin: '0 auto',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    position: 'relative',
    height: 48,
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
  item: {
    background: 'var(--surface-card)',
    borderRadius: 16,
    padding: '12px 14px',
    border: '1px solid var(--hairline)',
    marginBottom: 10,
  },
  itemTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  itemSub: {
    fontSize: 12,
    color: 'var(--ash)',
  },
  itemCost: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  infoBox: {
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    borderRadius: 14,
    padding: '12px 14px',
    fontSize: 13,
    lineHeight: '19px',
    color: 'var(--ash)',
    marginBottom: 12,
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
    marginTop: 6,
  },
  ghostBtnBig: {
    width: '100%',
    height: 48,
    borderRadius: 999,
    background: 'var(--surface-card)',
    color: 'var(--ink)',
    fontSize: 15,
    fontWeight: 600,
    border: '1px solid var(--hairline)',
    cursor: 'pointer',
    marginTop: 10,
  },
  disabled: {
    opacity: 0.45,
  },
};

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function russianPlural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export function MenuHistoryScreen({ root = false }: { root?: boolean }) {
  const navigate = useNavigate();
  const { menuHistory, menuHistoryLoading, menuLoading, fetchMenuHistory, fetchMenu } = useValentinesStore();
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    setMainButton({ isVisible: false });
    const onBackClick = () => navigate(root ? '/' : '/menu');
    setBackButton(true, onBackClick);
    return () => setBackButton(false);
  }, [navigate, root]);

  useEffect(() => {
    void fetchMenuHistory();
  }, [fetchMenuHistory]);

  const openMenu = async (id: string) => {
    setOpeningId(id);
    const menu = await fetchMenu(id);
    setOpeningId(null);
    if (menu) {
      navigate(`/menu/result?id=${menu.id}`);
    }
  };

  const daysNoun = (n: number) => russianPlural(n, 'блюдо', 'блюда', 'блюд');

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>{root ? 'Меню' : 'Сохранённые меню'}</span>
      </div>

      {menuHistoryLoading && !menuHistory.length && (
        <div style={styles.infoBox}>Загружаем историю…</div>
      )}

      {!menuHistoryLoading && menuHistory.length === 0 && (
        <>
          <div style={styles.infoBox}>
            Пока нет сохранённых подборов. Создайте рацион и нажмите «Сохранить рацион» на экране результата — он появится здесь.
          </div>
          <button onClick={() => navigate(root ? '/menu/store' : '/menu')} style={styles.primaryBtnBig}>
            К подбору
          </button>
        </>
      )}

      {menuHistory.map((entry) => {
        const isToday = sameDay(entry.createdAt, new Date().toISOString());
        const isOverspent = entry.totalCost > entry.budget;
        return (
          <button
            key={entry.id}
            onClick={() => void openMenu(entry.id)}
            disabled={openingId !== null && openingId !== entry.id}
            style={{
              ...styles.item,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              ...(openingId === entry.id ? styles.disabled : {}),
            }}
          >
            <div style={styles.itemTop}>
              <span style={styles.itemName}>
                {entry.store.emoji} {formatDate(entry.createdAt)}
                {isToday && <span> · сегодня</span>}
              </span>
              <span style={styles.itemCost}>{entry.totalCost.toFixed(2)} BYN</span>
            </div>
            <div style={styles.itemSub}>
              {entry.store.name} · {entry.recipesCount} {daysNoun(entry.recipesCount)} ·{' '}
              {isOverspent ? (
                <>чек выше бюджета {entry.budget.toFixed(2)} BYN</>
              ) : (
                <>
                  бюджет {entry.budget.toFixed(2)} BYN · остаток {(entry.budget - entry.totalCost).toFixed(2)} BYN
                </>
              )}
            </div>
          </button>
        );
      })}

      {root && (
        <button onClick={() => navigate('/menu/leftovers')} style={styles.ghostBtnBig}>
          Мои запасы · вычесть из чека
        </button>
      )}

      <button onClick={() => navigate('/menu/store')} style={styles.ghostBtnBig} disabled={menuLoading || openingId !== null}>
        Создать новый рацион
      </button>
    </div>
  );
}