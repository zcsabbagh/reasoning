CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"content" text NOT NULL,
	"is_user" boolean NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "test_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_question" text NOT NULL,
	"final_answer" text,
	"time_remaining" integer DEFAULT 1800 NOT NULL,
	"questions_asked" integer DEFAULT 0 NOT NULL,
	"is_submitted" boolean DEFAULT false NOT NULL,
	"base_score" integer DEFAULT 25 NOT NULL,
	"question_penalty" integer DEFAULT 0 NOT NULL,
	"info_gain_bonus" integer DEFAULT 0 NOT NULL,
	"current_question_index" integer DEFAULT 0 NOT NULL,
	"all_questions" text[] NOT NULL,
	"all_answers" text[] DEFAULT '{"","",""}' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
