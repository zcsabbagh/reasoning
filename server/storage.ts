import { 
  testSessions, 
  chatMessages, 
  users,
  type TestSession, 
  type ChatMessage, 
  type InsertTestSession, 
  type InsertChatMessage,
  type User,
  type InsertUser
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
}

export class MemStorage implements IStorage {
  private testSessions: Map<number, TestSession>;
  private chatMessages: Map<number, ChatMessage>;
  private users: Map<number, User>;
  private currentSessionId: number;
  private currentMessageId: number;
  private currentUserId: number;

  constructor() {
    this.testSessions = new Map();
    this.chatMessages = new Map();
    this.users = new Map();
    this.currentSessionId = 1;
    this.currentMessageId = 1;
    this.currentUserId = 1;
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
          "created_at" timestamp DEFAULT now(),
          CONSTRAINT "users_linkedin_id_unique" UNIQUE("linkedin_id")
        )
      `);
      
      // Add user_id column to test_sessions table if it doesn't exist
      await this.db.execute(sql`
        ALTER TABLE "test_sessions" ADD COLUMN IF NOT EXISTS "user_id" integer
      `);
      
      console.log("Database schema initialized successfully");
    } catch (error) {
      console.error("Error initializing database schema:", error);
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
}

// Use PostgreSQL storage if DATABASE_URL is available, otherwise fallback to MemStorage
export const storage = process.env.DATABASE_URL 
  ? new PostgresStorage() 
  : new MemStorage();
