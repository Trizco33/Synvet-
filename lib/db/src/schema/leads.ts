import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";

export const leadsTable = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    clinicName: text("clinic_name"),
    role: text("role"),
    message: text("message"),
    source: text("source").notNull().default("landing"),
    status: text("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: index("leads_email_idx").on(t.email),
    createdAtIdx: index("leads_created_at_idx").on(t.createdAt),
  }),
);

export type Lead = typeof leadsTable.$inferSelect;
export type InsertLead = typeof leadsTable.$inferInsert;
