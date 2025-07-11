import { 
  testSessions, 
  chatMessages, 
  users,
  questions,
  exams,
  examQuestions,
  userSessions,
  responses,
  aiResponses,
  type TestSession, 
  type ChatMessage, 
  type InsertTestSession, 
  type InsertChatMessage,
  type User,
  type InsertUser,
  type Question,
  type InsertQuestion,
  type Exam,
  type InsertExam,
  type ExamQuestion,
  type InsertExamQuestion,
  type UserSession,
  type InsertUserSession,
  type Response,
  type InsertResponse,
  type AiResponse,
  type InsertAiResponse
} from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql, desc } from "drizzle-orm";

export interface IStorage {
  // Test Sessions
  createTestSession(session: InsertTestSession): Promise<TestSession>;
  getTestSession(id: number): Promise<TestSession | undefined>;
  updateTestSession(id: number, updates: Partial<TestSession>): Promise<TestSession | undefined>;
  getUserSessions(userId: number): Promise<TestSession[]>;
  
  // Chat Messages
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessagesBySession(sessionId: number): Promise<ChatMessage[]>;
  
  // Users
  createUser(user: InsertUser): Promise<User>;
  getUserByLinkedInId(linkedinId: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  updateUserScore(userId: number, totalScore: number): Promise<User | undefined>;
  getLeaderboard(limit?: number): Promise<User[]>;
  
  // Questions
  createQuestion(question: InsertQuestion): Promise<Question>;
  getRandomQuestion(): Promise<Question | undefined>;
  getAllQuestions(): Promise<Question[]>;
  
  // Version 1 Exams
  createExam(exam: InsertExam): Promise<Exam>;
  getExam(id: number): Promise<Exam | undefined>;
  getAllExams(): Promise<Exam[]>;
  
  // Version 1 Exam Questions
  createExamQuestion(examQuestion: InsertExamQuestion): Promise<ExamQuestion>;
  getExamQuestionsByExam(examId: number): Promise<ExamQuestion[]>;
  getExamQuestionByStage(examId: number, stageNumber: number): Promise<ExamQuestion | undefined>;
  
  // Version 1 User Sessions
  createUserSession(userSession: InsertUserSession): Promise<UserSession>;
  getUserSession(id: number): Promise<UserSession | undefined>;
  updateUserSession(id: number, updates: Partial<UserSession>): Promise<UserSession | undefined>;
  getUserSessionsByUser(userId: number): Promise<UserSession[]>;
  
  // Version 1 Responses
  createResponse(response: InsertResponse): Promise<Response>;
  getResponsesBySession(sessionId: number): Promise<Response[]>;
  
  // Version 1 AI Responses
  createAiResponse(aiResponse: InsertAiResponse): Promise<AiResponse>;
  getAiResponsesBySession(sessionId: number): Promise<AiResponse[]>;
}

export class MemStorage implements IStorage {
  private testSessions: Map<number, TestSession>;
  private chatMessages: Map<number, ChatMessage>;
  private users: Map<number, User>;
  private questions: Map<number, Question>;
  private currentSessionId: number;
  private currentMessageId: number;
  private currentUserId: number;
  private currentQuestionId: number;

  constructor() {
    this.testSessions = new Map();
    this.chatMessages = new Map();
    this.users = new Map();
    this.questions = new Map();
    this.currentSessionId = 1;
    this.currentMessageId = 1;
    this.currentUserId = 1;
    this.currentQuestionId = 1;
  }

  async createTestSession(insertSession: InsertTestSession): Promise<TestSession> {
    const id = this.currentSessionId++;
    const session: TestSession = { 
      id,
      userId: insertSession.userId || null,
      taskQuestion: insertSession.taskQuestion,
      finalAnswer: insertSession.finalAnswer || null,
      timeRemaining: insertSession.timeRemaining || 600,
      questionsAsked: insertSession.questionsAsked || 0,
      isSubmitted: insertSession.isSubmitted || false,
      baseScore: insertSession.baseScore || 25,
      questionPenalty: insertSession.questionPenalty || 0,
      infoGainBonus: insertSession.infoGainBonus || 0,
      finalScore: null, // Will be set after grading
      currentQuestionIndex: insertSession.currentQuestionIndex || 0,
      allQuestions: insertSession.allQuestions || [insertSession.taskQuestion],
      allAnswers: insertSession.allAnswers || ["", "", ""],
      createdAt: new Date()
    };
    this.testSessions.set(id, session);
    return session;
  }

  async getTestSession(id: number): Promise<TestSession | undefined> {
    return this.testSessions.get(id);
  }

  async updateTestSession(id: number, updates: Partial<TestSession>): Promise<TestSession | undefined> {
    const session = this.testSessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.testSessions.set(id, updatedSession);
    return updatedSession;
  }

  async getUserSessions(userId: number): Promise<TestSession[]> {
    const userSessions: TestSession[] = [];
    const sessionsArray = Array.from(this.testSessions.values());
    for (const session of sessionsArray) {
      if (session.userId === userId) {
        userSessions.push(session);
      }
    }
    // Sort by creation date (most recent first)
    return userSessions.sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = this.currentMessageId++;
    const message: ChatMessage = {
      ...insertMessage,
      id,
      timestamp: new Date()
    };
    this.chatMessages.set(id, message);
    return message;
  }

  async getChatMessagesBySession(sessionId: number): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter(message => message.sessionId === sessionId)
      .sort((a, b) => a.timestamp!.getTime() - b.timestamp!.getTime());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      id,
      linkedinId: insertUser.linkedinId,
      email: insertUser.email,
      firstName: insertUser.firstName,
      lastName: insertUser.lastName,
      profilePictureUrl: insertUser.profilePictureUrl || null,
      totalScore: insertUser.totalScore || 20,
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async getUserByLinkedInId(linkedinId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.linkedinId === linkedinId);
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async updateUserScore(userId: number, totalScore: number): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (user) {
      user.totalScore = totalScore;
      this.users.set(userId, user);
    }
    return user;
  }

  async getLeaderboard(limit: number = 10): Promise<User[]> {
    const allUsers = Array.from(this.users.values());
    return allUsers
      .sort((a, b) => (b.totalScore || 20) - (a.totalScore || 20))
      .slice(0, limit);
  }

  // Question methods for MemStorage
  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const id = this.currentQuestionId++;
    const question: Question = {
      id,
      questionText: insertQuestion.questionText,
      rubric: insertQuestion.rubric,
      isActive: insertQuestion.isActive ?? true,
      createdAt: new Date(),
    };
    this.questions.set(id, question);
    return question;
  }

  async getRandomQuestion(): Promise<Question | undefined> {
    const activeQuestions = Array.from(this.questions.values()).filter(q => q.isActive);
    if (activeQuestions.length === 0) return undefined;
    const randomIndex = Math.floor(Math.random() * activeQuestions.length);
    return activeQuestions[randomIndex];
  }

  async getAllQuestions(): Promise<Question[]> {
    return Array.from(this.questions.values()).filter(q => q.isActive);
  }

  // V1 Exam methods for MemStorage (stubs)
  async createExam(insertExam: InsertExam): Promise<Exam> {
    throw new Error("V1 exams not supported in memory storage");
  }

  async getExam(id: number): Promise<Exam | undefined> {
    throw new Error("V1 exams not supported in memory storage");
  }

  async getAllExams(): Promise<Exam[]> {
    throw new Error("V1 exams not supported in memory storage");
  }

  async createExamQuestion(insertExamQuestion: InsertExamQuestion): Promise<ExamQuestion> {
    throw new Error("V1 exams not supported in memory storage");
  }

  async getExamQuestionsByExam(examId: number): Promise<ExamQuestion[]> {
    throw new Error("V1 exams not supported in memory storage");
  }

  async getExamQuestionByStage(examId: number, stageNumber: number): Promise<ExamQuestion | undefined> {
    throw new Error("V1 exams not supported in memory storage");
  }

  async createUserSession(insertUserSession: InsertUserSession): Promise<UserSession> {
    throw new Error("V1 exams not supported in memory storage");
  }

  async getUserSession(id: number): Promise<UserSession | undefined> {
    throw new Error("V1 exams not supported in memory storage");
  }

  async updateUserSession(id: number, updates: Partial<UserSession>): Promise<UserSession | undefined> {
    throw new Error("V1 exams not supported in memory storage");
  }

  async getUserSessionsByUser(userId: number): Promise<UserSession[]> {
    throw new Error("V1 exams not supported in memory storage");
  }

  async createResponse(insertResponse: InsertResponse): Promise<Response> {
    throw new Error("V1 exams not supported in memory storage");
  }

  async getResponsesBySession(sessionId: number): Promise<Response[]> {
    throw new Error("V1 exams not supported in memory storage");
  }

  async createAiResponse(insertAiResponse: InsertAiResponse): Promise<AiResponse> {
    throw new Error("V1 exams not supported in memory storage");
  }

  async getAiResponsesBySession(sessionId: number): Promise<AiResponse[]> {
    throw new Error("V1 exams not supported in memory storage");
  }
}

// PostgreSQL Storage Implementation
export class PostgresStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;
  private queryClient: ReturnType<typeof postgres>;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for PostgreSQL storage");
    }
    
    // Handle URL encoding for special characters in password
    let connectionString = process.env.DATABASE_URL;
    
    // Parse and reconstruct URL to handle special characters like / in password
    const urlMatch = connectionString.match(/postgresql:\/\/([^:]+):([^@]+)@(.+)/);
    if (urlMatch) {
      const [, username, password, hostAndDb] = urlMatch;
      // Encode the password properly, handling special characters like /
      const encodedPassword = encodeURIComponent(password);
      connectionString = `postgresql://${username}:${encodedPassword}@${hostAndDb}`;
      console.log("Database URL after encoding (password hidden):", connectionString.replace(/:([^@]+)@/, ':***@'));
    }
    
    // Create connection with improved stability settings
    this.queryClient = postgres(connectionString, {
      max: 20, // Increased max connections for better handling
      idle_timeout: 30, // 30 second idle timeout
      connect_timeout: 30, // 30 second connection timeout
      max_lifetime: 60 * 30, // 30 minute max connection lifetime
      onnotice: () => {}, // Suppress PostgreSQL notices
      transform: {
        undefined: null // Transform undefined to null for PostgreSQL compatibility
      },
      debug: false, // Disable debug logging in production
      // Add retry logic for connection failures
      retry: {
        initialDelay: 1000,
        multiplier: 1.5,
        maxDelay: 10000,
        maxAttempts: 3
      }
    });
    
    this.db = drizzle(this.queryClient);
    this.initializeSchema();
  }

  private async initializeSchema() {
    try {
      // Create users table if it doesn't exist
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "users" (
          "id" serial PRIMARY KEY NOT NULL,
          "linkedin_id" text NOT NULL,
          "email" text NOT NULL,
          "first_name" text NOT NULL,
          "last_name" text NOT NULL,
          "profile_picture_url" text,
          "total_score" integer NOT NULL DEFAULT 20,
          "created_at" timestamp DEFAULT now(),
          CONSTRAINT "users_linkedin_id_unique" UNIQUE("linkedin_id")
        )
      `);
      
      // Add total_score column if it doesn't exist (for existing tables)
      await this.db.execute(sql`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "total_score" integer NOT NULL DEFAULT 20
      `);
      
      // Add user_id column to test_sessions table if it doesn't exist
      await this.db.execute(sql`
        ALTER TABLE "test_sessions" ADD COLUMN IF NOT EXISTS "user_id" integer
      `);
      
      // Add final_score column to test_sessions table if it doesn't exist
      await this.db.execute(sql`
        ALTER TABLE "test_sessions" ADD COLUMN IF NOT EXISTS "final_score" integer
      `);

      // Add new auto-save and timer tracking columns
      await this.db.execute(sql`
        ALTER TABLE "test_sessions" ADD COLUMN IF NOT EXISTS "current_answer_draft" text NOT NULL DEFAULT ''
      `);
      
      await this.db.execute(sql`
        ALTER TABLE "test_sessions" ADD COLUMN IF NOT EXISTS "question_start_times" text[]
      `);
      
      await this.db.execute(sql`
        ALTER TABLE "test_sessions" ADD COLUMN IF NOT EXISTS "question_time_elapsed" integer[] NOT NULL DEFAULT '{0,0,0}'
      `);
      
      await this.db.execute(sql`
        ALTER TABLE "test_sessions" ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp DEFAULT now()
      `);

      // Create questions table with explicit environment logging
      console.log("Creating questions table in environment:", process.env.NODE_ENV || 'development');
      console.log("Database URL prefix:", process.env.DATABASE_URL?.substring(0, 30) + '...');
      
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "questions" (
          "id" serial PRIMARY KEY NOT NULL,
          "question_text" text NOT NULL,
          "rubric" text NOT NULL,
          "is_active" boolean NOT NULL DEFAULT true,
          "created_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      
      // Force table verification with detailed logging
      try {
        const result = await this.db.execute(sql`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'questions'
        `);
        
        console.log("Questions table check result:", result);
        
        if (result && result.rows && result.rows.length > 0) {
          console.log("Questions table CONFIRMED to exist");
        } else {
          console.log("WARNING: Questions table not found, forcing recreation");
          // Force recreate if not found
          await this.db.execute(sql`
            DROP TABLE IF EXISTS "questions";
            CREATE TABLE "questions" (
              "id" serial PRIMARY KEY NOT NULL,
              "question_text" text NOT NULL,
              "rubric" text NOT NULL,
              "is_active" boolean NOT NULL DEFAULT true,
              "created_at" timestamp DEFAULT now() NOT NULL
            )
          `);
          console.log("Questions table recreated forcefully");
        }
      } catch (error) {
        console.log("Questions table verification failed:", error);
        console.log("Attempting to recreate questions table...");
        try {
          await this.db.execute(sql`
            DROP TABLE IF EXISTS "questions";
            CREATE TABLE "questions" (
              "id" serial PRIMARY KEY NOT NULL,
              "question_text" text NOT NULL,
              "rubric" text NOT NULL,
              "is_active" boolean NOT NULL DEFAULT true,
              "created_at" timestamp DEFAULT now() NOT NULL
            )
          `);
          console.log("Questions table recreated after error");
        } catch (recreateError) {
          console.error("Failed to recreate questions table:", recreateError);
        }
      }
      
      // Create Version 1 Exam tables
      await this.createV1ExamTables();
      
      // Seed questions if database is empty
      await this.seedQuestions();
      
      console.log("Database schema initialized successfully");
    } catch (error) {
      console.error("Error initializing database schema:", error);
    }
  }

  private async createV1ExamTables() {
    try {
      console.log("Creating Version 1 Exam tables...");
      
      // Create exams table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "exams" (
          "id" serial PRIMARY KEY NOT NULL,
          "title" text NOT NULL,
          "description" text NOT NULL,
          "total_stages" integer NOT NULL DEFAULT 3,
          "created_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      
      // Create exam_questions table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "exam_questions" (
          "id" serial PRIMARY KEY NOT NULL,
          "exam_id" integer NOT NULL,
          "stage_number" integer NOT NULL,
          "prompt_text" text NOT NULL,
          "stage_type" text NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE
        )
      `);
      
      // Create user_sessions table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "user_sessions" (
          "id" serial PRIMARY KEY NOT NULL,
          "user_id" integer NOT NULL,
          "exam_id" integer NOT NULL,
          "current_stage" integer NOT NULL DEFAULT 1,
          "questions_asked" integer NOT NULL DEFAULT 0,
          "user_path" text,
          "started_at" timestamp DEFAULT now() NOT NULL,
          "completed_at" timestamp,
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
          FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE
        )
      `);
      
      // Create responses table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "responses" (
          "id" serial PRIMARY KEY NOT NULL,
          "session_id" integer NOT NULL,
          "stage_number" integer NOT NULL,
          "response_text" text NOT NULL,
          "response_type" text NOT NULL,
          "timestamp" timestamp DEFAULT now() NOT NULL,
          "ai_evaluation" text,
          "score" integer,
          FOREIGN KEY ("session_id") REFERENCES "user_sessions"("id") ON DELETE CASCADE
        )
      `);
      
      // Create ai_responses table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "ai_responses" (
          "id" serial PRIMARY KEY NOT NULL,
          "session_id" integer NOT NULL,
          "stage_number" integer NOT NULL,
          "response_text" text NOT NULL,
          "path_type" text,
          "timestamp" timestamp DEFAULT now() NOT NULL,
          FOREIGN KEY ("session_id") REFERENCES "user_sessions"("id") ON DELETE CASCADE
        )
      `);
      
      // Seed a sample exam
      await this.seedSampleExam();
      
      console.log("Version 1 Exam tables created successfully");
    } catch (error) {
      console.error("Error creating Version 1 Exam tables:", error);
    }
  }
  
  private async seedSampleExam() {
    try {
      // Check if exam already exists
      const existingExam = await this.db.execute(sql`
        SELECT COUNT(*) as count FROM exams
      `);
      
      const examCount = existingExam.rows?.[0]?.count || 0;
      
      if (examCount > 0) {
        console.log("Sample exam already exists, skipping...");
        return;
      }
      
      // Create sample exam
      const examResult = await this.db.execute(sql`
        INSERT INTO exams (title, description, total_stages)
        VALUES ('Historical Counterfactual Analysis', 'Analyze alternative historical scenarios and their potential impacts', 3)
        RETURNING id
      `);
      
      const examId = examResult.rows?.[0]?.id;
      
      if (!examId) {
        console.error("Failed to create sample exam");
        return;
      }
      
      // Create exam questions
      await this.db.execute(sql`
        INSERT INTO exam_questions (exam_id, stage_number, prompt_text, stage_type)
        VALUES 
          (${examId}, 1, 'Consider the scenario: The printing press was never invented. What assumptions would you make about how this might have affected European society by 1600? Please list 3 key assumptions and explain your reasoning.', 'assumption'),
          (${examId}, 2, 'Based on your assumptions, what strategic question would you ask to better understand the implications of this scenario?', 'questioning'),
          (${examId}, 3, 'Synthesize your understanding: How would the absence of the printing press have fundamentally altered the course of European history?', 'synthesis')
      `);
      
      console.log("Sample exam seeded successfully");
    } catch (error) {
      console.error("Error seeding sample exam:", error);
    }
  }

  private async seedQuestions() {
    try {
      // Check if questions already exist - using raw SQL to avoid schema issues
      try {
        const existingQuestions = await this.db.execute(sql`
          SELECT COUNT(*) as count FROM questions
        `);
        
        const questionCount = existingQuestions.rows?.[0]?.count || 0;
        
        if (questionCount > 0) {
          console.log("Questions already seeded, skipping...");
          return;
        }
      } catch (error) {
        console.log("Could not check existing questions, proceeding with seeding:", error);
      }

      const questionsToSeed = [
        {
          questionText: 'Assume the printing press never spread beyond Mainz after 1450. Pick one European region and outline two major political or cultural consequences that would likely emerge by 1700. Explain your causal chain in ≤ 250 words.',
          rubric: 'You are the grader. Question text: "Assume the printing press never spread beyond Mainz after 1450. Pick one European region and outline two major political or cultural consequences by 1700 (≤250 words)." SCORING STEPS 1. Assess the final answer\'s quality Q on a 1–5 scale: 5 = insightful, well-sourced causal chain, both consequences plausible and detailed. 4 = largely correct, minor evidence gaps. 3 = plausible but shallow, some logical leaps. 2 = major inaccuracies or vague links. 1 = off-topic or incorrect. 2. Clarifying-question penalty: subtract 1 point for **each** clarifying question the candidate asked (max 3). 3. Info-gain bonus: for **each** question that demonstrably raised Q by ≥ 1 level (compare to the draft before that question), add +1 point. 4. Compute final score = (Q × 5) – (question penalties) + (info-gain bonuses). Cap at 25; minimum 0. Return integer.',
          isActive: true
        },
        {
          questionText: 'A mid-sized city (pop. 1 million) must cut peak-hour traffic delays by 40% in five years without expanding road capacity or public-transport budgets. Propose two innovative policy or technology interventions and explain the causal chain that achieves the target (≤ 250 words).',
          rubric: 'You are the grader. Question text: "A mid-sized city must cut peak-hour traffic delays by 40% in five years without expanding road capacity or public-transport budgets. Propose two innovative interventions (≤250 words)." SCORING STEPS 1. Assess the final answer\'s quality Q on a 1–5 scale: 5 = innovative, feasible interventions with clear causal chains to 40% reduction. 4 = solid proposals, minor implementation gaps. 3 = plausible but lacks detail on achieving target. 2 = weak interventions or unrealistic assumptions. 1 = off-topic or incorrect. 2. Clarifying-question penalty: subtract 1 point for **each** clarifying question the candidate asked (max 3). 3. Info-gain bonus: for **each** question that demonstrably raised Q by ≥ 1 level (compare to the draft before that question), add +1 point. 4. Compute final score = (Q × 5) – (question penalties) + (info-gain bonuses). Cap at 25; minimum 0. Return integer.',
          isActive: true
        },
        {
          questionText: 'Scientists discover a fast-growing algae strain that produces high-yield bio-fuel but aggressively out-competes local aquatic life. Devise two balanced strategies that allow commercial fuel production and protect ecosystem health (≤ 250 words). Explain your reasoning.',
          rubric: 'You are the grader. Question text: "Scientists discover a bio-fuel algae strain that crowds out local species. Devise two balanced strategies allowing fuel production and ecosystem protection (≤250 words)." SCORING STEPS 1. Quality Q (1-5): 5 = innovative, evidence-aware strategies; explains ecological and commercial trade-offs. 4 = solid, realistic plans with minor gaps. 3 = some feasibility or ecological concerns unaddressed. 2 = speculative or weak linkage to goals. 1 = irrelevant or wrong. 2. –1 point per clarifying question asked. 3. +1 point per question that raises Q by at least one level. 4. Score = (Q × 5) – penalties + bonuses (bounded 0–25).',
          isActive: true
        }
      ];

      // Insert questions using raw SQL to avoid schema issues during initialization
      for (const questionData of questionsToSeed) {
        await this.db.execute(sql`
          INSERT INTO questions (question_text, rubric, is_active) 
          VALUES (${questionData.questionText}, ${questionData.rubric}, ${questionData.isActive})
        `);
      }

      console.log(`Seeded ${questionsToSeed.length} questions successfully`);
    } catch (error) {
      console.error("Error seeding questions:", error);
    }
  }

  async createTestSession(insertSession: InsertTestSession): Promise<TestSession> {
    try {
      console.log("PostgresStorage.createTestSession called with:", JSON.stringify(insertSession, null, 2));
      console.log("Database connection status:", this.db ? "connected" : "not connected");
      
      const [session] = await this.db
        .insert(testSessions)
        .values(insertSession)
        .returning();
        
      console.log("PostgresStorage.createTestSession successful:", session);
      return session;
    } catch (error) {
      console.error("PostgresStorage.createTestSession failed:");
      console.error("Error type:", typeof error);
      console.error("Error message:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack');
      console.error("Insert data:", JSON.stringify(insertSession, null, 2));
      
      // If database error, try to reconnect
      if (error instanceof Error && error.message.includes('connection')) {
        console.log("Database connection error detected, attempting to reconnect...");
        try {
          await this.queryClient.end();
          // Reinitialize connection
          this.queryClient = postgres(process.env.DATABASE_URL!, {
            max: 20,
            idle_timeout: 30,
            connect_timeout: 30,
            max_lifetime: 60 * 30,
            onnotice: () => {},
            transform: { undefined: null },
            debug: false
          });
          this.db = drizzle(this.queryClient);
          
          // Retry the operation
          const [session] = await this.db
            .insert(testSessions)
            .values(insertSession)
            .returning();
          
          console.log("PostgresStorage.createTestSession successful after reconnection:", session);
          return session;
        } catch (reconnectError) {
          console.error("Failed to reconnect and retry:", reconnectError);
          throw error;
        }
      }
      
      throw error;
    }
  }

  async getTestSession(id: number): Promise<TestSession | undefined> {
    const [session] = await this.db
      .select()
      .from(testSessions)
      .where(eq(testSessions.id, id))
      .limit(1);
    return session;
  }

  async updateTestSession(id: number, updates: Partial<TestSession>): Promise<TestSession | undefined> {
    const [session] = await this.db
      .update(testSessions)
      .set(updates)
      .where(eq(testSessions.id, id))
      .returning();
    return session;
  }

  async getUserSessions(userId: number): Promise<TestSession[]> {
    const sessions = await this.db
      .select()
      .from(testSessions)
      .where(eq(testSessions.userId, userId))
      .orderBy(desc(testSessions.createdAt));
    return sessions;
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await this.db
      .insert(chatMessages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async getChatMessagesBySession(sessionId: number): Promise<ChatMessage[]> {
    const messages = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.timestamp);
    return messages;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getUserByLinkedInId(linkedinId: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.linkedinId, linkedinId))
      .limit(1);
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user;
  }

  async updateUserScore(userId: number, totalScore: number): Promise<User | undefined> {
    const [user] = await this.db
      .update(users)
      .set({ totalScore })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getLeaderboard(limit: number = 10): Promise<User[]> {
    const leaderboard = await this.db
      .select()
      .from(users)
      .orderBy(sql`${users.totalScore} DESC`)
      .limit(limit);
    return leaderboard;
  }

  // Question methods for PostgresStorage
  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const [question] = await this.db
      .insert(questions)
      .values(insertQuestion)
      .returning();
    return question;
  }

  async getRandomQuestion(): Promise<Question | undefined> {
    const [question] = await this.db
      .select()
      .from(questions)
      .where(eq(questions.isActive, true))
      .orderBy(sql`RANDOM()`)
      .limit(1);
    return question;
  }

  async getAllQuestions(): Promise<Question[]> {
    const allQuestions = await this.db
      .select()
      .from(questions)
      .where(eq(questions.isActive, true))
      .orderBy(questions.createdAt);
    return allQuestions;
  }

  // Version 1 Exam methods for PostgresStorage
  async createExam(insertExam: InsertExam): Promise<Exam> {
    const [exam] = await this.db
      .insert(exams)
      .values(insertExam)
      .returning();
    return exam;
  }

  async getExam(id: number): Promise<Exam | undefined> {
    const [exam] = await this.db
      .select()
      .from(exams)
      .where(eq(exams.id, id))
      .limit(1);
    return exam;
  }

  async getAllExams(): Promise<Exam[]> {
    const allExams = await this.db
      .select()
      .from(exams)
      .orderBy(exams.createdAt);
    return allExams;
  }

  async createExamQuestion(insertExamQuestion: InsertExamQuestion): Promise<ExamQuestion> {
    const [examQuestion] = await this.db
      .insert(examQuestions)
      .values(insertExamQuestion)
      .returning();
    return examQuestion;
  }

  async getExamQuestionsByExam(examId: number): Promise<ExamQuestion[]> {
    const questions = await this.db
      .select()
      .from(examQuestions)
      .where(eq(examQuestions.examId, examId))
      .orderBy(examQuestions.stageNumber);
    return questions;
  }

  async getExamQuestionByStage(examId: number, stageNumber: number): Promise<ExamQuestion | undefined> {
    const [question] = await this.db
      .select()
      .from(examQuestions)
      .where(eq(examQuestions.examId, examId))
      .where(eq(examQuestions.stageNumber, stageNumber))
      .limit(1);
    return question;
  }

  async createUserSession(insertUserSession: InsertUserSession): Promise<UserSession> {
    const [userSession] = await this.db
      .insert(userSessions)
      .values(insertUserSession)
      .returning();
    return userSession;
  }

  async getUserSession(id: number): Promise<UserSession | undefined> {
    const [userSession] = await this.db
      .select()
      .from(userSessions)
      .where(eq(userSessions.id, id))
      .limit(1);
    return userSession;
  }

  async updateUserSession(id: number, updates: Partial<UserSession>): Promise<UserSession | undefined> {
    const [userSession] = await this.db
      .update(userSessions)
      .set(updates)
      .where(eq(userSessions.id, id))
      .returning();
    return userSession;
  }

  async getUserSessionsByUser(userId: number): Promise<UserSession[]> {
    const sessions = await this.db
      .select()
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .orderBy(desc(userSessions.startedAt));
    return sessions;
  }

  async createResponse(insertResponse: InsertResponse): Promise<Response> {
    const [response] = await this.db
      .insert(responses)
      .values(insertResponse)
      .returning();
    return response;
  }

  async getResponsesBySession(sessionId: number): Promise<Response[]> {
    const sessionResponses = await this.db
      .select()
      .from(responses)
      .where(eq(responses.sessionId, sessionId))
      .orderBy(responses.timestamp);
    return sessionResponses;
  }

  async createAiResponse(insertAiResponse: InsertAiResponse): Promise<AiResponse> {
    const [aiResponse] = await this.db
      .insert(aiResponses)
      .values(insertAiResponse)
      .returning();
    return aiResponse;
  }

  async getAiResponsesBySession(sessionId: number): Promise<AiResponse[]> {
    const sessionAiResponses = await this.db
      .select()
      .from(aiResponses)
      .where(eq(aiResponses.sessionId, sessionId))
      .orderBy(aiResponses.timestamp);
    return sessionAiResponses;
  }
}

// Use Supabase PostgreSQL storage exclusively
console.log('Storage initialization - DATABASE_URL exists:', !!process.env.DATABASE_URL);
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required - please configure Supabase connection');
}
export const storage = new PostgresStorage();
console.log('Storage implementation:', storage.constructor.name);
