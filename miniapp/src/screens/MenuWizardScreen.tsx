import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import type { MenuAllergenId, MenuRequest, MenuStoreId } from '../types';
import { setMainButton, setBackButton, hapticFeedback } from '../utils/telegram';
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
  storeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
  },
  storeCard: {
    borderRadius: 18,
    padding: '14px 12px',
    border: '1px solid var(--hairline)',
    background: 'var(--surface-card)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 120ms ease',
  },
  storeCardSelected: {
    borderColor: 'var(--primary)',
    boxShadow: '0 0 0 1px var(--primary)',
  },
  storeName: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--ink)',
    marginBottom: 3,
  },
  storeDesc: {
    fontSize: 11,
    lineHeight: '15px',
    color: 'var(--ash)',
  },
  stepperRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    borderRadius: 16,
    padding: '10px 12px',
    marginBottom: 10,
  },
  stepperLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ink)',
  },
  stepperControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    border: '1px solid var(--hairline)',
    background: 'var(--surface-elevated)',
    color: 'var(--ink)',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.35,
  },
  stepValue: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  budgetInput: {
    width: '100%',
    boxSizing: 'border-box',
    height: 44,
    borderRadius: 14,
    border: '1px solid var(--hairline)',
    background: 'var(--surface-card)',
    color: 'var(--ink)',
    fontSize: 16,
    padding: '0 14px',
    outline: 'none',
  },
  allergenGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  allergenChip: {
    borderRadius: 999,
    padding: '8px 12px',
    border: '1px solid var(--hairline)',
    background: 'var(--surface-card)',
    color: 'var(--ink)',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'border-color 120ms ease',
  },
  allergenChipSelected: {
    borderColor: 'var(--primary)',
    background: 'var(--primary)',
    color: '#fff',
  },
  errorBox: {
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    borderRadius: 14,
    padding: '12px 14px',
    fontSize: 13,
    lineHeight: '18px',
    color: 'var(--primary)',
    marginBottom: 14,
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
    opacity: 1,
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  mockNote: {
    fontSize: 11,
    color: 'var(--ash)',
    marginTop: 10,
    lineHeight: '15px',
  },
};

export function MenuWizardScreen() {
  const navigate = useNavigate();
  const {
    menuStores,
    menuAllergens,
    menuLoading,
    fetchMenuStoresAndAllergens,
    generateMenuPlan,
    clearMenu,
  } = useValentinesStore();

  const [storeId, setStoreId] = useState<MenuStoreId | null>(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [budget, setBudget] = useState('');
  const [allergens, setAllergens] = useState<Set<MenuAllergenId>>(new Set());
  const [screenError, setScreenError] = useState<string | null>(null);

  useEffect(() => {
    void fetchMenuStoresAndAllergens();
    setMainButton({ isVisible: false });
    const onBackClick = () => navigate(-1);
    setBackButton(true, onBackClick);
    clearMenu();
    return () => setBackButton(false);
  }, [navigate, fetchMenuStoresAndAllergens, clearMenu]);

  useEffect(() => {
    if (!storeId && menuStores.length > 0) {
      setStoreId(menuStores[0].id);
    }
  }, [storeId, menuStores]);

  const budgetNumber = useMemo(() => {
    const n = parseFloat(budget.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [budget]);

  const selectedStore = menuStores.find((s) => s.id === storeId) ?? null;

  const toggleAllergen = (id: MenuAllergenId) => {
    hapticFeedback('selection');
    setAllergens((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generate = async () => {
    if (!storeId || budgetNumber === null || menuLoading) return;
    hapticFeedback('impact', 'light');
    setScreenError(null);
    const request: MenuRequest = {
      storeId,
      adults,
      children,
      budget: budgetNumber,
      currency: 'BYN',
      allergens: [...allergens],
    };
    const result = await generateMenuPlan(request);
    if (!result) {
      setScreenError(useValentinesStore.getState().error || 'Не удалось подобрать меню. Попробуйте ещё раз.');
      return;
    }
    if ('code' in result) {
      const issue = result;
      if (issue.code === 'budget_too_low' && issue.minCost !== undefined) {
        setScreenError(
          `Бюджет слишком мал: самое дешёвое блюдо — ${issue.minCost.toFixed(2)} BYN`
        );
      } else if (issue.code === 'no_recipes') {
        setScreenError(issue.message || 'Нет подходящих рецептов по выбранным условиям');
      } else {
        setScreenError(issue.message || 'Не удалось подобрать меню');
      }
      return;
    }
    navigate('/menu/result');
  };

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>Меню на неделю</span>
      </div>

      <div style={styles.subtitle}>
        Подберём рецепты под магазин, состав семьи и бюджет, а затем соберём список покупок с расчётом упаковок.
      </div>

      {screenError && <div style={styles.errorBox}>{screenError}</div>}

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Магазин</div>
        <div style={styles.sectionHint}>Цены и наличие считаем по этому магазину</div>
      </div>
      <div style={styles.storeGrid}>
        {menuStores.map((store) => {
          const selected = store.id === storeId;
          return (
            <button
              key={store.id}
              style={{ ...styles.storeCard, ...(selected ? styles.storeCardSelected : {}) }}
              onClick={() => { hapticFeedback('selection'); setStoreId(store.id); }}
              title={store.description}
            >
              <span style={styles.storeName}>
                <span>{store.emoji}</span>
                <span>{store.name}</span>
              </span>
              <span style={styles.storeDesc}>{store.description}</span>
            </button>
          );
        })}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Кто будет есть</div>
        <div style={styles.sectionHint}>Детские порции считаются меньше взрослых</div>
      </div>
      <div style={styles.stepperRow}>
        <span style={styles.stepperLabel}>👤 Взрослые</span>
        <span style={styles.stepperControls}>
          <button style={{ ...styles.stepBtn, ...(adults === 0 ? styles.stepBtnDisabled : {}) }} onClick={() => { hapticFeedback('selection'); setAdults(Math.max(0, adults - 1)); }} aria-label="Меньше">−</button>
          <span style={styles.stepValue}>{adults}</span>
          <button style={styles.stepBtn} onClick={() => { hapticFeedback('selection'); setAdults(Math.min(20, adults + 1)); }} aria-label="Больше">+</button>
        </span>
      </div>
      <div style={styles.stepperRow}>
        <span style={styles.stepperLabel}>🧒 Дети</span>
        <span style={styles.stepperControls}>
          <button style={{ ...styles.stepBtn, ...(children === 0 ? styles.stepBtnDisabled : {}) }} onClick={() => { hapticFeedback('selection'); setChildren(Math.max(0, children - 1)); }} aria-label="Меньше">−</button>
          <span style={styles.stepValue}>{children}</span>
          <button style={styles.stepBtn} onClick={() => { hapticFeedback('selection'); setChildren(Math.min(20, children + 1)); }} aria-label="Больше">+</button>
        </span>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Бюджет</div>
        <div style={styles.sectionHint}>Сколько готовы потратить на продукты, BYN</div>
      </div>
      <input
        style={styles.budgetInput}
        inputMode="decimal"
        placeholder="например, 40"
        value={budget}
        onChange={(e) => setBudget(e.target.value.replace(/[^\d.,]/g, ''))}
      />

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Аллергии</div>
        <div style={styles.sectionHint}>Рецепты с этими ингредиентами будут исключены</div>
      </div>
      <div style={styles.allergenGrid}>
        {menuAllergens.map((a) => {
          const selected = allergens.has(a.id);
          return (
            <button
              key={a.id}
              style={{ ...styles.allergenChip, ...(selected ? styles.allergenChipSelected : {}) }}
              onClick={() => toggleAllergen(a.id)}
              title={a.hint}
            >
              {a.emoji} {a.title}
            </button>
          );
        })}
      </div>

      <button
        onClick={generate}
        disabled={menuLoading || budgetNumber === null || !selectedStore}
        style={{
          ...styles.primaryBtnBig,
          ...(menuLoading || budgetNumber === null || !selectedStore ? styles.primaryBtnDisabled : {}),
        }}
      >
        {menuLoading ? 'Подбираем рецепты…' : 'Подобрать меню'}
      </button>

      {selectedStore?.priceCatalog === 'mock' && (
        <div style={styles.mockNote}>
          Сейчас используются демо-цены магазинов — итог примерный. Бюджет — это верхняя граница.
        </div>
      )}
    </div>
  );
}