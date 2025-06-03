#!/bin/bash

export PG_HOST=127.0.0.1
export PG_PORT=5432
export PG_USER=postgres
export PG_PASSWORD=pgpg5432
export PG_DATABASE=ganymede_db

# Create backup directory if it doesn't exist
mkdir -p "$(dirname "$0")/../data"

# Get current date in YY-MM-DD format (UTC)
DATE=$(date -u +"%y-%m-%d")

# Set output file path
BACKUP_PATH="$(dirname "$0")/../data/db-$DATE.sql"

# Export the database
PGPASSWORD="$PG_PASSWORD" pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -F p -f "$BACKUP_PATH"

if [ $? -eq 0 ]; then
  echo "Backup successful: $BACKUP_PATH"
else
  echo "Backup failed!"
  exit 1
fi

# Dry run mode by default; use --delete to actually remove files
DRY_RUN=1
if [ "$1" == "--delete" ]; then
  DRY_RUN=0
fi

# New cleanup logic: keep only the latest file per day based on filename timestamp (UTC)
DATA_DIR="$(dirname "$0")/../data"
for project_dir in "$DATA_DIR"/*/; do
  [ -d "$project_dir" ] || continue

  echo "Cleaning up $project_dir"

  declare -A latest_file_for_day
  declare -A latest_ts_for_day
  # First pass: find the latest file per day
  for file in "$project_dir"/*; do
    [ -f "$file" ] || continue
    fname=$(basename "$file")
    # Extract timestamp from filename (assume it's the part before .json)
    ts=${fname%%.*}
    # Validate timestamp is all digits
    if [[ ! $ts =~ ^[0-9]+$ ]]; then
      continue
    fi
    # Convert timestamp to day in UTC
    day=$(date -u -d @${ts:0:10} +%Y-%m-%d 2>/dev/null)
    # If conversion fails, skip
    if [ -z "$day" ]; then
      continue
    fi
    # If this is the first file for the day or newer than the previous
    if [ -z "${latest_ts_for_day[$day]}" ] || [ "$ts" -gt "${latest_ts_for_day[$day]}" ]; then
      latest_ts_for_day[$day]="$ts"
      latest_file_for_day[$day]="$file"
    fi
  done
  # Print kept files
  for day in "${!latest_file_for_day[@]}"; do
    keep_file="${latest_file_for_day[$day]}"
    keep_ts="${latest_ts_for_day[$day]}"
    keep_ctime_fmt=$(date -u -d @${keep_ts:0:10} '+%Y-%m-%d %H:%M:%S UTC')
    echo "[KEEP] $keep_file (from timestamp: $keep_ctime_fmt)"
  done
  # Second pass: delete other files if not dry run
  if [ $DRY_RUN -eq 0 ]; then
    now_utc=$(date -u +%s)
    for file in "$project_dir"/*; do
      [ -f "$file" ] || continue
      fname=$(basename "$file")
      ts=${fname%%.*}
      if [[ ! $ts =~ ^[0-9]+$ ]]; then
        continue
      fi
      # Only use the first 10 digits for seconds
      ts_sec=${ts:0:10}
      # If timestamp is in the future or within the last 24 hours, skip deletion
      if [ "$ts_sec" -ge "$now_utc" ] || [ $((now_utc - ts_sec)) -lt 86400 ]; then
        continue
      fi
      day=$(date -u -d @${ts_sec} +%Y-%m-%d 2>/dev/null)
      if [ -z "$day" ]; then
        continue
      fi
      # If this file is not the latest for the day, delete it
      if [ "$file" != "${latest_file_for_day[$day]}" ]; then
        rm -f "$file"
      fi
    done
  fi
  unset latest_file_for_day
  unset latest_ts_for_day
done

# Archive the data directory
ARCHIVE_PATH="/home/ubuntu/backup-$DATE.tar.bz2"
tar -cjf "$ARCHIVE_PATH" -C "$(dirname "$0")/.." data

if [ $? -eq 0 ]; then
  echo "Archive created: $ARCHIVE_PATH"
else
  echo "Archive creation failed!"
  exit 1
fi

