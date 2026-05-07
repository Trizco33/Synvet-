import { pgTable, text, timestamp, uuid, date, index } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { petsTable } from "./pets";
import { consultationsTable } from "./consultations";
import { usersTable } from "./users";

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
    consultationId: uuid("consultation_id").references(() => consultationsTable.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    category: text("category").notNull(),
    status: text("status", { enum: ["pending", "completed"] })
      .notNull()
      .default("pending"),
    filePath: text("file_path"),
    fileUrl: text("file_url"),
    fileType: text("file_type"),
    fileSize: text("file_size"),
    notes: text("notes"),
    performedAt: date("performed_at").notNull(),
    createdBy: uuid("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("exams_clinic_idx").on(t.clinicId),
    index("exams_pet_idx").on(t.petId),
    index("exams_consultation_idx").on(t.consultationId),
    index("exams_performed_idx").on(t.clinicId, t.performedAt),
  ],
);

export type Exam = typeof examsTable.$inferSelect;
export type InsertExam = typeof examsTable.$inferInsert;
