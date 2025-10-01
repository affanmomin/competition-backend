import { z } from "zod";

/**
 * Type for query metadata and configuration
 */
export interface QueryConfig {
  key: string;
  title: string;
  description: string;
  query: string;
  chartType: "line" | "bar" | "pie" | "area" | "scatter" | "number" | "table";
}

/**
 * Registry of all available queries
 */
export const queryRegistry: Record<string, QueryConfig> = {
  "active-competitors": {
    key: "active-competitors",
    title: "Active Competitors",
    description: "Number of active competitors being tracked",
    query: `
      SELECT COUNT(*) AS active_competitors
      FROM competitors
      WHERE user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true);
    `,
    chartType: "number",
  },
  "sources-coverage": {
    key: "sources-coverage",
    title: "Sources Coverage",
    description: "Enabled vs disabled sources by competitor",
    query: `
      SELECT
        c.name AS name,
        'Enabled' AS label,
        COUNT(s.id) FILTER (WHERE s.enabled) AS value
      FROM competitors c
      LEFT JOIN sources s ON s.competitor_id = c.competitor_id
      WHERE c.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY c.competitor_id, c.name
      UNION ALL
      SELECT
        c.name AS name,
        'Disabled' AS label,
        COUNT(s.id) FILTER (WHERE NOT s.enabled OR s.enabled IS NULL) AS value
      FROM competitors c
      LEFT JOIN sources s ON s.competitor_id = c.competitor_id
      WHERE c.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY c.competitor_id, c.name
      ORDER BY name, label;
    `,
    chartType: "bar",
  },
  "posts-analyzed": {
    key: "posts-analyzed",
    title: "Posts Analyzed",
    description: "Number of posts analyzed in the given period",
    query: `
      SELECT COUNT(*) AS posts_analyzed
      FROM analyzed_posts ap
      JOIN competitors c ON c.competitor_id = ap.competitor_id
      WHERE c.user_id = $1
        AND ap.analyzed_at >= $2
        AND ap.analyzed_at < $3;
    `,
    chartType: "number",
  },
  "mentions-trend": {
    key: "mentions-trend",
    title: "Mentions Trend",
    description: "Daily trend of mentions",
    query: `
      SELECT
        date_trunc('day', ap.analyzed_at)::timestamptz AS date,
        COUNT(*) AS value,
        'Mentions' AS label
      FROM analyzed_posts ap
      JOIN competitors c ON c.competitor_id = ap.competitor_id
      WHERE c.user_id = $1
        AND ap.analyzed_at >= $2
        AND ap.analyzed_at < $3
      GROUP BY 1
      ORDER BY 1;
    `,
    chartType: "line",
  },
  "competitor-sentiment": {
    key: "competitor-sentiment",
    title: "Competitor Sentiment Distribution",
    description: "Sentiment distribution by competitor",
    query: `
      SELECT c.competitor_id AS competitor_id,
             c.name,
             'neutral' AS sentiment,
             COUNT(*) AS mentions
      FROM analyzed_posts ap
      JOIN competitors c ON c.competitor_id = ap.competitor_id
      WHERE c.user_id = $1
        AND ap.analyzed_at >= $2
        AND ap.analyzed_at < $3
      GROUP BY c.competitor_id, c.name
      ORDER BY c.name;
    `,
    chartType: "bar",
  },
  "share-of-voice": {
    key: "share-of-voice",
    title: "Share of Voice",
    description: "Mentions by competitor",
    query: `
      WITH tot AS (
        SELECT COUNT(*) AS total_mentions
        FROM analyzed_posts ap
        JOIN competitors c ON c.competitor_id = ap.competitor_id
        WHERE c.user_id = $1
          AND ap.analyzed_at >= $2 AND ap.analyzed_at < $3
      )
      SELECT
        c.name AS name,
        'Share of Voice' AS label,
        ROUND(100.0 * COUNT(ap.id) / NULLIF(t.total_mentions,0), 2) AS value
      FROM competitors c
      LEFT JOIN analyzed_posts ap
             ON ap.competitor_id = c.competitor_id
            AND ap.analyzed_at >= $2 AND ap.analyzed_at < $3
      CROSS JOIN tot t
      WHERE c.user_id = $1
      GROUP BY c.competitor_id, c.name, t.total_mentions
      ORDER BY value DESC;
    `,
    chartType: "pie",
  },
  "net-sentiment-score": {
    key: "net-sentiment-score",
    title: "Net Sentiment Score",
    description:
      "Net sentiment score per competitor (requires sentiment analysis)",
    query: `
      SELECT
        c.name AS name,
        'Net Sentiment' AS label,
        0.0 AS value
      FROM competitors c
      LEFT JOIN analyzed_posts ap
             ON ap.competitor_id = c.competitor_id
            AND ap.analyzed_at >= $2 AND ap.analyzed_at < $3
      WHERE c.user_id = $1
      GROUP BY c.competitor_id, c.name
      ORDER BY value DESC NULLS LAST;
    `,
    chartType: "bar",
  },
  "top-features-short": {
    key: "top-features-short",
    title: "Top 5 Features",
    description: "Top 5 features by competitor",
    query: `
    SELECT
      f.canonical AS name,
      'Features' AS label,
      COUNT(*) AS value
    FROM features f
    JOIN competitors c ON c.competitor_id = f.competitor_id
    WHERE c.user_id = $1
      AND ($2::timestamp is null OR f.last_updated >= $2)
      AND ($3::timestamp is null OR f.last_updated < $3)
    GROUP BY f.canonical
    ORDER BY value DESC
    LIMIT 5;
  `,
    chartType: "bar",
  },
  "top-features": {
    key: "top-features",
    title: "Top Features",
    description: "Current top features by competitor",
    query: `
    SELECT
      f.canonical AS name,
      'Features' AS label,
      COUNT(*) AS value
    FROM features f
    JOIN competitors c ON c.competitor_id = f.competitor_id
    WHERE c.user_id = $1
      AND ($2::timestamp is null OR f.last_updated >= $2)
      AND ($3::timestamp is null OR f.last_updated < $3)
    GROUP BY f.canonical
    ORDER BY value DESC
    LIMIT 20;
  `,
    chartType: "bar",
  },
  "features-trend": {
    key: "features-trend",
    title: "Features Trend",
    description: "Daily trend of new features discovered",
    query: `
    SELECT
      date_trunc('day', f.created_at)::timestamptz AS date,
      COUNT(*) AS value,
      'Features' AS label
    FROM features f
    JOIN competitors c ON c.competitor_id = f.competitor_id
    WHERE c.user_id = $1
      AND f.created_at >= $2
      AND f.created_at < $3
    GROUP BY 1
    ORDER BY 1;
  `,
    chartType: "line",
  },
  "features-by-type": {
    key: "features-by-type",
    title: "Features by Type",
    description: "Feature distribution by type",
    query: `
    SELECT
      COALESCE(f.feature_type, 'unknown') AS name,
      'Features' AS label,
      COUNT(*) AS value
    FROM features f
    JOIN competitors c ON c.competitor_id = f.competitor_id
    WHERE c.user_id = $1
      AND ($2::timestamp is null OR f.last_updated >= $2)
      AND ($3::timestamp is null OR f.last_updated < $3)
    GROUP BY f.feature_type
    ORDER BY value DESC;
  `,
    chartType: "pie",
  },
  "features-by-impact": {
    key: "features-by-impact",
    title: "Features by Impact Level",
    description: "Feature distribution by impact level",
    query: `
    SELECT
      COALESCE(f.impact_level, 'unknown') AS name,
      'Features' AS label,
      COUNT(*) AS value
    FROM features f
    JOIN competitors c ON c.competitor_id = f.competitor_id
    WHERE c.user_id = $1
      AND ($2::timestamp is null OR f.last_updated >= $2)
      AND ($3::timestamp is null OR f.last_updated < $3)
    GROUP BY f.impact_level
    ORDER BY 
      CASE f.impact_level 
        WHEN 'critical' THEN 1
        WHEN 'major' THEN 2
        WHEN 'minor' THEN 3
        ELSE 4
      END;
  `,
    chartType: "bar",
  },
  "total-features": {
    key: "total-features",
    title: "Total Features",
    description: "Total features discovered with period comparison",
    query: `
    WITH this AS (
      SELECT COUNT(*) AS v
      FROM features f
      JOIN competitors c ON c.competitor_id = f.competitor_id
      WHERE c.user_id = $1
        AND f.created_at >= $2 AND f.created_at < $3
    ),
    prev AS (
      SELECT COUNT(*) AS v
      FROM features f
      JOIN competitors c ON c.competitor_id = f.competitor_id
      WHERE c.user_id = $1
        AND f.created_at >= ($2 - ($3 - $2))
        AND f.created_at < $2
    )
    SELECT this.v AS current_value,
           prev.v AS previous_value,
           CASE WHEN prev.v = 0 THEN NULL
                ELSE ROUND(100.0 * (this.v - prev.v) / prev.v, 2) END AS pct_change
    FROM this, prev;
  `,
    chartType: "number",
  },
  "features-by-competitor": {
    key: "features-by-competitor",
    title: "Features by Competitor",
    description: "Feature count by competitor",
    query: `
    SELECT
      c.name AS name,
      'Features' AS label,
      COUNT(f.id) AS value
    FROM competitors c
    LEFT JOIN features f ON f.competitor_id = c.competitor_id
      AND ($2::timestamp is null OR f.last_updated >= $2)
      AND ($3::timestamp is null OR f.last_updated < $3)
    WHERE c.user_id = $1
    GROUP BY c.competitor_id, c.name
    ORDER BY value DESC;
  `,
    chartType: "bar",
  },
  "recent-features": {
    key: "recent-features",
    title: "Recent Features",
    description: "Recently discovered features",
    query: `
    SELECT
      f.canonical AS feature,
      c.name AS competitor,
      f.feature_type,
      f.impact_level,
      f.confidence_score,
      f.platform,
      f.created_at::date AS discovered_date
    FROM features f
    JOIN competitors c ON c.competitor_id = f.competitor_id
    WHERE c.user_id = $1
      AND f.created_at >= $2
      AND f.created_at < $3
    ORDER BY f.created_at DESC
    LIMIT 50;
  `,
    chartType: "table",
  },
  "top-complaints": {
    key: "top-complaints",
    title: "Top Complaints",
    description: "Current top complaints",
    query: `
      SELECT
        comp.canonical AS name,
        'Complaints' AS label,
        COUNT(*) AS value
      FROM complaints comp
      JOIN competitors c ON c.competitor_id = comp.competitor_id
      WHERE c.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY comp.canonical
      ORDER BY value DESC
      LIMIT 20;
    `,
    chartType: "bar",
  },
  "complaint-trend": {
    key: "complaint-trend",
    title: "Complaint Trend",
    description: "Total complaints per day over time",
    query: `
      SELECT
        date_trunc('day', comp.last_updated)::timestamptz AS date,
        COUNT(*) AS value,
        'Complaints' AS label
      FROM complaints comp
      JOIN competitors c ON c.competitor_id = comp.competitor_id
      WHERE c.user_id = $1
        AND comp.last_updated >= $2
        AND comp.last_updated < $3
      GROUP BY 1
      ORDER BY 1;
    `,
    chartType: "line",
  },
  "top-alternatives": {
    key: "top-alternatives",
    title: "Top Alternatives",
    description: "Current top alternatives",
    query: `
      SELECT a.name AS alternative,
             SUM(a.mentions_count) AS mentions
      FROM alternatives a
      JOIN competitors c ON c.competitor_id = a.competitor_id
      WHERE c.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY a.name
      ORDER BY mentions DESC
      LIMIT 20;
    `,
    chartType: "bar",
  },
  "top-alternatives-short": {
    key: "top-alternatives-short",
    title: "Top 5 Alternatives",
    description: "Top 5 alternatives",
    query: `
      SELECT a.name AS alternative,
             SUM(a.mentions_count) AS mentions
      FROM alternatives a
      JOIN competitors c ON c.competitor_id = a.competitor_id
      WHERE c.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY a.name
      ORDER BY mentions DESC
      LIMIT 5;
    `,
    chartType: "bar",
  },
  "top-complaints-short": {
    key: "top-complaints-short",
    title: "Top 5 Complaints",
    description: "Top 5 complaints",
    query: `
    SELECT
      comp.canonical AS name,
      'Complaints' AS label,
      COUNT(*) AS value
    FROM complaints comp
    JOIN competitors c ON c.competitor_id = comp.competitor_id
    WHERE c.user_id = $1
      AND ($2::timestamp is null OR true)
      AND ($3::timestamp is null OR true)
    GROUP BY comp.canonical
    ORDER BY value DESC
    LIMIT 5;
  `,
    chartType: "bar",
  },
  "leads-over-time": {
    key: "leads-over-time",
    title: "Leads Over Time",
    description: "Daily trend of leads",
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
    chartType: "line",
  },
  "lead-status-funnel": {
    key: "lead-status-funnel",
    title: "Lead Status Funnel",
    description: "Current lead status distribution",
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
    chartType: "bar",
  },
  "lead-source-breakdown": {
    key: "lead-source-breakdown",
    title: "Lead Source Breakdown",
    description: "Lead distribution by platform",
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
    chartType: "pie",
  },
  "recent-switching-leads": {
    key: "recent-switching-leads",
    title: "Recent Switching Leads",
    description: "Recent leads with switching intent",
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
    chartType: "table",
  },
  "last-scraped": {
    key: "last-scraped",
    title: "Last Scraped",
    description: "Last scraped time per competitor and platform",
    query: `
      SELECT c.name AS competitor,
             s.platform,
             s.enabled,
             s.last_scraped_at
      FROM competitors c
      LEFT JOIN sources s ON s.competitor_id = c.competitor_id
      WHERE c.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      ORDER BY c.name, s.platform;
    `,
    chartType: "table",
  },
  "total-complaints": {
    key: "total-complaints",
    title: "Total Complaints",
    description: "Total complaints with period comparison",
    query: `
      WITH this AS (
        SELECT COUNT(*) AS v
        FROM complaints comp
        JOIN competitors c ON c.competitor_id = comp.competitor_id
        WHERE c.user_id = $1
          AND comp.last_updated >= $2 AND comp.last_updated < $3
      ),
      prev AS (
        SELECT COUNT(*) AS v
        FROM complaints comp
        JOIN competitors c ON c.competitor_id = comp.competitor_id
        WHERE c.user_id = $1
          AND comp.last_updated >= ($2 - ($3 - $2))
          AND comp.last_updated < $2
      )
      SELECT this.v AS current_value,
             prev.v AS previous_value,
             CASE WHEN prev.v = 0 THEN NULL
                  ELSE ROUND(100.0 * (this.v - prev.v) / prev.v, 2) END AS pct_change
      FROM this, prev;
    `,
    chartType: "number",
  },
  "total-features-identified": {
    key: "total-features-identified",
    title: "Total Features Identified",
    description: "Total features identified with period comparison",
    query: `
      WITH this AS (
        SELECT COUNT(*) AS v
        FROM features f
        JOIN competitors c ON f.competitor_id = c.competitor_id
        WHERE c.user_id = $1
          AND f.last_updated >= $2 AND f.last_updated < $3
      ),
      prev AS (
        SELECT COUNT(*) AS v
        FROM features f
        JOIN competitors c ON f.competitor_id = c.competitor_id
        WHERE c.user_id = $1
          AND f.last_updated >= ($2 - ($3 - $2))
          AND f.last_updated < $2
      )
      SELECT this.v AS current_value,
             prev.v AS previous_value,
             CASE WHEN prev.v = 0 THEN NULL
                  ELSE ROUND(100.0 * (this.v - prev.v) / prev.v, 2) END AS pct_change
      FROM this, prev;
    `,
    chartType: "number",
  },
  "leads-identified": {
    key: "leads-identified",
    title: "Leads Identified",
    description: "Total leads identified with period comparison",
    query: `
      WITH this AS (
        SELECT COUNT(*) AS v
        FROM leads l
        WHERE l.user_id = $1
          AND l.created_at >= $2 AND l.created_at < $3
      ),
      prev AS (
        SELECT COUNT(*) AS v
        FROM leads l
        WHERE l.user_id = $1
          AND l.created_at >= ($2 - ($3 - $2))
          AND l.created_at < $2
      )
      SELECT this.v AS current_value,
             prev.v AS previous_value,
             CASE WHEN prev.v = 0 THEN NULL
                  ELSE ROUND(100.0 * (this.v - prev.v) / prev.v, 2) END AS pct_change
      FROM this, prev;
    `,
    chartType: "number",
  },
  "alternatives-mentioned": {
    key: "alternatives-mentioned",
    title: "Alternatives Mentioned",
    description: "Alternatives mentioned with period comparison",
    query: `
      WITH this AS (
        SELECT COALESCE(SUM(a.mentions_count),0) AS v
        FROM alternatives a
        JOIN competitors c ON c.competitor_id = a.competitor_id
        WHERE c.user_id = $1
          AND a.last_updated >= $2 AND a.last_updated < $3
      ),
      prev AS (
        SELECT COALESCE(SUM(a.mentions_count),0) AS v
        FROM alternatives a
        JOIN competitors c ON c.competitor_id = a.competitor_id
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
    chartType: "number",
  },
  "recent-negative-mentions": {
    key: "recent-negative-mentions",
    title: "Recent Mentions",
    description: "Sample of recent mentions (sentiment analysis required)",
    query: `
      SELECT ap.analyzed_at::timestamp AS analyzed_at,
             c.name AS competitor,
             ap.excerpt,
             ap.platform
      FROM analyzed_posts ap
      JOIN competitors c ON c.competitor_id = ap.competitor_id
      WHERE c.user_id = $1
        AND ap.analyzed_at >= $2
        AND ap.analyzed_at < $3
      ORDER BY ap.analyzed_at DESC
      LIMIT 100;
    `,
    chartType: "table",
  },
  "alternatives-by-competitor": {
    key: "alternatives-by-competitor",
    title: "Alternatives by Competitor",
    description: "Alternative mentions grouped by competitor",
    query: `
      SELECT c.name AS competitor,
             a.name AS alternative,
             SUM(a.mentions_count) AS mentions
      FROM alternatives a
      JOIN competitors c ON c.competitor_id = a.competitor_id
      WHERE c.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY c.name, a.name
      ORDER BY c.name, mentions DESC;
    `,
    chartType: "table",
  },
  "all-competitors": {
    key: "all-competitors",
    title: "All Competitors",
    description:
      "Complete list of all competitors for a user with all data points",
    query: `
      SELECT
        c.competitor_id AS id,
        c.name,
        c.slug,
        c.created_at,
        c.user_id,
        COUNT(DISTINCT s.id) AS total_sources,
        COUNT(DISTINCT s.id) FILTER (WHERE s.enabled = true) AS enabled_sources,
        COUNT(DISTINCT s.id) FILTER (WHERE s.enabled = false OR s.enabled IS NULL) AS disabled_sources,
        MAX(s.last_scraped_at) AS last_scraped_at,
        COUNT(DISTINCT ap.id) AS total_mentions,
        0 AS positive_mentions,
        0 AS negative_mentions,
        0 AS neutral_mentions,
        COUNT(DISTINCT l.id) AS total_leads,
        COUNT(DISTINCT comp.id) AS total_complaints,
        COUNT(DISTINCT a.id) AS total_alternatives
      FROM competitors c
      LEFT JOIN competitor_sources cs ON cs.competitor_id = c.competitor_id
      LEFT JOIN sources s ON s.id = cs.source_id
      LEFT JOIN analyzed_posts ap ON ap.competitor_id = c.competitor_id
      LEFT JOIN leads l ON l.analyzed_post_id = ap.id AND l.user_id = c.user_id
      LEFT JOIN complaints comp ON comp.competitor_id = c.competitor_id
      LEFT JOIN alternatives a ON a.competitor_id = c.competitor_id
      WHERE c.user_id = $1
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY c.competitor_id, c.name, c.slug, c.created_at, c.user_id
      ORDER BY c.created_at DESC;
    `,
    chartType: "table",
  },
  "all-leads": {
    key: "all-leads",
    title: "All Leads",
    description: "Complete list of all leads for a user with all data points",
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
        ap.excerpt AS post_excerpt,
        ap.analyzed_at,
        c.name AS competitor_name,
        c.slug AS competitor_slug
      FROM leads l
      LEFT JOIN analyzed_posts ap ON ap.id = l.analyzed_post_id
      LEFT JOIN competitors c ON c.competitor_id = ap.competitor_id AND c.user_id = l.user_id
      WHERE l.user_id = $1
        AND ($2::timestamp is null OR l.created_at >= $2)
        AND ($3::timestamp is null OR l.created_at < $3)
      ORDER BY l.created_at DESC;
    `,
    chartType: "table",
  },
  // Competitor-specific queries
  "competitor-top-complaints-short": {
    key: "competitor-top-complaints-short",
    title: "Top 5 Complaints for Competitor",
    description: "Top 5 complaints for a specific competitor",
    query: `
      SELECT
        comp.canonical AS name,
        'Complaints' AS label,
        COUNT(*) AS value
      FROM complaints comp
      JOIN competitors c ON c.competitor_id = comp.competitor_id
      WHERE c.user_id = $1
        AND c.competitor_id = $4
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY comp.canonical
      ORDER BY value DESC
      LIMIT 5;
    `,
    chartType: "bar",
  },
  "competitor-top-features-short": {
    key: "competitor-top-features-short",
    title: "Top 5 Features for Competitor",
    description: "Top 5 features for a specific competitor",
    query: `
      SELECT
        f.canonical AS name,
        'Features' AS label,
        COUNT(*) AS value
      FROM features f
      JOIN competitors c ON c.competitor_id = f.competitor_id
      WHERE c.user_id = $1
        AND c.competitor_id = $4
        AND ($2::timestamp is null OR f.last_updated >= $2)
        AND ($3::timestamp is null OR f.last_updated < $3)
      GROUP BY f.canonical
      ORDER BY value DESC
      LIMIT 5;
    `,
    chartType: "bar",
  },
  "competitor-top-alternatives-short": {
    key: "competitor-top-alternatives-short",
    title: "Top 5 Alternatives for Competitor",
    description: "Top 5 alternatives for a specific competitor",
    query: `
      SELECT 
        a.name AS name,
        'Alternatives' AS label,
        SUM(a.mentions_count) AS value
      FROM alternatives a
      JOIN competitors c ON c.competitor_id = a.competitor_id
      WHERE c.user_id = $1
        AND c.competitor_id = $4
        AND ($2::timestamp is null OR true)
        AND ($3::timestamp is null OR true)
      GROUP BY a.name
      ORDER BY value DESC
      LIMIT 5;
    `,
    chartType: "bar",
  },
  "competitor-recent-switching-leads": {
    key: "competitor-recent-switching-leads",
    title: "Recent Switching Leads for Competitor",
    description: "Recent leads with switching intent for a specific competitor",
    query: `
      SELECT 
        l.platform,
        l.username,
        l.excerpt,
        l.reason,
        l.created_at::date AS date,
        l.status
      FROM leads l
      JOIN analyzed_posts ap ON ap.id = l.analyzed_post_id
      JOIN competitors c ON c.competitor_id = ap.competitor_id
      WHERE l.user_id = $1
        AND c.competitor_id = $4
        AND l.created_at >= $2
        AND l.created_at < $3
      ORDER BY l.created_at DESC
      LIMIT 50;
    `,
    chartType: "table",
  },
  "competitor-complaint-trend": {
    key: "competitor-complaint-trend",
    title: "Complaint Trend for Competitor",
    description: "Daily complaint trend for a specific competitor",
    query: `
      SELECT
        date_trunc('day', comp.last_updated)::timestamptz AS date,
        COUNT(*) AS value,
        'Complaints' AS label
      FROM complaints comp
      JOIN competitors c ON c.competitor_id = comp.competitor_id
      WHERE c.user_id = $1
        AND c.competitor_id = $4
        AND comp.last_updated >= $2
        AND comp.last_updated < $3
      GROUP BY 1
      ORDER BY 1;
    `,
    chartType: "line",
  },
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
