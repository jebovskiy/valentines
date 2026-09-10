import { config } from '../config';

const BASE = 'https://api.poiskkino.dev';

const headers = () => {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.POISKKINO_API_KEY) h['X-API-KEY'] = config.POISKKINO_API_KEY;
  return h;
};

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

export interface PoiskkinoDetail {
  kp_id: number;
  name: string | null;
  alternative_name: string | null;
  year: number | null;
  poster_url: string | null;
  rating_kp: number | null;
  rating_imdb: number | null;
  genres: string[];
  description: string | null;
  short_description: string | null;
  movie_length: number | null;
  countries: string[];
  type: string | null;
  imdb_id: string | null;
}

export async function searchPoiskkino(query: string): Promise<PoiskkinoCandidate[]> {
  if (!config.POISKKINO_API_KEY) throw new Error('POISKKINO_API_KEY is not configured');
  const url = `${BASE}/v1.5/movie/search?query=${encodeURIComponent(query)}&page=1&limit=10`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Poiskkino search failed: ${res.status}`);
  const body = (await res.json()) as { docs?: any[]; error?: string };
  if (!body.docs) throw new Error(body.error || 'No results');
  return body.docs.map((m) => ({
    kp_id: m.id,
    name: m.name ?? m.enName ?? null,
    alternative_name: m.alternativeName ?? m.enName ?? null,
    year: m.year ?? null,
    poster_url: m.poster?.url ?? null,
    rating_kp: m.rating?.kp ?? null,
    rating_imdb: m.rating?.imdb ?? null,
    genres: (m.genres || []).map((g: any) => g.name).filter(Boolean),
    type: m.type ?? null,
  }));
}

export async function getPoiskkinoDetail(kpId: number): Promise<PoiskkinoDetail | null> {
  if (!config.POISKKINO_API_KEY) throw new Error('POISKKINO_API_KEY is not configured');
  const url = `${BASE}/v1.5/movie/${kpId}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Poiskkino detail failed: ${res.status}`);
  }
  const m = (await res.json()) as any;
  if (!m || !m.id) return null;
  return {
    kp_id: m.id,
    name: m.name ?? null,
    alternative_name: m.alternativeName ?? m.enName ?? null,
    year: m.year ?? null,
    poster_url: m.poster?.url ?? null,
    rating_kp: m.rating?.kp ?? null,
    rating_imdb: m.rating?.imdb ?? null,
    genres: (m.genres || []).map((g: any) => g.name).filter(Boolean),
    description: m.description ?? m.shortDescription ?? null,
    short_description: m.shortDescription ?? null,
    movie_length: m.movieLength ?? null,
    countries: (m.countries || []).map((c: any) => c.name).filter(Boolean),
    type: m.type ?? null,
    imdb_id: m.externalId?.imdb ?? null,
  };
}