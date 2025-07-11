const { Pool } = require('@neondatabase/serverless');
const ws = require('ws');

// Configure neon for serverless WebSocket
const neonConfig = require('@neondatabase/serverless').neonConfig;
neonConfig.webSocketConstructor = ws;

async function seedV1Exam() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not found');
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('Seeding V1 exam...');
    
    // Check if exam already exists
    const existingExam = await pool.query('SELECT id FROM exams LIMIT 1');
    
    if (existingExam.rows.length > 0) {
      console.log('Sample exam already exists, skipping');
      return;
    }
    
    // Create sample exam
    const examResult = await pool.query(`
      INSERT INTO exams (title, description, total_stages) 
      VALUES ($1, $2, $3) 
      RETURNING id
    `, ['Historical Counterfactual Analysis', 'Analyze alternative historical scenarios and their potential impacts', 3]);
    
    const examId = examResult.rows[0].id;
    console.log('Created exam with ID:', examId);
    
    // Create exam questions
    const questions = [
      {
        stageNumber: 1,
        promptText: 'Consider the scenario: The printing press was never invented. What assumptions would you make about how this might have affected European society by 1600? Please list 3 key assumptions and explain your reasoning.',
        stageType: 'assumption'
      },
      {
        stageNumber: 2,
        promptText: 'Based on your assumptions, what strategic question would you ask to better understand the implications of this scenario?',
        stageType: 'questioning'
      },
      {
        stageNumber: 3,
        promptText: 'Now synthesize your assumptions and question into a comprehensive analysis of how European society might have developed differently without the printing press.',
        stageType: 'synthesis'
      }
    ];
    
    for (const question of questions) {
      await pool.query(`
        INSERT INTO exam_questions (exam_id, stage_number, prompt_text, stage_type) 
        VALUES ($1, $2, $3, $4)
      `, [examId, question.stageNumber, question.promptText, question.stageType]);
    }
    
    console.log('V1 exam seeded successfully!');
  } catch (error) {
    console.error('Error seeding V1 exam:', error);
  } finally {
    await pool.end();
  }
}

seedV1Exam();