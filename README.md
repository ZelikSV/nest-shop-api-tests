# nest-shop-api-tests

End-to-end integration tests for [nest-shop-api](https://github.com/ZelikSV/nest-shop-api).

**Stack:** Vitest · axios · TypeScript
**Target:** live API at `http://localhost:8080` (configurable via `.env`)

Each test file registers a dedicated user (or reuses the seeded admin), runs assertions against the real server, and **cleans up all created records** in `afterAll`.

---

## Coverage

| File | Routes |
|------|--------|
| `auth.test.ts` | `POST /auth/register` · `POST /auth/login` · `GET /auth/profile` |
| `products.test.ts` | `GET /POST /PUT /DELETE /products` — no auth required |
| `users.test.ts` | `GET /POST /PUT /DELETE /users` — admin only |
| `orders.test.ts` | `POST /orders` · `GET /orders/user/:id` · `GET /orders/:id` · `GET /orders/:id/public` · RabbitMQ async poll |
| `files.test.ts` | `POST /files/presign` · `POST /files/complete` |
| `graphql.test.ts` | `query orders` — filter · pagination · error handling |

---

## Prerequisites

### 1. Node.js and yarn

```bash
node -v   # 18+
yarn -v   # 1.22+
```

### 2. Running nest-shop-api

From the `nest-shop-api` directory, start all services:

```bash
docker compose -f compose.yml -f compose.dev.yml up --build -d
```

Wait ~15 s, then run migrations and seed:

```bash
docker compose exec api yarn migration:run
docker compose exec api yarn seed
```

Verify the API is responding:

```bash
curl http://localhost:8080/api/v1/products   # should return a JSON array
```

> The host port is controlled by `API_PORT` in `nest-shop-api/.env` (default `8080`).

### 3. Fix the admin password (one-time)

The seed script stores a placeholder bcrypt hash, so `mike.johnson@example.com` cannot log in until you replace it with a real one. Run this once after seeding:

```bash
# Read DB credentials from nest-shop-api/.env
DB_USER=<DB_USERNAME>
DB_NAME=<DB_NAME>

HASH=$(docker compose exec api node -e \
  "require('bcrypt').hash('password123', 10).then(h => process.stdout.write(h))")

docker compose exec postgres psql -U "$DB_USER" -d "$DB_NAME" \
  -c "UPDATE users SET password = '$HASH' WHERE email = 'mike.johnson@example.com';"
```

Verify:

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mike.johnson@example.com","password":"password123"}'
# should return { "accessToken": "..." }
```

---

## Setup

```bash
cd nest-shop-tests
yarn install
cp .env.example .env
```

`.env` defaults:

```
API_URL=http://localhost:8080
ADMIN_EMAIL=mike.johnson@example.com
ADMIN_PASSWORD=password123
```

Change `API_URL` if your API runs on a different port.

---

## Running tests

```bash
# Run all tests once
yarn test

# Watch mode — re-runs on file changes
yarn test:watch

# Visual UI in the browser
yarn test:ui
```

### Expected output

```
 ✓ src/tests/products.test.ts    8 tests
 ✓ src/tests/files.test.ts       6 tests
 ✓ src/tests/graphql.test.ts     5 tests
 ✓ src/tests/users.test.ts      10 tests
 ✓ src/tests/orders.test.ts     14 tests
 ✓ src/tests/auth.test.ts       11 tests

 Test Files  6 passed (6)
      Tests  54 passed (54)
```

---

## Project structure

```
src/
├── setup.ts               # loads .env before tests
├── helpers/
│   ├── client.ts          # base axios instance · authed() · gqlEndpoint
│   ├── auth.ts            # register · login · registerAndLogin · adminLogin · decodeUserId
│   └── poll.ts            # waitFor() — polling helper for async scenarios
└── tests/
    ├── auth.test.ts
    ├── products.test.ts
    ├── users.test.ts
    ├── orders.test.ts
    ├── files.test.ts
    └── graphql.test.ts
```

---

## Notes

- **Cleanup** — every test file tracks the records it creates and deletes them in `afterAll`. Deleting a user cascades to their orders and order items.
- **RabbitMQ** — `orders.test.ts` includes an async test that polls `GET /orders/:id/public` for up to 10 s waiting for status `processed`. The test will time out if the worker is not running.
- **S3 / files** — `files.test.ts` only validates the auth layer (401 / 400). If S3 is not configured, `POST /files/presign` returns 500; the test accounts for this and still passes.
- **Test isolation** — tests run sequentially (not in parallel) to avoid race conditions on shared DB state.
