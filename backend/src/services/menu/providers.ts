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
 *   - RecipeProvider: where recipes come from (fixture demo catalog today,
 *     live RussianFood.com ingestion later).
 *   - PriceProvider: per-store product offers (mock demo data today; real
 *     Belarusian retail catalogues later).
 *   - NutritionProvider: per-100g nutrition values (extensible reference DB).
 */

export interface RecipeProvider {
  readonly kind: string;
  getAllRecipes(): Promise<Recipe[]>;
  getRecipe(id: string): Promise<Recipe | null>;
}

export interface PriceProvider {
  readonly kind: string;
  readonly isMock: boolean;
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
  readonly sourceLabel = 'Справочная база (демо)';

  getPer100g(ingredientId: string, _ingredientName: string): Promise<NutritionPer100g | null> {
    return Promise.resolve(getIngredientNutrition(ingredientId));
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
      'ValentinesMenuBot/1.0 (+https://valentines-sigma-neon.vercel.app; dataset ingestion — polite crawler)'
    );
  }

  private get delayMs(): number {
    return this.options.politenessDelayMs ?? 1500;
  }

  /** Fetches CP1251 encoded HTML and decodes it to a JS string. */
  async fetchHtml(url: string): Promise<{ ok: boolean; html: string; status: number }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': this.userAgent },
        signal: controller.signal,
      });
      const buf = new Uint8Array(await res.arrayBuffer());
      const html = new TextDecoder('windows-1251').decode(buf);
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
        headers: { 'User-Agent': this.userAgent },
      });
      const body = await res.text();
      const path = this.pathOf(htmlUrl);
      const disallowLines = body
        .split(/\r?\n/)
        .filter((l) => /^Disallow:\s*(\/\S*)?/.test(l))
        .map((l) => l.replace(/^Disallow:\s*/, '').trim())
        .filter((p) => p.length > 0);
      return disallowLines.every((p) => !path.startsWith(p));
    } catch {
      // If robots.txt can't be read, refuse to crawl rather than guess.
      return false;
    }
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
    const baseServings = portionsMatch ? parseInt(portionsMatch[1], 10) : 1;

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

    const isKg = rawQty.includes('кг');
    const isG = rawQty.includes('г') && !isKg;
    const isL = rawQty.includes('л') && !rawQty.includes('мл');
    const isMl = rawQty.includes('мл');
    const isPcs = rawQty.includes('шт') || rawQty.includes('пку') || rawQty.includes('ку');

    const num = /(\d+([.,]\d+)?)/.exec(rawQty);
    if (!num) return null;
    const qty = parseFloat(num[1].replace(',', '.'));

    const flat = rawName.toLowerCase();
    const known = getIngredientByName(flat);

    if (isKg) return { ingredientId: known?.id ?? `import:${flat}`, qty: qty * 1000, unit: 'g' };
    if (isG) return { ingredientId: known?.id ?? `import:${flat}`, qty, unit: 'g' };
    if (isMl || isL) {
      return {
        ingredientId: known?.id ?? `import:${flat}`,
        qty: isL ? qty * 1000 : qty,
        unit: 'ml',
      };
    }
    if (isPcs) return { ingredientId: known?.id ?? `import:${flat}`, qty, unit: 'pcs' };
    if (/^[0-9.,]+\s*$/.test(rawQty)) {
      const unit: Unit = known?.unit ?? 'g';
      return { ingredientId: known?.id ?? `import:${flat}`, qty, unit };
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

export function defaultProviders(): MenuProviders {
  return {
    recipes: new FixtureRecipeProvider(),
    prices: new MockPriceProvider(),
    nutrition: new FixtureNutritionProvider(),
  };
}