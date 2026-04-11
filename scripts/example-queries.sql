-- scripts/example-queries.sql
-- Example DuckDB queries against the FRED dataset.
-- Usage:
--   duckdb data/fred/fred.duckdb
--   .read scripts/example-queries.sql
--
-- Or one-off:
--   duckdb data/fred/fred.duckdb "SELECT ..."

----------------------------------------------------------------------
-- 1. Single series — full history
----------------------------------------------------------------------
-- "Give me every UNRATE observation ever" — the canonical point lookup.
SELECT date, value
FROM observations
WHERE series_id = 'UNRATE'
ORDER BY date;

----------------------------------------------------------------------
-- 2. Multi-line chart — pull several series in one query
----------------------------------------------------------------------
-- Useful for a recession dashboard or "core macro snapshot" widget.
SELECT series_id, date, value
FROM observations
WHERE series_id IN ('UNRATE', 'GDPC1', 'CPIAUCSL', 'DGS10', 'MORTGAGE30US')
  AND date >= '2000-01-01'
ORDER BY series_id, date;

----------------------------------------------------------------------
-- 3. Series metadata — titles, units, frequency, category_ids, tags
----------------------------------------------------------------------
SELECT id, title, frequency, units, popularity, tags
FROM series
WHERE id IN ('UNRATE', 'GDP', 'M2SL', 'CPIAUCSL')
ORDER BY popularity DESC;

----------------------------------------------------------------------
-- 4. Full-text search on title
----------------------------------------------------------------------
-- Find all series whose title mentions "inflation", sorted by popularity
SELECT id, title, popularity, observation_start, observation_end
FROM series
WHERE title ILIKE '%inflation%'
ORDER BY popularity DESC
LIMIT 25;

----------------------------------------------------------------------
-- 5. Browse by category
----------------------------------------------------------------------
-- Top-level categories (children of the root)
SELECT id, name, parent_id
FROM categories
WHERE parent_id IS NULL OR parent_id = 0
ORDER BY id;

-- All series in a specific category (e.g., 12 = Employment)
SELECT s.id, s.title, s.popularity
FROM series s
WHERE list_contains(s.category_ids, 12)
ORDER BY s.popularity DESC
LIMIT 20;

----------------------------------------------------------------------
-- 6. Filter by tags
----------------------------------------------------------------------
-- Monthly, seasonally adjusted US series, most popular first
SELECT id, title, popularity, observation_end
FROM series
WHERE list_contains(tags, 'monthly')
  AND list_contains(tags, 'sa')
  AND list_contains(tags, 'usa')
ORDER BY popularity DESC
LIMIT 20;

----------------------------------------------------------------------
-- 7. Tag frequency — what are the most common tags?
----------------------------------------------------------------------
SELECT t.unnest AS tag, COUNT(*) AS series_with_tag
FROM (SELECT unnest(tags) FROM series) t
GROUP BY tag
ORDER BY series_with_tag DESC
LIMIT 20;

----------------------------------------------------------------------
-- 8. Join observations with series metadata
----------------------------------------------------------------------
-- Latest value of every "most popular" series, labeled with title
SELECT s.id, s.title, o.date, o.value, s.units
FROM series s
JOIN observations o ON o.series_id = s.id
WHERE s.popularity >= 95
  AND o.date = (SELECT MAX(date) FROM observations WHERE series_id = s.id)
ORDER BY s.popularity DESC;

----------------------------------------------------------------------
-- 9. Aggregations — year-over-year change for CPI
----------------------------------------------------------------------
WITH cpi AS (
  SELECT date, value
  FROM observations
  WHERE series_id = 'CPIAUCSL'
)
SELECT
  date,
  value AS cpi,
  LAG(value, 12) OVER (ORDER BY date) AS cpi_year_ago,
  ROUND((value / LAG(value, 12) OVER (ORDER BY date) - 1) * 100, 2) AS yoy_percent
FROM cpi
WHERE date >= '2000-01-01'
ORDER BY date DESC
LIMIT 25;

----------------------------------------------------------------------
-- 10. Correlation — "what series move with UNRATE?"
----------------------------------------------------------------------
-- Simplified: find series whose monthly values correlate with UNRATE > 0.8.
-- (Takes a while on the full dataset — run on a subset first.)
-- WITH unrate AS (
--   SELECT date, value FROM observations WHERE series_id='UNRATE'
-- )
-- SELECT o.series_id, corr(o.value, u.value) AS r
-- FROM observations o JOIN unrate u USING (date)
-- WHERE o.series_id IN (SELECT id FROM series WHERE frequency='Monthly' AND popularity > 50)
-- GROUP BY o.series_id
-- HAVING COUNT(*) > 120
-- ORDER BY r DESC
-- LIMIT 25;
