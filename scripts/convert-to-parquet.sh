#!/bin/bash
# scripts/convert-to-parquet.sh
#
# Convert the FRED CSV exports into a DuckDB-ready parquet bundle:
#   data/fred/parquet/observations.parquet
#   data/fred/parquet/series.parquet
#   data/fred/parquet/categories.parquet
#   data/fred/parquet/releases.parquet
#   data/fred/parquet/sources.parquet
#   data/fred/parquet/tags.parquet
#
# Also creates data/fred/fred.duckdb with all tables pre-loaded.

set -euo pipefail

cd "$(dirname "$0")/.."

DATA=data/fred
PARQUET_DIR=$DATA/parquet
DB_FILE=$DATA/fred.duckdb

if ! command -v duckdb >/dev/null 2>&1; then
  echo "ERROR: duckdb CLI not found in PATH."
  exit 1
fi

mkdir -p "$PARQUET_DIR"

# Verify all CSV exports exist
for f in observations series_metadata categories releases sources tags; do
  if [ ! -f "$DATA/export/$f.csv" ]; then
    echo "ERROR: $DATA/export/$f.csv missing."
    exit 1
  fi
done

# Remove any prior db so we start fresh and idempotent
rm -f "$DB_FILE"

echo "=== Creating parquet bundle + DuckDB database ==="

duckdb "$DB_FILE" <<SQL
.print '-- observations (long format, 147M rows) --'
CREATE TABLE observations AS
SELECT
  series_id,
  CAST(date AS DATE) AS date,
  TRY_CAST(value AS DOUBLE) AS value
FROM read_csv_auto('$DATA/export/observations.csv', header=true, all_varchar=true)
ORDER BY series_id, date;

COPY observations TO '$PARQUET_DIR/observations.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);
SELECT COUNT(*) AS observations FROM observations;

.print '-- series (metadata, ~840K rows) --'
CREATE TABLE series AS
SELECT
  id,
  title,
  frequency,
  frequency_short,
  units,
  units_short,
  seasonal_adjustment,
  seasonal_adjustment_short,
  TRY_CAST(observation_start AS DATE) AS observation_start,
  TRY_CAST(observation_end AS DATE) AS observation_end,
  last_updated,
  TRY_CAST(popularity AS INTEGER) AS popularity,
  TRY_CAST(group_popularity AS INTEGER) AS group_popularity,
  notes,
  CAST(from_json(release_ids_json, '["INTEGER"]') AS INTEGER[]) AS release_ids,
  CAST(from_json(category_ids_json, '["INTEGER"]') AS INTEGER[]) AS category_ids,
  CAST(from_json(tags_json, '["VARCHAR"]') AS VARCHAR[]) AS tags,
  TRY_CAST(observation_count AS INTEGER) AS observation_count,
  observations_source
FROM read_csv_auto('$DATA/export/series_metadata.csv', header=true, all_varchar=true);

COPY series TO '$PARQUET_DIR/series.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);
SELECT COUNT(*) AS series FROM series;

.print '-- categories (5,186 rows) --'
CREATE TABLE categories AS
SELECT
  CAST(id AS INTEGER) AS id,
  name,
  TRY_CAST(parent_id AS INTEGER) AS parent_id,
  notes
FROM read_csv_auto('$DATA/export/categories.csv', header=true, all_varchar=true);

COPY categories TO '$PARQUET_DIR/categories.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);
SELECT COUNT(*) AS categories FROM categories;

.print '-- releases (324 rows) --'
CREATE TABLE releases AS
SELECT
  CAST(id AS INTEGER) AS id,
  name,
  press_release,
  link,
  notes
FROM read_csv_auto('$DATA/export/releases.csv', header=true, all_varchar=true);

COPY releases TO '$PARQUET_DIR/releases.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);
SELECT COUNT(*) AS releases FROM releases;

.print '-- sources (119 rows) --'
CREATE TABLE sources AS
SELECT
  CAST(id AS INTEGER) AS id,
  name,
  link,
  notes
FROM read_csv_auto('$DATA/export/sources.csv', header=true, all_varchar=true);

COPY sources TO '$PARQUET_DIR/sources.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);
SELECT COUNT(*) AS sources FROM sources;

.print '-- tags (5,954 rows) --'
CREATE TABLE tags AS
SELECT
  name,
  group_id,
  notes,
  TRY_CAST(popularity AS INTEGER) AS popularity,
  TRY_CAST(series_count AS INTEGER) AS series_count,
  created
FROM read_csv_auto('$DATA/export/tags.csv', header=true, all_varchar=true);

COPY tags TO '$PARQUET_DIR/tags.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);
SELECT COUNT(*) AS tags FROM tags;

.print '-- Creating index on observations.series_id --'
CREATE INDEX idx_obs_series ON observations (series_id);

.print '-- Table sizes --'
SELECT 'observations' AS tbl, COUNT(*) AS rows FROM observations
UNION ALL SELECT 'series', COUNT(*) FROM series
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'releases', COUNT(*) FROM releases
UNION ALL SELECT 'sources', COUNT(*) FROM sources
UNION ALL SELECT 'tags', COUNT(*) FROM tags
ORDER BY rows DESC;

.print ''
.print '-- UNRATE sanity check --'
SELECT COUNT(*) AS obs_count,
       MIN(date) AS first_date,
       MAX(date) AS last_date
FROM observations
WHERE series_id = 'UNRATE';

SELECT date, value FROM observations
WHERE series_id = 'UNRATE'
ORDER BY date DESC
LIMIT 5;

.print ''
.print '-- GDP sanity check --'
SELECT date, value FROM observations
WHERE series_id = 'GDPC1'
ORDER BY date DESC
LIMIT 5;
SQL

echo ""
echo "=== DONE ==="
du -sh "$DB_FILE" "$PARQUET_DIR"
echo ""
echo "Try it: duckdb $DB_FILE"
