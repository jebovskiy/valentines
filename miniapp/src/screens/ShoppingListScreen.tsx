import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { MENU_UNIT_LABEL, MenuResult, MenuShoppingListItem } from '../types';
import { setMainButton, setBackButton } from '../utils/telegram';
import { BackButton } from '../components/BackButton';

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
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--ink)',
  },
  summaryCard: {
    background: 'var(--surface-card)',
    borderRadius: 18,
    padding: 14,
    border: '1px solid var(--hairline)',
    marginBottom: 14,
  },
  summaryLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 13,
    color: 'var(--ash)',
    marginBottom: 6,
  },
  summaryValue: {
    fontWeight: 700,
    color: 'var(--ink)',
  },
  summaryValueGood: {
    fontWeight: 700,
    color: '#2e9e56',
  },
  summaryValueBad: {
    fontWeight: 700,
    color: 'var(--primary)',
  },
  warningBox: {
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    borderRadius: 14,
    padding: '10px 12px',
    fontSize: 12,
    lineHeight: '16px',
    color: 'var(--ash)',
    marginBottom: 12,
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
    marginBottom: 6,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  itemSub: {
    fontSize: 12,
    color: 'var(--ash)',
    marginBottom: 8,
  },
  itemBottom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  badge: {
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 600,
  },
  badgeMissing: {
    background: '#ffe3e6',
    color: '#c0392b',
  },
  badgeStale: {
    background: '#fff3d6',
    color: '#b7791f',
  },
  badgeMock: {
    background: 'var(--surface-elevated)',
    color: 'var(--ash)',
  },
  subtotal: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--ink)',
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
};

function fmtQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}

export function ShoppingListScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { menuResult } = useValentinesStore();

  useEffect(() => {
    setMainButton({ isVisible: false });
    const onBackClick = () => navigate('/menu/result');
    setBackButton(true, onBackClick);
    return () => setBackButton(false);
  }, [navigate]);

  const menu = useMemo<MenuResult | null>(() => {
    const id = params.get('id');
    if (id && menuResult && menuResult.id !== id) return null;
    return menuResult;
  }, [menuResult, params]);

  if (!menu) {
    return (
      <div style={styles.container}>
        <div style={styles.topBar}>
          <BackButton />
          <span style={styles.title}>Список покупок</span>
        </div>
        <div style={styles.warningBox}>
          Меню больше не в памяти. Вернитесь в раздел «Меню» и подберите рецепты заново.
        </div>
        <button onClick={() => navigate('/menu')} style={styles.primaryBtnBig}>
          К подбору
        </button>
      </div>
    );
  }

  const list = menu.shoppingList;
  const items = list.items;
  const inBudget = menu.totalCost <= menu.budget;
  const known = items.filter((i) => !i.missing);
  const missingSum = known.reduce((sum, i) => sum + i.subtotal, 0);

  const byName = (a: MenuShoppingListItem, b: MenuShoppingListItem) => a.name.localeCompare(b.name, 'ru');

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>Список покупок</span>
      </div>

      <div style={styles.summaryCard}>
        <div style={styles.summaryLine}>
          <span>{menu.store.emoji} {menu.store.name}</span>
          <span style={styles.summaryValue}>{items.length} позиций</span>
        </div>
        {known.length > 0 && (
          <div style={styles.summaryLine}>
            <span>По чеку</span>
            <span style={styles.summaryValue}>{missingSum.toFixed(2)} BYN</span>
          </div>
        )}
        <div style={styles.summaryLine}>
          <span>Бюджет</span>
          <span style={styles.summaryValue}>{menu.budget.toFixed(2)} BYN</span>
        </div>
        <div style={styles.summaryLine}>
          <span>{inBudget ? 'Остаток' : 'Перерасход'}</span>
          <span style={inBudget ? styles.summaryValueGood : styles.summaryValueBad}>
            {inBudget ? menu.remainingBudget.toFixed(2) : menu.overspend.toFixed(2)} BYN
          </span>
        </div>
      </div>

      {menu.warnings.map((w, i) => (
        <div key={i} style={styles.warningBox}>⚠️ {w}</div>
      ))}

      {list.missingItemsCount > 0 && (
        <div style={{ ...styles.warningBox, color: '#c0392b' }}>
          {list.missingItemsCount} продукт(ов) без цены в каталоге магазина — в итог «по чеку» они не входят.
        </div>
      )}

      {[...items].sort(byName).map((item) => (
        <div key={item.ingredientId} style={{ ...styles.item, ...(item.missing ? { opacity: 0.6 } : {}) }}>
          <div style={styles.itemTop}>
            <span style={styles.itemName}>{item.name}</span>
            <span style={styles.subtotal}>
              {item.missing ? '—' : `${item.subtotal.toFixed(2)} BYN`}
            </span>
          </div>
          <div style={styles.itemSub}>
            Нужно {fmtQty(item.requiredQuantity)} {MENU_UNIT_LABEL[item.requiredUnit]} ·{' '}
            купить {fmtQty(item.purchaseQuantity)} {MENU_UNIT_LABEL[item.packageUnit]} ×{' '}
            {item.price.toFixed(2)} BYN
            {item.packageQuantity !== 1 && ` (упаковка ${item.packageQuantity} ${MENU_UNIT_LABEL[item.packageUnit]})`}
          </div>
          <div style={styles.itemBottom}>
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {item.missing && <span style={{ ...styles.badge, ...styles.badgeMissing }}>нет цены</span>}
              {!item.missing && item.stale && <span style={{ ...styles.badge, ...styles.badgeStale }}>цена устарела</span>}
              {item.isMock && <span style={{ ...styles.badge, ...styles.badgeMock }}>демо-цена</span>}
            </span>
            {!item.missing && item.packageUnit !== 'pcs' && (
              <span style={{ fontSize: 11, color: 'var(--ash)' }}>
                {item.unitPrice.toFixed(2)} BYN/<span style={{ textTransform: 'none' }}>{MENU_UNIT_LABEL[item.packageUnit] === 'г' ? 'кг' : MENU_UNIT_LABEL[item.packageUnit]}</span>
              </span>
            )}
          </div>
        </div>
      ))}

      <button onClick={() => navigate('/menu/result')} style={styles.primaryBtnBig}>
        Назад к меню
      </button>
    </div>
  );
}