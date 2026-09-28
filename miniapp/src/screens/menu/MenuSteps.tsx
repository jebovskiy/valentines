import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../../hooks/useValentinesStore';
import { MEAL_COMPONENT_TITLES, MEAL_ROLES, MENU_COOKWARE, menuMinBudgetFor } from '../../types';
import type { MealComponentId, MenuAllergenId, MenuCookwareId, MenuIngredientGroup, MenuMealId, MenuMember, MenuRequest, MenuStoreId } from '../../types';
import { setMainButton, setBackButton, hapticFeedback } from '../../utils/telegram';
import { BackButton } from '../../components/BackButton';

function normalizeBudgetInput(value: string): string {
  const raw = value.replace(/[^\d.,]/g, '');
  let sep = '';
  let sepIndex = -1;
  for (const ch of raw) {
    if (ch === ',' || ch === '.') {
      sep = ch;
      sepIndex = raw.indexOf(ch);
      break;
    }
  }
  const intPart = sepIndex >= 0 ? raw.slice(0, sepIndex).replace(/[.,]/g, '') : raw.replace(/[.,]/g, '');
  const decPart = sepIndex >= 0 ? raw.slice(sepIndex + 1).replace(/[.,]/g, '') : '';
  if (!intPart && !decPart) return '';
  const intClean = intPart.slice(0, 8);
  const decClean = decPart.slice(0, 2);
  return decClean ? `${intClean}${sep}${decClean}` : intClean;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px 16px calc(28px + env(safe-area-inset-bottom))',
    maxWidth: 460,
    margin: '0 auto',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 48,
    position: 'relative',
  },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1.2,
    color: 'var(--ink)',
    zIndex: 1,
    pointerEvents: 'none',
    padding: '0 52px',
  },
  stepBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  stepDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: 'var(--hairline)',
  },
  stepDotActive: {
    background: 'var(--primary)',
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ash)',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--ink)',
    lineHeight: 1.3,
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: '19px',
    color: 'var(--mute)',
    marginBottom: 20,
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
    lineHeight: 1.3,
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
    marginBottom: 5,
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
    padding: '12px 14px',
    marginBottom: 10,
  },
  stepperLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ink)',
    lineHeight: 1.3,
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
    height: 50,
    borderRadius: 14,
    border: '1px solid var(--hairline)',
    background: 'var(--surface-card)',
    color: 'var(--ink)',
    fontSize: 17,
    padding: '0 14px',
    outline: 'none',
  },
  cookwareGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  cookwareCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: '13px 14px',
    border: '1px solid var(--hairline)',
    background: 'var(--surface-card)',
    cursor: 'pointer',
    textAlign: 'left',
    lineHeight: 1.3,
    transition: 'border-color 120ms ease',
  },
  cookwareCardSelected: {
    borderColor: 'var(--primary)',
    boxShadow: '0 0 0 1px var(--primary)',
  },
  cookwareEmoji: {
    fontSize: 22,
    width: 26,
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  cookwareBody: {
    flex: 1,
    minWidth: 0,
  },
  cookwareTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--ink)',
    lineHeight: 1.3,
    marginBottom: 2,
    display: 'block',
  },
  cookwareHint: {
    fontSize: 12,
    color: 'var(--ash)',
    lineHeight: 1.35,
    display: 'block',
  },
  allergenGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  allergenChip: {
    borderRadius: 999,
    padding: '9px 13px',
    border: '1px solid var(--hairline)',
    background: 'var(--surface-card)',
    color: 'var(--ink)',
    fontSize: 13,
    lineHeight: 1.25,
    cursor: 'pointer',
    transition: 'border-color 120ms ease',
  },
  allergenChipSelected: {
    borderColor: 'var(--primary)',
    background: 'var(--primary)',
    color: '#fff',
  },
  tagSectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--ink)',
    marginTop: 22,
    marginBottom: 4,
  },
  tagSectionHint: {
    fontSize: 12,
    lineHeight: '17px',
    color: 'var(--ash)',
    marginBottom: 10,
  },
  tagInput: {
    width: '100%',
    borderRadius: 14,
    border: '1px solid var(--hairline)',
    background: 'var(--surface-card)',
    color: 'var(--ink)',
    padding: '11px 14px',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  },
  tagChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  tagChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    padding: '6px 10px',
    border: '1px solid var(--hairline)',
    background: 'var(--surface-elevated)',
    color: 'var(--ink)',
    fontSize: 13,
  },
  tagChipRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--ash)',
    fontSize: 15,
    lineHeight: 1,
    padding: 0,
  },
  searchResults: {
    marginTop: 6,
    borderRadius: 14,
    border: '1px solid var(--hairline)',
    background: 'var(--surface-card)',
    overflow: 'hidden',
  },
  searchRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    width: '100%',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid var(--hairline)',
    padding: '10px 12px',
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--ink)',
  },
  searchName: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 600,
    color: 'var(--ink)',
  },
  searchNameBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  searchGroupName: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  searchHint: {
    fontSize: 11,
    color: 'var(--ash)',
    fontWeight: 400,
  },
  searchEmpty: {
    padding: '10px 12px',
    fontSize: 12,
    color: 'var(--ash)',
  },
  alreadyAdded: {
    fontSize: 11,
    fontWeight: 400,
    color: 'var(--ash)',
  },
  addBtn: {
    color: 'var(--primary)',
    fontSize: 16,
    fontWeight: 800,
    lineHeight: 1,
  },
  errorBox: {
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    borderRadius: 14,
    padding: '12px 14px',
    fontSize: 13,
    lineHeight: '19px',
    color: 'var(--primary)',
    marginBottom: 14,
  },
  footer: {
    marginTop: 24,
  },
  primaryBtnBig: {
    width: '100%',
    height: 50,
    borderRadius: 999,
    background: 'var(--primary)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    opacity: 1,
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  mockNote: {
    fontSize: 11,
    color: 'var(--ash)',
    marginTop: 12,
    lineHeight: '16px',
  },
  memberCard: {
    background: 'var(--surface-card)',
    borderRadius: 16,
    padding: '14px',
    border: '1px solid var(--hairline)',
    marginBottom: 12,
  },
  memberTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  memberNameInput: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    border: '1px solid var(--hairline)',
    background: 'var(--surface-elevated)',
    color: 'var(--ink)',
    fontSize: 15,
    fontWeight: 700,
    padding: '10px 12px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  memberRemove: {
    width: 30,
    height: 30,
    borderRadius: 999,
    border: '1px solid var(--hairline)',
    background: 'var(--surface-elevated)',
    color: 'var(--ash)',
    fontSize: 15,
    lineHeight: 1,
    cursor: 'pointer',
    flexShrink: 0,
  },
  memberFieldLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--ash)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    margin: '0 0 6px',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chipSmall: {
    borderRadius: 999,
    padding: '7px 12px',
    border: '1px solid var(--hairline)',
    background: 'var(--surface-elevated)',
    color: 'var(--ink)',
    fontSize: 13,
    lineHeight: 1.2,
    cursor: 'pointer',
    transition: 'border-color 120ms ease',
  },
  chipSmallSelected: {
    borderColor: 'var(--primary)',
    background: 'var(--primary)',
    color: '#fff',
  },
  addMemberBtn: {
    width: '100%',
    height: 44,
    borderRadius: 16,
    border: '1px dashed var(--hairline)',
    background: 'var(--surface-card)',
    color: 'var(--primary)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
};

const TOTAL_STEPS = 6;

const MEAL_TITLES: Record<MenuMealId, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
};

const ROLE_EMOJI: Record<MealComponentId, string> = {
  soup: '🍜',
  main: '🍗',
  side: '🥔',
  salad: '🥗',
  dessert: '🍰',
};

function ProductSearchInput(props: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const { value, onChange, placeholder } = props;
  const { searchMenuIngredients } = useValentinesStore();
  const [text, setText] = useState('');
  const [results, setResults] = useState<{ id: string; name: string; unit: string }[]>([]);
  const [groups, setGroups] = useState<MenuIngredientGroup[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const search = async (raw: string) => {
    const q = raw.trim();
    if (!q) {
      setResults([]);
      setGroups([]);
      setSuggestion(null);
      return;
    }
    const res = await searchMenuIngredients(q);
    setResults(res.results);
    setGroups(res.groups);
    setSuggestion(res.suggestion);
  };

  const add = (names: string[]) => {
    const toAdd = [
      ...new Set(names.map((n) => n.trim()).filter((n) => Boolean(n) && !value.includes(n))),
    ] as string[];
    if (toAdd.length === 0) return;
    onChange([...value, ...toAdd]);
  };

  const remove = (names: string[]) => {
    const gone = new Set(names);
    onChange(value.filter((t) => !gone.has(t)));
  };

  const addOne = (name: string) => {
    if (!name) return;
    add([name]);
    setText('');
    setResults([]);
    setGroups([]);
    setSuggestion(null);
  };

  const toggleGroup = (g: MenuIngredientGroup) => {
    const memberNames = g.members.map((m) => m.name);
    const allAdded = memberNames.every((n) => value.includes(n));
    if (allAdded) remove(memberNames);
    else add(memberNames);
  };

  const groupFullyAdded = (g: MenuIngredientGroup) => g.members.every((m) => value.includes(m.name));
  const groupPartial = (g: MenuIngredientGroup) =>
    !groupFullyAdded(g) && g.members.some((m) => value.includes(m.name));

  const matched = results.some((r) => r.name.toLowerCase() === text.trim().toLowerCase() && text.trim().length > 0);
  const canAddTyped = results.length === 1 && matched;

  return (
    <div>
      <input
        style={styles.tagInput}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          void search(e.target.value);
        }}
        placeholder={placeholder}
        autoCapitalize="off"
        autoCorrect="off"
      />
      {text.trim().length >= 2 && (
        <div style={styles.searchResults}>
          {results.length === 0 && groups.length === 0 && !suggestion && (
            <div style={styles.searchEmpty}>Ничего не найдено в каталоге продуктов</div>
          )}
          {groups.map((g) => {
            const full = groupFullyAdded(g);
            const partial = groupPartial(g);
            const addedCount = g.members.filter((m) => value.includes(m.name)).length;
            return (
              <button key={g.id} style={styles.searchRow} onClick={() => toggleGroup(g)}>
                <span style={styles.searchNameBlock}>
                  <span style={styles.searchGroupName}>{g.name}</span>
                  <span style={styles.searchHint}>
                    {g.members.map((m) => m.name).join(', ')}
                  </span>
                  {full && <span style={styles.alreadyAdded}>все добавлены</span>}
                  {partial && !full && (
                    <span style={styles.alreadyAdded}>добавлено {addedCount} из {g.members.length}</span>
                  )}
                </span>
                <span style={styles.addBtn}>{full ? '✓' : partial ? '…' : '+'}</span>
              </button>
            );
          })}
          {results.map((r) => (
            <button key={r.id} style={styles.searchRow} onClick={() => addOne(r.name)}>
              <span style={styles.searchName}>
                {r.name}
                {value.includes(r.name) && <span style={styles.alreadyAdded}>уже добавлено</span>}
              </span>
              <span style={styles.addBtn}>+</span>
            </button>
          ))}
          {results.length > 0 && suggestion === null && !matched && (
            <button style={styles.searchRow} onClick={() => canAddTyped && text.trim() && addOne(text.trim())} disabled={!canAddTyped}>
              <span style={styles.searchName}>
                {text.trim()}
                <span style={styles.searchHint}>нет в каталоге</span>
              </span>
            </button>
          )}
          {suggestion && (
            <button style={styles.searchRow} onClick={() => addOne(suggestion)}>
              <span style={styles.searchName}>
                Возможно вы имели в виду: <strong>{suggestion}</strong>
              </span>
              <span style={styles.addBtn}>+</span>
            </button>
          )}
        </div>
      )}
      {value.length > 0 && (
        <div style={styles.tagChips}>
          {value.map((tag) => (
            <span key={tag} style={styles.tagChip}>
              {tag}
              <button
                style={styles.tagChipRemove}
                onClick={() => remove([tag])}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StepFrame(props: {
  step: number;
  title: string;
  footerDisabled?: boolean;
  footerLabel: string;
  footerLoading?: boolean;
  onFooter: () => void;
  children: React.ReactNode;
}) {
  const { step, title, footerDisabled, footerLabel, footerLoading, onFooter, children } = props;
  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>{title}</span>
      </div>

      <div style={styles.stepBadge}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span key={i} style={{ ...styles.stepDot, ...(i < step ? styles.stepDotActive : {}) }} />
        ))}
      </div>
      <div style={styles.stepLabel}>
        Шаг {step} из {TOTAL_STEPS}
      </div>

      {children}

      <div style={styles.footer}>
        <button
          onClick={onFooter}
          disabled={footerDisabled || footerLoading}
          style={{
            ...styles.primaryBtnBig,
            ...(footerDisabled || footerLoading ? styles.primaryBtnDisabled : {}),
          }}
        >
          {footerLoading ? 'Подбираем…' : footerLabel}
        </button>
      </div>
    </div>
  );
}

function useStepBack(target: string) {
  const navigate = useNavigate();
  return () => navigate(target);
}

// --- Шаг 1: магазин ----------------------------------------------------------

export function MenuStoreStep() {
  const navigate = useNavigate();
  const { menuStores, fetchMenuStoresAndAllergens, menuDraft, updateMenuDraft, clearMenu } =
    useValentinesStore();

  const availableStores = useMemo(
    () => menuStores.filter((s) => (s.available ?? true)),
    [menuStores]
  );

  useEffect(() => {
    void fetchMenuStoresAndAllergens();
    setMainButton({ isVisible: false });
    setBackButton(true, () => navigate(-1));
    clearMenu();
    return () => setBackButton(false);
  }, [navigate, fetchMenuStoresAndAllergens, clearMenu]);

  useEffect(() => {
    if (!menuDraft.storeId && availableStores.length > 0) {
      updateMenuDraft({ storeId: availableStores[0].id });
    }
  }, [menuDraft.storeId, availableStores, updateMenuDraft]);

  const pick = (id: MenuStoreId) => {
    hapticFeedback('selection');
    updateMenuDraft({ storeId: id });
  };

  const selectedStore = menuStores.find((s) => s.id === menuDraft.storeId) ?? null;
  const selectedAvailable = selectedStore ? (selectedStore.available ?? true) : false;

  return (
    <StepFrame step={1} title="Магазин" footerDisabled={!selectedAvailable} footerLabel="Далее" onFooter={() => navigate('/menu/people')}>
      <div style={styles.sectionTitle}>Где покупаем?</div>
      <div style={styles.sectionHint}>
        Цены и наличие считаем по этому магазину. Пока подбор работает только в «Евроопт» — там собраны реальные цены.
      </div>
      <div style={styles.storeGrid}>
        {menuStores.map((store) => {
          const available = store.available ?? true;
          const selected = store.id === menuDraft.storeId && available;
          return (
            <button
              key={store.id}
              style={{
                ...styles.storeCard,
                ...(selected ? styles.storeCardSelected : {}),
                ...(!available
                  ? {
                      opacity: 0.4,
                      cursor: 'default',
                      background: 'var(--surface-card)',
                      pointerEvents: 'none',
                    }
                  : {}),
              }}
              onClick={() => pick(store.id)}
              disabled={!available}
              title={available ? store.description : 'Подбор в этом магазине пока недоступен'}
              aria-disabled={!available}
            >
              <span style={{ ...styles.storeName, ...(!available ? { color: 'var(--ash)' } : {}) }}>
                <span>{store.emoji}</span>
                <span>{store.name}</span>
              </span>
              <span style={styles.storeDesc}>
                {available ? store.description : 'Скоро — цены не подключены'}
              </span>
            </button>
          );
        })}
      </div>
      {selectedStore?.priceCatalog === 'mock' && (
        <div style={styles.mockNote}>
          Сейчас используются демо-цены магазинов — итог примерный.
        </div>
      )}
      <div style={styles.mockNote}>
        Аллергены и кухонную утварь уточним на следующих шагах.
      </div>
    </StepFrame>
  );
}

// --- Шаг 2: члены семьи ------------------------------------------------------

export function MenuPeopleStep() {
  const navigate = useNavigate();
  const { menuDraft, updateMenuMembers } = useValentinesStore();
  const members = menuDraft.members;

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, () => navigate('/menu/store'));
    return () => setBackButton(false);
  }, [navigate]);

  const updateMember = (id: string, patch: Partial<MenuMember>) => {
    updateMenuMembers(members.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const toggleMeal = (m: MenuMember, meal: MenuMealId) => {
    hapticFeedback('selection');
    const meals = m.meals.includes(meal) ? m.meals.filter((x) => x !== meal) : [...m.meals, meal];
    updateMember(m.id, { meals });
  };

  const setQty = (m: MenuMember, next: number) => {
    hapticFeedback('selection');
    updateMember(m.id, { qty: Math.min(10, Math.max(1, next)) });
  };

  const addMember = () => {
    if (members.length >= 20) return;
    hapticFeedback('selection');
    const count = members.length;
    updateMenuMembers([
      ...members,
      {
        id: `m${count + 1}`,
        name: count === 0 ? 'Взрослый' : 'Ребёнок',
        group: count === 0 ? 'adult' : 'child',
        meals: ['breakfast', 'lunch', 'dinner'],
        qty: 1,
      },
    ]);
  };

  const removeMember = (id: string) => {
    if (members.length <= 1) return;
    hapticFeedback('selection');
    updateMenuMembers(members.filter((m) => m.id !== id));
  };

  const attending = members.filter((m) => m.meals.length > 0).length;
  const totalOk = attending >= 1;

  return (
    <StepFrame
      step={2}
      title="Члены семьи"
      footerDisabled={!totalOk}
      footerLabel="Далее"
      onFooter={() => navigate('/menu/components')}
    >
      <div style={styles.sectionTitle}>Кто будет есть?</div>
      <div style={styles.sectionHint}>
        Отметьте приёмы пищи для каждого и число порций. От этого зависит количество еды и цена на неделю.
      </div>
      {members.map((member) => (
        <div key={member.id} style={styles.memberCard}>
          <div style={styles.memberTop}>
            <input
              style={styles.memberNameInput}
              value={member.name}
              onChange={(e) => updateMember(member.id, { name: e.target.value })}
              placeholder="Имя"
              maxLength={60}
            />
            {members.length > 1 && (
              <button style={styles.memberRemove} onClick={() => removeMember(member.id)} aria-label="Убрать">
                ×
              </button>
            )}
          </div>
          <div style={styles.memberFieldLabel}>Кто это</div>
          <div style={styles.chipRow}>
            {(['adult', 'child'] as const).map((g) => {
              const selected = member.group === g;
              return (
                <button
                  key={g}
                  style={{ ...styles.chipSmall, ...(selected ? styles.chipSmallSelected : {}) }}
                  onClick={() => { hapticFeedback('selection'); updateMember(member.id, { group: g }); }}
                >
                  {g === 'adult' ? '👤 Взрослый' : '🧒 Ребёнок'}
                </button>
              );
            })}
          </div>
          <div style={styles.memberFieldLabel}>Ест на</div>
          <div style={styles.chipRow}>
            {(['breakfast', 'lunch', 'dinner'] as MenuMealId[]).map((meal) => {
              const selected = member.meals.includes(meal);
              return (
                <button
                  key={meal}
                  style={{ ...styles.chipSmall, ...(selected ? styles.chipSmallSelected : {}) }}
                  onClick={() => toggleMeal(member, meal)}
                >
                  {MEAL_TITLES[meal]}
                </button>
              );
            })}
          </div>
          <div style={styles.memberFieldLabel}>Порций за приём</div>
          <div style={styles.stepperRow}>
            <span style={styles.stepperLabel}>
              {member.group === 'child' ? '🧒 ' : '👤 '}{member.qty} {member.qty === 1 ? 'порция' : member.qty < 5 ? 'порции' : 'порций'}
            </span>
            <span style={styles.stepperControls}>
              <button
                style={{ ...styles.stepBtn, ...(member.qty === 1 ? styles.stepBtnDisabled : {}) }}
                onClick={() => setQty(member, member.qty - 1)}
                aria-label="Меньше"
              >
                −
              </button>
              <span style={styles.stepValue}>{member.qty}</span>
              <button
                style={{ ...styles.stepBtn, ...(member.qty >= 10 ? styles.stepBtnDisabled : {}) }}
                onClick={() => setQty(member, member.qty + 1)}
                aria-label="Больше"
              >
                +
              </button>
            </span>
          </div>
        </div>
      ))}
      <button style={styles.addMemberBtn} onClick={addMember}>
        + Добавить члена семьи
      </button>
      {!totalOk && (
        <div style={{ ...styles.errorBox, marginTop: 12 }}>
          У каждого члена семьи должен быть отмечен хотя бы один приём пищи.
        </div>
      )}
    </StepFrame>
  );
}

// --- Шаг 3: составляющие приёмов -------------------------------------------------

export function MenuComponentsStep() {
  const navigate = useNavigate();
  const { menuDraft, updateMenuDraft } = useValentinesStore();
  const back = useStepBack('/menu/people');

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, back);
    return () => setBackButton(false);
  }, [back]);

  const toggle = (meal: 'lunch' | 'dinner', role: MealComponentId) => {
    hapticFeedback('selection');
    const current = menuDraft.mealComponents[meal];
    const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
    updateMenuDraft({ mealComponents: { ...menuDraft.mealComponents, [meal]: next } });
  };

  const renderGroup = (meal: 'lunch' | 'dinner') => {
    const selected = menuDraft.mealComponents[meal];
    return (
      <div>
        <div style={styles.sectionTitle}>{meal === 'lunch' ? '🍲 Обед' : '🍛 Ужин'}</div>
        <div style={styles.sectionHint}>
          Выберите, из чего состоит {meal === 'lunch' ? 'обед' : 'ужин'}. Если ничего не отметить — приём будет из одного основного блюда.
        </div>
        <div style={styles.chipRow}>
          {MEAL_ROLES[meal].map((role) => {
            const on = selected.includes(role);
            return (
              <button
                key={role}
                style={{ ...styles.chipSmall, ...(on ? styles.chipSmallSelected : {}) }}
                onClick={() => toggle(meal, role)}
              >
                {ROLE_EMOJI[role]} {MEAL_COMPONENT_TITLES[role]}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <StepFrame
      step={3}
      title="Состав приёмов"
      footerLabel="Далее"
      onFooter={() => navigate('/menu/budget')}
    >
      {renderGroup('lunch')}
      <div style={{ marginTop: 18 }}></div>
      {renderGroup('dinner')}
      <div style={styles.mockNote}>
        Завтрак всегда состоит из одного блюда — выбор составляющих ему не нужен.
      </div>
    </StepFrame>
  );
}

// --- Шаг 3: бюджет -------------------------------------------------------------

export function MenuBudgetStep() {
  const navigate = useNavigate();
  const { menuDraft, updateMenuDraft } = useValentinesStore();
  const back = useStepBack('/menu/components');

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, back);
    return () => setBackButton(false);
  }, [back]);

  const budgetNumber = useMemo(() => {
    const n = parseFloat(menuDraft.budget.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [menuDraft.budget]);

  const familyMin = menuMinBudgetFor(menuDraft.adults, menuDraft.children);
  const belowMin = budgetNumber !== null && budgetNumber < familyMin;

  return (
    <StepFrame
      step={4}
      title="Бюджет"
      footerDisabled={budgetNumber === null}
      footerLabel="Далее"
      onFooter={() => navigate('/menu/cookware')}
    >
      <div style={styles.sectionTitle}>Сколько готовы потратить?</div>
      <div style={styles.sectionHint}>
        Сумма на продукты в выбранном магазине, BYN. Если укажете меньше {familyMin} BYN, блюда подберутся от этого минимума, а в результате увидите перерасход.
      </div>
      <input
        style={styles.budgetInput}
        inputMode="decimal"
        placeholder={`например, ${familyMin}`}
        value={menuDraft.budget}
        onChange={(e) => updateMenuDraft({ budget: normalizeBudgetInput(e.target.value) })}
      />
      {belowMin && (
        <div style={styles.errorBox}>
          Для вашего состава семьи минимум подбора — {familyMin} BYN в неделю. Меню подберётся от этой суммы, перерасход будет показан в результате.
        </div>
      )}
    </StepFrame>
  );
}

// --- Шаг 4: кухонная утварь ------------------------------------------------------

export function MenuCookwareStep() {
  const navigate = useNavigate();
  const { menuDraft, updateMenuDraft } = useValentinesStore();
  const back = useStepBack('/menu/budget');

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, back);
    return () => setBackButton(false);
  }, [back]);

  const toggle = (id: MenuCookwareId) => {
    hapticFeedback('selection');
    const next = new Set(menuDraft.cookware);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateMenuDraft({ cookware: [...next] });
  };

  return (
    <StepFrame
      step={5}
      title="Что есть на кухне"
      footerLabel="Далее"
      onFooter={() => navigate('/menu/allergens')}
    >
      <div style={styles.sectionTitle}>Отметьте кухонную утварь, которая у вас есть</div>
      <div style={styles.sectionHint}>
        Блюда, для которых нужна неотмеченная утварь, будут исключены из подбора. Например, без сковороды уберём жареные рецепты.
      </div>
      <div style={styles.cookwareGrid}>
        {MENU_COOKWARE.map((c) => {
          const selected = menuDraft.cookware.includes(c.id);
          return (
            <button
              key={c.id}
              style={{ ...styles.cookwareCard, ...(selected ? styles.cookwareCardSelected : {}) }}
              onClick={() => toggle(c.id)}
            >
              <span style={styles.cookwareEmoji}>{c.emoji}</span>
              <span style={styles.cookwareBody}>
                <span style={styles.cookwareTitle}>{c.title}</span>
                <span style={styles.cookwareHint}>{c.hint}</span>
              </span>
              <span style={{ fontSize: 16, color: 'var(--primary)', fontWeight: 800 }}>
                {selected ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>
      {menuDraft.cookware.length === 0 && (
        <div style={styles.mockNote}>Ничего не выбрано — подойдут любые рецепты.</div>
      )}
    </StepFrame>
  );
}

// --- Шаг 5: аллергии (финальный, запускает подбор) --------------------------------

export function MenuAllergensStep() {
  const navigate = useNavigate();
  const { menuAllergens, menuDraft, updateMenuDraft, generateMenuPlan, menuLoading } = useValentinesStore();
  const back = useStepBack('/menu/cookware');

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, back);
    return () => setBackButton(false);
  }, [back]);

  const toggleAllergen = (id: MenuAllergenId) => {
    hapticFeedback('selection');
    const next = new Set(menuDraft.allergens);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateMenuDraft({ allergens: [...next] });
  };

  const generate = async () => {
    if (!menuDraft.storeId || menuLoading) return;
    hapticFeedback('impact', 'light');
    const rawBudget = parseFloat(menuDraft.budget.replace(',', '.'));
    const familyBudget = Number.isFinite(rawBudget) && rawBudget > 0 ? rawBudget : menuMinBudgetFor(menuDraft.adults, menuDraft.children);
    const hasComponents =
      menuDraft.mealComponents.lunch.length > 0 || menuDraft.mealComponents.dinner.length > 0;
    const request: MenuRequest = {
      storeId: menuDraft.storeId,
      adults: menuDraft.adults,
      children: menuDraft.children,
      budget: familyBudget,
      currency: 'BYN',
      allergens: menuDraft.allergens,
      customAllergens: menuDraft.customAllergens,
      disliked: menuDraft.disliked,
      cookware: menuDraft.cookware,
      members: menuDraft.members.map((m) => ({
        id: m.id,
        name: m.name.trim() || (m.group === 'child' ? 'Ребёнок' : 'Взрослый'),
        group: m.group,
        meals: m.meals,
        qty: m.qty,
      })),
      mealComponents: hasComponents
        ? {
            lunch: [...menuDraft.mealComponents.lunch],
            dinner: [...menuDraft.mealComponents.dinner],
          }
        : undefined,
    };
    navigate('/menu/generating');
    void generateMenuPlan(request);
  };

  return (
    <StepFrame
      step={6}
      title="Аллергии"
      footerLabel="Подобрать меню"
      footerLoading={menuLoading}
      onFooter={() => void generate()}
    >
      <div style={styles.sectionTitle}>Что нужно исключить?</div>
      <div style={styles.sectionHint}>Рецепты с этими ингредиентами будут исключены из подбора</div>
      <div style={styles.allergenGrid}>
        {menuAllergens.map((a) => {
          const selected = menuDraft.allergens.includes(a.id);
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

      <div style={styles.tagSectionTitle}>Свои аллергии</div>
      <div style={styles.tagSectionHint}>
        Введите продукт или группу (например «грибы», «рыба») — выберите нужное из подсказок. Группа добавит все виды разом, но каждый можно убрать по отдельности.
      </div>
      <ProductSearchInput
        value={menuDraft.customAllergens}
        onChange={(tags) => updateMenuDraft({ customAllergens: tags })}
        placeholder="Поиск: курица, грибы, рыба…"
      />

      <div style={styles.tagSectionTitle}>Что не нравится</div>
      <div style={styles.tagSectionHint}>
        Нелюбимые продукты тоже будут исключены из блюд на неделю. Можно добавить целую группу, а конкретные виды убрать из списка.
      </div>
      <ProductSearchInput
        value={menuDraft.disliked}
        onChange={(tags) => updateMenuDraft({ disliked: tags })}
        placeholder="Поиск: печень, кабачки, орехи…"
      />
    </StepFrame>
  );
}