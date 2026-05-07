import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { consultationsTable } from "./consultations";
import { usersTable } from "./users";

export const anamnesesTable = pgTable("anamneses", {
  id: uuid("id").defaultRandom().primaryKey(),
  clinicId: uuid("clinic_id")
    .notNull()
    .references(() => clinicsTable.id, { onDelete: "cascade" }),
  consultationId: uuid("consultation_id")
    .notNull()
    .unique()
    .references(() => consultationsTable.id, { onDelete: "cascade" }),
  neurological: text("neurological"),
  digestive: text("digestive"),
  respiratory: text("respiratory"),
  dermatological: text("dermatological"),
  general: text("general"),
  createdBy: uuid("created_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Anamnesis = typeof anamnesesTable.$inferSelect;
export type InsertAnamnesis = typeof anamnesesTable.$inferInsert;
