export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface Pair {
  id: string;
  telegram_user_a: number;
  telegram_user_b: number;
  user_a_name: string | null;
  user_b_name: string | null;
  created_at: string;
}

export interface Device {
  id: string;
  pair_id: string;
  telegram_user_id: number;
  platform: 'ios' | 'android';
  push_token: string;
  paired_at: string;
  push_permission_granted: boolean;
  widget_added: boolean;
}

export type AnimationType = 'heart_open' | 'sparkle' | 'moon' | 'flame' | 'bloom_petals' | 'golden_halo';

export interface AnimationDef {
  type: AnimationType;
  emoji: string;
  label: string;
}

export const ANIMATIONS: AnimationDef[] = [
  { type: 'heart_open', emoji: '💌', label: 'Валентинка' },
  { type: 'sparkle', emoji: '✨', label: 'Блеск' },
  { type: 'moon', emoji: '🌙', label: 'Ночь' },
  { type: 'flame', emoji: '🔥', label: 'Страсть' },
  { type: 'bloom_petals', emoji: '🌸', label: 'Цветение' },
  { type: 'golden_halo', emoji: '👑', label: 'Нимб' },
];

export interface StreakTier {
  day: number;
  type: AnimationType;
  icon: string;
  name: string;
  soft: string;
  mid: string;
}

export const STREAK_TIERS: StreakTier[] = [
  { day: 1, type: 'heart_open', icon: '💌', name: 'heart_open', soft: '#ffd7dc', mid: '#ffb3bd' },
  { day: 7, type: 'sparkle', icon: '✨', name: 'sparkle_burst', soft: '#fff3c4', mid: '#ffe27a' },
  { day: 14, type: 'moon', icon: '🌙', name: 'moon_glow', soft: '#dbe8ff', mid: '#b9cdfa' },
  { day: 30, type: 'flame', icon: '🔥', name: 'flame_pulse', soft: '#ffe3cc', mid: '#ffc9a3' },
  { day: 60, type: 'bloom_petals', icon: '🌸', name: 'bloom_petals', soft: '#ffd7e4', mid: '#ffb3cd' },
  { day: 100, type: 'golden_halo', icon: '👑', name: 'golden_halo', soft: '#fff3c4', mid: '#f0c869' },
];

export const STREAK_LOCKED_ANIMATIONS: Record<string, number> = {
  bloom_petals: 60,
  golden_halo: 100,
};

export function getAnimation(type: AnimationType): AnimationDef {
  return ANIMATIONS.find((a) => a.type === type) ?? ANIMATIONS[0];
}

export interface Valentine {
  id: string;
  pair_id: string;
  sender_telegram_id: number;
  animation_type: AnimationType;
  message: string | null;
  photo_url: string | null;
  sent_at: string;
  delivered_at: string | null;
  seen_at: string | null;
}

export interface ValentineWithSender extends Valentine {
  sender_name: string;
  is_own: boolean;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export const TEST_TELEGRAM_ID = 461666389;

export interface SendValentineRequest {
  animation_type: AnimationType;
  message?: string | null;
  recipient?: 'partner' | 'self';
  photo_base64?: string | null;
}

export interface PairingInitResult {
  pairingUrl: string;
  token: string;
  expiresAt: string;
}

export interface CompletePairingResult {
  pairId: string;
  partnerTelegramId: number;
  deviceId: string;
}

export interface UserProfile {
  id: number;
  username: string | null;
  first_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export type GreetingType = 'morning' | 'night' | 'luck' | 'day' | 'evening' | 'care';

export interface Greeting {
  id: string;
  pair_id: string;
  sender_telegram_id: number;
  type: GreetingType;
  sent_at: string;
  sender_name: string;
  is_own: boolean;
}

// --- Notes & Reminders --------------------------------------------------------

export type NoteCategory = 'idea' | 'todo' | 'memory' | 'wish';

export const NOTE_CATEGORIES: { value: NoteCategory; label: string; icon: string }[] = [
  { value: 'idea', label: 'Идея', icon: '💡' },
  { value: 'todo', label: 'Дело', icon: '✅' },
  { value: 'memory', label: 'Воспоминание', icon: '📸' },
  { value: 'wish', label: 'Желание', icon: '🌟' },
];

export interface Note {
  id: string;
  pair_id: string;
  author_id: number;
  content: string;
  category: NoteCategory;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export type Recurrence = 'yearly' | 'monthly';

export interface Reminder {
  id: string;
  pair_id: string;
  author_id: number;
  title: string;
  message: string | null;
  remind_at: string;
  is_recurring: boolean;
  recurrence: Recurrence | null;
  is_sent: boolean;
  created_at: string;
}

export type CoupleEventType = 'first_date' | 'wedding' | 'birthday' | 'custom';

export const COUPLE_EVENT_TYPES: { value: CoupleEventType; label: string; icon: string }[] = [
  { value: 'first_date', label: 'Первая встреча', icon: '💑' },
  { value: 'wedding', label: 'Свадьба', icon: '💍' },
  { value: 'birthday', label: 'День рождения', icon: '🎂' },
  { value: 'custom', label: 'Другое', icon: '📅' },
];

export interface CoupleEvent {
  id: string;
  pair_id: string;
  name: string;
  event_date: string;
  event_type: CoupleEventType;
  remind_days_before: number;
  created_at: string;
}

// --- Movies --------------------------------------------------------------------

export type MovieStatus = 'want_to_watch' | 'watched';

export interface Movie {
  id: string;
  pair_id: string;
  kp_id: number | null;
  title: string;
  year: number | null;
  poster_url: string | null;
  genre: string | null;
  description: string | null;
  runtime: string | null;
  rating: string | null;
  status: MovieStatus;
  added_by: number;
  added_at: string;
  watched_at: string | null;
}

export interface MovieReview {
  id: string;
  movie_id: string;
  author_telegram_id: number;
  visuals: number;
  plot: number;
  acting: number;
  music: number;
  atmosphere: number;
  humor: number;
  review_text: string | null;
  created_at: string;
}

export interface MovieInsight {
  movie_id: string;
  result: {
    summary: string;
    common_points: string[];
    liked: { who: string; what: string }[];
    disliked: { who: string; what: string }[];
    disagreements: string[];
    verdict: string;
    compatibility_percent: number;
    similar_movies: { title: string; year: number }[];
  };
  created_at: string;
}

export interface MovieListItem extends Movie {
  reviews: MovieReview[];
  watches: number[];
  added_by_name: string | null;
  aspect_scores: Record<string, number> | null;
  taste_match: number | null;
}

export interface TasteProfile {
  aspect_weights: Record<string, number>;
}

export interface PoiskkinoCandidate {
  kp_id: number;
  name: string | null;
  alternative_name: string | null;
  year: number | null;
  poster_url: string | null;
  rating_kp: number | null;
  rating_imdb: number | null;
  genres: string[];
  type: string | null;
}

// --- «Куда пойти» (date spot picker) ------------------------------------------

export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceM: number | null;
  priceLevel: string | null;
  priceLabel: string | null;
  rating: number | null;
  ratingCount: number | null;
  primaryType: string | null;
  typeLabel: string | null;
  googleMapsUri: string | null;
  photoName: string | null;
}

export type DateMood = 'romantic' | 'fun' | 'calm' | 'active';
export type DateCategory = 'food' | 'entertainment' | 'nature' | 'culture';
export type DateBudget = 'cheap' | 'mid' | 'high' | 'any';

export interface DateParams {
  lat: number;
  lng: number;
  radius_m: number | null;
  mood: DateMood | null;
  category: DateCategory | null;
  budget: DateBudget;
  open_now: boolean | null;
}

export type DateChoice = 'like' | 'dislike';

export interface DateVote {
  session_id: string;
  user_id: number;
  place_index: number;
  choice: DateChoice;
  created_at: string;
}

export interface DateMatch {
  matched: boolean;
  index?: number;
  place?: Place | null;
}

export interface DateSession {
  id: string;
  pair_id: string;
  initiator_id: number;
  params: DateParams;
  places: Place[];
  status: 'active' | 'done';
  match: DateMatch | null;
  created_at: string;
  updated_at: string;
  votes: DateVote[];
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  capabilities: string[];
}

export type PoiskkinoPart = Pick<PoiskkinoCandidate, 'kp_id' | 'name' | 'alternative_name' | 'year' | 'poster_url' | 'rating_imdb' | 'type'>;