import crypto from "node:crypto";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { Role } from "../constants";

export interface AccessPayload extends JwtPayload { sub: string; role: Role }
export interface RefreshPayload extends JwtPayload { sub: string }

export const signAccessToken = (userId: string, role: Role): string =>
  jwt.sign({ role }, env.jwtAccessSecret, {
    subject: userId,
    expiresIn: env.jwtAccessExpires as SignOptions["expiresIn"],
  });

export const signRefreshToken = (userId: string): string =>
  jwt.sign({}, env.jwtRefreshSecret, {
    subject: userId,
    jwtid: crypto.randomUUID(),
    expiresIn: env.jwtRefreshExpires as SignOptions["expiresIn"],
  });

export const verifyAccessToken = (token: string): AccessPayload =>
  jwt.verify(token, env.jwtAccessSecret) as AccessPayload;

export const verifyRefreshToken = (token: string): RefreshPayload =>
  jwt.verify(token, env.jwtRefreshSecret) as RefreshPayload;

// refresh tokens are stored hashed, never in plain text
export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");