import { verifyUser } from "@/lib/server/jwt";
import { CloudError, cleanPath, read, remove, write } from "@/lib/server/cloud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function handle(req: Request, ctx: Ctx, fn: (user: string, rel: string) => Promise<Response>) {
  const user = verifyUser(req.headers.get("authorization"));
  if (!user) return json(401, { error: "Nicht eingeloggt" });
  try {
    return await fn(user, cleanPath((await ctx.params).path));
  } catch (err) {
    if (err instanceof CloudError) return json(err.status, { error: err.message });
    console.error("cloud", err);
    return json(500, { error: "Speichern in der Challengemon-Cloud fehlgeschlagen" });
  }
}

export function GET(req: Request, ctx: Ctx) {
  return handle(req, ctx, async (user, rel) => {
    const file = await read(user, rel);
    if (!file) return json(404, { error: "Nicht gefunden" });
    return new Response(file.stream, {
      headers: { "Content-Type": "application/octet-stream", "Content-Length": String(file.size), "Cache-Control": "no-store" },
    });
  });
}

export function PUT(req: Request, ctx: Ctx) {
  return handle(req, ctx, async (user, rel) => {
    const len = req.headers.get("content-length");
    const size = await write(user, rel, req.body, len ? Number(len) : null);
    return json(200, { size });
  });
}

export function DELETE(req: Request, ctx: Ctx) {
  return handle(req, ctx, async (user, rel) => {
    await remove(user, rel);
    return json(200, { ok: true });
  });
}
