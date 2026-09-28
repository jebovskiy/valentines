import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import type { MenuLeftover, MenuUnit } from '../types';
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
  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    height: 44,
    borderRadius: 12,
    border: '1px solid var(--hairline)',
    background: 'var(--surface-card)',
    color: 'var(--ink)',
    fontSize: 15,
    padding: '0 14px',
    outline: 'none',
  },
  searchResults: {
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
  },
  searchRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    width: '100%',
    textAlign: 'left',
    padding: '12px 14px',
    border: 'none',
    borderBottom: '1px solid var(--hairline)',
    background: 'transparent',
    cursor: 'pointer',
  },
  searchName: {
    fontSize: 14,
    color: 'var(--ink)',
    flex: 1,
    minWidth: 0,
  },
  searchUnit: {
    fontSize: 12,
    color: 'var(--ash)',
    marginLeft: 6,
  },
  searchEmpty: {
    padding: '12px 14px',
    fontSize: 13,
    color: 'var(--ash)',
  },
  addBtn: {
    color: 'var(--primary)',
    fontSize: 18,
    fontWeight: 700,
    flexShrink: 0,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: 'var(--ink)',
    margin: '14px 0 8px',
  },
  row: {
    background: 'var(--surface-card)',
    borderRadius: 16,
    padding: '12px 14px',
    border: '1px solid var(--hairline)',
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  rowHint: {
    fontSize: 12,
    color: 'var(--ash)',
    marginTop: 2,
  },
  qtyInput: {
    width: 64,
    height: 36,
    borderRadius: 10,
    border: '1px solid var(--hairline)',
    background: 'var(--surface-card)',
    color: 'var(--ink)',
    fontSize: 14,
    textAlign: 'center',
    outline: 'none',
  },
  unitSelect: {
    height: 36,
    borderRadius: 10,
    border: '1px solid var(--hairline)',
    background: 'var(--surface-card)',
    color: 'var(--ink)',
    fontSize: 13,
    padding: '0 8px',
    outline: 'none',
  },
  removeBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--danger, #e5484d)',
    fontSize: 16,
    cursor: 'pointer',
    padding: '4px 6px',
    flexShrink: 0,
  },
  ghostBtn: {
    width: '100%',
    height: 44,
    borderRadius: 999,
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    color: 'var(--primary)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
  },
  ghostBtnSmall: {
    width: '100%',
    height: 40,
    borderRadius: 12,
    background: 'var(--surface-card)',
    border: '1px solid var(--hairline)',
    color: 'var(--primary)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
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
    marginTop: 14,
  },
  disabled: {
    opacity: 0.45,
  },
};

const UNIT_LABELS: Record<MenuUnit, string> = { g: 'гр', ml: 'мл', pcs: 'шт' };

export function MenuLeftoversScreen() {
  const navigate = useNavigate();
  const {
    menuLeftovers,
    menuLeftoversLoading,
    fetchMenuLeftovers,
    saveMenuLeftovers,
    suggestMenuLeftovers,
    searchMenuIngredients,
    menuLoading,
  } = useValentinesStore();

  const [draft, setDraft] = useState<MenuLeftover[]>([]);
  const [namesById, setNamesById] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [results, setResults] = useState<{ id: string; name: string; unit: string }[]>([]);
  const [saved, setSaved] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    setMainButton({ isVisible: false });
    setBackButton(true, () => {
      void (async () => {
        if (dirtyRef.current) {
          await saveMenuLeftovers(draftRef.current.filter((i) => i.qty > 0));
        }
        navigate(-1);
      })();
    });
    return () => setBackButton(false);
  }, [navigate, saveMenuLeftovers]);

  useEffect(() => {
    if (menuLeftovers.length === 0) void fetchMenuLeftovers();
  }, [fetchMenuLeftovers]);

  useEffect(() => {
    if (!dirty) setDraft(menuLeftovers);
  }, [dirty, menuLeftovers]);

  const search = async (raw: string) => {
    const q = raw.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const res = await searchMenuIngredients(q);
    setResults(res.results);
  };

  const addFromResults = (r: { id: string; name: string; unit: string }) => {
    if (draft.some((i) => i.ingredientId === r.id)) return;
    setNamesById((n) => ({ ...n, [r.id]: r.name }));
    setDraft((d) => [...d, { ingredientId: r.id, qty: 1, unit: r.unit as MenuUnit }]);
    setText('');
    setResults([]);
    setSaved(false);
    setDirty(true);
  };

  const importSuggestions = async () => {
    setSuggesting(true);
    const items = await suggestMenuLeftovers();
    setSuggesting(false);
    if (items.length === 0) return;
    setNamesById((n) => {
      const next = { ...n };
      for (const item of items) next[item.ingredientId] = item.name;
      return next;
    });
    setDraft((d) => {
      const existing = new Set(d.map((i) => i.ingredientId));
      const merged = [...d];
      for (const item of items) {
        if (existing.has(item.ingredientId)) {
          const idx = merged.findIndex((i) => i.ingredientId === item.ingredientId);
          if (idx >= 0) merged[idx] = { ...merged[idx], qty: merged[idx].qty + item.qty };
        } else {
          merged.push({ ingredientId: item.ingredientId, qty: item.qty, unit: item.unit });
        }
      }
      return merged;
    });
    setSaved(false);
    setDirty(true);
  };

  const save = async () => {
    const ok = await saveMenuLeftovers(draft.filter((i) => i.qty > 0));
    if (ok) {
      setSaved(true);
      setDirty(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>Мои запасы</span>
      </div>

      <div style={styles.infoBox}>
        Укажите продукты, которые уже есть дома. Чек следующего меню автоматически вычтет их, и вы купите только недостающее.
      </div>

      <input
        style={styles.searchInput}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          void search(e.target.value);
        }}
        placeholder="Например: картофель, рис…"
        autoCapitalize="off"
        autoCorrect="off"
      />
      {text.trim().length >= 2 && (
        <div style={styles.searchResults}>
          {results.length === 0 && <div style={styles.searchEmpty}>Ничего не найдено в каталоге продуктов</div>}
          {results.map((r) => {
            const added = draft.some((i) => i.ingredientId === r.id);
            return (
              <button key={r.id} style={styles.searchRow} onClick={() => addFromResults(r)} disabled={added}>
                <span style={styles.searchName}>
                  {r.name}
                  <span style={styles.searchUnit}>{UNIT_LABELS[r.unit as MenuUnit] ?? r.unit}</span>
                </span>
                <span style={styles.addBtn}>{added ? '✓' : '+'}</span>
              </button>
            );
          })}
        </div>
      )}

      {draft.length > 0 && (
        <>
          <div style={styles.groupTitle}>В наличии · {draft.length}</div>
          {draft.map((item) => {
            const name =
              item.name ??
              namesById[item.ingredientId] ??
              results.find((r) => r.id === item.ingredientId)?.name ??
              item.ingredientId;
            return (
              <div key={item.ingredientId} style={styles.row}>
                <div style={styles.rowBody}>
                  <div style={styles.rowName}>{name}</div>
                  <div style={styles.rowHint}>останется учтено при генерации</div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  style={styles.qtyInput}
                  value={item.qty}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setDraft((d) =>
                      d.map((i) => (i.ingredientId === item.ingredientId ? { ...i, qty: Number.isFinite(v) ? v : 0 } : i))
                    );
                    setSaved(false);
                    setDirty(true);
                  }}
                />
                <select
                  style={styles.unitSelect}
                  value={item.unit}
                  onChange={(e) => {
                    setDraft((d) =>
                      d.map((i) => (i.ingredientId === item.ingredientId ? { ...i, unit: e.target.value as MenuUnit } : i))
                    );
                    setSaved(false);
                    setDirty(true);
                  }}
                >
                  {(['g', 'ml', 'pcs'] as MenuUnit[]).map((u) => (
                    <option key={u} value={u}>{UNIT_LABELS[u]}</option>
                  ))}
                </select>
                <button
                  style={styles.removeBtn}
                  onClick={() => {
                    setDraft((d) => d.filter((i) => i.ingredientId !== item.ingredientId));
                    setSaved(false);
                    setDirty(true);
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}

          <button style={styles.ghostBtn} onClick={() => void importSuggestions()} disabled={suggesting}>
            {suggesting ? 'Считаем…' : 'Предложить из последнего меню'}
          </button>
        </>
      )}

      {draft.length === 0 && !menuLeftoversLoading && !suggesting && (
        <button style={styles.ghostBtn} onClick={() => void importSuggestions()}>
          Предложить из последнего меню
        </button>
      )}

      {saved && <div style={{ fontSize: 13, color: '#2e9e56', marginTop: 10, textAlign: 'center' }}>Запасы сохранены ✓</div>}

      <button
        onClick={() => void save()}
        disabled={menuLoading || suggesting}
        style={{ ...styles.primaryBtnBig, ...((menuLoading || suggesting) ? styles.disabled : {}) }}
      >
        Сохранить запасы
      </button>
    </div>
  );
}