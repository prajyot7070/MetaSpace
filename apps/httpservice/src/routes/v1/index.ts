import { Router } from "express";
import userRouter from "./user";
import spaceRouter from "./space"
export const router = Router();

router.get("/", (req, res) => {
  res.json({
    message: "/api/v1"
  })
})
router.use("/space", spaceRouter);
router.use("/user", userRouter);

