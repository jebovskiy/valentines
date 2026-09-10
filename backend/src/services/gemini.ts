import { config } from '../config';

export interface MovieReviewInput {
  author_name: string;
  visuals: number;
  plot: number;
  acting: number;
  music: number;
  atmosphere: number;
  humor: number;
  comment: string | null;
}

export interface MovieInfoInput {
  title: string;
  year: number | null;
  genre: string | null;
  plot: string | null;
}

export interface MovieInsightResult {
  summary: string;
  common_points: string[];
  liked: { who: string; what: string }[];
  disliked: string[];
  disagreements: string[];
  verdict: string;
  compatibility_percent: number;
  similar_movies: { title: string; year: number | string }[];
}

const ASPECT_NAMES = ['Визуал/картинка', 'Сюжет', 'Актёрская игра', 'Музыка', 'Атмосфера', 'Юмор'] as const;
const aspectKeys: (keyof MovieReviewInput & string)[] = ['visuals', 'plot', 'acting', 'music', 'atmosphere', 'humor'];

export async function generateMovieInsights(
  movie: MovieInfoInput,
  reviews: [MovieReviewInput, MovieReviewInput]
): Promise<MovieInsightResult> {
  const geminiResult = await tryGemini(movie, reviews);
  if (geminiResult) return geminiResult;
  return heuristicInsights(movie, reviews);
}

function reviewToText(r: MovieReviewInput): string {
  const parts = aspectKeys.map((k, i) => {
    const label = ASPECT_NAMES[i];
    const value = r[k] as number;
    const word = value >= 5 ? 'отлично' : value >= 4 ? 'хорошо' : value >= 3 ? 'нормально' : value >= 2 ? 'слабо' : 'плохо';
    return `${label}: ${value}/5 (${word})`;
  });
  return `${r.author_name} — ${parts.join(', ')}${r.comment ? `; комментарий: ${r.comment}` : ''}`;
}

async function tryGemini(movie: MovieInfoInput, reviews: [MovieReviewInput, MovieReviewInput]): Promise<MovieInsightResult | null> {
  if (!config.GEMINI_API_KEY) return null;
  const model = config.GEMINI_MODEL;
  const reviewsText = reviews.map(reviewToText).join('\n');
  const prompt = `Ты — приложение для пар, которое помогает понять, стоит ли смотреть кино вместе.

Фильм: "${movie.title}" (${movie.year ?? 'год неизвестен'}${movie.genre ? `, жанр: ${movie.genre}` : ''}).
Краткий сюжет: ${movie.plot ?? 'нет данных'}.

Два партнёра написали ревью (оценки по аспектам от 1 до 5):
${reviewsText}

Ответь строго в формате JSON (без markdown-обёртки):
{
  "summary": "короткое общее описание (1-2 предложения)",
  "common_points": ["что совпало у обоих"],
  "liked": [{"who": "имя", "what": "что именно понравилось"}],
  "disliked": ["что не понравилось (общее или одного)"],
  "disagreements": ["в чём мнения разошлись"],
  "verdict": "вывод, стоит ли им вместе смотреть похожие фильмы (1-2 предложения)",
  "compatibility_percent": 0-100,
  "similar_movies": [{"title": "название", "year": "год"}]
}
В similar_movies укажи 4-5 реальных фильмов, похожих по вашим двум ревью и жанрон фильма.`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
        }),
      }
    );
    if (!res.ok) {
      console.error('Gemini error:', res.status, await res.text());
      return null;
    }
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const cleaned = text.trim().replace(/^```json\s*/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned) as Partial<MovieInsightResult>;
    if (!parsed.summary && !parsed.verdict) return null;
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      common_points: Array.isArray(parsed.common_points) ? parsed.common_points.filter((x) => typeof x === 'string') : [],
      liked: Array.isArray(parsed.liked) ? parsed.liked.filter((x) => x && typeof x.who === 'string' && typeof x.what === 'string') : [],
      disliked: Array.isArray(parsed.disliked) ? parsed.disliked.filter((x) => typeof x === 'string') : [],
      disagreements: Array.isArray(parsed.disagreements) ? parsed.disagreements.filter((x) => typeof x === 'string') : [],
      verdict: typeof parsed.verdict === 'string' ? parsed.verdict : '',
      compatibility_percent: typeof parsed.compatibility_percent === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.compatibility_percent))) : 50,
      similar_movies: Array.isArray(parsed.similar_movies)
        ? parsed.similar_movies.filter((x) => x && typeof x.title === 'string').slice(0, 6)
        : [],
    };
  } catch (error) {
    console.error('Gemini parse/network error:', error);
    return null;
  }
}

function heuristicInsights(movie: MovieInfoInput, reviews: [MovieReviewInput, MovieReviewInput]): MovieInsightResult {
  const [a, b] = reviews;
  const diffs = aspectKeys.map((k) => Math.abs((a[k] as number) - (b[k] as number)));
  const matches = diffs.filter((d) => d <= 1).length;
  const avgA = averageReview(a);
  const avgB = averageReview(b);
  const avg = (avgA + avgB) / 2;
  const compatibility = Math.round((matches / aspectKeys.length) * 100 - Math.min(15, Math.abs(avgA - avgB) * 6));
  const overall = avg >= 4.5 ? 'высокие' : avg >= 3.5 ? 'хорошие' : avg >= 2.5 ? 'средние' : 'низкие';

  return {
    summary: `«${movie.title}» получил(а) от пары ${overall} оценки: в среднем ${avg.toFixed(1)}/5.`,
    common_points: diffs.map((d, i) => (d <= 1 ? `Оценка по аспекту «${ASPECT_NAMES[i]}» совпала (${(a[aspectKeys[i]] as number)} и ${(b[aspectKeys[i]] as number)}/5)` : null)).filter((x): x is string => !!x),
    liked: [a, b]
      .map((r) => ({ who: r.author_name, what: bestAspects(r) }))
      .filter((x) => x.what),
    disliked: worstAspectsForPair(a, b),
    disagreements: diffs.map((d, i) => (d >= 2 ? `«${ASPECT_NAMES[i]}»: ${(a[aspectKeys[i]] as number)} против ${(b[aspectKeys[i]] as number)}` : null)).filter((x): x is string => !!x),
    verdict:
      avg >= 3.5
        ? `Похоже, «${movie.title}» вам зашёл. Стоит попробовать похожие фильмы того же жанра${movie.genre ? ` (${movie.genre})` : ''}.`
        : `Мнения разошлись — прежде чем добавлять похожие фильмы, обсудите, что хочется смотреть вместе.`,
    compatibility_percent: Math.max(0, Math.min(100, compatibility)),
    similar_movies: [],
  };
}

function averageReview(r: MovieReviewInput): number {
  return aspectKeys.reduce((acc, k) => acc + (r[k] as number), 0) / aspectKeys.length;
}

function bestAspects(r: MovieReviewInput): string {
  return aspectKeys
    .map((k, i) => ({ label: ASPECT_NAMES[i], v: r[k] as number }))
    .filter((x) => x.v >= 4)
    .map((x) => x.label.toLowerCase())
    .join(', ');
}

function worstAspectsForPair(a: MovieReviewInput, b: MovieReviewInput): string[] {
  const worst = new Set<string>();
  for (const [i, k] of aspectKeys.entries()) {
    const v = Math.min(a[k] as number, b[k] as number);
    if (v <= 2) worst.add(`${ASPECT_NAMES[i].toLowerCase()} (${v}/5 у одного из партнёров)`);
  }
  return [...worst];
}