import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log('Initializing database connection...');
console.log('DATABASE_URL format:', process.env.DATABASE_URL ? 'exists' : 'missing');

// Fix URL encoding issues with special characters in password
let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.includes('College2018/19')) {
  // URL encode the password portion
  connectionString = connectionString.replace('College2018/19', 'College2018%2F19');
  console.log('Fixed database URL encoding for special characters');
}

export const pool = new Pool({ 
  connectionString: connectionString,
  connectionTimeoutMillis: 10000, // 10 second timeout
  max: 10 // Maximum number of connections
});

export const db = drizzle({ client: pool, schema });
