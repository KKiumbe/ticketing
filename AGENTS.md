# Agent instructions

Multi-app workspace: `api/` (Express + Prisma), `web/` (Next.js), `mobile/` (Expo, see `mobile/AGENTS.md`). `sikika-tickets/` is the legacy v1. Don't edit it.

- api layout: `routes/ → controllers/ (zod parse) → services/ (logic) → lib/`. Errors: throw `AppError`; responses are `{ message }`.
- Pricing rules live in `api/src/lib/pricing.ts` (unit-tested). `web/lib/pricing.ts` and `mobile/src/screens/SellScreen.tsx` mirror the fee formula for display. Keep them in sync.
- DB table/column names must stay compatible with v1 (`@@map`/`@map`). Statuses are strings, see `api/src/lib/types.ts`.
- Seat/early-bird races are prevented with `SELECT … FOR UPDATE` on the category row; payment crediting goes through `applyPayment` in a transaction and must stay idempotent (Safaricom retries callbacks).
- Never let dev/test scripts call Daraja for real: keep `MPESA_SIMULATE=true` locally.
- Validate after edits: api `npm run lint && npm test`; web `npm run lint`; mobile `npm run lint`.
