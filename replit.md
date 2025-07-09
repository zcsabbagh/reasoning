# Test Platform Application

## Overview

This is a full-stack academic test platform application built with React and Express. The application provides an interactive testing environment where students can answer questions, ask for clarifications through an AI-powered chat interface, and receive real-time scoring based on their performance.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: TailwindCSS with shadcn/ui components
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: Radix UI primitives with custom styling
- **Build Tool**: Vite for fast development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Supabase (PostgreSQL)
- **AI Integration**: OpenAI API for chat clarifications and grading
- **Session Management**: PostgreSQL database with fallback to in-memory storage

## Key Components

### Database Schema
- **Test Sessions**: Stores test metadata including questions, answers, timing, and scoring
- **Chat Messages**: Stores conversation history between students and AI assistant
- **Scoring System**: Tracks base scores, question penalties, and information gain bonuses

### Frontend Components
- **Test Timer**: Real-time countdown with visual warnings
- **Chat Interface**: AI-powered clarification system
- **Answer Section**: Word-limited text input with validation
- **Scoring Panel**: Live score calculation and display
- **Responsive Design**: Mobile-friendly interface

### Backend Services
- **Storage Layer**: Abstracted storage interface with memory and database implementations
- **OpenAI Service**: Handles AI-powered question clarification
- **API Routes**: RESTful endpoints for sessions and chat functionality

## Data Flow

1. **Session Initialization**: Creates a new test session with default parameters
2. **Real-time Updates**: Frontend polls backend for session state changes
3. **Chat Interaction**: Student questions are sent to OpenAI API for intelligent responses
4. **Score Calculation**: Dynamic scoring based on question count and information gain
5. **Answer Submission**: Final answer validation and session completion

## External Dependencies

### Production Dependencies
- **Database**: Neon Database (PostgreSQL) with Drizzle ORM
- **AI Service**: OpenAI API for chat functionality
- **UI Library**: Radix UI components for accessibility
- **Styling**: TailwindCSS for responsive design

### Development Dependencies
- **Build Tools**: Vite, ESBuild, TypeScript
- **Development Environment**: Replit-specific plugins and error handling

## Deployment Strategy

### Development Mode
- Frontend served via Vite development server
- Backend runs with tsx for TypeScript execution
- Hot module replacement for rapid development

### Production Build
- Frontend builds to static assets in `dist/public`
- Backend bundles to `dist/index.js` with ESBuild
- Single-server deployment serving both frontend and API

### Environment Configuration
- Database connection via `DATABASE_URL` environment variable
- OpenAI API key via `OPENAI_API_KEY` environment variable
- Production/development mode switching via `NODE_ENV`

## Changelog
- July 05, 2025. Initial setup
- July 05, 2025. Added voice recording with OpenAI Whisper transcription
- July 05, 2025. Implemented multi-question progression (30 min + 10 min + 10 min)
- July 05, 2025. Enhanced chat interface with markdown formatting and immediate message display
- July 05, 2025. Added AI-generated follow-up questions based on original question
- July 05, 2025. Integrated Groq transcription as primary service with OpenAI fallback
- July 05, 2025. Added voice recording to final answer text box
- July 05, 2025. Made chat input expandable for longer clarifying questions
- July 05, 2025. Renamed platform to "Citium" and removed scoring components
- July 05, 2025. Changed all questions to 10-minute time limits
- July 05, 2025. Adjusted layout: narrower answer section, wider chat interface
- July 05, 2025. Added AI grading system with OpenAI API for 25-point scoring per question
- July 05, 2025. Implemented test completion flow with automatic grading and results display
- July 05, 2025. Fixed typing smoothness with debounced input handling
- July 05, 2025. Integrated Supabase database for persistent storage of sessions and chat messages
- July 05, 2025. Implemented LinkedIn Sign-In authentication with user management and session association
- July 05, 2025. Added user database schema with automatic migration and foreign key relationships
- July 05, 2025. Created login page with LinkedIn OAuth integration and user profile display in header
- July 06, 2025. Migrated to LinkedIn's modern OpenID Connect API with proper userinfo endpoint
- July 06, 2025. Created RankLift leaderboard page showing top users with profile photos, names, and exam scores
- July 06, 2025. Added totalScore field to users table with default value of 20 for new users
- July 06, 2025. Implemented automatic score updating when users complete exams
- July 06, 2025. Renamed "RankLift" to "Rankings" throughout the application and updated URL paths from /ranklift to /rankings
- July 06, 2025. Removed email display from leaderboard and added numerical rank display (Rank #1, #2, etc.)
- July 06, 2025. Created questions database with question-rubric pairs and API endpoints for random question selection
- July 06, 2025. Implemented automatic database seeding with 3 academic questions covering history, urban planning, and environmental science
- July 06, 2025. Implemented persistent sessions using Supabase database with 30-day session cookies
- July 06, 2025. Created account page with exam management, score tracking, and ability to start new exams or continue existing ones
- July 06, 2025. Updated authentication flow to redirect to account page after LinkedIn sign-in
- July 06, 2025. Enhanced exam history display with detailed score breakdowns for completed exams instead of continue buttons
- July 06, 2025. Added seamless navigation between Account and Rankings pages with dedicated buttons
- July 06, 2025. Fixed production authentication issues by adjusting proxy trust settings and cookie security configuration
- July 06, 2025. Created exam preparation page with microphone testing and comprehensive exam instructions including 30-minute time limit, no pause policy, and AI cheating detection warning
- July 08, 2025. Migrated to AI SDK with multi-provider fallback (OpenAI → Anthropic → Gemini) for robust AI responses
- July 08, 2025. Added reusable "Thinking..." indicator component for all AI interactions
- July 08, 2025. Converted storage to Supabase-only architecture, removed in-memory storage fallback
- July 08, 2025. Fixed questions table creation and seeding issues in production environment
- July 09, 2025. Implemented comprehensive auto-save system with 5-second intervals to prevent data loss
- July 09, 2025. Added database-persistent timer system that maintains timing across page reloads
- July 09, 2025. Implemented true background timer using absolute start times that continues counting down even when user is away from webpage
- July 09, 2025. Enhanced test session schema with auto-save fields: currentAnswerDraft, questionStartTimes, questionTimeElapsed, lastActivityAt
- July 09, 2025. Updated TestTimer component to use database-persisted timing instead of client-side calculations
- July 09, 2025. Added auto-submission functionality when question time limits expire
- July 09, 2025. Created comprehensive proctoring system with camera monitoring, fullscreen enforcement, and violation detection
- July 09, 2025. Integrated proctoring setup into exam preparation page with ready status indicators
- July 09, 2025. Added proctoring violation modal with detailed messaging and automatic exam nullification for critical violations

## User Preferences

Preferred communication style: Simple, everyday language.