import { z } from 'zod';

/**
 * Type for query metadata and configuration
 */
export interface QueryConfig {
  key: string;
  title: string;
  description: string;
  query: string;
  chartType: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'number' | 'table';
}

/**
 * Registry of all available queries
 */
export const queryRegistry: Record<string, QueryConfig> = {
  'active-competitors': {
    key: 'active-competitors',
    title: 'Active Competitors',
    description: 'Number of active competitors being tracked',
    query: `
      SELECT COUNT(*) AS active_competitors
      FROM competitors
      WHERE user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true);
    `,
    chartType: 'number'
  },
  'sources-coverage': {
    key: 'sources-coverage',
    title: 'Sources Coverage',
    description: 'Enabled vs disabled sources by competitor',
    query: `
      SELECT
        c.name AS name,
        'Enabled' AS label,
        COUNT(s.id) FILTER (WHERE s.enabled) AS value
      FROM competitors c
      LEFT JOIN sources s ON s.competitor_id = c.id
      WHERE c.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY c.id, c.name
      UNION ALL
      SELECT
        c.name AS name,
        'Disabled' AS label,
        COUNT(s.id) FILTER (WHERE NOT s.enabled OR s.enabled IS NULL) AS value
      FROM competitors c
      LEFT JOIN sources s ON s.competitor_id = c.id
      WHERE c.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY c.id, c.name
      ORDER BY name, label;
    `,
    chartType: 'bar'
  },
  'posts-analyzed': {
    key: 'posts-analyzed',
    title: 'Posts Analyzed',
    description: 'Number of posts analyzed in the given period',
    query: `
      SELECT COUNT(*) AS posts_analyzed
      FROM analyzed_posts ap
      WHERE ap.user_id = $1
        AND ap.analyzed_at >= $2
        AND ap.analyzed_at < $3;
    `,
    chartType: 'number'
  },
  'mentions-trend': {
    key: 'mentions-trend',
    title: 'Mentions Trend',
    description: 'Daily trend of mentions',
    query: `
      SELECT
        date_trunc('day', ap.analyzed_at)::timestamptz AS date,
        COUNT(*) AS value,
        'Mentions' AS label
      FROM analyzed_posts ap
      WHERE ap.user_id = $1
        AND ap.analyzed_at >= $2
        AND ap.analyzed_at < $3
      GROUP BY 1
      ORDER BY 1;
    `,
    chartType: 'line'
  },
  'sentiment-trend': {
    key: 'sentiment-trend',
    title: 'Sentiment Trend',
    description: 'Daily sentiment distribution',
    query: `
      SELECT date_trunc('day', ap.analyzed_at)::date AS day,
             ap.sentiment,
             COUNT(*) AS cnt
      FROM analyzed_posts ap
      WHERE ap.user_id = $1
        AND ap.analyzed_at >= $2
        AND ap.analyzed_at < $3
      GROUP BY 1, 2
      ORDER BY 1, 2;
    `,
    chartType: 'area'
  },
  'competitor-sentiment': {
    key: 'competitor-sentiment',
    title: 'Competitor Sentiment Distribution',
    description: 'Sentiment distribution by competitor',
    query: `
      SELECT c.id AS competitor_id,
             c.name,
             ap.sentiment,
             COUNT(*) AS mentions
      FROM analyzed_posts ap
      JOIN competitors c ON c.id = ap.competitor_id
      WHERE ap.user_id = $1
        AND ap.analyzed_at >= $2
        AND ap.analyzed_at < $3
      GROUP BY c.id, c.name, ap.sentiment
      ORDER BY c.name, ap.sentiment;
    `,
    chartType: 'bar'
  },
  'share-of-voice': {
    key: 'share-of-voice',
    title: 'Share of Voice',
    description: 'Mentions by competitor',
    query: `
      WITH tot AS (
        SELECT COUNT(*) AS total_mentions
        FROM analyzed_posts
        WHERE user_id = $1
          AND analyzed_at >= $2 AND analyzed_at < $3
      )
      SELECT
        c.name AS name,
        'Share of Voice' AS label,
        ROUND(100.0 * COUNT(ap.id) / NULLIF(t.total_mentions,0), 2) AS value
      FROM competitors c
      LEFT JOIN analyzed_posts ap
             ON ap.competitor_id = c.id
            AND ap.user_id = $1
            AND ap.analyzed_at >= $2 AND ap.analyzed_at < $3
      CROSS JOIN tot t
      WHERE c.user_id = $1
      GROUP BY c.id, c.name, t.total_mentions
      ORDER BY value DESC;
    `,
    chartType: 'pie'
  },
  'net-sentiment-score': {
    key: 'net-sentiment-score',
    title: 'Net Sentiment Score',
    description: 'Net sentiment score per competitor',
    query: `
      SELECT
        c.name AS name,
        'Net Sentiment' AS label,
        (SUM(CASE WHEN ap.sentiment ILIKE 'positive' THEN 1
                  WHEN ap.sentiment ILIKE 'negative' THEN -1
                  ELSE 0 END)::float
         / NULLIF(COUNT(ap.id),0)) AS value
      FROM competitors c
      LEFT JOIN analyzed_posts ap
             ON ap.competitor_id = c.id
            AND ap.user_id = $1
            AND ap.analyzed_at >= $2 AND ap.analyzed_at < $3
      WHERE c.user_id = $1
      GROUP BY c.id, c.name
      ORDER BY value DESC NULLS LAST;
    `,
    chartType: 'bar'
  },
  'top-complaints': {
    key: 'top-complaints',
    title: 'Top Complaints',
    description: 'Current top complaints',
    query: `
      SELECT
        cluster AS name,
        'Complaints' AS label,
        SUM(frequency) AS value
      FROM complaint_clusters
      WHERE user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY cluster
      ORDER BY value DESC
      LIMIT 20;
    `,
    chartType: 'bar'
  },
  'complaint-trend': {
    key: 'complaint-trend',
    title: 'Complaint Trend',
    description: 'Total complaints per day over time',
    query: `
      SELECT
        date_trunc('day', cc.last_updated)::timestamptz AS date,
        SUM(cc.frequency) AS value,
        'Complaints' AS label
      FROM complaint_clusters cc
      WHERE cc.user_id = $1
        AND cc.last_updated >= $2
        AND cc.last_updated < $3
      GROUP BY 1
      ORDER BY 1;
    `,
    chartType: 'line'
  },
  'complaint-heatmap': {
    key: 'complaint-heatmap',
    title: 'Complaint Heatmap',
    description: 'Complaint distribution by competitor and cluster',
    query: `
      SELECT c.name AS competitor,
             cc.cluster,
             SUM(cc.frequency) AS mentions
      FROM complaint_clusters cc
      JOIN competitors c ON c.id = cc.competitor_id
      WHERE cc.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY c.name, cc.cluster
      ORDER BY c.name, mentions DESC;
    `,
    chartType: 'scatter'
  },
  'emerging-complaints': {
    key: 'emerging-complaints',
    title: 'Emerging Complaints',
    description: 'Complaints updated recently vs prior window',
    query: `
      WITH this_window AS (
        SELECT cluster, SUM(frequency) AS f_now
        FROM complaint_clusters
        WHERE user_id = $1
          AND last_updated >= $2 AND last_updated < $3
        GROUP BY cluster
      ),
      prev_window AS (
        SELECT cluster, SUM(frequency) AS f_prev
        FROM complaint_clusters
        WHERE user_id = $1
          AND last_updated >= ($2 - ($3 - $2))
          AND last_updated < $2
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
    `,
    chartType: 'table'
  },
  'top-alternatives': {
    key: 'top-alternatives',
    title: 'Top Alternatives',
    description: 'Current top alternatives',
    query: `
      SELECT a.name AS alternative,
             SUM(a.mentions_count) AS mentions
      FROM alternatives a
      JOIN competitors c ON c.id = a.competitor_id
      WHERE c.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY a.name
      ORDER BY mentions DESC
      LIMIT 20;
    `,
    chartType: 'bar'
  },
  'alternatives-trend': {
    key: 'alternatives-trend',
    title: 'Alternatives Trend',
    description: 'Alternatives trend by day',
    query: `
      SELECT
        date_trunc('day', a.last_updated)::timestamptz AS date,
        SUM(a.mentions_count) AS value,
        a.name AS label
      FROM alternatives a
      JOIN competitors c ON c.id = a.competitor_id
      WHERE c.user_id = $1
        AND a.last_updated >= $2
        AND a.last_updated < $3
      GROUP BY 1, a.name
      ORDER BY 1, a.name;
    `,
    chartType: 'line'
  },
  'switching-intent-trend': {
    key: 'switching-intent-trend',
    title: 'Switching Intent Trend',
    description: 'Daily trend of switching intent',
    query: `
      SELECT
        date_trunc('day', ap.analyzed_at)::timestamptz AS date,
        COUNT(*) AS value,
        'Switching Intent' AS label
      FROM analyzed_posts ap
      WHERE ap.user_id = $1
        AND ap.switch_intent = TRUE
        AND ap.analyzed_at >= $2
        AND ap.analyzed_at < $3
      GROUP BY 1
      ORDER BY 1;
    `,
    chartType: 'line'
  },
  'complaints-alternatives-correlation': {
    key: 'complaints-alternatives-correlation',
    title: 'Complaints vs Alternatives Correlation',
    description: 'Daily correlation between complaints and alternative mentions',
    query: `
      WITH complaints AS (
        SELECT date_trunc('day', cc.last_updated)::date AS day,
               SUM(cc.frequency) AS complaints
        FROM complaint_clusters cc
        WHERE cc.user_id = $1
          AND cc.last_updated >= $2
          AND cc.last_updated < $3
        GROUP BY 1
      ),
      alts AS (
        SELECT date_trunc('day', a.last_updated)::date AS day,
               SUM(a.mentions_count) AS alt_mentions
        FROM alternatives a
        JOIN competitors c ON c.id = a.competitor_id
        WHERE c.user_id = $1
          AND a.last_updated >= $2
          AND a.last_updated < $3
        GROUP BY 1
      )
      SELECT COALESCE(c.day, a.day) AS day,
             c.complaints,
             a.alt_mentions
      FROM complaints c
      FULL OUTER JOIN alts a ON a.day = c.day
      ORDER BY day;
    `,
    chartType: 'scatter'
  },
  'leads-over-time': {
    key: 'leads-over-time',
    title: 'Leads Over Time',
    description: 'Daily trend of leads',
    query: `
      SELECT
        date_trunc('day', l.created_at)::timestamptz AS date,
        COUNT(*) AS value,
        'Leads' AS label
      FROM leads l
      WHERE l.user_id = $1
        AND l.created_at >= $2
        AND l.created_at < $3
      GROUP BY 1
      ORDER BY 1;
    `,
    chartType: 'line'
  },
  'lead-status-funnel': {
    key: 'lead-status-funnel',
    title: 'Lead Status Funnel',
    description: 'Current lead status distribution',
    query: `
      SELECT
        l.status AS name,
        'Leads' AS label,
        COUNT(*) AS value
      FROM leads l
      WHERE l.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY l.status
      ORDER BY value DESC;
    `,
    chartType: 'bar'
  },
  'lead-source-breakdown': {
    key: 'lead-source-breakdown',
    title: 'Lead Source Breakdown',
    description: 'Lead distribution by platform',
    query: `
      SELECT
        l.platform AS name,
        'Leads' AS label,
        COUNT(*) AS value
      FROM leads l
      WHERE l.user_id = $1
        AND l.created_at >= $2
        AND l.created_at < $3
      GROUP BY l.platform
      ORDER BY value DESC;
    `,
    chartType: 'pie'
  },
  'recent-switching-leads': {
    key: 'recent-switching-leads',
    title: 'Recent Switching Leads',
    description: 'Recent leads with switching intent',
    query: `
      SELECT l.platform,
             l.username,
             l.excerpt,
             l.reason,
             l.created_at::date AS date,
             l.status
      FROM leads l
      WHERE l.user_id = $1
        AND l.created_at >= $2
        AND l.created_at < $3
      ORDER BY l.created_at DESC
      LIMIT 50;
    `,
    chartType: 'table'
  },
  'last-scraped': {
    key: 'last-scraped',
    title: 'Last Scraped',
    description: 'Last scraped time per competitor and platform',
    query: `
      SELECT c.name AS competitor,
             s.platform,
             s.enabled,
             s.last_scraped_at
      FROM competitors c
      LEFT JOIN sources s ON s.competitor_id = c.id
      WHERE c.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      ORDER BY c.name, s.platform;
    `,
    chartType: 'table'
  },
  'total-mentions': {
    key: 'total-mentions',
    title: 'Total Mentions',
    description: 'Total mentions with period comparison',
    query: `
      WITH this AS (
        SELECT COUNT(*) AS v
        FROM analyzed_posts
        WHERE user_id = $1
          AND analyzed_at >= $2 AND analyzed_at < $3
      ),
      prev AS (
        SELECT COUNT(*) AS v
        FROM analyzed_posts
        WHERE user_id = $1
          AND analyzed_at >= ($2 - ($3 - $2))
          AND analyzed_at < $2
      )
      SELECT this.v AS current_value,
             prev.v AS previous_value,
             CASE WHEN prev.v = 0 THEN NULL
                  ELSE ROUND(100.0 * (this.v - prev.v) / prev.v, 2) END AS pct_change
      FROM this, prev;
    `,
    chartType: 'number'
  },
  'negative-sentiment-percentage': {
    key: 'negative-sentiment-percentage',
    title: 'Negative Sentiment Percentage',
    description: 'Negative sentiment percentage with period comparison',
    query: `
      WITH base AS (
        SELECT *
        FROM analyzed_posts
        WHERE user_id = $1
      ),
      this AS (
        SELECT COUNT(*) FILTER (WHERE sentiment ILIKE 'negative')::float / NULLIF(COUNT(*),0) AS pct
        FROM base
        WHERE analyzed_at >= $2 AND analyzed_at < $3
      ),
      prev AS (
        SELECT COUNT(*) FILTER (WHERE sentiment ILIKE 'negative')::float / NULLIF(COUNT(*),0) AS pct
        FROM base
        WHERE analyzed_at >= ($2 - ($3 - $2))
          AND analyzed_at < $2
      )
      SELECT (100.0 * this.pct)::numeric(10,2) AS current_pct,
             (100.0 * prev.pct)::numeric(10,2) AS previous_pct,
             CASE WHEN prev.pct IS NULL OR prev.pct = 0 THEN NULL
                  ELSE ((100.0 * (this.pct - prev.pct) / prev.pct)::numeric(10,2)) END AS pct_change
      FROM this, prev;
    `,
    chartType: 'number'
  },
  'recurring-complaints': {
    key: 'recurring-complaints',
    title: 'Recurring Complaints',
    description: 'Recurring complaints with period comparison',
    query: `
      WITH this AS (
        SELECT COALESCE(SUM(frequency),0) AS v
        FROM complaint_clusters
        WHERE user_id = $1
          AND last_updated >= $2 AND last_updated < $3
      ),
      prev AS (
        SELECT COALESCE(SUM(frequency),0) AS v
        FROM complaint_clusters
        WHERE user_id = $1
          AND last_updated >= ($2 - ($3 - $2))
          AND last_updated < $2
      )
      SELECT this.v AS current_value,
             prev.v AS previous_value,
             CASE WHEN prev.v = 0 THEN NULL
                  ELSE ROUND(100.0 * (this.v - prev.v) / prev.v, 2) END AS pct_change
      FROM this, prev;
    `,
    chartType: 'number'
  },
  'alternatives-mentioned': {
    key: 'alternatives-mentioned',
    title: 'Alternatives Mentioned',
    description: 'Alternatives mentioned with period comparison',
    query: `
      WITH this AS (
        SELECT COALESCE(SUM(a.mentions_count),0) AS v
        FROM alternatives a
        JOIN competitors c ON c.id = a.competitor_id
        WHERE c.user_id = $1
          AND a.last_updated >= $2 AND a.last_updated < $3
      ),
      prev AS (
        SELECT COALESCE(SUM(a.mentions_count),0) AS v
        FROM alternatives a
        JOIN competitors c ON c.id = a.competitor_id
        WHERE c.user_id = $1
          AND a.last_updated >= ($2 - ($3 - $2))
          AND a.last_updated < $2
      )
      SELECT this.v AS current_value,
             prev.v AS previous_value,
             CASE WHEN prev.v = 0 THEN NULL
                  ELSE ROUND(100.0 * (this.v - prev.v) / prev.v, 2) END AS pct_change
      FROM this, prev;
    `,
    chartType: 'number'
  },
  'recent-negative-mentions': {
    key: 'recent-negative-mentions',
    title: 'Recent Negative Mentions',
    description: 'Sample of recent negative mentions',
    query: `
      SELECT ap.analyzed_at::timestamp AS analyzed_at,
             c.name AS competitor,
             ap.cluster,
             ap.summary,
             ap.alternatives
      FROM analyzed_posts ap
      LEFT JOIN competitors c ON c.id = ap.competitor_id
      WHERE ap.user_id = $1
        AND ap.sentiment ILIKE 'negative'
        AND ap.analyzed_at >= $2
        AND ap.analyzed_at < $3
      ORDER BY ap.analyzed_at DESC
      LIMIT 100;
    `,
    chartType: 'table'
  },
  'complaint-examples': {
    key: 'complaint-examples',
    title: 'Complaint Examples',
    description: 'Examples from complaint clusters',
    query: `
      SELECT c.name AS competitor,
             cc.cluster,
             cc.sample_post,
             cc.frequency,
             cc.last_updated
      FROM complaint_clusters cc
      LEFT JOIN competitors c ON c.id = cc.competitor_id
      WHERE cc.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      ORDER BY cc.frequency DESC, cc.last_updated DESC
      LIMIT 100;
    `,
    chartType: 'table'
  },
  'alternatives-by-competitor': {
    key: 'alternatives-by-competitor',
    title: 'Alternatives by Competitor',
    description: 'Alternative mentions grouped by competitor',
    query: `
      SELECT c.name AS competitor,
             a.name AS alternative,
             SUM(a.mentions_count) AS mentions
      FROM alternatives a
      JOIN competitors c ON c.id = a.competitor_id
      WHERE c.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY c.name, a.name
      ORDER BY c.name, mentions DESC;
    `,
    chartType: 'table'
  },
  'all-competitors': {
    key: 'all-competitors',
    title: 'All Competitors',
    description: 'Complete list of all competitors for a user with all data points',
    query: `
      SELECT
        c.id,
        c.name,
        c.slug,
        c.created_at,
        c.user_id,
        COUNT(DISTINCT s.id) AS total_sources,
        COUNT(DISTINCT s.id) FILTER (WHERE s.enabled = true) AS enabled_sources,
        COUNT(DISTINCT s.id) FILTER (WHERE s.enabled = false OR s.enabled IS NULL) AS disabled_sources,
        MAX(s.last_scraped_at) AS last_scraped_at,
        COUNT(DISTINCT ap.id) AS total_mentions,
        COUNT(DISTINCT ap.id) FILTER (WHERE ap.sentiment ILIKE 'positive') AS positive_mentions,
        COUNT(DISTINCT ap.id) FILTER (WHERE ap.sentiment ILIKE 'negative') AS negative_mentions,
        COUNT(DISTINCT ap.id) FILTER (WHERE ap.sentiment ILIKE 'neutral') AS neutral_mentions,
        COUNT(DISTINCT l.id) AS total_leads,
        COUNT(DISTINCT cc.id) AS total_complaint_clusters,
        COUNT(DISTINCT a.id) AS total_alternatives
      FROM competitors c
      LEFT JOIN sources s ON s.competitor_id = c.id
      LEFT JOIN analyzed_posts ap ON ap.competitor_id = c.id AND ap.user_id = c.user_id
      LEFT JOIN leads l ON l.analyzed_post_id = ap.id AND l.user_id = c.user_id
      LEFT JOIN complaint_clusters cc ON cc.competitor_id = c.id AND cc.user_id = c.user_id
      LEFT JOIN alternatives a ON a.competitor_id = c.id
      WHERE c.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY c.id, c.name, c.slug, c.created_at, c.user_id
      ORDER BY c.created_at DESC;
    `,
    chartType: 'table'
  },
  'all-leads': {
    key: 'all-leads',
    title: 'All Leads',
    description: 'Complete list of all leads for a user with all data points',
    query: `
      SELECT
        l.id,
        l.analyzed_post_id,
        l.username,
        l.platform,
        l.excerpt,
        l.reason,
        l.status,
        l.created_at,
        l.user_id,
        ap.sentiment,
        ap.cluster,
        ap.switch_intent,
        ap.summary,
        ap.alternatives,
        ap.analyzed_at,
        c.name AS competitor_name,
        c.slug AS competitor_slug
      FROM leads l
      LEFT JOIN analyzed_posts ap ON ap.id = l.analyzed_post_id
      LEFT JOIN competitors c ON c.id = ap.competitor_id
      WHERE l.user_id = $1
        AND ($2::timestamp is null OR l.created_at >= $2)
        AND ($3::timestamp is null OR l.created_at < $3)
      ORDER BY l.created_at DESC;
    `,
    chartType: 'table'
  }
};

/**
 * Zod schema for query parameters
 */
export const QueryParamsSchema = z.object({
  user_id: z.string(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

export type QueryParams = z.infer<typeof QueryParamsSchema>;

/**
 * Get a query config by its key
 */
export function getQueryConfig(key: string): QueryConfig | undefined {
  return queryRegistry[key];
}

/**
 * Get all available query keys
 */
export function getAllQueryKeys(): string[] {
  return Object.keys(queryRegistry);
}
