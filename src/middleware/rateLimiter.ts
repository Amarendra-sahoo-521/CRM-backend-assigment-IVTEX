import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

const handler = (msg: string) => (_req: Request, res: Response) =>
  res.status(429).json({ success: false, message: msg });

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler("Too many requests, please try again later"),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler("Too many auth attempts, please try again later"),
});