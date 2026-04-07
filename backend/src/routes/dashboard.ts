import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { getDashboard } from "../services/dashboard.service";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await getDashboard(req.user!);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
