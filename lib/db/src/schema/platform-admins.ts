import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const platformAdminsTable = pgTable("platform_admins", {
  authId: text("auth_id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PlatformAdmin = typeof platformAdminsTable.$inferSelect;
export type InsertPlatformAdmin = typeof platformAdminsTable.$inferInsert;
