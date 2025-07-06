import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTestSessionSchema, insertChatMessageSchema, insertUserSchema, insertQuestionSchema } from "@shared/schema";
import { getClarificationResponse, generateFollowUpQuestions } from "./services/openai";
import { transcribeAudio } from "./services/transcription";
import { gradeAllAnswers } from "./services/grading";
import multer from "multer";
import session from "express-session";
import passport from "passport";
import { Strategy as OAuth2Strategy } from "passport-oauth2";
import connectPgSimple from "connect-pg-simple";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Configure session middleware with memory store for now
  const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'citium-session-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };
  
  app.use(session(sessionConfig));

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure LinkedIn OAuth strategy - auto-detect URL
  const getBaseURL = () => {
    // Use development domain for testing
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    // Use production domain from environment or default
    if (process.env.REPLIT_DOMAINS) {
      // Get the first domain from the comma-separated list
      const domains = process.env.REPLIT_DOMAINS.split(',');
      return `https://${domains[0]}`;
    }
    // Fallback to manual production URL
    return "https://test-interaction-site-zcsabbagh.replit.app";
  };
  
  const baseURL = getBaseURL();
  const callbackURL = `${baseURL}/auth/linkedin/callback`;
  
  console.log('LinkedIn OAuth Configuration:');
  console.log('Base URL:', baseURL);
  console.log('Callback URL:', callbackURL);
  console.log('Client ID:', process.env.LINKEDIN_CLIENT_ID);
    
  // LinkedIn OpenID Connect Strategy using modern API
  passport.use('linkedin', new OAuth2Strategy({
    authorizationURL: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenURL: 'https://www.linkedin.com/oauth/v2/accessToken',
    clientID: process.env.LINKEDIN_CLIENT_ID!,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
    callbackURL: callbackURL,
    scope: ['openid', 'profile', 'email']
  }, async (accessToken: any, refreshToken: any, profile: any, done: any) => {
    try {
      console.log('LinkedIn OAuth access token received');
      
      // Use LinkedIn's OpenID Connect userinfo endpoint
      const userInfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        console.error('LinkedIn userinfo API error:', userInfoResponse.status, errorText);
        throw new Error(`LinkedIn userinfo API error: ${userInfoResponse.status} ${userInfoResponse.statusText}`);
      }
      
      const userInfo = await userInfoResponse.json();
      console.log('LinkedIn userinfo response:', JSON.stringify(userInfo, null, 2));
      
      // Check if user exists using the 'sub' field (OpenID Connect standard)
      let user = await storage.getUserByLinkedInId(userInfo.sub);
      
      if (!user) {
        // Create new user with OpenID Connect data
        console.log('Creating new user for LinkedIn ID:', userInfo.sub);
        const newUser = await storage.createUser({
          linkedinId: userInfo.sub,
          email: userInfo.email || `user-${userInfo.sub}@linkedin.com`,
          firstName: userInfo.given_name || 'LinkedIn',
          lastName: userInfo.family_name || 'User',
          profilePictureUrl: userInfo.picture || null
        });
        user = newUser;
        console.log('User created successfully:', user.email);
      } else {
        console.log('Existing user found:', user.email);
      }
      
      return done(null, user);
    } catch (error) {
      console.error('LinkedIn OAuth strategy error:', error);
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
  app.get('/auth/linkedin', passport.authenticate('linkedin', { 
    scope: ['openid', 'profile', 'email'] 
  }));
  
  app.get('/auth/linkedin/callback', 
    (req, res, next) => {
      passport.authenticate('linkedin', (err, user, info) => {
        if (err) {
          console.error('LinkedIn OAuth error:', err);
          return res.redirect('/login?error=oauth_failed');
        }
        if (!user) {
          console.error('LinkedIn OAuth: No user returned', info);
          return res.redirect('/login?error=no_user');
        }
        req.logIn(user, (err) => {
          if (err) {
            console.error('Login error:', err);
            return res.redirect('/login?error=login_failed');
          }
          console.log('User successfully authenticated:', user.email);
          return res.redirect('/test-platform');
        });
      })(req, res, next);
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

  // Get leaderboard
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboard = await storage.getLeaderboard(limit);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // Debug endpoint to check database status
  app.get("/api/debug/users", async (req, res) => {
    try {
      const users = await storage.getLeaderboard(100); // Get more users for debugging
      res.json({ 
        count: users.length, 
        users: users.map(u => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          totalScore: u.totalScore
        }))
      });
    } catch (error) {
      console.error("Debug error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Question routes
  app.get("/api/questions/random", async (req, res) => {
    try {
      const question = await storage.getRandomQuestion();
      if (!question) {
        return res.status(404).json({ error: "No questions available" });
      }
      res.json(question);
    } catch (error) {
      console.error("Error fetching random question:", error);
      res.status(500).json({ error: "Failed to fetch question" });
    }
  });

  app.get("/api/questions", async (req, res) => {
    try {
      const questions = await storage.getAllQuestions();
      res.json(questions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ error: "Failed to fetch questions" });
    }
  });

  app.post("/api/questions", async (req, res) => {
    try {
      const questionData = insertQuestionSchema.parse(req.body);
      const question = await storage.createQuestion(questionData);
      res.json(question);
    } catch (error) {
      console.error("Error creating question:", error);
      res.status(400).json({ error: "Invalid question data" });
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
      const totalScore = grades.reduce((sum, grade) => sum + grade, 0);
      
      // Update user's total score if they're authenticated
      if (session.userId) {
        await storage.updateUserScore(session.userId, totalScore);
      }
      
      res.json({ grades, totalScore });
    } catch (error) {
      console.error("Error grading session:", error);
      res.status(500).json({ error: "Failed to grade session" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
