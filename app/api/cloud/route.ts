import { verifyUser } from "@/lib/server/jwt";
import { CloudError, list, usage, wipe } from "@/lib/server/cloud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const user = verifyUser(req.headers.get("authorization"));
  if (!user) return json(401, { error: "Nicht eingeloggt" });
  const url = new URL(req.url);
  try {
    if (url.searchParams.has("usage")) return json(200, await usage(user));
    return json(200, await list(user, url.searchParams.get("prefix") ?? ""));
  } catch (err) {
    if (err instanceof CloudError) return json(err.status, { error: err.message });
    throw err;
  }
}

// nur beim konto loeschen
export async function DELETE(req: Request) {
  const user = verifyUser(req.headers.get("authorization"));
  if (!user) return json(401, { error: "Nicht eingeloggt" });
  await wipe(user);
  return json(200, { ok: true });
}
