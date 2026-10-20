import { createHmac, timingSafeEqual } from "node:crypto";

const b64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

// gotrue signiert mit HS256 und JWT_SECRET, das reicht uns zum pruefen
export function verifyUser(authHeader: string | null): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || !authHeader?.startsWith("Bearer ")) return null;
  const parts = authHeader.slice(7).trim().split(".");
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  try {
    if (JSON.parse(b64url(head).toString()).alg !== "HS256") return null;
    const want = createHmac("sha256", secret).update(`${head}.${body}`).digest();
    const got = b64url(sig);
    if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
    const claims = JSON.parse(b64url(body).toString()) as { sub?: string; exp?: number; role?: string };
    if (claims.role !== "authenticated" || !claims.sub || !claims.exp || claims.exp * 1000 < Date.now()) return null;
    return /^[0-9a-f-]{36}$/.test(claims.sub) ? claims.sub : null;
  } catch {
    return null;
  }
}
