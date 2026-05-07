import { pgTable, text, timestamp, uuid, date, index } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { petsTable } from "./pets";
import { usersTable } from "./users";

export const vaccinesTable = pgTable(
  "vaccines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    petId: uuid("pet_id")
      .notNull()
      .references(() => petsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    appliedAt: date("applied_at").notNull(),
    nextDueAt: date("next_due_at"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("vaccines_clinic_idx").on(t.clinicId),
    index("vaccines_pet_idx").on(t.petId),
    index("vaccines_due_idx").on(t.clinicId, t.nextDueAt),
  ],
);

export type Vaccine = typeof vaccinesTable.$inferSelect;
export type InsertVaccine = typeof vaccinesTable.$inferInsert;
