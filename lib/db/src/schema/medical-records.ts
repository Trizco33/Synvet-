import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { petsTable } from "./pets";

export const medicalRecordsTable = pgTable(
  "medical_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    petId: uuid("pet_id")
      .notNull()
      .references(() => petsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("medical_records_clinic_idx").on(t.clinicId),
    index("medical_records_pet_idx").on(t.petId),
  ],
);

export type MedicalRecord = typeof medicalRecordsTable.$inferSelect;
export type InsertMedicalRecord = typeof medicalRecordsTable.$inferInsert;
