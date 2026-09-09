import { CSSProperties, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';
import {
  NOTE_CATEGORIES,
  NoteCategory,
  COUPLE_EVENT_TYPES,
  CoupleEventType,
  Recurrence,
} from '../types';
import { setMainButton, setBackButton, hapticFeedback } from '../utils/telegram';
import { BackButton } from '../components/BackButton';

type Tab = 'notes' | 'reminders' | 'events';

const CATEGORY_COLORS: Record<NoteCategory, string> = {
  idea: '#ffe9c9',
  todo: '#d8f0dc',
  memory: '#d8e7ff',
  wish: '#ffd7e4',
};

export function NotesScreen() {
  const navigate = useNavigate();
  const {
    notes,
    reminders,
    events,
    fetchNotes,
    fetchReminders,
    fetchEvents,
    createNote,
    toggleNotePin,
    deleteNote,
    createReminder,
    deleteReminder,
    createEvent,
    deleteEvent,
  } = useValentinesStore();

  const [tab, setTab] = useState<Tab>('notes');
  const [showComposer, setShowComposer] = useState(false);

  useEffect(() => {
    void fetchNotes();
    void fetchReminders();
    void fetchEvents();
    const onBackClick = () => navigate(-1);
    setBackButton(true, onBackClick);
    setMainButton({ isVisible: false });
    return () => setBackButton(false);
  }, [fetchNotes, fetchReminders, fetchEvents, navigate]);

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <BackButton />
        <span style={styles.title}>Заметки</span>
      </div>

      <div style={styles.tabs}>
        {(
          [
            { key: 'notes', label: `Заметки (${notes.length})` },
            { key: 'reminders', label: `Напоминания (${reminders.length})` },
            { key: 'events', label: `События (${events.length})` },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setShowComposer(false);
              hapticFeedback('selection');
            }}
            style={{
              ...styles.tab,
              background: tab === t.key ? 'var(--ink)' : 'transparent',
              color: tab === t.key ? '#fff' : 'var(--ink-secondary)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'notes' && (
        <NotesTab
          showComposer={showComposer}
          setShowComposer={setShowComposer}
          onCreate={createNote}
          onTogglePin={toggleNotePin}
          onDelete={deleteNote}
        />
      )}
      {tab === 'reminders' && (
        <RemindersTab showComposer={showComposer} setShowComposer={setShowComposer} onCreate={createReminder} onDelete={deleteReminder} />
      )}
      {tab === 'events' && (
        <EventsTab showComposer={showComposer} setShowComposer={setShowComposer} onCreate={createEvent} onDelete={deleteEvent} />
      )}
    </div>
  );
}

function NotesTab({
  showComposer,
  setShowComposer,
  onCreate,
  onTogglePin,
  onDelete,
}: {
  showComposer: boolean;
  setShowComposer: (v: boolean) => void;
  onCreate: (content: string, category: NoteCategory) => Promise<unknown>;
  onTogglePin: (id: string, isPinned: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { notes } = useValentinesStore();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoteCategory>('idea');

  const sorted = [...notes].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));

  const save = async () => {
    const text = content.trim();
    if (!text) return;
    await onCreate(text, category);
    setContent('');
    setShowComposer(false);
    hapticFeedback('notification', 'success');
  };

  return (
    <div style={styles.tabBody}>
      {showComposer && (
        <div style={styles.composer}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="О чём хотите друг друга не забыть?"
            rows={3}
            style={styles.noteInput}
            autoFocus
          />
          <div style={styles.chipRow}>
            {NOTE_CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                style={{
                  ...styles.chip,
                  background: category === c.value ? CATEGORY_COLORS[c.value] : 'var(--surface-card)',
                  border: category === c.value ? '2px solid var(--ink)' : '1px solid var(--hairline)',
                }}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
          <button onClick={() => void save()} disabled={!content.trim()} style={styles.saveBtn}>
            Сохранить
          </button>
        </div>
      )}

      {sorted.length === 0 && !showComposer && (
        <p style={styles.empty}>Пока пусто. Добавьте первую заметку 👇</p>
      )}

      {sorted.map((note) => {
        const cat = NOTE_CATEGORIES.find((c) => c.value === note.category);
        return (
          <div key={note.id} style={styles.card}>
            <div style={styles.cardRow}>
              <span style={{ ...styles.cardChip, background: CATEGORY_COLORS[note.category] }}>
                {cat?.icon} {cat?.label}
              </span>
              <div style={styles.cardActions}>
                <button onClick={() => void onTogglePin(note.id, !note.is_pinned)} title="Закрепить" style={styles.iconBtn}>
                  {note.is_pinned ? '📌' : '📍'}
                </button>
                <button onClick={() => void onDelete(note.id)} title="Удалить" style={styles.iconBtn}>
                  🗑️
                </button>
              </div>
            </div>
            <p style={styles.cardText}>{note.content}</p>
            <span style={styles.cardDate}>{formatDate(note.created_at)}</span>
          </div>
        );
      })}

      {!showComposer && (
        <button onClick={() => setShowComposer(true)} style={styles.addBtn}>
          <span style={styles.addPlus}>+</span> Добавить заметку
        </button>
      )}
    </div>
  );
}

function RemindersTab({
  showComposer,
  setShowComposer,
  onCreate,
  onDelete,
}: {
  showComposer: boolean;
  setShowComposer: (v: boolean) => void;
  onCreate: (input: { title: string; message?: string | null; remind_at: string; is_recurring?: boolean; recurrence?: Recurrence | null }) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { reminders } = useValentinesStore();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [when, setWhen] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence | 'none'>('none');

  const save = async () => {
    if (!title.trim() || !when) return;
    await onCreate({
      title: title.trim(),
      message: message.trim() || null,
      remind_at: new Date(when).toISOString(),
      is_recurring: recurrence !== 'none',
      recurrence: recurrence === 'none' ? null : recurrence,
    });
    setTitle('');
    setMessage('');
    setWhen('');
    setRecurrence('none');
    setShowComposer(false);
    hapticFeedback('notification', 'success');
  };

  const sorted = [...reminders].sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime());

  return (
    <div style={styles.tabBody}>
      {showComposer && (
        <div style={styles.composer}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок (напр. Купить цветы)" style={styles.input} />
          <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Сообщение (необязательно)" style={styles.input} />
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            style={styles.input}
          />
          <div style={styles.chipRow}>
            {(
              [
                { key: 'none', label: 'Один раз' },
                { key: 'yearly', label: 'Каждый год' },
                { key: 'monthly', label: 'Каждый месяц' },
              ] as { key: Recurrence | 'none'; label: string }[]
            ).map((r) => (
              <button
                key={r.key}
                onClick={() => setRecurrence(r.key)}
                style={{
                  ...styles.chip,
                  background: recurrence === r.key ? 'var(--surface-card)' : 'transparent',
                  border: recurrence === r.key ? '2px solid var(--ink)' : '1px solid var(--hairline)',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={() => void save()} disabled={!title.trim() || !when} style={styles.saveBtn}>
            Сохранить напоминание
          </button>
        </div>
      )}

      {sorted.length === 0 && !showComposer && (
        <p style={styles.empty}>Напоминаний пока нет. Добавьте первое 👇</p>
      )}

      {sorted.map((r) => (
        <div key={r.id} style={{ ...styles.card, opacity: r.is_sent ? 0.55 : 1 }}>
          <div style={styles.cardRow}>
            <span style={styles.reminderTitle}>⏰ {r.title}</span>
            <button onClick={() => void onDelete(r.id)} title="Удалить" style={styles.iconBtn}>
              🗑️
            </button>
          </div>
          {r.message && <p style={styles.cardText}>{r.message}</p>}
          <div style={styles.cardMeta}>
            <span style={styles.cardDate}>{formatDateTime(r.remind_at)}</span>
            {r.is_recurring && <span style={styles.recurBadge}>{r.recurrence === 'yearly' ? 'ежегодно' : 'ежемесячно'}</span>}
            {r.is_sent && <span style={styles.sentBadge}>отправлено</span>}
          </div>
        </div>
      ))}

      {!showComposer && (
        <button onClick={() => setShowComposer(true)} style={styles.addBtn}>
          <span style={styles.addPlus}>+</span> Добавить напоминание
        </button>
      )}
    </div>
  );
}

function EventsTab({
  showComposer,
  setShowComposer,
  onCreate,
  onDelete,
}: {
  showComposer: boolean;
  setShowComposer: (v: boolean) => void;
  onCreate: (input: { name: string; event_date: string; event_type: CoupleEventType; remind_days_before?: number }) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { events } = useValentinesStore();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [eventType, setEventType] = useState<CoupleEventType>('first_date');
  const [remindDays, setRemindDays] = useState(1);

  const save = async () => {
    if (!name.trim() || !date) return;
    await onCreate({
      name: name.trim(),
      event_date: date,
      event_type: eventType,
      remind_days_before: remindDays,
    });
    setName('');
    setDate('');
    setEventType('first_date');
    setRemindDays(1);
    setShowComposer(false);
    hapticFeedback('notification', 'success');
  };

  const sorted = [...events].sort((a, b) => a.event_date.localeCompare(b.event_date));

  return (
    <div style={styles.tabBody}>
      {showComposer && (
        <div style={styles.composer}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название (напр. Годовщина свадьбы)" style={styles.input} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
          <div style={styles.chipRow}>
            {COUPLE_EVENT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setEventType(t.value)}
                style={{
                  ...styles.chip,
                  background: eventType === t.value ? 'var(--surface-card)' : 'transparent',
                  border: eventType === t.value ? '2px solid var(--ink)' : '1px solid var(--hairline)',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div style={styles.fieldRow}>
            <label style={styles.fieldLabel}>Напомнить за</label>
            <select
              value={remindDays}
              onChange={(e) => setRemindDays(Number(e.target.value))}
              style={styles.select}
            >
              <option value={0}>в день события</option>
              <option value={1}>1 день</option>
              <option value={3}>3 дня</option>
              <option value={7}>неделю</option>
            </select>
          </div>
          <button onClick={() => void save()} disabled={!name.trim() || !date} style={styles.saveBtn}>
            Сохранить событие
          </button>
        </div>
      )}

      {sorted.length === 0 && !showComposer && (
        <p style={styles.empty}>Событий пока нет. Добавьте первое 👇</p>
      )}

      {sorted.map((e) => {
        const t = COUPLE_EVENT_TYPES.find((x) => x.value === e.event_type);
        return (
          <div key={e.id} style={styles.card}>
            <div style={styles.cardRow}>
              <span style={styles.reminderTitle}>
                {t?.icon} {e.name}
              </span>
              <button onClick={() => void onDelete(e.id)} title="Удалить" style={styles.iconBtn}>
                🗑️
              </button>
            </div>
            <div style={styles.cardMeta}>
              <span style={styles.eventDate}>{formatEventDate(e.event_date)}</span>
              {e.remind_days_before > 0 && (
                <span style={styles.recurBadge}>напомнить за {e.remind_days_before} дн.</span>
              )}
            </div>
          </div>
        );
      })}

      {!showComposer && (
        <button onClick={() => setShowComposer(true)} style={styles.addBtn}>
          <span style={styles.addPlus}>+</span> Добавить событие
        </button>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatEventDate(date: string): string {
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    maxWidth: 480,
    margin: '0 auto',
    minHeight: '100vh',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 44,
    position: 'relative',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--ink)',
    marginLeft: 48,
    zIndex: 1,
  },
  tabs: {
    display: 'flex',
    gap: 6,
    background: 'var(--surface-card)',
    borderRadius: 999,
    padding: 4,
  },
  tab: {
    flex: 1,
    padding: '9px 4px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    transition: 'background .2s ease',
  },
  tabBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  composer: {
    background: 'var(--surface-card)',
    borderRadius: 20,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    border: '1px solid var(--hairline)',
  },
  noteInput: {
    resize: 'none',
    fontSize: 15,
    lineHeight: 1.5,
    color: 'var(--ink)',
  },
  input: {
    fontSize: 15,
    color: 'var(--ink)',
    borderBottom: '1px solid var(--hairline)',
    padding: '6px 0',
    background: 'transparent',
    width: '100%',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  chip: {
    padding: '7px 12px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--ink)',
    outline: 'none',
  },
  saveBtn: {
    marginTop: 4,
    padding: '12px',
    borderRadius: 999,
    background: 'var(--ink)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
  },
  saveBtnDisabled: {},
  card: {
    background: 'var(--surface-card)',
    borderRadius: 18,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    border: '1px solid var(--hairline)',
  },
  cardRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardChip: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ink)',
  },
  cardActions: {
    display: 'flex',
    gap: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    background: 'var(--secondary-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 1.5,
    color: 'var(--ink)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  cardDate: {
    fontSize: 12,
    color: 'var(--ink-secondary)',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--ink)',
  },
  eventDate: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ink)',
  },
  recurBadge: {
    fontSize: 12,
    padding: '3px 9px',
    borderRadius: 999,
    background: 'var(--secondary-bg)',
    color: 'var(--ink-secondary)',
  },
  sentBadge: {
    fontSize: 12,
    padding: '3px 9px',
    borderRadius: 999,
    background: '#d8f0dc',
    color: '#0a5c1e',
    fontWeight: 600,
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  fieldLabel: {
    fontSize: 13,
    color: 'var(--ink-secondary)',
    whiteSpace: 'nowrap',
  },
  select: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid var(--hairline)',
    background: 'var(--surface-elevated)',
    color: 'var(--ink)',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '14px',
    borderRadius: 999,
    background: 'transparent',
    border: '1.5px dashed var(--stone)',
    color: 'var(--ink)',
    fontSize: 15,
    fontWeight: 600,
    marginTop: 4,
  },
  addPlus: {
    fontSize: 20,
    lineHeight: 1,
  },
  empty: {
    textAlign: 'center',
    fontSize: 14,
    color: 'var(--ink-secondary)',
    padding: '24px 0',
  },
};