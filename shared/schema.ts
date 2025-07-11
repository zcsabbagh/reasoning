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
  currentAnswerDraft: text("current_answer_draft").notNull().default(""), // Auto-saved draft for current question
  questionStartTimes: text("question_start_times").array().notNull().default([]), // Timestamps when each question started
  questionTimeElapsed: integer("question_time_elapsed").array().notNull().default([0, 0, 0]), // Time elapsed for each question in seconds
  lastActivityAt: timestamp("last_activity_at").defaultNow(), // Track when user was last active
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

// Version 1 Exam Schema
export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  totalStages: integer("total_stages").notNull().default(3),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const examQuestions = pgTable("exam_questions", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull().references(() => exams.id),
  stageNumber: integer("stage_number").notNull(),
  promptText: text("prompt_text").notNull(),
  stageType: text("stage_type").notNull(), // 'assumption', 'questioning', 'synthesis'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  examId: integer("exam_id").notNull().references(() => exams.id),
  currentStage: integer("current_stage").notNull().default(1),
  questionsAsked: integer("questions_asked").notNull().default(0),
  userPath: text("user_path"), // 'PATH_A', 'PATH_B', 'PATH_C'
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const responses = pgTable("responses", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => userSessions.id),
  stageNumber: integer("stage_number").notNull(),
  responseText: text("response_text").notNull(),
  responseType: text("response_type").notNull(), // 'assumption', 'question', 'synthesis'
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  aiEvaluation: text("ai_evaluation"), // JSON string of AI evaluation
  score: integer("score"), // Score from AI evaluation
});

export const aiResponses = pgTable("ai_responses", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => userSessions.id),
  stageNumber: integer("stage_number").notNull(),
  responseText: text("response_text").notNull(),
  pathType: text("path_type"), // 'PATH_A', 'PATH_B', 'PATH_C'
  timestamp: timestamp("timestamp").defaultNow().notNull(),
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

// Version 1 Exam Insert Schemas
export const insertExamSchema = createInsertSchema(exams).omit({
  id: true,
  createdAt: true,
});

export const insertExamQuestionSchema = createInsertSchema(examQuestions).omit({
  id: true,
  createdAt: true,
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  startedAt: true,
});

export const insertResponseSchema = createInsertSchema(responses).omit({
  id: true,
  timestamp: true,
});

export const insertAiResponseSchema = createInsertSchema(aiResponses).omit({
  id: true,
  timestamp: true,
});

// Original types
export type InsertTestSession = z.infer<typeof insertTestSessionSchema>;
export type TestSession = typeof testSessions.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questions.$inferSelect;

// Version 1 Exam types
export type InsertExam = z.infer<typeof insertExamSchema>;
export type Exam = typeof exams.$inferSelect;
export type InsertExamQuestion = z.infer<typeof insertExamQuestionSchema>;
export type ExamQuestion = typeof examQuestions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;
export type InsertResponse = z.infer<typeof insertResponseSchema>;
export type Response = typeof responses.$inferSelect;
export type InsertAiResponse = z.infer<typeof insertAiResponseSchema>;
export type AiResponse = typeof aiResponses.$inferSelect;
