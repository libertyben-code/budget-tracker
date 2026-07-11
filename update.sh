#!/bin/sh
set -e
cd "$(dirname "$0")"
[ -f data/budget.db ] && cp data/budget.db "data/backup-$(date +%Y%m%d-%H%M%S).db"
git pull --ff-only
docker compose up -d --build
docker image prune -f
