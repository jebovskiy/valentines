import { CSSProperties, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { setMainButton, setBackButton, hapticFeedback } from '../utils/telegram';
import { BackButton } from '../components/BackButton';

const ASPECT_DEFS: { key: string; label: string; hint: string }[] = [
  { key: 'visual', label: 'Картинка', hint: 'визуальный стиль, операторская работа' },
  { key: 'plot', label: 'Сюжет', hint: 'история, непредсказуемость, глубина' },
  { key: 'acting', label: 'Актёры', hint: 'игра, харизма, убедительность' },
  { key: 'music', label: 'Музыка', hint: 'саундтрек и звук' },
  { key: 'atmosphere', label: 'Атмосфера', hint: 'настроение, погружение' },
  { key: 'humor', label: 'Юмор', hint: 'комедийная составляющая' },
];

const WEIGHT_LABELS: Record<number, string> = {
  1: 'вообще не важно',
  2: 'не очень важно',
  3: 'нормально',
  4: 'важно',
  5: 'критично',
};

export function TasteProfileScreen() {
  const navigate = useNavigate();
  const { tasteProfile, fetchTasteProfile, saveTasteProfile } = useValentinesStore();
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      await fetchTasteProfile();
      setLoaded(true);
    })();
    setMainButton({ isVisible: false });
    setBackButton(true, () => {
      if (window.history.length > 1) navigate(-1);
      else navigate('/movies');
    });
  }, [fetchTasteProfile, navigate]);

  useEffect(() => {
    if (loaded && tasteProfile) {
      const next: Record<string, number> = {};
      for (const a of ASPECT_DEFS) next[a.key] = tasteProfile.aspect_weights[a.key] ?? 3;
      setWeights(next);
    }
  }, [loaded, tasteProfile]);

  const setVal = (key: string, v: number) => setWeights((prev) => ({ ...prev, [key]: v }));

  const handleSave = async () => {
    setSaving(true);
    const ok = await saveTasteProfile(weights);
    setSaving(false);
    if (ok) {
      setMessage('Профиль вкуса сохранён ✓');
      hapticFeedback('notification', 'success');
      setTimeout(() => setMessage(null), 2000);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>Мой вкус</span>
      </div>

      <p style={styles.subtitle}>
        Расскажите, что для вас важно в фильмах (от 1 до 5). На основе этого мы посчитаем совпадение вкусов с каждым фильмом.
      </p>

      <div style={styles.form}>
        {ASPECT_DEFS.map((a) => (
          <div key={a.key} style={styles.sliderCard}>
            <div style={styles.sliderHeader}>
              <span style={styles.sliderLabel}>{a.label}</span>
              <span style={styles.sliderVal}>{weights[a.key] ?? 3}/5</span>
            </div>
            <p style={styles.sliderHint}>{a.hint}</p>
            <input
              type="range"
              min={1}
              max={5}
              value={weights[a.key] ?? 3}
              onChange={(e) => setVal(a.key, Number(e.target.value))}
              style={styles.slider}
            />
            <p style={styles.weightWord}>{WEIGHT_LABELS[weights[a.key] ?? 3]}</p>
          </div>
        ))}

        {message && <p style={styles.message}>{message}</p>}

        <button onClick={() => void handleSave()} disabled={saving} style={styles.saveBtn}>
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  topBar: { display: 'flex', alignItems: 'center', gap: 8, height: 44, position: 'relative' },
  title: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 18, fontWeight: 700, color: 'var(--ink)', zIndex: 1, pointerEvents: 'none' },
  subtitle: { fontSize: 14, color: 'var(--ink-secondary)', lineHeight: 1.4 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  sliderCard: {
    background: 'var(--surface-card)', borderRadius: 16, padding: '12px 14px',
    border: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column', gap: 6,
  },
  sliderHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sliderLabel: { fontSize: 15, fontWeight: 700, color: 'var(--ink)' },
  sliderVal: { fontSize: 14, fontWeight: 700, color: 'var(--ink)' },
  sliderHint: { fontSize: 12, color: 'var(--ink-secondary)' },
  slider: { flex: 1, accentColor: 'var(--ink)' },
  weightWord: { fontSize: 12, color: 'var(--ink-secondary)', fontStyle: 'italic' },
  message: { textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#0a5c1e', padding: '4px 0' },
  saveBtn: {
    padding: '14px', borderRadius: 999, background: 'var(--ink)', color: '#fff',
    fontSize: 15, fontWeight: 700, border: 'none',
  },
};