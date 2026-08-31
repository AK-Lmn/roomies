#!/bin/sh
# Roomies — startup script. Restarts dev server if not already healthy.
set -e

if curl -sf http://127.0.0.1:8080/ > /dev/null 2>&1; then
  echo "[startup] Dev server already healthy on :8080"
  exit 0
fi

echo "[startup] Starting dev server..."
cd /workspace
npm run dev > /tmp/dev.log 2>&1 &
echo "[startup] Dev server launched (pid $!)"
