export function formatFeedTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isSameDay) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 1) return 'вчера';

  const weekdayNames = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  if (diffDays < 7) return weekdayNames[date.getDay()];

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const time = `${hh}:${mm}`;

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isSameDay) return `сегодня, ${time}`;

  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 1) return `вчера, ${time}`;

  const weekdayNames = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  if (diffDays < 7) return `${weekdayNames[date.getDay()]}, ${time}`;

  const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return `${dateStr}, ${time}`;
}