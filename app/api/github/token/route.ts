import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "not configured" }, { status: 501 });
  const { device_code } = (await req.json()) as { device_code?: string };
  if (!device_code) return NextResponse.json({ error: "device_code fehlt" }, { status: 400 });
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, device_code, grant_type: "urn:ietf:params:oauth:grant-type:device_code" }),
  });
  return NextResponse.json(await res.json(), { status: 200 });
}
