/**
 * Decode JWT token and extract payload
 * Note: This does NOT verify the signature, only decodes the payload
 */
export type JWTPayload = {
  exp?: number;
  [key: string]: unknown;
};

export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(decoded) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as JWTPayload;
  }
  catch {
    return null;
  }
}

/**
 * Check if JWT token is expired or will expire soon
 * @param token JWT token string
 * @param bufferMinutes Minutes before expiry to consider token as "expiring soon" (default: 60)
 * @returns true if token is expired or expiring soon
 */
export function isTokenExpiringSoon(token: string | null, bufferMinutes: number = 60): boolean {
  if (!token) {
    return true;
  }

  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return true;
  }

  const expiryTime = payload.exp * 1000; // exp is in seconds, convert to milliseconds
  const now = Date.now();
  const bufferTime = bufferMinutes * 60 * 1000;

  return expiryTime - now < bufferTime;
}

export function isTokenExpired(token: string | null): boolean {
  if (!token) {
    return true;
  }

  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return true;
  }

  const expiryTime = payload.exp * 1000;
  const now = Date.now();

  return expiryTime < now;
}
