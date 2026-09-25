import type { CookwareId, Recipe } from './types';

/**
 * Kitchen equipment catalogue used both as a user filter («что есть на кухне»)
 * and as the inferred requirements of a recipe (inferred from the recipe name
 * and its instruction steps — RussianFood.com does not publish this metadata).
 *
 * The planner excludes a recipe when ANY of its inferred requirements is not
 * present in the user's declared set. Empty inference = the dish needs no
 * special cookware (salads, cold appetisers) and is never filtered.
 */

export interface CookwareInfo {
  id: CookwareId;
  title: string;
  emoji: string;
  hint: string;
}

export const MENU_COOKWARE: CookwareInfo[] = [
  { id: 'skillet', title: 'Сковорода', emoji: '🍳', hint: 'Жарка, блины, котлеты' },
  { id: 'pot', title: 'Кастрюля', emoji: '🥘', hint: 'Варка, супы, каши' },
  { id: 'oven', title: 'Духовка', emoji: '🔥', hint: 'Запекание, выпечка' },
  { id: 'slow_cooker', title: 'Мультиварка', emoji: '🥣', hint: 'Плов, тушение, режимы' },
  { id: 'microwave', title: 'Микроволновка', emoji: '📡', hint: 'Быстрый разогрев и готовка' },
  { id: 'blender', title: 'Блендер', emoji: '🥤', hint: 'Смузи, супы-пюре и соусы' },
  { id: 'air_fryer', title: 'Аэрогриль', emoji: '🌬️', hint: 'Запекание горячим воздухом и фри' },
  { id: 'steamer', title: 'Пароварка', emoji: '🫕', hint: 'Лёгкие блюда на пару' },
  { id: 'kettle', title: 'Чайник', emoji: '🫖', hint: 'Кипяток для заваривания' },
];

export function getCookwareInfo(id: CookwareId): CookwareInfo | undefined {
  return MENU_COOKWARE.find((c) => c.id === id);
}

/** Human-readable labels (emoji + name) for a recipe's cookware set. */
export function describeCookware(ids: CookwareId[]): string[] {
  return ids.map((id) => {
    const info = getCookwareInfo(id);
    return info ? `${info.emoji} ${info.title}` : id;
  });
}

const STEP_HINTS: Array<{ pattern: RegExp; id: CookwareId }> = [
  { pattern: /мультиварк/i, id: 'slow_cooker' },
  { pattern: /микроволнов|свч/i, id: 'microwave' },
  { pattern: /духовк|противень|запеч|запекан|при\s*\d{2,3}\s*°/i, id: 'oven' },
  { pattern: /сковород/i, id: 'skillet' },
  { pattern: /обжар|жар[а-я]*\b|жарь|поджар|пассер|грил/i, id: 'skillet' },
  { pattern: /кастрюл|варить|варите|кипятить|бульон|залить водой|отвари/i, id: 'pot' },
  { pattern: /блендер/i, id: 'blender' },
  { pattern: /аэрогрил|фритюрниц/i, id: 'air_fryer' },
  { pattern: /пароварк|на пару/i, id: 'steamer' },
  { pattern: /кипятком|кипяток|чайник/i, id: 'kettle' },
];

const NAME_HINTS: Array<{ pattern: RegExp; id: CookwareId }> = [
  {
    pattern:
      /суп-?пюре|суп|борщ|\bщи\b|солянк|рассольник|похлёб|похлеб|бульон|каша|кисел|компот|желе|холодец|пельмен|вареник|мант|хинкал|паста|макарон|спагет|рагу|плов/i,
    id: 'pot',
  },
  {
    pattern:
      /блин|оладь|сырник|драник|котлет|отбивн|шницел|тефтел|биточ|зраз\b|омлет|яичниц|тост|крокет|жар/,
    id: 'skillet',
  },
  {
    pattern:
      /запеканк|пирог|кулебяк|рулет|шарлотк|кекс|маффин|печень|булоч|хлеб|пицца|киш|слойк\b|завиван?ец|запеч/,
    id: 'oven',
  },
  { pattern: /смузи|коктейл|блендер|суп-?пюре/, id: 'blender' },
  { pattern: /фри\b|аэрогрил/, id: 'air_fryer' },
  { pattern: /на пару|паровые/, id: 'steamer' },
];

/**
 * Best-effort inference of required cookware. Step text takes priority over
 * the dish name; results are unique and ordered by the source scan order.
 * Returns [] for dishes we cannot confidently map (no filtering then).
 */
export function inferCookware(recipe: Pick<Recipe, 'name'> & { category?: string; steps?: string[] }): CookwareId[] {
  const found = new Set<CookwareId>();
  const text = `${recipe.category ?? ''} ${recipe.name}`.toLowerCase();

  for (const hint of STEP_HINTS) {
    const hay = (recipe.steps ?? []).join(' ').toLowerCase();
    if (hint.pattern.test(hay)) found.add(hint.id);
  }
  for (const hint of NAME_HINTS) {
    if (hint.pattern.test(text)) found.add(hint.id);
  }
  return [...found];
}