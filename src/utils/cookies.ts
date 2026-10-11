import { Response, CookieOptions } from "express";
import { env, isProd } from "../config/env";
import { parseDurationMs } from "./duration";

export const ACCESS_COOKIE = "accessToken";
export const REFRESH_COOKIE = "refreshToken";
const REFRESH_PATH = "/api/v1/auth";

const base: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
};

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  res.cookie(ACCESS_COOKIE, accessToken, { ...base, maxAge: parseDurationMs(env.jwtAccessExpires) });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    path: REFRESH_PATH,
    maxAge: parseDurationMs(env.jwtRefreshExpires),
  });
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, { ...base, path: REFRESH_PATH });
};