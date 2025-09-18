### 1) Active competitors tracked

```sql
SELECT COUNT(*) AS active_competitors
FROM competitors
WHERE user_id = :user_id;
```

### 2) Sources coverage (enabled vs disabled by competitor)

```sql
SELECT c.id AS competitor_id,
       c.name,
       COUNT(s.id) FILTER (WHERE s.enabled)   AS sources_enabled,
       COUNT(s.id) FILTER (WHERE NOT s.enabled OR s.enabled IS NULL) AS sources_disabled
FROM competitors c
LEFT JOIN sources s ON s.competitor_id = c.id
WHERE c.user_id = :user_id
GROUP BY c.id, c.name
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

### 5) Sentiment trend (daily stacked)

```sql
SELECT date_trunc('day', ap.analyzed_at)::date AS day,
       ap.sentiment,
       COUNT(*) AS cnt
FROM analyzed_posts ap
WHERE ap.user_id = :user_id
  AND ap.analyzed_at >= :start_date
  AND ap.analyzed_at <  :end_date
GROUP BY 1, 2
ORDER BY 1, 2;
```

### 6) Competitor sentiment distribution

```sql
SELECT c.id AS competitor_id,
       c.name,
       ap.sentiment,
       COUNT(*) AS mentions
FROM analyzed_posts ap
JOIN competitors c ON c.id = ap.competitor_id
WHERE ap.user_id = :user_id
  AND ap.analyzed_at >= :start_date
  AND ap.analyzed_at <  :end_date
GROUP BY c.id, c.name, ap.sentiment
ORDER BY c.name, ap.sentiment;
```

### 7) Share of voice (mentions by competitor)

```sql
WITH tot AS (
  SELECT COUNT(*) AS total_mentions
  FROM analyzed_posts
  WHERE user_id = :user_id
    AND analyzed_at >= :start_date AND analyzed_at < :end_date
)
SELECT c.id AS competitor_id,
       c.name,
       COUNT(ap.id) AS mentions,
       ROUND(100.0 * COUNT(ap.id) / NULLIF(t.total_mentions,0), 2) AS share_of_voice_pct
FROM competitors c
LEFT JOIN analyzed_posts ap
       ON ap.competitor_id = c.id
      AND ap.user_id = :user_id
      AND ap.analyzed_at >= :start_date AND ap.analyzed_at < :end_date
CROSS JOIN tot t
WHERE c.user_id = :user_id
GROUP BY c.id, c.name, t.total_mentions
ORDER BY mentions DESC;
```

### 8) Net sentiment score per competitor

```sql
SELECT c.id AS competitor_id,
       c.name,
       SUM(CASE WHEN ap.sentiment ILIKE 'positive' THEN 1
                WHEN ap.sentiment ILIKE 'negative' THEN -1
                ELSE 0 END)::float
       / NULLIF(COUNT(ap.id),0) AS net_sentiment_score
FROM competitors c
LEFT JOIN analyzed_posts ap
       ON ap.competitor_id = c.id
      AND ap.user_id = :user_id
      AND ap.analyzed_at >= :start_date AND ap.analyzed_at < :end_date
WHERE c.user_id = :user_id
GROUP BY c.id, c.name
ORDER BY net_sentiment_score DESC NULLS LAST;
```

---

# 🔎 Complaints & Pain Points

> Note: `complaint_clusters` is already aggregated (has `frequency` and `last_updated`). These queries treat each row as the current count snapshot or last-updated contribution.

### 9) Top complaints (current snapshot)

```sql
SELECT cluster,
       SUM(frequency) AS mentions
FROM complaint_clusters
WHERE user_id = :user_id
GROUP BY cluster
ORDER BY mentions DESC
LIMIT 20;
```

### 10) Complaint trend over time (by cluster)

```sql
SELECT date_trunc('day', cc.last_updated)::date AS day,
       cc.cluster,
       SUM(cc.frequency) AS mentions
FROM complaint_clusters cc
WHERE cc.user_id = :user_id
  AND cc.last_updated >= :start_date
  AND cc.last_updated <  :end_date
GROUP BY 1, 2
ORDER BY 1, 3 DESC;
```

### 11) Complaint heatmap (competitor × cluster)

```sql
SELECT c.name AS competitor,
       cc.cluster,
       SUM(cc.frequency) AS mentions
FROM complaint_clusters cc
JOIN competitors c ON c.id = cc.competitor_id
WHERE cc.user_id = :user_id
GROUP BY c.name, cc.cluster
ORDER BY c.name, mentions DESC;
```

### 12) “Emerging” complaints (updated recently vs prior window)

```sql
WITH this_window AS (
  SELECT cluster, SUM(frequency) AS f_now
  FROM complaint_clusters
  WHERE user_id = :user_id
    AND last_updated >= :start_date AND last_updated < :end_date
  GROUP BY cluster
),
prev_window AS (
  SELECT cluster, SUM(frequency) AS f_prev
  FROM complaint_clusters
  WHERE user_id = :user_id
    AND last_updated >= (:start_date - (:end_date - :start_date))
    AND last_updated <  :start_date
  GROUP BY cluster
)
SELECT tw.cluster,
       COALESCE(pw.f_prev,0) AS prev,
       tw.f_now AS current,
       CASE WHEN COALESCE(pw.f_prev,0) = 0 AND tw.f_now > 0 THEN 'new'
            WHEN COALESCE(pw.f_prev,0) = 0 THEN 'no-change'
            ELSE ROUND(100.0 * (tw.f_now - pw.f_prev) / NULLIF(pw.f_prev,0), 2)::text END AS pct_change
FROM this_window tw
LEFT JOIN prev_window pw USING (cluster)
ORDER BY (tw.f_now - COALESCE(pw.f_prev,0)) DESC;
```

---

# 🔄 Alternatives & Switching

### 13) Top alternatives (current)

```sql
SELECT a.name AS alternative,
       SUM(a.mentions_count) AS mentions
FROM alternatives a
JOIN competitors c ON c.id = a.competitor_id
WHERE c.user_id = :user_id
GROUP BY a.name
ORDER BY mentions DESC
LIMIT 20;
```

### 14) Alternatives trend (by day, via last\_updated snapshots)

```sql
SELECT date_trunc('day', a.last_updated)::date AS day,
       a.name AS alternative,
       SUM(a.mentions_count) AS mentions
FROM alternatives a
JOIN competitors c ON c.id = a.competitor_id
WHERE c.user_id = :user_id
  AND a.last_updated >= :start_date
  AND a.last_updated <  :end_date
GROUP BY 1, 2
ORDER BY 1, 3 DESC;
```

### 15) Switching intent trend (daily)

```sql
SELECT date_trunc('day', ap.analyzed_at)::date AS day,
       COUNT(*) AS switching_mentions
FROM analyzed_posts ap
WHERE ap.user_id = :user_id
  AND ap.switch_intent = TRUE
  AND ap.analyzed_at >= :start_date
  AND ap.analyzed_at <  :end_date
GROUP BY 1
ORDER BY 1;
```

### 16) Correlation: complaints vs alternative mentions (daily)

```sql
WITH complaints AS (
  SELECT date_trunc('day', cc.last_updated)::date AS day,
         SUM(cc.frequency) AS complaints
  FROM complaint_clusters cc
  WHERE cc.user_id = :user_id
    AND cc.last_updated >= :start_date
    AND cc.last_updated <  :end_date
  GROUP BY 1
),
alts AS (
  SELECT date_trunc('day', a.last_updated)::date AS day,
         SUM(a.mentions_count) AS alt_mentions
  FROM alternatives a
  JOIN competitors c ON c.id = a.competitor_id
  WHERE c.user_id = :user_id
    AND a.last_updated >= :start_date
    AND a.last_updated <  :end_date
  GROUP BY 1
)
SELECT COALESCE(c.day, a.day) AS day,
       c.complaints,
       a.alt_mentions
FROM complaints c
FULL OUTER JOIN alts a ON a.day = c.day
ORDER BY day;
```

---

# 👥 Leads & Funnel

### 17) Leads over time (daily)

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

### 18) Lead status funnel (current)

```sql
SELECT l.status,
       COUNT(*) AS cnt
FROM leads l
WHERE l.user_id = :user_id
GROUP BY l.status
ORDER BY cnt DESC;
```

### 19) Lead source breakdown (platform)

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

### 20) Recent switching leads table

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

# 🚦 Operational (requires user scoping)

> `job_logs` has no `user_id`. If you can add a `user_id` (or a FK via competitor/source), use the version below. Otherwise, omit or show global.

### 21) Job success vs failures (if `job_logs.user_id` exists)

```sql
SELECT jl.status, COUNT(*) AS cnt
FROM job_logs jl
WHERE jl.user_id = :user_id
  AND jl.triggered_at >= :start_date
  AND jl.triggered_at <  :end_date
GROUP BY jl.status;
```

### 22) Avg job duration seconds (if `job_logs.user_id` exists)

```sql
SELECT AVG(EXTRACT(EPOCH FROM (jl.completed_at - jl.triggered_at))) AS avg_duration_sec
FROM job_logs jl
WHERE jl.user_id = :user_id
  AND jl.completed_at IS NOT NULL
  AND jl.triggered_at >= :start_date
  AND jl.triggered_at <  :end_date;
```

---

# 🧭 Scraping Freshness

### 23) Last scraped per competitor & platform

```sql
SELECT c.name AS competitor,
       s.platform,
       s.enabled,
       s.last_scraped_at
FROM competitors c
LEFT JOIN sources s ON s.competitor_id = c.id
WHERE c.user_id = :user_id
ORDER BY c.name, s.platform;
```

---

# 🧮 KPI Cards (current vs previous period)

### 24) Total Mentions: current, previous, % change

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

### 25) Negative Sentiment %: current, previous, % change

```sql
WITH base AS (
  SELECT *
  FROM analyzed_posts
  WHERE user_id = :user_id
),
this AS (
  SELECT COUNT(*) FILTER (WHERE sentiment ILIKE 'negative')::float / NULLIF(COUNT(*),0) AS pct
  FROM base
  WHERE analyzed_at >= :start_date AND analyzed_at < :end_date
),
prev AS (
  SELECT COUNT(*) FILTER (WHERE sentiment ILIKE 'negative')::float / NULLIF(COUNT(*),0) AS pct
  FROM base
  WHERE analyzed_at >= (:start_date - (:end_date - :start_date))
    AND analyzed_at <  :start_date
)
SELECT ROUND(100.0 * this.pct,2) AS current_pct,
       ROUND(100.0 * prev.pct,2) AS previous_pct,
       CASE WHEN prev.pct IS NULL OR prev.pct = 0 THEN NULL
            ELSE ROUND(100.0 * (this.pct - prev.pct) / prev.pct, 2) END AS pct_change
FROM this, prev;
```

### 26) Recurring Complaints (sum of frequencies): current vs previous

```sql
WITH this AS (
  SELECT COALESCE(SUM(frequency),0) AS v
  FROM complaint_clusters
  WHERE user_id = :user_id
    AND last_updated >= :start_date AND last_updated < :end_date
),
prev AS (
  SELECT COALESCE(SUM(frequency),0) AS v
  FROM complaint_clusters
  WHERE user_id = :user_id
    AND last_updated >= (:start_date - (:end_date - :start_date))
    AND last_updated <  :start_date
)
SELECT this.v AS current_value,
       prev.v AS previous_value,
       CASE WHEN prev.v = 0 THEN NULL
            ELSE ROUND(100.0 * (this.v - prev.v) / prev.v, 2) END AS pct_change
FROM this, prev;
```

### 27) Alternatives Mentioned (sum counts): current vs previous

```sql
WITH this AS (
  SELECT COALESCE(SUM(a.mentions_count),0) AS v
  FROM alternatives a
  JOIN competitors c ON c.id = a.competitor_id
  WHERE c.user_id = :user_id
    AND a.last_updated >= :start_date AND a.last_updated < :end_date
),
prev AS (
  SELECT COALESCE(SUM(a.mentions_count),0) AS v
  FROM alternatives a
  JOIN competitors c ON c.id = a.competitor_id
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

### 28) Recent negative mentions (sample from analyzed\_posts)

```sql
SELECT ap.analyzed_at::timestamp AS analyzed_at,
       c.name AS competitor,
       ap.cluster,
       ap.summary,
       ap.alternatives
FROM analyzed_posts ap
LEFT JOIN competitors c ON c.id = ap.competitor_id
WHERE ap.user_id = :user_id
  AND ap.sentiment ILIKE 'negative'
  AND ap.analyzed_at >= :start_date
  AND ap.analyzed_at <  :end_date
ORDER BY ap.analyzed_at DESC
LIMIT 100;
```

### 29) Complaint examples (from complaint\_clusters)

```sql
SELECT c.name AS competitor,
       cc.cluster,
       cc.sample_post,
       cc.frequency,
       cc.last_updated
FROM complaint_clusters cc
LEFT JOIN competitors c ON c.id = cc.competitor_id
WHERE cc.user_id = :user_id
ORDER BY cc.frequency DESC, cc.last_updated DESC
LIMIT 100;
```

### 30) Alternatives by competitor

```sql
SELECT c.name AS competitor,
       a.name  AS alternative,
       SUM(a.mentions_count) AS mentions
FROM alternatives a
JOIN competitors c ON c.id = a.competitor_id
WHERE c.user_id = :user_id
GROUP BY c.name, a.name
ORDER BY c.name, mentions DESC;
```

---

## Notes / gaps (so you’re not surprised)

* **Mentions by platform** for posts isn’t possible with the current schema because `analyzed_posts` has no `platform`. You can:

  * Add `platform TEXT` to `analyzed_posts`, **or**
  * Keep “platform” reporting limited to **leads** and **sources coverage** as above.
* **Operational job logs** aren’t user-scoped. Add `user_id` to `job_logs` if you need per-user views.

---

Want these wrapped as **views** (`CREATE VIEW ...`) with consistent column names and date parameters, or turned into a **dbt** model set? I can also generate a **seed Metabase/Looker layout** (cards + charts) mapped to these queries.
