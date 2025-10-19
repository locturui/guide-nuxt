import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const body = await readFormData(event);
  const refreshToken = body.get("refresh_token") as string;

  if (!refreshToken) {
    throw createError({
      statusCode: 400,
      message: "Refresh token is required",
    });
  }

  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    throw createError({
      statusCode: 401,
      message: "Invalid refresh token",
    });
  }

  const newAccessToken = generateAccessToken(decoded.userId, decoded.role);
  const newRefreshToken = generateRefreshToken(decoded.userId, decoded.role);

  return {
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
    token_type: "bearer",
    role: decoded.role,
  };
});
