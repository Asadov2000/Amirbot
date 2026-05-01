# Amir Care Mini App Audit

Дата: 2026-04-26

## Executive Summary

Проведен аудит безопасности, синхронизации данных, UX Telegram Mini App, зависимостей и сборки monorepo.

Критичные направления исправлены локально:

- Доступ теперь завязан на immutable Telegram ID родителей, а не на username.
- Локальный auth fallback больше не открывает доступ по умолчанию вне локального хоста.
- `403` больше не подменяется cached/offline данными.
- Offline-sync защищен от потери новой правки, если старая операция уже была в отправке.
- События сначала попадают в durable pending-очередь, и только потом показываются локально.
- Конфликт `409` больше не удаляет локальную правку без решения пользователя.
- UI показывает количество конфликтных записей и отдельное предупреждение на главном экране.
- Экспорт PDF/CSV теперь валидируется, логируется в audit trail и корректно показывает ошибку в UI.
- Dependency audit очищен через `pnpm.overrides`.

## Исправлено

### Security

- `apps/web/src/lib/server/telegram-auth.ts`: авторизация мамы и папы выполняется только по Telegram ID `775978948` и `5328212518`. Username оставлен только как отображаемая информация.
- `apps/web/src/lib/telegram-identity.ts`: клиент больше не считает неизвестного Telegram-пользователя разрешенным.
- `apps/web/src/lib/server/telegram-auth.ts`: local fallback требует локальный host и явный mock/local режим, не возвращает маму по умолчанию.
- `apps/web/src/hooks/use-care-dashboard.ts`: при `403` приложение переходит в `accessDenied`, а не показывает старый кеш.
- `apps/web/src/app/api/events/route.ts`: update требует `expectedRevision`.
- `apps/web/src/lib/server/event-draft-validation.ts`: добавлена семантическая валидация payload для кормления, сна, подгузника, температуры и роста.
- `apps/web/src/app/api/exports/route.ts`: экспорт валидирует формат и пишет `AuditLog`.

### Data Consistency

- `apps/web/src/lib/offline-queue.ts`: добавлено удаление pending-операции только если она не изменилась во время sync.
- `apps/web/src/lib/offline-queue.ts`: конфликтные операции сохраняются как `conflicted`, а не удаляются.
- `apps/web/src/lib/offline-queue.ts`: pending-очередь стала источником durable local events, чтобы запись не пропадала из UI даже при сбое отдельного local-events cache.
- `apps/web/src/hooks/use-care-dashboard.ts`: sync пропускает conflicted-операции и сохраняет локальные данные для ручного повторного исправления.
- `apps/web/src/hooks/use-care-dashboard.ts`: создание и правка событий сначала сохраняют pending-операцию, затем используют sync lock для прямой отправки, чтобы не было гонки между ручной отправкой и автосинком.
- `apps/web/src/hooks/use-care-dashboard.ts`: локальная правка серверного события определяется по `revision`, поэтому конфликтная правка не уходит повторно как новая запись.
- `packages/db/src/repositories/care-event.repository.ts`: create стал устойчивым к race по `idempotencyKey` и возвращает уже созданную запись при `P2002`.
- `apps/web/src/lib/server/dashboard.ts`: snapshot version усилен `updatedAt + count + maxId`.
- `apps/web/src/lib/server/dashboard.ts`: смена типа события больше не делает неатомарный delete+create.
- `apps/web/src/lib/server/family-context.ts`: семья выбирается через membership известных родителей, а не через глобальный `findFirst()`.

### UX / Telegram

- `apps/web/src/components/dashboard/care-dashboard.tsx`: экспорт PDF/CSV показывает состояние загрузки и ошибку без unhandled promise rejection.
- `apps/web/src/components/dashboard/care-dashboard.tsx`: главный экран показывает конфликт синхронизации отдельным статусом и не закрывает форму, если сохранение не удалось.
- `apps/web/src/components/dashboard/care-dashboard.tsx`: bottom sheet получил `aria-labelledby` и закрытие по Escape.
- `apps/web/src/components/dashboard/care-dashboard.tsx` и `packages/ui/src/index.tsx`: selected controls получили `aria-pressed`/`aria-current`.
- `apps/web/src/app/globals.css`: лента лучше адаптируется на узких экранах, кнопка правки уходит под текст.

### Dependencies

- `package.json` и `pnpm-lock.yaml`: добавлены overrides для `valibot`, `uuid`, `postcss`.
- `pnpm audit --audit-level moderate`: известных уязвимостей нет.

## Остаточные Риски

- Текущая машина запускает Node `v22.17.0`, проект требует Node `>=24.0.0`. На Render/Vercel нужно использовать Node 24.
- `CSP` пока допускает `'unsafe-inline'` для Telegram SDK/Next runtime совместимости. Для следующего security pass лучше перейти на nonce/hash-based CSP после runtime-проверки в Telegram.
- Conflict UI сейчас сохраняет конфликтную правку, но отдельного экрана “сравнить серверную и мою версию” еще нет.
- Offline storage пока на `localStorage`; для максимальной надежности на больших объемах лучше перейти на IndexedDB.

## Verification

- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm --filter @amir/web build`: passed.
- `pnpm build`: passed.
- `pnpm audit --audit-level moderate`: passed, no known vulnerabilities.
