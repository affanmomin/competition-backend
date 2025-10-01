// Constants for platform source IDs
export const PLATFORM_SOURCE_IDS = {
  TWITTER: "14cd087d-b4c2-4356-ae81-6cbec3c8acbf",
  LINKEDIN: "ddb82018-1361-428d-bcde-b0e4517ed28d",
  WEBSITE: "348977d6-18c5-4ba8-bbf6-3774d7ed6a30",
  GOOGLE_MAPS: "06ccac39-70bc-43ae-bfca-37590669e9e0",
  GOOGLE_PLAYSTORE: "feebc6ba-ea7f-4414-a111-fa15962eb03e",
} as const;

// Database error codes
export const DB_ERROR_CODES = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;
