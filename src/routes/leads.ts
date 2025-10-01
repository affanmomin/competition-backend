import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import client from "../db";

interface UpdateLeadStatusBody {
  user_id: string;
  lead_id: string;
  status: "new" | "contacted" | "ignored" | "responded";
}

interface GetLeadsQuery {
  user_id: string;
  status?: "new" | "contacted" | "ignored" | "responded";
  platform?: string;
  limit?: string;
  offset?: string;
}

interface LeadParams {
  id: string;
}

export default async function leadsRoutes(fastify: FastifyInstance) {
  // Update lead status
  fastify.put<{ Body: UpdateLeadStatusBody }>(
    "/api/leads/status",
    async (
      request: FastifyRequest<{ Body: UpdateLeadStatusBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { user_id, lead_id, status } = request.body;

        // Validate required fields
        if (!user_id || !lead_id || !status) {
          return reply.code(400).send({
            error: "Missing required fields: user_id, lead_id, and status are required",
          });
        }

        // Validate status value
        const validStatuses = ["new", "contacted", "ignored","responded"];
        if (!validStatuses.includes(status)) {
          return reply.code(400).send({
            error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          });
        }

        // Update the lead status
        const updateQuery = `
          UPDATE public.leads 
          SET status = $1, updated_at = NOW()
          WHERE id = $2 AND user_id = $3
          RETURNING *
        `;

        const result = await client.query(updateQuery, [status, lead_id, user_id]);

        if (result.rows.length === 0) {
          return reply.code(404).send({
            error: "Lead not found or you do not have permission to update it",
          });
        }

        const updatedLead = result.rows[0];

        return reply.code(200).send({
          success: true,
          message: "Lead status updated successfully",
          data: updatedLead,
        });
      } catch (error: any) {
        console.error("Error updating lead status:", error);
        
        // Handle constraint violations
        if (error.code === "23514") { // Check constraint violation
          return reply.code(400).send({
            error: "Invalid status value. Must be 'new', 'contacted', 'ignored', or 'responded'",
          });
        }

        return reply.code(500).send({
          error: "Internal server error",
        });
      }
    },
  );

  // Get leads with filtering options
  fastify.get<{ Querystring: GetLeadsQuery }>(
    "/api/leads",
    async (
      request: FastifyRequest<{ Querystring: GetLeadsQuery }>,
      reply: FastifyReply,
    ) => {
      try {
        const { 
          user_id, 
          status, 
          platform, 
          limit = "50", 
          offset = "0" 
        } = request.query;

        // Validate required user_id
        if (!user_id) {
          return reply.code(400).send({
            error: "user_id is required",
          });
        }

        let query = `
          SELECT 
            l.*,
            ap.excerpt AS post_excerpt,
            ap.analyzed_at,
            c.name AS competitor_name,
            c.slug AS competitor_slug
          FROM public.leads l
          LEFT JOIN public.analyzed_posts ap ON ap.id = l.analyzed_post_id
          LEFT JOIN public.competitors c ON c.competitor_id = COALESCE(l.competitor_id, ap.competitor_id)
          WHERE l.user_id = $1
        `;

        const params: any[] = [user_id];
        let paramCount = 1;

        // Add status filter if provided
        if (status) {
          paramCount++;
          query += ` AND l.status = $${paramCount}`;
          params.push(status);
        }

        // Add platform filter if provided
        if (platform) {
          paramCount++;
          query += ` AND l.platform = $${paramCount}`;
          params.push(platform);
        }

        query += " ORDER BY l.created_at DESC";

        // Add pagination
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(parseInt(limit));

        paramCount++;
        query += ` OFFSET $${paramCount}`;
        params.push(parseInt(offset));

        const result = await client.query(query, params);

        return reply.code(200).send({
          success: true,
          data: result.rows,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            count: result.rows.length,
          },
          filters: {
            status: status || null,
            platform: platform || null,
          },
        });
      } catch (error: any) {
        console.error("Error fetching leads:", error);
        return reply.code(500).send({
          error: "Internal server error",
        });
      }
    },
  );

  // Get single lead by ID
  fastify.get<{ Params: LeadParams; Querystring: { user_id: string } }>(
    "/api/leads/:id",
    async (
      request: FastifyRequest<{ 
        Params: LeadParams; 
        Querystring: { user_id: string } 
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = request.params;
        const { user_id } = request.query;

        if (!user_id) {
          return reply.code(400).send({
            error: "user_id is required",
          });
        }

        const query = `
          SELECT 
            l.*,
            ap.excerpt AS post_excerpt,
            ap.analyzed_at,
            ap.platform AS post_platform,
            c.name AS competitor_name,
            c.slug AS competitor_slug
          FROM public.leads l
          LEFT JOIN public.analyzed_posts ap ON ap.id = l.analyzed_post_id
          LEFT JOIN public.competitors c ON c.competitor_id = COALESCE(l.competitor_id, ap.competitor_id)
          WHERE l.id = $1 AND l.user_id = $2
        `;

        const result = await client.query(query, [id, user_id]);

        if (result.rows.length === 0) {
          return reply.code(404).send({
            error: "Lead not found",
          });
        }

        return reply.code(200).send({
          success: true,
          data: result.rows[0],
        });
      } catch (error: any) {
        console.error("Error fetching lead:", error);
        return reply.code(500).send({
          error: "Internal server error",
        });
      }
    },
  );

  // Bulk update lead statuses
  fastify.put<{ 
    Body: { 
      user_id: string; 
      lead_ids: string[]; 
      status: "new" | "contacted" | "ignored" | "responded" 
    } 
  }>(
    "/api/leads/bulk-status",
    async (
      request: FastifyRequest<{ 
        Body: { 
          user_id: string; 
          lead_ids: string[]; 
          status: "new" | "contacted" | "ignored" | "responded" 
        } 
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { user_id, lead_ids, status } = request.body;

        // Validate required fields
        if (!user_id || !lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0 || !status) {
          return reply.code(400).send({
            error: "Missing required fields: user_id, lead_ids (non-empty array), and status are required",
          });
        }

        // Validate status value
        const validStatuses = ["new", "contacted", "ignored", "responded"];
        if (!validStatuses.includes(status)) {
          return reply.code(400).send({
            error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          });
        }

        // Validate lead_ids are UUIDs
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const invalidIds = lead_ids.filter(id => !uuidRegex.test(id));
        if (invalidIds.length > 0) {
          return reply.code(400).send({
            error: `Invalid UUID format for lead_ids: ${invalidIds.join(", ")}`,
          });
        }

        // Create placeholders for the IN clause
        const placeholders = lead_ids.map((_, index) => `$${index + 3}`).join(", ");

        const updateQuery = `
          UPDATE public.leads 
          SET status = $1, updated_at = NOW()
          WHERE user_id = $2 AND id IN (${placeholders})
          RETURNING id, status, username, platform
        `;

        const params = [status, user_id, ...lead_ids];
        const result = await client.query(updateQuery, params);

        return reply.code(200).send({
          success: true,
          message: `Updated ${result.rows.length} leads successfully`,
          data: {
            updated_count: result.rows.length,
            updated_leads: result.rows,
            requested_count: lead_ids.length,
          },
        });
      } catch (error: any) {
        console.error("Error bulk updating lead statuses:", error);
        
        // Handle constraint violations
        if (error.code === "23514") { // Check constraint violation
          return reply.code(400).send({
            error: "Invalid status value. Must be 'new', 'contacted', 'ignored', or 'responded'",
          });
        }

        return reply.code(500).send({
          error: "Internal server error",
        });
      }
    },
  );
}