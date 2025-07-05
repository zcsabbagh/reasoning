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
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **AI Integration**: OpenAI API for chat clarifications
- **Session Management**: In-memory storage with fallback to database

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

## User Preferences

Preferred communication style: Simple, everyday language.