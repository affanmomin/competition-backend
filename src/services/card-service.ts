import { QueryParams, getQueryConfig } from "./query-registry";
import db from "../db";

export interface ExtendedQueryParams extends QueryParams {
  competitor_id?: string;
}

export class CardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CardError";
  }
}

export class CardService {
  /**
   * Execute a card query by its key
   */
  async executeQuery(queryKey: string, params: QueryParams): Promise<any> {
    const queryConfig = getQueryConfig(queryKey);
    if (!queryConfig) {
      throw new CardError(`Query not found: ${queryKey}`);
    }

    try {
      // Execute the query using your database connection
      const result = await db.query(queryConfig.query, [
        params.user_id,
        params.start_date || null,
        params.end_date || null,
      ]);

      return {
        key: queryConfig.key,
        title: queryConfig.title,
        description: queryConfig.description,
        chartType: queryConfig.chartType,
        data: result.rows,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.log(error);
      throw new CardError(
        `Failed to execute query ${queryKey}: ${errorMessage}`,
      );
    }
  }

  /**
   * Execute multiple card queries in parallel
   */
  async executeQueries(
    queryKeys: string[],
    params: QueryParams,
  ): Promise<any[]> {
    const queries = queryKeys.map((key) => this.executeQuery(key, params));
    return Promise.all(queries);
  }

  /**
   * Execute a competitor-specific card query with extended parameters
   */
  async executeCompetitorQuery(
    queryKey: string,
    params: ExtendedQueryParams,
  ): Promise<any> {
    const queryConfig = getQueryConfig(queryKey);
    if (!queryConfig) {
      throw new CardError(`Query not found: ${queryKey}`);
    }

    try {
      // Build parameters array - competitor queries expect competitor_id as 4th parameter
      const queryParams = [
        params.user_id,
        params.start_date || null,
        params.end_date || null,
        params.competitor_id,
      ];

      // Execute the query using your database connection
      const result = await db.query(queryConfig.query, queryParams);

      return {
        key: queryConfig.key,
        title: queryConfig.title,
        description: queryConfig.description,
        chartType: queryConfig.chartType,
        data: result.rows,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.log(error);
      throw new CardError(
        `Failed to execute competitor query ${queryKey}: ${errorMessage}`,
      );
    }
  }

  /**
   * Execute multiple competitor-specific card queries in parallel
   */
  async executeCompetitorQueries(
    queryKeys: string[],
    params: ExtendedQueryParams,
  ): Promise<Record<string, any>> {
    const queries = queryKeys.map((key) =>
      this.executeCompetitorQuery(key, params),
    );
    const results = await Promise.all(queries);

    // Convert array to object with query keys as keys
    const resultMap: Record<string, any> = {};
    results.forEach((result) => {
      resultMap[result.key] = result;
    });

    return resultMap;
  }
}

// Export singleton instance
export const cardService = new CardService();
