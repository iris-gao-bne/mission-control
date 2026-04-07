import { Router } from "express";
import { authRouter } from "./auth";
import { missionRouter } from "./mission";

export const router = Router();

router.use("/auth", authRouter);
router.use("/missions", missionRouter);
