import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const testSessions = pgTable("test_sessions", {
  id: serial("id").primaryKey(),
  taskQuestion: text("task_question").notNull(),
  finalAnswer: text("final_answer"),
  timeRemaining: integer("time_remaining").notNull().default(1800), // 30 minutes in seconds
  questionsAsked: integer("questions_asked").notNull().default(0),
  isSubmitted: boolean("is_submitted").notNull().default(false),
  baseScore: integer("base_score").notNull().default(25),
  questionPenalty: integer("question_penalty").notNull().default(0),
  infoGainBonus: integer("info_gain_bonus").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  content: text("content").notNull(),
  isUser: boolean("is_user").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertTestSessionSchema = createInsertSchema(testSessions).omit({
  id: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export type InsertTestSession = z.infer<typeof insertTestSessionSchema>;
export type TestSession = typeof testSessions.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
