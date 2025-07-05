import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTestSessionSchema, insertChatMessageSchema, insertUserSchema } from "@shared/schema";
import { getClarificationResponse, generateFollowUpQuestions } from "./services/openai";
import { transcribeAudio } from "./services/transcription";
import { gradeAllAnswers } from "./services/grading";
import multer from "multer";
import session from "express-session";
import passport from "passport";
import { Strategy as LinkedInStrategy } from "passport-linkedin-oauth2";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Configure session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true in production with HTTPS
  }));

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure LinkedIn OAuth strategy
  const baseURL = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "https://test-interaction-site-zcsabbagh.replit.app";
  const callbackURL = `${baseURL}/auth/linkedin/callback`;
  
  console.log('LinkedIn OAuth Configuration:');
  console.log('Base URL:', baseURL);
  console.log('Callback URL:', callbackURL);
  console.log('Client ID:', process.env.LINKEDIN_CLIENT_ID);
    
  passport.use(new LinkedInStrategy({
    clientID: process.env.LINKEDIN_CLIENT_ID!,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
    callbackURL: callbackURL,
    scope: ['r_emailaddress', 'r_liteprofile']
  }, async (accessToken: any, refreshToken: any, profile: any, done: any) => {
    try {
      // Check if user exists
      let user = await storage.getUserByLinkedInId(profile.id);
      
      if (!user) {
        // Create new user
        const newUser = await storage.createUser({
          linkedinId: profile.id,
          email: profile.emails?.[0]?.value || '',
          firstName: profile.name?.givenName || '',
          lastName: profile.name?.familyName || '',
          profilePictureUrl: profile.photos?.[0]?.value || null
        });
        user = newUser;
      }
      
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));

  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Authentication routes
  app.get('/auth/linkedin', passport.authenticate('linkedin'));
  
  app.get('/auth/linkedin/callback', 
    passport.authenticate('linkedin', { failureRedirect: '/login' }),
    (req, res) => {
      // Successful authentication, redirect to test platform
      res.redirect('/test-platform');
    }
  );

  app.get('/auth/logout', (req, res, next) => {
    req.logout((err) => {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });

  app.get('/auth/user', (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  });

  // Configuration endpoint for debugging
  app.get('/auth/config', (req, res) => {
    res.json({
      baseURL,
      callbackURL,
      clientId: process.env.LINKEDIN_CLIENT_ID,
      isConfigured: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)
    });
  });
  
  // Create a new test session
  app.post("/api/test-sessions", async (req, res) => {
    try {
      const sessionData = insertTestSessionSchema.parse(req.body);
      
      // Associate with current user if authenticated
      if (req.isAuthenticated() && req.user) {
        sessionData.userId = (req.user as any).id;
      }
      
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

  // Grade test session
  app.post("/api/test-sessions/:id/grade", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getTestSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const grades = await gradeAllAnswers(session.allQuestions, session.allAnswers);
      
      res.json({ grades });
    } catch (error) {
      console.error("Error grading session:", error);
      res.status(500).json({ error: "Failed to grade session" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
