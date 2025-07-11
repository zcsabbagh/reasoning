import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTestSessionSchema, insertChatMessageSchema, insertUserSchema, insertQuestionSchema, insertUserSessionSchema } from "@shared/schema";
import { getClarificationResponse, generateFollowUpQuestions } from "./services/openai";
import { transcribeAudio } from "./services/transcription";
import { gradeAllAnswers, gradeAllAnswersWithFeedback } from "./services/grading";
import { proctorService } from "./services/proctoring";
import multer from "multer";
import session from "express-session";
import passport from "passport";
import { Strategy as OAuth2Strategy } from "passport-oauth2";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Trust proxy for secure cookie handling in production
  app.set('trust proxy', 1);
  
  // Configure persistent session store with Supabase
  const PgSession = connectPgSimple(session);
  
  let sessionStore;
  try {
    sessionStore = new PgSession({
      pool: pool,
      tableName: 'session', // Will be created automatically
      createTableIfMissing: true,
      ttl: 30 * 24 * 60 * 60, // 30 days in seconds
      schemaName: 'public'
    });
    console.log('Session store initialized successfully');
    
    // Test the session store connection
    setTimeout(async () => {
      try {
        await sessionStore.ready;
        console.log('Session store connection verified');
      } catch (storeError) {
        console.error('Session store connection test failed:', storeError);
        console.log('Session store may not be working correctly');
      }
    }, 1000);
  } catch (error) {
    console.error('Session store initialization error:', error);
    // Fallback to memory store if database fails
    console.log('Falling back to memory store for sessions');
    sessionStore = undefined; // This will use default memory store
  }
  
  const sessionConfig: any = {
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'citium-session-secret-key-fixed-for-production',
    resave: false, // Only save session if it was modified
    saveUninitialized: false, // Don't save empty sessions
    rolling: true, // Reset the cookie MaxAge on every response
    cookie: { 
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for persistent login
      sameSite: 'lax', // Allow cross-site cookies for OAuth
      httpOnly: true // Security: prevent XSS attacks
    }
  };
  
  app.use(session(sessionConfig));

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Add middleware to ensure session persistence and error handling
  app.use((req, res, next) => {
    // Force session save if user is authenticated
    if (req.isAuthenticated() && req.user) {
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          // Try to regenerate session on error
          req.session.regenerate((regenerateErr) => {
            if (regenerateErr) {
              console.error('Session regeneration error:', regenerateErr);
            }
          });
        }
      });
    }
    next();
  });

  // Configure LinkedIn OAuth strategy - auto-detect URL
  const getBaseURL = () => {
    // In production, prioritize production domains over dev domains
    if (process.env.NODE_ENV === 'production' && process.env.REPLIT_DOMAINS) {
      // Get the production domain from the comma-separated list
      const domains = process.env.REPLIT_DOMAINS.split(',');
      // Look for hinton.world specifically
      const hintonDomain = domains.find(domain => domain.includes('hinton.world'));
      if (hintonDomain) {
        return `https://${hintonDomain}`;
      }
      // Otherwise use the first domain
      return `https://${domains[0]}`;
    }
    // Use development domain for testing
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    // Fallback to manual production URL
    return "https://hinton.world";
  };
  
  const baseURL = getBaseURL();
  const callbackURL = `${baseURL}/auth/linkedin/callback`;
  
  console.log('LinkedIn OAuth Configuration:');
  console.log('Base URL:', baseURL);
  console.log('Callback URL:', callbackURL);
  console.log('Client ID:', process.env.LINKEDIN_CLIENT_ID);
  console.log('Environment check - REPLIT_DEV_DOMAIN:', process.env.REPLIT_DEV_DOMAIN);
  console.log('Environment check - REPLIT_DOMAINS:', process.env.REPLIT_DOMAINS);
    
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
    console.log('Serializing user:', user.id, user.email);
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('Deserializing user with ID:', id, 'type:', typeof id);
      const user = await storage.getUserById(id);
      console.log('Deserialized user:', user ? { id: user.id, email: user.email } : 'not found');
      if (user) {
        console.log('User found successfully, returning to passport');
        done(null, user);
      } else {
        console.log('User not found in database');
        done(null, false);
      }
    } catch (error) {
      console.error('Error deserializing user:', error);
      done(error, null);
    }
  });

  // Authentication routes
  app.get('/auth/linkedin', passport.authenticate('linkedin', { 
    scope: ['openid', 'profile', 'email'] 
  }));
  
  app.get('/auth/linkedin/callback', 
    (req, res, next) => {
      console.log('LinkedIn callback initiated');
      passport.authenticate('linkedin', (err, user, info) => {
        console.log('LinkedIn callback - err:', err, 'user:', user ? user.email : 'none', 'info:', info);
        
        if (err) {
          console.error('LinkedIn OAuth error:', err);
          return res.redirect('/login?error=oauth_failed');
        }
        if (!user) {
          console.error('LinkedIn OAuth: No user returned', info);
          return res.redirect('/login?error=no_user');
        }
        
        console.log('About to login user:', user.email, 'user ID:', user.id);
        req.logIn(user, (err) => {
          if (err) {
            console.error('Login error:', err);
            return res.redirect('/login?error=login_failed');
          }
          console.log('User successfully authenticated:', user.email);
          console.log('Session after login:', req.session);
          console.log('User in session:', req.user);
          console.log('Session ID:', req.sessionID);
          console.log('Environment:', process.env.NODE_ENV);
          console.log('Cookie secure setting:', req.session.cookie?.secure);
          console.log('Request headers host:', req.headers.host);
          console.log('Request protocol:', req.protocol);
          console.log('Request secure:', req.secure);
          console.log('Request is secure (computed):', req.secure || req.headers['x-forwarded-proto'] === 'https');
          console.log('X-Forwarded-Proto header:', req.headers['x-forwarded-proto']);
          
          // Force save the session to ensure it persists
          req.session.save((err) => {
            if (err) {
              console.error('Session save error:', err);
            } else {
              console.log('Session saved successfully');
            }
            return res.redirect('/account');
          });
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
    console.log('Auth user check - isAuthenticated:', req.isAuthenticated());
    console.log('Auth user check - session:', req.session);
    console.log('Auth user check - user:', req.user);
    console.log('Auth user check - environment:', process.env.NODE_ENV);
    console.log('Auth user check - cookie secure:', req.session.cookie?.secure);
    console.log('Auth user check - session ID:', req.sessionID);
    console.log('Auth user check - request headers:', req.headers);
    
    if (req.isAuthenticated()) {
      console.log('User authenticated successfully, returning user data');
      res.json(req.user);
    } else {
      console.log('User not authenticated - session might be lost');
      res.status(401).json({ error: 'Not authenticated' });
    }
  });

  app.get('/auth/test-manual-login', async (req, res) => {
    try {
      console.log('Manual test login initiated');
      
      // Try to find or create a test user
      let testUser = await storage.getUserByLinkedInId('test-linkedin-id');
      if (!testUser) {
        console.log('Creating test user');
        testUser = await storage.createUser({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@hinton.world',
          linkedinId: 'test-linkedin-id',
          profilePictureUrl: null,
          totalScore: 100
        });
      }
      
      console.log('Test user found/created:', testUser.email);
      
      // Manually log in the user
      req.logIn(testUser, (err) => {
        if (err) {
          console.error('Manual login error:', err);
          res.json({ error: 'Login failed', details: err.message });
        } else {
          console.log('Manual login successful, saving session');
          req.session.save((err) => {
            if (err) {
              console.error('Session save error:', err);
              res.json({ error: 'Session save failed', details: err.message });
            } else {
              console.log('Session saved successfully');
              res.json({ 
                success: true, 
                user: { id: testUser.id, email: testUser.email, firstName: testUser.firstName },
                sessionID: req.sessionID,
                isAuthenticated: req.isAuthenticated()
              });
            }
          });
        }
      });
    } catch (error) {
      console.error('Error in manual login test:', error);
      res.json({ error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get user's test sessions/exam history
  app.get('/api/user/sessions', async (req, res) => {
    try {
      console.log('=== User Sessions Request ===');
      console.log('isAuthenticated:', req.isAuthenticated());
      console.log('User:', req.user);
      console.log('Session ID:', req.sessionID);
      console.log('Session:', req.session);
      console.log('Environment:', process.env.NODE_ENV);
      
      if (!req.isAuthenticated() || !req.user) {
        console.log('User not authenticated for sessions request');
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const userId = (req.user as any).id;
      console.log('Fetching sessions for user ID:', userId);
      const sessions = await storage.getUserSessions(userId);
      console.log('Found sessions:', sessions.length);
      res.json(sessions);
    } catch (error) {
      console.error('Error fetching user sessions:', error);
      res.status(500).json({ error: 'Internal server error' });
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

  // Debug endpoint to check current URL configuration
  app.get("/debug/oauth-config", (req, res) => {
    res.json({
      baseURL: baseURL,
      callbackURL: callbackURL,
      currentHost: req.get('host'),
      currentProtocol: req.protocol,
      fullCurrentURL: `${req.protocol}://${req.get('host')}`,
      environment: process.env.NODE_ENV,
      devDomain: process.env.REPLIT_DEV_DOMAIN,
      prodDomains: process.env.REPLIT_DOMAINS,
      userAgent: req.get('user-agent'),
      headers: req.headers
    });
  });

  // Debug endpoint to check authentication status
  app.get("/debug/auth-status", (req, res) => {
    res.json({
      isAuthenticated: req.isAuthenticated(),
      user: req.user || null,
      sessionID: req.sessionID,
      session: req.session,
      cookies: req.headers.cookie || null
    });
  });

  app.get('/debug/set-test-session', (req, res) => {
    req.session.test = 'test-value';
    req.session.save((err) => {
      if (err) {
        console.error('Test session save error:', err);
        res.json({ error: 'Session save failed', details: err });
      } else {
        console.log('Test session saved successfully');
        res.json({ success: true, sessionID: req.sessionID });
      }
    });
  });

  app.get('/debug/get-test-session', (req, res) => {
    res.json({
      test: req.session.test,
      sessionID: req.sessionID,
      allSession: req.session
    });
  });

  // Comprehensive health check endpoint
  app.get('/health', async (req, res) => {
    const healthStatus = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      status: 'healthy',
      checks: {
        database: { status: 'unknown', message: '', responseTime: 0 },
        storage: { status: 'unknown', message: '', responseTime: 0 },
        session: { status: 'unknown', message: '', responseTime: 0 },
        authentication: { status: 'unknown', message: '', responseTime: 0 }
      }
    };

    // Database connectivity check
    const dbStart = Date.now();
    try {
      const testQuestion = await storage.getRandomQuestion();
      healthStatus.checks.database.responseTime = Date.now() - dbStart;
      healthStatus.checks.database.status = testQuestion ? 'healthy' : 'warning';
      healthStatus.checks.database.message = testQuestion ? 'Connection successful' : 'No questions found';
    } catch (error) {
      healthStatus.checks.database.responseTime = Date.now() - dbStart;
      healthStatus.checks.database.status = 'error';
      healthStatus.checks.database.message = error instanceof Error ? error.message : String(error);
    }

    // Storage layer check
    const storageStart = Date.now();
    try {
      const storageType = storage.constructor.name;
      healthStatus.checks.storage.responseTime = Date.now() - storageStart;
      healthStatus.checks.storage.status = 'healthy';
      healthStatus.checks.storage.message = `Using ${storageType}`;
    } catch (error) {
      healthStatus.checks.storage.responseTime = Date.now() - storageStart;
      healthStatus.checks.storage.status = 'error';
      healthStatus.checks.storage.message = error instanceof Error ? error.message : String(error);
    }

    // Session store check
    const sessionStart = Date.now();
    try {
      const sessionId = req.sessionID;
      healthStatus.checks.session.responseTime = Date.now() - sessionStart;
      healthStatus.checks.session.status = sessionId ? 'healthy' : 'warning';
      healthStatus.checks.session.message = sessionId ? 'Session active' : 'No session ID';
    } catch (error) {
      healthStatus.checks.session.responseTime = Date.now() - sessionStart;
      healthStatus.checks.session.status = 'error';
      healthStatus.checks.session.message = error instanceof Error ? error.message : String(error);
    }

    // Authentication check
    const authStart = Date.now();
    try {
      const isAuthenticated = req.isAuthenticated();
      healthStatus.checks.authentication.responseTime = Date.now() - authStart;
      healthStatus.checks.authentication.status = 'healthy';
      healthStatus.checks.authentication.message = isAuthenticated ? 'User authenticated' : 'No authentication required';
    } catch (error) {
      healthStatus.checks.authentication.responseTime = Date.now() - authStart;
      healthStatus.checks.authentication.status = 'error';
      healthStatus.checks.authentication.message = error instanceof Error ? error.message : String(error);
    }

    // Overall health status
    const hasErrors = Object.values(healthStatus.checks).some(check => check.status === 'error');
    const hasWarnings = Object.values(healthStatus.checks).some(check => check.status === 'warning');
    
    if (hasErrors) {
      healthStatus.status = 'unhealthy';
    } else if (hasWarnings) {
      healthStatus.status = 'degraded';
    }

    const statusCode = hasErrors ? 500 : hasWarnings ? 200 : 200;
    res.status(statusCode).json(healthStatus);
  });

  // Test database connectivity
  app.get('/debug/db-test', async (req, res) => {
    try {
      console.log("Testing database connectivity...");
      console.log("Storage type:", storage.constructor.name);
      console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);
      
      // Try to get a random question (simple read test)
      const question = await storage.getRandomQuestion();
      console.log("Database read test successful");
      
      // Try to create a simple test session (write test)
      const testSessionData = {
        taskQuestion: "Test question",
        finalAnswer: "",
        timeRemaining: 600,
        questionsAsked: 0,
        isSubmitted: false,
        baseScore: 25,
        questionPenalty: 0,
        infoGainBonus: 0,
        currentQuestionIndex: 0,
        allQuestions: ["Test question"],
        allAnswers: ["", "", ""]
      };
      
      const testSession = await storage.createTestSession(testSessionData);
      console.log("Database write test successful");
      
      res.json({
        success: true,
        storageType: storage.constructor.name,
        databaseUrlExists: !!process.env.DATABASE_URL,
        testQuestion: question,
        testSessionId: testSession.id,
        environment: process.env.NODE_ENV
      });
    } catch (error) {
      console.error("Database test failed:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        storageType: storage.constructor.name,
        databaseUrlExists: !!process.env.DATABASE_URL,
        environment: process.env.NODE_ENV
      });
    }
  });

  // Check database URL configuration
  app.get('/debug/db-config', async (req, res) => {
    try {
      const dbUrl = process.env.DATABASE_URL || '';
      const hostMatch = dbUrl.match(/@([^:]+)/);
      const host = hostMatch ? hostMatch[1] : 'unknown';
      
      res.json({
        success: true,
        environment: process.env.NODE_ENV || 'development',
        databaseHost: host,
        databaseUrlExists: !!process.env.DATABASE_URL,
        storageType: storage.constructor.name,
        isCorrectDatabase: host.includes('vwjbveaytnberlrnigyv')
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Force database schema initialization - for production debugging
  app.get('/debug/force-init', async (req, res) => {
    try {
      console.log('=== FORCE SCHEMA INITIALIZATION ===');
      console.log('Environment:', process.env.NODE_ENV || 'development');
      console.log('Database URL exists:', !!process.env.DATABASE_URL);
      
      // Force schema initialization
      await (storage as any).initializeSchema();
      console.log('Schema initialization completed');
      
      // Test question retrieval
      const question = await storage.getRandomQuestion();
      
      res.json({
        success: true,
        message: 'Database schema forcefully initialized',
        storageType: storage.constructor.name,
        environment: process.env.NODE_ENV || 'development',
        testQuestion: question
      });
    } catch (error) {
      console.error('Force init failed:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        storageType: storage.constructor.name,
        environment: process.env.NODE_ENV || 'development'
      });
    }
  });

  // Test all AI providers and API keys
  app.get('/debug/test-ai-providers', async (req, res) => {
    const testResults = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      providers: [] as any[]
    };

    const testPrompt = "What is 2+2? Answer with just the number.";
    const testSystemPrompt = "You are a helpful assistant. Be concise.";

    // Test each provider individually
    const providers = [
      {
        name: 'OpenAI',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4o'
      },
      {
        name: 'Anthropic', 
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-sonnet-4-20250514'
      },
      {
        name: 'Gemini',
        apiKey: process.env.GEMINI_API_KEY,
        model: 'gemini-2.5-flash'
      }
    ];

    for (const provider of providers) {
      const result = {
        name: provider.name,
        model: provider.model,
        hasApiKey: !!provider.apiKey,
        keyPrefix: provider.apiKey ? provider.apiKey.substring(0, 8) + '...' : null,
        status: 'unknown' as string,
        response: null as string | null,
        error: null as string | null,
        responseTime: null as number | null
      };

      if (!provider.apiKey) {
        result.status = 'missing_key';
        result.error = 'API key not configured';
      } else {
        const startTime = Date.now();
        
        try {
          // Test individual provider by importing and using directly
          if (provider.name === 'OpenAI') {
            const { openai } = await import('@ai-sdk/openai');
            const { generateText } = await import('ai');
            const response = await generateText({
              model: openai(provider.model),
              prompt: testPrompt,
              system: testSystemPrompt,
              maxTokens: 10,
            });
            result.response = response.text;
          } else if (provider.name === 'Anthropic') {
            const { anthropic } = await import('@ai-sdk/anthropic');
            const { generateText } = await import('ai');
            const response = await generateText({
              model: anthropic(provider.model),
              prompt: testPrompt,
              system: testSystemPrompt,
              maxTokens: 10,
            });
            result.response = response.text;
          } else if (provider.name === 'Gemini') {
            const { google } = await import('@ai-sdk/google');
            const { generateText } = await import('ai');
            const response = await generateText({
              model: google(provider.model),
              prompt: testPrompt,
              system: testSystemPrompt,
              maxTokens: 10,
            });
            result.response = response.text;
          }
          
          result.responseTime = Date.now() - startTime;
          result.status = 'success';
        } catch (error) {
          result.responseTime = Date.now() - startTime;
          result.status = 'error';
          result.error = error instanceof Error ? error.message : String(error);
        }
      }

      testResults.providers.push(result);
    }

    // Test the fallback system
    let fallbackResult = {
      status: 'unknown' as string,
      usedProvider: null as string | null,
      response: null as string | null,
      error: null as string | null
    };

    try {
      const { generateAIResponse } = await import('./services/ai-sdk');
      const fallbackResponse = await generateAIResponse(testPrompt, testSystemPrompt);
      fallbackResult.status = 'success';
      fallbackResult.response = fallbackResponse;
      fallbackResult.usedProvider = 'First available provider';
    } catch (error) {
      fallbackResult.status = 'error';
      fallbackResult.error = error instanceof Error ? error.message : String(error);
    }

    res.json({
      success: true,
      summary: {
        workingProviders: testResults.providers.filter(p => p.status === 'success').length,
        totalProviders: testResults.providers.length,
        fallbackWorking: fallbackResult.status === 'success'
      },
      individual: testResults,
      fallback: fallbackResult
    });
  });

  app.get('/debug/login-test-user', async (req, res) => {
    try {
      // Create a test user for debugging
      const testUser = await storage.createUser({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        linkedinId: 'test-linkedin-id',
        profilePictureUrl: null,
        totalScore: 100
      });
      
      console.log('Test user created:', testUser);
      
      // Log the user in manually
      req.logIn(testUser, (err) => {
        if (err) {
          console.error('Manual login error:', err);
          res.json({ error: 'Login failed', details: err });
        } else {
          console.log('Manual login successful');
          req.session.save((err) => {
            if (err) {
              console.error('Session save error:', err);
              res.json({ error: 'Session save failed', details: err });
            } else {
              console.log('Session saved after manual login');
              res.json({ success: true, user: testUser, sessionID: req.sessionID });
            }
          });
        }
      });
    } catch (error) {
      console.error('Error in login test:', error);
      res.json({ error: 'Test failed', details: error });
    }
  });
  
  // Create a new test session
  app.post("/api/test-sessions", async (req, res) => {
    try {
      console.log("=== Creating test session ===");
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      console.log("User authenticated:", req.isAuthenticated());
      console.log("User data:", req.user);
      console.log("Session ID:", req.sessionID);
      console.log("Environment:", process.env.NODE_ENV);
      console.log("Database URL exists:", !!process.env.DATABASE_URL);
      
      // Validate session data with detailed error reporting
      let sessionData;
      try {
        sessionData = insertTestSessionSchema.parse(req.body);
        console.log("Schema validation successful");
      } catch (validationError) {
        console.error("Schema validation failed:", validationError);
        if (validationError.issues) {
          console.error("Validation issues:", JSON.stringify(validationError.issues, null, 2));
        }
        return res.status(400).json({ 
          message: "Invalid session data", 
          error: validationError.message,
          issues: validationError.issues || []
        });
      }
      
      // Associate with current user if authenticated
      if (req.isAuthenticated() && req.user) {
        sessionData.userId = (req.user as any).id;
        console.log("Associated with user ID:", (req.user as any).id);
      } else {
        console.log("User not authenticated or no user data available");
      }
      
      console.log("Final session data to store:", JSON.stringify(sessionData, null, 2));
      
      // Initialize timer for the first question
      const now = new Date();
      sessionData.questionStartTimes = [now.toISOString()];
      sessionData.lastActivityAt = now;
      
      const session = await storage.createTestSession(sessionData);
      console.log("Session created successfully:", session.id);
      console.log("=== Session creation complete ===");
      res.json(session);
    } catch (error) {
      console.error("=== Error creating test session ===");
      console.error("Error type:", typeof error);
      console.error("Error message:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack');
      if (error.issues) {
        console.error("Validation errors:", error.issues);
      }
      console.error("=== End error details ===");
      res.status(500).json({ 
        message: "Failed to create test session", 
        error: error instanceof Error ? error.message : String(error)
      });
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

  // Auto-save answer draft
  app.post("/api/test-sessions/:id/autosave", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { answerDraft } = req.body;
      
      if (typeof answerDraft !== 'string') {
        return res.status(400).json({ message: "Answer draft must be a string" });
      }
      
      const session = await storage.updateTestSession(sessionId, {
        currentAnswerDraft: answerDraft,
        lastActivityAt: new Date()
      });
      
      if (!session) {
        return res.status(404).json({ message: "Test session not found" });
      }
      
      res.json({ success: true, lastSaved: session.lastActivityAt });
    } catch (error) {
      console.error("Error auto-saving answer draft:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Check session timing and auto-submit if needed
  app.post("/api/test-sessions/:id/check-timing", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getTestSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: "Test session not found" });
      }
      
      const now = new Date();
      const currentQuestionTimeLimit = 10 * 60 * 1000; // 10 minutes in milliseconds
      
      // Initialize question start times if not set
      let questionStartTimes = session.questionStartTimes || [];
      let needsUpdate = false;
      
      // Set start time for current question if not already set
      if (!questionStartTimes[session.currentQuestionIndex]) {
        questionStartTimes[session.currentQuestionIndex] = now.toISOString();
        needsUpdate = true;
      }
      
      // Calculate elapsed time for current question based on absolute start time
      const questionStartTime = new Date(questionStartTimes[session.currentQuestionIndex]);
      const currentQuestionElapsed = now.getTime() - questionStartTime.getTime();
      
      // Check if current question time has expired
      const currentQuestionExpired = currentQuestionElapsed > currentQuestionTimeLimit;
      
      // Auto-submit if time expired and there's a draft
      let autoSubmitted = false;
      if (currentQuestionExpired && session.currentAnswerDraft && session.currentAnswerDraft.trim() !== '') {
        // Update the current answer in allAnswers array
        const updatedAnswers = [...session.allAnswers];
        updatedAnswers[session.currentQuestionIndex] = session.currentAnswerDraft;
        
        await storage.updateTestSession(sessionId, {
          allAnswers: updatedAnswers,
          currentAnswerDraft: '', // Clear the draft after submission
          questionStartTimes: questionStartTimes,
          lastActivityAt: now
        });
        
        autoSubmitted = true;
      } else if (needsUpdate) {
        // Update timing information
        await storage.updateTestSession(sessionId, {
          questionStartTimes: questionStartTimes,
          lastActivityAt: now
        });
      }
      
      // Calculate total session time elapsed (sum of all completed questions + current question)
      let totalSessionElapsed = 0;
      for (let i = 0; i < session.currentQuestionIndex; i++) {
        totalSessionElapsed += currentQuestionTimeLimit; // Each completed question used full 10 minutes
      }
      totalSessionElapsed += currentQuestionElapsed; // Add current question elapsed time
      
      res.json({
        sessionTimeElapsed: totalSessionElapsed,
        currentQuestionElapsed: currentQuestionElapsed,
        currentQuestionExpired: currentQuestionExpired,
        autoSubmitted: autoSubmitted,
        timeRemaining: Math.max(0, currentQuestionTimeLimit - currentQuestionElapsed),
        questionStartTime: questionStartTimes[session.currentQuestionIndex]
      });
    } catch (error) {
      console.error("Error checking session timing:", error);
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
      
      // Initialize timing for new question
      const now = new Date();
      let questionStartTimes = session.questionStartTimes || [];
      let questionTimeElapsed = session.questionTimeElapsed || [0, 0, 0];
      
      // Set start time for the new question
      questionStartTimes[nextIndex] = now.toISOString();
      
      // Update session with next question
      const updatedSession = await storage.updateTestSession(sessionId, {
        currentQuestionIndex: nextIndex,
        taskQuestion: nextQuestion,
        allQuestions: allQuestions,
        timeRemaining: 600, // 10 minutes for follow-up questions
        questionsAsked: 0, // Reset questions asked for new question
        questionPenalty: 0, // Reset penalty for new question
        finalAnswer: null, // Clear previous answer
        currentAnswerDraft: '', // Clear previous draft
        questionStartTimes: questionStartTimes,
        questionTimeElapsed: questionTimeElapsed,
        lastActivityAt: now
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

      const detailedGrades = await gradeAllAnswersWithFeedback(session.allQuestions, session.allAnswers);
      const grades = detailedGrades.map(dg => dg.score);
      const totalScore = grades.reduce((sum, grade) => sum + grade, 0);
      
      // Update the session with the final score
      await storage.updateTestSession(sessionId, { finalScore: totalScore });
      
      // Update user's total score if they're authenticated
      if (session.userId) {
        await storage.updateUserScore(session.userId, totalScore);
      }
      
      res.json({ 
        grades, 
        totalScore, 
        detailedGrades,
        questions: session.allQuestions,
        answers: session.allAnswers 
      });
    } catch (error) {
      console.error("Error grading session:", error);
      res.status(500).json({ error: "Failed to grade session" });
    }
  });

  // Proctoring API routes
  
  // Initialize proctoring session
  app.post("/api/proctoring/initialize", async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }

      const session = await storage.getTestSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Test session not found" });
      }

      const proctorSession = proctorService.initializeSession(sessionId, session.userId);
      
      res.json({ 
        success: true, 
        proctorSession: {
          sessionId: proctorSession.sessionId,
          isActive: proctorSession.isActive,
          startTime: proctorSession.startTime
        }
      });
    } catch (error) {
      console.error("Error initializing proctoring:", error);
      res.status(500).json({ message: "Failed to initialize proctoring" });
    }
  });

  // Record proctoring violation
  app.post("/api/proctoring/violations", async (req, res) => {
    try {
      const { sessionId, type, severity, description } = req.body;
      
      if (!sessionId || !type || !severity) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const shouldNullify = proctorService.recordViolation(sessionId, {
        type,
        severity,
        description: description || `${type} detected during exam`
      });

      if (shouldNullify) {
        // Delete the session from database
        try {
          await storage.updateTestSession(sessionId, {
            isSubmitted: true,
            finalScore: 0,
            finalAnswer: "EXAM_NULLIFIED_PROCTORING_VIOLATION"
          });
        } catch (error) {
          console.error("Error nullifying session:", error);
        }
      }

      const violationSummary = proctorService.getViolationSummary(sessionId);
      
      res.json({ 
        success: true, 
        nullified: shouldNullify,
        violations: violationSummary
      });
    } catch (error) {
      console.error("Error recording violation:", error);
      res.status(500).json({ message: "Failed to record violation" });
    }
  });

  // Get proctoring session status
  app.get("/api/proctoring/session/:sessionId", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const proctorSession = proctorService.getSessionStatus(sessionId);
      
      if (!proctorSession) {
        return res.status(404).json({ message: "Proctoring session not found" });
      }

      const violationSummary = proctorService.getViolationSummary(sessionId);
      const isValid = proctorService.isSessionValid(sessionId);
      
      res.json({
        sessionId: proctorSession.sessionId,
        isActive: proctorSession.isActive,
        isValid,
        cameraEnabled: proctorSession.cameraEnabled,
        fullscreenActive: proctorSession.fullscreenActive,
        violations: violationSummary,
        startTime: proctorSession.startTime
      });
    } catch (error) {
      console.error("Error fetching proctoring session:", error);
      res.status(500).json({ message: "Failed to fetch proctoring session" });
    }
  });

  // Update proctoring session status
  app.post("/api/proctoring/session/:sessionId/status", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const { cameraEnabled, fullscreenActive } = req.body;
      
      proctorService.updateSessionStatus(sessionId, {
        cameraEnabled,
        fullscreenActive
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating proctoring session:", error);
      res.status(500).json({ message: "Failed to update proctoring session" });
    }
  });

  // Version 1 Exam API Routes
  
  // Start a new V1 exam session
  app.post("/api/v1/sessions/start", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = (req.user as any).id;
      const examId = req.body.examId || 1; // Default to first exam
      
      // Get the exam details
      const exam = await storage.getExam(examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      // Create user session
      const userSession = await storage.createUserSession({
        userId,
        examId,
        currentStage: 1,
        questionsAsked: 0,
        userPath: null,
        completedAt: null,
      });

      res.json({
        ...userSession,
        exam
      });
    } catch (error) {
      console.error("Error starting V1 exam session:", error);
      res.status(500).json({ message: "Failed to start exam session" });
    }
  });

  // Get V1 exam session details
  app.get("/api/v1/sessions/:sessionId", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const userSession = await storage.getUserSession(sessionId);
      
      if (!userSession) {
        return res.status(404).json({ message: "Session not found" });
      }

      const exam = await storage.getExam(userSession.examId);
      
      res.json({
        ...userSession,
        exam
      });
    } catch (error) {
      console.error("Error fetching V1 exam session:", error);
      res.status(500).json({ message: "Failed to fetch exam session" });
    }
  });

  // Get current stage data for V1 exam
  app.get("/api/v1/stages/:sessionId/:stageNumber", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const stageNumber = parseInt(req.params.stageNumber);
      
      const userSession = await storage.getUserSession(sessionId);
      if (!userSession) {
        return res.status(404).json({ message: "Session not found" });
      }

      const stageData = await storage.getExamQuestionByStage(userSession.examId, stageNumber);
      if (!stageData) {
        return res.status(404).json({ message: "Stage not found" });
      }

      res.json({
        stageNumber: stageData.stageNumber,
        promptText: stageData.promptText,
        stageType: stageData.stageType
      });
    } catch (error) {
      console.error("Error fetching stage data:", error);
      res.status(500).json({ message: "Failed to fetch stage data" });
    }
  });

  // Get dialogue messages for V1 exam
  app.get("/api/v1/messages/:sessionId", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      
      const userResponses = await storage.getResponsesBySession(sessionId);
      const aiResponses = await storage.getAiResponsesBySession(sessionId);
      
      // Combine and sort messages by timestamp
      const allMessages = [
        ...userResponses.map(r => ({
          id: r.id,
          sessionId: r.sessionId,
          stageNumber: r.stageNumber,
          responseText: r.responseText,
          pathType: null,
          timestamp: r.timestamp,
          isUser: true
        })),
        ...aiResponses.map(r => ({
          id: r.id,
          sessionId: r.sessionId,
          stageNumber: r.stageNumber,
          responseText: r.responseText,
          pathType: r.pathType,
          timestamp: r.timestamp,
          isUser: false
        }))
      ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      res.json(allMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Submit response for V1 exam
  app.post("/api/v1/responses/submit", async (req, res) => {
    try {
      const { sessionId, stageNumber, responseText, responseType } = req.body;
      
      if (!sessionId || !stageNumber || !responseText || !responseType) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Store user response
      const userResponse = await storage.createResponse({
        sessionId,
        stageNumber,
        responseText,
        responseType,
        aiEvaluation: null,
        score: null
      });

      // Process with AI and generate response
      const aiResponse = await processV1Response(sessionId, stageNumber, responseText, responseType);
      
      res.json({
        userResponse,
        aiResponse
      });
    } catch (error) {
      console.error("Error submitting V1 response:", error);
      res.status(500).json({ message: "Failed to submit response" });
    }
  });

  // Process V1 response with AI
  async function processV1Response(sessionId: number, stageNumber: number, responseText: string, responseType: string) {
    try {
      // Get session details
      const userSession = await storage.getUserSession(sessionId);
      if (!userSession) {
        throw new Error("Session not found");
      }

      let aiResponseText = "";
      let pathType = null;
      let evaluation = null;
      let score = null;

      // Process based on stage type
      if (responseType === 'assumption') {
        // Stage 1: Evaluate assumptions
        evaluation = await evaluateAssumptions(responseText);
        score = evaluation.score;
        aiResponseText = `Thank you for your assumptions. ${evaluation.feedback} Now, let's move to the next stage.`;
        
        // Update session to stage 2
        await storage.updateUserSession(sessionId, { 
          currentStage: 2,
          questionsAsked: userSession.questionsAsked + 1 
        });
        
      } else if (responseType === 'questioning') {
        // Stage 2: Categorize question and determine path
        const questionAnalysis = await categorizeQuestion(responseText);
        pathType = questionAnalysis.path;
        
        // Update session with determined path
        await storage.updateUserSession(sessionId, { 
          currentStage: 3,
          questionsAsked: userSession.questionsAsked + 1,
          userPath: pathType 
        });
        
        aiResponseText = generatePathResponse(pathType, questionAnalysis.reasoning);
        
      } else if (responseType === 'synthesis') {
        // Stage 3: Final synthesis evaluation
        evaluation = await evaluateSynthesis(responseText, userSession.userPath);
        score = evaluation.score;
        aiResponseText = `Excellent synthesis! ${evaluation.feedback}`;
        
        // Mark session as completed
        await storage.updateUserSession(sessionId, { 
          completedAt: new Date().toISOString() 
        });
      }

      // Store AI response
      const aiResponse = await storage.createAiResponse({
        sessionId,
        stageNumber,
        responseText: aiResponseText,
        pathType
      });

      // Update user response with evaluation if available
      if (evaluation) {
        await storage.createResponse({
          sessionId,
          stageNumber,
          responseText: responseText,
          responseType: responseType,
          aiEvaluation: JSON.stringify(evaluation),
          score: score
        });
      }

      return aiResponse;
    } catch (error) {
      console.error("Error processing V1 response:", error);
      throw error;
    }
  }

  // AI evaluation functions
  async function evaluateAssumptions(assumptionsText: string) {
    // Placeholder for AI evaluation - would use OpenAI API
    return {
      score: Math.floor(Math.random() * 5) + 6, // 6-10 range
      feedback: "Your assumptions show good critical thinking. Consider exploring deeper historical implications."
    };
  }

  async function categorizeQuestion(questionText: string) {
    // Placeholder for AI categorization - would use OpenAI API
    const paths = ['PATH_A', 'PATH_B', 'PATH_C'];
    const randomPath = paths[Math.floor(Math.random() * paths.length)];
    
    return {
      path: randomPath,
      reasoning: `Your question demonstrates ${randomPath === 'PATH_A' ? 'surface-level' : randomPath === 'PATH_B' ? 'systemic' : 'epistemological'} thinking.`
    };
  }

  async function evaluateSynthesis(synthesisText: string, userPath: string | null) {
    // Placeholder for AI evaluation - would use OpenAI API
    return {
      score: Math.floor(Math.random() * 5) + 6, // 6-10 range
      feedback: `Your synthesis effectively integrates your ${userPath || 'analytical'} approach with the historical evidence.`
    };
  }

  function generatePathResponse(pathType: string, reasoning: string) {
    const responses = {
      'PATH_A': "Based on your question focus, here's additional factual information that might help...",
      'PATH_B': "Your systemic thinking approach is valuable. Consider these broader implications...",
      'PATH_C': "Your epistemological inquiry is thought-provoking. Let's explore the fundamental assumptions..."
    };
    
    return responses[pathType as keyof typeof responses] || "Thank you for your question. Let's continue...";
  }

  const httpServer = createServer(app);
  return httpServer;
}
