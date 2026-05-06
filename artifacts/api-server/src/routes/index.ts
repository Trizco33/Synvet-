import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import tutorsRouter from "./tutors";
import petsRouter from "./pets";
import consultationsRouter from "./consultations";
import examsRouter from "./exams";
import dashboardRouter from "./dashboard";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);

router.use(authMiddleware);
router.use(meRouter);
router.use(tutorsRouter);
router.use(petsRouter);
router.use(consultationsRouter);
router.use(examsRouter);
router.use(dashboardRouter);

export default router;
