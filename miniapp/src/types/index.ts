export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface Pair {
  id: string;
  telegram_user_a: number;
  telegram_user_b: number;
  user_a_name: string | null;
  user_b_name: string | null;
  created_at: string;
}

export interface Device {
  id: string;
  pair_id: string;
  telegram_user_id: number;
  platform: 'ios' | 'android';
  push_token: string;
  paired_at: string;
  push_permission_granted: boolean;
  widget_added: boolean;
}

export type AnimationType = 'heart_open' | 'sparkle' | 'moon' | 'flame' | 'bloom_petals' | 'golden_halo';

export interface AnimationDef {
  type: AnimationType;
  emoji: string;
  label: string;
}

export const ANIMATIONS: AnimationDef[] = [
  { type: 'heart_open', emoji: '💌', label: 'Валентинка' },
  { type: 'sparkle', emoji: '✨', label: 'Блеск' },
  { type: 'moon', emoji: '🌙', label: 'Ночь' },
  { type: 'flame', emoji: '🔥', label: 'Страсть' },
  { type: 'bloom_petals', emoji: '🌸', label: 'Цветение' },
  { type: 'golden_halo', emoji: '👑', label: 'Нимб' },
];

export interface StreakTier {
  day: number;
  type: AnimationType;
  icon: string;
  name: string;
  soft: string;
  mid: string;
}

export const STREAK_TIERS: StreakTier[] = [
  { day: 1, type: 'heart_open', icon: '💌', name: 'heart_open', soft: '#ffd7dc', mid: '#ffb3bd' },
  { day: 7, type: 'sparkle', icon: '✨', name: 'sparkle_burst', soft: '#fff3c4', mid: '#ffe27a' },
  { day: 14, type: 'moon', icon: '🌙', name: 'moon_glow', soft: '#dbe8ff', mid: '#b9cdfa' },
  { day: 30, type: 'flame', icon: '🔥', name: 'flame_pulse', soft: '#ffe3cc', mid: '#ffc9a3' },
  { day: 60, type: 'bloom_petals', icon: '🌸', name: 'bloom_petals', soft: '#ffd7e4', mid: '#ffb3cd' },
  { day: 100, type: 'golden_halo', icon: '👑', name: 'golden_halo', soft: '#fff3c4', mid: '#f0c869' },
];

export const STREAK_LOCKED_ANIMATIONS: Record<string, number> = {
  bloom_petals: 60,
  golden_halo: 100,
};

export function getAnimation(type: AnimationType): AnimationDef {
  return ANIMATIONS.find((a) => a.type === type) ?? ANIMATIONS[0];
}

export interface Valentine {
  id: string;
  pair_id: string;
  sender_telegram_id: number;
  animation_type: AnimationType;
  message: string | null;
  photo_url: string | null;
  sent_at: string;
  delivered_at: string | null;
  seen_at: string | null;
}

export interface ValentineWithSender extends Valentine {
  sender_name: string;
  is_own: boolean;
}

export type RecapPeriod = '7d' | '30d' | '90d' | 'all';

/** Numbers behind the recap card. Every field is a real count from the backend. */
export interface RecapAggregates {
  periodKey: RecapPeriod;
  periodLabel: string;
  periodStart: string | null;
  valentinesCount: number;
  partnerAName: string;
  partnerACount: number;
  partnerBName: string;
  partnerBCount: number;
  greetingsByType: Record<string, number>;
  currentStreak: number;
  maxStreak: number;
  mostActiveHour: number | null;
  mostActiveWeekday: string | null;
  avgMovieCompatibility: number | null;
  biggestMovieGap: string | null;
  moviesWatched: number;
  datesMatched: number;
  moviesScoredByBoth: number;
}

export interface RecapSummary {
  headline: string;
  highlight_number: string;
  insight: string;
  fun_fact: string;
  closing_line: string;
}

export interface Recap {
  period: RecapPeriod;
  aggregates: RecapAggregates;
  summary: RecapSummary;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface MenuGenerationIssue {
  code: string;
  message: string;
  minCost?: number;
  budget?: number;
  filledSlots?: number;
  totalSlots?: number;
  reason?: 'budget' | 'recipes';
  missingSlots?: string[];
}

/** Structured 4xx response from the backend for the menu planner. */
export interface ApiIssue {
  error?: string;
  code: string;
  message?: string;
  minCost?: number;
  budget?: number;
  filledSlots?: number;
  totalSlots?: number;
  reason?: 'budget' | 'recipes';
  missingSlots?: string[];
}

export interface SendValentineRequest {
  animation_type: AnimationType;
  message?: string | null;
  recipient?: 'partner' | 'self';
  photo_base64?: string | null;
}

export interface PairingInitResult {
  pairingUrl: string;
  token: string;
  expiresAt: string;
}

export interface CompletePairingResult {
  pairId: string;
  partnerTelegramId: number;
  deviceId: string;
}

export interface UserProfile {
  id: number;
  username: string | null;
  first_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export type GreetingType = 'morning' | 'night' | 'luck' | 'day' | 'evening' | 'care';

export interface Greeting {
  id: string;
  pair_id: string;
  sender_telegram_id: number;
  type: GreetingType;
  sent_at: string;
  sender_name: string;
  is_own: boolean;
}

// --- Notes & Reminders --------------------------------------------------------

export type NoteCategory = 'idea' | 'todo' | 'memory' | 'wish';

export const NOTE_CATEGORIES: { value: NoteCategory; label: string; icon: string }[] = [
  { value: 'idea', label: 'Идея', icon: '💡' },
  { value: 'todo', label: 'Дело', icon: '✅' },
  { value: 'memory', label: 'Воспоминание', icon: '📸' },
  { value: 'wish', label: 'Желание', icon: '🌟' },
];

export interface Note {
  id: string;
  pair_id: string;
  author_id: number;
  content: string;
  category: NoteCategory;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export type Recurrence = 'yearly' | 'monthly';

export interface Reminder {
  id: string;
  pair_id: string;
  author_id: number;
  title: string;
  message: string | null;
  remind_at: string;
  is_recurring: boolean;
  recurrence: Recurrence | null;
  is_sent: boolean;
  created_at: string;
}

export type CoupleEventType = 'first_date' | 'wedding' | 'birthday' | 'custom';

export const COUPLE_EVENT_TYPES: { value: CoupleEventType; label: string; icon: string }[] = [
  { value: 'first_date', label: 'Первая встреча', icon: '💑' },
  { value: 'wedding', label: 'Свадьба', icon: '💍' },
  { value: 'birthday', label: 'День рождения', icon: '🎂' },
  { value: 'custom', label: 'Другое', icon: '📅' },
];

export interface CoupleEvent {
  id: string;
  pair_id: string;
  name: string;
  event_date: string;
  event_type: CoupleEventType;
  remind_days_before: number;
  created_at: string;
}

// --- Movies --------------------------------------------------------------------

export type MovieStatus = 'want_to_watch' | 'watched';

export interface Movie {
  id: string;
  pair_id: string;
  kp_id: number | null;
  title: string;
  year: number | null;
  poster_url: string | null;
  genre: string | null;
  description: string | null;
  runtime: string | null;
  rating: string | null;
  status: MovieStatus;
  added_by: number;
  added_at: string;
  watched_at: string | null;
}

export interface MovieReview {
  id: string;
  movie_id: string;
  author_telegram_id: number;
  visuals: number;
  plot: number;
  acting: number;
  music: number;
  atmosphere: number;
  humor: number;
  review_text: string | null;
  created_at: string;
}

export interface MovieInsight {
  movie_id: string;
  result: {
    summary: string;
    common_points: string[];
    liked: { who: string; what: string }[];
    disliked: { who: string; what: string }[];
    disagreements: string[];
    verdict: string;
    compatibility_percent: number;
    similar_movies: { title: string; year: number }[];
  };
  created_at: string;
}

export interface MovieListItem extends Movie {
  reviews: MovieReview[];
  watches: number[];
  added_by_name: string | null;
  aspect_scores: Record<string, number> | null;
  taste_match: number | null;
  partner_taste_match: number | null;
}

export interface TasteProfile {
  aspect_weights: Record<string, number>;
}

export interface PoiskkinoCandidate {
  kp_id: number;
  name: string | null;
  alternative_name: string | null;
  year: number | null;
  poster_url: string | null;
  rating_kp: number | null;
  rating_imdb: number | null;
  genres: string[];
  type: string | null;
}

// --- «Куда пойти» (date spot picker) ------------------------------------------

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
  photoNames: string[];
}

export type DateMood = 'romantic' | 'fun' | 'calm' | 'active';
export type DateCategory = 'food' | 'entertainment' | 'nature' | 'culture';
export type DateBudget = 'cheap' | 'mid' | 'high' | 'any';

export interface DateParams {
  lat: number;
  lng: number;
  radius_m: number | null;
  mood: DateMood | null;
  category: DateCategory | null;
  budget: DateBudget;
  open_now: boolean | null;
}

export type DateChoice = 'like' | 'dislike';

export interface DateVote {
  session_id: string;
  user_id: number;
  place_index: number;
  choice: DateChoice;
  created_at: string;
}

export interface DateMatch {
  matched: boolean;
  index?: number;
  place?: Place | null;
}

export interface DateSession {
  id: string;
  pair_id: string;
  initiator_id: number;
  params: DateParams;
  places: Place[];
  status: 'active' | 'done';
  match: DateMatch | null;
  created_at: string;
  updated_at: string;
  votes: DateVote[];
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  capabilities: string[];
}

export type PoiskkinoPart = Pick<PoiskkinoCandidate, 'kp_id' | 'name' | 'alternative_name' | 'year' | 'poster_url' | 'rating_imdb' | 'type'>;// --- Games ----------------------------------------------------------------------

export type GameId = 'KNOW_ME' | 'CHOOSE_ONE' | 'ASSOCIATIONS' | 'COMPLIMENTS' | 'SPEED_FACTS' | 'TRUTH_DARE';
export type GameMood = 'нежное' | 'веселое' | 'погорячее' | 'погорячее 18+' | 'поговорить' | 'спокойное';
export type HotLevel = 'flirt' | 'warm' | 'bold' | 'wild';

export interface PairSettings {
  pair_id: string;
  hot_level_a: HotLevel;
  hot_level_b: HotLevel;
  hot_18_confirmed_a: boolean;
  hot_18_confirmed_b: boolean;
  hot_18_enabled: boolean;
  updated_at: string;
}

export interface GameAnswer {
  session_id: string;
  user_id: number;
  round_index: number;
  answer: string;
  created_at: string;
}

export interface GameRound {
  type: 'choice' | 'text' | 'truth_dare';
  text: string;
  options: string[]; // for choice rounds; empty for text rounds
  category?: string; // e.g., 'warmup', 'personal', 'final', 'binary', 'surprise'
  truth?: string; // truth-or-dare: «правда» prompt shown when the player picks it
  dare?: string; // truth-or-dare: «действие» prompt shown when the player picks it
  truthB?: string; // вариант правды для партнёра (чтобы не совпадали)
  dareB?: string; // вариант действия для партнёра
}

export interface GameSession {
  id: string;
  pair_id: string;
  initiator_id: number;
  game_id: GameId;
  mood: GameMood | null;
  rounds: GameRound[];
  status: 'active' | 'done';
  created_at: string;
  updated_at: string;
  answers?: GameAnswer[];
}

// --- Меню и список покупок ---------------------------------------------------

export type MenuAllergenId = 'milk' | 'egg' | 'peanut' | 'tree_nut' | 'fish' | 'seafood' | 'soy' | 'gluten';
export type MenuStoreId = 'euroopt' | 'hippo' | 'green' | 'korona';
export type MenuUnit = 'g' | 'ml' | 'pcs';
export type MenuCookwareId =
  | 'skillet'
  | 'pot'
  | 'oven'
  | 'slow_cooker'
  | 'microwave'
  | 'blender'
  | 'air_fryer'
  | 'steamer'
  | 'kettle';

export interface MenuCookwareInfo {
  id: MenuCookwareId;
  title: string;
  emoji: string;
  hint: string;
}

/** Kitchen equipment catalogue; recipes needing anything else are filtered out. */
export const MENU_COOKWARE: MenuCookwareInfo[] = [
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

export interface MenuAllergenInfo {
  id: MenuAllergenId;
  title: string;
  emoji: string;
  hint?: string;
}

export interface MenuStoreInfo {
  id: MenuStoreId;
  name: string;
  emoji: string;
  description: string;
  priceCatalog: 'mock' | 'live';
  /** false = store shown greyed out and non-clickable (no price catalogue yet). */
  available?: boolean;
}

export interface MenuNutrition {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface MenuRecipeChoice {
  recipe: {
    id: string;
    name: string;
    category: string;
    timeMin: number | null;
    photoUrl?: string;
    sourceUrl?: string;
    dataKind: string;
    sourceLabel: string;
    steps?: string[];
  };
  servings: number;
  scale: number;
  scaledIngredients?: {
    ingredient: { id: string; name: string; unit: MenuUnit };
    qty: number;
    unit: MenuUnit;
  }[];
  cost: number;
  costPerServing: number;
  priceMissing: { ingredientId: string; name: string }[];
  nutrition: { perRecipe: MenuNutrition; perServing: MenuNutrition; per100g?: MenuNutrition } | null;
  nutritionMissing: boolean;
  allergens: MenuAllergenId[];
  allergenUnknown: string[];
  /** Inferred kitchen equipment labels (e.g. «🍳 Сковорода»). */
  cookwareLabels: string[];
}

export interface MenuShoppingListItem {
  ingredientId: string;
  name: string;
  requiredQuantity: number;
  requiredUnit: MenuUnit;
  /** How much of the requirement is already covered by stock at home. */
  stockCovered: number;
  packageQuantity: number;
  packageUnit: MenuUnit;
  purchaseQuantity: number;
  price: number;
  unitPrice: number;
  subtotal: number;
  currency: 'BYN';
  storeId: MenuStoreId;
  isMock: boolean;
  source: string;
  updatedAt: string;
  missing: boolean;
  stale: boolean;
}

export interface MenuShoppingList {
  storeId: MenuStoreId;
  items: MenuShoppingListItem[];
  total: number;
  missingItemsCount: number;
  staleItemsCount: number;
  currency: 'BYN';
}

export type MemberGroup = 'adult' | 'child';

/** One eater in the family: which meals they take and how many portions. */
export interface MenuMember {
  id: string;
  name: string;
  group: MemberGroup;
  /** Meals this member attends. At least one. */
  meals: MenuMealId[];
  /** How many portions of each attended meal this member eats (>= 1). */
  qty: number;
}

/** A role a single dish plays inside a multi-dish meal. */
export type MealComponentId = 'soup' | 'main' | 'side' | 'salad' | 'dessert';

export const MEAL_COMPONENTS: MealComponentId[] = ['soup', 'main', 'side', 'salad', 'dessert'];

export const MEAL_COMPONENT_TITLES: Record<MealComponentId, string> = {
  soup: 'Суп',
  main: 'Основное блюдо',
  side: 'Гарнир',
  salad: 'Салат',
  dessert: 'Десерт',
};

/** Roles a meal can be assembled from. Breakfast stays a single dish. */
export const MEAL_ROLES: Record<MenuMealId, MealComponentId[]> = {
  breakfast: ['main'],
  lunch: ['soup', 'salad', 'main', 'side', 'dessert'],
  dinner: ['main', 'side', 'salad', 'dessert'],
};

/** Per-meal component selection for multi-dish meals. */
export interface MealComponents {
  lunch: MealComponentId[];
  dinner: MealComponentId[];
}

export interface MenuServings {
  adults: number;
  children: number;
  adultCoefficient: number;
  childCoefficient: number;
  effectiveServings: number;
  /** Effective servings per meal (coefficient × qty of attending members). */
  perMeal: Record<MenuMealId, number>;
  members: MenuMember[];
}

export interface MenuRequest {
  storeId: MenuStoreId;
  adults: number;
  children: number;
  budget: number;
  currency: 'BYN';
  allergens: MenuAllergenId[];
  /** Free-text allergies typed by the user; a recipe is excluded when any ingredient name contains the term. */
  customAllergens?: string[];
  /** Products the user dislikes (free text, same matching as customAllergens). */
  disliked?: string[];
  /** Kitchen equipment the user has; empty/undefined disables the cookware filter. */
  cookware: MenuCookwareId[];
  /**
   * Per-member profiles. When present (non-empty) they drive the per-meal
   * effective servings; otherwise legacy `adults`/`children` assume everybody
   * eats every meal.
   */
  members?: MenuMember[];
  /**
   * Multi-dish composition of lunch/dinner. Absent/empty roles disable the
   * component picker and every meal is a single dish.
   */
  mealComponents?: MealComponents;
}

export type MenuMealId = 'breakfast' | 'lunch' | 'dinner';

/** A curated product group in the allergen/disliked picker (e.g. «Грибы» ->
 * шампиньоны, вешенки, лисички, белые). Picking the group adds all members;
 * each member remains a separate removable term. */
export interface MenuIngredientGroup {
  id: string;
  name: string;
  members: { id: string; name: string; unit: string }[];
}

/** Weekly budget floor the menu planner guarantees (see backend config). Portion
 * coefficients and the per-serving minimum are mirrored from the backend so the
 * hint matches what the planner actually does when the user's budget is low. */
export const MENU_MIN_BUDGET_PER_SERVING = 50;
export const MENU_MIN_BUDGET_FLOOR = 30;

/** Minimum weekly budget for a given family size (adults + 0.7 * children). */
export function menuMinBudgetFor(adults: number, children: number): number {
  return Math.max(MENU_MIN_BUDGET_FLOOR, Math.round(MENU_MIN_BUDGET_PER_SERVING * (adults + 0.7 * children)));
}

export interface MenuMealComponent {
  /** Dish role inside the meal (e.g. «Гарнир»). Breakfast uses 'main'. */
  role: MealComponentId;
  title: string;
  recipe: MenuRecipeChoice;
}

export interface MenuMeal {
  meal: MenuMealId;
  title: string;
  /** One dish per selected component; breakfast always has a single dish. */
  components: MenuMealComponent[];
}

export interface MenuDay {
  day: number;
  meals: MenuMeal[];
}

export interface MenuResult {
  id: string;
  store: MenuStoreInfo;
  request: MenuRequest;
  servings: MenuServings;
  /** The week plan: 7 days × breakfast/lunch/dinner. Also mirrored in `recipes`. */
  days: MenuDay[];
  recipes: MenuRecipeChoice[];
  recipesCost: number;
  totalCost: number;
  shoppingList: MenuShoppingList;
  budget: number;
  remainingBudget: number;
  overspend: number;
  warnings: string[];
  priceSourceLabel: string;
  generatedAt: string;
}

/** A single meal slot to swap out for a recipe (see MenuResult.replace). */
export interface MenuSlotReplacement {
  day: number;
  meal: MenuMealId;
  role: MealComponentId;
  recipeId: string;
}

/** A candidate dish offered for a meal slot when replacing. */
export interface MenuSlotVariant {
  recipeId: string;
  name: string;
  category: string;
  role: MealComponentId;
  cost: number;
  costPerServing: number;
  servings: number;
  timeMin: number | null;
  priceMissing: boolean;
  kcalPerServing: number | null;
}

/** An ingredient already at home (leftover) to deduct from the next shopping list. */
export interface MenuLeftover {
  ingredientId: string;
  qty: number;
  unit: MenuUnit;
  /** Russian catalogue name, returned by the API on reload. */
  name?: string;
}

/** A suggested leftover computed from the last saved menu (bought − required). */
export interface MenuLeftoverSuggestion extends MenuLeftover {
  name: string;
}

/** A saved weekly menu entry in the pair's history (newest first). */
export interface MenuHistoryEntry {
  id: string;
  createdAt: string;
  store: MenuStoreInfo;
  params: MenuRequest;
  budget: number;
  totalCost: number;
  overspend: number;
  recipesCount: number;
}

export const MENU_UNIT_LABEL: Record<MenuUnit, string> = {
  g: 'г',
  ml: 'мл',
  pcs: 'шт',
};
