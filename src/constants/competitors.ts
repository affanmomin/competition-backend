// Constants for platform source IDs
export const PLATFORM_SOURCE_IDS = {
  TWITTER: "5d53c057-6e63-47c6-9301-192a3b9fa1d4",
  LINKEDIN: "4a267045-dbfc-432c-96a5-17a9da542248",
  WEBSITE: "da6acd0d-7b5e-4aec-8d0c-9126220a8341",
  GOOGLE_MAPS: "8e7857f1-d153-4470-bd6a-cf4ad79bb8fe",
  GOOGLE_PLAYSTORE: "4ee3988d-70a4-4dd4-8708-5441de698a38",
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
