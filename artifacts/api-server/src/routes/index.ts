import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import leadsRouter from "./leads";
import meRouter from "./me";
import tutorsRouter from "./tutors";
import petsRouter from "./pets";
import consultationsRouter from "./consultations";
import examsRouter from "./exams";
import dashboardRouter from "./dashboard";
import timelineRouter from "./timeline";
import teamRouter from "./team";
import storageRouter from "./storage";
import aiRouter from "./ai";
import copilotRouter from "./copilot";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(leadsRouter);

router.use(authMiddleware);
router.use(meRouter);
router.use(tutorsRouter);
router.use(petsRouter);
router.use(timelineRouter);
router.use(consultationsRouter);
router.use(examsRouter);
router.use(dashboardRouter);
router.use(teamRouter);
router.use(storageRouter);
router.use(aiRouter);
router.use(copilotRouter);

export default router;
