import { config } from '../config';

const OMDB_BASE = 'https://www.omdbapi.com';

export interface OmdbCandidate {
  imdb_id: string;
  title: string;
  year: string;
  type: string;
  poster: string;
}

export interface OmdbDetail {
  imdb_id: string;
  title: string;
  year: string | null;
  poster: string | null;
  genre: string | null;
  plot: string | null;
  runtime: string | null;
  imdb_rating: string | null;
}

export async function searchOmdb(query: string): Promise<OmdbCandidate[]> {
  if (!config.OMDB_API_KEY) throw new Error('OMDB_API_KEY is not configured');
  const res = await fetch(
    `${OMDB_BASE}/?apikey=${config.OMDB_API_KEY}&s=${encodeURIComponent(query)}&type=movie`
  );
  if (!res.ok) throw new Error(`OMDB request failed: ${res.status}`);
  const body = (await res.json()) as { Response: string; Search?: { imdbID: string; Title: string; Year: string; Type: string; Poster: string }[]; Error?: string };
  if (body.Response === 'False') return [];
  return (body.Search || [])
    .filter((m) => m.imdbID)
    .map((m) => ({
      imdb_id: m.imdbID,
      title: m.Title,
      year: m.Year,
      type: m.Type,
      poster: m.Poster === 'N/A' ? '' : m.Poster,
    }));
}

export async function getOmdbDetail(imdbId: string): Promise<OmdbDetail | null> {
  if (!config.OMDB_API_KEY) throw new Error('OMDB_API_KEY is not configured');
  const res = await fetch(`${OMDB_BASE}/?apikey=${config.OMDB_API_KEY}&i=${encodeURIComponent(imdbId)}&plot=short`);
  if (!res.ok) throw new Error(`OMDB request failed: ${res.status}`);
  const body = (await res.json()) as {
    Response: string;
    imdbID?: string;
    Title?: string;
    Year?: string;
    Poster?: string;
    Genre?: string;
    Plot?: string;
    Runtime?: string;
    imdbRating?: string;
    Error?: string;
  };
  if (body.Response === 'False' || !body.imdbID) return null;
  return {
    imdb_id: body.imdbID,
    title: body.Title || '',
    year: body.Year && body.Year !== 'N/A' ? body.Year : null,
    poster: body.Poster && body.Poster !== 'N/A' ? body.Poster : null,
    genre: body.Genre && body.Genre !== 'N/A' ? body.Genre : null,
    plot: body.Plot && body.Plot !== 'N/A' ? body.Plot : null,
    runtime: body.Runtime && body.Runtime !== 'N/A' ? body.Runtime : null,
    imdb_rating: body.imdbRating && body.imdbRating !== 'N/A' ? body.imdbRating : null,
  };
}