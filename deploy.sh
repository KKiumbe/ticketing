#!/bin/bash
# Run on the server from the repo root: ./deploy.sh
set -e
cd "$(dirname "$0")"

if [ -d .git ]; then
  echo "==> Pulling latest code..."
  git pull origin main
fi

echo "==> API: install, migrate, build..."
cd api
test -f .env || { echo "api/.env missing (copy api/.env.production from your laptop)"; exit 1; }
grep -q '^MPESA_SIMULATE=false' .env || { echo "api/.env must have MPESA_SIMULATE=false in production"; exit 1; }
npm ci
npx prisma migrate deploy
npm run build
cd ..

echo "==> Web: install, build..."
cd web
npm ci
npm run build
cd ..

echo "==> Restarting..."
pm2 startOrReload ecosystem.config.js
pm2 save

sleep 2
curl -fsS http://127.0.0.1:4000/health && echo
echo "Deploy complete. Site: https://tickets.sikika-ke.co.ke"
