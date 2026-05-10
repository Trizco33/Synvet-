import { pgTable, text, timestamp, uuid, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { usersTable } from "./users";

/**
 * Auditoria de importações em massa via wizard de CSV (Fase B5).
 * Cada execução de POST /import/:kind grava 1 linha — independente de ter
 * inserido 0 ou N registros. Hash do arquivo (sha256 dos rows serializados)
 * permite detectar reimportações idênticas. `fileName` é o nome original
 * informado pelo cliente; `mapping` guarda o mapeamento coluna→campo usado.
 */
export const importLogsTable = pgTable(
  "import_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    kind: text("kind", {
      enum: ["tutors", "pets", "appointments", "exams", "vaccines", "medical_records"],
    }).notNull(),
    fileName: text("file_name"),
    fileHash: text("file_hash").notNull(),
    rowCount: integer("row_count").notNull(),
    createdCount: integer("created_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    mapping: text("mapping"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("import_logs_clinic_idx").on(t.clinicId, t.createdAt),
    uniqueIndex("import_logs_dedupe_idx").on(t.clinicId, t.kind, t.fileHash),
  ],
);

export type ImportLog = typeof importLogsTable.$inferSelect;
