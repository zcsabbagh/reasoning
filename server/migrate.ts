import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

// Database connection with proper URL encoding
const databaseUrl = process.env.DATABASE_URL!;
const client = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false }
});
const db = drizzle(client);

async function migrate() {
  try {
    console.log("Starting database migration...");
    
    // Create users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" serial PRIMARY KEY NOT NULL,
        "linkedin_id" text NOT NULL,
        "email" text NOT NULL,
        "first_name" text NOT NULL,
        "last_name" text NOT NULL,
        "profile_picture_url" text,
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "users_linkedin_id_unique" UNIQUE("linkedin_id")
      )
    `);
    
    // Add user_id column to test_sessions table
    await db.execute(sql`
      ALTER TABLE "test_sessions" ADD COLUMN IF NOT EXISTS "user_id" integer
    `);
    
    // Add foreign key constraint
    await db.execute(sql`
      ALTER TABLE "test_sessions" 
      ADD CONSTRAINT IF NOT EXISTS "test_sessions_user_id_users_id_fk" 
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
    `);
    
    console.log("Database migration completed successfully!");
    
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

migrate().catch(console.error);