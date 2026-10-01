# Valentines — приложение для пар

Telegram Mini App + бэкенд + Android-приложение для двоих: анимированные валентинки, серия дней (streak), заметки и напоминания, события пары, фильмы с совместимостью вкусов, «куда пойти», игры для двоих и ИИ-генерация меню на неделю со списком покупок.

Три части, две площадки деплоя:

| Часть | Каталог | Стек | Деплой |
|---|---|---|---|
| Telegram Mini App | `miniapp/` | React 18 + Vite 5 + TypeScript | Vercel |
| Бэкенд | `backend/` | Fastify 4 + Supabase (Postgres) + Firebase FCM | Railway (Docker) |
| Android-компаньон | `android/` | Kotlin + Jetpack Compose + Glance widget | GitHub Releases (APK) |

---

## Архитектура

```
Telegram (Mini App / Bot)
        │
        │ initData (Authorization: tma …)
        ▼
   Backend (Fastify) ──────► Supabase Postgres (RLS) + Realtime
        │                        ▲
        │                         │ anon key + service_role
        ▼
  Firebase FCM (data-only) ──► Android-компаньон (уведомления, виджет)
        │
        └─ Telegram Bot API (команды /start, /valentine, …)
```

- **Mini App** общается с бэкендом по REST, используя `initData` Telegram как токен (заголовок `Authorization: tma <initData>`).
- **Бэкенд** хранит данные в Supabase, шлёт пуши через FCM и отвечает боту через Telegram Bot API.
- **Android-компаньон** получает push-уведомления, показывает последнюю валентинку и раскрывает диплинки `valentines://pair` и `https://…/c/<token>`.

---

## Структура репозитория

```
valentains/
├── miniapp/           # Telegram Mini App (фронтенд)
│   ├── src/
│   │   ├── api/           # REST-клиент + Supabase Realtime клиент
│   │   ├── components/    # UI: Layout, NavSheet, анимации валентинок
│   │   ├── hooks/         # Zustand-сторы (useValentinesStore)
│   │   ├── screens/       # Экраны и шаги меню (menu/)
│   │   ├── styles/        # global.css (дизайн-токены) + index.css (keyframes)
│   │   ├── types/         # TypeScript типы + справочники (ANIMATIONS, STREAK_TIERS)
│   │   ├── utils/         # telegram.ts (SDK + initData), AppleEmoji, etc.
│   │   ├── App.tsx        # Роутер и инициализация
│   │   └── main.tsx
│   └── public/            # assetlinks.json (.well-known), icon.jfif
├── backend/           # Fastify + Supabase + FCM
│   ├── src/
│   │   ├── config/        # zod-схема env + KNOWN_ANIMATION_TYPES
│   │   ├── middleware/    # auth.ts (telegramAuthMiddleware, requireTelegramAuth)
│   │   ├── routes/        # API-роуты (см. ниже)
│   │   ├── services/      # database, fcm, pushDispatcher, pairing, telegramBot…
│   │   │   └── menu/      # ИИ-генерация меню (planner, providers, nutrition…)
│   │   ├── utils/         # telegram.ts (валидация initData), storage
│   │   └── index.ts       # точка входа
│   ├── menu-data/         # recipes.json + prices.json (каталог рецептов/цен)
│   ├── supabase/migrations/  # 23 миграции (001…023)
│   └── test/              # тесты: bot, menu (ai, planner, realdata)
├── android/            # Kotlin-компаньон (Compose)
│   └── app/src/main/java/app/valentines/companion/
│       ├── data/          # ApiClient (Retrofit), NotificationHelper, PrefsRepository
│       ├── fcm/           # ValentinesMessagingService
│       ├── sync/          # WidgetSyncService, WidgetRefreshWorker
│       ├── ui/            # ValentinesAppScreen, theme
│       └── widget/        # ValentineWidget (Glance)
```

---

## Mini App (`miniapp/`)

### Стек

- **React 18** + **TypeScript**, сборка **Vite 5** (порт 5173, `host: true`, `assetsInclude: **/*.jfif`, sourcemap)
- **react-router-dom v6** — маршрутизация
- **Zustand** — состояние (`useValentinesStore`)
- **@twa-dev/sdk** — интеграция с Telegram WebApp (MainButton, BackButton, HapticFeedback, темизация)
- **@supabase/supabase-js** — Realtime-подписки (лента валентинок, даты-сессии, игры)

### Экраны и маршруты

```
/                       ListScreen — лента полученных/отправленных валентинок
/send                   SendScreen — отправка валентинки (тип + сообщение + фото)
/valentine/:id          DetailScreen — просмотр с анимацией
/pairing                PairingScreen — диплинк/QR для Android-компаньона
/profile                ProfileScreen — профиль
/streak                 StreakScreen — серия дней пары
/notes                  NotesScreen — заметки (идеи/дела/воспоминания/желания)
/movies                 MoviesScreen — фильмы с оценками и совместимостью вкусов
/movies/taste           TasteProfileScreen — профиль вкусов
/date                   DatePlacesScreen — «куда пойти» (подбор мест)
/games, /games/play     GamesScreen, GamePlayScreen — игры для двоих
/menu                   MenuRootScreen — меню на неделю
/menu/store …/allergens Step-экраны: магазин → люди → блюда → бюджет → посуда → аллергены
/menu/generating        MenuGeneratingScreen — анимация генерации меню
/menu/result            MenuResultScreen — итоговое меню + список покупок
/menu/replace           MenuReplaceScreen — замена блюда на слоте
/menu/history           MenuHistoryScreen — история сохранённых недель
/menu/shopping          ShoppingListScreen
/menu/leftovers         MenuLeftoversScreen — остатки с прошлого меню («докупить»)
/settings               SettingsScreen
/c/:token               CompanionRedirect — вход для Android-компаньона (диплинк)
/v/:id                  DeepValentineScreen — глубокая ссылка на валентинку
```

### Типы анимаций валентинок

Определены в `backend/src/config/index.ts` (`KNOWN_ANIMATION_TYPES`) и `miniapp/src/types/index.ts` (`ANIMATIONS`, `STREAK_TIERS`):

| Тип | Эмодзи | Название | Сцена |
|---|---|---|---|
| `heart_open` | 💌 | Валентинка | конверт: открывается клапан, буква, сердечко |
| `sparkle` | ✨ | Блеск | звёзды пульсируют по отдельности (1 центр + 3 малые) |
| `moon` | 🌙 | Ночь | ночная карточка: луна + звёзды, текст белым снизу |
| `flame` | 🔥 | Страсть | живое пламя |
| `bloom_petals` | 🌸 | Цветение | 10 лепестков «распускаются» вокруг центра |
| `golden_halo` | 👑 | Нимб | 🙂-лицо + светящаяся корона над головой |

`STREAK_TIERS`: день 1 → `heart_open`, 7 → `sparkle`, 14 → `moon`, 30 → `flame`, 60 → `bloom_petals`, 100 → `golden_halo`. Типы `bloom_petals` и `golden_halo` «залочены» до 60 и 100 дней соответственно (`STREAK_LOCKED_ANIMATIONS`).

Анимации рендерятся компонентом `ValentineAnimation.tsx`, который делегирует в сцены (`HeartOpen/Envelope/Sparkle/Moon/Flame/Bloom/Halo`). Все сцены зациклены из CSS-@keyframes в `miniapp/src/styles/index.css` (`va-*`). Эмодзи берутся из `AppleEmoji` (карта codepoint → PNG-спрайт Apple).

### Переменные окружения (`.env`)

```env
VITE_API_URL=https://your-railway-app.up.railway.app
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Запуск и сборка

```bash
cd miniapp
npm install
cp .env.example .env
npm run dev          # Vite dev-сервер, порт 5173

npm run build        # tsc && vite build → dist/
npm run preview
npm run lint
npm run typecheck
```

Деплой: Vercel (SPA `rewrites → /index.html`, кэш только для `/assets/*`, `index.html` — no-cache).

---

## Бэкенд (`backend/`)

### Стек

- **Fastify 4** + `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit` (100 req/min)
- **zod** — валидация env и тел запросов
- **@supabase/supabase-js** — Postgres + RLS
- **firebase-admin** — FCM (data-only пуши)
- **tsx** в dev, **tsc** в build; тесты на Node `node:test`

### Аутентификация

Заголовок каждого запроса из Mini App:

```
Authorization: tma <telegram-initData>
```

Валидация (`backend/src/utils/telegram.ts`): разбор `initData`, HMAC-SHA256 по секрету `WebAppData + bot token`, проверка `auth_date` не старше 24 ч. Middleware: `telegramAuthMiddleware` (валидирует и кладёт `request.telegramUser`) → `requireTelegramAuth`.

### API-роуты (префиксы)

| Префикс | Что делает |
|---|---|
| `/api/pairs` | текущая пара, серия, приглашения, pairing-токены |
| `/api/valentines` | CRUD валентинок (тип, текст, фото), доставка/просмотр |
| `/api/push` | регистрация устройств для пуша |
| `/api/companion` | `push-token`, `permission`, `widget`, `latest-valentine`, `update` (версия/APK), `stream` (SSE) |
| `/api/users` | профиль |
| `/api/greetings` | утренние/вечерние и др. приветствия |
| `/api/notes` | заметки + напоминания |
| `/api/reminders` | повторяющиеся напоминания |
| `/api/events` | события пары с напоминанием за N дней |
| `/api/movies` | фильмы, оценки, инсайты, совместимость вкусов (Poiskkino) |
| `/api/places` | «куда пойти» (Google Places) + фото мест |
| `/api/dates` | сессии выбора места с голосованием (свайп like/dislike) |
| `/api/games` | игровые сессии (5 игр) |
| `/api/integrations` | статус интеграций |
| `/api/menu` | ИИ-генерация меню, замена блюда, история, остатки, список покупок |
| `/telegram` | webhook бота (`POST /` c `x-telegram-bot-api-secret-token`) |
| `/health` | healthcheck для Railway |

### Сервисы

- `services/pairing.ts` — создание пары, one-time pairing-токены (TTL по умолч. 10 мин), приглашения
- `services/pushDispatcher.ts` + `services/fcm.ts` — отправка data-only FCM-пушей
- `services/notificationScheduler.ts` — тикеры: напоминания (1 мин), события (10 мин), фильмы (4 ч); отправка в Telegram + компаньон
- `services/telegramBot.ts` + `routes/bot.ts` — webhook, `setMyCommands`, команды `/start /help /valentine /pairing /profile /streak /games /about /feedback`
- `services/botCommands.ts` — обработка команд бота (reply-разметка с Web App кнопками)
- `services/updateBroadcaster.ts` — раз в 30 мин проверяет GitHub Releases и пушит Android-пользователям о новой версии
- `services/menu/*` — планировщик меню, поставщики ИИ, каталог цен, аллергены, посуда, калорийность, остатки

### ИИ-интеграции

`AI_PROVIDER`: `gemini` (по умолчанию) | `deepseek` | `groq` | `openrouter`. Ключи моделей:

- `GEMINI_MODEL` — `gemini-3.5-flash-lite` (нужна модель с лимитом ≥16384 токенов — меню на неделю большое)
- `DEEPSEEK_MODEL` — `deepseek-v4-flash`
- `GROQ_MODEL` — `llama-3.3-70b-versatile`
- `OPENROUTER_MODEL` — `z-ai/glm-5.3-flash` (reasoning отключён, иначе не влезает в бюджет и 90-сек timeout)

При падении первичного провайдера бэкенд гоняет запрос против Gemini параллельно / как fallback (`2aff403` — race primary vs Gemini). Внешние данные: `GOOGLE_MAPS_API_KEY` (места), `POISKKINO_API_KEY` (фильмы).

### Переменные окружения (`.env`)

```env
SUPABASE_URL=…
SUPABASE_SERVICE_ROLE_KEY=…
SUPABASE_ANON_KEY=…
PORT=3000
NODE_ENV=development
APP_URL=https://your-railway-app.up.railway.app
TELEGRAM_BOT_TOKEN=…
FCM_SERVICE_ACCOUNT_JSON={"type":"service_account",…}
WEBHOOK_SHARED_SECRET=…            # минимум 32 символа
PAIRING_TOKEN_TTL_MINUTES=10
GEMINI_API_KEY=…  GEMINI_MODEL=gemini-3.5-flash-lite
AI_PROVIDER=gemini                  # gemini|deepseek|groq|openrouter
DEEPSEEK_API_KEY=…  DEEPSEEK_MODEL=deepseek-v4-flash
GROQ_API_KEY=…      GROQ_MODEL=llama-3.3-70b-versatile
OPENROUTER_API_KEY=…  OPENROUTER_MODEL=z-ai/glm-5.3-flash
GOOGLE_MAPS_API_KEY=…
POISKKINO_API_KEY=…
```

`APP_URL` автоматически подхватывается из `RAILWAY_PUBLIC_DOMAIN`. `MINI_APP_URL` (для web_app-кнопок бота) по умолчанию `https://valentines-sigma-neon.vercel.app`.

### База данных (Supabase)

23 миграции в `backend/supabase/migrations/`. Ключевые таблицы:

- `pairs` — пара пользователей (telegram_user_a/b), имена
- `devices` — устройства компаньона (platform, push_token, флаги permission/widget)
- `valentines` — валентинки (animation_type, message, photo_url, sent/delivered/seen)
- `push_jobs` — очередь пушей (channel `visible|data`, retries)
- `pairing_tokens` — одноразовые токены сопряжения
- `pair_invites` — приглашения по коду
- `user_profiles`, `streaks` (current/max streak), `greetings`, `notes`, `reminders`, `couple_events`, `movies` + `movie_reviews` + `movie_aspects` / `insights`, `date_sessions`/`date_votes`, `games`/`game_answers`, `menus` (история), `leftovers`

RLS включён на всех таблицах; anon-политики разрешают читать/писать только свою пару (через `request.jwt.claims`). `pg_cron`/`pg_net` — для кронов и обращения к Railway-вебхуку.

Некоторые продакшн-тикеры работают в самом бэкенде (`notificationScheduler`) — не зависят от настроек Supabase cron.

### Docker / Railway

```dockerfile
# backend/Dockerfile
FROM node:22-alpine AS builder … (npm ci, npm run build)
FROM node:22-alpine AS runner
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/menu-data ./menu-data
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

```toml
# backend/railway.toml
[build]   builder = "dockerfile"
[deploy]  healthcheckPath = "/health", restartPolicyType = "on_failure"
```

### Тесты

```bash
cd backend
npm run dev            # tsx watch src/index.ts
npm run build && npm start
npm run lint && npm run typecheck
node --import tsx --test test/*.test.ts   # node:test: bot.*, menu.ai, menu.planner, menu.realdata
```

Данные для тестов/каталога:

- `backend/menu-data/recipes.json` — каталог рецептов
- `backend/menu-data/prices.json` — цены продуктов (отдельно качают crawler-скрипты в `backend/scripts/`: `crawl-prices.ts`, `edostavka-crawler.ts`)

---

## Android-компаньон (`android/`)

### Стек и параметры

- Kotlin + Jetpack Compose (BOM `2024.09.03`), Material 3
- `applicationId app.valentines.companion`, `minSdk 26`, `targetSdk 35`, версия `7.0` (versionCode 7)
- Retrofit + Moshi + OkHttp (logging-interceptor)
- Firebase Messaging, DataStore Preferences, WorkManager
- Glance AppWidget — виджет последней валентинки (обновляется по пушам + каждые 15 мин через WorkManager)

### Возможности

- Сопряжение по диплинку `valentines://pair` или `https://valentines-sigma-neon.vercel.app/c/<token>` (Asset Links в `miniapp/public/.well-known/assetlinks.json`)
- Push-уведомления: валентинка, приветствие, заметка, событие, напоминание
- Виджет: отправитель, текст, тип, фото, время последней валентинки + кнопка «открыть»
- Обновление APK: проверка GitHub Releases (`/api/companion/update`) с предложением установить
- SSE `stream` (`/api/companion/stream`) — мгновенный канал валентинок независимо от FCM
- Разрешения: `INTERNET`, `POST_NOTIFICATIONS`, `REQUEST_INSTALL_PACKAGES`, Foreground Service `DATA_SYNC`

### Сборка

```bash
cd android
./gradlew :app:assembleRelease   # (Windows: gradlew.bat)
```

APK выкладывается в GitHub Releases (tag = versionCode, напр. `v7`); бэкенд по `/api/companion/update` отдаёт ссылку на скачивание.

---

## Как всё запускается целиком

1. **Supabase**: применяем миграции `backend/supabase/migrations/`, создаём `SUPABASE_URL/SERVICE_ROLE_KEY/ANON_KEY`.
2. **Backend**: `npm install`, `.env`, `npm run dev` (Railway: `dockerfile`, healthcheck `/health`).
3. **Mini App**: `npm install`, `.env`, `npm run dev`; деплой на Vercel.
4. **Telegram**: `@BotFather` → создать бота, указать Web App URL, `TELEGRAM_BOT_TOKEN` в `.env` бэкенда; бэкенд сам вызовет `setWebhook` при старте (`allow_updates: ['message']`).
5. **Android**: собрать APK, выпустить GitHub Release, в приложении открыть pairing-диплинк из Mini App (`/pairing`).

---

## Заметки по особенностям и подводным камням

- Telegram отбрасывает web_app URL длиннее 64 символов — Mini App сам рулит навигацией через `start_param` (`/v/<id>`, `/c/<token>`), без фрагментов в URL.
- Наличие ключей ИИ необязательно: все AI-фичи имеют fallback на эвристики существующих данных, если провайдер недоступен.
- Модель для меню обязана держать ≥16K выходных токенов. По состоянию на 2026: `2.5-flash`/`1.5-flash` больше не раздаются новым пользователям (HTTP 404), а unrestricted API-ключи отклоняются — нужен ключ, ограниченный только Gemini API, в AI Studio.
- Рекуррентные напоминания (`yearly`/`monthly`) пересчитываются самим планировщиком бэкенда.
- Виджет компаньона обновляется триггером из FCM-сообщения и фон-сервисом, чтобы оставаться свежим мгновенно после получения валентинки.

---

## Порядок выкладки (после миграции 024 и фиксов)

1. **APK-подпись (сначала!):** если прежние релизы подписаны debug/временным ключом, новый `key.properties`‑подписанный APK не встанет поверх без удаления приложения (потеря pairing). Сверь отпечатки:
   `apksigner verify --print-certs app.apk` для старого и нового APK. **Дважды** скопируй `key.properties` + keystore (секреты не в git). Утеря ключа = невозможность обновить приложение вообще.
2. **Staging Supabase:** прогнать миграции (в т.ч. `024_multi_instance_safety.sql` и `025_date_session_dismissal.sql`) на отдельном проекте, тесты и ручной сценарий «отправил → пуш → виджет». Порядок важен: `025` добавляет `date_sessions.dismissed_by`, который читает `/api/dates/active`, поэтому миграция обязана быть применена **до** деплоя этого бэкенда (иначе модуль «Куда пойти» будет отдавать 500).
3. **Прод: миграция + деплой подряд и без тестовых валентинок:** `supabase db push` (с бэкапом БД перед этим), затем сразу Railway. Старый бэкенд в моменте не должен слать пушей по DB-пайплайну, новый — не должен падать на отсутствующих RPC.
4. **После 024:** сбросить GUC-параметры, если задавались: `RESET app.push_webhook_url; RESET app.push_webhook_secret;` (DB-пайплайн больше не используется; отправка идёт инлайн из планировщика бэкенда).
5. **Проверки в проде:** два тестовых пользователя из разных пар не видят чужие валентинки (Realtime/RLS); `allowedMimeTypes` и размер бакета `valentine-photos` выставлены (сервер тоже валидирует magic-bytes); при ≥2 инстансах Railway уведомления не дублируются (claim-RPC с `SKIP LOCKED`); два одновременных кино-отзыва не запускают два запроса ИИ (`claimMovieInsight`); сборка APK в CI (JDK 17, AGP 8.5.2).
6. **Android 15:** фон-сервис виджета объявлен как `dataSync` — на Android 15 лимит ~6 часов фоновой работы; это приемлемо для виджета-компаньона, но не полагайся на него как на гарантию доставки (основной канал — FCM-пуш, виджет обновляется и по нему).