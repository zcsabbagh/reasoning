import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function addFinalScoreColumn() {
  try {
    await pool.query('ALTER TABLE test_sessions ADD COLUMN IF NOT EXISTS final_score INTEGER');
    console.log('Successfully added final_score column to test_sessions table');
  } catch (error) {
    console.error('Error adding column:', error);
  } finally {
    await pool.end();
  }
}

addFinalScoreColumn();