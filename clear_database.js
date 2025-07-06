import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function clearDatabase() {
  try {
    // Delete all test sessions
    await pool.query('DELETE FROM test_sessions');
    console.log('Cleared all test sessions');
    
    // Delete all chat messages
    await pool.query('DELETE FROM chat_messages');
    console.log('Cleared all chat messages');
    
    // Reset user scores to default
    await pool.query('UPDATE users SET total_score = 20');
    console.log('Reset all user scores to default');
    
    console.log('Database cleared successfully');
  } catch (error) {
    console.error('Error clearing database:', error);
  } finally {
    await pool.end();
  }
}

clearDatabase();