import { auth } from "./auth";
import client from "./db";
import * as fs from 'fs';
import * as path from 'path';

async function migrate() {
  try {
    console.log("Running database migrations...");
    
    // Connect to the database first
    await client.connect();
    console.log("Connected to database");
    
    // Run payment schema migration
    console.log("Creating payment tables...");
    const paymentSchema = fs.readFileSync(
      path.join(__dirname, 'sql', 'payment_schema.sql'),
      'utf8'
    );
    await client.query(paymentSchema);
    console.log("Payment tables created successfully");
    
    // Better-auth tables will be created automatically when auth is first used
    console.log("Database schema ready for better-auth");
    console.log("Auth tables will be auto-created on first auth operation");
    
    console.log("All migrations completed successfully");
    
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