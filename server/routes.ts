import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTestSessionSchema, insertChatMessageSchema } from "@shared/schema";
import { getClarificationResponse, generateFollowUpQuestions } from "./services/openai";
import { transcribeAudio } from "./services/transcription";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

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

  // Transcribe audio using Groq (with OpenAI fallback)
  app.post("/api/transcribe", upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      console.log("Received audio file:", {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      const audioBuffer = req.file.buffer;
      const filename = req.file.originalname || 'recording.webm';
      const mimeType = req.file.mimetype || 'audio/webm';
      
      const audioFile = new File([audioBuffer], filename, { type: mimeType });
      
      const transcriptionText = await transcribeAudio(audioFile);

      console.log("Transcription result:", transcriptionText);
      res.json({ text: transcriptionText });
    } catch (error) {
      console.error("Error transcribing audio:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to transcribe audio", error: errorMessage });
    }
  });

  // Progress to next question
  app.post("/api/test-sessions/:id/next-question", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getTestSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: "Test session not found" });
      }

      if (session.currentQuestionIndex >= 2) {
        return res.status(400).json({ message: "No more questions available" });
      }

      let allQuestions = session.allQuestions;
      
      // If we only have the first question, generate follow-ups
      if (allQuestions.length === 1 && session.currentQuestionIndex === 0) {
        const followUpQuestions = await generateFollowUpQuestions(allQuestions[0]);
        allQuestions = [...allQuestions, ...followUpQuestions];
      }

      const nextIndex = session.currentQuestionIndex + 1;
      const nextQuestion = allQuestions[nextIndex];
      
      // Update session with next question
      const updatedSession = await storage.updateTestSession(sessionId, {
        currentQuestionIndex: nextIndex,
        taskQuestion: nextQuestion,
        allQuestions: allQuestions,
        timeRemaining: 600, // 10 minutes for follow-up questions
        questionsAsked: 0, // Reset questions asked for new question
        questionPenalty: 0, // Reset penalty for new question
        finalAnswer: null // Clear previous answer
      });

      res.json(updatedSession);
    } catch (error) {
      console.error("Error progressing to next question:", error);
      res.status(500).json({ message: "Failed to progress to next question" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
