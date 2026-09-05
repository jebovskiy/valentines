# Valentines Mini App

Telegram Mini App для отправки анимированных валентинок партнеру.

## Структура

```
miniapp/
├── src/
│   ├── components/       # UI компоненты (HeartOpenAnimation, Layout)
│   ├── screens/          # Экраны (List, Send, Detail, Pairing)
│   ├── hooks/            # Zustand сторы (useValentinesStore)
│   ├── api/              # API клиенты (backend + Supabase Realtime)
│   ├── utils/            # Telegram WebApp SDK интеграция
│   ├── types/            # TypeScript типы
│   ├── styles/           # Глобальные стили
│   ├── App.tsx           # Роутинг и инициализация
│   └── main.tsx          # Entry point
├── public/               # Статические файлы
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.example
```

## Экраны

1. **ListScreen** (`/`) — лента полученных/отправленных валентинок
2. **SendScreen** (`/send`) — отправка валентинки (тип `heart_open` + сообщение)
3. **DetailScreen** (`/valentine/:id`) — просмотр валентинки с полноценной SVG-анимацией морфинга
4. **PairingScreen** (`/pairing`) — настройка companion-приложения (QR/диплинк)

## Особенности

- **Telegram WebApp SDK** — initData валидация, MainButton, BackButton, HapticFeedback, темизация
- **Supabase Realtime** — мгновенное обновление ленты без пуллинга
- **SVG Path Morphing** — анимация `heart_open` (квадрат → сердце) на чистом SVG/JS
- **Zustand** — простое управление состоянием
- **React Router** — навигация между экранами

## Переменные окружения

```env
VITE_API_URL=https://your-railway-app.up.railway.app
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Запуск

```bash
cd miniapp
npm install
cp .env.example .env
# Заполните .env
npm run dev
```

## Деплой

Сборка: `npm run build` → папка `dist/`

Деплой на Vercel/Netlify/GitHub Pages с настройкой SPA fallback.

## Telegram Bot настройка

1. Создайте бота через @BotFather
2. Настройте Mini App URL (Web App URL)
3. Добавьте `TELEGRAM_BOT_TOKEN` в backend .env