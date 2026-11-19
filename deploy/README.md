# Deploying to the live server

One domain, **tickets.sikika-ke.co.ke**. nginx sends `/api/v1/*` to the API (:4000) and everything else to Next.js (:3000).

## First time
1. **DNS**: A record `tickets.sikika-ke.co.ke` → server IP.
2. **Database** (the password is the one in `DATABASE_URL` in `api/.env.production`):
   ```bash
   sudo -u postgres psql -c "CREATE USER tickets WITH PASSWORD '<password from DATABASE_URL>';"
   sudo -u postgres createdb -O tickets sikika_tickets
   ```
   **Already running v1 on this server with real orders?** Skip creating the DB. Point `DATABASE_URL` at the v1 database, then before the first deploy run
   `cd api && npm ci && npx prisma migrate resolve --applied 0_init`. Don't seed in that case.
3. **Code + env**: copy the repo to the server (e.g. `/var/www/sikika-tickets`), then copy the env file from your laptop:
   ```bash
   scp api/.env.production server:/var/www/sikika-tickets/api/.env
   ```
   `web/.env.production` is already in the repo copy (no secrets).
4. **Deploy**: `./deploy.sh`, then seed once on a fresh DB: `cd api && npm run db:seed`.
5. **nginx + HTTPS**: copy `deploy/nginx-tickets.conf` to `/etc/nginx/sites-available/tickets.sikika-ke.co.ke`, enable it, `nginx -t && systemctl reload nginx`, then `certbot --nginx -d tickets.sikika-ke.co.ke`.
6. `pm2 startup` once so the apps come back after a reboot.

## Test STK push on live (KES 1)
1. Admin → Ticket categories → **+ Add ticket category**: name "STK test", price **1**, capacity 5. (The 2.5% fee rounds to 0, so the total is KES 1.)
2. Open https://tickets.sikika-ke.co.ke, choose "STK test", enter your number and pay. Enter your PIN on the phone.
3. The order page turns **PAID** when the callback arrives (seconds). If it doesn't, the page asks Safaricom directly after ~35s.
4. Watch it server-side: `pm2 logs tickets-api` (look for `[notify]`), or check Admin → Orders.
5. Then close "STK test" (untick *Online sales open*), or cancel the test order.

**If the prompt never shows on the phone**, check `pm2 logs tickets-api` for the `M-Pesa:` error message. Common ones:
- wrong passkey: "Invalid Access Token" / "Bad Request - Invalid PassKey"
- STK not enabled on the paybill: ask Safaricom to enable Lipa na M-Pesa Online for 4091081

## Paybill top-ups (optional, once)
Admin → Unmatched payments → **Register Paybill confirmation URLs**. Do this only if 4091081 isn't already sending C2B confirmations to another system: Safaricom keeps one set of URLs per shortcode, so registering here replaces the existing ones.

## Updates
`./deploy.sh` (pulls, migrates, builds, reloads pm2).

## Gate app build
`cd mobile && eas build --profile production` (uses `https://tickets.sikika-ke.co.ke/api/v1` from `eas.json`). Staff sign in with `SCANNER_PIN` from `api/.env`.
