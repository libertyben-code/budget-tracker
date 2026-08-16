#!/bin/sh
set -e

# Defaults to the data folder beside this script — this runs from your own clone of the repo,
# which is where the data folder already lives. Export DATA_DIR if yours sits elsewhere.
HERE=$(cd "$(dirname "$0")" && pwd)
DATA_DIR="${DATA_DIR:-$HERE/data}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$DATA_DIR")/backups}"
KEEP=14

mkdir -p "$BACKUP_DIR"

# .backup, not cp: the DB runs in WAL mode, so budget.db on its own is missing every
# write still sitting in budget.db-wal. This is also safe while the container is running.
sqlite3 "$DATA_DIR/budget.db" ".backup '$BACKUP_DIR/budget-$(date +%Y%m%d-%H%M%S).db'"

ls -1t "$BACKUP_DIR"/budget-*.db | tail -n +$((KEEP + 1)) | while read -r old; do rm -- "$old"; done
