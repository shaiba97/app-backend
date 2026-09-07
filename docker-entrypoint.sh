#!/bin/bash
set -e

export NGINX_PORT="${PORT:-8080}"

envsubst '${NGINX_PORT}' < /etc/nginx/conf.d/default.conf > /tmp/default.conf
cat /tmp/default.conf > /etc/nginx/conf.d/default.conf

nginx

node scripts/migrate-with-retry.js

# Direct fallback: ensure PlatformFee.label column exists (bypasses Prisma migration system)
node scripts/fix_production_db.js || true

node dist/apps/admin/main &
node dist/apps/company/main &
node dist/apps/customer/main &

wait -n
