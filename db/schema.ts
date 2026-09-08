import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const debtors = pgTable("debtors", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sentReminders = pgTable("sent_reminders", {
  key: text("key").primaryKey(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
});
