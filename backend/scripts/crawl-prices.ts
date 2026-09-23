/**
 * Curated-price snapshot tool.
 *
 * Retail catalogues (evroopt.by, hippo.by, green.by, korona.by) are JS-loaded
 * web apps; their prices are generally NOT exposed in static HTML, so the tool
 * does its best to auto-extract (JSON-LD and embedded JSON) and otherwise
 * prints an honest per-store manual curation checklist. It NEVER fabricates
 * numbers.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/crawl-prices.ts \
 *     --manual ../menu-data/manual-offers.json --out ../menu-data/prices.json
 *
 * --manual file shape (optional):
 *   { "offers": [
 *       { "storeId": "euroopt", "productId": "chicken_fillet", "productName": "...",
 *         "price": 7.49, "packageQuantity": 1000, "packageUnit": "g",
 *         "sourceUrl": "https://evroopt.by/..." }
 *   ] }
 * Any offer you place in the manual file must come from the actual catalogue.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { getIngredient, INGREDIENTS } from '../src/services/menu/fixtures';
import { STORES } from '../src/services/menu/fixtures';
import type { ProductOffer, StoreId } from '../src/services/menu/types';
import { normalizeName } from '../src/services/menu/allergens';

const SITES: Record<StoreId, string> = {
  euroopt: 'https://evroopt.by/',
  hippo: 'https://hippo.by/',
  green: 'https://green.by/',
  korona: 'https://korona.by/',
};

function argVal(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string): Promise<{ status: number; text: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) ValentinesMenuBot/1.0' },
      redirect: 'follow',
    });
    return { status: res.status, text: await res.text() };
  } catch {
    return { status: 0, text: '' };
  }
}

/** Loose similarity of a scraped product name against the catalogue. */
function matchCatalogue(nameRaw: string): { id: string; normalized: string; score: number } | null {
  const n = normalizeName(nameRaw);
  if (!n) return null;
  const parts = n.split(' ').filter(Boolean);
  let best: { id: string; score: number } | null = null;
  for (const ing of INGREDIENTS) {
    const inNorm = normalizeName(ing.name);
    // score: exact > prefix by first word(s) overlap
    let score = 0;
    if (inNorm === n) score = 100;
    else if (inNorm.startsWith(`${parts[0]} `) || n.startsWith(`${inNorm} `)) score = 60;
    else if (parts.every((p) => inNorm.includes(p))) score = 40;
    if (score > 0 && (!best || score > best.score)) best = { id: ing.id, score };
  }
  return best ? { id: best.id, normalized: n, score: best.score } : null;
}

interface AutoHit {
  productId: string;
  productName: string;
  price: number;
}

/** Try to pull {name, price} pairs from embedded JSON-LD / JSON blobs. */
function autoExtract(text: string, hostLabel: string): AutoHit[] {
  const hits: AutoHit[] = [];
  const jsonLdBlocks = [...text.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)];
  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block[1]);
      const products = Array.isArray(parsed) ? parsed : (parsed['@graph'] ?? [parsed]);
      for (const item of products) {
        const name = item?.name ?? (item?.itemListElement as unknown[] | undefined)?.map(() => null)?.[0];
        const offers = Array.isArray(item?.offers) ? item.offers : item?.offers ? [item.offers] : [];
        for (const offer of offers) {
          if (typeof name === 'string' && typeof offer?.price === 'number') {
            const matched = matchCatalogue(name);
            if (matched) hits.push({ productId: matched.id, productName: name, price: offer.price });
          }
        }
      }
    } catch {
      // skip malformed json-ld
    }
  }
  // Generic embedded JSON: "name" ... "price": N within a confined window.
  if (hits.length === 0) {
    const pairs = [...text.matchAll(/"name"\s*:\s*"([^"]{3,80})"[^}]{0,400}?"price"\s*:\s*(\d+(?:\.\d+)?)/g)];
    for (const m of pairs) {
      const matched = matchCatalogue(m[1]);
      if (matched) hits.push({ productId: matched.id, productName: m[1], price: Number(m[2]) });
    }
  }
  for (const h of hits) h.price = Math.round(h.price * 100) / 100;
  console.log(`  [${hostLabel}] auto hits: ${hits.length}`);
  return hits;
}

async function main() {
  const argv = process.argv.slice(2);
  const manualPath = argVal(argv, '--manual');
  const out = argVal(argv, '--out') ?? path.join(__dirname, '..', 'menu-data', 'prices.json');

  mkdirSync(path.dirname(out), { recursive: true });

  const autoOffers: ProductOffer[] = [];
  const storeNotes: Partial<Record<StoreId, string>> = {};
  let idx = 0;
  for (const store of STORES) {
    idx += 1;
    const url = SITES[store.id];
    if (idx > 1) await sleep(400);
    console.log(`[${store.id}] ${url}`);
    const { status, text } = await fetchText(url);
    if (status !== 200) {
      storeNotes[store.id] = `HTTP ${status} — каталог недоступен; нужна ручная проверка`;
      continue;
    }
    const hits = autoExtract(text, store.id);
    for (const h of hits) {
      autoOffers.push({
        productId: h.productId,
        storeId: store.id,
        productName: h.productName,
        price: h.price,
        currency: 'BYN',
        // Without an explicit unit price, quantity/weight is unknowable from
        // text — we keep a neutral 1-unit package so the amount is still
        // meaningful and honest, and flag it in source.
        packageQuantity: 1,
        packageUnit: getIngredient(h.productId)?.unit ?? 'g',
        updatedAt: new Date().toISOString(),
        source: `${url} (auto-extracted)`,
        isMock: false,
      });
    }
    storeNotes[store.id] =
      hits.length > 0
        ? `${hits.length} позиций извлечено автоматически — ТРЕБУЕТСЯ ручная верификация цены/веса упаковки`
        : 'цены в статичном HTML не обнаружены (JS-каталог) — заполните вручную, см. инструкцию ниже';
  }

  // Merge explicitly curated offers (trusted numbers).
  let curated: ProductOffer[] = [];
  if (manualPath) {
    try {
      const manual = JSON.parse(readFileSync(manualPath, 'utf8')) as {
        offers: Omit<ProductOffer, 'currency' | 'updatedAt' | 'isMock' | 'source'> & {
          source?: string;
        }[];
      };
      curated = manual.offers.map((o) => ({
        ...o,
        currency: 'BYN' as const,
        updatedAt: new Date().toISOString(),
        source: o.source ?? `ручная выверка`,
        isMock: false,
      }));
      console.log(`manual: ${curated.length} offers merged`);
    } catch (e) {
      console.error(`Cannot read manual file ${manualPath}:`, (e as Error).message);
    }
  }

  const seen = new Set<string>();
  const offers = [...curated, ...autoOffers].filter((o) => {
    const k = `${o.storeId}:${o.productId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const payload = {
    kind: 'snapshot',
    updatedAt: new Date().toISOString(),
    sourceName: 'Евроопт / Гиппо / Green / Корона — публичные каталоги',
    storeNotes,
    offers,
  };
  writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\nwrote ${out}: ${offers.length} offers`);

  if (offers.length === 0) {
    console.log(`
Снапшот пуст — это ожидаемо, пока вы не выверили цены. Чтобы наполнить его:
1) Откройте каталог нужной сети (например https://evroopt.by/catalog/),
   найдите товар из нашего списка продуктов.
2) Впишите цену и вес упаковки в файл manual-offers.json (см. формат в шапке скрипта).
3) Перезапустите скрипт: он выполнит слияние и запишет prices.json.
Позиции без цены будут честно показаны как «нет цены» и не попадут в меню.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});