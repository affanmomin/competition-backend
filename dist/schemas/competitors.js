"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteCompetitorSchema = exports.UpdateCompetitorSourcesSchema = exports.CompetitorQuerySchema = exports.CompetitorCreateSchema = exports.PlatformDataSchema = void 0;
const zod_1 = require("zod");
// Platform data schema
exports.PlatformDataSchema = zod_1.z.object({
    source_id: zod_1.z.string().min(1, "source_id is required"),
    username: zod_1.z.string().optional(),
});
// Competitor creation schema
exports.CompetitorCreateSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1, "Name is required"),
    user_id: zod_1.z.string().min(1, "User ID is required"),
    is_user: zod_1.z.boolean().optional().default(false),
    platforms: zod_1.z.array(exports.PlatformDataSchema).optional(),
    source_ids: zod_1.z.array(zod_1.z.string()).optional(), // For backward compatibility
})
    .refine((data) => (data.platforms && data.platforms.length > 0) ||
    (data.source_ids && data.source_ids.length > 0), { message: "At least one platform or source_id is required" });
// Competitor query schema
exports.CompetitorQuerySchema = zod_1.z.object({
    user_id: zod_1.z.string().optional(),
    limit: zod_1.z.string().regex(/^\d+$/).default("50").transform(Number),
    offset: zod_1.z.string().regex(/^\d+$/).default("0").transform(Number),
});
// Competitor update sources schema
exports.UpdateCompetitorSourcesSchema = zod_1.z.object({
    user_id: zod_1.z.string().optional(),
    competitor_id: zod_1.z.string().min(1, "competitor_id is required"),
    platforms: zod_1.z
        .array(exports.PlatformDataSchema)
        .min(1, "At least one platform is required"),
});
// Delete competitor schema
exports.DeleteCompetitorSchema = zod_1.z.object({
    user_id: zod_1.z.string().optional(),
});
