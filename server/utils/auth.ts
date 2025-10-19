import type { H3Event } from "h3";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// eslint-disable-next-line node/no-process-env
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
// eslint-disable-next-line node/no-process-env
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key-change-in-production";
const JWT_EXPIRES_IN = "1h";
const JWT_REFRESH_EXPIRES_IN = "7d";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(userId: string, role: string): string {
  return jwt.sign({ userId, role, type: "access" }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function generateRefreshToken(userId: string, role: string): string {
  return jwt.sign({ userId, role, type: "refresh" }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  });
}

export function verifyAccessToken(token: string): { userId: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string; type: string };
    if (decoded.type !== "access") {
      return null;
    }
    return { userId: decoded.userId, role: decoded.role };
  }
  catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): { userId: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string; role: string; type: string };
    if (decoded.type !== "refresh") {
      return null;
    }
    return { userId: decoded.userId, role: decoded.role };
  }
  catch {
    return null;
  }
}

export async function requireAuth(event: H3Event): Promise<{ userId: string; role: string }> {
  const authHeader = getHeader(event, "authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized - No token provided",
    });
  }

  const token = authHeader.substring(7);
  const decoded = verifyAccessToken(token);

  if (!decoded) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized - Invalid token",
    });
  }

  return decoded;
}

export async function requireAdmin(event: H3Event): Promise<{ userId: string; role: string }> {
  const user = await requireAuth(event);
  if (user.role !== "admin") {
    throw createError({
      statusCode: 403,
      message: "Forbidden - Admin access required",
    });
  }
  return user;
}
