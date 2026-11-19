# Sikika Tickets v2

Event ticketing for Sikika events (first one: **Business Meets Tech, 4 Dec 2026**).

| App | Stack | What it does |
|---|---|---|
| `api/` | Node + Express + TypeScript, Prisma/Postgres, zod | Pricing, orders, M-Pesa (Daraja STK + Paybill C2B), tickets, gate check-in, admin API |
| `web/` | Next.js (app router) | Buyer checkout `/e/:slug`, order `/o/:ref`, ticket QR `/t/:code`, admin `/admin` |
| `mobile/` | Expo (SDK 58) | Gate app: QR scanner and walk-in sales. Kept outside this repo |

`sikika-tickets/` is the old v1 (single Express app + HTML). v2 uses **the same database tables**, so you can point v2 at the v1 database (see "Upgrading from v1").

## Run locally
```bash
# 1. API (port 4000)
cd api && cp .env.example .env     # set DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD, SCANNER_PIN, MPESA_SIMULATE=true
npm install && npx prisma migrate deploy && npm run db:seed
npm run dev

# 2. Web (port 3000)
cd web && cp .env.example .env.local && npm install && npm run dev

# 3. Gate app
cd mobile && cp .env.example .env  # your computer's LAN IP, e.g. http://192.168.1.10:4000/api/v1
npm install && npx expo start      # scan the QR with Expo Go (or build a dev client)
```
With `MPESA_SIMULATE=true` no request goes to Safaricom. The order page (web) and the Sell screen (mobile) show **Simulate PIN entered / Simulate cancel** buttons for pending payments.

Checks: `api`: `npm run lint && npm test` · `web`: `npm run lint && npm run build` · `mobile`: `npm run lint`

## Auth
- **Admin web**: `ADMIN_PASSWORD` → 12h JWT in an httpOnly cookie. All admin calls are made server-side.
- **Gate app**: `SCANNER_PIN` + gate name → 18h JWT (scan + sell only, no admin). Login attempts are rate-limited (10 per 15 min per IP).

## Deploy (VPS)
- API behind Nginx with HTTPS, e.g. `api.tickets.sikika-ke.co.ke` → `localhost:4000`. Set `API_PUBLIC_URL` to that (Daraja callbacks need HTTPS) and `WEB_BASE_URL` to the site. `npm ci && npx prisma migrate deploy && npm run build && pm2 start dist/main.js --name tickets-api`
- Web: `tickets.sikika-ke.co.ke` → `localhost:3000`, `API_BASE_URL=http://localhost:4000/api/v1`. `npm ci && npm run build && pm2 start npm --name tickets-web -- start`
- Mobile: `eas build` with `EXPO_PUBLIC_API_BASE_URL=https://api.tickets.sikika-ke.co.ke/api/v1`.

## Upgrading from v1
The Prisma schema maps 1:1 onto the v1 tables (verified: `prisma migrate diff` from a v1 database is empty). Point `DATABASE_URL` at the v1 database and mark the baseline as applied instead of running it:
```bash
cd api && npx prisma migrate resolve --applied 0_init
```
Ticket links already sent by v1 (`/t/<code>`, `/o/<ref>`) keep working if the web app serves the same domain.

## M-Pesa
Same flow as v1. Callback URLs are `API_PUBLIC_URL/api/v1/pay/...` (they deliberately avoid the word "mpesa"). If an STK callback never arrives, the order page asks Safaricom directly after ~35s (STK Query). Paybill top-ups (account no. = order ref) credit orders once you click **Register Paybill confirmation URLs** in Admin → Unmatched payments.
