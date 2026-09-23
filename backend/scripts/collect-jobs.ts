/**
 * Collects recipe candidates from RussianFood.com category listings that
 * plausibly use only ingredients we know (cheap preview filter: the product
 * tag line of each card must fully resolve against our catalogue). Writes
 * backend/menu-data/jobs.json {rid, title, products[]} so the ingestion step
 * only fetches recipes with a good chance of 100% coverage.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/collect-jobs.ts --fids 1077,937 --pages 3
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { RussianFoodRecipeProvider } from '../src/services/menu/providers';

interface Card {
  rid: number;
  title: string;
  products: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

async function fetchCards(
  p: RussianFoodRecipeProvider,
  fid: number,
  page: number,
  delayMs: number
): Promise<Card[]> {
  const url = `https://www.russianfood.com/recipes/bytype/?fid=${fid}&page=${page}`;
  if (page > 1) await sleep(delayMs);
  const res = await p.fetchHtml(url);
  if (!res.ok) return [];
  const html = res.html;
  const cards: Card[] = [];
  for (const chunk of html.split(/<div class="in_seen/i).slice(1)) {
    const ridM = /recipe\.php\?rid=(\d+)/.exec(chunk);
    if (!ridM) continue;
    const titleM = /<h3 itemprop="name">([^<]+)<\/h3>/.exec(chunk);
    const prodM = /Продукты:&nbsp;([^<]+)<\/span>/.exec(chunk);
    const title = titleM ? titleM[1].replace(/&[^;]+;/g, ' ').trim() : '';
    const products = prodM
      ? prodM[1].split(',').map((s) => norm(s.replace(/&[^;]+;/g, ' '))).filter(Boolean)
      : [];
    cards.push({ rid: Number(ridM[1]), title, products });
  }
  return cards;
}

async function main() {
  const argv = process.argv.slice(2);
  const argVal = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const fids = (argVal('--fids') ?? '').split(',').map(Number).filter(Boolean);
  const pages = Number(argVal('--pages') ?? '2');
  const out = argVal('--out') ?? path.join(__dirname, '..', 'menu-data', 'jobs.json');
  if (fids.length === 0) {
    console.error('--fids required');
    process.exit(1);
  }

  const p = new RussianFoodRecipeProvider({ politenessDelayMs: 300 });
  const allow = await p.robotsAllow('https://www.russianfood.com/recipes/bytype/?fid=1077');
  if (!allow) {
    console.error('robots.txt denies /recipes/bytype/ — aborting');
    process.exit(1);
  }

  const seen = new Map<number, Card>();
  for (const fid of fids) {
    for (let page = 1; page <= pages; page++) {
      const cards = await fetchCards(p, fid, page, 350);
      for (const c of cards) if (!seen.has(c.rid)) seen.set(c.rid, c);
      console.log(`fid=${fid} page=${page}: ${cards.length} cards, total=${seen.size}`);
    }
  }

  const known = [...seen.values()].filter((c) => c.products.length > 0);

  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify(
      { kind: 'russianfood_jobs', collectedAt: new Date().toISOString(), recipes: known },
      null,
      2
    ),
    'utf8'
  );
  console.log(`candidates: ${known.length}/${seen.size} -> ${out}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});