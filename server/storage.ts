import { 
  testSessions, 
  chatMessages, 
  users,
  questions,
  type TestSession, 
  type ChatMessage, 
  type InsertTestSession, 
  type InsertChatMessage,
  type User,
  type InsertUser,
  type Question,
  type InsertQuestion
} from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";

export interface IStorage {
  // Test Sessions
  createTestSession(session: InsertTestSession): Promise<TestSession>;
  getTestSession(id: number): Promise<TestSession | undefined>;
  updateTestSession(id: number, updates: Partial<TestSession>): Promise<TestSession | undefined>;
  
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
}

// PostgreSQL Storage Implementation
export class PostgresStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for PostgreSQL storage");
    }
    
    // Handle URL encoding for special characters in password
    let connectionString = process.env.DATABASE_URL;
    
    // Parse and reconstruct URL to handle special characters
    const urlMatch = connectionString.match(/postgresql:\/\/([^:]+):([^@]+)@(.+)/);
    if (urlMatch) {
      const [, username, password, hostAndDb] = urlMatch;
      connectionString = `postgresql://${username}:${encodeURIComponent(password)}@${hostAndDb}`;
    }
    
    const queryClient = postgres(connectionString);
    this.db = drizzle(queryClient);
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

      // Create questions table if it doesn't exist
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "questions" (
          "id" serial PRIMARY KEY NOT NULL,
          "question_text" text NOT NULL,
          "rubric" text NOT NULL,
          "is_active" boolean NOT NULL DEFAULT true,
          "created_at" timestamp DEFAULT now()
        )
      `);
      
      // Seed questions if database is empty
      await this.seedQuestions();
      
      console.log("Database schema initialized successfully");
    } catch (error) {
      console.error("Error initializing database schema:", error);
    }
  }

  private async seedQuestions() {
    try {
      // Check if questions already exist
      const existingQuestions = await this.db
        .select()
        .from(questions)
        .limit(1);
        
      if (existingQuestions.length > 0) {
        console.log("Questions already seeded, skipping...");
        return;
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

      for (const questionData of questionsToSeed) {
        await this.db
          .insert(questions)
          .values(questionData);
      }

      console.log(`Seeded ${questionsToSeed.length} questions successfully`);
    } catch (error) {
      console.error("Error seeding questions:", error);
    }
  }

  async createTestSession(insertSession: InsertTestSession): Promise<TestSession> {
    const [session] = await this.db
      .insert(testSessions)
      .values(insertSession)
      .returning();
    return session;
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
}

// Use PostgreSQL storage if DATABASE_URL is available, otherwise fallback to MemStorage
export const storage = process.env.DATABASE_URL 
  ? new PostgresStorage() 
  : new MemStorage();
