import { getInitData, getTelegramSelfPhotoUrl } from '../utils/telegram';
import type {
  Pair,
  Valentine,
  ValentineWithSender,
  SendValentineRequest,
  PairingInitResult,
  CompletePairingResult,
  UserProfile,
  ApiResponse,
  Greeting,
  GreetingType,
  Note,
  NoteCategory,
  Reminder,
  Recurrence,
  CoupleEvent,
  CoupleEventType,
  MovieListItem,
  MovieInsight,
  MovieReview,
  PoiskkinoCandidate,
  PoiskkinoPart,
  TasteProfile,
  DateParams,
  DateSession,
  DateChoice,
  Place,
  Integration,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const initData = getInitData();
  const headers = new Headers(options.headers);
  if (initData) {
    headers.set('Authorization', `tma ${initData}`);
  }
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const text = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text || `HTTP ${response.status}` };
    }

    if (!response.ok) {
      return { error: (data.error as string) || `HTTP ${response.status}` };
    }

    return { data: data as T };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export const api = {
  // Pairs
  getMyPair: () => fetchWithAuth<{ pair: Pair; pairing: { android_paired: boolean } }>('/api/pairs/me'),
  createPair: (partnerTelegramId: number) =>
    fetchWithAuth<{ pair_id: string }>('/api/pairs', {
      method: 'POST',
      body: JSON.stringify({ partner_telegram_id: partnerTelegramId }),
    }),
  createInvite: () => fetchWithAuth<{ code: string; expires_at: string }>('/api/pairs/invite', { method: 'POST' }),
  joinInvite: (code: string) =>
    fetchWithAuth<{ pair_id: string }>('/api/pairs/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  // Pairing
  initiatePairing: () => fetchWithAuth<PairingInitResult>('/api/pairs/pairing/initiate', { method: 'POST' }),
  completePairing: (token: string, platform: 'ios' | 'android', pushToken: string) =>
    fetchWithAuth<CompletePairingResult>('/api/pairs/pairing/complete', {
      method: 'POST',
      body: JSON.stringify({ token, platform, push_token: pushToken }),
    }),
  getPairingStatus: (token: string) =>
    fetchWithAuth<{ status: 'pending' | 'completed' | 'expired' }>(`/api/pairs/pairing/${token}/status`),
  getStreak: () => fetchWithAuth<{ streak: { current: number; max: number } }>('/api/pairs/streak'),

  // Valentines
  getValentines: () => fetchWithAuth<{ valentines: Valentine[] }>('/api/valentines'),
  getValentine: (id: string) => fetchWithAuth<{ valentine: ValentineWithSender }>(`/api/valentines/${id}`),
  sendValentine: (payload: SendValentineRequest) =>
    fetchWithAuth<{ valentine: Valentine }>('/api/valentines', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  markSeen: (id: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/valentines/${id}/seen`, { method: 'POST' }),

  // Greetings ("доброе утро")
  getGreetings: () => fetchWithAuth<{ greetings: Greeting[] }>('/api/greetings'),
  sendGreeting: (type: GreetingType) =>
    fetchWithAuth<{ greeting: Greeting }>('/api/greetings', {
      method: 'POST',
      body: JSON.stringify({ type }),
    }),

  // Users / profile
  getMyProfile: () => fetchWithAuth<{ me: UserProfile; partner: UserProfile | null }>('/api/users/me'),
  updateMyName: (name: string) =>
    fetchWithAuth<{ success: boolean; name: string }>('/api/users/me/name', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  avatarUrl: (telegramUserId: number) => `${API_URL}/api/users/${telegramUserId}/avatar?v=3`,
  // Own avatar: prefer the photo_url Telegram itself gives us in initData
  // (always loadable in the WebView), fall back to the backend proxy.
  selfAvatarUrl: (telegramUserId: number) =>
    getTelegramSelfPhotoUrl() || `${API_URL}/api/users/${telegramUserId}/avatar?v=3`,

  // Notes
  getNotes: () => fetchWithAuth<{ notes: Note[] }>('/api/notes'),
  createNote: (content: string, category: NoteCategory) =>
    fetchWithAuth<{ note: Note }>('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ content, category }),
    }),
  updateNote: (id: string, updates: { content?: string; category?: NoteCategory; is_pinned?: boolean }) =>
    fetchWithAuth<{ ok: boolean }>(`/api/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  deleteNote: (id: string) => fetchWithAuth<{ ok: boolean }>(`/api/notes/${id}`, { method: 'DELETE' }),

  // Reminders
  getReminders: () => fetchWithAuth<{ reminders: Reminder[] }>('/api/reminders'),
  createReminder: (input: {
    title: string;
    message?: string | null;
    remind_at: string;
    is_recurring?: boolean;
    recurrence?: Recurrence | null;
  }) =>
    fetchWithAuth<{ reminder: Reminder }>('/api/reminders', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  deleteReminder: (id: string) =>
    fetchWithAuth<{ ok: boolean }>(`/api/reminders/${id}`, { method: 'DELETE' }),

  // Couple events
  getEvents: () => fetchWithAuth<{ events: CoupleEvent[] }>('/api/events'),
  createEvent: (input: { name: string; event_date: string; event_type: CoupleEventType; remind_days_before?: number }) =>
    fetchWithAuth<{ event: CoupleEvent }>('/api/events', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  deleteEvent: (id: string) => fetchWithAuth<{ ok: boolean }>(`/api/events/${id}`, { method: 'DELETE' }),

  // Movies
  getMovies: () => fetchWithAuth<{ movies: MovieListItem[] }>('/api/movies'),
  searchMovies: (q: string) => fetchWithAuth<{ results: PoiskkinoCandidate[] }>(`/api/movies/search?q=${encodeURIComponent(q)}`),
  getMovieParts: (kpId: number) => fetchWithAuth<{ movie: PoiskkinoCandidate; parts: PoiskkinoPart[] }>(`/api/movies/parts?kp_id=${kpId}`),
  addMoviesBatch: (items: { kp_id?: number; title?: string; year?: number }[]) =>
    fetchWithAuth<{ added: { id: string }[]; duplicates: number[] }>('/api/movies/batch', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
  addMovie: (input: { kp_id?: number; title?: string; year?: number }) =>
    fetchWithAuth<{ movie: { id: string }; duplicate?: boolean }>('/api/movies', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  deleteMovie: (id: string) => fetchWithAuth<{ ok: boolean }>(`/api/movies/${id}`, { method: 'DELETE' }),
  markMovieWatched: (id: string) =>
    fetchWithAuth<{ movie: { id: string }; watches: number[] }>(`/api/movies/${id}/watched`, { method: 'POST' }),
  addMovieReview: (id: string, review: {
    visuals: number; plot: number; acting: number;
    music: number; atmosphere: number; humor: number;
    comment?: string | null;
  }) =>
    fetchWithAuth<{ review: MovieReview; bothReviewed: boolean }>(`/api/movies/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(review),
    }),
  getMovieInsight: (id: string) => fetchWithAuth<{ insight: MovieInsight | null }>(`/api/movies/${id}/insight`),
  shareMovie: (id: string) => fetchWithAuth<{ ok: boolean }>(`/api/movies/${id}/share`, { method: 'POST' }),
  getEveningPick: () => fetchWithAuth<{ movie: MovieListItem }>('/api/movies/evening', { method: 'POST' }),
  getTasteProfile: () => fetchWithAuth<TasteProfile>('/api/movies/taste-profile'),
  saveTasteProfile: (aspectWeights: Record<string, number>) =>
    fetchWithAuth<TasteProfile>('/api/movies/taste-profile', {
      method: 'POST',
      body: JSON.stringify({ aspect_weights: aspectWeights }),
    }),
  getMovieAspects: (id: string) =>
    fetchWithAuth<{ aspect_scores: Record<string, number> | null; taste_match: number | null }>(`/api/movies/${id}/aspects`),

  // «Куда пойти» — date spot picker
  searchPlaces: (params: {
    lat: number;
    lng: number;
    radius_m?: number | null;
    mood?: string | null;
    category?: string | null;
    budget?: string | null;
    open_now?: boolean | null;
    count?: number;
  }) =>
    fetchWithAuth<{ places: Place[] }>('/api/places/search', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  placePhotoUrl: (photoName: string) => `${API_URL}/api/places/photo?name=${encodeURIComponent(photoName)}`,
  getActiveDateSession: () => fetchWithAuth<{ session: DateSession | null }>('/api/dates/active'),
  createDateSession: (params: DateParams) =>
    fetchWithAuth<{ session: DateSession }>('/api/dates', {
      method: 'POST',
      body: JSON.stringify({ params }),
    }),
  voteDate: (sessionId: string, placeIndex: number, choice: DateChoice) =>
    fetchWithAuth<{ session: DateSession }>(`/api/dates/${sessionId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ place_index: placeIndex, choice }),
    }),
  finishDateSession: (sessionId: string) =>
    fetchWithAuth<{ ok: boolean }>(`/api/dates/${sessionId}/done`, { method: 'POST' }),

  // Integrations
  getIntegrations: () => fetchWithAuth<{ integrations: Integration[] }>('/api/integrations'),
};