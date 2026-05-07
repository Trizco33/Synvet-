import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { clinicsTable } from "./clinics";

export const USER_ROLES = ["admin", "vet", "assistant"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authId: text("auth_id").notNull().unique(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    role: text("role", { enum: USER_ROLES }).notNull().default("vet"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("users_clinic_idx").on(t.clinicId)],
);

export const usersRelations = relations(usersTable, ({ one }) => ({
  clinic: one(clinicsTable, {
    fields: [usersTable.clinicId],
    references: [clinicsTable.id],
  }),
}));

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
