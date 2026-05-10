import { pgTable, text, timestamp, uuid, date, index } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { petsTable } from "./pets";
import { usersTable } from "./users";

export const prescriptionsTable = pgTable(
  "prescriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    petId: uuid("pet_id")
      .notNull()
      .references(() => petsTable.id, { onDelete: "cascade" }),
    prescribedAt: date("prescribed_at").notNull(),
    medication: text("medication").notNull(),
    dosage: text("dosage"),
    duration: text("duration"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("prescriptions_clinic_idx").on(t.clinicId),
    index("prescriptions_pet_idx").on(t.petId, t.prescribedAt),
  ],
);

export type Prescription = typeof prescriptionsTable.$inferSelect;
export type InsertPrescription = typeof prescriptionsTable.$inferInsert;
