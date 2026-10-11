import { HydratedDocument } from "mongoose";
import { User, IUser } from "../models/User";
import { ROLES } from "../constants";
import { ApiError } from "../utils/ApiError";
import {
  signAccessToken, signRefreshToken, verifyRefreshToken, hashToken,
} from "../utils/jwt";
import { RegisterInput, LoginInput } from "../validators/auth.validator";

const issueTokens = async (user: HydratedDocument<IUser>) => {
  const id = user._id.toString();
  const accessToken = signAccessToken(id, user.role);
  const refreshToken = signRefreshToken(id);
  await User.updateOne({ _id: user._id }, { refreshToken: hashToken(refreshToken) });
  return { accessToken, refreshToken };
};

export const register = async (input: RegisterInput) => {
  const exists = await User.exists({ email: input.email });
  if (exists) throw ApiError.conflict("Email already registered");

  // public signup can NEVER choose a role; admins create managers/admins
  const user = await User.create({ ...input, role: ROLES.SALES_EXECUTIVE });
  return user;
};

export const login = async ({ email, password }: LoginInput) => {
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized("Invalid email or password");
  }
  if (!user.isActive) throw ApiError.forbidden("Your account has been deactivated");

  const tokens = await issueTokens(user);
  return { user, ...tokens };
};

export const refresh = async (token?: string) => {
  if (!token) throw ApiError.unauthorized("Refresh token missing");

  let userId: string;
  try {
    userId = verifyRefreshToken(token).sub;
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const user = await User.findById(userId).select("+refreshToken");
  if (!user || !user.refreshToken || user.refreshToken !== hashToken(token)) {
    throw ApiError.unauthorized("Invalid or expired refresh token"); // reuse/rotation check
  }
  if (!user.isActive) throw ApiError.forbidden("Your account has been deactivated");

  const tokens = await issueTokens(user); // rotate
  return { user, ...tokens };
};

export const logout = async (token?: string): Promise<void> => {
  if (!token) return;
  try {
    const { sub } = verifyRefreshToken(token);
    await User.updateOne({ _id: sub }, { refreshToken: null });
  } catch {
    /* token already invalid: nothing to revoke */
  }
};