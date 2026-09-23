import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { MENU_UNIT_LABEL } from '../types';
import type { MenuDay, MenuMeal, MenuResult, MenuShoppingListItem } from '../types';
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
  sectionTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: 'var(--ink)',
    margin: '18px 0 10px',
  },
  item: {
    background: 'var(--surface-card)',
    borderRadius: 16,
    padding: '12px 14px',
    border: '1px solid var(--hairline)',
    marginBottom: 8,
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
  subtotal: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  badge: {
    borderRadius: 999,
    padding: '2px 7px',
    fontSize: 10,
    fontWeight: 600,
    marginLeft: 6,
    background: '#ffe3e6',
    color: '#c0392b',
  },
  dayCard: {
    background: 'var(--surface-card)',
    borderRadius: 18,
    padding: '12px 14px',
    border: '1px solid var(--hairline)',
    marginBottom: 10,
  },
  dayHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dayName: {
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--ink)',
  },
  dayTag: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ash)',
  },
  mealRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 0',
    borderTop: '1px solid var(--hairline)',
  },
  mealEmoji: {
    width: 30,
    height: 30,
    borderRadius: 999,
    background: 'var(--surface-elevated)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    flexShrink: 0,
  },
  mealBody: {
    flex: 1,
    minWidth: 0,
  },
  mealLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--ash)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  mealName: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--ink)',
    lineHeight: 1.3,
  },
  mealMeta: {
    fontSize: 11,
    color: 'var(--ash)',
    marginTop: 2,
  },
  mealCost: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--ink)',
    flexShrink: 0,
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    color: 'var(--primary)',
    fontWeight: 600,
    fontSize: 13,
    alignSelf: 'flex-end',
    marginBottom: 4,
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

const DAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const MEAL_EMOJI: Record<string, string> = {
  breakfast: '🍳',
  lunch: '🍲',
  dinner: '🍛',
};

function fmtQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}

function byName(a: MenuShoppingListItem, b: MenuShoppingListItem) {
  return a.name.localeCompare(b.name, 'ru');
}

function MealRow({ meal }: { meal: MenuMeal }) {
  const nutrition = meal.recipe.nutrition;
  const recipe = meal.recipe.recipe;
  const good = meal.recipe.servings;
  return (
    <div style={styles.mealRow}>
      <span style={styles.mealEmoji}>{MEAL_EMOJI[meal.meal] ?? '🍽'}</span>
      <span style={styles.mealBody}>
        <span style={styles.mealLabel}>{meal.title}</span>
        <span style={styles.mealName}>{recipe.name}</span>
        <span style={styles.mealMeta}>
          {good.toFixed(1)} порц.
          {nutrition && ` · ${Math.round(nutrition.perServing.calories)} ккал`}
        </span>
      </span>
      {meal.recipe.cost != null && (
        <span style={styles.mealCost}>{meal.recipe.cost.toFixed(2)} BYN</span>
      )}
    </div>
  );
}

export function MenuResultScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { menuResult, menuLoading } = useValentinesStore();

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

  if (!menu) {
    return (
      <div style={styles.container}>
        <div style={styles.topBar}>
          <BackButton />
          <span style={styles.title}>Меню на неделю</span>
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
  const items = menu.shoppingList.items;

  const days: MenuDay[] =
    menu.days && menu.days.length > 0
      ? menu.days
      : [
          {
            day: 1,
            meals: [],
          },
        ];

  const startNew = () => {
    useValentinesStore.getState().resetMenuDraft();
    useValentinesStore.getState().clearMenu();
    navigate('/menu/store');
  };

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>Меню на неделю</span>
      </div>

      <div style={styles.summaryCard}>
        <div style={styles.summaryLine}>
          <span>{menu.store.emoji} {menu.store.name} · {servings}</span>
          <span style={styles.summaryValue}>{menu.recipes.length} блюд</span>
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

      <div style={styles.sectionTitle}>🛒 Список покупок</div>
      {menu.shoppingList.missingItemsCount > 0 && (
        <div style={{ ...styles.warningBox, color: '#c0392b' }}>
          {menu.shoppingList.missingItemsCount} продукт(ов) без цены в каталоге магазина — в итог «по чеку» они не входят.
        </div>
      )}
      {[...items].sort(byName).map((item) => (
        <div key={item.ingredientId} style={{ ...styles.item, ...(item.missing ? { opacity: 0.6 } : {}) }}>
          <div style={styles.itemTop}>
            <span style={styles.itemName}>
              {item.name}
              {item.missing && <span style={styles.badge}>нет цены</span>}
            </span>
            <span style={styles.subtotal}>
              {item.missing ? '—' : `${item.subtotal.toFixed(2)} BYN`}
            </span>
          </div>
          <div style={styles.itemSub}>
            Купить {fmtQty(item.purchaseQuantity)} {MENU_UNIT_LABEL[item.packageUnit]} ·{' '}
            {item.price.toFixed(2)} BYN
            {item.packageQuantity !== 1 &&
              ` (упаковка ${item.packageQuantity} ${MENU_UNIT_LABEL[item.packageUnit]})`}
          </div>
        </div>
      ))}
      <button onClick={() => navigate(`/menu/shopping?id=${menu.id}`)} style={styles.linkBtn}>
        Подробный список покупок →
      </button>

      <div style={styles.sectionTitle}>🍽 Меню на неделю</div>
      {days.map((d) => (
        <div key={d.day} style={styles.dayCard}>
          <div style={styles.dayHeader}>
            <span style={styles.dayName}>День {d.day} · {DAY_NAMES[(d.day - 1) % 7]}</span>
            <span style={styles.dayTag}>
              {d.meals.reduce((sum, m) => sum + (m.recipe.cost ?? 0), 0).toFixed(2)} BYN
            </span>
          </div>
          {d.meals.length === 0 && <div style={styles.itemSub}>Блюда не подобраны</div>}
          {d.meals.map((meal) => (
            <MealRow key={`${d.day}-${meal.meal}`} meal={meal} />
          ))}
        </div>
      ))}

      <button onClick={() => navigate(`/menu/shopping?id=${menu.id}`)} style={styles.primaryBtnBig}>
        Список покупок с ценами
      </button>

      <button onClick={startNew} style={styles.ghostBtnBig}>
        Создать новый рацион
      </button>
    </div>
  );
}