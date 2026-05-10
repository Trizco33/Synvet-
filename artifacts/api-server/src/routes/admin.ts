import { Router, type IRouter } from "express";
import { desc, eq, gte, sql } from "drizzle-orm";
import {
  db,
  clinicsTable,
  usersTable,
  petsTable,
  leadsTable,
} from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { superAdminMiddleware, requireSuperAdmin } from "../middlewares/super-admin";

const router: IRouter = Router();

router.use("/admin", superAdminMiddleware);

router.get("/admin/me", (req, res) => {
  const admin = requireSuperAdmin(req);
  res.json(
    schemas.GetAdminMeResponse.parse({
      authId: admin.authId,
      email: admin.email,
      name: admin.name,
    }),
  );
});

router.get("/admin/clinics", async (_req, res) => {
  const rows = await db
    .select({
      id: clinicsTable.id,
      name: clinicsTable.name,
      plan: clinicsTable.plan,
      status: clinicsTable.status,
      trialEndsAt: clinicsTable.trialEndsAt,
      currentPeriodEnd: clinicsTable.currentPeriodEnd,
      createdAt: clinicsTable.createdAt,
      usersCount: sql<number>`(select count(*)::int from ${usersTable} where ${usersTable.clinicId} = ${clinicsTable.id})`,
      petsCount: sql<number>`(select count(*)::int from ${petsTable} where ${petsTable.clinicId} = ${clinicsTable.id})`,
    })
    .from(clinicsTable)
    .orderBy(desc(clinicsTable.createdAt));
  res.json(rows);
});

router.get("/admin/leads", async (_req, res) => {
  const rows = await db
    .select()
    .from(leadsTable)
    .orderBy(desc(leadsTable.createdAt))
    .limit(500);
  res.json(rows);
});

router.patch("/admin/leads/:leadId", async (req, res) => {
  const parsed = schemas.UpdateAdminLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(leadsTable)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(leadsTable.id, req.params.leadId))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Lead não encontrado" });
    return;
  }
  res.json(row);
});

router.get("/admin/metrics", async (_req, res) => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [agg] = await db
    .select({
      totalClinics: sql<number>`count(*)::int`,
      trialingClinics: sql<number>`count(*) filter (where ${clinicsTable.status} = 'trialing')::int`,
      activeClinics: sql<number>`count(*) filter (where ${clinicsTable.status} = 'active')::int`,
      pastDueClinics: sql<number>`count(*) filter (where ${clinicsTable.status} = 'past_due')::int`,
      suspendedClinics: sql<number>`count(*) filter (where ${clinicsTable.status} = 'suspended')::int`,
    })
    .from(clinicsTable);
  const [usersAgg] = await db
    .select({ totalUsers: sql<number>`count(*)::int` })
    .from(usersTable);
  const [leadsAgg] = await db
    .select({ totalLeads: sql<number>`count(*)::int` })
    .from(leadsTable);
  const [leadsWeek] = await db
    .select({ leadsThisWeek: sql<number>`count(*)::int` })
    .from(leadsTable)
    .where(gte(leadsTable.createdAt, oneWeekAgo));
  const [signupsWeek] = await db
    .select({ signupsThisWeek: sql<number>`count(*)::int` })
    .from(clinicsTable)
    .where(gte(clinicsTable.createdAt, oneWeekAgo));

  res.json({
    totalClinics: agg.totalClinics,
    trialingClinics: agg.trialingClinics,
    activeClinics: agg.activeClinics,
    pastDueClinics: agg.pastDueClinics,
    suspendedClinics: agg.suspendedClinics,
    totalUsers: usersAgg.totalUsers,
    totalLeads: leadsAgg.totalLeads,
    leadsThisWeek: leadsWeek.leadsThisWeek,
    signupsThisWeek: signupsWeek.signupsThisWeek,
  });
});

export default router;
