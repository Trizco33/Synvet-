import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, clinicsTable } from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/me", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  res.json(
    schemas.GetMeResponse.parse({
      userId: user.id,
      email: user.email,
      name: user.name,
      clinicId: user.clinicId,
      role: user.role,
    }),
  );
});

router.get("/clinic", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const [clinic] = await db
    .select()
    .from(clinicsTable)
    .where(eq(clinicsTable.id, user.clinicId));
  if (!clinic) {
    res.status(404).json({ error: "Clinic not found" });
    return;
  }
  res.json(schemas.GetClinicResponse.parse(clinic));
});

router.patch("/clinic", requireRole("admin"), async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const parsed = schemas.UpdateClinicBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [clinic] = await db
    .update(clinicsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(clinicsTable.id, user.clinicId))
    .returning();
  res.json(schemas.UpdateClinicResponse.parse(clinic));
});

export default router;
