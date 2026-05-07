import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { schemas } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/clinic/team", async (req, res): Promise<void> => {
  const user = requireAuth(req);
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.clinicId, user.clinicId))
    .orderBy(asc(usersTable.createdAt));
  res.json(schemas.ListTeamResponse.parse(rows));
});

router.patch(
  "/clinic/team/:memberId",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const user = requireAuth(req);
    const params = schemas.UpdateTeamMemberParams.safeParse(req.params);
    const body = schemas.UpdateTeamMemberBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    if (Object.keys(body.data).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }
    if (params.data.memberId === user.id && body.data.role && body.data.role !== "admin") {
      res.status(400).json({ error: "Não é possível remover seu próprio acesso de admin" });
      return;
    }
    const [updated] = await db
      .update(usersTable)
      .set({ ...body.data, updatedAt: new Date() })
      .where(
        and(
          eq(usersTable.id, params.data.memberId),
          eq(usersTable.clinicId, user.clinicId),
        ),
      )
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      });
    if (!updated) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    res.json(schemas.UpdateTeamMemberResponse.parse(updated));
  },
);

export default router;
