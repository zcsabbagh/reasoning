import { 
  testSessions, 
  chatMessages, 
  type TestSession, 
  type ChatMessage, 
  type InsertTestSession, 
  type InsertChatMessage 
} from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Test Sessions
  createTestSession(session: InsertTestSession): Promise<TestSession>;
  getTestSession(id: number): Promise<TestSession | undefined>;
  updateTestSession(id: number, updates: Partial<TestSession>): Promise<TestSession | undefined>;
  
  // Chat Messages
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessagesBySession(sessionId: number): Promise<ChatMessage[]>;
}

export class MemStorage implements IStorage {
  private testSessions: Map<number, TestSession>;
  private chatMessages: Map<number, ChatMessage>;
  private currentSessionId: number;
  private currentMessageId: number;

  constructor() {
    this.testSessions = new Map();
    this.chatMessages = new Map();
    this.currentSessionId = 1;
    this.currentMessageId = 1;
  }

  async createTestSession(insertSession: InsertTestSession): Promise<TestSession> {
    const id = this.currentSessionId++;
    const session: TestSession = { 
      id,
      taskQuestion: insertSession.taskQuestion,
      finalAnswer: insertSession.finalAnswer || null,
      timeRemaining: insertSession.timeRemaining || 1800,
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
}

// Use PostgreSQL storage if DATABASE_URL is available, otherwise fallback to MemStorage
export const storage = process.env.DATABASE_URL 
  ? new PostgresStorage() 
  : new MemStorage();
