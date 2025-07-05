import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTestSessionSchema, insertChatMessageSchema } from "@shared/schema";
import { getClarificationResponse } from "./services/openai";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Create a new test session
  app.post("/api/test-sessions", async (req, res) => {
    try {
      const sessionData = insertTestSessionSchema.parse(req.body);
      const session = await storage.createTestSession(sessionData);
      res.json(session);
    } catch (error) {
      console.error("Error creating test session:", error);
      res.status(400).json({ message: "Invalid session data" });
    }
  });

  // Get test session
  app.get("/api/test-sessions/:id", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getTestSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: "Test session not found" });
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error fetching test session:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update test session
  app.patch("/api/test-sessions/:id", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const updates = req.body;
      
      const session = await storage.updateTestSession(sessionId, updates);
      
      if (!session) {
        return res.status(404).json({ message: "Test session not found" });
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error updating test session:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Send question to AI and get response
  app.post("/api/chat/:sessionId", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const { question } = req.body;
      
      if (!question || question.trim() === "") {
        return res.status(400).json({ message: "Question is required" });
      }

      const session = await storage.getTestSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Test session not found" });
      }

      if (session.questionsAsked >= 3) {
        return res.status(400).json({ message: "Maximum number of questions reached" });
      }

      // Save user question
      const userMessage = await storage.createChatMessage({
        sessionId,
        content: question,
        isUser: true
      });

      // Get AI response
      const aiResponse = await getClarificationResponse(question, session.taskQuestion);

      // Save AI response
      const aiMessage = await storage.createChatMessage({
        sessionId,
        content: aiResponse,
        isUser: false
      });

      // Update session with incremented question count and penalty
      const updatedSession = await storage.updateTestSession(sessionId, {
        questionsAsked: session.questionsAsked + 1,
        questionPenalty: session.questionPenalty + 1
      });

      res.json({
        userMessage,
        aiMessage,
        session: updatedSession
      });
    } catch (error) {
      console.error("Error handling chat:", error);
      res.status(500).json({ message: "Failed to process question" });
    }
  });

  // Get chat history for a session
  app.get("/api/chat/:sessionId", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const messages = await storage.getChatMessagesBySession(sessionId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
