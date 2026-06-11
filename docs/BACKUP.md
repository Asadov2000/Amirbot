# Резервное копирование базы данных

## Как это работает

GitHub Actions workflow [`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml) каждый день в 04:00 МСК:

1. Делает `pg_dump` продакшен-базы (формат custom).
2. Шифрует дамп AES-256 (репозиторий публичный, без шифрования выкладывать дампы нельзя).
3. Сохраняет файл `amir-db-YYYY-MM-DD.dump.enc` как artifact с хранением **90 дней**.

Запустить бэкап вручную: GitHub → Actions → «DB Backup» → «Run workflow».

## Обязательная настройка (один раз)

GitHub → репозиторий → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Значение |
|---|---|
| `DATABASE_URL` | Полная строка подключения к продакшен-базе: `postgresql://user:pass@host:5432/amir_db?sslmode=require` (та же, что в Vercel) |
| `BACKUP_PASSPHRASE` | Длинная случайная фраза (32+ символов). Сохраните её в надёжном месте (менеджер паролей) — без неё бэкап не расшифровать! |

Пока секреты не заданы, workflow просто пропускает бэкап с предупреждением.

⚠️ Если строка подключения к базе меняется (новая база, ротация пароля) — обновить secret `DATABASE_URL` и здесь, и в Vercel.

## Как восстановить из бэкапа

1. Скачать artifact нужной даты: GitHub → Actions → «DB Backup» → выбрать запуск → Artifacts.
2. Расшифровать (понадобится `BACKUP_PASSPHRASE`):

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in amir-db-2026-06-11.dump.enc -out amir-db.dump \
  -pass pass:'ВАША_ФРАЗА'
```

3. Восстановить в базу (БД должна существовать, миграции накатывать не нужно — дамп содержит схему):

```bash
pg_restore --clean --if-exists --no-owner --no-privileges \
  -d "postgresql://user:pass@host:5432/amir_db?sslmode=require" amir-db.dump
```

`pg_restore` должен быть версии ≥ 18 (как сервер).

## Второй уровень защиты — снапшоты Render

GitHub-бэкап — это страховка вне Render. Основная защита — сама база:

- **Бесплатная база Render живёт 30 дней**, потом приостанавливается и через ~14 дней удаляется навсегда. Для семейных данных бесплатный план использовать нельзя.
- На платном плане (от `basic-256mb`, как в `render.yaml`) Render автоматически делает ежедневные снапшоты и поддерживает point-in-time recovery: Dashboard → база → вкладка «Recovery».

## Чего не делать

- Не чистить кеш/хранилище Telegram на телефонах родителей, пока есть несинхронизированные записи (счётчик «N ждёт синхронизации» на главном экране) — локальная очередь в localStorage это и есть несохранённые данные.
- Не вызывать `POST /api/admin/reset-care-data` без свежего бэкапа — он необратимо удаляет все записи.
