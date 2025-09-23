import { describe, it, expect, beforeAll, afterAll } from "node:test";
import { build } from "../server";

describe("Gemini API Routes", () => {
  let app: any;

  beforeAll(async () => {
    app = build();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/gemini/health", () => {
    it("should return health status", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/gemini/health"
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("api_key_configured");
    });
  });

  describe("POST /api/gemini/analyze", () => {
    it("should validate request body", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/gemini/analyze",
        payload: {
          // Missing required dataset field
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain("validation");
    });

    it("should require dataset array", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/gemini/analyze",
        payload: {
          dataset: "not an array"
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /api/gemini/generate", () => {
    it("should validate request body", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/gemini/generate",
        payload: {
          // Missing required text field
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain("validation");
    });

    it("should require text field", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/gemini/generate",
        payload: {
          text: ""
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
