import { shallow } from 'zustand/shallow';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { MEAL_COMPONENT_TITLES } from '../types';
import type { MealComponentId, MenuMealId, MenuResult, MenuSlotReplacement, MenuSlotVariant } from '../types';
import { setMainButton, setBackButton } from '../utils/telegram';
import { BackButton } from '../components/BackButton';

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '18px 16px 24px',
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
  groupTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: 'var(--ink)',
    margin: '14px 0 8px',
  },
  roleTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--primary)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    margin: '10px 0 6px',
  },
  variant: {
    background: 'var(--surface-card)',
    borderRadius: 16,
    padding: '12px 14px',
    border: '1px solid var(--hairline)',
    marginBottom: 8,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  variantSelected: {
    border: '2px solid var(--primary)',
  },
  variantBody: {
    flex: 1,
    minWidth: 0,
  },
  variantName: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  variantSub: {
    fontSize: 12,
    color: 'var(--ash)',
    marginTop: 2,
  },
  variantCost: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--ink)',
    flexShrink: 0,
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
  disabled: {
    opacity: 0.45,
  },
};

function fmtQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}

const MEAL_TITLES: Record<MenuMealId, string> = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин' };
const DAY_MEALS: MenuMealId[] = ['breakfast', 'lunch', 'dinner'];
const slotKey = (meal: MenuMealId, role: MealComponentId) => `${meal}:${role}`;

export function MenuReplaceScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { menuResult, getSlotVariants, replaceMenuSlots, menuLoading } = useValentinesStore(
    (s) => ({ menuResult: s.menuResult, getSlotVariants: s.getSlotVariants, replaceMenuSlots: s.replaceMenuSlots, menuLoading: s.menuLoading }),
    shallow,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<Record<string, MenuSlotVariant[]>>({});
  const [selected, setSelected] = useState<Record<string, string | null>>({});

  const id = params.get('id') ?? '';
  const day = Number(params.get('day') ?? '1');
  const wholeDay = (params.get('dayReplacement') ?? '0') === '1';
  const meals: MenuMealId[] = useMemo(() => (wholeDay ? DAY_MEALS : [(params.get('meal') ?? 'breakfast') as MenuMealId]), [wholeDay, params]);

  const menu = useMemo<MenuResult | null>(() => {
    const mid = params.get('id');
    if (mid && menuResult && menuResult.id !== mid) return null;
    return menuResult;
  }, [menuResult, params]);

  const rolesByMeal: Record<MenuMealId, MealComponentId[]> = useMemo(() => {
    const out: Record<MenuMealId, MealComponentId[]> = { breakfast: ['main'], lunch: ['main'], dinner: ['main'] };
    if (menu) {
      const dayObj = menu.days.find((d) => d.day === day);
      if (dayObj) {
        for (const m of dayObj.meals) {
          if (m.components && m.components.length > 0) {
            out[m.meal] = m.components.map((c) => c.role);
          }
        }
      }
    }
    return out;
  }, [menu, day]);

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, () => navigate('/menu/result'));
    return () => setBackButton(false);
  }, [navigate]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      if (!id) {
        setError('Меню больше не в памяти.');
        setLoading(false);
        return;
      }
      const slots = meals.flatMap((m) => (rolesByMeal[m] ?? ['main']).map((r) => ({ meal: m, role: r })));
      const entries = await Promise.all(
        slots.map(async (s) => [slotKey(s.meal, s.role), await getSlotVariants(id, day, s.meal, s.role)] as const)
      );
      const next: Record<string, MenuSlotVariant[]> = {};
      let total = 0;
      for (const [k, list] of entries) {
        next[k] = list;
        total += list.length;
      }
      setVariants(next);
      setLoading(false);
      if (total === 0) {
        setError(meals.length > 1 ? 'Подходящих замен для этого дня не нашлось.' : 'Подходящих замен для этого слота не нашлось.');
      }
    };
    void load();
  }, [id, day, wholeDay, meals, rolesByMeal, getSlotVariants]);

  const hasSelection = Object.values(selected).some((v) => v !== null);

  const apply = async () => {
    const replacements: MenuSlotReplacement[] = [];
    for (const [key, recipeId] of Object.entries(selected)) {
      if (!recipeId) continue;
      const [meal, role] = key.split(':') as [MenuMealId, MealComponentId];
      replacements.push({ day, meal, role, recipeId });
    }
    if (replacements.length === 0) return;
    const updated = await replaceMenuSlots(id, replacements);
    if (updated) navigate('/menu/result?id=' + updated.id);
  };

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>{wholeDay ? `Заменить день ${day}` : `Заменить: ${MEAL_TITLES[meals[0]]}`}</span>
      </div>

      {loading && <div style={styles.infoBox}>Подбираем подходящие блюда…</div>}
      {error && <div style={styles.infoBox}>{error}</div>}

      {!loading && !error && (
        <div style={styles.infoBox}>
          Выберите новое блюдо{wholeDay ? ' для каждого приёма пищи' : ''}. Стоимость и чек пересчитаются автоматически.
        </div>
      )}

      {!loading &&
        meals.map((m) => {
          const roleList = rolesByMeal[m] ?? ['main'];
          const groups = roleList.filter((r) => (variants[slotKey(m, r)]?.length ?? 0) > 0);
          if (groups.length === 0) return null;
          return (
            <div key={m}>
              {wholeDay && <div style={styles.groupTitle}>{MEAL_TITLES[m]}</div>}
              {groups.map((r) => {
                const key = slotKey(m, r);
                return (
                  <div key={r}>
                    {roleList.length > 1 && <div style={styles.roleTitle}>{MEAL_COMPONENT_TITLES[r]}</div>}
                    {variants[key].map((v) => {
                      const isSel = selected[key] === v.recipeId;
                      return (
                        <button
                          key={v.recipeId}
                          style={{ ...styles.variant, ...(isSel ? styles.variantSelected : {}) }}
                          onClick={() => setSelected((s) => ({ ...s, [key]: isSel ? null : v.recipeId }))}
                        >
                          <span style={styles.variantBody}>
                            <span style={styles.variantName}>{v.name}</span>
                            <span style={styles.variantSub}>
                              {v.costPerServing > 0 && `≈ ${fmtQty(v.costPerServing)} BYN/порц.`}
                              {v.kcalPerServing != null && ` · ${v.kcalPerServing} ккал`}
                              {v.timeMin != null && ` · ${v.timeMin} мин`}
                              {v.priceMissing && ' · без цены'}
                            </span>
                          </span>
                          <span style={styles.variantCost}>{v.cost.toFixed(2)} BYN</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}

      {!loading && !error && (
        <button
          onClick={() => void apply()}
          disabled={!hasSelection || menuLoading}
          style={{ ...styles.primaryBtnBig, ...((!hasSelection || menuLoading) ? styles.disabled : {}) }}
        >
          {menuLoading ? 'Применяем…' : 'Применить замену'}
        </button>
      )}
    </div>
  );
}