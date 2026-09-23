import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../../hooks/useValentinesStore';
import { MENU_COOKWARE } from '../../types';
import type { MenuAllergenId, MenuCookwareId, MenuRequest, MenuStoreId } from '../../types';
import { setMainButton, setBackButton, hapticFeedback } from '../../utils/telegram';
import { BackButton } from '../../components/BackButton';

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
};

const TOTAL_STEPS = 5;

function TagInput(props: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const { value, onChange, placeholder } = props;
  const [text, setText] = useState('');

  const add = (raw: string) => {
    const tag = raw.replace(/[0-9]/g, '').trim();
    if (!tag) return;
    onChange(value.includes(tag) ? value : [...value, tag]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      add(text);
      setText('');
    }
  };

  return (
    <div>
      <input
        style={styles.tagInput}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          add(text);
          setText('');
        }}
        placeholder={placeholder}
      />
      {value.length > 0 && (
        <div style={styles.tagChips}>
          {value.map((tag) => (
            <span key={tag} style={styles.tagChip}>
              {tag}
              <button
                style={styles.tagChipRemove}
                onClick={() => onChange(value.filter((t) => t !== tag))}
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

  useEffect(() => {
    void fetchMenuStoresAndAllergens();
    setMainButton({ isVisible: false });
    setBackButton(true, () => navigate(-1));
    clearMenu();
    return () => setBackButton(false);
  }, [navigate, fetchMenuStoresAndAllergens, clearMenu]);

  useEffect(() => {
    if (!menuDraft.storeId && menuStores.length > 0) {
      updateMenuDraft({ storeId: menuStores[0].id });
    }
  }, [menuDraft.storeId, menuStores, updateMenuDraft]);

  const pick = (id: MenuStoreId) => {
    hapticFeedback('selection');
    updateMenuDraft({ storeId: id });
  };

  const selectedStore = menuStores.find((s) => s.id === menuDraft.storeId) ?? null;

  return (
    <StepFrame step={1} title="Магазин" footerDisabled={!menuDraft.storeId} footerLabel="Далее" onFooter={() => navigate('/menu/people')}>
      <div style={styles.sectionTitle}>Где покупаем?</div>
      <div style={styles.sectionHint}>Цены и наличие считаем по этому магазину</div>
      <div style={styles.storeGrid}>
        {menuStores.map((store) => {
          const selected = store.id === menuDraft.storeId;
          return (
            <button
              key={store.id}
              style={{ ...styles.storeCard, ...(selected ? styles.storeCardSelected : {}) }}
              onClick={() => pick(store.id)}
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

// --- Шаг 2: персоны ----------------------------------------------------------

export function MenuPeopleStep() {
  const navigate = useNavigate();
  const { menuDraft, updateMenuDraft } = useValentinesStore();

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, () => navigate('/menu/store'));
    return () => setBackButton(false);
  }, [navigate]);

  const setAdults = (next: number) => updateMenuDraft({ adults: Math.min(20, Math.max(0, next)) });
  const setChildren = (next: number) => updateMenuDraft({ children: Math.min(20, Math.max(0, next)) });

  const totalOk = menuDraft.adults + menuDraft.children >= 1;

  return (
    <StepFrame
      step={2}
      title="Кто будет есть"
      footerDisabled={!totalOk}
      footerLabel="Далее"
      onFooter={() => navigate('/menu/budget')}
    >
      <div style={styles.sectionTitle}>Состав семьи</div>
      <div style={styles.sectionHint}>Детские порции считаются меньше взрослых</div>
      <div style={styles.stepperRow}>
        <span style={styles.stepperLabel}>👤 Взрослые</span>
        <span style={styles.stepperControls}>
          <button
            style={{ ...styles.stepBtn, ...(menuDraft.adults === 0 ? styles.stepBtnDisabled : {}) }}
            onClick={() => { hapticFeedback('selection'); setAdults(menuDraft.adults - 1); }}
            aria-label="Меньше"
          >
            −
          </button>
          <span style={styles.stepValue}>{menuDraft.adults}</span>
          <button style={styles.stepBtn} onClick={() => { hapticFeedback('selection'); setAdults(menuDraft.adults + 1); }} aria-label="Больше">
            +
          </button>
        </span>
      </div>
      <div style={styles.stepperRow}>
        <span style={styles.stepperLabel}>🧒 Дети</span>
        <span style={styles.stepperControls}>
          <button
            style={{ ...styles.stepBtn, ...(menuDraft.children === 0 ? styles.stepBtnDisabled : {}) }}
            onClick={() => { hapticFeedback('selection'); setChildren(menuDraft.children - 1); }}
            aria-label="Меньше"
          >
            −
          </button>
          <span style={styles.stepValue}>{menuDraft.children}</span>
          <button style={styles.stepBtn} onClick={() => { hapticFeedback('selection'); setChildren(menuDraft.children + 1); }} aria-label="Больше">
            +
          </button>
        </span>
      </div>
    </StepFrame>
  );
}

// --- Шаг 3: бюджет -------------------------------------------------------------

export function MenuBudgetStep() {
  const navigate = useNavigate();
  const { menuDraft, updateMenuDraft } = useValentinesStore();
  const back = useStepBack('/menu/people');

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, back);
    return () => setBackButton(false);
  }, [back]);

  const budgetNumber = useMemo(() => {
    const n = parseFloat(menuDraft.budget.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [menuDraft.budget]);

  return (
    <StepFrame
      step={3}
      title="Бюджет"
      footerDisabled={budgetNumber === null}
      footerLabel="Далее"
      onFooter={() => navigate('/menu/cookware')}
    >
      <div style={styles.sectionTitle}>Сколько готовы потратить?</div>
      <div style={styles.sectionHint}>Сумма на продукты в выбранном магазине, BYN</div>
      <input
        style={styles.budgetInput}
        inputMode="decimal"
        placeholder="например, 40"
        value={menuDraft.budget}
        onChange={(e) => updateMenuDraft({ budget: e.target.value.replace(/[^\d.,]/g, '') })}
      />
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
      step={4}
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
  const [screenError, setScreenError] = useState<string | null>(null);

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
    setScreenError(null);
    const request: MenuRequest = {
      storeId: menuDraft.storeId,
      adults: menuDraft.adults,
      children: menuDraft.children,
      budget: parseFloat(menuDraft.budget.replace(',', '.')) || 0,
      currency: 'BYN',
      allergens: menuDraft.allergens,
      customAllergens: menuDraft.customAllergens,
      disliked: menuDraft.disliked,
      cookware: menuDraft.cookware,
    };
    const result = await generateMenuPlan(request);
    if (!result) {
      setScreenError(useValentinesStore.getState().error || 'Не удалось подобрать меню. Попробуйте ещё раз.');
      return;
    }
    if ('code' in result) {
      const issue = result;
      if (issue.code === 'budget_too_low' && issue.minCost !== undefined) {
        setScreenError(`Бюджет слишком мал: самое дешёвое блюдо — ${issue.minCost.toFixed(2)} BYN`);
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
    <StepFrame
      step={5}
      title="Аллергии"
      footerLabel="Подобрать меню"
      footerLoading={menuLoading}
      onFooter={() => void generate()}
    >
      <div style={styles.sectionTitle}>Что нужно исключить?</div>
      <div style={styles.sectionHint}>Рецепты с этими ингредиентами будут исключены из подбора</div>
      {screenError && <div style={styles.errorBox}>{screenError}</div>}
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
        Если аллергия не в списке — впишите продукт (например «курица», «консервы», «грибы»). Разделяйте слова пробелом или запятой.
      </div>
      <TagInput
        value={menuDraft.customAllergens}
        onChange={(tags) => updateMenuDraft({ customAllergens: tags })}
        placeholder="Например: курица, грибы"
      />

      <div style={styles.tagSectionTitle}>Что не нравится</div>
      <div style={styles.tagSectionHint}>
        Нелюбимые продукты тоже будут исключены из блюд на неделю.
      </div>
      <TagInput
        value={menuDraft.disliked}
        onChange={(tags) => updateMenuDraft({ disliked: tags })}
        placeholder="Например: печень, кабачки"
      />
    </StepFrame>
  );
}