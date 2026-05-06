import { pgTable, text, timestamp, uuid, date, index } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { petsTable } from "./pets";

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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("vaccines_clinic_idx").on(t.clinicId),
    index("vaccines_pet_idx").on(t.petId),
  ],
);

export type Vaccine = typeof vaccinesTable.$inferSelect;
export type InsertVaccine = typeof vaccinesTable.$inferInsert;
