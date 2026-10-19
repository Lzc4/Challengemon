import { NextResponse } from "next/server";

export async function POST() {
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "GitHub-Anmeldung ist auf dieser Seite nicht eingerichtet" }, { status: 501 });
  const res = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, scope: "repo workflow" }),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
