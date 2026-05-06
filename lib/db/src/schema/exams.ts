import { pgTable, text, timestamp, uuid, date, index } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { petsTable } from "./pets";

export const examsTable = pgTable(
  "exams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    petId: uuid("pet_id")
      .notNull()
      .references(() => petsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category").notNull(),
    status: text("status", { enum: ["pending", "completed"] })
      .notNull()
      .default("pending"),
    fileUrl: text("file_url"),
    fileType: text("file_type"),
    notes: text("notes"),
    performedAt: date("performed_at").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("exams_clinic_idx").on(t.clinicId),
    index("exams_pet_idx").on(t.petId),
  ],
);

export type Exam = typeof examsTable.$inferSelect;
export type InsertExam = typeof examsTable.$inferInsert;
