import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";

type Source = "body" | "query" | "params";

export const validate =
  (schema: ZodType, source: Source = "body") =>
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.parse(req[source]); 
    if (source === "body") req.body = parsed;
    else res.locals[source] = parsed;
    next();
  };