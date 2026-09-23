import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import type { MenuResult } from '../types';
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
    marginBottom: 12,
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
    marginBottom: 14,
  },
  card: {
    background: 'var(--surface-card)',
    borderRadius: 20,
    padding: 14,
    border: '1px solid var(--hairline)',
    marginBottom: 12,
    cursor: 'pointer',
    transition: 'border-color 120ms ease',
  },
  cardSelected: {
    borderColor: 'var(--primary)',
    boxShadow: '0 0 0 1px var(--primary)',
  },
  cardHeader: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    flexShrink: 0,
    objectFit: 'cover',
    background: 'var(--grad-heart)',
  },
  name: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--ink)',
    marginBottom: 3,
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--hairline)',
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ink)',
  },
  flash: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTop: '1px solid var(--hairline)',
    fontSize: 12,
    color: 'var(--ash)',
  },
  flashCost: {
    fontWeight: 700,
    fontSize: 14,
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
    opacity: 1,
  },
  disabled: {
    opacity: 0.45,
  },
};

export function MenuResultScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { menuResult, menuLoading, pickMenuRecipes } = useValentinesStore();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const initRef = useRef<string | null>(null);

  useEffect(() => {
    setMainButton({ isVisible: false });
    const onBackClick = () => navigate('/menu');
    setBackButton(true, onBackClick);
    return () => setBackButton(false);
  }, [navigate]);

  const menu = useMemo<MenuResult | null>(() => {
    const id = params.get('id');
    if (id && menuResult && menuResult.id !== id) return null;
    return menuResult;
  }, [menuResult, params]);

  useEffect(() => {
    if (menuResult && initRef.current !== menuResult.id) {
      initRef.current = menuResult.id;
      setSelected(new Set(menuResult.recipes.map((r) => r.recipe.id)));
    }
  }, [menuResult]);

  const applySelection = async (next: Set<string>) => {
    if (!menu || next.size === 0) return;
    setSelected(next);
    hapticFeedback('selection');
    await pickMenuRecipes(menu.id, [...next]);
  };

  if (!menu) {
    return (
      <div style={styles.container}>
        <div style={styles.topBar}>
          <BackButton />
          <span style={styles.title}>Меню</span>
        </div>
        <div style={styles.warningBox}>
          Меню больше не в памяти. Вернитесь в раздел «Меню» и подберите рецепты заново.
        </div>
        <button
          onClick={() => navigate('/menu')}
          disabled={menuLoading}
          style={{ ...styles.primaryBtnBig, ...(menuLoading ? styles.disabled : {}) }}
        >
          К подбору
        </button>
      </div>
    );
  }

  const servings = `${menu.servings.adults + menu.servings.children} чел (${menu.servings.effectiveServings.toFixed(1)} порц.)`;
  const inBudget = menu.totalCost <= menu.budget;
  const kcalTotal = menu.recipes.reduce((sum, r) => sum + (r.nutrition ? r.nutrition.perRecipe.calories : 0), 0);

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>Меню</span>
      </div>

      <div style={styles.summaryCard}>
        <div style={styles.summaryLine}>
          <span>{menu.store.emoji} {menu.store.name} · {servings}</span>
          <span style={styles.summaryValue}>{menu.recipes.length} рецепт(ов)</span>
        </div>
        <div style={styles.summaryLine}>
          <span>По рецептам</span>
          <span style={styles.summaryValue}>{menu.recipesCost.toFixed(2)} BYN</span>
        </div>
        <div style={styles.summaryLine}>
          <span>По чеку (упаковки)</span>
          <span style={styles.summaryValue}>{menu.totalCost.toFixed(2)} BYN</span>
        </div>
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
        <div style={styles.summaryLine}>
          <span>Калорийность меню</span>
          <span style={styles.summaryValue}>{Math.round(kcalTotal)} ккал</span>
        </div>
      </div>

      {menu.warnings.map((w, i) => (
        <div key={i} style={styles.warningBox}>⚠️ {w}</div>
      ))}

      <div style={{ ...styles.summaryLine, marginBottom: 10, color: 'var(--ash)', fontSize: 12 }}>
        Нажимайте на блюдо, чтобы убрать его из покупаемых — чек пересчитается сразу.
      </div>

      {menu.recipes.map((choice) => {
        const isSelected = selected.has(choice.recipe.id);
        const nutrition = choice.nutrition;
        return (
          <button
            key={choice.recipe.id}
            style={{ ...styles.card, ...(isSelected ? styles.cardSelected : {}), textAlign: 'left', width: '100%' }}
            onClick={() => {
              const next = new Set(selected);
              if (next.has(choice.recipe.id)) next.delete(choice.recipe.id);
              else next.add(choice.recipe.id);
              void applySelection(next);
            }}
            title={isSelected ? 'Убрать из меню' : 'Добавить в меню'}
          >
            <div style={styles.cardHeader}>
              {choice.recipe.photoUrl ? (
                <img src={choice.recipe.photoUrl} alt="" style={styles.thumb} />
              ) : (
                <span style={{ ...styles.thumb, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                  {choice.recipe.category === 'Завтраки' ? '🍳' : '🍲'}
                </span>
              )}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={styles.name}>
                  {choice.recipe.name} {isSelected ? '' : '· (не покупаем)'}
                </span>
                <div style={styles.chips}>
                  <span style={styles.chip}>💰 {choice.cost.toFixed(2)} BYN</span>
                  <span style={styles.chip}>≈ {choice.costPerServing.toFixed(2)} BYN/порц.</span>
                  {choice.recipe.timeMin != null && <span style={styles.chip}>⏱ {choice.recipe.timeMin} мин</span>}
                  {choice.cookwareLabels && choice.cookwareLabels.length > 0 && (
                    <span style={styles.chip}>{choice.cookwareLabels.join(' · ')}</span>
                  )}
                  {nutrition && (
                    <span style={styles.chip}>
                      🔥 {Math.round(nutrition.perServing.calories)} ккал · Б {Math.round(nutrition.perServing.protein)} · Ж {Math.round(nutrition.perServing.fat)} · У {Math.round(nutrition.perServing.carbs)}
                    </span>
                  )}
                </div>
                {choice.recipe.sourceUrl && (
                  <div style={{ ...styles.flash, borderTop: 'none', paddingTop: 6, marginTop: 6 }}>
                    <a
                      href={choice.recipe.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: 'var(--primary)', fontWeight: 600 }}
                    >
                      Источник рецепта ↗
                    </a>
                  </div>
                )}
              </span>
            </div>
            <div style={styles.flash}>
              <span>Порций: {choice.servings}</span>
              <span style={styles.flashCost}>{isSelected ? choice.cost.toFixed(2) + ' BYN' : '—'}</span>
            </div>
          </button>
        );
      })}

      <button
        onClick={() => navigate('/menu/shopping')}
        disabled={menuLoading}
        style={{ ...styles.primaryBtnBig, ...(menuLoading ? styles.disabled : {}) }}
      >
        {menuLoading ? 'Пересчитываем…' : 'Список покупок'}
      </button>
    </div>
  );
}