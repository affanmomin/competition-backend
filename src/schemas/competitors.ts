import { z } from "zod";

// Platform data schema
export const PlatformDataSchema = z.object({
  source_id: z.string().min(1, "source_id is required"),
  username: z.string().optional(),
});

// Competitor creation schema
export const CompetitorCreateSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    user_id: z.string().min(1, "User ID is required"),
    is_user: z.boolean().optional().default(false),
    platforms: z.array(PlatformDataSchema).optional(),
    source_ids: z.array(z.string()).optional(), // For backward compatibility
  })
  .refine(
    (data) =>
      (data.platforms && data.platforms.length > 0) ||
      (data.source_ids && data.source_ids.length > 0),
    { message: "At least one platform or source_id is required" },
  );

// Competitor query schema
export const CompetitorQuerySchema = z.object({
  user_id: z.string().optional(),
  limit: z.string().regex(/^\d+$/).default("50").transform(Number),
  offset: z.string().regex(/^\d+$/).default("0").transform(Number),
});

// Competitor update sources schema
export const UpdateCompetitorSourcesSchema = z.object({
  user_id: z.string().optional(),
  competitor_id: z.string().min(1, "competitor_id is required"),
  platforms: z
    .array(PlatformDataSchema)
    .min(1, "At least one platform is required"),
});

// Delete competitor schema
export const DeleteCompetitorSchema = z.object({
  user_id: z.string().optional(),
});

// Type exports
export type PlatformData = z.infer<typeof PlatformDataSchema>;
export type CompetitorCreateBody = z.infer<typeof CompetitorCreateSchema>;
export type CompetitorQuery = z.infer<typeof CompetitorQuerySchema>;
export type UpdateCompetitorSourcesBody = z.infer<
  typeof UpdateCompetitorSourcesSchema
>;
export type DeleteCompetitorBody = z.infer<typeof DeleteCompetitorSchema>;
