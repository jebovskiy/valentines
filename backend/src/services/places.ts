import { config } from '../config';

export const PLACES_TIMEOUT_MS = 10_000;

export const MOOD_TYPES: Record<string, string[]> = {
  romantic: ['restaurant', 'cafe', 'park', 'art_gallery', 'spa'],
  fun: ['movie_theater', 'bowling_alley', 'amusement_park', 'bar', 'aquarium'],
  calm: ['park', 'cafe', 'library', 'art_gallery', 'garden'],
  active: ['park', 'gym', 'stadium', 'ski_resort'],
};

export const CATEGORY_TYPES: Record<string, string[]> = {
  food: ['restaurant', 'cafe', 'bakery', 'meal_takeaway'],
  entertainment: ['movie_theater', 'bowling_alley', 'amusement_park', 'aquarium', 'night_club', 'bar'],
  nature: ['park', 'garden', 'beach', 'campground', 'tourist_attraction'],
  culture: ['museum', 'art_gallery', 'performing_arts_theater', 'library', 'tourist_attraction'],
};

export const MOOD_LABELS: Record<string, string> = {
  romantic: 'Романтичное',
  fun: 'Веселье',
  calm: 'Спокойно',
  active: 'Активное',
};

export const CATEGORY_LABELS: Record<string, string> = {
  food: 'Еда',
  entertainment: 'Развлечения',
  nature: 'Природа',
  culture: 'Культура',
};

export const BUDGET_LABELS: Record<string, string> = {
  cheap: 'Дёшево',
  mid: 'Средне',
  high: 'Дорого',
  any: 'Любой',
};

const BUDGET_PRICE_LEVELS: Record<string, string[]> = {
  cheap: ['PRICE_LEVEL_FREE', 'PRICE_LEVEL_INEXPENSIVE'],
  mid: ['PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE'],
  high: ['PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE'],
  any: ['PRICE_LEVEL_FREE', 'PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE'],
};

const PRICE_LEVEL_LABELS: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Бесплатно',
  PRICE_LEVEL_INEXPENSIVE: 'Дёшево',
  PRICE_LEVEL_MODERATE: 'Средне',
  PRICE_LEVEL_EXPENSIVE: 'Дорого',
  PRICE_LEVEL_VERY_EXPENSIVE: 'Очень дорого',
};

const TYPE_LABELS: Record<string, string> = {
  restaurant: 'Ресторан',
  cafe: 'Кафе',
  bakery: 'Пекарня',
  bar: 'Бар',
  park: 'Парк',
  garden: 'Сад',
  beach: 'Пляж',
  museum: 'Музей',
  art_gallery: 'Галерея',
  performing_arts_theater: 'Театр',
  library: 'Библиотека',
  movie_theater: 'Кинотеатр',
  bowling_alley: 'Боулинг',
  amusement_park: 'Парк развлечений',
  aquarium: 'Аквариум',
  arcade: 'Аркада',
  stadium: 'Стадион',
  fitness_center: 'Фитнес',
  gym: 'Спортзал',
  spa: 'СПА',
  tourist_attraction: 'Достопримечательность',
  camp_ground: 'Кемпинг',
  hiking_trail: 'Тропа',
};

export interface PlacesSearchInput {
  lat: number;
  lng: number;
  radiusM: number | null;
  mood?: string | null;
  category?: string | null;
  budget?: string | null;
  count?: number;
}

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

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.priceLevel',
  'places.rating',
  'places.userRatingCount',
  'places.types',
  'places.primaryType',
  'places.googleMapsUri',
  'places.photos',
].join(',');

export function resolveTypes(mood?: string | null, category?: string | null): string[] {
  const moodTypes = mood && MOOD_TYPES[mood] ? MOOD_TYPES[mood] : [];
  const categoryTypes = category && CATEGORY_TYPES[category] ? CATEGORY_TYPES[category] : [];
  const merged = [...new Set([...categoryTypes, ...moodTypes])];
  return merged.length > 0 ? merged : ['restaurant', 'cafe'];
}

function priceLabels(level: string): string {
  return PRICE_LEVEL_LABELS[level] ?? null;
}

function typeLabel(types: string[] | undefined, primary: string | null): string | null {
  if (primary) return TYPE_LABELS[primary] ?? null;
  if (types) {
    for (const t of types) {
      if (TYPE_LABELS[t]) return TYPE_LABELS[t];
    }
  }
  return null;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function searchPlaces(input: PlacesSearchInput): Promise<{ places: Place[]; searched: { lat: number; lng: number; radiusM: number | null } }> {
  if (!config.GOOGLE_MAPS_API_KEY) {
    throw new PlacesError('integration_not_connected', 'Интеграция Google Places не подключена');
  }

  const includedTypes = resolveTypes(input.mood, input.category).slice(0, 8);
  const count = Math.min(Math.max(input.count ?? 10, 1), 20);
  const radius = Math.min(Math.max(input.radiusM ?? 10000, 200), 50000);

  const body: Record<string, unknown> = {
    includedTypes,
    maxResultCount: count,
    rankPreference: 'DISTANCE',
    locationRestriction: {
      circle: { center: { latitude: input.lat, longitude: input.lng }, radius },
    },
    languageCode: 'ru',
    regionCode: 'BY',
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLACES_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    clearTimeout(timer);
    if ((error as Error).name === 'AbortError') {
      throw new PlacesError('timeout', 'Google Places: таймаут');
    }
    throw new PlacesError('network', `Google Places: ${(error as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as {
        error?: {
          message?: string;
          status?: string;
          details?: Array<{
            '@type'?: string;
            fieldViolations?: Array<{ field: string; description: string }>;
          }>;
        };
      } | null;
      const e = errBody?.error;
      if (e) {
        const violations = (e.details ?? [])
          .flatMap((d) => d.fieldViolations ?? [])
          .map((v) => `${v.field}: ${v.description}`);
        const base = e.message ?? '';
        detail = `${base}${violations.length > 0 ? ` | ${violations.join(' | ')}` : ''}`.trim() || `HTTP ${res.status}`;
        detail += ` (${e.status ?? 'ERROR'}, HTTP ${res.status})`;
      }
    } catch {
      /* keep fallback message */
    }
    throw new PlacesError('http', `Google Places: ${detail}`);
  }

  const data = (await res.json()) as {
    places?: {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      priceLevel?: string;
      rating?: number;
      userRatingCount?: number;
      types?: string[];
      primaryType?: string;
      distanceMeters?: number;
      googleMapsUri?: string;
      photos?: { name?: string }[];
    }[];
  };

  const budget = input.budget ?? 'any';
  const places: Place[] = (data.places ?? [])
    .filter((p) => p.displayName?.text && p.location?.latitude != null && p.location?.longitude != null)
    .map((p) => ({
      id: p.id ?? `pl_${Math.random().toString(36).slice(2)}`,
      name: p.displayName!.text!,
      address: p.formattedAddress ?? '',
      lat: p.location!.latitude!,
      lng: p.location!.longitude!,
      distanceM: p.distanceMeters ?? haversineMeters(input.lat, input.lng, p.location!.latitude!, p.location!.longitude!),
      priceLevel: p.priceLevel ?? null,
      priceLabel: p.priceLevel ? priceLabels(p.priceLevel) : null,
      rating: p.rating ?? null,
      ratingCount: p.userRatingCount ?? null,
      primaryType: p.primaryType ?? null,
      typeLabel: typeLabel(p.types, p.primaryType ?? null),
      googleMapsUri: p.googleMapsUri ?? null,
      photoName: p.photos?.[0]?.name ?? null,
    }));

  // searchNearby (REST) cannot restrict by price level server-side, so put
  // budget-matching places first and pad the rest if we have too few.
  const budgetLevels = new Set(BUDGET_PRICE_LEVELS[budget] ?? []);
  if (budget !== 'any') {
    const matched: Place[] = [];
    const other: Place[] = [];
    for (const p of places) (p.priceLevel && budgetLevels.has(p.priceLevel) ? matched : other).push(p);
    return { places: [...matched, ...other], searched: { lat: input.lat, lng: input.lng, radiusM: input.radiusM } };
  }

  return { places, searched: { lat: input.lat, lng: input.lng, radiusM: input.radiusM } };
}

export async function fetchPlacePhoto(photoName: string): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  if (!config.GOOGLE_MAPS_API_KEY) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLACES_TIMEOUT_MS);
  try {
    const url = `https://places.googleapis.com/v1/${encodeURIComponent(photoName)}/media?maxWidthPx=800&maxHeightPx=800`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'X-Goog-Api-Key': config.GOOGLE_MAPS_API_KEY },
    });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, contentType: res.headers.get('content-type') };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export class PlacesError extends Error {
  constructor(
    public kind: 'integration_not_connected' | 'timeout' | 'network' | 'http' | 'empty',
    message: string,
  ) {
    super(message);
    this.name = 'PlacesError';
  }
}