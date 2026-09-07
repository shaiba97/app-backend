#!/bin/bash
set -e

export NGINX_PORT="${PORT:-8080}"
export PRISMA_HIDE_UPDATE_MESSAGE=1

envsubst '${NGINX_PORT}' < /etc/nginx/conf.d/default.conf > /tmp/default.conf
cat /tmp/default.conf > /etc/nginx/conf.d/default.conf

nginx

node scripts/migrate-with-retry.js

# Direct fallback: ensure PlatformFee.label column exists (bypasses Prisma migration system)
node scripts/fix_production_db.js || true

apps=(admin company customer)
pids=()
for app in "${apps[@]}"; do
  echo "[supervisor] starting $app"
  node "dist/apps/$app/main" & pids+=("$!")
done

while true; do
  for i in "${!apps[@]}"; do
    if ! kill -0 "${pids[$i]}" 2>/dev/null; then
      echo "[supervisor] ${apps[$i]} (pid ${pids[$i]}) exited — restarting"
      node "dist/apps/${apps[$i]}/main" & pids[$i]=$!
    fi
  done
  sleep 2
done
