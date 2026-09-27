/**
 * Automatic real-price snapshot for "Евроопт" via its official storefront
 * edostavka.by (robots: Allow *). The catalogue responds with full SSR data
 * (__NEXT_DATA__): product name, price, weight, measure, availability.
 *
 * Usage:
 *   node node_modules/tsx/dist/cli.mjs scripts/edostavka-crawler.ts [--dry-run] [--out <path>]
 *
 * One polite GET per category (first page only, never pagination queries).
 * Writes menu-data/prices.json: offers for euroopt only, others stay unpriced
 * (real JS catalogues) and the UI honestly falls back to "нет цен".
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { ProductOffer, StoreId } from '../src/services/menu/types';

const BASE = 'https://edostavka.by';
const UA = 'Mozilla/5.0 (Windows NT 10.0) ValentinesMenuBot/1.0 (price snapshot for a family menu app)';
const DELAY_MS = 150;
const MAX_CATEGORY_FETCHES = 500;

function argVal(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export async function fetchJson(url: string): Promise<{ status: number; data: any; html: string }> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  const html = await res.text();
  const m = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { status: res.status, data: null, html };
  try {
    return { status: res.status, data: JSON.parse(m[1]), html };
  } catch {
    return { status: res.status, data: null, html };
  }
}

interface Category { id: number; name: string }

export async function fetchCategories(): Promise<Category[]> {
  const { html } = await fetchJson(`${BASE}/categories`);
  const m = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  const seen = new Map<number, string>();
  for (const mm of m[1].matchAll(/"categoryListId":(\d+),"categoryListName":"([^"]+)"/g)) {
    const id = Number(mm[1]);
    const name = mm[2].replace(/\\u0026/g, '&').replace(/\s+/g, ' ').trim();
    if (!seen.has(id)) seen.set(id, name);
  }
  return [...seen].map(([id, name]) => ({ id, name }));
}

// --- product-name (nullable) <-> catalogue ----------------------------------
const CATEGORY_PREFIX = /^(?:овощи|фрукты|мясо|рыба|молочн|яйц|бакалея|морепродукт|масло)/i;

const FIXED_RULES: Array<[RegExp, [string, 'exclusive' | 'any']]> = [
  [/яйца\s*перепелин|перепелин[а-я]*\s*яйц/i, ['quail_eggs', 'exclusive']],
  [/яйц/i, ['eggs', 'exclusive']],
  [/филе.*индейк|индейк.*филе/i, ['turkey_fillet', 'exclusive']],
  [/утк|утенок|утенк|утят|мясо.*утк/i, ['duck', 'exclusive']],
  [/филе.*утк|утк.*филе|мясо.*утк/i, ['duck', 'exclusive']],
  [/печень.*курин|курин[а-я]*.*печен|печен.*цыплят/i, ['chicken_liver', 'exclusive']],
  [/сердц.*курин|курин[а-я]*.*сердц/i, ['chicken_heart', 'exclusive']],
  [/желудк.*курин|мышечн[а-я]*\s*желудк/i, ['chicken_gizzard', 'exclusive']],
  [/крыл.*курин|курин[а-я]*.*крыл/i, ['chicken_wing', 'any']],
  [/филе.*курин|курин.*филе|курин[а-я]*\s*(?:грудка|грудки|грудк)/i, ['chicken_fillet', 'exclusive']],
  [/голен|бедро|бедра|ножки|голени/i, ['chicken_leg', 'any']],
  [/шампиньон|гриб/i, ['mushroom', 'exclusive']],
  [/вешенк/i, ['oyster_mushroom', 'exclusive']],
  [/лисичк/i, ['chanterelle', 'exclusive']],
  [/белые\s*грибы|грибы\s*белые/i, ['porcini', 'exclusive']],
  [/брокколи/i, ['broccoli', 'exclusive']],
  [/цветная\s*капуст|капуст.*цветн/i, ['cauliflower', 'exclusive']],
  [/капуст.*краснокоч|краснокоч.*капуст/i, ['red_cabbage', 'exclusive']],
  [/капуста\s*пекинск|пекинск.*капуст/i, ['peking_cabbage', 'exclusive']],
  [/кольраби/i, ['kohlrabi', 'exclusive']],
  [/капуст/i, ['cabbage', 'exclusive']],
  [/перец.*чили|чили/i, ['chili_pepper', 'exclusive']],
  [/болгарск|перец.*сладк|перец.*болгарск|перец\s*грунтовой/i, ['bell_pepper', 'exclusive']],
  [/помидор[а-я]*\s*очищенн|очищенн[а-я]*\s*помидор|томат[а-я]*\s*в\s*собственном|помидор[а-я]*\s*консерв|томат[а-я]*\s*консерв/i, ['canned_tomatoes', 'any']],
  [/помидор|томат/i, ['tomato', 'exclusive']],
  [/баклажан/i, ['eggplants', 'exclusive']],
  [/тыкв/i, ['pumpkin', 'exclusive']],
  [/батат/i, ['sweet_potato', 'exclusive']],
  [/свекл/i, ['beets', 'exclusive']],
  [/редис/i, ['radish', 'exclusive']],
  [/сельдерей.*стебель|стебель.*сельдерея/i, ['celery_stalk', 'exclusive']],
  [/корень.*сельдерея|сельдерей.*корень|корневой.*сельдерей/i, ['celery_root', 'exclusive']],
  [/пастернак/i, ['parsnip', 'exclusive']],
  [/фенхель/i, ['fennel', 'exclusive']],
  [/спарж/i, ['asparagus', 'exclusive']],
  [/горошек.*зелен|горошек.*консерв|горошек.*сладк|горошины/i, ['green_peas_canned', 'any']],
  [/горох.*стручков|стручков.*горох|горох\s*свеж/i, ['green_peas', 'exclusive']],
  [/кукуруза\s*консерв|кукуруза\s*сладкая|кукуруза\s*сахарная|кукуруза.*зерн/i, ['corn_canned', 'any']],
  [/кукуруза\s*отварная|кукуруза\s*в\s*початках|кукуруза\s*свежая/i, ['corn', 'exclusive']],
  [/имбирь/i, ['ginger', 'exclusive']],
  [/лук-порей|лук\s*порей|порей/i, ['leek', 'exclusive']],
  [/лук\s*зелен[а-я]*|зелен[а-я]*\s*лук/i, ['green_onion', 'exclusive']],
  [/творог/i, ['cottage_cheese', 'exclusive']],
  [/сметана/i, ['sour_cream', 'exclusive']],
  [/сливки/i, ['cream', 'exclusive']],
  [/творож/i, ['cottage_cheese', 'exclusive']],
  [/кефир/i, ['kefir', 'exclusive']],
  [/ряженк/i, ['ryazhenka', 'exclusive']],
  [/плавлен/i, ['process_cheese', 'exclusive']],
  [/творожный\s*сыр|сыр\s*творожный|сыр\s*мягкий/i, ['cream_cheese', 'exclusive']],
  [/растительн.*масло|масло.*подсолнечн|подсолнечн.*масло/i, ['vegetable_oil', 'exclusive']],
  [/оливков/i, ['olive_oil', 'exclusive']],
  [/льн[я-яё]*.*масло|масло.*льнян/i, ['flaxseed_oil', 'exclusive']],
  [/кунжутн.*масло|масло.*кунжутн/i, ['sesame_oil', 'exclusive']],
  [/сливочн.*масло|масло.*сливочн/i, ['butter', 'exclusive']],
  [/брынз|фетакс|фета(?![а-яёa-z0-9])/i, ['feta', 'exclusive']],
  [/сыр(?![а-яёa-z0-9])/, ['cheese', 'exclusive']],
  [/гречк|гречнев/i, ['buckwheat', 'exclusive']],
  [/овсян|овсяные\s*хлопья|хлопья\s*овсяные|геркулес/i, ['oatmeal', 'exclusive']],
  [/манн.*крупа|крупа\s*манн/i, ['semolina', 'exclusive']],
  [/перлов/i, ['pearl_barley', 'exclusive']],
  [/кукурузн.*крупа|крупа\s*кукурузн/i, ['corn_grits', 'exclusive']],
  [/пшеничн.*крупа|крупа\s*пшеничн|булгур/i, ['wheat_grits', 'exclusive']],
  [/спагетти|макарон/i, ['pasta', 'exclusive']],
  [/пшеничн.*мука|мука.*пшеничн|мука(?![а-яёa-z0-9])/i, ['flour', 'exclusive']],
  [/ржаная\s*мука|мука\s*ржана/i, ['rye_flour', 'exclusive']],
  [/горох/i, ['peas', 'exclusive']],
  [/фасол/i, ['beans', 'exclusive']],
  [/чечевиц/i, ['lentils', 'exclusive']],
  [/маш(?![а-яёa-z0-9])/i, ['mung', 'exclusive']],
  [/сахар/i, ['sugar', 'exclusive']],
  [/соль(?![а-яёa-z0-9])/, ['salt', 'exclusive']],
  [/чёрн[а-я]*\s*перец|черн[а-я]*\s*перец|перец\s*молот/i, ['pepper', 'exclusive']],
  [/соевы|соус.*соев/i, ['soy_sauce', 'exclusive']],
  [/майонез/i, ['mayo', 'exclusive']],
  [/кетчуп/i, ['ketchup', 'exclusive']],
  [/горчиц/i, ['mustard', 'exclusive']],
  [/уксус/i, ['vinegar', 'exclusive']],
  [/томатн.*паст|паст.*томатн|пюре\s*томатн/i, ['tomato_paste', 'exclusive']],
  [/мёд|мед(?![а-яёa-z0-9])/i, ['honey', 'exclusive']],
  [/дрожж/i, ['yeast', 'exclusive']],
  [/сод[а-яё]*\s*пищев|пищев[а-я]*\s*сод/i, ['baking_soda', 'exclusive']],
  [/разрыхлит/i, ['baking_powder', 'exclusive']],
  [/панировочн.*сухар|сухар[а-я]*\s*панировочн|панировк/i, ['breadcrumbs', 'exclusive']],
  [/крахмал/i, ['starch', 'exclusive']],
  [/желатин/i, ['gelatin', 'exclusive']],
  [/оливк/i, ['olives', 'any']],
  [/маслин/i, ['black_olives', 'any']],
  [/каперс/i, ['capers', 'any']],
  [/тофу/i, ['tofu', 'exclusive']],
  [/лосос|семг/i, ['salmon', 'exclusive']],
  [/форель/i, ['trout', 'exclusive']],
  [/треск/i, ['cod', 'exclusive']],
  [/минтай/i, ['pollock', 'exclusive']],
  [/сельд/i, ['herring', 'exclusive']],
  [/скумбр/i, ['mackerel', 'exclusive']],
  [/карп/i, ['carp', 'exclusive']],
  [/сибас/i, ['sea_bass', 'exclusive']],
  [/миди/i, ['mussels', 'exclusive']],
  [/креветк/i, ['shrimps', 'exclusive']],
  [/арахис/i, ['peanuts', 'exclusive']],
  [/грецк/i, ['walnuts', 'exclusive']],
  [/миндал/i, ['almonds', 'exclusive']],
  [/кешью/i, ['cashews', 'exclusive']],
  [/фундук/i, ['hazelnuts', 'exclusive']],
  [/фисташк/i, ['pistachios', 'exclusive']],
  [/семечк[а-я]*\s*тыкв|семена\s*тыкв/i, ['pumpkin_seeds', 'exclusive']],
  [/семечк[а-я]*\s*подсолнечн|семена\s*подсолнечн|ядро\s*подсолнечн/i, ['sunflower_seeds', 'exclusive']],
  [/кунжут/i, ['sesame', 'exclusive']],
  [/семена\s*льн/i, ['flax_seeds', 'exclusive']],
  [/семена\s*чиа|чиа(?![а-яёa-z0-9])/i, ['chia', 'exclusive']],
  [/шпинат/i, ['spinach', 'exclusive']],
  [/микрозелень/i, ['microgreens', 'exclusive']],
  [/зелень|петрушк|укроп(?![а-яёa-z0-9])/i, ['herbs', 'exclusive']],
  [/лимон/i, ['lemon', 'exclusive']],
  [/лайм/i, ['limes', 'exclusive']],
  [/яблок/i, ['apples', 'exclusive']],
  [/виноград/i, ['grapes', 'exclusive']],
  [/апельсин/i, ['oranges', 'exclusive']],
  [/мандарин/i, ['tangerines', 'exclusive']],
  [/грейпфрут/i, ['grapefruit', 'exclusive']],
  [/груша|груши/i, ['pears', 'exclusive']],
  [/персик/i, ['peaches', 'exclusive']],
  [/нектарин/i, ['nectarines', 'exclusive']],
  [/абрикос/i, ['apricots', 'exclusive']],
  [/слива/i, ['plums', 'exclusive']],
  [/киви/i, ['kiwi', 'exclusive']],
  [/манго/i, ['mango', 'exclusive']],
  [/авокадо/i, ['avocado', 'exclusive']],
  [/ананас/i, ['pineapple', 'exclusive']],
  [/гранат/i, ['pomegranate', 'exclusive']],
  [/хурма(?![а-яёa-z0-9])/i, ['persimmon', 'exclusive']],
  [/дыня(?![а-яёa-z0-9])/i, ['melon', 'exclusive']],
  [/арбуз/i, ['watermelon', 'exclusive']],
  [/маракуй/i, ['passion_fruit', 'exclusive']],
  [/клубник/i, ['strawberries', 'exclusive']],
  [/малина/i, ['raspberries', 'exclusive']],
  [/ежевик/i, ['blackberries', 'exclusive']],
  [/черник/i, ['blueberries', 'exclusive']],
  [/изюм/i, ['raisins', 'exclusive']],
  [/кураг/i, ['dried_apricots', 'exclusive']],
  [/чернослив/i, ['prunes', 'exclusive']],
  [/финик/i, ['dates', 'exclusive']],
  [/инжир/i, ['dried_figs', 'exclusive']],
  [/клюква.*суш/i, ['dried_cranberry', 'exclusive']],
  [/молок/i, ['milk', 'exclusive']],
  [/йогурт|биойогурт/i, ['yogurt', 'exclusive']],
  [/картофел|картошка/i, ['potatoes', 'exclusive']],
  [/морков/i, ['carrots', 'exclusive']],
  [/лук(?![а-яёa-z0-9])|репчат/i, ['onions', 'exclusive']],
  [/чеснок/i, ['garlic', 'exclusive']],
  [/огурец|огурцы/i, ['cucumber', 'exclusive']],
  [/говядин/i, ['beef', 'exclusive']],
  [/свинин/i, ['pork', 'exclusive']],
  [/фарш(?![а-яёa-z0-9\s]*печен)[а-яё\s]{0,30}?(?:куриц|цыплен|цыплят|бройлер|из кур)/i, ['chicken_minced', 'exclusive']],
  [/фарш/i, ['chicken_minced', 'exclusive']],
  [/кабач/i, ['zucchini', 'exclusive']],
  [/пшен/i, ['millet', 'exclusive']],
  [/банан/i, ['bananas', 'exclusive']],
  [/рис(?![а-яёa-z0-9])/, ['rice', 'exclusive']],
  [/лаваш/i, ['lavash', 'exclusive']],
  [/хлеб(?![а-яёa-z0-9])/, ['bread', 'exclusive']],
];

const AMBIGUOUS_EXCLUDE = /консерв|маринован|маринад|солёны|солены|квашен|глазирован|пудр|ванил|аромат|рикотт|икр|фаршир|из\s*фарша|порции\s*из|фарш\s*рыбн|рыбн[а-я]*\s*фарш/;

function assertFix(norm: string): string | null {
  for (const [re, [id, mode]] of FIXED_RULES) {
    if (re.test(norm)) {
      if (mode === 'exclusive' && AMBIGUOUS_EXCLUDE.test(norm)) continue;
      return id;
    }
  }
  return null;
}
const WEIGHT_GLOBAL = /(\d[\d.,]*)\s*(?:г|г\.|гр|грамм|\bкг|килограмм|\bл|литр|\bмл|миллилитр)/i;
const QTY_PCS = /(\d+)\s*(?:шт|штук)/i;

interface WeightInfo { qty: number; unit: 'g' | 'ml' | 'pcs' | null }

function parseWeight(name: string, previews: any[], measure: string): WeightInfo {
  const wCandidates: { qty: number; unit: 'g' | 'ml' | 'pcs' | null }[] = [];
  const vCandidates: { qty: number; unit: 'g' | 'ml' | 'pcs' | null }[] = [];
  for (const p of previews ?? []) {
    const pn = (p?.propertyName ?? '').toLowerCase();
    const val = Array.isArray(p?.propertyValue) ? p.propertyValue[0] : p?.propertyValue;
    if (typeof val !== 'string') continue;
    const m = val.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(кг|килограмм|л|литр|мл|миллилитр)?/i);
    if (!m) continue;
    const n = Number(m[1]);
    const vu = (m[2] ?? '').toLowerCase();
    if (pn.includes('объем') || pn.includes('объём')) {
      let qty: number;
      if (vu === 'л') qty = Math.round(n * 1000);
      else if (vu === 'мл') qty = Math.round(n);
      else if (pn.includes('мл')) qty = Math.round(n);
      else if (pn.includes('л')) qty = Math.round(n * 1000);
      else qty = Math.round(n);
      vCandidates.push({ qty, unit: 'ml' });
    } else if (pn.includes('вес')) {
      const qty = pn.includes('кг') || vu === 'кг' || vu === 'килограмм' ? Math.round(n * 1000) : Math.round(n);
      wCandidates.push({ qty, unit: 'g' });
    }
  }
  const nm = name.toLowerCase();
  const num = (s: string) => Number(s.replace(',', '.'));
  const winName = nm.match(/(\d[\d.,]*)\s*(?:г|гр|грамм)(?![а-яёa-z0-9])/);
  if (winName) return { qty: Math.round(num(winName[1])), unit: 'g' };
  const kgInName = nm.match(/(\d[\d.,]*)\s*(?:кг|килограмм)(?![а-яёa-z0-9])/);
  if (kgInName) return { qty: Math.round(num(kgInName[1]) * 1000), unit: 'g' };
  const lInName = nm.match(/(\d[\d.,]*)\s*(?:л|литр)(?![а-яёa-z0-9])/);
  if (lInName) return { qty: Math.round(num(lInName[1]) * 1000), unit: 'ml' };
  const mlInName = nm.match(/(\d[\d.,]*)\s*мл(?![а-яёa-z0-9])/);
  if (mlInName) return { qty: Math.round(num(mlInName[1])), unit: 'ml' };
  const w = wCandidates[0];
  if (w) return w;
  const v = vCandidates[0];
  if (v) return v;
  if (measure === 'л') return { qty: 1000, unit: 'ml' };
  if (measure === 'кг') return { qty: 1000, unit: 'g' };
  return { qty: 0, unit: null };
}

const PARTIAL_PRODUCTS = /голубц|пельмен|котлет|биточк|наггетс|отбивн|полуфабрик|шашлык|колбаск|вареник|блинчик|рулет|пицц|запеканк|тефтел|фрикадельк|бургер|соточк|лазанья|набор|мюсли|с гречк|с овс|борщ|щи(?![а-яёa-z0-9])|суп(?![а-яёa-z0-9])|готовое блюдо|медальон|купат|киш(?![а-яёa-z0-9])|хачапури|мант(?![а-яёa-z0-9])|плов(?![а-яёa-z0-9])/;

/** category name regex -> allowed product ids ([] = known, take nothing). */
const CATEGORY_RULES: Array<[RegExp, string[]]> = [
  [/^картофель$/, ['potatoes', 'sweet_potato']],
  [/^морковь$/, ['carrots']],
  [/лук, чеснок/, ['onions', 'garlic', 'leek', 'green_onion']],
  [/^томаты?$/, ['tomato', 'canned_tomatoes']],
  [/^огурцы?$/, ['cucumber']],
  [/^перцы$/, ['bell_pepper', 'chili_pepper']],
  [/^капуста$/, ['cabbage', 'cauliflower', 'broccoli', 'red_cabbage', 'peking_cabbage', 'kohlrabi']],
  [/другие овощи|овощи$/, ['potatoes', 'carrots', 'onions', 'garlic', 'tomato', 'cucumber', 'bell_pepper', 'cabbage', 'cauliflower', 'broccoli', 'red_cabbage', 'peking_cabbage', 'kohlrabi', 'zucchini', 'eggplants', 'pumpkin', 'beets', 'radish', 'sweet_potato', 'celery_stalk', 'celery_root', 'parsnip', 'fennel', 'asparagus', 'green_peas', 'corn', 'ginger', 'chili_pepper', 'leek', 'green_onion', 'spinach']],
  [/свежие грибы|грибы замороженные|грибы сушеные|^грибы$/, ['mushroom', 'oyster_mushroom', 'chanterelle', 'porcini']],
  [/^коровье молоко$/, ['milk']],
  [/^сливки$/, ['cream']],
  [/^сметана$|сметана, творог/, ['sour_cream', 'cottage_cheese']],
  [/^творог$/, ['cottage_cheese']],
  [/^твердые сыры$|копченые, другие сыры|^сыры$/, ['cheese', 'feta', 'process_cheese']],
  [/мягкие и творожные сыры/, ['feta', 'cottage_cheese', 'cream_cheese', 'tofu']],
  [/овечьи, козьи сыры/, ['feta']],
  [/плавленые сыры/, ['process_cheese']],
  [/масло сливочное/, ['butter']],
  [/^яйца$/, ['eggs']],
  [/^яйца перепелиные$/, ['quail_eggs']],
  [/макаронные изделия/, ['pasta']],
  [/^мука пшеничная$/, ['flour']],
  [/^мука иная$/, ['rye_flour']],
  [/^хлеб$/, ['bread', 'lavash']],
  [/^сахар$/, ['sugar']],
  [/специи, пряности, травы|сахар, соль, специи/, ['sugar', 'salt', 'pepper', 'baking_soda', 'baking_powder', 'yeast', 'gelatin', 'starch', 'breadcrumbs', 'vinegar', 'mustard']],
  [/крахмал, сода, лимонная кислота/, ['baking_soda', 'baking_powder', 'starch', 'gelatin']],
  [/^крупы$|крупы иные|крупы в варочных/, ['rice', 'buckwheat', 'oatmeal', 'millet', 'pasta', 'semolina', 'pearl_barley', 'corn_grits', 'wheat_grits', 'peas', 'beans', 'lentils', 'mung']],
  [/^подсолнечное масло$/, ['vegetable_oil']],
  [/^оливковое масло$/, ['olive_oil']],
  [/^масла$|^растительные масла$/, ['vegetable_oil', 'olive_oil', 'flaxseed_oil', 'sesame_oil', 'butter']],
  [/масло, уксус/, ['vegetable_oil', 'olive_oil', 'flaxseed_oil', 'sesame_oil', 'vinegar']],
  [/томатный соус/, ['tomato_paste']],
  [/помидор.*консерв|томат.*консерв|консервированн.*помидор/, ['canned_tomatoes']],
  [/кетчупы, соусы/, ['soy_sauce', 'tomato_paste', 'mayo', 'ketchup', 'mustard']],
  [/^майонез|майонезный соус|заправки для салатов/, ['mayo', 'ketchup', 'mustard', 'vinegar']],
  [/варенье, джемы, мед/, ['honey']],
  [/^лимоны$/, ['lemon']],
  [/^яблоки$/, ['apples']],
  [/^виноград$/, ['grapes']],
  [/^креветки$/, ['shrimps']],
  [/рыба свежемороженая|рыба охлажденная|тушки, филе, стейки/, ['cod', 'salmon', 'trout', 'pollock', 'herring', 'mackerel', 'carp', 'sea_bass', 'shrimps', 'mussels']],
  [/говядина замороженная/, ['beef']],
  [/свинина замороженная/, ['pork']],
  [/птица замороженная|мясо замороженное/, ['chicken_fillet', 'chicken_leg', 'chicken_wing', 'turkey_fillet', 'duck', 'beef', 'pork', 'cod', 'salmon', 'trout']],
  [/разделка куриная|разделка индейки|разделка/, ['chicken_fillet', 'chicken_leg', 'chicken_wing', 'chicken_liver', 'chicken_heart', 'chicken_gizzard', 'turkey_fillet', 'duck']],
  [/^фарши$|фарши и наборы|фарши от шефа/, ['chicken_minced']],
  [/^шпинат$/, ['spinach']],
  [/^шпинат$|^щавель$/, ['spinach']],
  [/^зелень$/, ['herbs', 'cilantro', 'basil', 'mint', 'rosemary', 'thyme', 'lettuce', 'arugula', 'microgreens']],
  [/кинза/, ['cilantro']],
  [/^базилик$/, ['basil']],
  [/^мята$/, ['mint']],
  [/^розмарин$/, ['rosemary']],
  [/^тимьян$/, ['thyme']],
  [/^петрушка$/, ['herbs']],
  [/^укроп$/, ['herbs']],
  [/^салаты$|^листовые салаты$/, ['lettuce', 'arugula']],
  [/^руккола$/, ['arugula']],
  [/^тофу$/, ['tofu']],
  [/^лаваш$/, ['lavash']],
  [/лаваш|лепешк/, ['lavash']],
  [/^микрозелень$/, ['microgreens']],
  [/^субпродукты$/, ['chicken_liver', 'chicken_heart', 'chicken_gizzard']],
  [/^семечки$/, ['sunflower_seeds', 'pumpkin_seeds']],
  [/орехи, сухофрукты, семечки/, ['walnuts', 'almonds', 'peanuts', 'cashews', 'hazelnuts', 'pistachios', 'pumpkin_seeds', 'sunflower_seeds', 'sesame', 'flax_seeds', 'chia', 'raisins', 'dried_apricots', 'prunes', 'dates', 'dried_figs', 'dried_cranberry']],
  [/^кефир, кисломолочные изделия$/, ['kefir', 'ryazhenka', 'yogurt']],
  [/^кефир$/, ['kefir']],
  [/^ряженка$/, ['ryazhenka']],
  [/^кунжут$/, ['sesame']],
  [/^семена льна$/, ['flax_seeds']],
  [/^семена чиа$/, ['chia']],
  [/^масло кунжутное$/, ['sesame_oil']],
  [/^масло льняное$/, ['flaxseed_oil']],
  [/^дрожжи$/, ['yeast']],
  [/^разрыхлитель$|^сода$/, ['baking_soda', 'baking_powder']],
  [/^крахмал$/, ['starch']],
  [/^желатин$/, ['gelatin']],
  [/^панировочные сухари$/, ['breadcrumbs']],
  [/^мука ржаная$/, ['rye_flour']],
  [/томаты консервированные/, ['canned_tomatoes']],
  [/кукуруза, горошек консервированные/, ['corn_canned', 'green_peas_canned']],
  [/маслины, оливки консервированные/, ['olives', 'black_olives']],
  [/^каперсы$/, ['capers']],
  [/^уксус$/, ['vinegar']],
  [/^горчица$/, ['mustard']],
  [/^кетчуп$/, ['ketchup']],
  [/^майонез$/, ['mayo']],
  [/^печень куриная$/, ['chicken_liver']],
  [/^мидии$/, ['mussels']],
  [/^миндаль$/, ['almonds']],
  [/^фундук$/, ['hazelnuts']],
  [/^фисташки$/, ['pistachios']],
  [/^семечки$|^тыквенные семечки$/, ['pumpkin_seeds']],
  [/^курага$/, ['dried_apricots']],
  [/^чернослив$/, ['prunes']],
  [/^финики$/, ['dates']],
  [/^изюм$/, ['raisins']],
  [/микрозелень/, ['microgreens']],
  [/овощи, грибы замороженные|овощи замороженные|полуфабрикаты овощные/, ['mushroom', 'spinach', 'herbs', 'cabbage', 'cauliflower', 'broccoli', 'green_peas', 'corn']],
  [/^овощи$/, ['potatoes', 'carrots', 'onions', 'garlic', 'tomato', 'cucumber', 'bell_pepper', 'cabbage', 'cauliflower', 'zucchini', 'spinach', 'mushroom']],
  [/овощи и фрукты/, ['potatoes', 'carrots', 'onions', 'garlic', 'tomato', 'cucumber', 'bell_pepper', 'cabbage', 'cauliflower', 'broccoli', 'red_cabbage', 'peking_cabbage', 'kohlrabi', 'zucchini', 'eggplants', 'pumpkin', 'beets', 'radish', 'sweet_potato', 'celery_stalk', 'celery_root', 'parsnip', 'fennel', 'asparagus', 'green_peas', 'corn', 'ginger', 'chili_pepper', 'leek', 'green_onion', 'spinach', 'herbs', 'lettuce', 'arugula', 'lemon', 'limes', 'apples', 'bananas', 'grapes', 'oranges', 'tangerines', 'grapefruit', 'pears', 'peaches', 'nectarines', 'apricots', 'plums', 'kiwi', 'mango', 'avocado', 'pineapple', 'pomegranate', 'persimmon', 'melon', 'watermelon', 'passion_fruit', 'strawberries', 'raspberries', 'blackberries', 'blueberries']],
  [/^фрукты$/, ['lemon', 'limes', 'apples', 'bananas', 'grapes', 'oranges', 'tangerines', 'grapefruit', 'pears', 'peaches', 'nectarines', 'apricots', 'plums', 'kiwi', 'mango', 'avocado', 'pineapple', 'pomegranate', 'persimmon', 'melon', 'watermelon', 'passion_fruit', 'strawberries', 'raspberries', 'blackberries', 'blueberries']],
  [/^молоко, яйца$/, ['milk', 'eggs']],
  [/^молоко, сливки$/, ['milk', 'cream', 'kefir', 'ryazhenka']],
  [/растительное молоко/, []],
  [/орех/, ['walnuts', 'almonds', 'peanuts', 'cashews', 'hazelnuts', 'pistachios', 'pumpkin_seeds', 'sunflower_seeds', 'sesame', 'flax_seeds', 'chia']],
  [/сухофрукт/, ['raisins', 'dried_apricots', 'prunes', 'dates', 'dried_figs', 'dried_cranberry', 'flax_seeds', 'chia']],
  [/горошек|кукуруза|оливк|маслин|каперс|фасоль/, ['green_peas_canned', 'corn_canned', 'olives', 'black_olives', 'capers', 'beans']],
  [/бобовые/, ['peas', 'beans', 'lentils', 'mung']],
  [/зелень|салаты/, ['herbs', 'cilantro', 'basil', 'mint', 'rosemary', 'thyme', 'lettuce', 'arugula', 'microgreens']],
];

function allowedIds(categoryName: string): string[] | null {
  const n = categoryName.toLowerCase();
  for (const [re, ids] of CATEGORY_RULES) {
    if (re.test(n)) return ids;
  }
  return null;
}

export function matchProductToCatalogue(productName: string, measure: string, previews: any[], categoryName: string): { id: string } | null {
  const norm = productName.toLowerCase();
  const allowed = allowedIds(categoryName);
  if (allowed === null || allowed.length === 0) return null;
  if (PARTIAL_PRODUCTS.test(norm)) return null;
  const fixed = assertFix(norm);
  if (!fixed) return null;
  if (fixed === 'cream' && /(?:^|\D)(10|12|15|18)\s*%/.test(norm)) return null; // recipe cream >= 20%
  if (allowed.includes(fixed)) return { id: fixed };
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function crawlCategories(cats: Category[]): Promise<ProductOffer[]> {
  const interest = /куриц|яйц|молок|сливк|сметан|творог|сыр|масло|овощ|помидор|огурц|перец|капуст|кукуруза|горош|гриб|шампиньон|картофел|морков|лук|чеснок|круп|рис|макарон|спагетти|гречк|овсян|мука|хлеб|хлебц|лаваш|сахар|соль|специ|приправ|соус|рыба|треск|лосос|семг|форель|минтай|сельд|скумбр|карп|сибас|миди|креветк|морепрод|зелень|петрушк|укроп|кинз|базил|мят|розмарин|тимьян|салат|руккол|микрозелень|лимон|лайм|фрукт|яблок|виноград|апельсин|мандарин|грейпфрут|груш|персик|нектарин|абрикос|слив|киви|манго|авокадо|ананас|гранат|хурма|дын|арбуз|маракуй|клубник|малин|ежевик|черник|орех|арахис|миндал|кешью|фундук|фисташк|семечк|кунжут|льн|чиа|изюм|кураг|чернослив|финик|инжир|сухофрукт|кетчуп|горчиц|уксус|майонез|заправк|бобов|горох|фасол|чечевиц|маш|мёд|мед|паста|бакалея|творож|сырник|полуфабрикат|заморозк|мясо|птиц|говядин|свинин|филе|фарш|кабачк|пшен|банан|баклажан|тыкв|свекл|редис|батат|сельдерей|пастернак|фенхель|спарж|вешенк|лисичк|тофу|колбас|охлажд|дрожж|сод|разрыхлит|крахмал|желатин|паниров|кефир|кисломолоч|ряжен|оливк|маслин|каперс|индейк|утк|субпродукт|печен|потрох|мидии/i;
  const selected = cats.filter((c) => interest.test(c.name));
  console.log(`categories: ${cats.length} total, ${selected.length} selected`);
  const offers: ProductOffer[] = [];
  let fetched = 0;
  for (const c of selected) {
    if (fetched >= MAX_CATEGORY_FETCHES) {
      console.log('reached fetch cap');
      break;
    }
    fetched += 1;
    if (fetched > 1) await sleep(DELAY_MS);
    const { status, data } = await fetchJson(`${BASE}/category/${c.id}`);
    const listing = data?.props?.pageProps?.listing;
    const products: any[] = Array.isArray(listing?.products) ? listing.products : [];
    let hits = 0;
    for (const p of products) {
      if (!p?.productName || p?.restInformation?.isAvailable === false) continue;
      const name = p.productName.replace(/\s+/g, ' ').trim();
      const priceRaw = p.price ?? {};
      const price = priceRaw.discountedPrice > 0 ? priceRaw.discountedPrice : priceRaw.basePrice;
      if (typeof price !== 'number' || price <= 0) continue;
      const matched = matchProductToCatalogue(name, p.quantityInfo?.measure ?? p.measure ?? '', p.previewProperties, c.name);
      if (!matched) continue;
      hits += 1;
      const weight = parseWeight(name, p.previewProperties, p.quantityInfo?.measure ?? p.measure ?? '');
      const measurePrice = Number(p.price?.measurePrice);
      let pkgQty: number;
      let pkgUnit: 'g' | 'ml' | 'pcs';
      if (p.soldByWeight && measurePrice > 0) {
        pkgQty = 1000;
        pkgUnit = 'g';
      } else if (weight.unit === 'g') {
        pkgQty = weight.qty; pkgUnit = 'g';
      } else if (weight.unit === 'ml') {
        pkgQty = weight.qty; pkgUnit = 'ml';
      } else {
        const pcs = name.match(QTY_PCS);
        if (pcs) { pkgQty = Number(pcs[1]); pkgUnit = 'pcs'; }
        else if ((p.quantityInfo?.measure ?? '') === 'шт') { pkgQty = 1; pkgUnit = 'pcs'; }
        else continue; // no honest package info
      }
      if (pkgQty <= 0) continue;
      offers.push({
        productId: matched.id,
        storeId: 'euroopt' as StoreId,
        productName: name,
        price: Math.round(price * 100) / 100,
        currency: 'BYN',
        packageQuantity: pkgQty,
        packageUnit: pkgUnit,
        updatedAt: new Date().toISOString(),
        source: `${BASE}/category/${c.id}`,
        isMock: false,
      });
    }
    if (hits > 0) console.log(`  [${c.id}] ${c.name}: ${products.length} products, ${hits} matched`);
  }
  return offers;
}

function bestPerIngredient(offers: ProductOffer[]): ProductOffer[] {
  const perGram = (o: ProductOffer) => {
    const g = o.packageUnit === 'g' ? o.packageQuantity : o.packageUnit === 'ml' ? o.packageQuantity : o.packageQuantity * (o.productId === 'quail_eggs' ? 12 : o.productId === 'eggs' || o.productId === 'lemon' ? 60 : 100);
    return g > 0 ? o.price / g : Infinity;
  };
  const by = new Map<string, ProductOffer>();
  for (const o of offers) {
    const cur = by.get(o.productId);
    if (!cur || perGram(o) < perGram(cur)) by.set(o.productId, o);
  }
  return [...by.values()];
}

/**
 * edostavka does not sell raw chicken fillet (only legs/thighs). To keep
 * fillet-based recipes workable we expose the real chicken cut price as an
 * honest "chicken meat (thigh/leg) — fillet substitute" offer. The label is
 * explicit so the user always knows what price stands behind the number.
 */
function chickenFilletFallback(offers: ProductOffer[]): ProductOffer[] {
  if (offers.some((o) => o.productId === 'chicken_fillet')) return offers;
  const leg = offers.find((o) => o.productId === 'chicken_leg');
  if (!leg) return offers;
  return [
    ...offers.filter((o) => o.productId !== 'chicken_leg'),
    { ...leg, productId: 'chicken_fillet', productName: `${leg.productName} (заменитель куриного филе — филе в каталоге не продаётся)` },
  ];
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const out = argVal(argv, '--out') ?? path.join(__dirname, '..', 'menu-data', 'prices.json');

  const cats = await fetchCategories();
  if (cats.length === 0) {
    console.error('no categories found (structure changed?)');
    process.exit(1);
  }
  const offers = await crawlCategories(cats);
  const best = chickenFilletFallback(bestPerIngredient(offers)).sort((a, b) => a.productId.localeCompare(b.productId));

  console.log(`\nmatched offers: ${offers.length}, kept best-per-product: ${best.length}`);
  for (const o of best) {
    console.log(`  ${o.productId.padEnd(14)} ${o.price.toFixed(2)} BYN / ${o.packageQuantity} ${o.packageUnit}  <- ${o.productName.slice(0, 70)}`);
  }

  if (dryRun) return;

  const prev = readFileSync(out, 'utf8');
  void prev;
  const payload = {
    kind: 'snapshot',
    updatedAt: new Date().toISOString(),
    sourceName: 'Евроопт — официальная интернет-витрина edostavka.by',
    storeNotes: {
      euroopt: `цены извлечены автоматически с ${BASE}/category/* (${best.length} позиций)`,
      hippo: 'сайт — детские товары, продуктовых цен нет',
      green: 'без публичного каталога цен',
      korona: 'каталог собственной продукции грузится клиентским кодом, цены не извлекаются',
    },
    offers: best,
  };
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`wrote ${out} (${best.length} offers)`);
}

const __runCli = typeof require !== 'undefined' && require.main === module;
if (__runCli) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}