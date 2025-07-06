import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const testSessions = pgTable("test_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  taskQuestion: text("task_question").notNull(),
  finalAnswer: text("final_answer"),
  timeRemaining: integer("time_remaining").notNull().default(1800), // 30 minutes in seconds
  questionsAsked: integer("questions_asked").notNull().default(0),
  isSubmitted: boolean("is_submitted").notNull().default(false),
  baseScore: integer("base_score").notNull().default(25),
  questionPenalty: integer("question_penalty").notNull().default(0),
  infoGainBonus: integer("info_gain_bonus").notNull().default(0),
  finalScore: integer("final_score"), // Actual score from AI grading
  currentQuestionIndex: integer("current_question_index").notNull().default(0),
  allQuestions: text("all_questions").array().notNull(),
  allAnswers: text("all_answers").array().notNull().default(["", "", ""]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  linkedinId: text("linkedin_id").unique().notNull(),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  profilePictureUrl: text("profile_picture_url"),
  totalScore: integer("total_score").notNull().default(20), // Default score for users who signed in but haven't completed exam
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  content: text("content").notNull(),
  isUser: boolean("is_user").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  questionText: text("question_text").notNull(),
  rubric: text("rubric").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTestSessionSchema = createInsertSchema(testSessions).omit({
  id: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
  createdAt: true,
});

export type InsertTestSession = z.infer<typeof insertTestSessionSchema>;
export type TestSession = typeof testSessions.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questions.$inferSelect;
