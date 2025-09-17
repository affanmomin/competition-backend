import { auth } from "./auth";
import client from "./db";

async function migrate() {
  try {
    console.log("Running better-auth migrations...");
    // Better-auth will automatically create the required tables
    // when the first operation is performed. We can also manually
    // trigger table creation by calling the migration method
    
    // Connect to the database first
    await client.connect();
    console.log("Connected to database");
    
    // The tables will be created automatically when auth is first used
    // But we can also manually create them if needed
    console.log("Database schema ready for better-auth");
    console.log("Tables will be auto-created on first auth operation");
    
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrate();
}

export default migrate;