import { Router } from "express";
import { authRouter } from "./auth";
import { missionRouter } from "./mission";
import { crewRouter } from "./crew";
import { skillsRouter } from "./skills";

export const router = Router();

router.use("/auth", authRouter);
router.use("/missions", missionRouter);
router.use("/crew", crewRouter);
router.use("/skills", skillsRouter);
