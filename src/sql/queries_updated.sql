-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
-- Updated queries for new schema

### 1) Active competitors tracked

```sql
SELECT COUNT(*) AS active_competitors
FROM competitors
WHERE user_id = :user_id;
```

### 2) Sources coverage (enabled vs disabled by competitor)

```sql
SELECT c.competitor_id AS competitor_id,
       c.name,
       COUNT(s.id) FILTER (WHERE s.enabled)   AS sources_enabled,
       COUNT(s.id) FILTER (WHERE NOT s.enabled OR s.enabled IS NULL) AS sources_disabled
FROM competitors c
LEFT JOIN sources s ON s.competitor_id = c.competitor_id
WHERE c.user_id = :user_id
GROUP BY c.competitor_id, c.name
ORDER BY c.name;
```

### 3) Posts analyzed (in period)

```sql
SELECT COUNT(*) AS posts_analyzed
FROM analyzed_posts ap
WHERE ap.user_id = :user_id
  AND ap.analyzed_at >= :start_date
  AND ap.analyzed_at <  :end_date;
```

---

# 🗣 Mentions & Sentiment
# Note: Sentiment analysis fields removed from analyzed_posts table

### 4) Mentions trend (daily)

```sql
SELECT date_trunc('day', ap.analyzed_at)::date AS day,
       COUNT(*) AS mentions
FROM analyzed_posts ap
WHERE ap.user_id = :user_id
  AND ap.analyzed_at >= :start_date
  AND ap.analyzed_at <  :end_date
GROUP BY 1
ORDER BY 1;
```

### 5) Competitor mentions distribution

```sql
SELECT c.competitor_id AS competitor_id,
       c.name,
       COUNT(*) AS mentions
FROM analyzed_posts ap
JOIN competitors c ON c.competitor_id = ap.competitor_id
WHERE ap.user_id = :user_id
  AND ap.analyzed_at >= :start_date
  AND ap.analyzed_at <  :end_date
GROUP BY c.competitor_id, c.name
ORDER BY c.name;
```

### 6) Share of voice (mentions by competitor)

```sql
WITH tot AS (
  SELECT COUNT(*) AS total_mentions
  FROM analyzed_posts
  WHERE user_id = :user_id
    AND analyzed_at >= :start_date AND analyzed_at < :end_date
)
SELECT c.competitor_id AS competitor_id,
       c.name,
       COUNT(ap.id) AS mentions,
       ROUND(100.0 * COUNT(ap.id) / NULLIF(t.total_mentions,0), 2) AS share_of_voice_pct
FROM competitors c
LEFT JOIN analyzed_posts ap
       ON ap.competitor_id = c.competitor_id
      AND ap.user_id = :user_id
      AND ap.analyzed_at >= :start_date AND ap.analyzed_at < :end_date
CROSS JOIN tot t
WHERE c.user_id = :user_id
GROUP BY c.competitor_id, c.name, t.total_mentions
ORDER BY mentions DESC;
```

---

# 🔎 Complaints & Pain Points

### 7) Top complaints (current snapshot)

```sql
SELECT canonical,
       COUNT(*) AS mentions
FROM complaints comp
JOIN competitors c ON c.competitor_id = comp.competitor_id
WHERE c.user_id = :user_id
GROUP BY canonical
ORDER BY mentions DESC
LIMIT 20;
```

### 8) Complaint trend over time

```sql
SELECT date_trunc('day', comp.last_updated)::date AS day,
       COUNT(*) AS complaints
FROM complaints comp
JOIN competitors c ON c.competitor_id = comp.competitor_id
WHERE c.user_id = :user_id
  AND comp.last_updated >= :start_date
  AND comp.last_updated <  :end_date
GROUP BY 1
ORDER BY 1;
```

---

# 🔄 Alternatives & Switching

### 9) Top alternatives (current)

```sql
SELECT a.name AS alternative,
       SUM(a.mentions_count) AS mentions
FROM alternatives a
JOIN competitors c ON c.competitor_id = a.competitor_id
WHERE c.user_id = :user_id
GROUP BY a.name
ORDER BY mentions DESC
LIMIT 20;
```

### 10) Alternatives trend (by day, via last_updated snapshots)

```sql
SELECT date_trunc('day', a.last_updated)::date AS day,
       a.name AS alternative,
       SUM(a.mentions_count) AS mentions
FROM alternatives a
JOIN competitors c ON c.competitor_id = a.competitor_id
WHERE c.user_id = :user_id
  AND a.last_updated >= :start_date
  AND a.last_updated <  :end_date
GROUP BY 1, 2
ORDER BY 1, 3 DESC;
```

---

# 👥 Leads & Funnel

### 11) Leads over time (daily)

```sql
SELECT date_trunc('day', l.created_at)::date AS day,
       COUNT(*) AS leads
FROM leads l
WHERE l.user_id = :user_id
  AND l.created_at >= :start_date
  AND l.created_at <  :end_date
GROUP BY 1
ORDER BY 1;
```

### 12) Lead status funnel (current)

```sql
SELECT l.status,
       COUNT(*) AS cnt
FROM leads l
WHERE l.user_id = :user_id
GROUP BY l.status
ORDER BY cnt DESC;
```

### 13) Lead source breakdown (platform)

```sql
SELECT l.platform,
       COUNT(*) AS cnt
FROM leads l
WHERE l.user_id = :user_id
  AND l.created_at >= :start_date
  AND l.created_at <  :end_date
GROUP BY l.platform
ORDER BY cnt DESC;
```

### 14) Recent leads table

```sql
SELECT l.platform,
       l.username,
       l.excerpt,
       l.reason,
       l.created_at::date AS date,
       l.status
FROM leads l
WHERE l.user_id = :user_id
  AND l.created_at >= :start_date
  AND l.created_at <  :end_date
ORDER BY l.created_at DESC
LIMIT 50;
```

---

# 🚦 Operational

### 15) Job success vs failures

```sql
SELECT jl.status, COUNT(*) AS cnt
FROM job_logs jl
WHERE jl.triggered_at >= :start_date
  AND jl.triggered_at <  :end_date
GROUP BY jl.status;
```

### 16) Avg job duration seconds

```sql
SELECT AVG(EXTRACT(EPOCH FROM (jl.completed_at - jl.triggered_at))) AS avg_duration_sec
FROM job_logs jl
WHERE jl.completed_at IS NOT NULL
  AND jl.triggered_at >= :start_date
  AND jl.triggered_at <  :end_date;
```

---

# 🧭 Scraping Freshness

### 17) Last scraped per competitor & platform

```sql
SELECT c.name AS competitor,
       s.platform,
       s.enabled,
       s.last_scraped_at
FROM competitors c
LEFT JOIN sources s ON s.competitor_id = c.competitor_id
WHERE c.user_id = :user_id
ORDER BY c.name, s.platform;
```

---

# 🧮 KPI Cards (current vs previous period)

### 18) Total Mentions: current, previous, % change

```sql
WITH this AS (
  SELECT COUNT(*) AS v
  FROM analyzed_posts
  WHERE user_id = :user_id
    AND analyzed_at >= :start_date AND analyzed_at < :end_date
),
prev AS (
  SELECT COUNT(*) AS v
  FROM analyzed_posts
  WHERE user_id = :user_id
    AND analyzed_at >= (:start_date - (:end_date - :start_date))
    AND analyzed_at <  :start_date
)
SELECT this.v AS current_value,
       prev.v AS previous_value,
       CASE WHEN prev.v = 0 THEN NULL
            ELSE ROUND(100.0 * (this.v - prev.v) / prev.v, 2) END AS pct_change
FROM this, prev;
```

### 19) Recurring Complaints: current vs previous

```sql
WITH this AS (
  SELECT COUNT(*) AS v
  FROM complaints comp
  JOIN competitors c ON c.competitor_id = comp.competitor_id
  WHERE c.user_id = :user_id
    AND comp.last_updated >= :start_date AND comp.last_updated < :end_date
),
prev AS (
  SELECT COUNT(*) AS v
  FROM complaints comp
  JOIN competitors c ON c.competitor_id = comp.competitor_id
  WHERE c.user_id = :user_id
    AND comp.last_updated >= (:start_date - (:end_date - :start_date))
    AND comp.last_updated <  :start_date
)
SELECT this.v AS current_value,
       prev.v AS previous_value,
       CASE WHEN prev.v = 0 THEN NULL
            ELSE ROUND(100.0 * (this.v - prev.v) / prev.v, 2) END AS pct_change
FROM this, prev;
```

### 20) Alternatives Mentioned: current vs previous

```sql
WITH this AS (
  SELECT COALESCE(SUM(a.mentions_count),0) AS v
  FROM alternatives a
  JOIN competitors c ON c.competitor_id = a.competitor_id
  WHERE c.user_id = :user_id
    AND a.last_updated >= :start_date AND a.last_updated < :end_date
),
prev AS (
  SELECT COALESCE(SUM(a.mentions_count),0) AS v
  FROM alternatives a
  JOIN competitors c ON c.competitor_id = a.competitor_id
  WHERE c.user_id = :user_id
    AND a.last_updated >= (:start_date - (:end_date - :start_date))
    AND a.last_updated <  :start_date
)
SELECT this.v AS current_value,
       prev.v AS previous_value,
       CASE WHEN prev.v = 0 THEN NULL
            ELSE ROUND(100.0 * (this.v - prev.v) / prev.v, 2) END AS pct_change
FROM this, prev;
```

---

# 🔍 Drill-down Tables

### 21) Recent mentions (sample from analyzed_posts)

```sql
SELECT ap.analyzed_at::timestamp AS analyzed_at,
       c.name AS competitor,
       ap.excerpt,
       ap.platform
FROM analyzed_posts ap
LEFT JOIN competitors c ON c.competitor_id = ap.competitor_id
WHERE ap.user_id = :user_id
  AND ap.analyzed_at >= :start_date
  AND ap.analyzed_at <  :end_date
ORDER BY ap.analyzed_at DESC
LIMIT 100;
```

### 22) Alternatives by competitor

```sql
SELECT c.name AS competitor,
       a.name  AS alternative,
       SUM(a.mentions_count) AS mentions
FROM alternatives a
JOIN competitors c ON c.competitor_id = a.competitor_id
WHERE c.user_id = :user_id
GROUP BY c.name, a.name
ORDER BY c.name, mentions DESC;
```

---

## Notes / Changes made for new schema

* **Updated competitors table references**: Changed from `competitors.id` to `competitors.competitor_id`
* **Removed sentiment analysis queries**: The analyzed_posts table no longer has `sentiment`, `switch_intent`, `cluster`, `summary`, or `alternatives` fields
* **Removed complaint_clusters references**: This table doesn't exist in the new schema
* **Updated foreign key references**: All joins now use the correct primary/foreign key relationships
* **Simplified queries**: Removed queries that relied on fields not present in the new schema

---

Want these wrapped as **views** (`CREATE VIEW ...`) with consistent column names and date parameters, or turned into a **dbt** model set?