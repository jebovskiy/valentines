/**
 * Offline ingestion of real recipes from RussianFood.com into
 * backend/menu-data/recipes.json.
 *
 * The planner only accepts recipes whose every ingredient maps to our
 * ingredient catalogue (anything else is treated as an unknown allergen and
 * rejected). So this script keeps only recipes with 100% catalogue coverage
 * after dropping trivial free items (water, generic spices) and unquantified
 * rows.
 *
 * Polite: respects robots.txt (once), throttles between requests, touches only
 * the /recipes/ tree. Run offline (not from the request path). Candidates can
 * come from collect-jobs.ts (job list) or an explicit rid list / scan window:
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/ingest-russianfood.ts \
 *     --jobs ../menu-data/jobs.json --max 60 --delay 350
 *   node node_modules/tsx/dist/cli.mjs scripts/ingest-russianfood.ts \
 *     --rids 179460,179514 --delay 600 --out ../menu-data/recipes.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { RussianFoodRecipeProvider } from '../src/services/menu/providers';

/**
 * Trivial items dropped before the coverage gate: free/negligible for cost and
 * nutrition, and the menu copy has no place for them.
 */
const SKIP_INGREDIENT_NAMES: ReadonlySet<string> = new Set([
  'вода',
  'воды',
  'специи',
  'специй',
  'приправы',
  'лавровый лист',
  'перец горошком',
  'перец чили',
  'перец душистый',
  'уксус',
  'уксус столовый',
  'горчица',
  'сода',
  'сода пищевая',
  'разрыхлитель',
  'корица',
  'гвоздика',
  'базилик',
  'тимьян',
  'розмарин',
  'кориандр',
  'кунжут',
  'петрушка сушеная',
]);

interface CliOptions {
  rids: number[];
  jobs: string | null;
  scanStart?: number;
  scanEnd?: number;
  delay: number;
  maxRecipes: number;
  fetchCap: number;
  via: 'live' | 'wayback';
  out: string;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    rids: [],
    jobs: null,
    delay: 700,
    maxRecipes: 80,
    fetchCap: 400,
    via: 'live',
    out: '',
  };
  const argVal = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const ridsArg = argVal('--rids');
  if (ridsArg) opts.rids.push(...ridsArg.split(',').map(Number).filter(Boolean));
  opts.jobs = argVal('--jobs') ?? null;
  const scan = argVal('--scan');
  if (scan) {
    const m = /^(\d+)\.\.(\d+)$/.exec(scan);
    if (m) {
      opts.scanStart = Number(m[1]);
      opts.scanEnd = Number(m[2]);
    }
  }
  opts.delay = Number(argVal('--delay') ?? '700');
  opts.maxRecipes = Number(argVal('--max') ?? '80');
  opts.fetchCap = Number(argVal('--fetch-cap') ?? '400');
  if (argVal('--via') === 'wayback') opts.via = 'wayback';
  opts.out = argVal('--out') ?? '';
  return opts;
}

function recipeUrl(rid: number, via: CliOptions['via']): string {
  const live = `https://www.russianfood.com/recipes/recipe.php?rid=${rid}`;
  if (via === 'wayback') return `https://web.archive.org/web/2025id_/${live}`;
  return live;
}

function collectRids(opts: CliOptions): number[] {
  const order: { rid: number; score: number }[] = [];
  if (opts.jobs) {
    try {
      const jobs = JSON.parse(readFileSync(opts.jobs, 'utf8')) as {
        recipes?: { rid: number; products: string[] }[];
      };
      for (const r of jobs.recipes ?? []) {
        // Cheap proxy of full coverage: how many of the card's preview
        // products map to our catalogue. Process the most promising first.
        const { getIngredientByName } = require('../src/services/menu/fixtures');
        const known = r.products.filter((p) => getIngredientByName(p) != null).length;
        order.push({ rid: r.rid, score: known - r.products.length });
      }
    } catch {
      console.error(`Cannot read jobs file: ${opts.jobs}`);
      process.exit(1);
    }
  }
  for (const rid of opts.rids) order.push({ rid, score: Number.MIN_SAFE_INTEGER });
  if (opts.scanStart != null && opts.scanEnd != null) {
    for (let r = opts.scanStart; r <= opts.scanEnd; r++) order.push({ rid: r, score: Number.MIN_SAFE_INTEGER });
  }
  return [...order]
    .sort((a, b) => b.score - a.score || a.rid - b.rid)
    .map((o) => o.rid);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const rids = collectRids(opts);
  const out = opts.out || path.join(__dirname, '..', 'menu-data', 'recipes.json');
  if (rids.length === 0) {
    console.error('No rids given. Use --rids, --scan or --jobs');
    process.exit(1);
  }

  const provider = new RussianFoodRecipeProvider({ politenessDelayMs: opts.delay });
  const robotsUrl = 'https://www.russianfood.com/recipes/recipe.php?rid=1';
  const allowed = await provider.robotsAllow(robotsUrl);
  if (!allowed) {
    console.error('robots.txt: crawl denied — aborting');
    process.exit(1);
  }
  console.log(`robots.txt: /recipes/ allowed. ${rids.length} rids, delay ${opts.delay}ms, max ${opts.maxRecipes}`);

  const kept: NonNullable<ReturnType<typeof provider.parseRecipe>>[] = [];
  let fetched = 0;
  let parsed = 0;
  let noMoney = 0;
  let notMapped = 0;
  let tooFew = 0;
  const now = new Date();

  for (const rid of rids) {
    if (fetched >= opts.fetchCap) {
      console.warn(`fetch cap reached (${opts.fetchCap}), stopping early`);
      break;
    }
    const url = recipeUrl(rid, opts.via);
    if (fetched > 0) await sleep(opts.delay);
    const res = await provider.fetchHtml(url);
    fetched += 1;
    if (!res.ok || !res.html) continue;

    const recipe = provider.parseRecipe(res.html, String(rid));
    if (!recipe) {
      noMoney += 1;
      continue;
    }
    parsed += 1;

    const keptIngredients = recipe.ingredients.filter(
      (i) => !SKIP_INGREDIENT_NAMES.has(i.ingredientId.replace(/^import:/, '').toLowerCase().trim())
    );
    const unknown = keptIngredients.filter((i) => i.ingredientId.startsWith('import:'));
    if (unknown.length > 0) {
      notMapped += 1;
      continue;
    }
    if (keptIngredients.length < 2) {
      tooFew += 1;
      continue;
    }

    kept.push({ ...recipe, ingredients: keptIngredients });
    if (kept.length % 5 === 0) console.log(`kept ${kept.length}/${opts.maxRecipes}...`);
    if (kept.length >= opts.maxRecipes) break;
  }

  mkdirSync(path.dirname(out), { recursive: true });
  const payload = {
    kind: 'russianfood_import',
    fetchedAt: now.toISOString(),
    source: 'https://www.russianfood.com/recipes/',
    recipes: kept,
  };
  writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8');

  console.log(
    `Done: fetched=${fetched} parsed=${parsed} notMapped=${notMapped} tooFew=${tooFew} kept=${kept.length} -> ${out}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});