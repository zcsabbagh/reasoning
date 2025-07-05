import { 
  testSessions, 
  chatMessages, 
  type TestSession, 
  type ChatMessage, 
  type InsertTestSession, 
  type InsertChatMessage 
} from "@shared/schema";

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

export const storage = new MemStorage();
