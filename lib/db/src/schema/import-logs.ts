import { pgTable, text, timestamp, uuid, integer, index, jsonb } from "drizzle-orm/pg-core";
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
      enum: [
        "tutors",
        "pets",
        "appointments",
        "exams",
        "vaccines",
        "medical_records",
        "weigh_ins",
        "prescriptions",
      ],
    }).notNull(),
    fileName: text("file_name"),
    fileHash: text("file_hash").notNull(),
    rowCount: integer("row_count").notNull(),
    createdCount: integer("created_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    mapping: text("mapping"),
    // Relatório linha-a-linha persistido para auditoria pós-import.
    // Cada item: { row, outcome, message?, id? }. Pode ser null em logs
    // antigos (anteriores à coluna).
    results: jsonb("results").$type<
      Array<{ row: number; outcome: "created" | "updated" | "skipped" | "error"; message?: string; id?: string }>
    >(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("import_logs_clinic_idx").on(t.clinicId, t.createdAt),
    // Não-único de propósito: queremos preservar o histórico de
    // reimportações do mesmo arquivo (mesmo hash) para auditoria. A
    // lógica de bloqueio de re-upload acidental fica na rota
    // (POST /import/:kind), que consulta este índice.
    index("import_logs_dedupe_idx").on(t.clinicId, t.kind, t.fileHash),
  ],
);

export type ImportLog = typeof importLogsTable.$inferSelect;
