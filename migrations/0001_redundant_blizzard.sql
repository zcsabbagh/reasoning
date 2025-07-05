CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"linkedin_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"profile_picture_url" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_linkedin_id_unique" UNIQUE("linkedin_id")
);
--> statement-breakpoint
ALTER TABLE "test_sessions" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;