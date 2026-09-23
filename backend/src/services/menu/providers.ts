import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildMockOffers,
  buildFixtureRecipes,
  getIngredientByName,
  getIngredientNutrition,
  MOCK_PRICE_SOURCE_LABEL,
  STORES,
} from './fixtures';
import type {
  IngredientQty,
  NutritionPer100g,
  ProductOffer,
  Recipe,
  Store,
  StoreId,
  Unit,
} from './types';

/**
 * Provider abstractions. New data sources plug in here without touching the
 * business logic:
 *   - RecipeProvider: where recipes come from. Fixture demo catalog is the
 *     fallback; the default is the real snapshot imported from
 *     RussianFood.com (backend/menu-data/recipes.json, produced by the
 *     ingestion script in backend/scripts/ingest-russianfood.ts).
 *   - PriceProvider: per-store product offers. Mock demo data is the fallback;
 *     the default is the curated snapshot of real retail catalogue prices
 *     (backend/menu-data/prices.json, produced by
 *     backend/scripts/crawl-prices.ts and/or maintained by a human curator).
 *   - NutritionProvider: per-100g reference values computed from our curated
 *     ingredient nutrition DB (reference tables, e.g. USDA style averages).
 *     RussianFood.com recipe pages do not publish per-recipe kcal/BJXY, so
 *     nutrition is always computed from the ingredient DB for real recipes too.
 */

const MENU_DATA_DIR = path.join(__dirname, '..', '..', 'menu-data');

export interface RecipeProvider {
  readonly kind: string;
  getAllRecipes(): Promise<Recipe[]>;
  getRecipe(id: string): Promise<Recipe | null>;
}

export interface PriceProvider {
  readonly kind: string;
  readonly isMock: boolean;
  /** Human-readable provenance of the numbers, e.g. harness + date. */
  readonly sourceLabel: string;
  getStores(): Promise<Store[]>;
  getOffers(storeId: StoreId): Promise<ProductOffer[]>;
}

export interface NutritionProvider {
  /** Per-100g values for the ingredient, or null when unknown. */
  getPer100g(ingredientId: string, ingredientName: string): Promise<NutritionPer100g | null>;
  readonly sourceLabel: string;
}

// ---------------------------------------------------------------------------
// Fixture / demo providers
// ---------------------------------------------------------------------------

export class FixtureRecipeProvider implements RecipeProvider {
  readonly kind = 'fixture';
  private readonly recipes = buildFixtureRecipes();

  getAllRecipes(): Promise<Recipe[]> {
    return Promise.resolve(this.recipes);
  }

  getRecipe(id: string): Promise<Recipe | null> {
    return Promise.resolve(this.recipes.find((r) => r.id === id) ?? null);
  }
}

export class MockPriceProvider implements PriceProvider {
  readonly kind = 'mock';
  readonly isMock = true;
  private readonly offers = buildMockOffers();
  readonly sourceLabel = MOCK_PRICE_SOURCE_LABEL;

  getStores(): Promise<Store[]> {
    return Promise.resolve(STORES);
  }

  getOffers(storeId: StoreId): Promise<ProductOffer[]> {
    return Promise.resolve(this.offers.filter((o) => o.storeId === storeId));
  }
}

export class FixtureNutritionProvider implements NutritionProvider {
  readonly sourceLabel = 'Справочная база пищевой ценности';

  getPer100g(ingredientId: string, _ingredientName: string): Promise<NutritionPer100g | null> {
    return Promise.resolve(getIngredientNutrition(ingredientId));
  }
}

// ---------------------------------------------------------------------------
// Real-data snapshot providers (backend/menu-data/*.json)
// ---------------------------------------------------------------------------

/** On-disk format of backend/menu-data/recipes.json (RussianFood ingestion). */
export interface RecipesSnapshotFile {
  kind: 'russianfood_import';
  fetchedAt: string;
  source: string;
  recipes: Recipe[];
}

/** On-disk format of backend/menu-data/prices.json (curated price snapshot). */
export interface PricesSnapshotFile {
  kind: 'snapshot';
  updatedAt: string;
  sourceName: string;
  /** Optional human-readable note per store, e.g. catalogue page used. */
  storeNotes?: Partial<Record<StoreId, string>>;
  offers: ProductOffer[];
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

/**
 * Real recipes imported from RussianFood.com (offline ingestion, see
 * backend/scripts/ingest-russianfood.ts). Falls back to an empty catalogue
 * when the snapshot is missing — the planner then reports 'no_recipes'.
 */
export class SnapshotRecipeProvider implements RecipeProvider {
  readonly kind = 'russianfood_snapshot';
  readonly sourceLabel = 'RussianFood.com';
  private readonly recipes: Recipe[];
  readonly snapshotMeta: { fetchedAt: string; source: string } | null;

  constructor(filePath = path.join(MENU_DATA_DIR, 'recipes.json')) {
    const parsed = readJsonFile<RecipesSnapshotFile>(filePath);
    if (parsed && Array.isArray(parsed.recipes)) {
      this.recipes = parsed.recipes;
      this.snapshotMeta = { fetchedAt: parsed.fetchedAt, source: parsed.source };
    } else {
      this.recipes = [];
      this.snapshotMeta = null;
    }
  }

  /** true when a usable snapshot is present on disk. */
  get isAvailable(): boolean {
    return this.recipes.length > 0;
  }

  getAllRecipes(): Promise<Recipe[]> {
    return Promise.resolve(this.recipes);
  }

  getRecipe(id: string): Promise<Recipe | null> {
    return Promise.resolve(this.recipes.find((r) => r.id === id) ?? null);
  }
}

/**
 * Real price snapshot of the retail chains' public catalogues. The numbers are
 * NOT scraped in the request path: they come from backend/menu-data/prices.json
 * which a human curator maintains (with the crawler tool as a helper). Every
 * offer carries isMock: false and its source; staleness is handled by the
 * planner via PRICE_MAX_AGE_DAYS.
 */
export class CuratedPriceProvider implements PriceProvider {
  readonly kind = 'snapshot';
  readonly isMock = false;
  private readonly offers: ProductOffer[];
  readonly snapshotMeta: { updatedAt: string; sourceName: string; storeNotes: Partial<Record<StoreId, string>> };
  readonly sourceLabel: string;

  constructor(filePath = path.join(MENU_DATA_DIR, 'prices.json')) {
    const parsed = readJsonFile<PricesSnapshotFile>(filePath);
    if (parsed && Array.isArray(parsed.offers)) {
      this.offers = parsed.offers;
      this.snapshotMeta = {
        updatedAt: parsed.updatedAt,
        sourceName: parsed.sourceName,
        storeNotes: parsed.storeNotes ?? {},
      };
      this.sourceLabel = `Реальные цены из каталогов сетей (${parsed.updatedAt})`;
    } else {
      this.offers = [];
      this.snapshotMeta = { updatedAt: '', sourceName: 'snapshot missing', storeNotes: {} };
      this.sourceLabel = 'Снапшот цен не найден';
    }
  }

  get isAvailable(): boolean {
    return this.offers.length > 0;
  }

  getStores(): Promise<Store[]> {
    return Promise.resolve(
      STORES.map((s) => (this.isAvailable ? { ...s, priceCatalog: 'live' } : s))
    );
  }

  getOffers(storeId: StoreId): Promise<ProductOffer[]> {
    return Promise.resolve(this.offers.filter((o) => o.storeId === storeId));
  }
}

// ---------------------------------------------------------------------------
// RussianFood.com adapter
// ---------------------------------------------------------------------------

/**
 * Polite adapter for https://www.russianfood.com/ recipes.
 *
 * What the site provides (verified):
 *   - title            : <h1 class="title">
 *   - photo            : <meta property="og:image"> / <img class="tozoom">
 *   - ingredients      : <table class="ingr"> rows «Название - количество»
 *   - portions         : sub-info block <b>N</b> порций
 *   - cooking time     : sub-info block «…ч …мин»
 *   - steps            : <div class="step_n"> <p> …
 *   - categories       : /recipes/bytype/?fid=… (heading trail)
 *   - NO nutrition     : the site provides no kcal/BJXY data → nutrition is
 *     computed on our side from the ingredient nutrition DB (NutritionProvider).
 *
 * robots.txt allows /recipes/ paths (we never touch /forum, /search, /users).
 * The adapter is polite: a configurable delay between requests, a robots
 * check before crawling, and it is intended to be run as an offline ingestion
 * step, NOT from the request path. The planner uses providers at runtime; the
 * RussianFood adapter is available for ingestion/refresh jobs.
 */

export class RussianFoodRecipeProvider implements RecipeProvider {
  readonly kind = 'russianfood';

  constructor(private readonly options: { politenessDelayMs?: number; userAgent?: string } = {}) {}

  private get userAgent(): string {
    return (
      this.options.userAgent ??
      'ValentinesMenuBot/1.0 (+https://valentines-sigma-neon.vercel.app; dataset ingestion: polite crawler)'
    );
  }

  /** Headers must be ASCII per HTTP spec; strip any non-ASCII chars. */
  private get httpHeaders(): Record<string, string> {
    return { 'User-Agent': this.userAgent.replace(/[^\x00-\x7F]/g, '') };
  }

  private get delayMs(): number {
    return this.options.politenessDelayMs ?? 1500;
  }

  /**
   * Fetches HTML and decodes it from a legacy charset (default windows-1251,
   * the site's own encoding; the Wayback mirror serves the same raw bytes).
   */
  async fetchHtml(url: string, charset: string = 'windows-1251'): Promise<{ ok: boolean; html: string; status: number }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(url, {
        headers: this.httpHeaders,
        signal: controller.signal,
        redirect: 'follow',
      });
      const buf = new Uint8Array(await res.arrayBuffer());
      const html = new TextDecoder(charset).decode(buf);
      return { ok: res.ok, html, status: res.status };
    } catch (error) {
      return { ok: false, html: '', status: 0 };
    } finally {
      clearTimeout(timer);
    }
  }

  /** robots.txt based gate: we crawl only the /recipes/ tree. */
  async robotsAllow(htmlUrl: string): Promise<boolean> {
    try {
      const res = await fetch('https://www.russianfood.com/robots.txt', {
        headers: this.httpHeaders,
      });
      const body = await res.text();
      const path = this.pathOf(htmlUrl);
      // Only the group that matches our user-agent (or the fallback `*`
      // group) applies — never the rules of named third-party bots.
      const disallowLines = this.sectionDirectives(body, 'Disallow');
      return disallowLines.every((p) => !path.startsWith(p));
    } catch {
      // If robots.txt can't be read, refuse to crawl rather than guess.
      return false;
    }
  }

  /** Directives of the robots.txt group that applies to our user agent. */
  private sectionDirectives(body: string, directive: 'Disallow'): string[] {
    const myUa = this.userAgent.toLowerCase();
    const lines = body.split(/\r?\n/).map((l) => l.trim());
    const sections: string[][] = [];
    let current: string[] = [];
    for (const line of lines) {
      if (line.toLowerCase().startsWith('user-agent:')) {
        if (current.length) sections.push(current);
        current = [line];
      } else if (line) {
        current.push(line);
      }
    }
    if (current.length) sections.push(current);

    let chosen: string[] | null = null;
    for (const section of sections) {
      const agents = section
        .filter((l) => l.toLowerCase().startsWith('user-agent:'))
        .map((l) => l.slice('user-agent:'.length).trim().toLowerCase())
        .filter(Boolean);
      if (agents.includes(myUa) || agents.includes('*')) {
        chosen = section;
        break;
      }
    }
    if (!chosen) return [];
    return chosen
      .filter((l) => l.toLowerCase().startsWith('disallow:'))
      .map((l) => l.slice('disallow:'.length).trim())
      .filter((p) => p.length > 0);
  }

  private pathOf(url: string): string {
    try {
      return new URL(url).pathname;
    } catch {
      return '';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Blocks until the politeness delay has elapsed. Called between requests to
   * avoid hammering the site.
   */
  private async throttle(): Promise<void> {
    if (this.delayMs > 0) await this.sleep(this.delayMs);
  }

  /** Parse a decoded recipe HTML document into a Recipe. */
  parseRecipe(html: string, rid: string): Recipe | null {
    const escapeHtml = (s: string): string =>
      s
        .replace(/&nbsp;/g, ' ')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&laquo;/g, '«')
        .replace(/&raquo;/g, '»')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .trim();

    const titleMatch = /<h1 class="title\s*">([^<]+)<\/h1>/.exec(html);
    if (!titleMatch) return null;
    const name = escapeHtml(titleMatch[1]);

    const portionsMatch = /<i class="ico_portion"><\/i>\s*<\/div>\s*&nbsp;\s*<span class="hl"><b>\s*(\d+)\s*<\/b>/.exec(html);
    const portionFallback = /<span class="portion">\s*[^<]*?(\d+)\s*порци/.exec(html);
    const baseServings = portionsMatch
      ? parseInt(portionsMatch[1], 10)
      : portionFallback
        ? parseInt(portionFallback[1], 10)
        : 1;

    const timeMatch = /<i class="ico_time"><\/i>\s*<\/div>\s*&nbsp;\s*<span class="hl">\s*(.*?)\s*<\/span>/s.exec(html);
    let timeMin: number | null = null;
    if (timeMatch) {
      const inner = timeMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const h = /(\d+)\s*час/.exec(inner);
      const m = /(\d+)\s*мин/.exec(inner);
      timeMin = (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
      if (timeMin === 0) timeMin = null;
    }

    const ogImage = /<meta\s+property="og:image"\s+content="([^"]+)"/.exec(html);
    const photoUrl = ogImage ? `https:${ogImage[1].replace(/^\/\//, '//')}` : undefined;

    const ingredients: IngredientQty[] = [];
    const rowRe = /<tr class="ingr_tr_[01]">\s*<td colspan="3" class="padding_l padding_r">\s*<span class="">([^<]+)<\/span>/g;
    let row;
    while ((row = rowRe.exec(html)) !== null) {
      const text = escapeHtml(row[1]).replace(/\s+/g, ' ');
      const parsed = this.parseIngredientText(text);
      if (parsed) ingredients.push(parsed);
    }

    const steps: string[] = [];
    const stepRe = /<div class="step_n">\s*<div class="img_c">[\s\S]*?<\/div>\s*<p>([\s\S]*?)<\/p>/g;
    let step;
    while ((step = stepRe.exec(html)) !== null) {
      const text = step[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) steps.push(text);
    }

    return {
      id: `russianfood-${rid}`,
      name,
      category: 'Рецепты',
      baseServings,
      timeMin: timeMin ?? null,
      ingredients,
      steps: steps.length ? steps : undefined,
      photoUrl,
      sourceUrl: `https://www.russianfood.com/recipes/recipe.php?rid=${rid}`,
      dataKind: 'russianfood_import',
      sourceLabel: 'RussianFood.com',
    };
  }

  /** Parse «Название — количество» into a canonical IngredientQty. */
  parseIngredientText(text: string): IngredientQty | null {
    const dash = /^(.+?)\s*[—–-]\s*(.+)$/.exec(text);
    if (!dash) return null;
    const rawName = dash[1].trim();
    const rawQty = dash[2].trim();

    // Lead number; everything after it is a unit or kitchen-measure token.
    const numRe = /^\s*(\d+([.,]\d+)?)/;
    const numMatch = numRe.exec(rawQty);
    if (!numMatch) return null;
    const qty = parseFloat(numMatch[1].replace(',', '.'));
    const rest = rawQty.slice(numMatch[0].length).trim().toLowerCase();

    const flat = rawName.toLowerCase();
    const known = getIngredientByName(flat);
    const id = known?.id ?? `import:${flat}`;
    const measureUnit = (): Unit => (known?.unit === 'ml' ? 'ml' : 'g');

    // NB: \b does not treat Cyrillic as letters, so units are matched with a
    // Unicode letter lookahead instead of word boundaries.
    if (/^(кг|килогр)(?!\p{L})/u.test(rest)) return { ingredientId: id, qty: qty * 1000, unit: 'g' };
    if (/^(г|гр|грамм)(?!\p{L})/u.test(rest)) return { ingredientId: id, qty, unit: 'g' };
    if (/^(мл|миллилитр)(?!\p{L})/u.test(rest)) return { ingredientId: id, qty, unit: 'ml' };
    if (/^(л|литр)(?!\p{L})/u.test(rest)) return { ingredientId: id, qty: qty * 1000, unit: 'ml' };
    if (/^(шт|пку|ку|штук)(?!\p{L})/u.test(rest)) return { ingredientId: id, qty, unit: 'pcs' };

    if (/^ст\.?\s*лож|^столов/.test(rest)) {
      return { ingredientId: id, qty: qty * 15, unit: measureUnit() };
    }
    if (/^ч\.?\s*лож|^чайн/.test(rest)) {
      return { ingredientId: id, qty: qty * 5, unit: measureUnit() };
    }
    if (/^стакан|^кружк/.test(rest)) {
      return { ingredientId: id, qty: qty * (measureUnit() === 'ml' ? 200 : 160), unit: measureUnit() };
    }
    if (/^зубчик/.test(rest)) {
      return { ingredientId: id, qty: qty * (known?.gramsPerPcs ?? 4), unit: 'g' };
    }
    if (/^горст/.test(rest)) {
      return { ingredientId: id, qty: qty * 30, unit: measureUnit() };
    }

    if (rest === '') {
      return { ingredientId: id, qty, unit: known?.unit ?? 'g' };
    }
    // «1 яйцо», «2 помидора» — word after the number is the product itself.
    if (known && /^[а-яёa-z]/.test(rest) && !/^(по вкусу|щепот)/.test(rest)) {
      const unit: Unit =
        known.unit === 'pcs' || known.gramsPerPcs ? 'pcs' : (known.unit ?? 'g');
      return { ingredientId: id, qty, unit };
    }
    return null;
  }

  getAllRecipes(): Promise<Recipe[]> {
    // Live crawl is outside the request path; run ingestRecipe via the
    // ingestion script and import the resulting JSON into a provider.
    return Promise.resolve([]);
  }

  getRecipe(_id: string): Promise<Recipe | null> {
    return Promise.resolve(null);
  }

  /** Ingestion entry point: fetch one recipe page, politely. */
  async ingestRecipe(rid: string): Promise<{ recipe: Recipe | null; error?: string }> {
    const url = `https://www.russianfood.com/recipes/recipe.php?rid=${rid}`;
    const allowed = await this.robotsAllow(url);
    if (!allowed) {
      return { recipe: null, error: 'robots.txt: crawling this path is not allowed' };
    }
    await this.throttle();
    const res = await this.fetchHtml(url);
    if (!res.ok) {
      return { recipe: null, error: `HTTP ${res.status}` };
    }
    const recipe = this.parseRecipe(res.html, rid);
    return recipe ? { recipe } : { recipe: null, error: 'unparseable' };
  }
}

/** Default provider bundle used by the planner. */
export interface MenuProviders {
  recipes: RecipeProvider;
  prices: PriceProvider;
  nutrition: NutritionProvider;
}

// Lazily-initialised singletons: snapshots are read from disk once.
let cachedPrices: CuratedPriceProvider | null = null;
let cachedRecipes: SnapshotRecipeProvider | null = null;

function priceProvider(): PriceProvider {
  if (!cachedPrices) cachedPrices = new CuratedPriceProvider();
  return cachedPrices.isAvailable ? cachedPrices : new MockPriceProvider();
}

function recipeProvider(): RecipeProvider {
  if (!cachedRecipes) cachedRecipes = new SnapshotRecipeProvider();
  return cachedRecipes.isAvailable ? cachedRecipes : new FixtureRecipeProvider();
}

export function defaultProviders(): MenuProviders {
  return {
    recipes: recipeProvider(),
    prices: priceProvider(),
    nutrition: new FixtureNutritionProvider(),
  };
}