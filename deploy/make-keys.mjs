import { createHmac, randomBytes } from "node:crypto";

const secret = process.argv[2] ?? randomBytes(32).toString("hex");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (payload) => {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  return `${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`;
};
const now = Math.floor(Date.now() / 1000);
const exp = now + 10 * 365 * 24 * 3600;
console.log(`JWT_SECRET=${secret}`);
console.log(`REALTIME_SECRET=${randomBytes(48).toString("base64")}`);
console.log(`POSTGRES_PASSWORD=${randomBytes(24).toString("hex")}`);
console.log(`ANON_KEY=${sign({ role: "anon", iss: "supabase", iat: now, exp })}`);
console.log(`SERVICE_ROLE_KEY=${sign({ role: "service_role", iss: "supabase", iat: now, exp })}`);
