# Структура проекта

Этот репозиторий устроен как monorepo. Правило простое: код должен лежать там, где у него один понятный владелец.

## Приложения

- `apps/web` - Telegram Mini App. Здесь живут экраны, API routes, Telegram initData/session, offline sync, экспорт PDF/CSV и клиентская логика.
- `apps/bot` - Telegram Bot. Здесь только команды бота, webhook/http слой, deep links и отправка сообщений.
- `apps/worker` - фоновые задачи. Здесь напоминания, очереди, daily summary, долгие операции и обработчики Redis/BullMQ.

## Общие пакеты

- `packages/db` - Prisma schema, migrations, Prisma client, репозитории и audit log. Любая запись в PostgreSQL должна проходить через этот пакет или через явно серверный слой, который использует этот пакет.
- `packages/shared` - общие enum, zod-схемы, DTO и типы, которые нужны нескольким приложениям.
- `packages/ui` - общие React-компоненты без бизнес-логики: карточки, кнопки, табы, пустые состояния.
- `packages/config` - валидация env и общий контракт окружения для web, bot, worker и db.

## Web App

- `apps/web/src/app` - Next.js routes, layout, manifest, API routes.
- `apps/web/src/components` - клиентские React-компоненты. Компонент не должен напрямую знать Prisma или env.
- `apps/web/src/hooks` - клиентское состояние, offline queue, sync orchestration.
- `apps/web/src/lib/server` - только серверная логика API routes: Telegram auth, dashboard orchestration, export, AI, validation.
- `apps/web/src/lib` - клиентские и общие web-утилиты: типы, форматирование, mock/offline helpers, Telegram client identity.

## Правила изменений

- UI-изменения начинаются в `apps/web/src/components` и `packages/ui`.
- Синхронизация и offline-first поведение меняются в `apps/web/src/hooks/use-care-dashboard.ts` и `apps/web/src/lib/offline-queue.ts`.
- Формат данных и валидаторы меняются в `packages/shared`.
- Запись, audit trail, optimistic locking и soft delete меняются в `packages/db`.
- Telegram-доступ на клиенте меняется в `apps/web/src/lib/telegram-identity.ts`, на сервере - в `apps/web/src/lib/server/telegram-auth.ts`.
- Новые бизнес-сущности сначала добавляются в Prisma, затем в shared schemas, затем в server repository/API, и только потом в UI.

## Что держать под контролем

- `care-dashboard.tsx` уже большой. Новые крупные блоки лучше выносить в отдельные компоненты внутри `apps/web/src/components/dashboard`.
- Нельзя хранить реальные данные только в `localStorage`: это только offline queue/cache. Источник истины - PostgreSQL.
- Любое редактирование событий должно учитывать `revision`, чтобы мама и папа не затирали изменения друг друга.
- Быстрые кнопки можно кешировать на клиенте, но список должен восстанавливаться из серверных событий.
