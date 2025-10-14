/**
 * Test script for Redis and Queue system setup
 */

import { testRedisConnection } from "./src/services/redis-service";
import { getQueueService } from "./src/services/queue-service";

async function testQueueSetup() {
  console.log("🔧 Testing Queue System Setup...\n");

  // Test 1: Redis Connection
  console.log("1. Testing Redis Connection...");
  try {
    const redisHealthy = await testRedisConnection();
    console.log(`   ✅ Redis: ${redisHealthy ? "Connected" : "Not available"}`);
  } catch (error) {
    console.log(
      `   ❌ Redis: Error - ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Test 2: Queue Service Initialization
  console.log("\n2. Testing Queue Service...");
  try {
    const queueService = getQueueService();
    console.log("   ✅ Queue service initialized successfully");

    // Test queue health
    const health = await queueService.getQueueHealth();
    console.log("   📊 Queue Status:", {
      waiting: health.waiting,
      active: health.active,
      completed: health.completed,
      failed: health.failed,
      paused: health.paused,
    });
  } catch (error) {
    console.log(
      `   ❌ Queue Service: Error - ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Test 3: Manual Job Trigger
  console.log("\n3. Testing Manual Job Trigger...");
  try {
    const queueService = getQueueService();
    const job = await queueService.runReportNow("test", {
      message: "Hello from test!",
    });
    console.log(`   ✅ Job queued successfully with ID: ${job.id}`);
  } catch (error) {
    console.log(
      `   ❌ Job Trigger: Error - ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  console.log("\n🎉 Queue system setup test completed!");
  console.log("\n📝 Next Steps:");
  console.log(
    "   1. Install Redis: brew install redis (macOS) or docker run -p 6379:6379 redis:alpine",
  );
  console.log(
    "   2. Start Redis: brew services start redis or docker start <container>",
  );
  console.log("   3. Start server: pnpm run dev");
  console.log("   4. Test endpoints:");
  console.log("      - GET http://localhost:3000/queues/health");
  console.log("      - POST http://localhost:3000/queues/reports/run-now");
  console.log("      - GET http://localhost:3000/admin/queues (Bull Board UI)");

  process.exit(0);
}

testQueueSetup().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
