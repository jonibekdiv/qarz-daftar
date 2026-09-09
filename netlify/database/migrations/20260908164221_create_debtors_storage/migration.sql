CREATE TABLE "debtors" (
	"id" text PRIMARY KEY,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sent_reminders" (
	"key" text PRIMARY KEY,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
