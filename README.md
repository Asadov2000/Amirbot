# Amir Family Care

Монорепозиторий для Telegram Mini App, которым пользуются только мама и папа для трекинга ребёнка от 0 месяцев до 3 лет. Основной фокус: большие ночные CTA, тёмная тема, минимальный ввод, оффлайн-очередь с последующей синхронизацией, семейная лента, ежедневные сводки, напоминания и экспорт данных для врача.

## Стек

- `Next.js 16.2.x`, `React 19.2.x`, `TypeScript`
- `Node 24 LTS`, `pnpm`, `Turborepo`
- `Prisma` + `PostgreSQL 18`
- `Redis` + worker queue processing
- Telegram Mini App SDK + Telegram Bot

## Структура

- `apps/web` — Telegram Mini App UI: дашборд, быстрый лог, семейная лента, дневная сводка, экспорт PDF/CSV, AI-подсказки, оффлайн-режим.
- `apps/bot` — Telegram bot с `/start`, `/today`, deep links и внутренним reminder bridge.
- `apps/worker` — обработка очередей напоминаний, экспортов и daily summary.
- `packages/db` — Prisma schema, миграции, client и репозитории.
- `packages/shared` — общие enum-ы, DTO, zod-схемы, helper-ы.
- `packages/config` — строгая env-валидация для web/db/bot/worker.
- `packages/ui` — общие React UI-блоки для Mini App.

## Локальный запуск

1. Установить `Node 24` и `pnpm`.
2. Поднять инфраструктуру:

```bash
docker compose up -d
```

3. Скопировать env:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

4. Установить зависимости:

```bash
pnpm install
```

5. Сгенерировать Prisma client и применить миграции:

```bash
pnpm db:generate
pnpm db:migrate
```

6. Запустить монорепозиторий:

```bash
pnpm dev
```

## Команды

- `pnpm dev` — web + bot + worker в watch-режиме.
- `pnpm build` — полная сборка всех пакетов/приложений.
- `pnpm typecheck` — TypeScript по workspace.
- `pnpm db:generate` — генерация Prisma client.
- `pnpm db:migrate` — deploy миграций Prisma.

## UX-принципы

- тёмная тема по умолчанию;
- крупные кнопки и быстрые сценарии без длинных форм;
- адаптация под `Xiaomi Poco X6 Pro`, `iPhone 14` и Windows 11 laptop;
- offline-first логирование с локальной очередью;
- семейная лента с исправлением записей;
- экспорт и сводки для врача.

## CI/CD

- GitHub Actions workflow: `.github/workflows/ci.yml`
- Проверки: install, Prisma generate, typecheck, build
- Для production удобно деплоить `apps/web`, `apps/bot`, `apps/worker` отдельно, но использовать единый Postgres/Redis и общий `.env` contract из `packages/config`.
