# nest-shop-api-tests

Інтеграційні тести для [nest-shop-api](https://github.com/ZelikSV/nest-shop-api).
Стек: **Vitest** + **axios**. Тести гоняться проти живого сервера.

---

## Що тестується

| Файл | Маршрути |
|------|----------|
| `auth.test.ts` | `POST /auth/register`, `POST /auth/login`, `GET /auth/profile` |
| `products.test.ts` | `GET/POST/PUT/DELETE /products` (без авторизації) |
| `users.test.ts` | `GET/POST/PUT/DELETE /users` (тільки admin) |
| `orders.test.ts` | `POST /orders`, `GET /orders/user/:id`, `GET /orders/:id`, `GET /orders/:id/public` + async RabbitMQ polling |
| `files.test.ts` | `POST /files/presign`, `POST /files/complete` |
| `graphql.test.ts` | query `orders` — фільтр, пагінація, помилки |

---

## Передумови

### 1. Node.js та yarn
```bash
node -v   # >= 18
yarn -v   # >= 1.22
```

### 2. Запущений nest-shop-api

Перейди в директорію `nest-shop-api` і підніми всі сервіси:

```bash
cd ../nest-shop-api

# Запустити PostgreSQL + RabbitMQ + API у Docker
docker compose -f compose.yml -f compose.dev.yml up --build -d

# Дочекатися старту (~15 сек), потім застосувати міграції
docker compose exec api yarn migration:run

# Засіяти БД тестовими даними (products + users)
docker compose exec api yarn seed
```

Перевір, що API відповідає:
```bash
curl http://localhost:8080/api/v1/products
# має повернути JSON-масив
```

### 3. Виправити пароль адмін-юзера

Seed-файл містить заглушку bcrypt-хешу, тому адмін `mike.johnson@example.com` за замовчуванням не може залогінитись.
Виконай один раз після `yarn seed`:

```bash
# Згенерувати справжній хеш для 'password123'
HASH=$(docker compose exec api node -e "const b=require('bcrypt');b.hash('password123',10).then(h=>process.stdout.write(h))")

# Оновити пароль в БД (підстав свої DB_USERNAME та DB_NAME з .env)
docker compose exec postgres psql -U <DB_USERNAME> -d <DB_NAME> \
  -c "UPDATE users SET password = '$HASH' WHERE email = 'mike.johnson@example.com';"
```

> Значення `DB_USERNAME` та `DB_NAME` беруться з файлу `nest-shop-api/.env`.

---

## Встановлення залежностей

```bash
cd nest-shop-tests
yarn install
```

---

## Налаштування

Скопіюй `.env.example` у `.env`:

```bash
cp .env.example .env
```

За замовчуванням:
```
API_URL=http://localhost:8080
ADMIN_EMAIL=mike.johnson@example.com
ADMIN_PASSWORD=password123
```

> Якщо твій API піднято на іншому порту — зміни `API_URL` у `.env`.
> Порт хоста визначається змінною `API_PORT` у `nest-shop-api/.env` (за замовчуванням `8080`).

---

## Запуск тестів

```bash
# Запустити всі тести (один раз)
yarn test

# Watch-режим (перезапуск при зміні файлів)
yarn test:watch

# UI у браузері
yarn test:ui
```

### Очікуваний результат

```
 ✓ src/tests/products.test.ts   (8 tests)
 ✓ src/tests/files.test.ts      (6 tests)
 ✓ src/tests/graphql.test.ts    (5 tests)
 ✓ src/tests/users.test.ts     (10 tests)
 ✓ src/tests/orders.test.ts    (14 tests)
 ✓ src/tests/auth.test.ts      (11 tests)

 Test Files  6 passed (6)
      Tests  54 passed (54)
```

---

## Структура проєкту

```
src/
├── setup.ts               # завантаження .env перед тестами
├── helpers/
│   ├── client.ts          # axios-інстанс, authed(), gqlEndpoint
│   ├── auth.ts            # register / login / registerAndLogin / adminLogin
│   └── poll.ts            # waitFor() — polling для async-сценаріїв
└── tests/
    ├── auth.test.ts
    ├── products.test.ts
    ├── users.test.ts
    ├── orders.test.ts
    ├── files.test.ts
    └── graphql.test.ts
```

---

## Нотатки

- Тести **не є ізольованими** — вони пишуть реальні дані у БД (продукти, юзери, замовлення). Після запуску в БД залишаться тестові записи.
- `orders.test.ts` містить async-тест: створює замовлення і чекає до **10 секунд**, поки RabbitMQ-воркер переведе статус у `processed`. Якщо воркер не запущено — тест впаде по таймауту.
- `files.test.ts` перевіряє тільки auth-шар (401/400). Якщо S3 не налаштовано, presign повертає 500 — це очікувана поведінка, тест це враховує.
