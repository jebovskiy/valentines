import type {
  Ingredient,
  NutritionPer100g,
  ProductOffer,
  Recipe,
  Store,
  StoreId,
} from './types';
import { normalizeName } from './allergens';

/**
 * ============================================================================
 * FIXTURE / DEMO DATA
 * ============================================================================
 *
 * Everything in this module is EXPLICITLY mock/demo data used for local
 * development:
 *
 * - Store price catalogues (ProductOffer[]) are demo numbers ONLY.
 *   They are NOT real prices of Euroopt / Hippo / Green / Korona and must
 *   never be presented as real current prices. Every offer carries
 *   isMock: true and source: 'mock'.
 * - Recipe fixtures are our own demo catalogue with dataKind: 'fixture'.
 *   They have no source URL. Imported snapshot recipes are tagged
 *   dataKind 'russianfood_import' and keep their sourceUrl.
 * - The nutrition reference DB holds typical per-100g estimates compiled
 *   from public reference tables (USDA FoodData Central style averages).
 *   It is approximation, labelled as such, and extensible behind the
 *   NutritionProvider interface.
 * ============================================================================
 */

export const STORES: Store[] = [
  { id: 'euroopt', name: 'Евроопт', emoji: '🛒', description: 'Сеть супермаркетов по всей Беларуси', priceCatalog: 'mock', available: true },
  { id: 'hippo', name: 'Гиппо', emoji: '🦛', description: 'Сеть магазинов в Беларуси', priceCatalog: 'mock', available: false },
  { id: 'green', name: 'Green', emoji: '🥬', description: 'Сеть «Green» в Беларуси', priceCatalog: 'mock', available: false },
  { id: 'korona', name: 'Корона', emoji: '👑', description: 'Сеть «Корона» в Беларуси', priceCatalog: 'mock', available: false },
];

export const MOCK_STORE_IDS: StoreId[] = STORES.map((s) => s.id);

/** Clear, machine + human readable signal that the price data is dem. */
export const MOCK_PRICE_SOURCE_LABEL = 'Демо-цены (не реальные)';

const MOCK_UPDATED_AT = '2026-09-20T10:00:00.000Z';

// ---------------------------------------------------------------------------
// Ingredient catalogue
// ---------------------------------------------------------------------------

export const INGREDIENTS: Ingredient[] = [
  // -- Овощи ---------------------------------------------------------------
  { id: 'potatoes', name: 'Картофель', unit: 'g', gramsPerPcs: 150, allergens: [] },
  { id: 'carrots', name: 'Морковь', unit: 'g', gramsPerPcs: 100, allergens: [] },
  { id: 'onions', name: 'Лук репчатый', unit: 'g', gramsPerPcs: 100, allergens: [] },
  { id: 'garlic', name: 'Чеснок', unit: 'g', gramsPerPcs: 4, allergens: [] },
  { id: 'tomato', name: 'Помидоры', unit: 'g', gramsPerPcs: 120, allergens: [] },
  { id: 'cucumber', name: 'Огурцы', unit: 'g', gramsPerPcs: 130, allergens: [] },
  { id: 'bell_pepper', name: 'Перец болгарский', unit: 'g', gramsPerPcs: 150, allergens: [] },
  { id: 'cabbage', name: 'Капуста белокочанная', unit: 'g', allergens: [] },
  { id: 'red_cabbage', name: 'Капуста краснокочанная', unit: 'g', allergens: [] },
  { id: 'cauliflower', name: 'Цветная капуста', unit: 'g', allergens: [] },
  { id: 'broccoli', name: 'Брокколи', unit: 'g', allergens: [] },
  { id: 'peking_cabbage', name: 'Капуста пекинская', unit: 'g', allergens: [] },
  { id: 'kohlrabi', name: 'Кольраби', unit: 'g', allergens: [] },
  { id: 'spinach', name: 'Шпинат', unit: 'g', allergens: [] },
  { id: 'zucchini', name: 'Кабачки', unit: 'g', gramsPerPcs: 250, allergens: [] },
  { id: 'eggplants', name: 'Баклажаны', unit: 'g', gramsPerPcs: 200, allergens: [] },
  { id: 'pumpkin', name: 'Тыква', unit: 'g', allergens: [] },
  { id: 'beets', name: 'Свёкла', unit: 'g', gramsPerPcs: 150, allergens: [] },
  { id: 'radish', name: 'Редис', unit: 'g', gramsPerPcs: 20, allergens: [] },
  { id: 'sweet_potato', name: 'Батат', unit: 'g', allergens: [] },
  { id: 'celery_stalk', name: 'Сельдерей стеблевой', unit: 'g', allergens: [] },
  { id: 'celery_root', name: 'Корень сельдерея', unit: 'g', allergens: [] },
  { id: 'parsnip', name: 'Пастернак', unit: 'g', allergens: [] },
  { id: 'fennel', name: 'Фенхель', unit: 'g', allergens: [] },
  { id: 'asparagus', name: 'Спаржа', unit: 'g', allergens: [] },
  { id: 'green_peas', name: 'Горошек свежий', unit: 'g', allergens: [] },
  { id: 'corn', name: 'Кукуруза сахарная', unit: 'g', allergens: [] },
  { id: 'ginger', name: 'Имбирь', unit: 'g', allergens: [] },
  { id: 'chili_pepper', name: 'Перец чили', unit: 'g', gramsPerPcs: 8, allergens: [] },
  { id: 'leek', name: 'Лук-порей', unit: 'g', allergens: [] },
  { id: 'green_onion', name: 'Лук зелёный', unit: 'g', allergens: [] },
  // -- Зелень и грибы --------------------------------------------------------
  { id: 'herbs', name: 'Зелень (укроп/петрушка)', unit: 'g', allergens: [] },
  { id: 'cilantro', name: 'Кинза', unit: 'g', allergens: [] },
  { id: 'basil', name: 'Базилик', unit: 'g', allergens: [] },
  { id: 'mint', name: 'Мята', unit: 'g', allergens: [] },
  { id: 'rosemary', name: 'Розмарин', unit: 'g', allergens: [] },
  { id: 'thyme', name: 'Тимьян', unit: 'g', allergens: [] },
  { id: 'lettuce', name: 'Салат листовой', unit: 'g', allergens: [] },
  { id: 'arugula', name: 'Рукола', unit: 'g', allergens: [] },
  { id: 'microgreens', name: 'Микрозелень', unit: 'g', allergens: [] },
  { id: 'mushroom', name: 'Шампиньоны', unit: 'g', gramsPerPcs: 25, allergens: [] },
  { id: 'oyster_mushroom', name: 'Вешенки', unit: 'g', allergens: [] },
  { id: 'chanterelle', name: 'Лисички', unit: 'g', allergens: [] },
  { id: 'porcini', name: 'Белые грибы', unit: 'g', allergens: [] },
  // -- Фрукты и ягоды -------------------------------------------------------
  { id: 'apples', name: 'Яблоки', unit: 'g', allergens: [] },
  { id: 'bananas', name: 'Бананы', unit: 'g', gramsPerPcs: 120, allergens: [] },
  { id: 'grapes', name: 'Виноград', unit: 'g', allergens: [] },
  { id: 'oranges', name: 'Апельсины', unit: 'g', gramsPerPcs: 150, allergens: [] },
  { id: 'tangerines', name: 'Мандарины', unit: 'g', gramsPerPcs: 90, allergens: [] },
  { id: 'grapefruit', name: 'Грейпфрут', unit: 'g', gramsPerPcs: 250, allergens: [] },
  { id: 'lemon', name: 'Лимоны', unit: 'g', gramsPerPcs: 60, allergens: [] },
  { id: 'limes', name: 'Лайм', unit: 'g', gramsPerPcs: 40, allergens: [] },
  { id: 'pears', name: 'Груши', unit: 'g', gramsPerPcs: 150, allergens: [] },
  { id: 'peaches', name: 'Персики', unit: 'g', gramsPerPcs: 150, allergens: [] },
  { id: 'nectarines', name: 'Нектарины', unit: 'g', gramsPerPcs: 150, allergens: [] },
  { id: 'apricots', name: 'Абрикосы', unit: 'g', gramsPerPcs: 50, allergens: [] },
  { id: 'plums', name: 'Сливы', unit: 'g', gramsPerPcs: 60, allergens: [] },
  { id: 'kiwi', name: 'Киви', unit: 'g', gramsPerPcs: 80, allergens: [] },
  { id: 'mango', name: 'Манго', unit: 'g', allergens: [] },
  { id: 'avocado', name: 'Авокадо', unit: 'g', gramsPerPcs: 150, allergens: [] },
  { id: 'pineapple', name: 'Ананас', unit: 'g', allergens: [] },
  { id: 'pomegranate', name: 'Гранат', unit: 'g', gramsPerPcs: 300, allergens: [] },
  { id: 'persimmon', name: 'Хурма', unit: 'g', gramsPerPcs: 100, allergens: [] },
  { id: 'melon', name: 'Дыня', unit: 'g', allergens: [] },
  { id: 'watermelon', name: 'Арбуз', unit: 'g', allergens: [] },
  { id: 'passion_fruit', name: 'Маракуйя', unit: 'g', allergens: [] },
  { id: 'strawberries', name: 'Клубника', unit: 'g', allergens: [] },
  { id: 'raspberries', name: 'Малина', unit: 'g', allergens: [] },
  { id: 'blackberries', name: 'Ежевика', unit: 'g', allergens: [] },
  { id: 'blueberries', name: 'Черника', unit: 'g', allergens: [] },
  // -- Крупы, мука, бобовые -------------------------------------------------
  { id: 'rice', name: 'Рис', unit: 'g', allergens: [] },
  { id: 'millet', name: 'Пшено', unit: 'g', allergens: [] },
  { id: 'pasta', name: 'Макароны', unit: 'g', allergens: ['gluten'] },
  { id: 'buckwheat', name: 'Гречка', unit: 'g', allergens: [] },
  { id: 'oatmeal', name: 'Овсяные хлопья', unit: 'g', allergens: [] },
  { id: 'semolina', name: 'Крупа манная', unit: 'g', allergens: ['gluten'] },
  { id: 'pearl_barley', name: 'Перловка', unit: 'g', allergens: [] },
  { id: 'corn_grits', name: 'Крупа кукурузная', unit: 'g', allergens: [] },
  { id: 'wheat_grits', name: 'Крупа пшеничная', unit: 'g', allergens: ['gluten'] },
  { id: 'flour', name: 'Мука пшеничная', unit: 'g', allergens: ['gluten'] },
  { id: 'rye_flour', name: 'Мука ржаная', unit: 'g', allergens: ['gluten'] },
  { id: 'peas', name: 'Горох колотый', unit: 'g', allergens: [] },
  { id: 'beans', name: 'Фасоль', unit: 'g', allergens: [] },
  { id: 'lentils', name: 'Чечевица', unit: 'g', allergens: [] },
  { id: 'mung', name: 'Маш', unit: 'g', allergens: [] },
  // -- Молочные продукты, яйца ----------------------------------------------
  { id: 'milk', name: 'Молоко 3,2%', unit: 'ml', allergens: ['milk'] },
  { id: 'cream', name: 'Сливки 20%', unit: 'ml', allergens: ['milk'] },
  { id: 'sour_cream', name: 'Сметана 20%', unit: 'g', allergens: ['milk'] },
  { id: 'kefir', name: 'Кефир', unit: 'ml', allergens: ['milk'] },
  { id: 'ryazhenka', name: 'Ряженка', unit: 'ml', allergens: ['milk'] },
  { id: 'butter', name: 'Масло сливочное', unit: 'g', allergens: ['milk'] },
  { id: 'cheese', name: 'Сыр твёрдый', unit: 'g', allergens: ['milk'] },
  { id: 'process_cheese', name: 'Сыр плавленый', unit: 'g', allergens: ['milk'] },
  { id: 'cream_cheese', name: 'Сыр творожный', unit: 'g', allergens: ['milk'] },
  { id: 'feta', name: 'Брынза (фета)', unit: 'g', allergens: ['milk'] },
  { id: 'cottage_cheese', name: 'Творог 5%', unit: 'g', allergens: ['milk'] },
  { id: 'yogurt', name: 'Йогурт', unit: 'g', allergens: ['milk'] },
  { id: 'eggs', name: 'Яйца куриные', unit: 'pcs', gramsPerPcs: 60, allergens: ['egg'] },
  { id: 'quail_eggs', name: 'Яйца перепелиные', unit: 'pcs', gramsPerPcs: 12, allergens: ['egg'] },
  // -- Мясо, птица, субпродукты ---------------------------------------------
  { id: 'chicken_fillet', name: 'Куриное филе', unit: 'g', allergens: [] },
  { id: 'chicken_leg', name: 'Куриная голень', unit: 'g', allergens: [] },
  { id: 'chicken_wing', name: 'Крылья куриные', unit: 'g', allergens: [] },
  { id: 'chicken_minced', name: 'Фарш куриный', unit: 'g', allergens: [] },
  { id: 'chicken_liver', name: 'Печень куриная', unit: 'g', allergens: [] },
  { id: 'chicken_heart', name: 'Сердце куриное', unit: 'g', allergens: [] },
  { id: 'chicken_gizzard', name: 'Желудки куриные', unit: 'g', allergens: [] },
  { id: 'turkey_fillet', name: 'Филе индейки', unit: 'g', allergens: [] },
  { id: 'duck', name: 'Утка', unit: 'g', allergens: [] },
  { id: 'beef', name: 'Говядина', unit: 'g', allergens: [] },
  { id: 'pork', name: 'Свинина', unit: 'g', allergens: [] },
  // -- Рыба и морепродукты ---------------------------------------------------
  { id: 'salmon', name: 'Лосось', unit: 'g', allergens: ['fish'] },
  { id: 'cod', name: 'Треска', unit: 'g', allergens: ['fish'] },
  { id: 'pollock', name: 'Минтай', unit: 'g', allergens: ['fish'] },
  { id: 'herring', name: 'Сельдь', unit: 'g', allergens: ['fish'] },
  { id: 'mackerel', name: 'Скумбрия', unit: 'g', allergens: ['fish'] },
  { id: 'carp', name: 'Карп', unit: 'g', allergens: ['fish'] },
  { id: 'sea_bass', name: 'Сибас', unit: 'g', allergens: ['fish'] },
  { id: 'trout', name: 'Форель', unit: 'g', allergens: ['fish'] },
  { id: 'mussels', name: 'Мидии', unit: 'g', allergens: ['seafood'] },
  { id: 'shrimps', name: 'Креветки', unit: 'g', allergens: ['seafood'] },
  // -- Масла растительные ----------------------------------------------------
  { id: 'vegetable_oil', name: 'Масло подсолнечное', unit: 'ml', allergens: [] },
  { id: 'olive_oil', name: 'Масло оливковое', unit: 'ml', allergens: [] },
  { id: 'flaxseed_oil', name: 'Масло льняное', unit: 'ml', allergens: [] },
  { id: 'sesame_oil', name: 'Масло кунжутное', unit: 'ml', allergens: [] },
  // -- Орехи, семена, сухофрукты ---------------------------------------------
  { id: 'peanuts', name: 'Арахис', unit: 'g', allergens: ['peanut'] },
  { id: 'walnuts', name: 'Грецкие орехи', unit: 'g', allergens: ['tree_nut'] },
  { id: 'almonds', name: 'Миндаль', unit: 'g', allergens: ['tree_nut'] },
  { id: 'cashews', name: 'Кешью', unit: 'g', allergens: ['tree_nut'] },
  { id: 'hazelnuts', name: 'Фундук', unit: 'g', allergens: ['tree_nut'] },
  { id: 'pistachios', name: 'Фисташки', unit: 'g', allergens: ['tree_nut'] },
  { id: 'pumpkin_seeds', name: 'Семечки тыквы', unit: 'g', allergens: [] },
  { id: 'sunflower_seeds', name: 'Семечки подсолнечника', unit: 'g', allergens: [] },
  { id: 'sesame', name: 'Кунжут', unit: 'g', allergens: ['soy'] },
  { id: 'flax_seeds', name: 'Семена льна', unit: 'g', allergens: [] },
  { id: 'chia', name: 'Семена чиа', unit: 'g', allergens: [] },
  { id: 'raisins', name: 'Изюм', unit: 'g', allergens: [] },
  { id: 'dried_apricots', name: 'Курага', unit: 'g', allergens: [] },
  { id: 'prunes', name: 'Чернослив', unit: 'g', allergens: [] },
  { id: 'dates', name: 'Финики', unit: 'g', allergens: [] },
  { id: 'dried_figs', name: 'Инжир сушёный', unit: 'g', allergens: [] },
  { id: 'dried_cranberry', name: 'Клюква сушёная', unit: 'g', allergens: [] },
  // -- Бакалея ---------------------------------------------------------------
  { id: 'sugar', name: 'Сахар', unit: 'g', allergens: [] },
  { id: 'salt', name: 'Соль', unit: 'g', allergens: [] },
  { id: 'pepper', name: 'Перец чёрный молотый', unit: 'g', allergens: [] },
  { id: 'soy_sauce', name: 'Соевый соус', unit: 'ml', allergens: ['soy'] },
  { id: 'mayo', name: 'Майонез', unit: 'g', allergens: ['egg', 'soy'] },
  { id: 'ketchup', name: 'Кетчуп', unit: 'g', allergens: [] },
  { id: 'mustard', name: 'Горчица', unit: 'g', allergens: [] },
  { id: 'vinegar', name: 'Уксус', unit: 'ml', allergens: [] },
  { id: 'tomato_paste', name: 'Томатная паста', unit: 'g', allergens: [] },
  { id: 'honey', name: 'Мёд', unit: 'g', allergens: [] },
  { id: 'yeast', name: 'Дрожжи', unit: 'g', allergens: [] },
  { id: 'baking_soda', name: 'Сода пищевая', unit: 'g', allergens: [] },
  { id: 'baking_powder', name: 'Разрыхлитель теста', unit: 'g', allergens: ['gluten'] },
  { id: 'breadcrumbs', name: 'Сухари панировочные', unit: 'g', allergens: ['gluten'] },
  { id: 'starch', name: 'Крахмал', unit: 'g', allergens: ['gluten'] },
  { id: 'gelatin', name: 'Желатин', unit: 'g', allergens: [] },
  { id: 'bread', name: 'Хлеб', unit: 'g', allergens: ['gluten'] },
  { id: 'lavash', name: 'Лаваш', unit: 'g', allergens: ['gluten'] },
  // -- Консервированные базовые ингредиенты ----------------------------------
  { id: 'green_peas_canned', name: 'Горошек консервированный', unit: 'g', allergens: [] },
  { id: 'corn_canned', name: 'Кукуруза консервированная', unit: 'g', allergens: [] },
  { id: 'olives', name: 'Оливки', unit: 'g', allergens: [] },
  { id: 'black_olives', name: 'Маслины', unit: 'g', allergens: [] },
  { id: 'capers', name: 'Каперсы', unit: 'g', allergens: [] },
  { id: 'canned_tomatoes', name: 'Помидоры консервированные', unit: 'g', allergens: [] },
  // -- Разное -----------------------------------------------------------------
  { id: 'tofu', name: 'Тофу', unit: 'g', allergens: ['soy'] },
];

const INGREDIENT_INDEX = new Map(INGREDIENTS.map((i) => [i.id, i]));
const INGREDIENT_NORMALIZED_INDEX = new Map(
  INGREDIENTS.map((i) => [normalizeName(i.name), i])
);

/**
 * Curated aliases for imported recipe text whose word order or wording differs
 * from the catalogue (e.g. «филе куриное» -> chicken_fillet, «гречка» ->
 * buckwheat). Keys are normalized the same way as ingredient names.
 */
const INGREDIENT_NAME_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['филе куриное', 'chicken_fillet'],
  ['грудка куриная', 'chicken_fillet'],
  ['куриная грудка', 'chicken_fillet'],
  ['филе куриной грудки', 'chicken_fillet'],
  ['голень куриная', 'chicken_leg'],
  ['голени куриные', 'chicken_leg'],
  ['бедро куриное', 'chicken_leg'],
  ['бедра куриные', 'chicken_leg'],
  ['куриные ножки', 'chicken_leg'],
  ['окорочка куриные', 'chicken_leg'],
  ['фарш', 'chicken_minced'],
  ['фарш из курицы', 'chicken_minced'],
  ['куриный фарш', 'chicken_minced'],
  ['кабачок', 'zucchini'],
  ['кабачок свежий', 'zucchini'],
  ['пшённая крупа', 'millet'],
  ['крупа пшённая', 'millet'],
  ['банан', 'bananas'],
  ['паста томатная', 'tomato_paste'],
  ['томатное пюре', 'tomato_paste'],
  ['пюре томатное', 'tomato_paste'],
  ['макароны спагетти', 'pasta'],
  ['спагетти', 'pasta'],
  ['луковица', 'onions'],
  ['лук крупный', 'onions'],
  ['лук репчатый крупный', 'onions'],
  ['картошка', 'potatoes'],
  ['гречка', 'buckwheat'],
  ['гречневая крупа', 'buckwheat'],
  ['крупа гречневая', 'buckwheat'],
  ['овсянка', 'oatmeal'],
  ['овсяные хлопья', 'oatmeal'],
  ['хлопья овсяные', 'oatmeal'],
  ['сахарный песок', 'sugar'],
  ['песок сахарный', 'sugar'],
  ['перец черный молотый', 'pepper'],
  ['перец чёрный молотый', 'pepper'],
  ['черный перец', 'pepper'],
  ['чёрный перец', 'pepper'],
  ['перец молотый', 'pepper'],
  ['перец болгарский', 'bell_pepper'],
  ['болгарский перец', 'bell_pepper'],
  ['помидор', 'tomato'],
  ['томат', 'tomato'],
  ['огурец', 'cucumber'],
  ['яйцо', 'eggs'],
  ['сливочное масло', 'butter'],
  ['сыр плавленый', 'cheese'],
  ['шампиньон', 'mushroom'],
  ['гриб', 'mushroom'],
  ['петрушка', 'herbs'],
  ['укроп', 'herbs'],
  ['филе трески', 'cod'],
  ['лосось', 'salmon'],
  ['форель', 'trout'],
  ['креветка', 'shrimps'],
  ['капуста краснокочанная', 'red_cabbage'],
  ['брокколи', 'broccoli'],
  ['капуста пекинская', 'peking_cabbage'],
  ['кольраби', 'kohlrabi'],
  ['баклажан', 'eggplants'],
  ['баклажаны', 'eggplants'],
  ['тыква', 'pumpkin'],
  ['свекла', 'beets'],
  ['свёкла', 'beets'],
  ['редис', 'radish'],
  ['батат', 'sweet_potato'],
  ['сельдерей стебель', 'celery_stalk'],
  ['стебель сельдерея', 'celery_stalk'],
  ['сельдерей', 'celery_stalk'],
  ['корень сельдерея', 'celery_root'],
  ['пастернак', 'parsnip'],
  ['фенхель', 'fennel'],
  ['спаржа', 'asparagus'],
  ['горошек свежий', 'green_peas'],
  ['горох стручковый', 'green_peas'],
  ['кукуруза', 'corn'],
  ['имбирь', 'ginger'],
  ['перец чили', 'chili_pepper'],
  ['лук порей', 'leek'],
  ['порей', 'leek'],
  ['лук зелёный', 'green_onion'],
  ['лук зеленый', 'green_onion'],
  ['кинза', 'cilantro'],
  ['базилик', 'basil'],
  ['мята', 'mint'],
  ['розмарин', 'rosemary'],
  ['тимьян', 'thyme'],
  ['салат листовой', 'lettuce'],
  ['салат', 'lettuce'],
  ['руккола', 'arugula'],
  ['рукола', 'arugula'],
  ['микрозелень', 'microgreens'],
  ['вешенки', 'oyster_mushroom'],
  ['лисички', 'chanterelle'],
  ['белые грибы', 'porcini'],
  ['апельсин', 'oranges'],
  ['апельсины', 'oranges'],
  ['мандарин', 'tangerines'],
  ['мандарины', 'tangerines'],
  ['грейпфрут', 'grapefruit'],
  ['лайм', 'limes'],
  ['груша', 'pears'],
  ['груши', 'pears'],
  ['персик', 'peaches'],
  ['персики', 'peaches'],
  ['нектарин', 'nectarines'],
  ['нектарины', 'nectarines'],
  ['абрикос', 'apricots'],
  ['абрикосы', 'apricots'],
  ['слива', 'plums'],
  ['сливы', 'plums'],
  ['киви', 'kiwi'],
  ['манго', 'mango'],
  ['авокадо', 'avocado'],
  ['ананас', 'pineapple'],
  ['гранат', 'pomegranate'],
  ['хурма', 'persimmon'],
  ['дыня', 'melon'],
  ['арбуз', 'watermelon'],
  ['маракуйя', 'passion_fruit'],
  ['клубника', 'strawberries'],
  ['малина', 'raspberries'],
  ['ежевика', 'blackberries'],
  ['черника', 'blueberries'],
  ['манная крупа', 'semolina'],
  ['крупа манная', 'semolina'],
  ['перловка', 'pearl_barley'],
  ['крупа перловая', 'pearl_barley'],
  ['кукурузная крупа', 'corn_grits'],
  ['пшеничная крупа', 'wheat_grits'],
  ['мука ржаная', 'rye_flour'],
  ['горох', 'peas'],
  ['фасоль', 'beans'],
  ['чечевица', 'lentils'],
  ['маш', 'mung'],
  ['кефир', 'kefir'],
  ['ряженка', 'ryazhenka'],
  ['сыр плавленый', 'process_cheese'],
  ['сыр творожный', 'cream_cheese'],
  ['яйца перепелиные', 'quail_eggs'],
  ['перепелиные яйца', 'quail_eggs'],
  ['крыло куриное', 'chicken_wing'],
  ['крылья куриные', 'chicken_wing'],
  ['печень куриная', 'chicken_liver'],
  ['сердце куриное', 'chicken_heart'],
  ['желудки куриные', 'chicken_gizzard'],
  ['филе индейки', 'turkey_fillet'],
  ['индейка', 'turkey_fillet'],
  ['утка', 'duck'],
  ['минтай', 'pollock'],
  ['сельдь', 'herring'],
  ['скумбрия', 'mackerel'],
  ['карп', 'carp'],
  ['сибас', 'sea_bass'],
  ['мидии', 'mussels'],
  ['масло льняное', 'flaxseed_oil'],
  ['масло кунжутное', 'sesame_oil'],
  ['кешью', 'cashews'],
  ['фундук', 'hazelnuts'],
  ['фисташки', 'pistachios'],
  ['семечки тыквы', 'pumpkin_seeds'],
  ['семена тыквы', 'pumpkin_seeds'],
  ['семечки подсолнечника', 'sunflower_seeds'],
  ['семечки подсолнечные', 'sunflower_seeds'],
  ['семена подсолнечника', 'sunflower_seeds'],
  ['кунжут', 'sesame'],
  ['семена льна', 'flax_seeds'],
  ['семена чиа', 'chia'],
  ['чиа', 'chia'],
  ['изюм', 'raisins'],
  ['курага', 'dried_apricots'],
  ['чернослив', 'prunes'],
  ['финики', 'dates'],
  ['финик', 'dates'],
  ['инжир', 'dried_figs'],
  ['клюква сушёная', 'dried_cranberry'],
  ['кетчуп', 'ketchup'],
  ['горчица', 'mustard'],
  ['уксус', 'vinegar'],
  ['дрожжи', 'yeast'],
  ['сода', 'baking_soda'],
  ['разрыхлитель', 'baking_powder'],
  ['сухари панировочные', 'breadcrumbs'],
  ['крахмал', 'starch'],
  ['желатин', 'gelatin'],
  ['лаваш', 'lavash'],
  ['горошек консервированный', 'green_peas_canned'],
  ['кукуруза консервированная', 'corn_canned'],
  ['оливки', 'olives'],
  ['маслины', 'black_olives'],
  ['каперсы', 'capers'],
  ['помидоры консервированные', 'canned_tomatoes'],
  ['тофу', 'tofu'],
];

export function getIngredient(id: string): Ingredient | undefined {
  return INGREDIENT_INDEX.get(id);
}

/**
 * Catalogue lookup by name for ingested (imported) ingredient text:
 *   1. exact normalized-name match (e.g. «Молоко 3,2%» matches «молоко»);
 *   2. curated alias (e.g. «филе куриное» — reversed word order);
 *   3. first whole-word prefix (e.g. «Яйца куриные» matches «яйца»).
 * Deterministic (first catalogue entry wins). Heuristic for imports only.
 */
export function getIngredientByName(name: string): Ingredient | undefined {
  const n = normalizeName(name);
  if (!n) return undefined;
  const exact = INGREDIENT_NORMALIZED_INDEX.get(n);
  if (exact) return exact;
  for (const [alias, id] of INGREDIENT_NAME_ALIASES) {
    if (alias === n) {
      const ing = INGREDIENT_INDEX.get(id);
      if (ing) return ing;
    }
  }
  return INGREDIENTS.find((i) => normalizeName(i.name).startsWith(`${n} `));
}

export function ingredientByIdOrThrow(id: string): Ingredient {
  const ing = INGREDIENT_INDEX.get(id);
  if (!ing) throw new Error(`Unknown ingredient: ${id}`);
  return ing;
}

export interface IngredientSearchResult {
  id: string;
  name: string;
  unit: string;
}

export interface IngredientGroup {
  id: string;
  name: string;
  /** Catalogue ingredient ids grouped under a shared label. */
  memberIds: string[];
}

export interface IngredientGroupSearchResult {
  id: string;
  name: string;
  members: IngredientSearchResult[];
}

/**
 * Curated groups for the custom allergen / disliked picker: choosing a group
 * adds all its catalogue members at once, but each member stays a separate
 * removable term — the user can then drop specific kinds.
 */
export const INGREDIENT_GROUPS: IngredientGroup[] = [
  { id: 'mushrooms', name: 'Грибы', memberIds: ['mushroom', 'oyster_mushroom', 'chanterelle', 'porcini'] },
  { id: 'cabbage', name: 'Капуста', memberIds: ['cabbage', 'red_cabbage', 'cauliflower', 'broccoli', 'peking_cabbage', 'kohlrabi'] },
  { id: 'onions', name: 'Лук', memberIds: ['onions', 'leek', 'green_onion'] },
  { id: 'peppers', name: 'Перец (сладкий/чили)', memberIds: ['bell_pepper', 'chili_pepper'] },
  { id: 'greens', name: 'Зелень и салаты', memberIds: ['herbs', 'cilantro', 'basil', 'mint', 'rosemary', 'thyme', 'lettuce', 'arugula', 'microgreens'] },
  { id: 'root_vegetables', name: 'Корнеплоды', memberIds: ['carrots', 'beets', 'parsnip', 'celery_root', 'radish', 'sweet_potato', 'ginger'] },
  { id: 'citrus', name: 'Цитрусовые', memberIds: ['oranges', 'tangerines', 'grapefruit', 'lemon', 'limes'] },
  { id: 'stone_fruits', name: 'Косточковые фрукты', memberIds: ['peaches', 'nectarines', 'apricots', 'plums'] },
  { id: 'berries', name: 'Ягоды', memberIds: ['strawberries', 'raspberries', 'blackberries', 'blueberries'] },
  { id: 'melons', name: 'Бахчевые', memberIds: ['melon', 'watermelon'] },
  { id: 'tropical_fruits', name: 'Тропические фрукты', memberIds: ['pineapple', 'mango', 'passion_fruit', 'bananas', 'kiwi'] },
  { id: 'nuts_seeds', name: 'Орехи и семечки', memberIds: ['peanuts', 'walnuts', 'almonds', 'cashews', 'hazelnuts', 'pistachios', 'pumpkin_seeds', 'sunflower_seeds', 'sesame', 'flax_seeds', 'chia'] },
  { id: 'dried_fruits', name: 'Сухофрукты', memberIds: ['raisins', 'dried_apricots', 'prunes', 'dates', 'dried_figs', 'dried_cranberry'] },
  { id: 'dairy', name: 'Молочные продукты', memberIds: ['milk', 'cream', 'sour_cream', 'kefir', 'ryazhenka', 'butter', 'cheese', 'process_cheese', 'cream_cheese', 'feta', 'cottage_cheese', 'yogurt'] },
  { id: 'cheese', name: 'Сыры', memberIds: ['cheese', 'process_cheese', 'cream_cheese', 'feta'] },
  { id: 'eggs', name: 'Яйца', memberIds: ['eggs', 'quail_eggs'] },
  { id: 'chicken', name: 'Курица', memberIds: ['chicken_fillet', 'chicken_leg', 'chicken_wing', 'chicken_minced'] },
  { id: 'offal', name: 'Субпродукты', memberIds: ['chicken_liver', 'chicken_heart', 'chicken_gizzard'] },
  { id: 'red_meat', name: 'Красное мясо', memberIds: ['beef', 'pork'] },
  { id: 'poultry', name: 'Птица (кроме курицы)', memberIds: ['turkey_fillet', 'duck'] },
  { id: 'fish', name: 'Рыба', memberIds: ['salmon', 'cod', 'pollock', 'herring', 'mackerel', 'carp', 'sea_bass', 'trout'] },
  { id: 'seafood', name: 'Морепродукты', memberIds: ['mussels', 'shrimps'] },
  { id: 'vegetable_oils', name: 'Растительные масла', memberIds: ['vegetable_oil', 'olive_oil', 'flaxseed_oil', 'sesame_oil'] },
  { id: 'grains', name: 'Крупы', memberIds: ['rice', 'millet', 'buckwheat', 'oatmeal', 'semolina', 'pearl_barley', 'corn_grits', 'wheat_grits'] },
  { id: 'legumes', name: 'Бобовые', memberIds: ['peas', 'beans', 'lentils', 'mung', 'green_peas'] },
  { id: 'canned_vegetables', name: 'Консервированные овощи', memberIds: ['green_peas_canned', 'corn_canned', 'canned_tomatoes', 'olives', 'black_olives', 'capers'] },
  { id: 'sauces', name: 'Соусы и приправы', memberIds: ['soy_sauce', 'mayo', 'ketchup', 'mustard', 'vinegar', 'tomato_paste'] },
];

const INGREDIENT_BY_ID = new Map(INGREDIENTS.map((ing) => [ing.id, ing]));

function resolveGroupMembers(group: IngredientGroup): IngredientSearchResult[] {
  const members: IngredientSearchResult[] = [];
  for (const id of group.memberIds) {
    const ing = INGREDIENT_BY_ID.get(id);
    if (ing) members.push({ id: ing.id, name: ing.name, unit: ing.unit });
  }
  return members;
}

/**
 * Groups whose label or any member matches the query. Only groups with at least
 * one real catalogue member are returned; the whole group is expanded so the
 * client can add every member at once.
 */
export function searchIngredientGroups(query: string, limit = 4): IngredientGroupSearchResult[] {
  const q = normalizeName(query);
  if (!q) return [];
  const words = q.split(' ').filter(Boolean);
  if (words.length === 0) return [];

  const scored: { group: IngredientGroup; score: number }[] = [];
  for (const group of INGREDIENT_GROUPS) {
    const label = normalizeName(group.name);
    const members = resolveGroupMembers(group);
    if (members.length === 0) continue;

    let score = 0;
    if (label === q) {
      score = 90;
    } else if (label.startsWith(q)) {
      score = 70;
    } else if (words.every((w) => label.includes(w))) {
      score = 60;
    } else if (members.some((m) => normalizeName(m.name) === q)) {
      score = 80;
    } else if (members.some((m) => {
      const n = normalizeName(m.name);
      return words.every((w) => n.includes(w));
    })) {
      score = 50;
    } else if (members.some((m) => {
      const n = normalizeName(m.name);
      return words.some((w) => n.includes(w));
    })) {
      score = 30;
    }

    if (score > 0) scored.push({ group, score });
  }

  scored.sort((a, b) => b.score - a.score || a.group.name.localeCompare(b.group.name, 'ru'));
  return scored.slice(0, limit).map((s) => ({
    id: s.group.id,
    name: s.group.name,
    members: resolveGroupMembers(s.group),
  }));
}

/**
 * Catalogue search used to validate and suggest free-text excludes (custom
 * allergens / dislikes). Only products that exist in the curated catalogue are
 * returned — the user can only add products we actually match inside recipes.
 */
export function searchIngredients(query: string, limit = 8): IngredientSearchResult[] {
  const q = normalizeName(query);
  if (!q) return [];
  const words = q.split(' ').filter(Boolean);
  if (words.length === 0) return [];

  const scored: { ing: Ingredient; score: number }[] = [];
  for (const ing of INGREDIENTS) {
    const name = normalizeName(ing.name);
    if (!name) continue;
    let score = 0;
    let matched = false;
    if (name === q) {
      score = 100;
      matched = true;
    } else if (name.startsWith(q)) {
      score = 80;
      matched = true;
    } else if (words.every((w) => name.includes(w))) {
      score = 60;
      matched = true;
    } else if (words.some((w) => name.includes(w))) {
      score = 40;
      matched = true;
    }
    if (!matched) continue;
    scored.push({ ing, score });
  }

  scored.sort((a, b) => b.score - a.score || a.ing.name.localeCompare(b.ing.name, 'ru'));
  return scored.slice(0, limit).map((s) => ({ id: s.ing.id, name: s.ing.name, unit: s.ing.unit }));
}

/** Best catalogue match for a typo'd query (spelling correction). */
export function suggestIngredientName(query: string): string | null {
  const q = normalizeName(query);
  if (!q) return null;
  const candidates = INGREDIENTS.map((ing) => ({ ing, name: normalizeName(ing.name) })).filter((c) => c.name);
  let best: { name: string; dist: number } | null = null;
  for (const c of candidates) {
    const dist = levenshtein(q, c.name);
    const cutoff = Math.max(2, Math.floor(q.length / 2));
    if (dist <= cutoff && (!best || dist < best.dist)) {
      best = { name: c.ing.name, dist };
    }
  }
  return best?.name ?? null;
}

function levenshtein(a: string, b: string): number {
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  const curr = new Array(b.length + 1).fill(0);
  for (let i = 0; i < a.length; i += 1) {
    curr[0] = i + 1;
    for (let j = 0; j < b.length; j += 1) {
      const cost = a[i] === b[j] ? 0 : 1;
      curr[j + 1] = Math.min(curr[j] + 1, prev[j + 1] + 1, prev[j] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

// ---------------------------------------------------------------------------
// Mock price catalogue: demo prices per store (NO real prices)
// ---------------------------------------------------------------------------

interface BaseOffer {
  productId: string;
  price: number;
  packageQuantity: number;
  packageUnit: 'g' | 'ml' | 'pcs';
}

const BASE_OFFERS: BaseOffer[] = [
  { productId: 'chicken_fillet', price: 12.99, packageQuantity: 800, packageUnit: 'g' },
  { productId: 'chicken_leg', price: 9.49, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'chicken_minced', price: 8.99, packageQuantity: 900, packageUnit: 'g' },
  { productId: 'beef', price: 27.9, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'pork', price: 14.9, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'potatoes', price: 2.49, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'carrots', price: 1.69, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'onions', price: 1.39, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'garlic', price: 2.99, packageQuantity: 100, packageUnit: 'g' },
  { productId: 'tomato', price: 4.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'cucumber', price: 3.19, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'bell_pepper', price: 7.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'cabbage', price: 1.19, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'cauliflower', price: 4.79, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'spinach', price: 3.19, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'mushroom', price: 5.49, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'zucchini', price: 3.59, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'rice', price: 3.49, packageQuantity: 800, packageUnit: 'g' },
  { productId: 'millet', price: 2.19, packageQuantity: 800, packageUnit: 'g' },
  { productId: 'pasta', price: 1.89, packageQuantity: 450, packageUnit: 'g' },
  { productId: 'buckwheat', price: 3.29, packageQuantity: 800, packageUnit: 'g' },
  { productId: 'oatmeal', price: 1.49, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'bread', price: 1.35, packageQuantity: 600, packageUnit: 'g' },
  { productId: 'flour', price: 1.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'eggs', price: 4.79, packageQuantity: 10, packageUnit: 'pcs' },
  { productId: 'milk', price: 2.29, packageQuantity: 1000, packageUnit: 'ml' },
  { productId: 'cream', price: 3.49, packageQuantity: 500, packageUnit: 'ml' },
  { productId: 'sour_cream', price: 3.29, packageQuantity: 400, packageUnit: 'g' },
  { productId: 'butter', price: 4.19, packageQuantity: 180, packageUnit: 'g' },
  { productId: 'cheese', price: 6.49, packageQuantity: 250, packageUnit: 'g' },
  { productId: 'feta', price: 5.99, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'cottage_cheese', price: 4.99, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'yogurt', price: 2.49, packageQuantity: 300, packageUnit: 'g' },
  { productId: 'mayo', price: 3.59, packageQuantity: 400, packageUnit: 'g' },
  { productId: 'vegetable_oil', price: 4.49, packageQuantity: 1000, packageUnit: 'ml' },
  { productId: 'olive_oil', price: 8.9, packageQuantity: 500, packageUnit: 'ml' },
  { productId: 'sugar', price: 2.19, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'salt', price: 0.79, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'pepper', price: 2.99, packageQuantity: 100, packageUnit: 'g' },
  { productId: 'soy_sauce', price: 3.49, packageQuantity: 250, packageUnit: 'ml' },
  { productId: 'peanuts', price: 3.79, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'walnuts', price: 5.99, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'almonds', price: 6.49, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'salmon', price: 18.9, packageQuantity: 400, packageUnit: 'g' },
  { productId: 'cod', price: 11.5, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'shrimps', price: 15.5, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'lemon', price: 2.49, packageQuantity: 100, packageUnit: 'g' },
  { productId: 'tomato_paste', price: 3.19, packageQuantity: 400, packageUnit: 'g' },
  { productId: 'herbs', price: 1.19, packageQuantity: 50, packageUnit: 'g' },
  { productId: 'honey', price: 8.5, packageQuantity: 400, packageUnit: 'g' },
  { productId: 'apples', price: 4.29, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'bananas', price: 3.59, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'grapes', price: 8.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'red_cabbage', price: 2.49, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'broccoli', price: 6.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'peking_cabbage', price: 3.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'kohlrabi', price: 5.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'eggplants', price: 4.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'pumpkin', price: 1.79, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'beets', price: 2.29, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'radish', price: 3.49, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'sweet_potato', price: 6.49, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'celery_stalk', price: 4.49, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'celery_root', price: 4.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'parsnip', price: 5.49, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'fennel', price: 6.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'asparagus', price: 12.9, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'green_peas', price: 8.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'corn', price: 3.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'ginger', price: 6.49, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'chili_pepper', price: 9.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'leek', price: 4.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'green_onion', price: 3.49, packageQuantity: 250, packageUnit: 'g' },
  { productId: 'cilantro', price: 2.99, packageQuantity: 100, packageUnit: 'g' },
  { productId: 'basil', price: 3.49, packageQuantity: 100, packageUnit: 'g' },
  { productId: 'mint', price: 2.99, packageQuantity: 100, packageUnit: 'g' },
  { productId: 'rosemary', price: 3.99, packageQuantity: 100, packageUnit: 'g' },
  { productId: 'thyme', price: 3.99, packageQuantity: 100, packageUnit: 'g' },
  { productId: 'lettuce', price: 3.19, packageQuantity: 300, packageUnit: 'g' },
  { productId: 'arugula', price: 4.49, packageQuantity: 100, packageUnit: 'g' },
  { productId: 'microgreens', price: 5.99, packageQuantity: 100, packageUnit: 'g' },
  { productId: 'oyster_mushroom', price: 6.99, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'chanterelle', price: 18.9, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'porcini', price: 15.9, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'oranges', price: 4.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'tangerines', price: 5.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'grapefruit', price: 4.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'limes', price: 8.49, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'pears', price: 5.49, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'peaches', price: 7.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'nectarines', price: 6.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'apricots', price: 8.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'plums', price: 6.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'kiwi', price: 9.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'mango', price: 9.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'avocado', price: 7.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'pineapple', price: 9.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'pomegranate', price: 8.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'persimmon', price: 6.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'melon', price: 5.49, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'watermelon', price: 2.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'passion_fruit', price: 15.9, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'strawberries', price: 9.99, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'raspberries', price: 9.99, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'blackberries', price: 9.99, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'blueberries', price: 9.99, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'semolina', price: 1.99, packageQuantity: 800, packageUnit: 'g' },
  { productId: 'pearl_barley', price: 2.19, packageQuantity: 800, packageUnit: 'g' },
  { productId: 'corn_grits', price: 2.49, packageQuantity: 800, packageUnit: 'g' },
  { productId: 'wheat_grits', price: 2.29, packageQuantity: 800, packageUnit: 'g' },
  { productId: 'rye_flour', price: 2.49, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'peas', price: 2.79, packageQuantity: 800, packageUnit: 'g' },
  { productId: 'beans', price: 3.29, packageQuantity: 800, packageUnit: 'g' },
  { productId: 'lentils', price: 3.49, packageQuantity: 800, packageUnit: 'g' },
  { productId: 'mung', price: 4.49, packageQuantity: 800, packageUnit: 'g' },
  { productId: 'kefir', price: 2.19, packageQuantity: 1000, packageUnit: 'ml' },
  { productId: 'ryazhenka', price: 2.39, packageQuantity: 1000, packageUnit: 'ml' },
  { productId: 'process_cheese', price: 3.29, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'cream_cheese', price: 4.29, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'quail_eggs', price: 4.99, packageQuantity: 20, packageUnit: 'pcs' },
  { productId: 'chicken_wing', price: 8.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'chicken_liver', price: 6.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'chicken_heart', price: 5.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'chicken_gizzard', price: 6.49, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'turkey_fillet', price: 18.9, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'duck', price: 19.9, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'pollock', price: 6.99, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'herring', price: 7.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'mackerel', price: 8.99, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'carp', price: 10.9, packageQuantity: 1000, packageUnit: 'g' },
  { productId: 'sea_bass', price: 19.9, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'trout', price: 16.9, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'mussels', price: 7.49, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'flaxseed_oil', price: 5.99, packageQuantity: 500, packageUnit: 'ml' },
  { productId: 'sesame_oil', price: 7.99, packageQuantity: 200, packageUnit: 'ml' },
  { productId: 'cashews', price: 9.99, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'hazelnuts', price: 10.9, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'pistachios', price: 8.99, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'pumpkin_seeds', price: 4.99, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'sunflower_seeds', price: 3.49, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'sesame', price: 4.99, packageQuantity: 100, packageUnit: 'g' },
  { productId: 'flax_seeds', price: 3.99, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'chia', price: 7.99, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'raisins', price: 4.49, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'dried_apricots', price: 8.99, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'prunes', price: 6.99, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'dates', price: 9.99, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'dried_figs', price: 11.9, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'dried_cranberry', price: 9.99, packageQuantity: 300, packageUnit: 'g' },
  { productId: 'ketchup', price: 3.49, packageQuantity: 400, packageUnit: 'g' },
  { productId: 'mustard', price: 2.49, packageQuantity: 250, packageUnit: 'g' },
  { productId: 'vinegar', price: 2.19, packageQuantity: 500, packageUnit: 'ml' },
  { productId: 'yeast', price: 1.29, packageQuantity: 100, packageUnit: 'g' },
  { productId: 'baking_soda', price: 1.19, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'baking_powder', price: 1.39, packageQuantity: 100, packageUnit: 'g' },
  { productId: 'breadcrumbs', price: 2.49, packageQuantity: 250, packageUnit: 'g' },
  { productId: 'starch', price: 2.19, packageQuantity: 500, packageUnit: 'g' },
  { productId: 'gelatin', price: 2.99, packageQuantity: 25, packageUnit: 'g' },
  { productId: 'lavash', price: 2.79, packageQuantity: 300, packageUnit: 'g' },
  { productId: 'green_peas_canned', price: 3.19, packageQuantity: 400, packageUnit: 'g' },
  { productId: 'corn_canned', price: 3.49, packageQuantity: 400, packageUnit: 'g' },
  { productId: 'olives', price: 4.49, packageQuantity: 300, packageUnit: 'g' },
  { productId: 'black_olives', price: 4.49, packageQuantity: 300, packageUnit: 'g' },
  { productId: 'capers', price: 6.99, packageQuantity: 200, packageUnit: 'g' },
  { productId: 'canned_tomatoes', price: 4.99, packageQuantity: 540, packageUnit: 'g' },
  { productId: 'tofu', price: 6.49, packageQuantity: 300, packageUnit: 'g' },
];

/** Demo offers — the SAME demo numbers are cloned to every store. Marked mock. */
export function buildMockOffers(): ProductOffer[] {
  const offers: ProductOffer[] = [];
  for (const storeId of MOCK_STORE_IDS) {
    for (const base of BASE_OFFERS) {
      const ingredient = getIngredient(base.productId);
      offers.push({
        productId: base.productId,
        storeId,
        productName: ingredient ? ingredient.name : base.productId,
        price: base.price,
        currency: 'BYN',
        packageQuantity: base.packageQuantity,
        packageUnit: base.packageUnit,
        updatedAt: MOCK_UPDATED_AT,
        source: 'mock',
        isMock: true,
      });
    }
  }
  return offers;
}

// ---------------------------------------------------------------------------
// Nutrition reference DB: per 100 g approximate values (fixture)
// ---------------------------------------------------------------------------

export const NUTRITION_REFERENCE_SOURCE =
  'Справочные значения (приблизительно), средние по USDA FoodData Central / FSA reference tables. Не являются производственными данными';

const NUTRITION_PER_100G: Array<NutritionPer100g & { ingredientId: string }> = [
  { ingredientId: 'chicken_fillet', calories: 120, protein: 22.5, fat: 1.9, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'chicken_leg', calories: 158, protein: 19.3, fat: 8.7, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'chicken_minced', calories: 143, protein: 17.4, fat: 8.1, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'beef', calories: 250, protein: 26, fat: 17, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'pork', calories: 242, protein: 20.7, fat: 17, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'potatoes', calories: 77, protein: 2.0, fat: 0.1, carbs: 17, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'carrots', calories: 41, protein: 0.9, fat: 0.2, carbs: 10, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'onions', calories: 40, protein: 1.1, fat: 0.1, carbs: 9, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'garlic', calories: 149, protein: 6.4, fat: 0.5, carbs: 33, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'tomato', calories: 18, protein: 0.9, fat: 0.2, carbs: 3.9, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cucumber', calories: 15, protein: 0.7, fat: 0.1, carbs: 3.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'bell_pepper', calories: 26, protein: 1.0, fat: 0.3, carbs: 6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cabbage', calories: 25, protein: 1.3, fat: 0.1, carbs: 6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cauliflower', calories: 25, protein: 1.9, fat: 0.3, carbs: 5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'spinach', calories: 23, protein: 2.9, fat: 0.4, carbs: 3.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'mushroom', calories: 22, protein: 3.1, fat: 0.3, carbs: 3.3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'zucchini', calories: 17, protein: 1.2, fat: 0.3, carbs: 3.1, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'rice', calories: 360, protein: 7.0, fat: 0.6, carbs: 79, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'millet', calories: 378, protein: 11, fat: 4.2, carbs: 72.9, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'pasta', calories: 371, protein: 13.0, fat: 1.5, carbs: 74.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'buckwheat', calories: 343, protein: 13.3, fat: 3.4, carbs: 71.5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'oatmeal', calories: 389, protein: 16.9, fat: 6.9, carbs: 66, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'bread', calories: 265, protein: 9.0, fat: 3.2, carbs: 49, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'flour', calories: 364, protein: 10.3, fat: 1.0, carbs: 76, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'eggs', calories: 155, protein: 12.6, fat: 10.6, carbs: 1.1, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'milk', calories: 61, protein: 3.3, fat: 3.6, carbs: 4.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cream', calories: 205, protein: 2.7, fat: 20, carbs: 4, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'sour_cream', calories: 203, protein: 2.6, fat: 20, carbs: 4.5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'butter', calories: 717, protein: 0.9, fat: 81, carbs: 0.1, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cheese', calories: 402, protein: 25, fat: 33, carbs: 1.3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'feta', calories: 264, protein: 14.2, fat: 21, carbs: 4.1, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cottage_cheese', calories: 121, protein: 17, fat: 5, carbs: 3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'yogurt', calories: 66, protein: 3.9, fat: 3.2, carbs: 4.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'mayo', calories: 680, protein: 1.8, fat: 74, carbs: 2, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'vegetable_oil', calories: 884, protein: 0, fat: 100, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'olive_oil', calories: 884, protein: 0, fat: 100, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'sugar', calories: 387, protein: 0, fat: 0, carbs: 100, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'salt', calories: 0, protein: 0, fat: 0, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'pepper', calories: 251, protein: 10, fat: 3.3, carbs: 64, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'soy_sauce', calories: 53, protein: 8, fat: 0, carbs: 5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'peanuts', calories: 567, protein: 25.8, fat: 49.2, carbs: 16.1, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'walnuts', calories: 654, protein: 15.2, fat: 65.2, carbs: 13.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'almonds', calories: 579, protein: 21.2, fat: 49.9, carbs: 21.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'salmon', calories: 142, protein: 19.8, fat: 6.3, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cod', calories: 82, protein: 17.8, fat: 0.7, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'shrimps', calories: 99, protein: 24, fat: 0.3, carbs: 0.2, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'lemon', calories: 29, protein: 1.1, fat: 0.3, carbs: 9.3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'tomato_paste', calories: 82, protein: 4.3, fat: 0.5, carbs: 18.9, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'herbs', calories: 43, protein: 3.3, fat: 1.1, carbs: 7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'honey', calories: 304, protein: 0.3, fat: 0, carbs: 82.4, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'apples', calories: 52, protein: 0.3, fat: 0.2, carbs: 14, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'bananas', calories: 89, protein: 1.1, fat: 0.3, carbs: 22.8, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'grapes', calories: 69, protein: 0.7, fat: 0.2, carbs: 18, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'red_cabbage', calories: 31, protein: 1.4, fat: 0.2, carbs: 7.4, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'broccoli', calories: 34, protein: 2.8, fat: 0.4, carbs: 6.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'peking_cabbage', calories: 16, protein: 1.2, fat: 0.2, carbs: 3.2, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'kohlrabi', calories: 27, protein: 1.7, fat: 0.1, carbs: 6.2, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'eggplants', calories: 25, protein: 1.0, fat: 0.2, carbs: 5.9, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'pumpkin', calories: 26, protein: 1.0, fat: 0.1, carbs: 6.5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'beets', calories: 43, protein: 1.6, fat: 0.2, carbs: 9.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'radish', calories: 16, protein: 0.7, fat: 0.1, carbs: 3.4, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'sweet_potato', calories: 86, protein: 1.6, fat: 0.1, carbs: 20, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'celery_stalk', calories: 16, protein: 0.7, fat: 0.2, carbs: 3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'celery_root', calories: 42, protein: 1.5, fat: 0.3, carbs: 9.2, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'parsnip', calories: 75, protein: 1.2, fat: 0.3, carbs: 18, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'fennel', calories: 31, protein: 1.2, fat: 0.2, carbs: 7.3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'asparagus', calories: 20, protein: 2.2, fat: 0.1, carbs: 3.9, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'green_peas', calories: 81, protein: 5.4, fat: 0.4, carbs: 14.5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'corn', calories: 86, protein: 3.3, fat: 1.4, carbs: 19, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'ginger', calories: 80, protein: 1.8, fat: 0.8, carbs: 18, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'chili_pepper', calories: 40, protein: 1.9, fat: 0.4, carbs: 8.8, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'leek', calories: 61, protein: 1.5, fat: 0.3, carbs: 14, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'green_onion', calories: 32, protein: 1.8, fat: 0.2, carbs: 7.3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cilantro', calories: 23, protein: 2.1, fat: 0.5, carbs: 3.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'basil', calories: 23, protein: 3.2, fat: 0.6, carbs: 2.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'mint', calories: 44, protein: 3.3, fat: 0.7, carbs: 8.4, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'rosemary', calories: 131, protein: 3.3, fat: 5.9, carbs: 20.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'thyme', calories: 101, protein: 5.6, fat: 1.7, carbs: 24.5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'lettuce', calories: 15, protein: 1.4, fat: 0.2, carbs: 2.9, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'arugula', calories: 25, protein: 2.6, fat: 0.7, carbs: 3.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'microgreens', calories: 31, protein: 2.6, fat: 0.7, carbs: 3.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'oyster_mushroom', calories: 33, protein: 3.3, fat: 0.4, carbs: 6.1, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'chanterelle', calories: 38, protein: 1.5, fat: 0.5, carbs: 6.9, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'porcini', calories: 34, protein: 3.1, fat: 0.3, carbs: 3.3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'oranges', calories: 47, protein: 0.9, fat: 0.1, carbs: 11.8, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'tangerines', calories: 53, protein: 0.8, fat: 0.3, carbs: 13.3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'grapefruit', calories: 42, protein: 0.8, fat: 0.1, carbs: 10.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'limes', calories: 30, protein: 0.7, fat: 0.2, carbs: 10.5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'pears', calories: 57, protein: 0.4, fat: 0.1, carbs: 15.2, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'peaches', calories: 39, protein: 0.9, fat: 0.3, carbs: 9.5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'nectarines', calories: 44, protein: 1.1, fat: 0.3, carbs: 10.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'apricots', calories: 48, protein: 1.4, fat: 0.4, carbs: 11.1, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'plums', calories: 46, protein: 0.7, fat: 0.3, carbs: 11.4, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'kiwi', calories: 61, protein: 1.1, fat: 0.5, carbs: 14.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'mango', calories: 60, protein: 0.8, fat: 0.4, carbs: 15, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'avocado', calories: 160, protein: 2.0, fat: 14.7, carbs: 8.5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'pineapple', calories: 50, protein: 0.5, fat: 0.1, carbs: 13.1, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'pomegranate', calories: 83, protein: 1.7, fat: 1.2, carbs: 18.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'persimmon', calories: 70, protein: 0.6, fat: 0.2, carbs: 18.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'melon', calories: 34, protein: 0.8, fat: 0.2, carbs: 8.2, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'watermelon', calories: 30, protein: 0.6, fat: 0.2, carbs: 7.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'passion_fruit', calories: 97, protein: 2.2, fat: 0.7, carbs: 23.4, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'strawberries', calories: 32, protein: 0.7, fat: 0.3, carbs: 7.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'raspberries', calories: 52, protein: 1.2, fat: 0.7, carbs: 11.9, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'blackberries', calories: 43, protein: 1.4, fat: 0.5, carbs: 9.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'blueberries', calories: 57, protein: 0.7, fat: 0.3, carbs: 14.5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'semolina', calories: 360, protein: 10.3, fat: 1.0, carbs: 73, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'pearl_barley', calories: 352, protein: 9.9, fat: 1.2, carbs: 77.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'corn_grits', calories: 365, protein: 8.8, fat: 3.9, carbs: 72, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'wheat_grits', calories: 340, protein: 11.3, fat: 1.4, carbs: 72.3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'rye_flour', calories: 349, protein: 10, fat: 1.5, carbs: 74, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'peas', calories: 352, protein: 24.6, fat: 1.2, carbs: 60, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'beans', calories: 333, protein: 23.4, fat: 1.1, carbs: 60, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'lentils', calories: 352, protein: 24.6, fat: 1.1, carbs: 63, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'mung', calories: 347, protein: 23.9, fat: 1.2, carbs: 62.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'kefir', calories: 51, protein: 3.3, fat: 2.0, carbs: 4.8, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'ryazhenka', calories: 57, protein: 2.8, fat: 3.2, carbs: 4.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'process_cheese', calories: 299, protein: 16.4, fat: 24, carbs: 5.2, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cream_cheese', calories: 342, protein: 5.9, fat: 34, carbs: 4.1, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'quail_eggs', calories: 158, protein: 13.1, fat: 11.1, carbs: 0.4, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'chicken_wing', calories: 203, protein: 30.5, fat: 8.1, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'chicken_liver', calories: 116, protein: 16.9, fat: 4.8, carbs: 0.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'chicken_heart', calories: 185, protein: 15.6, fat: 12.5, carbs: 0.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'chicken_gizzard', calories: 154, protein: 17.7, fat: 4.3, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'turkey_fillet', calories: 135, protein: 30.1, fat: 1.0, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'duck', calories: 337, protein: 19.7, fat: 28.9, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'pollock', calories: 72, protein: 17.2, fat: 1.0, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'herring', calories: 158, protein: 18, fat: 9.0, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'mackerel', calories: 205, protein: 18.6, fat: 13.9, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'carp', calories: 127, protein: 17.8, fat: 5.6, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'sea_bass', calories: 97, protein: 18.4, fat: 2.0, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'trout', calories: 141, protein: 20.5, fat: 6.2, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'mussels', calories: 86, protein: 11.9, fat: 2.2, carbs: 3.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'flaxseed_oil', calories: 884, protein: 0, fat: 100, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'sesame_oil', calories: 884, protein: 0, fat: 100, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'cashews', calories: 553, protein: 18.2, fat: 43.9, carbs: 30.2, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'hazelnuts', calories: 628, protein: 15, fat: 60.8, carbs: 16.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'pistachios', calories: 562, protein: 20.2, fat: 45.3, carbs: 27.2, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'pumpkin_seeds', calories: 559, protein: 30.2, fat: 49.1, carbs: 10.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'sunflower_seeds', calories: 584, protein: 20.8, fat: 51.5, carbs: 20, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'sesame', calories: 573, protein: 17.7, fat: 49.7, carbs: 23.4, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'flax_seeds', calories: 534, protein: 18.3, fat: 42.2, carbs: 28.9, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'chia', calories: 486, protein: 16.5, fat: 30.7, carbs: 42.1, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'raisins', calories: 299, protein: 3.1, fat: 0.5, carbs: 79.2, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'dried_apricots', calories: 241, protein: 3.4, fat: 0.5, carbs: 62.6, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'prunes', calories: 240, protein: 2.2, fat: 0.4, carbs: 64, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'dates', calories: 282, protein: 2.5, fat: 0.4, carbs: 75, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'dried_figs', calories: 249, protein: 3.3, fat: 0.9, carbs: 63.9, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'dried_cranberry', calories: 308, protein: 0.1, fat: 1.4, carbs: 83, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'ketchup', calories: 102, protein: 1.8, fat: 0.4, carbs: 25, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'mustard', calories: 66, protein: 4.4, fat: 3.3, carbs: 5.8, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'vinegar', calories: 21, protein: 0, fat: 0, carbs: 0.9, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'yeast', calories: 325, protein: 40, fat: 7.6, carbs: 41.2, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'baking_soda', calories: 0, protein: 0, fat: 0, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'baking_powder', calories: 60, protein: 0, fat: 0, carbs: 15.1, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'breadcrumbs', calories: 395, protein: 13.4, fat: 5.3, carbs: 71.5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'starch', calories: 357, protein: 5.9, fat: 0.1, carbs: 83, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'gelatin', calories: 335, protein: 85.6, fat: 0.1, carbs: 0, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'lavash', calories: 275, protein: 9.1, fat: 1.2, carbs: 55.7, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'green_peas_canned', calories: 69, protein: 5.4, fat: 0.3, carbs: 11.8, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'corn_canned', calories: 66, protein: 2.0, fat: 0.6, carbs: 15.5, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'olives', calories: 115, protein: 0.8, fat: 10.7, carbs: 6.3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'black_olives', calories: 115, protein: 0.8, fat: 10.7, carbs: 6.3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'capers', calories: 23, protein: 2.4, fat: 0.9, carbs: 5.3, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'canned_tomatoes', calories: 21, protein: 1.2, fat: 0.3, carbs: 4.8, source: NUTRITION_REFERENCE_SOURCE },
  { ingredientId: 'tofu', calories: 76, protein: 8.1, fat: 4.8, carbs: 1.9, source: NUTRITION_REFERENCE_SOURCE },
];

const NUTRITION_INDEX = new Map(NUTRITION_PER_100G.map((n) => [n.ingredientId, n]));

export function getIngredientNutrition(id: string): NutritionPer100g | null {
  return NUTRITION_INDEX.get(id) ?? null;
}

// ---------------------------------------------------------------------------
// Demo recipe catalogue (dataKind 'fixture' — NOT scraped from any site)
// ---------------------------------------------------------------------------

const FIXTURE_KIND = 'fixture';

export const FIXTURE_RECIPES: Recipe[] = [
  {
    id: 'rcp_omelet',
    name: 'Омлет с молоком',
    category: 'Завтраки',
    baseServings: 2,
    timeMin: 15,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'eggs', qty: 4, unit: 'pcs' },
      { ingredientId: 'milk', qty: 100, unit: 'ml' },
      { ingredientId: 'butter', qty: 15, unit: 'g' },
      { ingredientId: 'salt', qty: 2, unit: 'g' },
      { ingredientId: 'herbs', qty: 5, unit: 'g' },
    ],
    steps: [
      'Яйца взбить с молоком и солью.',
      'Сливочное масло растопить на сковороде.',
      'Влить яичную смесь и жарить под крышкой на слабом огне 7–10 минут.',
      'Посыпать зеленью перед подачей.',
    ],
  },
  {
    id: 'rcp_oatmeal_honey',
    name: 'Овсяная каша с мёдом и орехами',
    category: 'Завтраки',
    baseServings: 2,
    timeMin: 15,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'oatmeal', qty: 200, unit: 'g' },
      { ingredientId: 'milk', qty: 600, unit: 'ml' },
      { ingredientId: 'honey', qty: 40, unit: 'g' },
      { ingredientId: 'walnuts', qty: 30, unit: 'g' },
    ],
    steps: [
      'Хлопья залить молоком и варить 5–7 минут.',
      'Добавить мёд, перемешать.',
      'Подавать, посыпав орехами.',
    ],
  },
  {
    id: 'rcp_syrniki',
    name: 'Сырники со сметаной',
    category: 'Завтраки',
    baseServings: 4,
    timeMin: 40,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'cottage_cheese', qty: 400, unit: 'g' },
      { ingredientId: 'flour', qty: 80, unit: 'g' },
      { ingredientId: 'eggs', qty: 2, unit: 'pcs' },
      { ingredientId: 'sugar', qty: 40, unit: 'g' },
      { ingredientId: 'salt', qty: 2, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 30, unit: 'ml' },
      { ingredientId: 'sour_cream', qty: 100, unit: 'g' },
    ],
    steps: [
      'Творог смешать с яйцами, сахаром, солью и мукой.',
      'Сформировать сырники и обжарить на масле по 3–4 минуты с каждой стороны.',
      'Подавать со сметаной.',
    ],
  },
  {
    id: 'rcp_chicken_soup',
    name: 'Суп куриный с лапшой',
    category: 'Супы',
    baseServings: 4,
    timeMin: 60,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'chicken_fillet', qty: 400, unit: 'g' },
      { ingredientId: 'potatoes', qty: 300, unit: 'g' },
      { ingredientId: 'carrots', qty: 120, unit: 'g' },
      { ingredientId: 'onions', qty: 100, unit: 'g' },
      { ingredientId: 'pasta', qty: 120, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 20, unit: 'ml' },
      { ingredientId: 'salt', qty: 5, unit: 'g' },
      { ingredientId: 'herbs', qty: 10, unit: 'g' },
    ],
    steps: [
      'Курицу залить водой, довести до кипения, снять пену и варить 20 минут.',
      'Добавить нарезанные картофель, морковь и лук.',
      'Через 10 минут добавить лапшу и варить ещё 7 минут.',
      'Посолить, посыпать зеленью.',
    ],
  },
  {
    id: 'rcp_cheese_soup',
    name: 'Сырный суп',
    category: 'Супы',
    baseServings: 4,
    timeMin: 45,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'potatoes', qty: 400, unit: 'g' },
      { ingredientId: 'carrots', qty: 120, unit: 'g' },
      { ingredientId: 'onions', qty: 100, unit: 'g' },
      { ingredientId: 'cheese', qty: 250, unit: 'g' },
      { ingredientId: 'milk', qty: 400, unit: 'ml' },
      { ingredientId: 'butter', qty: 20, unit: 'g' },
      { ingredientId: 'flour', qty: 40, unit: 'g' },
      { ingredientId: 'salt', qty: 6, unit: 'g' },
      { ingredientId: 'herbs', qty: 10, unit: 'g' },
    ],
    steps: [
      'В кипящую воду добавить картофель, морковь и лук.',
      'Мука с маслом пассеруются, к ним добавляется молоко.',
      'Через 15 минут влить молочную смесь и добавить натёртый сыр.',
      'Варить до растворения сыра, посолить, посыпать зеленью.',
    ],
  },
  {
    id: 'rcp_chicken_plov',
    name: 'Плов с курицей',
    category: 'Основные блюда',
    baseServings: 6,
    timeMin: 90,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'chicken_fillet', qty: 600, unit: 'g' },
      { ingredientId: 'rice', qty: 500, unit: 'g' },
      { ingredientId: 'onions', qty: 250, unit: 'g' },
      { ingredientId: 'carrots', qty: 250, unit: 'g' },
      { ingredientId: 'garlic', qty: 25, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 50, unit: 'ml' },
      { ingredientId: 'salt', qty: 8, unit: 'g' },
      { ingredientId: 'pepper', qty: 2, unit: 'g' },
    ],
    steps: [
      'Курицу обжарить на масле, добавить лук и морковь.',
      'Всыпать рис, залить водой на 2 см выше, посолить.',
      'Добавить головку чеснока и тушить под крышкой 25–30 минут.',
    ],
  },
  {
    id: 'rcp_pasta_naval',
    name: 'Макароны по-флотски',
    category: 'Основные блюда',
    baseServings: 4,
    timeMin: 40,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'pasta', qty: 400, unit: 'g' },
      { ingredientId: 'beef', qty: 350, unit: 'g' },
      { ingredientId: 'onions', qty: 150, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 30, unit: 'ml' },
      { ingredientId: 'salt', qty: 6, unit: 'g' },
      { ingredientId: 'pepper', qty: 1, unit: 'g' },
    ],
    steps: [
      'Фарш обжарить с луком до готовности, посолить и поперчить.',
      'Отварить макароны до готовности.',
      'Смешать макароны с фаршем и прогреть.',
    ],
  },
  {
    id: 'rcp_buckwheat_mushroom',
    name: 'Гречка с грибами и луком',
    category: 'Основные блюда',
    baseServings: 4,
    timeMin: 45,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'buckwheat', qty: 300, unit: 'g' },
      { ingredientId: 'mushroom', qty: 300, unit: 'g' },
      { ingredientId: 'onions', qty: 120, unit: 'g' },
      { ingredientId: 'garlic', qty: 10, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 40, unit: 'ml' },
      { ingredientId: 'salt', qty: 6, unit: 'g' },
    ],
    steps: [
      'Гречку промыть и отварить в подсоленной воде.',
      'Грибы и лук обжарить с чесноком на масле.',
      'Смешать с готовой гречкой и подавать.',
    ],
  },
  {
    id: 'rcp_beef_stew',
    name: 'Говядина тушёная с овощами',
    category: 'Основные блюда',
    baseServings: 6,
    timeMin: 120,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'beef', qty: 450, unit: 'g' },
      { ingredientId: 'potatoes', qty: 500, unit: 'g' },
      { ingredientId: 'carrots', qty: 200, unit: 'g' },
      { ingredientId: 'onions', qty: 150, unit: 'g' },
      { ingredientId: 'tomato_paste', qty: 80, unit: 'g' },
      { ingredientId: 'garlic', qty: 15, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 30, unit: 'ml' },
      { ingredientId: 'salt', qty: 8, unit: 'g' },
      { ingredientId: 'pepper', qty: 2, unit: 'g' },
    ],
    steps: [
      'Говядину обжарить на масле до румяной корочки.',
      'Добавить лук, морковь, томатную пасту и потушить 10 минут.',
      'Залить водой, добавить картофель и тушить под крышкой около 1 часа.',
    ],
  },
  {
    id: 'rcp_chicken_cutlets',
    name: 'Котлеты куриные',
    category: 'Основные блюда',
    baseServings: 4,
    timeMin: 60,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'chicken_fillet', qty: 500, unit: 'g' },
      { ingredientId: 'onions', qty: 120, unit: 'g' },
      { ingredientId: 'eggs', qty: 2, unit: 'pcs' },
      { ingredientId: 'bread', qty: 60, unit: 'g' },
      { ingredientId: 'milk', qty: 80, unit: 'ml' },
      { ingredientId: 'flour', qty: 40, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 40, unit: 'ml' },
      { ingredientId: 'salt', qty: 6, unit: 'g' },
      { ingredientId: 'pepper', qty: 1, unit: 'g' },
    ],
    steps: [
      'Курицу и лук пропустить через мясорубку.',
      'Хлеб замочить в молоке, добавить в фарш вместе с яйцами, солью и перцем.',
      'Сформировать котлеты, обвалять в муке и обжарить до готовности.',
    ],
  },
  {
    id: 'rcp_baked_fish',
    name: 'Треска запечённая с овощами',
    category: 'Основные блюда',
    baseServings: 4,
    timeMin: 55,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'cod', qty: 500, unit: 'g' },
      { ingredientId: 'potatoes', qty: 400, unit: 'g' },
      { ingredientId: 'carrots', qty: 150, unit: 'g' },
      { ingredientId: 'onions', qty: 100, unit: 'g' },
      { ingredientId: 'lemon', qty: 30, unit: 'g' },
      { ingredientId: 'olive_oil', qty: 25, unit: 'ml' },
      { ingredientId: 'herbs', qty: 10, unit: 'g' },
      { ingredientId: 'salt', qty: 6, unit: 'g' },
    ],
    steps: [
      'Рыбу сбрызнуть лимоном, посолить.',
      'На противень выложить картофель, морковь и лук, сверху — рыбу.',
      'Полить маслом и запекать 35–40 минут при 200 °C.',
    ],
  },
  {
    id: 'rcp_shrimp_rice',
    name: 'Креветки с рисом и чесноком',
    category: 'Основные блюда',
    baseServings: 4,
    timeMin: 35,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'shrimps', qty: 400, unit: 'g' },
      { ingredientId: 'rice', qty: 300, unit: 'g' },
      { ingredientId: 'garlic', qty: 15, unit: 'g' },
      { ingredientId: 'lemon', qty: 20, unit: 'g' },
      { ingredientId: 'soy_sauce', qty: 20, unit: 'ml' },
      { ingredientId: 'vegetable_oil', qty: 25, unit: 'ml' },
      { ingredientId: 'herbs', qty: 10, unit: 'g' },
    ],
    steps: [
      'Рис отварить до готовности.',
      'Креветки обжарить с чесноком на масле 3–4 минуты.',
      'Добавить соевый соус и лимонный сок.',
      'Подавать с рисом, посыпав зеленью.',
    ],
  },
  {
    id: 'rcp_veg_salad',
    name: 'Салат овощной свежий',
    category: 'Салаты',
    baseServings: 4,
    timeMin: 15,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'cucumber', qty: 300, unit: 'g' },
      { ingredientId: 'tomato', qty: 300, unit: 'g' },
      { ingredientId: 'bell_pepper', qty: 150, unit: 'g' },
      { ingredientId: 'onions', qty: 60, unit: 'g' },
      { ingredientId: 'herbs', qty: 15, unit: 'g' },
      { ingredientId: 'olive_oil', qty: 20, unit: 'ml' },
      { ingredientId: 'lemon', qty: 15, unit: 'g' },
      { ingredientId: 'salt', qty: 3, unit: 'g' },
    ],
    steps: [
      'Овощи нарезать произвольно.',
      'Заправить маслом, лимонным соком, посолить.',
      'Посыпать зеленью и перемешать.',
    ],
  },
  {
    id: 'rcp_greek_salad',
    name: 'Салат греческий',
    category: 'Салаты',
    baseServings: 4,
    timeMin: 20,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'tomato', qty: 400, unit: 'g' },
      { ingredientId: 'cucumber', qty: 300, unit: 'g' },
      { ingredientId: 'bell_pepper', qty: 150, unit: 'g' },
      { ingredientId: 'onions', qty: 80, unit: 'g' },
      { ingredientId: 'feta', qty: 150, unit: 'g' },
      { ingredientId: 'olive_oil', qty: 30, unit: 'ml' },
      { ingredientId: 'herbs', qty: 10, unit: 'g' },
      { ingredientId: 'salt', qty: 3, unit: 'g' },
    ],
    steps: [
      'Овощи нарезать крупно, добавить кубики брынзы.',
      'Заправить оливковым маслом, посолить.',
      'Подавать, посыпав зеленью.',
    ],
  },
  {
    id: 'rcp_peanut_cabbage',
    name: 'Салат с арахисом',
    category: 'Салаты',
    baseServings: 4,
    timeMin: 20,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'cabbage', qty: 300, unit: 'g' },
      { ingredientId: 'carrots', qty: 150, unit: 'g' },
      { ingredientId: 'peanuts', qty: 60, unit: 'g' },
      { ingredientId: 'sugar', qty: 10, unit: 'g' },
      { ingredientId: 'salt', qty: 3, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 20, unit: 'ml' },
    ],
    steps: [
      'Капусту нашинковать, морковь натереть.',
      'Добавить арахис, сахар, соль и масло.',
      'Перемешать и дать настояться 10 минут.',
    ],
  },

  // --- Simple side dishes («Гарниры») and desserts so the component picker
  // (обед/ужин из нескольких блюд) has a real pool to draw from. ----------

  {
    id: 'rcp_boiled_potatoes',
    name: 'Отварной картофель',
    category: 'Гарниры',
    baseServings: 4,
    timeMin: 30,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'potatoes', qty: 800, unit: 'g' },
      { ingredientId: 'butter', qty: 20, unit: 'g' },
      { ingredientId: 'herbs', qty: 10, unit: 'g' },
      { ingredientId: 'salt', qty: 5, unit: 'g' },
    ],
    steps: [
      'Картофель очистить и отварить в подсоленной воде до готовности.',
      'Слить воду, добавить масло и посыпать зеленью.',
    ],
  },
  {
    id: 'rcp_mashed_potatoes',
    name: 'Картофельное пюре',
    category: 'Гарниры',
    baseServings: 4,
    timeMin: 35,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'potatoes', qty: 700, unit: 'g' },
      { ingredientId: 'milk', qty: 200, unit: 'ml' },
      { ingredientId: 'butter', qty: 30, unit: 'g' },
      { ingredientId: 'salt', qty: 5, unit: 'g' },
    ],
    steps: [
      'Картофель отварить в подсоленной воде.',
      'Размять, добавить горячее молоко и масло, взбить до пышности.',
    ],
  },
  {
    id: 'rcp_boiled_rice',
    name: 'Рис отварной',
    category: 'Гарниры',
    baseServings: 4,
    timeMin: 30,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'rice', qty: 300, unit: 'g' },
      { ingredientId: 'butter', qty: 15, unit: 'g' },
      { ingredientId: 'salt', qty: 3, unit: 'g' },
    ],
    steps: [
      'Рис промыть и отварить в подсоленной воде 15–18 минут.',
      'Добавить масло и разрыхлить вилкой.',
    ],
  },
  {
    id: 'rcp_boiled_buckwheat',
    name: 'Гречка отварная',
    category: 'Гарниры',
    baseServings: 4,
    timeMin: 35,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'buckwheat', qty: 350, unit: 'g' },
      { ingredientId: 'butter', qty: 15, unit: 'g' },
      { ingredientId: 'salt', qty: 3, unit: 'g' },
    ],
    steps: [
      'Гречку промыть, залить водой 1:2 и варить под крышкой до готовности.',
      'Добавить масло и перемешать.',
    ],
  },
  {
    id: 'rcp_boiled_pasta',
    name: 'Макароны отварные',
    category: 'Гарниры',
    baseServings: 4,
    timeMin: 25,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'pasta', qty: 300, unit: 'g' },
      { ingredientId: 'butter', qty: 15, unit: 'g' },
      { ingredientId: 'salt', qty: 4, unit: 'g' },
    ],
    steps: [
      'Макароны отварить в подсоленной воде до готовности.',
      'Слить воду, добавить масло и перемешать.',
    ],
  },
  {
    id: 'rcp_vegetable_side',
    name: 'Овощи тушёные на гарнир',
    category: 'Гарниры',
    baseServings: 4,
    timeMin: 35,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'zucchini', qty: 300, unit: 'g' },
      { ingredientId: 'bell_pepper', qty: 150, unit: 'g' },
      { ingredientId: 'carrots', qty: 120, unit: 'g' },
      { ingredientId: 'onions', qty: 80, unit: 'g' },
      { ingredientId: 'vegetable_oil', qty: 20, unit: 'ml' },
      { ingredientId: 'salt', qty: 4, unit: 'g' },
      { ingredientId: 'herbs', qty: 10, unit: 'g' },
    ],
    steps: [
      'Овощи нарезать кубиками.',
      'Обжарить лук и морковь, добавить кабачки и перец, влить немного воды.',
      'Тушить под крышкой 15–20 минут, посолить и посыпать зеленью.',
    ],
  },
  {
    id: 'rcp_baked_apples',
    name: 'Яблоки печёные с мёдом',
    category: 'Десерты',
    baseServings: 4,
    timeMin: 40,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'apples', qty: 600, unit: 'g' },
      { ingredientId: 'honey', qty: 40, unit: 'g' },
      { ingredientId: 'butter', qty: 10, unit: 'g' },
    ],
    steps: [
      'С яблок срезать верхушки, удалить сердцевину.',
      'Внутрь положить мёд и кусочек масла.',
      'Запекать 25–30 минут при 180 °C.',
    ],
  },
  {
    id: 'rcp_cottage_casserole',
    name: 'Творожная запеканка',
    category: 'Десерты',
    baseServings: 4,
    timeMin: 50,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'cottage_cheese', qty: 400, unit: 'g' },
      { ingredientId: 'eggs', qty: 2, unit: 'pcs' },
      { ingredientId: 'semolina', qty: 50, unit: 'g' },
      { ingredientId: 'sugar', qty: 40, unit: 'g' },
      { ingredientId: 'butter', qty: 15, unit: 'g' },
      { ingredientId: 'sour_cream', qty: 80, unit: 'g' },
    ],
    steps: [
      'Творог смешать с яйцами, сахаром, манкой и растопленным маслом.',
      'Выложить в форму и запекать 30–35 минут при 180 °C.',
      'Подавать со сметаной.',
    ],
  },
  {
    id: 'rcp_fruit_salad',
    name: 'Фруктовый салат с мёдом',
    category: 'Десерты',
    baseServings: 4,
    timeMin: 15,
    dataKind: FIXTURE_KIND,
    sourceLabel: 'Демо-каталог',
    ingredients: [
      { ingredientId: 'apples', qty: 200, unit: 'g' },
      { ingredientId: 'bananas', qty: 2, unit: 'pcs' },
      { ingredientId: 'oranges', qty: 200, unit: 'g' },
      { ingredientId: 'honey', qty: 30, unit: 'g' },
    ],
    steps: [
      'Фрукты очистить и нарезать кубиками.',
      'Перемешать и полить мёдом.',
    ],
  },
];

export function buildFixtureRecipes(): Recipe[] {
  return FIXTURE_RECIPES;
}