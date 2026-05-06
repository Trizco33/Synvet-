import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const clinicsTable = pgTable("clinics", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  cnpj: text("cnpj"),
  phone: text("phone"),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Clinic = typeof clinicsTable.$inferSelect;
export type InsertClinic = typeof clinicsTable.$inferInsert;
